import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_shadows.dart';
import '../../app/app_spacing.dart';

/// Surface card foundation — white surface, warm border, optional elevation.
class IleCard extends StatelessWidget {
  const IleCard({
    super.key,
    required this.child,
    this.padding,
    this.onTap,
    this.semanticLabel,
    this.showShadow = false,
    this.borderColor = AppColors.cardBorder,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final String? semanticLabel;
  final bool showShadow;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    final Widget content = Container(
      width: double.infinity,
      padding: padding ?? const EdgeInsets.all(AppSpacing.cardPadding),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: AppRadius.cardAll,
        border: Border.all(color: borderColor),
        boxShadow: showShadow ? AppShadows.xs : null,
      ),
      child: child,
    );

    if (onTap == null) {
      return Semantics(
        container: true,
        label: semanticLabel,
        child: content,
      );
    }

    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.cardAll,
          splashColor: AppColors.emerald.withValues(alpha: 0.06),
          highlightColor: AppColors.emerald.withValues(alpha: 0.04),
          child: content,
        ),
      ),
    );
  }
}
