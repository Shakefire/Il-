import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/guest_flow_errors.dart';
import '../../core/state/search_session.dart';
import '../../shared/widgets/luxury_date_range_sheet.dart';

/// Guest bespoke "Fixed Editorial" Luxury Date Selection Screen (Concept 1).
/// Directly renders the luxury date range selection, completely eliminating
/// any default Material header, pencil text toggle, or stock Save button.
class DateGuestPickerScreen extends StatefulWidget {
  const DateGuestPickerScreen({
    super.key,
    this.editMode = false,
    this.maxGuests,
    this.minimumNights = 1,
    this.propertyId,
    this.nightlyRate,
  });

  final bool editMode;
  final int? maxGuests;
  final int minimumNights;
  final String? propertyId;
  final int? nightlyRate;

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
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(localErr),
            backgroundColor: const Color(0xFF073B2E),
          ),
        );
      }
      return;
    }
    if (_guests > _capacity) {
      final String msg =
          'This stay allows up to $_capacity guests. You selected $_guests.';
      setState(() => _validationError = msg);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: const Color(0xFF073B2E),
          ),
        );
      }
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
          final String msg = availability['message']?.toString() ??
              'Those dates are not available for this stay.';
          setState(() {
            _validationError = msg;
            _checkingAvailability = false;
          });
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(msg),
              backgroundColor: const Color(0xFF073B2E),
            ),
          );
          return;
        }
      } catch (err) {
        if (!mounted) return;
        final String msg = GuestFlowError.from(err, surface: 'search').message;
        setState(() {
          _validationError = msg;
          _checkingAvailability = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: const Color(0xFF073B2E),
          ),
        );
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

  @override
  Widget build(BuildContext context) {
    final DateTime now = DateTime.now();
    final DateTime first = DateTime(now.year, now.month, now.day);
    final String? validationError = _validationError;
    final bool checkingAvailability = _checkingAvailability;

    return Stack(
      children: <Widget>[
        LuxuryDateRangeSheet(
          isScreen: true,
          initialRange: _range,
          nightlyRate: widget.nightlyRate,
          minimumNights: widget.minimumNights,
          firstDate: first,
          lastDate: first.add(const Duration(days: 365)),
          onApplyRange: (DateTimeRange picked) async {
            if (checkingAvailability) return;
            setState(() => _range = picked);
            await _handleSave();
          },
        ),
        if (validationError != null && validationError.isNotEmpty)
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: Material(
              color: const Color(0xFF073B2E),
              borderRadius: BorderRadius.circular(12),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                child: Text(
                  validationError,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                ),
              ),
            ),
          ),
        if (checkingAvailability)
          const Positioned.fill(
            child: ColoredBox(
              color: Color(0x66000000),
              child: Center(
                child: CircularProgressIndicator(color: Color(0xFF0B5D45)),
              ),
            ),
          ),
      ],
    );
  }
}
