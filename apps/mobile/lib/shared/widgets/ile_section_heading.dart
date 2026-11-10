import 'package:flutter/material.dart';

import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';

/// Editorial section title (DM Serif Display) with optional supporting line.
class IleSectionHeading extends StatelessWidget {
  const IleSectionHeading({
    super.key,
    required this.title,
    this.subtitle,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: AppTypography.sectionHeading),
                if (subtitle != null) ...[
                  const SizedBox(height: AppSpacing.xxs),
                  Text(subtitle!, style: AppTypography.supporting),
                ],
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}
