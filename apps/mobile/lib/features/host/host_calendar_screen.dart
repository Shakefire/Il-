import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';
import 'host_chrome.dart';

class HostCalendarScreen extends StatefulWidget {
  const HostCalendarScreen({super.key});

  @override
  State<HostCalendarScreen> createState() => _HostCalendarScreenState();
}

class _HostCalendarScreenState extends State<HostCalendarScreen> {
  bool _loading = true;
  bool _blocking = false;
  String? _error;
  String? _notice;
  List<Map<String, dynamic>> _properties = <Map<String, dynamic>>[];
  String? _selectedId;
  List<Map<String, dynamic>> _blocks = <Map<String, dynamic>>[];
  DateTime _month = DateTime(DateTime.now().year, DateTime.now().month);
  DateTime? _rangeStart;
  DateTime? _rangeEnd;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final List<Map<String, dynamic>> props =
          await context.read<IleApi>().getHostProperties();
      if (!mounted) return;
      final String? first =
          props.isNotEmpty ? props.first['id']?.toString() : null;
      setState(() {
        _properties = props;
        _selectedId = first;
        _loading = false;
      });
      if (first != null) await _loadBlocks(first);
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

  Future<void> _loadBlocks(String propertyId) async {
    try {
      final Map<String, dynamic> res =
          await context.read<IleApi>().getHostPropertyAvailability(propertyId);
      final List<dynamic> raw =
          (res['blocks'] as List<dynamic>?) ?? <dynamic>[];
      if (!mounted) return;
      setState(() {
        _blocks = raw
            .whereType<Map>()
            .map((Map e) => Map<String, dynamic>.from(e))
            .toList();
      });
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() => _notice = err.message);
    }
  }

  String _ymd(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  _DayState _stateFor(DateTime day) {
    final String key = _ymd(day);
    for (final Map<String, dynamic> b in _blocks) {
      final String start = b['startDate']?.toString() ?? '';
      final String end = b['endDate']?.toString() ?? '';
      if (start.isEmpty || end.isEmpty) continue;
      if (key.compareTo(start) >= 0 && key.compareTo(end) < 0) {
        final String type = (b['type']?.toString() ?? '').toUpperCase();
        if (type.contains('RESERV') || type.contains('BOOK') || type == 'HOLD') {
          return _DayState.booked;
        }
        return _DayState.blocked;
      }
    }
    return _DayState.open;
  }

  void _handleDayTap(DateTime day) {
    setState(() {
      if (_rangeStart == null || (_rangeStart != null && _rangeEnd != null)) {
        _rangeStart = day;
        _rangeEnd = null;
      } else if (day.isBefore(_rangeStart!)) {
        _rangeStart = day;
        _rangeEnd = null;
      } else {
        _rangeEnd = day;
      }
    });
  }

  Future<void> _block() async {
    final String? id = _selectedId;
    if (id == null || _rangeStart == null) return;
    final DateTime end = _rangeEnd ?? _rangeStart!.add(const Duration(days: 1));
    setState(() => _blocking = true);
    try {
      await context.read<IleApi>().blockHostPropertyDates(
            propertyId: id,
            startDate: _ymd(_rangeStart!),
            endDate: _ymd(end),
          );
      setState(() {
        _notice = 'Dates blocked.';
        _rangeStart = null;
        _rangeEnd = null;
      });
      await _loadBlocks(id);
    } on ApiException catch (err) {
      setState(() => _notice = err.message);
    } finally {
      if (mounted) setState(() => _blocking = false);
    }
  }

  Future<void> _unblock(String blockId) async {
    final String? id = _selectedId;
    if (id == null) return;
    try {
      await context.read<IleApi>().unblockHostPropertyDates(
            propertyId: id,
            blockId: blockId,
          );
      setState(() => _notice = 'Block removed.');
      await _loadBlocks(id);
    } on ApiException catch (err) {
      setState(() => _notice = err.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final DateTime first = DateTime(_month.year, _month.month, 1);
    final int daysInMonth = DateTime(_month.year, _month.month + 1, 0).day;
    final int startWeekday = first.weekday % 7; // Sunday=0

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: const HostChromeAppBar(title: 'Calendar'),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : _error != null
              ? IleErrorState(
                  title: 'Could not load calendar',
                  message: _error!,
                  onRetry: _bootstrap,
                )
              : _properties.isEmpty
                  ? const IleEmptyState(
                      title: 'No listings',
                      message: 'Create a listing before managing availability.',
                      icon: Icons.calendar_month_outlined,
                    )
                  : RefreshIndicator(
                      onRefresh: () async {
                        if (_selectedId != null) {
                          await _loadBlocks(_selectedId!);
                        }
                      },
                      child: ListView(
                        padding:
                            const EdgeInsets.all(AppSpacing.screenHorizontal),
                        children: <Widget>[
                          DropdownButtonFormField<String>(
                            initialValue: _selectedId,
                            items: _properties
                                .map(
                                  (Map<String, dynamic> p) =>
                                      DropdownMenuItem<String>(
                                    value: p['id']?.toString(),
                                    child: Text(
                                      p['title']?.toString() ?? 'Listing',
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (String? value) async {
                              setState(() => _selectedId = value);
                              if (value != null) await _loadBlocks(value);
                            },
                            decoration:
                                const InputDecoration(labelText: 'Listing'),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          Row(
                            children: <Widget>[
                              IconButton(
                                tooltip: 'Previous month',
                                onPressed: () => setState(() {
                                  _month = DateTime(
                                    _month.year,
                                    _month.month - 1,
                                  );
                                }),
                                icon: const Icon(Icons.chevron_left),
                              ),
                              Expanded(
                                child: Text(
                                  '${_month.year}-${_month.month.toString().padLeft(2, '0')}',
                                  textAlign: TextAlign.center,
                                  style: AppTypography.sectionHeading,
                                ),
                              ),
                              IconButton(
                                tooltip: 'Next month',
                                onPressed: () => setState(() {
                                  _month = DateTime(
                                    _month.year,
                                    _month.month + 1,
                                  );
                                }),
                                icon: const Icon(Icons.chevron_right),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            children: <String>['S', 'M', 'T', 'W', 'T', 'F', 'S']
                                .map(
                                  (String d) => Expanded(
                                    child: Center(
                                      child: Text(d, style: AppTypography.caption),
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                          const SizedBox(height: 4),
                          GridView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: startWeekday + daysInMonth,
                            gridDelegate:
                                const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 7,
                              mainAxisSpacing: 4,
                              crossAxisSpacing: 4,
                            ),
                            itemBuilder: (BuildContext context, int index) {
                              if (index < startWeekday) {
                                return const SizedBox.shrink();
                              }
                              final int day = index - startWeekday + 1;
                              final DateTime date =
                                  DateTime(_month.year, _month.month, day);
                              final _DayState state = _stateFor(date);
                              final bool inRange = _rangeStart != null &&
                                  ((_rangeEnd == null &&
                                          _ymd(date) == _ymd(_rangeStart!)) ||
                                      (_rangeEnd != null &&
                                          _ymd(date)
                                                  .compareTo(_ymd(_rangeStart!)) >=
                                              0 &&
                                          _ymd(date)
                                                  .compareTo(_ymd(_rangeEnd!)) <=
                                              0));
                              final Color bg;
                              switch (state) {
                                case _DayState.booked:
                                  bg = AppColors.infoBg;
                                case _DayState.blocked:
                                  bg = AppColors.criticalBg;
                                case _DayState.open:
                                  bg = inRange
                                      ? AppColors.emeraldLight
                                      : AppColors.surface;
                              }
                              return Material(
                                color: bg,
                                borderRadius: BorderRadius.circular(8),
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(8),
                                  onTap: () => _handleDayTap(date),
                                  child: Center(
                                    child: Text(
                                      '$day',
                                      style: AppTypography.caption.copyWith(
                                        fontWeight: FontWeight.w600,
                                        color: state == _DayState.blocked
                                            ? AppColors.criticalText
                                            : AppColors.foreground,
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Wrap(
                            spacing: 12,
                            children: const <Widget>[
                              HostStatusChip(
                                label: 'Open',
                                tone: HostStatusTone.neutral,
                              ),
                              HostStatusChip(
                                label: 'Blocked',
                                tone: HostStatusTone.critical,
                              ),
                              HostStatusChip(
                                label: 'Booked/hold',
                                tone: HostStatusTone.info,
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.md),
                          if (_rangeStart != null)
                            Text(
                              _rangeEnd == null
                                  ? 'Selected: ${_ymd(_rangeStart!)} (tap end date)'
                                  : 'Block ${_ymd(_rangeStart!)} → ${_ymd(_rangeEnd!)}',
                              style: AppTypography.supporting,
                            ),
                          IleButton(
                            label: _blocking ? 'Blocking…' : 'Block selected dates',
                            onPressed: (_rangeStart == null || _blocking)
                                ? null
                                : _block,
                            isLoading: _blocking,
                            isExpanded: true,
                          ),
                          if (_notice != null) ...[
                            const SizedBox(height: AppSpacing.sm),
                            Text(_notice!, style: AppTypography.supporting),
                          ],
                          const SizedBox(height: AppSpacing.lg),
                          Text('Blocks & holds', style: AppTypography.sectionHeading),
                          const SizedBox(height: AppSpacing.sm),
                          if (_blocks.isEmpty)
                            Text(
                              'No availability blocks for this listing.',
                              style: AppTypography.supporting,
                            )
                          else
                            ..._blocks.map((Map<String, dynamic> b) {
                              final String type =
                                  b['type']?.toString() ?? 'BLOCK';
                              final String blockId = b['id']?.toString() ?? '';
                              final bool isManual =
                                  type.toUpperCase().contains('MANUAL');
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(
                                  '${b['startDate']} → ${b['endDate']}',
                                  style: AppTypography.body,
                                ),
                                subtitle: Text(
                                  type,
                                  style: AppTypography.supporting,
                                ),
                                trailing: isManual
                                    ? IconButton(
                                        tooltip: 'Unblock',
                                        onPressed: () => _unblock(blockId),
                                        icon: const Icon(Icons.lock_open),
                                      )
                                    : null,
                              );
                            }),
                        ],
                      ),
                    ),
    );
  }
}

enum _DayState { open, blocked, booked }
