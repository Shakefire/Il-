import 'dart:async';

import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
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
import '../../core/models/property.dart';
import '../../core/payments/paystack_checkout.dart';
import '../../core/phase9_cancel_ui.dart';
import '../../core/state/search_session.dart';
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
  final ValueNotifier<DateTime> _clockNotifier =
      ValueNotifier<DateTime>(DateTime.now());
  int _pollCount = 0;
  static const int _maxPolls = 60;
  String? _previousStatus;
  bool _autoPayTriggered = false;
  bool _loadingSimilar = false;
  List<IleProperty> _similarProperties = <IleProperty>[];
  String? _similarError;
  String? _hasLoadedSimilarForId;
  late final AnimationController _waitPulse;
  int _reviewRating = 5;
  String _supportCategory = 'BOOKING';
  bool _submittingReview = false;
  bool _submittingSupport = false;
  final TextEditingController _reviewBody = TextEditingController();
  final TextEditingController _supportSubject = TextEditingController();
  final TextEditingController _supportMessage = TextEditingController();

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
    _clockNotifier.dispose();
    _waitPulse.dispose();
    _reviewBody.dispose();
    _supportSubject.dispose();
    _supportMessage.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _load(silent: true);
      if (_booking != null) _restartTimersForStatus(_booking!);
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _pollTimer?.cancel();
      _tickTimer?.cancel();
    }
  }

  void _restartTimersForStatus(IleBooking booking) {
    _pollTimer?.cancel();
    _tickTimer?.cancel();
    _pollCount = 0;

    final bool needsPoll =
        booking.status == 'PENDING_HOST' || booking.status == 'PAYMENT_PENDING';
    if (!needsPoll) return;

    _scheduleNextPoll();

    _tickTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      _clockNotifier.value = DateTime.now();
      final IleBooking? b = _booking;
      if (b == null) return;
      // Display-only zero: refresh SoT — do not invent CANCELLED locally
      if (b.status == 'PENDING_HOST') {
        final Duration? left = b.hostResponseRemaining;
        if (left != null && left.inSeconds <= 0) {
          _tickTimer?.cancel();
          _load(silent: true);
        }
      } else if (b.status == 'PAYMENT_PENDING') {
        final Duration? left = b.paymentRemaining;
        if (left != null && left.inSeconds <= 0) {
          _tickTimer?.cancel();
          _load(silent: true);
        }
      }
    });
  }

  void _scheduleNextPoll() {
    _pollTimer?.cancel();
    if (!mounted) return;
    final IleBooking? b = _booking;
    if (b == null) return;
    final bool needsPoll =
        b.status == 'PENDING_HOST' || b.status == 'PAYMENT_PENDING';
    if (!needsPoll || _pollCount >= _maxPolls) return;

    // Fast 4s poll during initial 60s (15 polls), then back off to 8s
    final int delaySec = _pollCount < 15 ? 4 : 8;
    _pollTimer = Timer(Duration(seconds: delaySec), () async {
      if (!mounted) return;
      _pollCount += 1;
      await _load(silent: true);
      _scheduleNextPoll();
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
      if (_isTerminalOutcome(booking) &&
          _hasLoadedSimilarForId != booking.id &&
          !_loadingSimilar) {
        _fetchSimilarProperties(booking.id);
      }
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = GuestFlowError.from(err, surface: 'generic');
        _isLoading = false;
      });
    }
  }

  Future<void> _fetchSimilarProperties(String bookingId) async {
    setState(() {
      _loadingSimilar = true;
      _similarError = null;
    });
    try {
      final Map<String, dynamic> res =
          await context.read<IleApi>().getSimilarProperties(bookingId);
      final List<dynamic> raw =
          (res['properties'] as List<dynamic>?) ?? <dynamic>[];
      final List<IleProperty> props = raw
          .whereType<Map>()
          .map((Map e) => IleProperty.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      if (!mounted) return;
      setState(() {
        _similarProperties = props;
        _hasLoadedSimilarForId = bookingId;
        _loadingSimilar = false;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _similarError = err.toString();
        _loadingSimilar = false;
      });
    }
  }

  void _navigateToSimilarProperty(IleProperty prop, IleBooking booking) {
    final SearchSession session = context.read<SearchSession>();
    final String destination = prop.neighborhood.isNotEmpty
        ? prop.neighborhood
        : (prop.city.isNotEmpty ? prop.city : (booking.propertyCity ?? 'Lagos'));
    session.setPlace(destination);
    session.setDates(start: booking.checkInDate, end: booking.checkOutDate);
    session.setGuests(booking.guestCount);
    context.push(AppRoutes.propertyDetailsPath(prop.slug));
  }

  void _searchWithPreservedContext(IleBooking booking) {
    final SearchSession session = context.read<SearchSession>();
    final String city = booking.propertyCity ?? 'Lagos';
    session.setPlace(city);
    session.setDates(start: booking.checkInDate, end: booking.checkOutDate);
    session.setGuests(booking.guestCount);
    context.go(AppRoutes.searchResults);
  }

  static String _formatBookingDates(String inDate, String outDate) {
    final DateTime? s = DateTime.tryParse(inDate);
    final DateTime? e = DateTime.tryParse(outDate);
    if (s != null && e != null) {
      final DateFormat f = DateFormat("MMM d");
      return "${f.format(s)} → ${f.format(e)}";
    }
    return "$inDate → $outDate";
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

  Future<void> _openStayDetails() async {
    final IleBooking? booking = _booking;
    if (booking == null) return;
    try {
      final Map<String, dynamic> stay =
          await context.read<IleApi>().getStayDetails(booking.id);
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (BuildContext sheetCtx) {
          final Map<String, dynamic>? checkIn =
              stay['checkIn'] is Map ? Map<String, dynamic>.from(stay['checkIn'] as Map) : null;
          final Map<String, dynamic>? checkOut =
              stay['checkOut'] is Map ? Map<String, dynamic>.from(stay['checkOut'] as Map) : null;
          final String propName = stay['propertyName']?.toString() ?? 'Stay details';
          final String ref = stay['reference']?.toString() ?? booking.reference ?? '';
          final String locationStr = [stay['neighborhood'], stay['city']]
              .where((Object? v) => v != null && v.toString().isNotEmpty)
              .join(', ');
          final String? arrivalNotes = stay['arrivalNotes']?.toString();

          return SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      margin: const EdgeInsets.only(bottom: 20),
                      decoration: BoxDecoration(
                        color: const Color(0xFFD6D3CB),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Stay & Arrival Details',
                        style: AppTypography.cardTitle.copyWith(fontSize: 18),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.emeraldLight,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          'REF: $ref',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.emerald,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    propName,
                    style: AppTypography.screenTitle.copyWith(fontSize: 20),
                  ),
                  if (locationStr.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textMuted),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            locationStr,
                            style: AppTypography.caption.copyWith(color: AppColors.textMuted),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 20),
                  // Check-in / Check-out timing box
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF9F7F2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE8E5DE)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'CHECK-IN',
                                style: AppTypography.caption.copyWith(
                                  letterSpacing: 0.8,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textMuted,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                checkIn?['date']?.toString() ?? 'Confirmed date',
                                style: AppTypography.body.copyWith(fontWeight: FontWeight.w600),
                              ),
                              if (checkIn?['after'] != null)
                                Text(
                                  'After ${checkIn!['after']}',
                                  style: AppTypography.caption.copyWith(fontSize: 12),
                                ),
                            ],
                          ),
                        ),
                        Container(height: 40, width: 1, color: const Color(0xFFE8E5DE)),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'CHECK-OUT',
                                style: AppTypography.caption.copyWith(
                                  letterSpacing: 0.8,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textMuted,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                checkOut?['date']?.toString() ?? 'Confirmed date',
                                style: AppTypography.body.copyWith(fontWeight: FontWeight.w600),
                              ),
                              if (checkOut?['before'] != null)
                                Text(
                                  'Before ${checkOut!['before']}',
                                  style: AppTypography.caption.copyWith(fontSize: 12),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Arrival / Check-in Notes
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE8E5DE)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.key_outlined, size: 18, color: AppColors.emerald),
                            const SizedBox(width: 8),
                            Text(
                              'Arrival Guidance & Instructions',
                              style: AppTypography.cardTitle.copyWith(fontSize: 14),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          (arrivalNotes != null && arrivalNotes.trim().isNotEmpty)
                              ? arrivalNotes
                              : 'No special access restrictions. Your host will be available to welcome you upon arrival.',
                          style: AppTypography.body.copyWith(
                            color: const Color(0xFF374151),
                            height: 1.45,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Verified Stay Email Banner
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.emeraldLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.mark_email_read_outlined, size: 18, color: AppColors.emerald),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Full arrival guide and host contact have also been delivered to your email.',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.emerald,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  IleButton(
                    label: 'Close',
                    onPressed: () => Navigator.of(sheetCtx).pop(),
                    isExpanded: true,
                  ),
                  const SizedBox(height: 8),
                ],
              ),
            ),
          );
        },
      );
    } catch (err) {
      if (!mounted) return;
      setState(() => _payMessage = GuestMessages.sanitizeAlert(err.toString()));
    }
  }

  bool _reviewWindowOpen(IleBooking booking) {
    final DateTime? checkout = booking.checkOutDay;
    if (checkout == null) return false;
    final DateTime now = DateTime.now();
    final DateTime today = DateTime(now.year, now.month, now.day);
    return checkout.isBefore(today) &&
        (booking.isConfirmed || booking.status == 'COMPLETED');
  }

  Future<void> _submitReview(IleBooking booking) async {
    setState(() => _submittingReview = true);
    try {
      await context.read<IleApi>().createReview(
        bookingId: booking.id,
        overallRating: _reviewRating,
        body: _reviewBody.text.trim(),
      );
      if (!mounted) return;
      setState(() => _payMessage = 'Review saved.');
      Navigator.of(context).pop();
    } catch (err) {
      if (!mounted) return;
      setState(() => _payMessage = GuestMessages.sanitizeAlert(err.toString()));
    } finally {
      if (mounted) setState(() => _submittingReview = false);
    }
  }

  Future<void> _submitSupport(IleBooking booking) async {
    setState(() => _submittingSupport = true);
    try {
      await context.read<IleApi>().createSupportCase(
        category: _supportCategory,
        subject: _supportSubject.text.trim(),
        message: _supportMessage.text.trim(),
        bookingId: booking.id,
      );
      if (!mounted) return;
      setState(
        () => _payMessage =
            'Support request sent. Ilé admin reviews it. This does not move money.',
      );
      Navigator.of(context).pop();
    } catch (err) {
      if (!mounted) return;
      setState(() => _payMessage = GuestMessages.sanitizeAlert(err.toString()));
    } finally {
      if (mounted) setState(() => _submittingSupport = false);
    }
  }

  Future<void> _openStayFollowUp() async {
    final IleBooking? booking = _booking;
    if (booking == null) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext sheetContext) {
        return Padding(
          padding: EdgeInsets.only(
            left: AppSpacing.lg,
            right: AppSpacing.lg,
            top: AppSpacing.lg,
            bottom: MediaQuery.viewInsetsOf(sheetContext).bottom + AppSpacing.lg,
          ),
          child: StatefulBuilder(
            builder: (BuildContext context, StateSetter setSheet) {
              return SingleChildScrollView(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('After your stay', style: AppTypography.cardTitle),
                    const SizedBox(height: 8),
                    Text(
                      _reviewWindowOpen(booking)
                          ? 'Rate the stay you completed. One review per booking.'
                          : 'Reviews open after checkout. You can still send a support request.',
                      style: AppTypography.supporting,
                    ),
                    if (_reviewWindowOpen(booking)) ...[
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        children: List<Widget>.generate(5, (int index) {
                          final int value = index + 1;
                          return SizedBox(
                            width: 44,
                            height: 44,
                            child: TextButton(
                              onPressed: () => setSheet(() => _reviewRating = value),
                              child: Text(
                                '$value',
                                style: TextStyle(
                                  fontWeight: _reviewRating == value
                                      ? FontWeight.w800
                                      : FontWeight.w500,
                                  color: AppColors.emerald,
                                ),
                              ),
                            ),
                          );
                        }),
                      ),
                      TextField(
                        controller: _reviewBody,
                        maxLines: 3,
                        decoration: const InputDecoration(
                          labelText: 'Review',
                          hintText: 'What should the next guest know?',
                        ),
                      ),
                      const SizedBox(height: 8),
                      IleButton(
                        label: 'Submit review',
                        isLoading: _submittingReview,
                        onPressed: _submittingReview ? null : () => _submitReview(booking),
                        isExpanded: true,
                      ),
                    ],
                    const SizedBox(height: 16),
                    Text('Contact support', style: AppTypography.cardTitle),
                    const SizedBox(height: 8),
                    Text(
                      'Refund requests are reviewed by Ilé admin. Sending this does not refund you.',
                      style: AppTypography.supporting,
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      initialValue: _supportCategory,
                      decoration: const InputDecoration(labelText: 'Category'),
                      items: const <DropdownMenuItem<String>>[
                        DropdownMenuItem(value: 'BOOKING', child: Text('Booking')),
                        DropdownMenuItem(value: 'PAYMENT', child: Text('Payment')),
                        DropdownMenuItem(value: 'REFUND_REQUEST', child: Text('Refund request')),
                        DropdownMenuItem(value: 'ACCESS', child: Text('Access')),
                        DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                      ],
                      onChanged: (String? value) {
                        if (value == null) return;
                        setSheet(() => _supportCategory = value);
                      },
                    ),
                    TextField(
                      controller: _supportSubject,
                      decoration: const InputDecoration(labelText: 'Subject'),
                    ),
                    TextField(
                      controller: _supportMessage,
                      maxLines: 3,
                      decoration: const InputDecoration(labelText: 'Message'),
                    ),
                    const SizedBox(height: 8),
                    IleButton(
                      label: 'Send request',
                      isLoading: _submittingSupport,
                      onPressed: _submittingSupport ? null : () => _submitSupport(booking),
                      isExpanded: true,
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
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
      body: SingleChildScrollView(
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
              value: _formatBookingDates(booking.checkInDate, booking.checkOutDate),
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
              ValueListenableBuilder<DateTime>(
                valueListenable: _clockNotifier,
                builder: (BuildContext context, DateTime _, Widget? __) {
                  return _MetaRow(
                    label: 'Host reply window',
                    value: _formatRemaining(booking.hostResponseRemaining),
                  );
                },
              ),
            if (booking.status == 'PAYMENT_PENDING')
              ValueListenableBuilder<DateTime>(
                valueListenable: _clockNotifier,
                builder: (BuildContext context, DateTime _, Widget? __) {
                  return _MetaRow(
                    label: 'Payment window',
                    value: _formatRemaining(booking.paymentRemaining),
                  );
                },
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
            const SizedBox(height: AppSpacing.lg),
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
                  onPressed: () => _searchWithPreservedContext(booking),
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
            if (booking.isConfirmed || booking.status == 'COMPLETED') ...[
              const SizedBox(height: 8),
              IleButton(
                label: 'Stay details',
                onPressed: _openStayDetails,
                isExpanded: true,
              ),
              const SizedBox(height: 8),
              IleButton(
                label: 'Review or contact support',
                onPressed: _openStayFollowUp,
                isExpanded: true,
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
            if (_isTerminalOutcome(booking)) ...[
              const SizedBox(height: AppSpacing.xl),
              _buildSimilarStaysSection(booking),
            ],
            const SizedBox(height: AppSpacing.xxl),
          ],
        ),
      ),
    );
  }

  Widget _buildSimilarStaysSection(IleBooking booking) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.travel_explore_rounded,
                color: AppColors.emerald,
                size: 22,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Similar available stays nearby',
                  style: AppTypography.cardTitle.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Available for ${_formatBookingDates(booking.checkInDate, booking.checkOutDate)} · ${booking.guestCount} guest${booking.guestCount > 1 ? 's' : ''}',
            style: AppTypography.caption.copyWith(
              color: AppColors.foregroundSecondary,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (_loadingSimilar)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Column(
                  children: [
                    CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: AppColors.emerald,
                    ),
                    SizedBox(height: 12),
                    Text(
                      'Checking live availability for similar stays…',
                      style: AppTypography.caption,
                    ),
                  ],
                ),
              ),
            )
          else if (_similarError != null)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Could not check similar stays: $_similarError',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.criticalText,
                  ),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => _fetchSimilarProperties(booking.id),
                  child: const Text('Try again'),
                ),
              ],
            )
          else if (_similarProperties.isEmpty)
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'No direct matches found in this neighborhood for your dates.',
                  style: AppTypography.supporting,
                ),
                const SizedBox(height: AppSpacing.md),
                IleButton(
                  label:
                      'Search all stays in ${booking.propertyCity ?? 'Lagos'}',
                  onPressed: () => _searchWithPreservedContext(booking),
                  variant: IleButtonVariant.secondary,
                  isExpanded: true,
                ),
              ],
            )
          else
            Column(
              children: _similarProperties.map((prop) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.md),
                  child: Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: AppColors.border),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => _navigateToSimilarProperty(prop, booking),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (prop.primaryImage.isNotEmpty)
                            SizedBox(
                              width: 100,
                              height: 100,
                              child: Image.network(
                                prop.primaryImage,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) => Container(
                                  color: AppColors.surfaceMuted,
                                  child: const Icon(
                                    Icons.home_work_outlined,
                                    color: AppColors.foregroundMuted,
                                  ),
                                ),
                              ),
                            )
                          else
                            Container(
                              width: 100,
                              height: 100,
                              color: AppColors.surfaceMuted,
                              child: const Icon(
                                Icons.home_work_outlined,
                                color: AppColors.foregroundMuted,
                              ),
                            ),
                          Expanded(
                            child: Padding(
                              padding: const EdgeInsets.all(10),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    prop.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.bodyMedium.copyWith(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    prop.locationLabel,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: AppTypography.caption,
                                  ),
                                  const SizedBox(height: 6),
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        '₦${IleFormatters.formatInteger(prop.pricePerNight)} / night',
                                        style:
                                            AppTypography.supporting.copyWith(
                                          fontWeight: FontWeight.w700,
                                          color: AppColors.emerald,
                                        ),
                                      ),
                                      Text(
                                        'View stay →',
                                        style: AppTypography.caption.copyWith(
                                          color: AppColors.emerald,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
        ],
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
