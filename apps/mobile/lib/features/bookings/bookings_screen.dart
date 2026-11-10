import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/guest_flow_errors.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/models/booking.dart';
import '../../shared/widgets/editorial_chrome.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/skeleton/booking_card_skeleton.dart';

/// Tabs map only to real backend statuses + date windows.
/// Requests = PENDING_HOST | PAYMENT_PENDING | PENDING
/// Upcoming = CONFIRMED with future check-in
/// Ongoing = CONFIRMED with check-in ≤ today < check-out
/// Past = COMPLETED or past check-out (non-cancelled)
/// Cancelled = CANCELLED | FAILED
enum _BookingTab { requests, upcoming, ongoing, past, cancelled }

class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> {
  _BookingTab _tab = _BookingTab.requests;
  bool _isLoading = true;
  bool _needsAuth = false;
  bool _didPickInitialTab = false;
  GuestFlowError? _error;
  List<IleBooking> _bookings = <IleBooking>[];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
      _needsAuth = false;
    });
    try {
      final ApiClient client = context.read<ApiClient>();
      final IleApi api = context.read<IleApi>();
      final String? token = await client.getToken();
      if (token == null || token.isEmpty) {
        if (!mounted) return;
        setState(() {
          _needsAuth = true;
          _isLoading = false;
          _bookings = <IleBooking>[];
        });
        return;
      }
      final List<IleBooking> bookings = await api.getUserBookings();
      if (!mounted) return;
      setState(() {
        _bookings = bookings;
        _isLoading = false;
        if (!_didPickInitialTab) {
          _tab = _preferredTab(bookings);
          _didPickInitialTab = true;
        }
      });
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() {
        _needsAuth = err.statusCode == 401;
        _error = err.statusCode == 401
            ? null
            : GuestFlowError.from(err, surface: 'generic');
        _isLoading = false;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = GuestFlowError.from(err, surface: 'generic');
        _isLoading = false;
      });
    }
  }

  _BookingTab _preferredTab(List<IleBooking> bookings) {
    if (bookings.any((IleBooking b) => b.isOngoing)) {
      return _BookingTab.ongoing;
    }
    if (bookings.any((IleBooking b) => b.isRequest)) {
      return _BookingTab.requests;
    }
    if (bookings.any((IleBooking b) => b.isUpcoming)) {
      return _BookingTab.upcoming;
    }
    return _BookingTab.requests;
  }

  List<IleBooking> get _filtered {
    return _bookings.where((IleBooking b) {
      switch (_tab) {
        case _BookingTab.requests:
          return b.isRequest;
        case _BookingTab.upcoming:
          return b.isUpcoming;
        case _BookingTab.ongoing:
          return b.isOngoing;
        case _BookingTab.past:
          return b.isPast;
        case _BookingTab.cancelled:
          return b.isCancelled;
      }
    }).toList();
  }

  int _countFor(_BookingTab tab) {
    return _bookings.where((IleBooking b) {
      switch (tab) {
        case _BookingTab.requests:
          return b.isRequest;
        case _BookingTab.upcoming:
          return b.isUpcoming;
        case _BookingTab.ongoing:
          return b.isOngoing;
        case _BookingTab.past:
          return b.isPast;
        case _BookingTab.cancelled:
          return b.isCancelled;
      }
    }).length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EditorialColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
        children: [
          const EditorialToolbar(
            title: 'Bookings',
            explorePill: true,
            trailing: EditorialHelpButton(),
          ),
          if (!_needsAuth && !_isLoading && _error == null)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenHorizontal,
                0,
                AppSpacing.screenHorizontal,
                AppSpacing.sm,
              ),
              child: Row(
                children: _BookingTab.values.map((_BookingTab tab) {
                  final bool selected = _tab == tab;
                  final int count = _countFor(tab);
                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: Semantics(
                      button: true,
                      selected: selected,
                      label: _tabLabel(tab),
                      child: InkWell(
                        onTap: () => setState(() => _tab = tab),
                        borderRadius: AppRadius.pillAll,
                        child: Ink(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 10,
                          ),
                          decoration: BoxDecoration(
                            color: selected
                                ? AppColors.emerald
                                : AppColors.surface,
                            borderRadius: AppRadius.pillAll,
                            border: Border.all(
                              color: selected
                                  ? AppColors.emerald
                                  : AppColors.border,
                            ),
                          ),
                          child: Text(
                            count > 0
                                ? '${_tabLabel(tab)} ($count)'
                                : _tabLabel(tab),
                            style: AppTypography.supporting.copyWith(
                              color: selected
                                  ? AppColors.onDark
                                  : AppColors.foreground,
                              fontWeight: FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          Expanded(
            child: _isLoading
                ? ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
                    itemCount: 4,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (_, _) => const BookingCardSkeleton(),
                  )
                : _needsAuth
                ? const GuestSignInGate(
                    returnPath: AppRoutes.bookings,
                    preview: SampleStayPass(),
                    message:
                        'Sign in to see requests and confirmed stays. The card above is a sample of check-in details — gate codes, Wi-Fi, and concierge notes appear only after a host confirms.',
                  )
                : _error != null
                ? IleErrorState(
                    title: _error!.title,
                    message: _error!.message,
                    onRetry: _load,
                  )
                : _filtered.isEmpty
                ? IleEmptyState(
                    title: _emptyTitle(_tab),
                    message: _emptyMessage(_tab),
                    icon: _emptyIcon(_tab),
                    actionLabel: 'Explore stays',
                    onAction: () => context.go(AppRoutes.explore),
                  )
                : RefreshIndicator(
                    color: AppColors.emerald,
                    onRefresh: _load,
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.screenHorizontal,
                        0,
                        AppSpacing.screenHorizontal,
                        120,
                      ),
                      itemCount: _filtered.length,
                      separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (BuildContext context, int index) {
                        final IleBooking booking = _filtered[index];
                        return _BookingCard(
                          booking: booking,
                          onOpen: () => context.push(
                            AppRoutes.reservationStatusPath(
                              booking.id,
                              accessToken: booking.accessToken,
                            ),
                          ),
                        );
                      },
                    ),
                  ),
          ),
        ],
        ),
      ),
    );
  }

  String _tabLabel(_BookingTab tab) {
    switch (tab) {
      case _BookingTab.requests:
        return 'Requests';
      case _BookingTab.upcoming:
        return 'Upcoming';
      case _BookingTab.ongoing:
        return 'Ongoing';
      case _BookingTab.past:
        return 'Past';
      case _BookingTab.cancelled:
        return 'Cancelled';
    }
  }

  String _emptyTitle(_BookingTab tab) {
    switch (tab) {
      case _BookingTab.requests:
        return 'No open requests';
      case _BookingTab.upcoming:
        return 'No upcoming stays';
      case _BookingTab.ongoing:
        return 'No stays in progress';
      case _BookingTab.past:
        return 'No past stays yet';
      case _BookingTab.cancelled:
        return 'No cancelled bookings';
    }
  }

  String _emptyMessage(_BookingTab tab) {
    switch (tab) {
      case _BookingTab.requests:
        return 'When you reserve a stay, payment-due holds appear here until you complete checkout.';
      case _BookingTab.upcoming:
        return 'Confirmed trips with a future check-in will show up here.';
      case _BookingTab.ongoing:
        return 'Once check-in day arrives for a confirmed booking, it moves here until check-out.';
      case _BookingTab.past:
        return 'Completed trips and stays past check-out will collect here.';
      case _BookingTab.cancelled:
        return 'Cancelled or expired unpaid holds will appear in this list.';
    }
  }

  IconData _emptyIcon(_BookingTab tab) {
    switch (tab) {
      case _BookingTab.requests:
        return Icons.pending_actions_outlined;
      case _BookingTab.upcoming:
        return Icons.event_available_outlined;
      case _BookingTab.ongoing:
        return Icons.home_outlined;
      case _BookingTab.past:
        return Icons.history_rounded;
      case _BookingTab.cancelled:
        return Icons.event_busy_outlined;
    }
  }
}

class _BookingCard extends StatelessWidget {
  const _BookingCard({required this.booking, required this.onOpen});

  final IleBooking booking;
  final VoidCallback onOpen;

  String _formatDate(String raw) {
    final DateTime? parsed = DateTime.tryParse(raw);
    if (parsed == null) return raw;
    return DateFormat('d MMM yyyy').format(parsed);
  }

  @override
  Widget build(BuildContext context) {
    final Color chipBg = booking.canPay
        ? AppColors.warningBg
        : booking.isHostPending
        ? AppColors.infoBg
        : booking.isOngoing
        ? AppColors.successBg
        : booking.isCancelled
        ? AppColors.criticalBg
        : AppColors.emeraldLight;
    final Color chipFg = booking.canPay
        ? AppColors.warningText
        : booking.isHostPending
        ? AppColors.infoText
        : booking.isOngoing
        ? AppColors.successText
        : booking.isCancelled
        ? AppColors.criticalText
        : AppColors.emerald;

    return Material(
      color: AppColors.surface,
      borderRadius: AppRadius.panelAll,
      child: InkWell(
        onTap: onOpen,
        borderRadius: AppRadius.panelAll,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: AppRadius.panelAll,
            border: Border.all(color: AppColors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ClipRRect(
                    borderRadius: AppRadius.subtleAll,
                    child: SizedBox(
                      width: 88,
                      height: 88,
                      child:
                          booking.propertyCover == null ||
                              booking.propertyCover!.isEmpty
                          ? const ColoredBox(
                              color: AppColors.surfaceMuted,
                              child: Icon(Icons.home_work_outlined),
                            )
                          : CachedNetworkImage(
                              imageUrl: booking.propertyCover!,
                              fit: BoxFit.cover,
                              errorWidget: (_, _, _) => const ColoredBox(
                                color: AppColors.surfaceMuted,
                                child: Icon(Icons.broken_image_outlined),
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          booking.propertyTitle ?? 'Reserved stay',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.cardTitle.copyWith(fontSize: 15),
                        ),
                        if (booking.locationLabel.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            booking.locationLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.caption,
                          ),
                        ],
                        const SizedBox(height: 6),
                        Text(
                          '${_formatDate(booking.checkInDate)} → ${_formatDate(booking.checkOutDate)}',
                          style: AppTypography.supporting.copyWith(
                            color: AppColors.foreground,
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(booking.guestsLabel, style: AppTypography.caption),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: chipBg,
                  borderRadius: AppRadius.subtleAll,
                  border: Border.all(color: chipFg.withValues(alpha: 0.25)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      booking.statusHeadline,
                      style: AppTypography.supporting.copyWith(
                        color: chipFg,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      booking.statusBody,
                      style: AppTypography.caption.copyWith(color: chipFg),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: onOpen,
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.emerald,
                    minimumSize: const Size(44, 44),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  child: Text(
                    booking.listActionLabel,
                    style: AppTypography.supporting.copyWith(
                      color: AppColors.emerald,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
