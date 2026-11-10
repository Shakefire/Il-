import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/ile_api.dart';
import '../../core/guest_flow_errors.dart';
import '../../core/constants/app_routes.dart';
import '../../core/state/search_session.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_circular_back_button.dart';

/// Guest date + guest picker (not host calendar).
/// Supports listing capacity / min nights when opened from a property.
class DateGuestPickerScreen extends StatefulWidget {
  const DateGuestPickerScreen({
    super.key,
    this.editMode = false,
    this.maxGuests,
    this.minimumNights = 1,
    this.propertyId,
  });

  final bool editMode;
  final int? maxGuests;
  final int minimumNights;
  final String? propertyId;

  @override
  State<DateGuestPickerScreen> createState() => _DateGuestPickerScreenState();
}

class _DateGuestPickerScreenState extends State<DateGuestPickerScreen> {
  DateTimeRange? _range;
  late int _guests;
  String? _validationError;
  bool _checkingAvailability = false;

  int get _capacity => widget.maxGuests?.clamp(1, 16) ?? 16;

  @override
  void initState() {
    super.initState();
    final SearchSession session = context.read<SearchSession>();
    _guests = session.guests.clamp(1, _capacity);
    if (session.hasDates) {
      final DateTime? start = DateTime.tryParse(session.checkIn!);
      final DateTime? end = DateTime.tryParse(session.checkOut!);
      if (start != null && end != null) {
        _range = DateTimeRange(start: start, end: end);
      }
    }
  }

  String _iso(DateTime d) => DateFormat('yyyy-MM-dd').format(d);

  String _pretty(DateTime d) => DateFormat('EEE, d MMM').format(d);

  Future<void> _pickDates() async {
    final DateTime now = DateTime.now();
    final DateTime first = DateTime(now.year, now.month, now.day);
    final DateTimeRange? picked = await showDateRangePicker(
      context: context,
      firstDate: first,
      lastDate: first.add(const Duration(days: 365)),
      initialDateRange: _range,
      helpText: 'Select check-in and check-out',
      saveText: 'Save',
      builder: (BuildContext context, Widget? child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: AppColors.colorScheme,
            datePickerTheme: DatePickerThemeData(
              rangeSelectionBackgroundColor: AppColors.emeraldLight,
              rangeSelectionOverlayColor:
                  WidgetStateProperty.all(AppColors.emerald.withValues(alpha: 0.12)),
              todayForegroundColor: WidgetStateProperty.all(AppColors.emerald),
              dayForegroundColor: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.selected)) {
                  return AppColors.onDark;
                }
                return AppColors.foreground;
              }),
              dayBackgroundColor: WidgetStateProperty.resolveWith((states) {
                if (states.contains(WidgetState.selected)) {
                  return AppColors.emerald;
                }
                return null;
              }),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked == null) return;
    setState(() {
      _range = picked;
      _validationError = _localValidation(picked);
    });
  }

  String? _localValidation(DateTimeRange? range) {
    if (range == null) return null;
    final int nights = range.end.difference(range.start).inDays;
    if (nights < 1) return 'Check-out must be after check-in.';
    if (nights < widget.minimumNights) {
      return 'Minimum stay is ${widget.minimumNights} night${widget.minimumNights == 1 ? '' : 's'}.';
    }
    return null;
  }

  Future<void> _handleSave() async {
    final String? localErr = _localValidation(_range);
    if (localErr != null) {
      setState(() => _validationError = localErr);
      return;
    }
    if (_guests > _capacity) {
      setState(() {
        _validationError =
            'This stay allows up to $_capacity guests. You selected $_guests.';
      });
      return;
    }

    if (widget.propertyId != null &&
        widget.propertyId!.isNotEmpty &&
        _range != null) {
      setState(() {
        _checkingAvailability = true;
        _validationError = null;
      });
      try {
        final Map<String, dynamic> availability =
            await context.read<IleApi>().checkAvailability(
                  propertyId: widget.propertyId!,
                  checkIn: _iso(_range!.start),
                  checkOut: _iso(_range!.end),
                );
        if (availability['available'] == false) {
          if (!mounted) return;
          setState(() {
            _validationError = availability['message']?.toString() ??
                'Those dates are not available for this stay.';
            _checkingAvailability = false;
          });
          return;
        }
      } catch (err) {
        if (!mounted) return;
        setState(() {
          _validationError = GuestFlowError.from(err, surface: 'search').message;
          _checkingAvailability = false;
        });
        return;
      }
      if (!mounted) return;
      setState(() => _checkingAvailability = false);
    }

    final SearchSession session = context.read<SearchSession>();
    session.setGuests(_guests, maxCapacity: _capacity);
    if (_range != null) {
      session.setDates(start: _iso(_range!.start), end: _iso(_range!.end));
    }
    if (widget.editMode) {
      context.pop();
      return;
    }
    context.push(AppRoutes.searchResults);
  }

  void _handleClear() {
    setState(() {
      _range = null;
      _validationError = null;
    });
    context.read<SearchSession>().setDates(start: null, end: null);
  }

  @override
  Widget build(BuildContext context) {
    final bool hasRange = _range != null;
    final int nights = hasRange
        ? _range!.end.difference(_range!.start).inDays
        : 0;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text(
          widget.editMode ? 'Edit dates & guests' : 'When & who',
          style: AppTypography.cardTitle,
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
              children: [
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: AppRadius.panelAll,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: _DateSummaryTile(
                          label: 'Check-in',
                          value: hasRange ? _pretty(_range!.start) : 'Add date',
                        ),
                      ),
                      Container(
                        width: 1,
                        height: 40,
                        color: AppColors.border,
                      ),
                      Expanded(
                        child: _DateSummaryTile(
                          label: 'Check-out',
                          value: hasRange ? _pretty(_range!.end) : 'Add date',
                        ),
                      ),
                    ],
                  ),
                ),
                if (hasRange) ...[
                  const SizedBox(height: 8),
                  Text(
                    '$nights night${nights == 1 ? '' : 's'}'
                    '${widget.minimumNights > 1 ? ' · min ${widget.minimumNights}' : ''}',
                    style: AppTypography.caption,
                  ),
                ],
                const SizedBox(height: AppSpacing.lg),
                Material(
                  color: AppColors.surface,
                  borderRadius: AppRadius.panelAll,
                  child: InkWell(
                    onTap: _pickDates,
                    borderRadius: AppRadius.panelAll,
                    child: Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        borderRadius: AppRadius.panelAll,
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.calendar_month_outlined,
                            color: AppColors.emerald,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              hasRange
                                  ? 'Change dates'
                                  : 'Select check-in and check-out',
                              style: AppTypography.supporting.copyWith(
                                color: AppColors.foreground,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: AppColors.foregroundMuted,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                Text('Guests', style: AppTypography.sectionHeading),
                const SizedBox(height: 4),
                Text(
                  widget.maxGuests != null
                      ? 'Up to ${widget.maxGuests} guests for this stay'
                      : 'Choose how many guests are coming',
                  style: AppTypography.caption,
                ),
                const SizedBox(height: AppSpacing.sm),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: AppRadius.panelAll,
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          _guests == 1 ? '1 guest' : '$_guests guests',
                          style: AppTypography.supporting.copyWith(
                            color: AppColors.foreground,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'Fewer guests',
                        onPressed: _guests > 1
                            ? () => setState(() => _guests -= 1)
                            : null,
                        icon: const Icon(Icons.remove_circle_outline),
                        color: AppColors.emerald,
                        constraints: const BoxConstraints(
                          minWidth: 44,
                          minHeight: 44,
                        ),
                      ),
                      IconButton(
                        tooltip: 'More guests',
                        onPressed: _guests < _capacity
                            ? () => setState(() => _guests += 1)
                            : null,
                        icon: const Icon(Icons.add_circle_outline),
                        color: AppColors.emerald,
                        constraints: const BoxConstraints(
                          minWidth: 44,
                          minHeight: 44,
                        ),
                      ),
                    ],
                  ),
                ),
                if (_validationError != null) ...[
                  const SizedBox(height: AppSpacing.md),
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: AppColors.criticalBg,
                      borderRadius: AppRadius.panelAll,
                      border: Border.all(color: AppColors.criticalBorder),
                    ),
                    child: Text(
                      _validationError!,
                      style: AppTypography.supporting.copyWith(
                        color: AppColors.criticalText,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenHorizontal,
                8,
                AppSpacing.screenHorizontal,
                12,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: IleButton(
                      label: 'Clear',
                      variant: IleButtonVariant.secondary,
                      onPressed: _handleClear,
                      isExpanded: true,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: IleButton(
                      label: widget.editMode ? 'Save' : 'Search stays',
                      onPressed: _checkingAvailability ? null : _handleSave,
                      isLoading: _checkingAvailability,
                      isExpanded: true,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _DateSummaryTile extends StatelessWidget {
  const _DateSummaryTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: AppTypography.caption),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTypography.supporting.copyWith(
              color: AppColors.foreground,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
