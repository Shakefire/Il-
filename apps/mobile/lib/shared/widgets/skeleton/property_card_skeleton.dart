import 'package:flutter/material.dart';

import '../../../app/app_radius.dart';
import '../../../app/app_spacing.dart';
import 'skeleton_box.dart';
import 'skeleton_text.dart';

/// Property listing card skeleton for marketplace / search placeholders.
class PropertyCardSkeleton extends StatelessWidget {
  const PropertyCardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AspectRatio(
          aspectRatio: 4 / 3,
          child: ClipRRect(
            borderRadius: AppRadius.cardAll,
            child: const SkeletonBox(
              width: double.infinity,
              height: 400,
              borderRadius: BorderRadius.zero,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        const SkeletonBox(width: 180, height: 16),
        const SizedBox(height: AppSpacing.xs),
        const SkeletonText(lines: 1, lineHeight: 12, widthFactor: 0.45),
        const SizedBox(height: AppSpacing.xs),
        const Row(
          children: [
            Expanded(child: SkeletonBox(width: 90, height: 14)),
            SkeletonBox(width: 48, height: 14),
          ],
        ),
      ],
    );
  }
}
