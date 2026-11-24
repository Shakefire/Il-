import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_router.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/utils/formatters.dart';

/// Afro-Luxe Style 1 date range sheet — replaces Material [DateRangePicker].
class LuxuryDateRangeSheet extends StatefulWidget {
  const LuxuryDateRangeSheet({
    super.key,
    this.initialRange,
    this.nightlyRate,
    this.minimumNights = 1,
    this.firstDate,
    this.lastDate,
    this.isScreen = false,
    this.onApplyRange,
  });

  final DateTimeRange? initialRange;
  final int? nightlyRate;
  final int minimumNights;
  final DateTime? firstDate;
  final DateTime? lastDate;
  final bool isScreen;
  final ValueChanged<DateTimeRange>? onApplyRange;

  /// Presents the custom sheet and returns the applied range, or null if dismissed.
  static Future<DateTimeRange?> show(
    BuildContext context, {
    DateTimeRange? initialRange,
    int? nightlyRate,
    int minimumNights = 1,
    DateTime? firstDate,
    DateTime? lastDate,
  }) {
    final BuildContext targetContext =
        rootNavigatorKey.currentContext ?? context;
    return showModalBottomSheet<DateTimeRange>(
      context: targetContext,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x730A1C16),
      builder: (BuildContext context) {
        return LuxuryDateRangeSheet(
          initialRange: initialRange,
          nightlyRate: nightlyRate,
          minimumNights: minimumNights,
          firstDate: firstDate,
          lastDate: lastDate,
        );
      },
    );
  }

  @override
  State<LuxuryDateRangeSheet> createState() => _LuxuryDateRangeSheetState();
}

enum _DateFocus { checkIn, checkOut }

class _LuxuryDateRangeSheetState extends State<LuxuryDateRangeSheet> {
  static const Color _pastInk = Color(0xFFC5C1B8);
  static const Color _placeholderInk = Color(0xFFA09D95);
  static const Color _headerGlass = Color(0xEBFAF8F5);
  static const Color _footerGlass = Color(0xF0FFFFFF);
  static const Color _disabledCta = Color(0xFFEAE6DF);
  static const Color _disabledCtaInk = Color(0xFF9E9A90);

  late final DateTime _today;
  late final DateTime _firstDate;
  late final DateTime _lastDate;
  late final List<DateTime> _months;

  DateTime? _start;
  DateTime? _end;
  _DateFocus _focus = _DateFocus.checkIn;
  int? _pulseDayKey;

  @override
  void initState() {
    super.initState();
    final DateTime now = DateTime.now();
    _today = DateTime(now.year, now.month, now.day);
    _firstDate = widget.firstDate ?? _today;
    _lastDate = widget.lastDate ?? _today.add(const Duration(days: 365));
    _months = _buildMonths();
    final DateTimeRange? initial = widget.initialRange;
    if (initial != null) {
      _start = _dateOnly(initial.start);
      _end = _dateOnly(initial.end);
      _focus = _DateFocus.checkIn;
    }
  }

  List<DateTime> _buildMonths() {
    final List<DateTime> months = <DateTime>[];
    DateTime cursor = DateTime(_firstDate.year, _firstDate.month);
    final DateTime endMonth = DateTime(_lastDate.year, _lastDate.month);
    while (!cursor.isAfter(endMonth)) {
      months.add(cursor);
      cursor = DateTime(cursor.year, cursor.month + 1);
    }
    return months;
  }

  DateTime _dateOnly(DateTime value) =>
      DateTime(value.year, value.month, value.day);

  int _dayKey(DateTime day) => day.year * 10000 + day.month * 100 + day.day;

  bool get _hasSelection => _start != null || _end != null;

  bool get _hasCompleteRange => _start != null && _end != null;

  int get _nights {
    if (!_hasCompleteRange) return 0;
    return _end!.difference(_start!).inDays;
  }

  String _prettyCard(DateTime? day) {
    if (day == null) return 'Add date';
    return DateFormat('EEE, MMM d').format(day);
  }

  ({String primary, String? secondary}) _footerSummary() {
    if (!_hasCompleteRange) {
      if (_start != null) {
        return (
          primary: DateFormat('EEE, MMM d').format(_start!),
          secondary: 'Select check-out · Min ${widget.minimumNights}'
              ' night${widget.minimumNights == 1 ? '' : 's'}',
        );
      }
      return (
        primary: 'Select check-in & check-out',
        secondary:
            'Minimum stay: ${widget.minimumNights} night${widget.minimumNights == 1 ? '' : 's'}',
      );
    }
    final int nights = _nights;
    final String nightsLabel =
        '$nights Night${nights == 1 ? '' : 's'} Selected';
    final int? rate = widget.nightlyRate;
    if (rate != null && rate > 0) {
      final int total = rate * nights;
      return (
        primary: nightsLabel,
        secondary:
            'Est. ₦${IleFormatters.formatInteger(total)} total'
            '  (₦${IleFormatters.formatInteger(rate)}/night)',
      );
    }
    return (
      primary: nightsLabel,
      secondary:
          '${DateFormat('EEE, MMM d').format(_start!)} – '
          '${DateFormat('EEE, MMM d').format(_end!)}',
    );
  }

  void _handleReset() {
    HapticFeedback.selectionClick();
    setState(() {
      _start = null;
      _end = null;
      _focus = _DateFocus.checkIn;
      _pulseDayKey = null;
    });
  }

  void _applyQuickRange(DateTime start, DateTime end) {
    final DateTime safeStart =
        start.isBefore(_firstDate) ? _firstDate : start;
    DateTime safeEnd = end;
    if (safeEnd.isBefore(safeStart.add(const Duration(days: 1)))) {
      safeEnd = safeStart.add(const Duration(days: 1));
    }
    if (safeEnd.isAfter(_lastDate)) {
      safeEnd = _lastDate;
    }
    HapticFeedback.mediumImpact();
    setState(() {
      _start = safeStart;
      _end = safeEnd;
      _focus = _DateFocus.checkIn;
      _pulseDayKey = _dayKey(safeStart);
    });
  }

  void _handleTonight() {
    _applyQuickRange(_today, _today.add(const Duration(days: 1)));
  }

  void _handleWeekend() {
    // Upcoming Friday → Sunday (if today is Sat/Sun, use this weekend).
    final int weekday = _today.weekday; // Mon=1 … Sun=7
    late final DateTime friday;
    if (weekday == DateTime.friday) {
      friday = _today;
    } else if (weekday == DateTime.saturday) {
      friday = _today.subtract(const Duration(days: 1));
    } else if (weekday == DateTime.sunday) {
      friday = _today.subtract(const Duration(days: 2));
    } else {
      friday = _today.add(Duration(days: DateTime.friday - weekday));
    }
    final DateTime sunday = friday.add(const Duration(days: 2));
    _applyQuickRange(friday, sunday);
  }

  void _handleThreeNights() {
    final DateTime start = _start ?? _today;
    _applyQuickRange(start, start.add(const Duration(days: 3)));
  }

  void _handleFullWeek() {
    final DateTime start = _start ?? _today;
    _applyQuickRange(start, start.add(const Duration(days: 7)));
  }

  void _handleDayTap(DateTime day) {
    if (day.isBefore(_firstDate) || day.isAfter(_lastDate)) return;
    HapticFeedback.selectionClick();
    setState(() {
      _pulseDayKey = _dayKey(day);
      // New tap after a complete range always starts a fresh selection.
      if (_hasCompleteRange) {
        _start = day;
        _end = null;
        _focus = _DateFocus.checkOut;
      } else if (_focus == _DateFocus.checkIn || _start == null) {
        _start = day;
        _end = null;
        _focus = _DateFocus.checkOut;
      } else if (day.isBefore(_start!)) {
        // Picking check-out earlier than start swaps to a new start.
        _start = day;
        _end = null;
        _focus = _DateFocus.checkOut;
      } else if (day.isAtSameMomentAs(_start!)) {
        // Keep single-day highlight; wait for a later check-out.
      } else {
        _end = day;
        _focus = _DateFocus.checkIn;
      }
    });
    Future<void>.delayed(const Duration(milliseconds: 240), () {
      if (!mounted) return;
      if (_pulseDayKey == _dayKey(day)) {
        setState(() => _pulseDayKey = null);
      }
    });
  }

  void _handleApply() {
    if (!_hasCompleteRange) return;
    if (_nights < widget.minimumNights) return;
    HapticFeedback.mediumImpact();
    final DateTimeRange range = DateTimeRange(start: _start!, end: _end!);
    if (widget.onApplyRange != null) {
      widget.onApplyRange!(range);
      return;
    }
    Navigator.of(context).pop(range);
    return;
  }
  @override
  Widget build(BuildContext context) {
    final double maxHeight = MediaQuery.sizeOf(context).height * 0.92;
    final double bottomInset = MediaQuery.paddingOf(context).bottom;

    /* build sheet */
    final Widget sheetContent = Column(
            children: [
              _StickyHeader(
                glass: _headerGlass,
                hasSelection: _hasSelection,
                start: _start,
                end: _end,
                focus: _focus,
                prettyCard: _prettyCard,
                placeholderInk: _placeholderInk,
                onClose: () => Navigator.of(context).pop(),
                onReset: _handleReset,
                onFocusCheckIn: () =>
                    setState(() => _focus = _DateFocus.checkIn),
                onFocusCheckOut: () =>
                    setState(() => _focus = _DateFocus.checkOut),
                onTonight: _handleTonight,
                onWeekend: _handleWeekend,
                onThreeNights: _handleThreeNights,
                onFullWeek: _handleFullWeek,
              ),
              Expanded(
                child: ListView.builder(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.lg,
                    AppSpacing.md,
                    120 + bottomInset,
                  ),
                  itemCount: _months.length,
                  itemBuilder: (BuildContext context, int index) {
                    return _MonthBlock(
                      month: _months[index],
                      today: _today,
                      firstDate: _firstDate,
                      lastDate: _lastDate,
                      start: _start,
                      end: _end,
                      pulseDayKey: _pulseDayKey,
                      dayKey: _dayKey,
                      onDayTap: _handleDayTap,
                      pastInk: _pastInk,
                    );
                  },
                ),
              ),
              _StickyFooter(
                glass: _footerGlass,
                bottomInset: bottomInset,
                summary: _footerSummary(),
                canApply: _hasCompleteRange &&
                    _nights >= widget.minimumNights,
                disabledCta: _disabledCta,
                disabledCtaInk: _disabledCtaInk,
                onApply: _handleApply,
              ),
            ],
    );

    if (widget.isScreen) {
      return Scaffold(
        backgroundColor: EditorialColors.background,
        body: SafeArea(
          bottom: false,
          child: sheetContent,
        ),
      );
    }

    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: Material(
          color: EditorialColors.background,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(AppRadius.editorialSheet),
          ),
          clipBehavior: Clip.antiAlias,
          child: sheetContent,
        ),
      ),
    );
  }
}

class _StickyHeader extends StatelessWidget {
  const _StickyHeader({
    required this.glass,
    required this.hasSelection,
    required this.start,
    required this.end,
    required this.focus,
    required this.prettyCard,
    required this.placeholderInk,
    required this.onClose,
    required this.onReset,
    required this.onFocusCheckIn,
    required this.onFocusCheckOut,
    required this.onTonight,
    required this.onWeekend,
    required this.onThreeNights,
    required this.onFullWeek,
  });

  final Color glass;
  final bool hasSelection;
  final DateTime? start;
  final DateTime? end;
  final _DateFocus focus;
  final String Function(DateTime?) prettyCard;
  final Color placeholderInk;
  final VoidCallback onClose;
  final VoidCallback onReset;
  final VoidCallback onFocusCheckIn;
  final VoidCallback onFocusCheckOut;
  final VoidCallback onTonight;
  final VoidCallback onWeekend;
  final VoidCallback onThreeNights;
  final VoidCallback onFullWeek;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: glass,
            border: const Border(
              bottom: BorderSide(color: EditorialColors.headerRule),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: EditorialColors.stroke,
                    borderRadius: AppRadius.pillAll,
                  ),
                ),
              ),
              SizedBox(
                height: 56,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Row(
                    children: [
                      _CircleIconButton(
                        icon: Icons.close_rounded,
                        semanticLabel: 'Close date picker',
                        onPressed: onClose,
                      ),
                      Expanded(
                        child: Text(
                          'Select Dates',
                          textAlign: TextAlign.center,
                          style: AppTypography.screenTitle.copyWith(
                            fontSize: 18,
                            letterSpacing: -0.36,
                          ),
                        ),
                      ),
                      SizedBox(
                        width: 72,
                        child: hasSelection
                            ? Align(
                                alignment: Alignment.centerRight,
                                child: _GhostResetPill(onTap: onReset),
                              )
                            : const SizedBox.shrink(),
                      ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 4, 20, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: _DateCard(
                        label: 'CHECK-IN',
                        value: prettyCard(start),
                        sub: 'From 2:00 PM',
                        placeholderInk: placeholderInk,
                        isActive: focus == _DateFocus.checkIn,
                        onTap: onFocusCheckIn,
                      ),
                    ),
                    const Padding(
                      padding: EdgeInsets.symmetric(horizontal: 8),
                      child: Icon(
                        Icons.arrow_forward_rounded,
                        size: 16,
                        color: EditorialColors.inkMuted,
                      ),
                    ),
                    Expanded(
                      child: _DateCard(
                        label: 'CHECK-OUT',
                        value: prettyCard(end),
                        sub: end != null && start != null
                            ? '${end!.difference(start!).inDays}'
                                ' Night${end!.difference(start!).inDays == 1 ? '' : 's'}'
                            : 'By 12:00 PM',
                        nightsBadge: end != null && start != null,
                        placeholderInk: placeholderInk,
                        isActive: focus == _DateFocus.checkOut,
                        onTap: onFocusCheckOut,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  children: [
                    _QuickPill(label: '⚡ Tonight', onTap: onTonight),
                    const SizedBox(width: 8),
                    _QuickPill(label: '✦ This Weekend', onTap: onWeekend),
                    const SizedBox(width: 8),
                    _QuickPill(label: '3 Nights', onTap: onThreeNights),
                    const SizedBox(width: 8),
                    _QuickPill(
                      label: 'Full Week • -10%',
                      onTap: onFullWeek,
                      goldBorder: true,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              Container(
                height: 36,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                color: EditorialColors.background,
                child: Row(
                  children: LuxuryDateRangeSheetStateDow.labels
                      .map(
                        (String d) => Expanded(
                          child: Text(
                            d,
                            textAlign: TextAlign.center,
                            style: AppTypography.caption.copyWith(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: EditorialColors.inkMuted,
                              letterSpacing: 0.4,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Exposes DOW labels for sticky header without duplicating literals.
abstract final class LuxuryDateRangeSheetStateDow {
  static const List<String> labels = <String>[
    'S',
    'M',
    'T',
    'W',
    'T',
    'F',
    'S',
  ];
}

class _StickyFooter extends StatelessWidget {
  const _StickyFooter({
    required this.glass,
    required this.bottomInset,
    required this.summary,
    required this.canApply,
    required this.disabledCta,
    required this.disabledCtaInk,
    required this.onApply,
  });

  final Color glass;
  final double bottomInset;
  final ({String primary, String? secondary}) summary;
  final bool canApply;
  final Color disabledCta;
  final Color disabledCtaInk;
  final VoidCallback onApply;

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: glass,
            border: const Border(
              top: BorderSide(color: EditorialColors.stroke),
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0F073B2E),
                blurRadius: 24,
                offset: Offset(0, -8),
              ),
            ],
          ),
          child: Padding(
            padding: EdgeInsets.fromLTRB(20, 14, 20, 14 + bottomInset),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        summary.primary,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.supporting.copyWith(
                          fontWeight: FontWeight.w700,
                          color: canApply
                              ? EditorialColors.ink
                              : EditorialColors.inkMuted,
                          fontSize: canApply ? 15 : 14,
                        ),
                      ),
                      if (summary.secondary != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          summary.secondary!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.caption.copyWith(
                            fontSize: canApply ? 13 : 12,
                            fontWeight: FontWeight.w600,
                            color: canApply
                                ? EditorialColors.brand
                                : const Color(0xFFA09D95),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: TextButton.styleFrom(
                    foregroundColor: EditorialColors.inkMuted,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                  ),
                  child: const Text(
                    'Cancel',
                    style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ),
                const SizedBox(width: 8),
                Semantics(
                  button: true,
                  enabled: canApply,
                  label: canApply ? 'Confirm Dates' : 'Select Dates',
                  child: Material(
                    color: canApply ? EditorialColors.brand : disabledCta,
                    borderRadius: AppRadius.pillAll,
                    elevation: canApply ? 0 : 0,
                    shadowColor: const Color(0x38073B2E),
                    child: InkWell(
                      onTap: canApply ? onApply : null,
                      borderRadius: AppRadius.pillAll,
                      child: Container(
                        constraints: const BoxConstraints(
                          minWidth: 128,
                          minHeight: 50,
                        ),
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        decoration: canApply
                            ? BoxDecoration(
                                borderRadius: AppRadius.pillAll,
                                boxShadow: const [
                                  BoxShadow(
                                    color: Color(0x38073B2E),
                                    blurRadius: 20,
                                    offset: Offset(0, 8),
                                  ),
                                ],
                              )
                            : null,
                        alignment: Alignment.center,
                        child: Text(
                          canApply ? 'Confirm Dates' : 'Select Dates',
                          style: AppTypography.button.copyWith(
                            fontSize: 15,
                            color: canApply
                                ? EditorialColors.onBrand
                                : disabledCtaInk,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _GhostResetPill extends StatelessWidget {
  const _GhostResetPill({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Reset dates',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.pillAll,
          child: Container(
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: AppRadius.pillAll,
              border: Border.all(color: EditorialColors.stroke),
            ),
            child: Text(
              'Reset',
              style: AppTypography.supporting.copyWith(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: EditorialColors.inkMuted,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DateCard extends StatelessWidget {
  const _DateCard({
    required this.label,
    required this.value,
    required this.sub,
    required this.isActive,
    required this.onTap,
    required this.placeholderInk,
    this.nightsBadge = false,
  });

  final String label;
  final String value;
  final String sub;
  final bool isActive;
  final bool nightsBadge;
  final Color placeholderInk;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final bool isPlaceholder = value == 'Add date';
    return Semantics(
      button: true,
      selected: isActive,
      label: '$label $value',
      child: Material(
        color: EditorialColors.card,
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOut,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: isActive
                    ? EditorialColors.brand
                    : EditorialColors.stroke,
                width: isActive ? 1.5 : 1,
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A141917),
                  blurRadius: 8,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppTypography.microLabel.copyWith(
                    fontSize: 10,
                    letterSpacing: 0.8,
                    color: EditorialColors.inkMuted,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.supporting.copyWith(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: isPlaceholder ? placeholderInk : EditorialColors.ink,
                  ),
                ),
                const SizedBox(height: 4),
                if (nightsBadge)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: EditorialColors.tint,
                      borderRadius: AppRadius.pillAll,
                    ),
                    child: Text(
                      sub,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: EditorialColors.brand,
                      ),
                    ),
                  )
                else
                  Text(
                    sub,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      fontSize: 11,
                      color: EditorialColors.inkMuted,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QuickPill extends StatelessWidget {
  const _QuickPill({
    required this.label,
    required this.onTap,
    this.goldBorder = false,
  });

  final String label;
  final VoidCallback onTap;
  final bool goldBorder;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: Material(
        color: EditorialColors.card,
        borderRadius: AppRadius.pillAll,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.pillAll,
          child: Container(
            height: 34,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: AppRadius.pillAll,
              border: Border.all(
                color: goldBorder
                    ? EditorialColors.gold
                    : EditorialColors.stroke,
              ),
            ),
            child: Text(
              label,
              style: AppTypography.supporting.copyWith(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: goldBorder
                    ? EditorialColors.brand
                    : EditorialColors.ink,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CircleIconButton extends StatelessWidget {
  const _CircleIconButton({
    required this.icon,
    required this.semanticLabel,
    required this.onPressed,
  });

  final IconData icon;
  final String semanticLabel;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: AppSpacing.touchTarget,
            height: AppSpacing.touchTarget,
            child: Center(
              child: Ink(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: EditorialColors.card,
                  border: Border.all(color: EditorialColors.stroke),
                ),
                child: Icon(icon, size: 18, color: EditorialColors.ink),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MonthBlock extends StatelessWidget {
  const _MonthBlock({
    required this.month,
    required this.today,
    required this.firstDate,
    required this.lastDate,
    required this.start,
    required this.end,
    required this.pulseDayKey,
    required this.dayKey,
    required this.onDayTap,
    required this.pastInk,
  });

  final DateTime month;
  final DateTime today;
  final DateTime firstDate;
  final DateTime lastDate;
  final DateTime? start;
  final DateTime? end;
  final int? pulseDayKey;
  final int Function(DateTime) dayKey;
  final ValueChanged<DateTime> onDayTap;
  final Color pastInk;

  @override
  Widget build(BuildContext context) {
    final String title = DateFormat('MMMM yyyy').format(month);
    final bool isPeak = month.month == 12;
    final int daysInMonth = DateUtils.getDaysInMonth(month.year, month.month);
    final int leading = DateTime(month.year, month.month, 1).weekday % 7;
    final List<Widget> cells = <Widget>[];
    for (int i = 0; i < leading; i++) {
      cells.add(const SizedBox(width: 46, height: 46));
    }
    for (int day = 1; day <= daysInMonth; day++) {
      final DateTime date = DateTime(month.year, month.month, day);
      cells.add(
        _DayCell(
          date: date,
          today: today,
          firstDate: firstDate,
          lastDate: lastDate,
          start: start,
          end: end,
          isPulsing: pulseDayKey == dayKey(date),
          onTap: onDayTap,
          pastInk: pastInk,
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                title,
                style: AppTypography.screenTitle.copyWith(
                  fontSize: 20,
                  letterSpacing: -0.4,
                  color: EditorialColors.ink,
                ),
              ),
              if (isPeak) ...[
                const SizedBox(width: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: EditorialColors.tint,
                    borderRadius: AppRadius.pillAll,
                    border: Border.all(
                      color: EditorialColors.gold.withValues(alpha: 0.55),
                    ),
                  ),
                  child: Text(
                    '✦ Peak Season',
                    style: AppTypography.caption.copyWith(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: EditorialColors.brand,
                      letterSpacing: 0.2,
                    ),
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (BuildContext context, BoxConstraints constraints) {
              final double cellWidth = constraints.maxWidth / 7;
              return GridView.count(
                crossAxisCount: 7,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 6,
                crossAxisSpacing: 0,
                childAspectRatio: cellWidth / 46,
                children: cells,
              );
            },
          ),
        ],
      ),
    );
  }
}

enum _DayRole { none, start, end, inRange, single }

class _DayCell extends StatelessWidget {
  const _DayCell({
    required this.date,
    required this.today,
    required this.firstDate,
    required this.lastDate,
    required this.start,
    required this.end,
    required this.isPulsing,
    required this.onTap,
    required this.pastInk,
  });

  final DateTime date;
  final DateTime today;
  final DateTime firstDate;
  final DateTime lastDate;
  final DateTime? start;
  final DateTime? end;
  final bool isPulsing;
  final ValueChanged<DateTime> onTap;
  final Color pastInk;

  bool get _isPast => date.isBefore(firstDate);

  bool get _isDisabled =>
      _isPast || date.isAfter(lastDate);

  bool get _isToday => date.isAtSameMomentAs(today);

  _DayRole get _role {
    if (start == null) return _DayRole.none;
    if (end == null) {
      return date.isAtSameMomentAs(start!) ? _DayRole.single : _DayRole.none;
    }
    if (date.isAtSameMomentAs(start!) && date.isAtSameMomentAs(end!)) {
      return _DayRole.single;
    }
    if (date.isAtSameMomentAs(start!)) return _DayRole.start;
    if (date.isAtSameMomentAs(end!)) return _DayRole.end;
    if (date.isAfter(start!) && date.isBefore(end!)) return _DayRole.inRange;
    return _DayRole.none;
  }

  @override
  Widget build(BuildContext context) {
    final _DayRole role = _role;
    final bool isEndpoint =
        role == _DayRole.start ||
        role == _DayRole.end ||
        role == _DayRole.single;
    final int weekday = date.weekday % 7; // Sun=0
    final bool roundLeft =
        (role == _DayRole.inRange && weekday == 0) || role == _DayRole.start;
    final bool roundRight =
        (role == _DayRole.inRange && weekday == 6) || role == _DayRole.end;
    final bool showRibbon = role == _DayRole.inRange ||
        role == _DayRole.start ||
        role == _DayRole.end;

    Widget day = SizedBox(
      width: 46,
      height: 46,
      child: Stack(
        alignment: Alignment.center,
        children: [
          AnimatedOpacity(
            duration: const Duration(milliseconds: 200),
            opacity: showRibbon ? 1 : 0,
            child: AnimatedScale(
              duration: const Duration(milliseconds: 200),
              scale: showRibbon ? 1 : 0.92,
              curve: Curves.easeOutCubic,
              child: Align(
                child: role == _DayRole.start
                    ? Align(
                        alignment: Alignment.centerRight,
                        child: Container(
                          width: 23,
                          height: 44,
                          color: EditorialColors.tint,
                        ),
                      )
                    : role == _DayRole.end
                        ? Align(
                            alignment: Alignment.centerLeft,
                            child: Container(
                              width: 23,
                              height: 44,
                              color: EditorialColors.tint,
                            ),
                          )
                        : Container(
                            height: 44,
                            decoration: BoxDecoration(
                              color: EditorialColors.tint,
                              borderRadius: BorderRadius.horizontal(
                                left: roundLeft
                                    ? const Radius.circular(22)
                                    : Radius.zero,
                                right: roundRight
                                    ? const Radius.circular(22)
                                    : Radius.zero,
                              ),
                            ),
                          ),
              ),
            ),
          ),
          AnimatedScale(
            duration: const Duration(milliseconds: 220),
            curve: Curves.easeOutBack,
            scale: isPulsing && isEndpoint ? 1.12 : 1,
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isEndpoint ? EditorialColors.brand : Colors.transparent,
                border: _isToday && !isEndpoint
                    ? Border.all(color: EditorialColors.brand, width: 1)
                    : null,
                boxShadow: isEndpoint
                    ? const [
                        BoxShadow(
                          color: Color(0x40073B2E),
                          blurRadius: 12,
                          offset: Offset(0, 4),
                        ),
                      ]
                    : null,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '${date.day}',
                    style: AppTypography.supporting.copyWith(
                      fontSize: 14,
                      fontWeight: isEndpoint || _isToday
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: _isDisabled
                          ? pastInk
                          : isEndpoint
                              ? EditorialColors.onBrand
                              : role == _DayRole.inRange || _isToday
                                  ? EditorialColors.brand
                                  : EditorialColors.ink,
                    ),
                  ),
                  if (_isToday && !isEndpoint)
                    Container(
                      width: 4,
                      height: 4,
                      margin: const EdgeInsets.only(top: 2),
                      decoration: const BoxDecoration(
                        color: EditorialColors.brand,
                        shape: BoxShape.circle,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );

    if (_isDisabled) {
      return day;
    }

    return Semantics(
      button: true,
      label: DateFormat('EEEE, MMM d').format(date),
      selected: isEndpoint,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => onTap(date),
        child: day,
      ),
    );
  }
}
