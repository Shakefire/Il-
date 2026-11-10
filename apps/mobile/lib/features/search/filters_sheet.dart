import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/state/search_session.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_circular_back_button.dart';

/// Filters using schema-backed fields only (price, type, beds, baths, power, amenities).
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
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppRadius.editorialSheet),
        ),
      ),
      builder: (BuildContext context) {
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

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: AppSpacing.screenHorizontal,
          right: AppSpacing.screenHorizontal,
          top: AppSpacing.md,
          bottom: MediaQuery.viewInsetsOf(context).bottom + AppSpacing.md,
        ),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.border,
                    borderRadius: AppRadius.pillAll,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              SizedBox(
                height: 44,
                child: Row(
                  children: [
                    IleCircularBackButton(
                      visualSize: 38,
                      semanticLabel: 'Close filters',
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                    Expanded(
                      child: Text(
                        'Filters',
                        textAlign: TextAlign.center,
                        style: AppTypography.screenTitle.copyWith(fontSize: 22),
                      ),
                    ),
                    const SizedBox(width: 44),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text('Sort', style: AppTypography.cardTitle),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: 8,
                children: [
                  _chip('Relevance', _sort == 'relevance', () {
                    setState(() => _sort = 'relevance');
                  }),
                  _chip('Price ↑', _sort == 'price_asc', () {
                    setState(() => _sort = 'price_asc');
                  }),
                  _chip('Price ↓', _sort == 'price_desc', () {
                    setState(() => _sort = 'price_desc');
                  }),
                  _chip('Rating', _sort == 'rating', () {
                    setState(() => _sort = 'rating');
                  }),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                'Price per night (NGN)',
                style: AppTypography.cardTitle,
              ),
              RangeSlider(
                values: _price,
                min: 0,
                max: _maxPrice,
                divisions: 50,
                activeColor: AppColors.emerald,
                labels: RangeLabels(
                  '₦${_price.start.round()}',
                  '₦${_price.end.round()}',
                ),
                onChanged: (RangeValues v) => setState(() => _price = v),
              ),
              if (widget.availableTypes.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                Text('Property type', style: AppTypography.cardTitle),
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _chip('Any', _type == null, () {
                      setState(() => _type = null);
                    }),
                    ...widget.availableTypes.map(
                      (String t) => _chip(t, _type == t, () {
                        setState(() => _type = t);
                      }),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              Text('Bedrooms', style: AppTypography.cardTitle),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: 8,
                children: [
                  _chip('Any', _bedrooms == null, () {
                    setState(() => _bedrooms = null);
                  }),
                  for (int i = 1; i <= 5; i++)
                    _chip('$i+', _bedrooms == i, () {
                      setState(() => _bedrooms = i);
                    }),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text('Bathrooms', style: AppTypography.cardTitle),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: 8,
                children: [
                  _chip('Any', _bathrooms == null, () {
                    setState(() => _bathrooms = null);
                  }),
                  for (int i = 1; i <= 4; i++)
                    _chip('$i+', _bathrooms == i, () {
                      setState(() => _bathrooms = i);
                    }),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text('Power', style: AppTypography.cardTitle),
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: 8,
                children: [
                  _chip('Any', _power == null, () {
                    setState(() => _power = null);
                  }),
                  _chip('Solar + Inverter', _power == 'Solar + Inverter', () {
                    setState(() => _power = 'Solar + Inverter');
                  }),
                ],
              ),
              if (widget.availableAmenities.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                Text('Amenities', style: AppTypography.cardTitle),
                const SizedBox(height: AppSpacing.xs),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: widget.availableAmenities
                      .take(12)
                      .map(
                        (String a) => _chip(
                          a,
                          _amenities.contains(a),
                          () {
                            setState(() {
                              if (_amenities.contains(a)) {
                                _amenities.remove(a);
                              } else {
                                _amenities.add(a);
                              }
                            });
                          },
                        ),
                      )
                      .toList(),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              Row(
                children: [
                  Expanded(
                    child: IleButton(
                      label: 'Clear',
                      variant: IleButtonVariant.secondary,
                      isExpanded: true,
                      onPressed: () {
                        context.read<SearchSession>().clearFilters();
                        Navigator.of(context).pop();
                        widget.onApply();
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: IleButton(
                      label: 'Show stays',
                      isExpanded: true,
                      onPressed: _handleApply,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(String label, bool selected, VoidCallback onTap) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: AppColors.emeraldLight,
      checkmarkColor: AppColors.emerald,
      labelStyle: AppTypography.caption.copyWith(
        color: selected ? AppColors.emerald : AppColors.foreground,
        fontWeight: FontWeight.w600,
      ),
      side: BorderSide(
        color: selected ? AppColors.emerald : AppColors.border,
      ),
      backgroundColor: AppColors.surface,
    );
  }
}
