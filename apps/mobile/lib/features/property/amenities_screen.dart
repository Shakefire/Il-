import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/models/amenity.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_empty_state.dart';

/// Full-screen categorized amenities from host-configured list only.
class AmenitiesScreen extends StatelessWidget {
  const AmenitiesScreen({
    super.key,
    required this.title,
    required this.amenities,
  });

  final String title;
  final List<IleAmenity> amenities;

  @override
  Widget build(BuildContext context) {
    final Map<String, List<IleAmenity>> grouped =
        AmenityCatalog.groupByCategory(amenities);
    final List<String> categories = grouped.keys.toList()..sort();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text('What this place offers', style: AppTypography.cardTitle),
      ),
      body: amenities.isEmpty
          ? const IleEmptyState(
              title: 'No amenities listed',
              message: 'The host has not configured amenities for this stay yet.',
              icon: Icons.checklist_rtl_rounded,
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenHorizontal,
                8,
                AppSpacing.screenHorizontal,
                AppSpacing.xxl,
              ),
              children: [
                Text(
                  title,
                  style: AppTypography.supporting.copyWith(
                    color: AppColors.foregroundSecondary,
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                for (final String category in categories) ...[
                  Text(category, style: AppTypography.cardTitle),
                  const SizedBox(height: AppSpacing.sm),
                  ...grouped[category]!.map(
                    (IleAmenity amenity) => _AmenityRow(amenity: amenity),
                  ),
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                    child: Divider(color: AppColors.border, height: 1),
                  ),
                ],
              ],
            ),
    );
  }
}

class _AmenityRow extends StatelessWidget {
  const _AmenityRow({required this.amenity});

  final IleAmenity amenity;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Icon(
            AmenityCatalog.iconFor(amenity.name),
            color: AppColors.foreground,
            size: 22,
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              amenity.name,
              style: AppTypography.supporting.copyWith(
                color: AppColors.foreground,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
