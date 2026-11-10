import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/utils/formatters.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';
import 'host_chrome.dart';

/// Host stay view — read-only check-in status (guest owns confirm-check-in).
class HostReservationDetailScreen extends StatefulWidget {
  const HostReservationDetailScreen({
    super.key,
    required this.bookingId,
  });

  final String bookingId;

  @override
  State<HostReservationDetailScreen> createState() =>
      _HostReservationDetailScreenState();
}

class _HostReservationDetailScreenState
    extends State<HostReservationDetailScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _booking;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final List<Map<String, dynamic>> rows =
          await context.read<IleApi>().getHostBookings();
      Map<String, dynamic>? match;
      for (final Map<String, dynamic> b in rows) {
        if (b['id']?.toString() == widget.bookingId) {
          match = b;
          break;
        }
      }
      if (!mounted) return;
      if (match == null) {
        setState(() {
          _error = 'Reservation not found for this host account.';
          _loading = false;
        });
        return;
      }
      setState(() {
        _booking = match;
        _loading = false;
      });
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

  @override
  Widget build(BuildContext context) {
    final Map<String, dynamic>? b = _booking;
    final String status =
        (b?['bookingStatus'] ?? b?['status'] ?? '').toString();
    final bool guestCheckedIn = b?['guestCheckInConfirmed'] == true ||
        b?['guestCheckInConfirmedAt'] != null;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text('Stay details', style: AppTypography.sectionHeading),
      ),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : _error != null
              ? IleErrorState(
                  title: 'Could not load stay',
                  message: _error!,
                  onRetry: _load,
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Expanded(
                          child: Text(
                            b?['referenceCode']?.toString() ?? '',
                            style: AppTypography.sectionHeading,
                          ),
                        ),
                        HostStatusChip(
                          label: status,
                          tone: toneForBookingStatus(status),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _Row(
                      label: 'Guest',
                      value:
                          '${b?['guestFirstName'] ?? ''} ${b?['guestLastName'] ?? ''}',
                    ),
                    _Row(
                      label: 'Contact',
                      value: b?['guestPhone']?.toString() ??
                          b?['guestEmail']?.toString() ??
                          '—',
                    ),
                    _Row(
                      label: 'Property',
                      value: b?['propertyTitle']?.toString() ?? '—',
                    ),
                    _Row(
                      label: 'Dates',
                      value:
                          '${b?['checkInDate']} → ${b?['checkOutDate']}',
                    ),
                    _Row(
                      label: 'Guests',
                      value: '${b?['guestCount'] ?? '—'}',
                    ),
                    _Row(
                      label: 'Host net',
                      value:
                          '₦${IleFormatters.formatInteger((b?['hostNetAmount'] as num?)?.toInt() ?? 0)}',
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    Text('Check-in', style: AppTypography.sectionHeading),
                    const SizedBox(height: AppSpacing.sm),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: guestCheckedIn
                            ? AppColors.successBg
                            : AppColors.surfaceMuted,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(
                            guestCheckedIn
                                ? 'Guest confirmed arrival'
                                : 'Waiting for guest check-in',
                            style: AppTypography.bodyMedium,
                          ),
                          const SizedBox(height: 4),
                          Text(
                            guestCheckedIn
                                ? 'Confirmed at ${b?['guestCheckInConfirmedAt']}'
                                : 'Only the guest can confirm check-in. Hosts cannot forge this step.',
                            style: AppTypography.supporting,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 96,
            child: Text(label, style: AppTypography.caption),
          ),
          Expanded(child: Text(value, style: AppTypography.body)),
        ],
      ),
    );
  }
}
