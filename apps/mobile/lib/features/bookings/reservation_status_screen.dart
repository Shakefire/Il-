import 'dart:async';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/guest_flow_errors.dart';
import '../../core/guest_messages.dart';
import '../../core/models/booking.dart';
import '../../core/payments/paystack_checkout.dart';
import '../../core/phase9_cancel_ui.dart';
import '../../core/utils/formatters.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/skeleton/skeleton_box.dart';
import 'paystack_checkout_screen.dart';

/// Shows real booking status after Reserve — backend is SoT.
/// PENDING_HOST wait → PAYMENT_PENDING pay → CONFIRMED after verify.
/// Countdown is display-only; hitting 0 triggers refresh, never a local fake transition.
class ReservationStatusScreen extends StatefulWidget {
  const ReservationStatusScreen({
    super.key,
    required this.bookingId,
    this.accessToken,
  });

  final String bookingId;
  final String? accessToken;

  @override
  State<ReservationStatusScreen> createState() =>
      _ReservationStatusScreenState();
}

class _ReservationStatusScreenState extends State<ReservationStatusScreen>
    with WidgetsBindingObserver, SingleTickerProviderStateMixin {
  bool _isLoading = true;
  bool _paying = false;
  bool _cancelling = false;
  bool _confirmingCheckIn = false;
  GuestFlowError? _error;
  String? _payMessage;
  IleBooking? _booking;
  String? _accessToken;
  Timer? _pollTimer;
  Timer? _tickTimer;
  int _pollCount = 0;
  static const int _maxPolls = 60;
  String? _previousStatus;
  bool _autoPayTriggered = false;
  late final AnimationController _waitPulse;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _accessToken = widget.accessToken;
    // Presentation-only pulse while PENDING_HOST — never advances status.
    _waitPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    _waitPulse.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _load();
    }
  }

  void _restartTimersForStatus(IleBooking booking) {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    _pollCount = 0;

    final bool needsPoll =
        booking.status == 'PENDING_HOST' || booking.status == 'PAYMENT_PENDING';
    if (!needsPoll) return;

    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) async {
      if (!mounted) return;
      if (_pollCount >= _maxPolls) {
        _pollTimer?.cancel();
        return;
      }
      _pollCount += 1;
      await _load(silent: true);
    });

    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() {});
      final IleBooking? b = _booking;
      if (b == null) return;
      // Display-only zero: refresh SoT — do not invent CANCELLED locally
      if (b.status == 'PENDING_HOST') {
        final Duration? left = b.hostResponseRemaining;
        if (left != null && left.inSeconds <= 0) {
          _load(silent: true);
        }
      }
      if (b.status == 'PAYMENT_PENDING') {
        final Duration? left = b.paymentRemaining;
        if (left != null && left.inSeconds <= 0) {
          _load(silent: true);
        }
      }
    });
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) {
      setState(() {
        _isLoading = true;
        _error = null;
      });
    }
    try {
      final IleBooking booking = await context.read<IleApi>().getBooking(
        widget.bookingId,
        accessToken: _accessToken,
      );
      if (!mounted) return;
      if (booking.accessToken != null && booking.accessToken!.isNotEmpty) {
        _accessToken = booking.accessToken;
      }
      final String? previous = _previousStatus;
      setState(() {
        _booking = booking;
        _isLoading = false;
      });
      _previousStatus = booking.status;
      _restartTimersForStatus(booking);
      final bool justAccepted = previous == 'PENDING_HOST' &&
          booking.status == 'PAYMENT_PENDING';
      if (justAccepted && !_autoPayTriggered && !_paying) {
        _autoPayTriggered = true;
        setState(() {
          _payMessage = GuestMessages.acceptedHeadline;
        });
        // Defer so the accepted message paints before checkout opens.
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) _handlePay();
        });
      }
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = GuestFlowError.from(err, surface: 'generic');
        _isLoading = false;
      });
    }
  }

  String _formatRemaining(Duration? d) {
    if (d == null) return '—';
    if (d.isNegative || d.inSeconds <= 0) return 'Refreshing…';
    final int m = d.inMinutes;
    final int s = d.inSeconds % 60;
    if (m <= 0) return '${s}s';
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  Future<void> _openPaystackCheckout({
    required String url,
    String? reference,
  }) async {
    final PaystackCheckoutResult? result =
        await Navigator.of(context).push<PaystackCheckoutResult>(
      MaterialPageRoute<PaystackCheckoutResult>(
        fullscreenDialog: true,
        builder: (BuildContext context) {
          return PaystackCheckoutScreen(
            authorizationUrl: url,
            expectedReference: reference,
          );
        },
      ),
    );
    if (!mounted) return;
    if (result == null) {
      setState(() {
        _payMessage =
            'Checkout closed. Refresh confirms from the server — we never invent payment success.';
      });
      await _load(silent: true);
      return;
    }
    switch (result.outcome) {
      case PaystackCheckoutOutcome.verified:
        setState(() => _payMessage = result.message ?? GuestMessages.paymentVerified);
      case PaystackCheckoutOutcome.pending:
        setState(
          () => _payMessage =
              result.message ?? GuestMessages.paymentStillProcessing,
        );
      case PaystackCheckoutOutcome.dismissed:
        setState(
          () => _payMessage = result.message ??
              'Checkout closed. If you completed payment, refresh — status comes from Ilé.',
        );
      case PaystackCheckoutOutcome.failed:
        setState(
          () => _payMessage = GuestMessages.sanitizeAlert(result.message),
        );
    }
    await _load(silent: true);
  }

  Future<void> _handlePay() async {
    final IleBooking? booking = _booking;
    if (booking == null) return;
    setState(() {
      _paying = true;
      _payMessage = null;
    });
    try {
      final IleApi api = context.read<IleApi>();
      // Re-check — never init pay on PENDING_HOST; never create a second booking.
      final IleBooking latest = await api.getBooking(
        booking.id,
        accessToken: _accessToken ?? booking.accessToken,
      );
      if (!mounted) return;
      setState(() => _booking = latest);
      if (latest.status == 'PENDING_HOST') {
        setState(() {
          _payMessage =
              'Payment opens after the host accepts your booking request.';
        });
        return;
      }
      if (latest.status == 'CONFIRMED' || latest.status == 'COMPLETED') {
        setState(() => _payMessage = GuestMessages.paymentVerified);
        return;
      }
      if (!latest.canPay) {
        setState(() {
          _payMessage = GuestMessages.sanitizeAlert(
            'Payment is not available for this reservation yet.',
          );
        });
        return;
      }

      final Map<String, dynamic> result = await api.initializePayment(
        bookingId: latest.id,
        accessToken: _accessToken ?? latest.accessToken,
      );
      if (!mounted) return;
      final String? url =
          result['authorizationUrl'] as String? ??
          result['authorization_url'] as String?;
      final String? reference = result['reference'] as String?;

      if (url != null &&
          url.isNotEmpty &&
          PaystackCheckout.isValidAuthorizationUrl(url)) {
        setState(() => _payMessage = GuestMessages.openingPaystack);
        await _openPaystackCheckout(url: url, reference: reference);
      } else if (result['error'] != null) {
        setState(
          () => _payMessage = GuestMessages.sanitizeAlert(
            result['error'].toString(),
          ),
        );
      } else if (reference != null && reference.isNotEmpty) {
        // Init without URL (rare) — still only trust Fastify verify.
        final Map<String, dynamic> verified = await api.verifyPayment(
          reference,
        );
        if (!mounted) return;
        if (verified['verified'] == true) {
          setState(() => _payMessage = GuestMessages.paymentVerified);
        } else if (verified['pending'] == true ||
            verified['status'] == 'pending') {
          setState(() => _payMessage = GuestMessages.paymentStillProcessing);
        } else {
          setState(() {
            _payMessage = GuestMessages.sanitizeAlert(
              verified['error']?.toString() ?? 'Payment not verified yet.',
            );
          });
        }
      } else {
        setState(() {
          _payMessage =
              'Payment could not be started. Your reservation was not marked confirmed.';
        });
      }
      await _load(silent: true);
    } catch (err) {
      if (!mounted) return;
      final GuestFlowError flow = GuestFlowError.from(err, surface: 'payment');
      setState(
        () => _payMessage = GuestMessages.sanitizeAlert(
          '${flow.title}. ${flow.message}',
        ),
      );
      await _load(silent: true);
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  Future<void> _handleCancelUnpaid() async {
    final IleBooking? booking = _booking;
    if (booking == null || !booking.canCancelUnpaid) return;
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) {
        return AlertDialog(
          title: Text(
            GuestMessages.unpaidCancelTitle,
            style: AppTypography.cardTitle.copyWith(
              fontFamily: AppTypography.displayFamily,
            ),
          ),
          content: const Text(GuestMessages.unpaidCancelBody),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text(GuestMessages.unpaidCancelKeep),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text(GuestMessages.unpaidCancelConfirm),
            ),
          ],
        );
      },
    );
    if (ok != true || !mounted) return;
    setState(() => _cancelling = true);
    try {
      await context.read<IleApi>().cancelBooking(
        bookingId: booking.id,
        accessToken: _accessToken ?? booking.accessToken,
        reason: 'Guest cancelled from mobile before payment',
      );
      await _load();
    } on ApiException catch (err) {
      if (!mounted) return;
      if (err.statusCode == 409) {
        setState(() {
          _payMessage =
              'Paid stays cannot be cancelled here. Contact Ilé support — only admin processes refunds.';
        });
      } else {
        setState(() => _payMessage = err.message);
      }
    } catch (err) {
      if (!mounted) return;
      setState(() => _payMessage = err.toString());
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  Future<void> _handleConfirmCheckIn() async {
    final IleBooking? booking = _booking;
    if (booking == null || !booking.canConfirmCheckIn) return;
    setState(() {
      _confirmingCheckIn = true;
      _payMessage = null;
    });
    try {
      final IleBooking updated = await context.read<IleApi>().confirmCheckIn(
        bookingId: booking.id,
        accessToken: _accessToken ?? booking.accessToken,
      );
      if (!mounted) return;
      setState(() {
        _booking = updated.copyWith(
          guestCheckInConfirmedAt:
              updated.guestCheckInConfirmedAt ?? DateTime.now().toUtc(),
          canConfirmCheckInFlag: false,
        );
        _payMessage =
            'Check-in confirmed. Host earnings release after hold rules are met.';
      });
      await _load(silent: true);
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() => _payMessage = err.message);
    } catch (err) {
      if (!mounted) return;
      setState(() => _payMessage = err.toString());
    } finally {
      if (mounted) setState(() => _confirmingCheckIn = false);
    }
  }

  Future<void> _handlePaidCancelGuidance() async {
    final IleBooking? booking = _booking;
    if (booking == null) return;
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) {
        return AlertDialog(
          title: Text(
            GuestMessages.paidCancelTitle,
            style: AppTypography.cardTitle.copyWith(
              fontFamily: AppTypography.displayFamily,
            ),
          ),
          content: const Text(GuestMessages.paidCancelBody),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text(GuestMessages.paidCancelKeep),
            ),
            TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text(GuestMessages.paidCancelConfirm),
            ),
          ],
        );
      },
    );
    if (ok != true || !mounted) return;
    setState(() => _cancelling = true);
    try {
      await context.read<IleApi>().cancelBooking(
        bookingId: booking.id,
        accessToken: _accessToken ?? booking.accessToken,
        reason: 'GUEST_REFUND_REQUESTED_AFTER_PAYMENT',
      );
      if (!mounted) return;
      setState(() {
        _payMessage =
            Phase9CancelUi.guestRefundStatusMessage('REQUESTED') ??
            'Refund request submitted. Pending admin review.';
      });
      await _load(silent: true);
    } on ApiException catch (err) {
      if (!mounted) return;
      if (err.statusCode == 409) {
        setState(() {
          _payMessage =
              Phase9CancelUi.guestRefundStatusMessage('REQUESTED') ??
              'Refund request pending admin review. Your stay stays confirmed until resolved.';
        });
        await _load(silent: true);
      } else {
        setState(() => _payMessage = err.message);
      }
    } catch (err) {
      if (!mounted) return;
      setState(() => _payMessage = err.toString());
    } finally {
      if (mounted) setState(() => _cancelling = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: _ReservationSkeleton(),
      );
    }
    if (_error != null || _booking == null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          leading: const IleCircularBackButton(),
          backgroundColor: AppColors.background,
        ),
        body: IleErrorState(
          title: _error?.title ?? 'Couldn’t load reservation',
          message: _error?.message ?? 'This reservation could not be loaded.',
          onRetry: _load,
        ),
      );
    }

    final IleBooking booking = _booking!;
    final _StatusVisual visual = _statusVisual(booking);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: IleCircularBackButton(
          onPressed: () => context.go(AppRoutes.bookings),
        ),
        title: Text('Reservation', style: AppTypography.cardTitle),
        actions: [
          IconButton(
            tooltip: 'Refresh status',
            onPressed: () => _load(),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AnimatedBuilder(
              animation: _waitPulse,
              builder: (BuildContext context, Widget? child) {
                final bool waitingHost = booking.status == 'PENDING_HOST';
                final double scale = waitingHost
                    ? 0.96 + (_waitPulse.value * 0.08)
                    : 1;
                return Transform.scale(
                  scale: scale,
                  child: child,
                );
              },
              child: Container(
                padding: const EdgeInsets.all(AppSpacing.lg),
                decoration: BoxDecoration(
                  color: visual.bg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: visual.border),
                ),
                child: Column(
                  children: [
                    Icon(visual.icon, color: visual.fg, size: 36),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      booking.statusHeadline,
                      textAlign: TextAlign.center,
                      style: AppTypography.sectionHeading.copyWith(
                        color: visual.fg,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      booking.statusBody,
                      textAlign: TextAlign.center,
                      style:
                          AppTypography.supporting.copyWith(color: visual.fg),
                    ),
                    if (booking.status == 'PENDING_HOST') ...[
                      const SizedBox(height: 10),
                      Text(
                        'Waiting for the host to respond. Pull to refresh for the latest status.',
                        textAlign: TextAlign.center,
                        style: AppTypography.caption.copyWith(
                          color: visual.fg.withValues(alpha: 0.85),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            _MetaRow(
              label: 'Status',
              value: GuestMessages.statusLabel(booking.status),
            ),
            _MetaRow(
              label: 'Dates',
              value: '${booking.checkInDate} → ${booking.checkOutDate}',
            ),
            _MetaRow(label: 'Guests', value: '${booking.guestCount}'),
            if (booking.totalAmount > 0)
              _MetaRow(
                label: 'Total',
                value: '₦${IleFormatters.formatInteger(booking.totalAmount)}',
              ),
            if (booking.propertyTitle != null &&
                booking.propertyTitle!.trim().isNotEmpty)
              _MetaRow(label: 'Stay', value: booking.propertyTitle!),
            if (booking.reference != null)
              _MetaRow(label: 'Reference', value: booking.reference!),
            if (booking.status == 'PENDING_HOST')
              _MetaRow(
                label: 'Host reply window',
                value: _formatRemaining(booking.hostResponseRemaining),
              ),
            if (booking.status == 'PAYMENT_PENDING')
              _MetaRow(
                label: 'Payment window',
                value: _formatRemaining(booking.paymentRemaining),
              ),
            if (_payMessage != null) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                GuestMessages.sanitizeAlert(_payMessage),
                style: AppTypography.caption.copyWith(
                  color: AppColors.foregroundSecondary,
                ),
              ),
            ],
            const Spacer(),
            if (booking.canConfirmCheckIn) ...[
              IleButton(
                label: "Confirm I've checked in",
                onPressed: _confirmingCheckIn ? null : _handleConfirmCheckIn,
                isLoading: _confirmingCheckIn,
                isExpanded: true,
              ),
              const SizedBox(height: 8),
            ] else if (booking.guestCheckInConfirmed) ...[
              Text(
                'Check-in confirmed',
                textAlign: TextAlign.center,
                style: AppTypography.supporting.copyWith(
                  color: AppColors.successText,
                ),
              ),
              const SizedBox(height: 8),
            ],
            if (booking.canPay)
              IleButton(
                label: 'Complete payment',
                onPressed: _paying ? null : _handlePay,
                isLoading: _paying,
                isExpanded: true,
              )
            else ...[
              IleButton(
                label: 'Back to bookings',
                onPressed: () => context.go(AppRoutes.bookings),
                isExpanded: true,
              ),
              if (_isTerminalOutcome(booking)) ...[
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => context.go(AppRoutes.explore),
                  style: TextButton.styleFrom(minimumSize: const Size(44, 44)),
                  child: Text(
                    'Find another stay',
                    style: AppTypography.supporting.copyWith(
                      color: AppColors.emerald,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ],
            if (booking.canCancelUnpaid) ...[
              const SizedBox(height: 8),
              TextButton(
                onPressed: _cancelling ? null : _handleCancelUnpaid,
                child: Text(
                  _cancelling
                      ? 'Cancelling…'
                      : (Phase9CancelUi.guestCancelCtaLabel(booking.status) ??
                          'Cancel unpaid'),
                  style: AppTypography.supporting.copyWith(
                    color: AppColors.foregroundSecondary,
                  ),
                ),
              ),
            ],
            if (booking.isConfirmed) ...[
              const SizedBox(height: 4),
              TextButton(
                onPressed: _handlePaidCancelGuidance,
                child: Text(
                  Phase9CancelUi.guestCancelCtaLabel(booking.status) ??
                      'Request cancellation (admin refund)',
                  style: AppTypography.caption.copyWith(
                    decoration: TextDecoration.underline,
                  ),
                ),
              ),
            ],
            if (booking.status == 'PENDING_HOST') ...[
              const SizedBox(height: 8),
              Text(
                'We will unlock payment as soon as the host accepts.',
                textAlign: TextAlign.center,
                style: AppTypography.caption,
              ),
            ],
          ],
        ),
      ),
    );
  }

  bool _isTerminalOutcome(IleBooking booking) {
    switch (booking.outcome.kind) {
      case 'declined':
      case 'request_expired':
      case 'payment_expired':
      case 'guest_cancelled':
      case 'superseded':
      case 'late_reconciliation':
      case 'cancelled':
        return true;
      default:
        return false;
    }
  }

  _StatusVisual _statusVisual(IleBooking booking) {
    if (booking.outcome.kind == 'declined' ||
        booking.outcome.kind == 'guest_cancelled' ||
        booking.outcome.kind == 'superseded' ||
        booking.outcome.kind == 'cancelled') {
      return const _StatusVisual(
        icon: Icons.cancel_outlined,
        bg: AppColors.criticalBg,
        fg: AppColors.criticalText,
        border: AppColors.criticalBorder,
      );
    }
    if (booking.outcome.kind == 'request_expired' ||
        booking.outcome.kind == 'payment_expired' ||
        booking.outcome.kind == 'late_reconciliation') {
      return const _StatusVisual(
        icon: Icons.timer_off_outlined,
        bg: AppColors.warningBg,
        fg: AppColors.warningText,
        border: AppColors.warningBorder,
      );
    }
    if (booking.isConfirmed) {
      return const _StatusVisual(
        icon: Icons.check_circle_outline,
        bg: AppColors.successBg,
        fg: AppColors.successText,
        border: AppColors.successBorder,
      );
    }
    if (booking.isCancelled) {
      return const _StatusVisual(
        icon: Icons.cancel_outlined,
        bg: AppColors.criticalBg,
        fg: AppColors.criticalText,
        border: AppColors.criticalBorder,
      );
    }
    if (booking.isCompleted) {
      return const _StatusVisual(
        icon: Icons.home_outlined,
        bg: AppColors.infoBg,
        fg: AppColors.infoText,
        border: AppColors.infoBorder,
      );
    }
    if (booking.canPay) {
      return const _StatusVisual(
        icon: Icons.payments_outlined,
        bg: AppColors.warningBg,
        fg: AppColors.warningText,
        border: AppColors.warningBorder,
      );
    }
    return const _StatusVisual(
      icon: Icons.hourglass_top_rounded,
      bg: AppColors.warningBg,
      fg: AppColors.warningText,
      border: AppColors.warningBorder,
    );
  }
}

class _StatusVisual {
  const _StatusVisual({
    required this.icon,
    required this.bg,
    required this.fg,
    required this.border,
  });

  final IconData icon;
  final Color bg;
  final Color fg;
  final Color border;
}

class _ReservationSkeleton extends StatelessWidget {
  const _ReservationSkeleton();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Loading host confirmation',
      child: ListView(
        padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
        children: const [
          SizedBox(height: 72),
          SkeletonBox(height: 140, borderRadius: BorderRadius.all(Radius.circular(16))),
          SizedBox(height: AppSpacing.lg),
          SkeletonBox(height: 18),
          SizedBox(height: AppSpacing.sm),
          SkeletonBox(height: 18),
          SizedBox(height: AppSpacing.sm),
          SkeletonBox(height: 18),
          SizedBox(height: AppSpacing.xl),
          SkeletonBox(height: 48),
        ],
      ),
    );
  }
}

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          SizedBox(width: 96, child: Text(label, style: AppTypography.caption)),
          Expanded(
            child: Text(
              value,
              style: AppTypography.supporting.copyWith(
                color: AppColors.foreground,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
