import 'package:flutter/material.dart';

import '../../../app/app_spacing.dart';
import 'property_card_skeleton.dart';
import 'skeleton_box.dart';
import 'skeleton_circle.dart';
import 'skeleton_text.dart';

/// Full guest loading layout used by profile and legacy skeleton previews.
class GuestHomeSkeleton extends StatelessWidget {
  const GuestHomeSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screenHorizontal,
        AppSpacing.md,
        AppSpacing.screenHorizontal,
        AppSpacing.xxl,
      ),
      children: const [
        Row(
          children: [
            SkeletonCircle(size: 48),
            SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SkeletonBox(width: 120, height: 14),
                  SizedBox(height: AppSpacing.xs),
                  SkeletonText(lines: 1, widthFactor: 0.7),
                ],
              ),
            ),
          ],
        ),
        SizedBox(height: AppSpacing.xl),
        SkeletonBox(height: 44, borderRadius: BorderRadius.all(Radius.circular(10))),
        SizedBox(height: AppSpacing.xl),
        SkeletonBox(width: 140, height: 20),
        SizedBox(height: AppSpacing.md),
        PropertyCardSkeleton(),
        SizedBox(height: AppSpacing.md),
        PropertyCardSkeleton(),
        SizedBox(height: AppSpacing.md),
        PropertyCardSkeleton(),
      ],
    );
  }
}

/// Compact profile-style skeleton for auth-adjacent placeholders.
class ProfilePlaceholderSkeleton extends StatelessWidget {
  const ProfilePlaceholderSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        children: const [
          SkeletonCircle(size: 72),
          SizedBox(height: AppSpacing.md),
          SkeletonBox(width: 160, height: 18),
          SizedBox(height: AppSpacing.xs),
          SkeletonText(lines: 2, widthFactor: 0.8),
          SizedBox(height: AppSpacing.xl),
          SkeletonBox(height: 52),
          SizedBox(height: AppSpacing.sm),
          SkeletonBox(height: 52),
          SizedBox(height: AppSpacing.sm),
          SkeletonBox(height: 52),
        ],
      ),
    );
  }
}
