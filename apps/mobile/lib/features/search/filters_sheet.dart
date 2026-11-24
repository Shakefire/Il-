import 'dart:math' as math;
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../app/app_radius.dart';
import '../../app/app_router.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/state/search_session.dart';
import '../../core/utils/formatters.dart';

/// Style 1 Refine Stays sheet — bespoke "Fixed Editorial" Afro-Luxe Design System.
class FiltersSheet extends StatefulWidget {
  const FiltersSheet({
    super.key,
    required this.availableTypes,
    required this.availableAmenities,
    required this.onApply,
  });

  final List<String> availableTypes;
  final List<String> availableAmenities;
  final VoidCallback onApply;

  static Future<void> show(
    BuildContext context, {
    required List<String> availableTypes,
    required List<String> availableAmenities,
    required VoidCallback onApply,
  }) {
    final BuildContext targetContext =
        rootNavigatorKey.currentContext ?? context;
    return showModalBottomSheet<void>(
      context: targetContext,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x730A1C16), // rgba(10, 28, 22, 0.45)
      builder: (BuildContext sheetContext) {
        return FiltersSheet(
          availableTypes: availableTypes,
          availableAmenities: availableAmenities,
          onApply: onApply,
        );
      },
    );
  }

  @override
  State<FiltersSheet> createState() => _FiltersSheetState();
}

class _FiltersSheetState extends State<FiltersSheet> {
  late String? _type;
  late int? _bedrooms;
  late int? _bathrooms;
  late RangeValues _price;
  late String? _power;
  late Set<String> _amenities;
  late String _sort;

  static const double _maxPrice = 500000;
  static const Color _bgWarmAlabaster = Color(0xFFFAF8F5);
  static const Color _cardSurface = Color(0xFFFFFFFF);
  static const Color _brandEmerald = Color(0xFF073B2E);
  static const Color _inkMuted = Color(0xFF6E6B64);
  static const Color _inkDark = Color(0xFF141917);

  static const List<_SortOption> _sortOptions = <_SortOption>[
    _SortOption(id: 'relevance', label: 'Recommended'),
    _SortOption(id: 'price_asc', label: 'Price: Low to High'),
    _SortOption(id: 'price_desc', label: 'Price: High to Low'),
    _SortOption(id: 'rating', label: 'Top Rated ★'),
  ];

  static const List<_AmenityBento> _bentoAmenities = <_AmenityBento>[
    _AmenityBento(
      label: '24/7 Power',
      subtext: 'Dual Gen + Inverter',
      icon: Icons.bolt_rounded,
      kind: _AmenityKind.amenity,
      matchKeys: <String>['24/7', '24-7', 'power'],
    ),
    _AmenityBento(
      label: 'Solar + Inverter',
      subtext: 'Silent backup',
      icon: Icons.solar_power_rounded,
      kind: _AmenityKind.power,
      matchKeys: <String>['solar', 'inverter'],
    ),
    _AmenityBento(
      label: 'Fast Wi-Fi',
      subtext: 'Starlink / Fiber',
      icon: Icons.wifi_rounded,
      kind: _AmenityKind.amenity,
      matchKeys: <String>['wifi', 'wi-fi', 'internet', 'fiber'],
    ),
    _AmenityBento(
      label: 'Gated Security',
      subtext: '24-hr uniformed guards',
      icon: Icons.shield_outlined,
      kind: _AmenityKind.amenity,
      matchKeys: <String>['gated', 'security', 'guard'],
    ),
  ];

  @override
  void initState() {
    super.initState();
    final SearchSession session = context.read<SearchSession>();
    _type = session.propertyType;
    _bedrooms = session.bedrooms;
    _bathrooms = session.bathrooms;
    _price = RangeValues(
      (session.minPrice ?? 0).toDouble(),
      (session.maxPrice ?? _maxPrice.toInt()).toDouble().clamp(0, _maxPrice),
    );
    _power = session.powerType;
    _amenities = Set<String>.from(session.amenities);
    _sort = session.sort;
  }

  int get _draftFilterCount {
    int count = 0;
    if (_type != null) count++;
    if (_bedrooms != null) count++;
    if (_bathrooms != null) count++;
    if (_price.start.round() > 0 || _price.end.round() < _maxPrice) count++;
    if (_power != null) count++;
    count += _amenities.length;
    if (_sort != 'relevance') count++;
    return count;
  }

  void _handleReset() {
    HapticFeedback.selectionClick();
    setState(() {
      _type = null;
      _bedrooms = null;
      _bathrooms = null;
      _price = const RangeValues(0, _maxPrice);
      _power = null;
      _amenities = <String>{};
      _sort = 'relevance';
    });
  }

  void _handleClearAll() {
    context.read<SearchSession>().clearFilters();
    Navigator.of(context).pop();
    widget.onApply();
  }

  void _handleApply() {
    context.read<SearchSession>().setFilters(
          type: _type,
          beds: _bedrooms,
          baths: _bathrooms,
          min: _price.start.round() == 0 ? null : _price.start.round(),
          max: _price.end.round() >= _maxPrice ? null : _price.end.round(),
          power: _power,
          amenitySet: _amenities,
        );
    context.read<SearchSession>().setSort(_sort);
    Navigator.of(context).pop();
    widget.onApply();
  }

  String? _resolveAmenityLabel(_AmenityBento item) {
    for (final String available in widget.availableAmenities) {
      final String lower = available.toLowerCase();
      if (item.matchKeys.any(lower.contains)) return available;
    }
    return item.label;
  }

  bool _isBentoSelected(_AmenityBento item) {
    if (item.kind == _AmenityKind.power) {
      return _power == 'Solar + Inverter';
    }
    final String label = _resolveAmenityLabel(item)!;
    return _amenities.contains(label) || _amenities.contains(item.label);
  }

  void _toggleBento(_AmenityBento item) {
    HapticFeedback.selectionClick();
    setState(() {
      if (item.kind == _AmenityKind.power) {
        _power = _power == 'Solar + Inverter' ? null : 'Solar + Inverter';
        return;
      }
      final String label = _resolveAmenityLabel(item)!;
      if (_amenities.contains(label) || _amenities.contains(item.label)) {
        _amenities.remove(label);
        _amenities.remove(item.label);
      } else {
        _amenities.add(label);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final double maxHeight = MediaQuery.sizeOf(context).height * 0.88;
    final double bottomInset = MediaQuery.paddingOf(context).bottom;

    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: Material(
          color: _bgWarmAlabaster,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(28),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              _FiltersHeader(
                onClose: () => Navigator.of(context).pop(),
                onReset: _handleReset,
              ),
              Expanded(
                child: ListView(
                  padding: EdgeInsets.fromLTRB(
                    20,
                    20,
                    20,
                    110 + bottomInset,
                  ),
                  children: [
                    // Section 1: SORT BY
                    Text(
                      'SORT BY',
                      style: AppTypography.microLabel.copyWith(
                        fontSize: 11,
                        letterSpacing: 0.8,
                        fontWeight: FontWeight.w700,
                        color: _inkMuted,
                      ),
                    ),
                    const SizedBox(height: 10),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          for (int i = 0; i < _sortOptions.length; i++) ...[
                            if (i > 0) const SizedBox(width: 8),
                            _SortPill(
                              label: _sortOptions[i].label,
                              selected: _sort == _sortOptions[i].id,
                              onTap: () => setState(
                                () => _sort = _sortOptions[i].id,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xl),

                    // Section 2: Nightly Budget (Price per night (NGN))
                    Text(
                      'Price per night (NGN)',
                      style: AppTypography.cardTitle.copyWith(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: _inkDark,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _PriceHistogram(range: _price, max: _maxPrice),
                    const SizedBox(height: 4),
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        activeTrackColor: _brandEmerald,
                        inactiveTrackColor: const Color(0xFFE2DDD3),
                        rangeThumbShape: const _EditorialRangeThumbShape(radius: 11),
                        overlayColor: _brandEmerald.withValues(alpha: 0.12),
                        thumbColor: _cardSurface,
                        rangeTrackShape: const RoundedRectRangeSliderTrackShape(),
                        trackHeight: 3,
                      ),
                      child: RangeSlider(
                        values: _price,
                        min: 0,
                        max: _maxPrice,
                        divisions: 50,
                        onChanged: (RangeValues values) {
                          setState(() => _price = values);
                        },
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: _PriceReadout(
                            label: 'MINIMUM',
                            value: '₦${IleFormatters.formatInteger(_price.start.round())}',
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 8),
                          child: Text(
                            '—',
                            style: TextStyle(
                              color: _inkMuted,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Expanded(
                          child: _PriceReadout(
                            label: 'MAXIMUM',
                            value: _price.end.round() >= _maxPrice
                                ? '₦${IleFormatters.formatInteger(_maxPrice.toInt())}+'
                                : '₦${IleFormatters.formatInteger(_price.end.round())}',
                          ),
                        ),
                      ],
                    ),

                    if (widget.availableTypes.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xl),
                      Text(
                        'Property type',
                        style: AppTypography.cardTitle.copyWith(
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          color: _inkDark,
                        ),
                      ),
                      const SizedBox(height: 10),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            _SortPill(
                              label: 'Any',
                              selected: _type == null,
                              onTap: () => setState(() => _type = null),
                            ),
                            ...widget.availableTypes.map(
                              (String t) => Padding(
                                padding: const EdgeInsets.only(left: 8),
                                child: _SortPill(
                                  label: t,
                                  selected: _type == t,
                                  onTap: () => setState(() => _type = t),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // Section 3: Rooms & Capacity (Compact Horizontal Rows, No Wrapping)
                    const SizedBox(height: AppSpacing.xl),
                    Text(
                      'Rooms & Capacity',
                      style: AppTypography.cardTitle.copyWith(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: _inkDark,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Bedrooms',
                      style: AppTypography.supporting.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _inkDark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _SegmentedCount(
                      value: _bedrooms,
                      onChanged: (int? v) => setState(() => _bedrooms = v),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'Bathrooms',
                      style: AppTypography.supporting.copyWith(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: _inkDark,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _SegmentedCount(
                      value: _bathrooms,
                      onChanged: (int? v) => setState(() => _bathrooms = v),
                    ),

                    // Section 4: Power, Security & Standout Amenities (2-Column Bento Cards)
                    const SizedBox(height: AppSpacing.xl),
                    Text(
                      'Power, Security & Standout Amenities',
                      style: AppTypography.cardTitle.copyWith(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: _inkDark,
                      ),
                    ),
                    const SizedBox(height: 12),
                    GridView.count(
                      crossAxisCount: 2,
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      mainAxisSpacing: 10,
                      crossAxisSpacing: 10,
                      childAspectRatio: 1.35,
                      children: _bentoAmenities
                          .map(
                            (amenity) => _AmenityTile(
                              label: amenity.label,
                              subtext: amenity.subtext,
                              icon: amenity.icon,
                              selected: _isBentoSelected(amenity),
                              onTap: () => _toggleBento(amenity),
                            ),
                          )
                          .toList(),
                    ),
                  ],
                ),
              ),

              // Sticky Bottom Action Bar
              _FiltersFooter(
                bottomInset: bottomInset,
                clearCount: _draftFilterCount,
                onClear: _handleClearAll,
                onShow: _handleApply,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SortOption {
  const _SortOption({required this.id, required this.label});

  final String id;
  final String label;
}

enum _AmenityKind { amenity, power }

class _AmenityBento {
  const _AmenityBento({
    required this.label,
    required this.subtext,
    required this.icon,
    required this.kind,
    required this.matchKeys,
  });

  final String label;
  final String subtext;
  final IconData icon;
  final _AmenityKind kind;
  final List<String> matchKeys;
}

class _FiltersHeader extends StatelessWidget {
  const _FiltersHeader({
    required this.onClose,
    required this.onReset,
  });

  final VoidCallback onClose;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: Color(0xFFFAF8F5),
        border: Border(
          bottom: BorderSide(color: Color(0xFFEAE4D7)),
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
                color: const Color(0xFFD5D0C5),
                borderRadius: AppRadius.pillAll,
              ),
            ),
          ),
          SizedBox(
            height: 56,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Semantics(
                    button: true,
                    label: 'Close filters',
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: onClose,
                        customBorder: const CircleBorder(),
                        child: SizedBox(
                          width: AppSpacing.touchTarget,
                          height: AppSpacing.touchTarget,
                          child: Center(
                            child: Ink(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0xFFFFFFFF),
                                border: Border.all(
                                  color: const Color(0xFFE6E2D8),
                                ),
                              ),
                              child: const Icon(
                                Icons.close_rounded,
                                size: 18,
                                color: Color(0xFF141917),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      'Refine Stays',
                      textAlign: TextAlign.center,
                      style: AppTypography.screenTitle.copyWith(
                        fontSize: 19,
                        letterSpacing: -0.38,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF141917),
                      ),
                    ),
                  ),
                  Semantics(
                    button: true,
                    label: 'Reset filters',
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: onReset,
                        borderRadius: AppRadius.pillAll,
                        child: Container(
                          height: 44,
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          alignment: Alignment.center,
                          child: Text(
                            'Reset',
                            style: AppTypography.supporting.copyWith(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF073B2E),
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
        ],
      ),
    );
  }
}

class _FiltersFooter extends StatelessWidget {
  const _FiltersFooter({
    required this.bottomInset,
    required this.clearCount,
    required this.onClear,
    required this.onShow,
  });

  final double bottomInset;
  final int clearCount;
  final VoidCallback onClear;
  final VoidCallback onShow;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: Color(0xFFFFFFFF),
        border: Border(
          top: BorderSide(color: Color(0xFFE6E2D8)),
        ),
        boxShadow: [
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
            TextButton(
              onPressed: onClear,
              style: TextButton.styleFrom(
                foregroundColor: const Color(0xFF141917),
                minimumSize: const Size(44, 50),
                padding: const EdgeInsets.symmetric(horizontal: 8),
              ),
              child: Text(
                clearCount > 0 ? 'Clear all ($clearCount)' : 'Clear all',
                style: AppTypography.supporting.copyWith(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: const Color(0xFF141917),
                  decoration: TextDecoration.underline,
                  decorationColor: const Color(0xFF141917),
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Semantics(
                button: true,
                label: 'Show stays',
                child: Material(
                  color: const Color(0xFF073B2E),
                  borderRadius: AppRadius.pillAll,
                  child: InkWell(
                    onTap: onShow,
                    borderRadius: AppRadius.pillAll,
                    child: SizedBox(
                      height: 50,
                      child: Center(
                        child: Text(
                          'Show stays →',
                          style: AppTypography.button.copyWith(
                            fontSize: 15,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SortPill extends StatelessWidget {
  const _SortPill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: Material(
        color: selected ? const Color(0xFF073B2E) : const Color(0xFFFFFFFF),
        borderRadius: AppRadius.pillAll,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.pillAll,
          child: Container(
            height: 38,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: AppRadius.pillAll,
              border: Border.all(
                color: selected
                    ? const Color(0xFF073B2E)
                    : const Color(0xFFE6E2D8),
              ),
            ),
            child: Text(
              selected && label == 'Recommended' ? '✓ $label' : label,
              style: AppTypography.supporting.copyWith(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected
                    ? Colors.white
                    : const Color(0xFF141917),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SegmentedCount extends StatelessWidget {
  const _SegmentedCount({
    required this.value,
    required this.onChanged,
  });

  final int? value;
  final ValueChanged<int?> onChanged;

  static const List<({String label, int? value})> _options =
      <({String label, int? value})>[
    (label: 'Any', value: null),
    (label: '1+', value: 1),
    (label: '2+', value: 2),
    (label: '3+', value: 3),
    (label: '4+', value: 4),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: Row(
        children: [
          for (int i = 0; i < _options.length; i++) ...[
            if (i > 0) const SizedBox(width: 8),
            Expanded(
              child: Material(
                color: value == _options[i].value
                    ? const Color(0xFF073B2E)
                    : const Color(0xFFFFFFFF),
                borderRadius: BorderRadius.circular(12),
                child: InkWell(
                  onTap: () => onChanged(_options[i].value),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: value == _options[i].value
                            ? const Color(0xFF073B2E)
                            : const Color(0xFFE6E2D8),
                      ),
                    ),
                    child: Text(
                      _options[i].label,
                      style: AppTypography.supporting.copyWith(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: value == _options[i].value
                            ? Colors.white
                            : const Color(0xFF141917),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _PriceReadout extends StatelessWidget {
  const _PriceReadout({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE6E2D8)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: AppTypography.microLabel.copyWith(
              fontSize: 10,
              letterSpacing: 0.8,
              color: const Color(0xFF6E6B64),
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: AppTypography.supporting.copyWith(
              fontWeight: FontWeight.w700,
              color: const Color(0xFF141917),
              fontSize: 15,
            ),
          ),
        ],
      ),
    );
  }
}

class _PriceHistogram extends StatelessWidget {
  const _PriceHistogram({required this.range, required this.max});

  final RangeValues range;
  final double max;

  static const List<double> _weights = <double>[
    0.22,
    0.38,
    0.55,
    0.72,
    0.9,
    1.0,
    0.82,
    0.64,
    0.48,
    0.34,
    0.22,
    0.14,
  ];
  static const Color _inRange = Color(0xFFDCE7E3);
  static const Color _outRange = Color(0xFFEAE6DF);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 36,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          for (int i = 0; i < _weights.length; i++)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 1.5),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  height: math.max(6, 36 * _weights[i]),
                  decoration: BoxDecoration(
                    color: _isInRange(i) ? _inRange : _outRange,
                    borderRadius: const BorderRadius.vertical(
                      top: Radius.circular(3),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  bool _isInRange(int index) {
    final double bucketStart = (index / _weights.length) * max;
    final double bucketEnd = ((index + 1) / _weights.length) * max;
    return bucketEnd >= range.start && bucketStart <= range.end;
  }
}

class _EditorialRangeThumbShape extends RangeSliderThumbShape {
  const _EditorialRangeThumbShape({this.radius = 11.0});

  final double radius;

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) =>
      Size.fromRadius(radius);

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    bool isDiscrete = false,
    bool isEnabled = false,
    bool? isOnTop,
    required SliderThemeData sliderTheme,
    TextDirection textDirection = TextDirection.ltr,
    Thumb thumb = Thumb.start,
    bool? isPressed,
  }) {
    final Canvas canvas = context.canvas;
    final Path shadowPath = Path()
      ..addOval(Rect.fromCircle(center: center.translate(0, 2), radius: radius));
    canvas.drawShadow(shadowPath, const Color(0x33073B2E), 4.0, false);

    final Paint fillPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, radius, fillPaint);

    final Paint borderPaint = Paint()
      ..color = const Color(0xFF073B2E)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke;
    canvas.drawCircle(center, radius, borderPaint);
  }
}

class _AmenityTile extends StatelessWidget {
  const _AmenityTile({
    required this.label,
    required this.subtext,
    required this.icon,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String subtext;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: Material(
        color: selected ? const Color(0xFFEBF3F0) : const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: selected
                    ? const Color(0xFF073B2E)
                    : const Color(0xFFE6E2D8),
                width: selected ? 1.5 : 1,
              ),
            ),
            child: Stack(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      icon,
                      size: 22,
                      color: selected
                          ? const Color(0xFF073B2E)
                          : const Color(0xFF6E6B64),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.supporting.copyWith(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        color: const Color(0xFF141917),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtext,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(
                        fontSize: 11,
                        color: const Color(0xFF6E6B64),
                      ),
                    ),
                  ],
                ),
                if (selected)
                  const Positioned(
                    top: 0,
                    right: 0,
                    child: Icon(
                      Icons.check_circle_rounded,
                      size: 18,
                      color: Color(0xFF073B2E),
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
