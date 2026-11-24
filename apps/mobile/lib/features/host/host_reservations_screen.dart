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
import '../../core/host_messages.dart';
import '../../core/utils/formatters.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';
import 'host_chrome.dart';

class HostReservationsScreen extends StatefulWidget {
  const HostReservationsScreen({super.key});

  @override
  State<HostReservationsScreen> createState() => _HostReservationsScreenState();
}

class _HostReservationsScreenState extends State<HostReservationsScreen>
    with WidgetsBindingObserver {
  bool _loading = true;
  String? _error;
  String? _notice;
  List<Map<String, dynamic>> _bookings = <Map<String, dynamic>>[];
  Timer? _tick;
  final ValueNotifier<DateTime> _clockNotifier =
      ValueNotifier<DateTime>(DateTime.now());
  String? _busyId;
  String _filter = 'PENDING_HOST';

  static const List<String> _filters = <String>[
    'PENDING_HOST',
    'PAYMENT_PENDING',
    'CONFIRMED',
    'ALL',
  ];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _tick?.cancel();
    _clockNotifier.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _load();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _tick?.cancel();
    }
  }

  void _syncTick() {
    _tick?.cancel();
    final bool hasPending = _bookings.any((Map<String, dynamic> b) {
      final String s = _statusOf(b);
      if (s != 'PENDING_HOST') return false;
      final int secs = _remainingSeconds(b['hostResponseDeadlineAt']?.toString());
      return secs > 0;
    });

    if (hasPending) {
      _tick = Timer.periodic(const Duration(seconds: 1), (_) {
        if (!mounted) return;
        _clockNotifier.value = DateTime.now();
      });
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final List<Map<String, dynamic>> rows =
          await context.read<IleApi>().getHostBookings();
      if (!mounted) return;
      setState(() {
        _bookings = rows;
        _loading = false;
      });
      _syncTick();
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err.message;
        _loading = false;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err.toString();
        _loading = false;
      });
    }
  }

  String _statusOf(Map<String, dynamic> b) =>
      (b['bookingStatus'] ?? b['status'] ?? '').toString();

  int _remainingSeconds(String? deadline) {
    if (deadline == null || deadline.isEmpty) return 0;
    final DateTime? end = DateTime.tryParse(deadline);
    if (end == null) return 0;
    final int secs = end.difference(DateTime.now()).inSeconds;
    return secs > 0 ? secs : 0;
  }

  Future<void> _accept(String id) async {
    setState(() => _busyId = id);
    try {
      await context.read<IleApi>().acceptHostBooking(id);
      setState(() => _notice = 'Accepted — guest can proceed to payment.');
      await _load();
    } on ApiException catch (err) {
      setState(() => _notice = err.message);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  Future<void> _decline(String id) async {
    setState(() => _busyId = id);
    try {
      await context.read<IleApi>().declineHostBooking(id);
      setState(() => _notice = 'Request declined.');
      await _load();
    } on ApiException catch (err) {
      setState(() => _notice = err.message);
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  List<Map<String, dynamic>> get _filtered {
    if (_filter == 'ALL') return _bookings;
    return _bookings
        .where((Map<String, dynamic> b) => _statusOf(b) == _filter)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final List<Map<String, dynamic>> rows = _filtered;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const HostChromeAppBar(title: 'Reservations'),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : _error != null
              ? IleErrorState(
                  title: 'Could not load reservations',
                  message: _error!,
                  onRetry: _load,
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
                    children: <Widget>[
                      if (_notice != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.md),
                          child: Text(_notice!, style: AppTypography.supporting),
                        ),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: _filters.map((String f) {
                            final bool selected = _filter == f;
                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(
                                  f == 'ALL'
                                      ? 'All'
                                      : HostMessages.bookingStatusLabel(f),
                                ),
                                selected: selected,
                                onSelected: (_) => setState(() => _filter = f),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      if (rows.isEmpty)
                        IleEmptyState(
                          title: 'No reservations',
                          message: _filter == 'PENDING_HOST'
                              ? 'New booking requests appear here. Respond before the deadline ends.'
                              : 'Nothing in this list right now.',
                          icon: Icons.event_note_outlined,
                        )
                      else
                        ...rows.map((Map<String, dynamic> b) {
                          final String id = b['id']?.toString() ?? '';
                          final String status = _statusOf(b);
                          final int secs = _remainingSeconds(
                            b['hostResponseDeadlineAt']?.toString(),
                          );
                          final bool busy = _busyId == id;
                          final int net =
                              (b['hostNetAmount'] as num?)?.toInt() ?? 0;
                          final bool guestCheckedIn =
                              b['guestCheckInConfirmed'] == true ||
                                  b['guestCheckInConfirmedAt'] != null;

                          return Card(
                            elevation: 0,
                            color: AppColors.surfaceMuted,
                            margin: const EdgeInsets.only(bottom: AppSpacing.md),
                            child: Padding(
                              padding: const EdgeInsets.all(AppSpacing.md),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Row(
                                    children: <Widget>[
                                      Expanded(
                                        child: Text(
                                          '${b['guestFirstName']} ${b['guestLastName']} · ${b['referenceCode']}',
                                          style: AppTypography.bodyMedium,
                                        ),
                                      ),
                                      HostStatusChip(
                                        label: status,
                                        kind: HostStatusChipKind.booking,
                                        tone: toneForBookingStatus(status),
                                      ),
                                    ],
                                  ),
                                  Text(
                                    '${b['checkInDate']} → ${b['checkOutDate']} · ${b['propertyTitle'] ?? ''}',
                                    style: AppTypography.supporting,
                                  ),
                                  Text(
                                    'Your earnings ₦${IleFormatters.formatInteger(net)}',
                                    style: AppTypography.caption,
                                  ),
                                  if (status == 'CONFIRMED')
                                    Text(
                                      guestCheckedIn
                                          ? 'Guest checked in'
                                          : 'Awaiting guest check-in',
                                      style: AppTypography.caption,
                                    ),
                                  if (status == 'PENDING_HOST')
                                    ValueListenableBuilder<DateTime>(
                                      valueListenable: _clockNotifier,
                                      builder: (BuildContext context, DateTime _,
                                          Widget? __) {
                                        final int liveSecs = _remainingSeconds(
                                          b['hostResponseDeadlineAt']?.toString(),
                                        );
                                        return Text(
                                          liveSecs > 0
                                              ? 'Respond in ${liveSecs}s'
                                              : 'Deadline passed — this request will expire',
                                          style: AppTypography.caption.copyWith(
                                            color: liveSecs > 0
                                                ? AppColors.warningText
                                                : AppColors.criticalText,
                                          ),
                                        );
                                      },
                                    ),
                                  const SizedBox(height: AppSpacing.sm),
                                  if (status == 'PENDING_HOST')
                                    secs > 0
                                        ? Row(
                                            children: <Widget>[
                                              Expanded(
                                                child: IleButton(
                                                  label: 'Accept',
                                                  onPressed:
                                                      busy ? null : () => _accept(id),
                                                  isLoading: busy,
                                                ),
                                              ),
                                              const SizedBox(width: AppSpacing.sm),
                                              Expanded(
                                                child: IleButton(
                                                  label: 'Decline',
                                                  onPressed: busy
                                                      ? null
                                                      : () => _decline(id),
                                                  variant: IleButtonVariant.secondary,
                                                ),
                                              ),
                                            ],
                                          )
                                        : SizedBox(
                                            width: double.infinity,
                                            child: OutlinedButton.icon(
                                              onPressed: _load,
                                              icon: const Icon(Icons.refresh_rounded, size: 16),
                                              label: const Text('Window expired · Refresh list'),
                                              style: OutlinedButton.styleFrom(
                                                foregroundColor: AppColors.criticalText,
                                                side: const BorderSide(color: AppColors.border),
                                              ),
                                            ),
                                          )
                                  else
                                    TextButton(
                                      onPressed: () => context.push(
                                        AppRoutes.hostReservationDetailPath(id),
                                      ),
                                      child: const Text('View stay details'),
                                    ),
                                ],
                              ),
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }
}
