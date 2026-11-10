import 'package:flutter/material.dart';

import '../../../app/app_radius.dart';
import '../../../app/app_spacing.dart';
import 'skeleton_box.dart';

/// Multi-line text skeleton built from [SkeletonBox] rows.
class SkeletonText extends StatelessWidget {
  const SkeletonText({
    super.key,
    this.lines = 2,
    this.lineHeight = 12,
    this.spacing = AppSpacing.xs,
    this.widthFactor = 1,
  });

  final int lines;
  final double lineHeight;
  final double spacing;
  final double widthFactor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: List<Widget>.generate(lines, (int index) {
        final bool isLast = index == lines - 1;
        final double factor = isLast ? widthFactor * 0.65 : widthFactor;
        return Padding(
          padding: EdgeInsets.only(bottom: isLast ? 0 : spacing),
          child: FractionallySizedBox(
            widthFactor: factor.clamp(0.35, 1),
            alignment: Alignment.centerLeft,
            child: SkeletonBox(
              height: lineHeight,
              borderRadius: AppRadius.pillAll,
            ),
          ),
        );
      }),
    );
  }
}
