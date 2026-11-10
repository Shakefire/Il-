import 'package:flutter/material.dart';

import '../../../app/app_colors.dart';
import '../../../app/app_radius.dart';
import '../../../app/app_spacing.dart';
import 'skeleton_box.dart';
import 'skeleton_text.dart';

/// Placeholder for bookings list cards.
class BookingCardSkeleton extends StatelessWidget {
  const BookingCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.panelAll,
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: AppRadius.subtleAll,
            child: const SkeletonBox(width: 88, height: 88),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SkeletonBox(width: 140, height: 14),
                SizedBox(height: 8),
                SkeletonText(lines: 1, lineHeight: 12, widthFactor: 0.55),
                SizedBox(height: 8),
                SkeletonBox(width: 110, height: 12),
                SizedBox(height: 10),
                SkeletonBox(width: 96, height: 24),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
