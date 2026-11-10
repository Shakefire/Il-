import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';

/// Subtle warm stone divider.
class IleDivider extends StatelessWidget {
  const IleDivider({
    super.key,
    this.height = AppSpacing.xl,
    this.indent = 0,
    this.endIndent = 0,
    this.subtle = true,
  });

  final double height;
  final double indent;
  final double endIndent;
  final bool subtle;

  @override
  Widget build(BuildContext context) {
    return Divider(
      height: height,
      thickness: 1,
      indent: indent,
      endIndent: endIndent,
      color: subtle ? AppColors.borderSubtle : AppColors.border,
    );
  }
}
