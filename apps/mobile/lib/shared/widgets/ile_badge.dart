import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';

enum IleBadgeTone { neutral, success, warning, info, critical, emerald }

/// Pill / status badge foundation.
class IleBadge extends StatelessWidget {
  const IleBadge({
    super.key,
    required this.label,
    this.tone = IleBadgeTone.neutral,
    this.isUppercase = false,
    this.leading,
    this.semanticLabel,
  });

  final String label;
  final IleBadgeTone tone;
  final bool isUppercase;
  final Widget? leading;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final _BadgeColors colors = _resolveColors();
    final String display =
        isUppercase ? label.toUpperCase() : label;

    return Semantics(
      label: semanticLabel ?? label,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: 10,
          vertical: AppSpacing.xxs,
        ),
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: AppRadius.pillAll,
          border: Border.all(color: colors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (leading != null) ...[
              IconTheme(
                data: IconThemeData(color: colors.foreground, size: 12),
                child: leading!,
              ),
              const SizedBox(width: 4),
            ],
            Text(
              display,
              style: AppTypography.microLabel.copyWith(
                color: colors.foreground,
                fontWeight: FontWeight.w600,
                letterSpacing: isUppercase ? 0.55 : 0.2,
                fontSize: isUppercase ? 11 : 11.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  _BadgeColors _resolveColors() {
    switch (tone) {
      case IleBadgeTone.success:
        return const _BadgeColors(
          background: AppColors.successBg,
          foreground: AppColors.successText,
          border: AppColors.successBorder,
        );
      case IleBadgeTone.warning:
        return const _BadgeColors(
          background: AppColors.warningBg,
          foreground: AppColors.warningText,
          border: AppColors.warningBorder,
        );
      case IleBadgeTone.info:
        return const _BadgeColors(
          background: AppColors.infoBg,
          foreground: AppColors.infoText,
          border: AppColors.infoBorder,
        );
      case IleBadgeTone.critical:
        return const _BadgeColors(
          background: AppColors.criticalBg,
          foreground: AppColors.criticalText,
          border: AppColors.criticalBorder,
        );
      case IleBadgeTone.emerald:
        return const _BadgeColors(
          background: AppColors.emeraldLight,
          foreground: AppColors.emerald,
          border: AppColors.successBorder,
        );
      case IleBadgeTone.neutral:
        return const _BadgeColors(
          background: AppColors.surfaceMuted,
          foreground: AppColors.foreground,
          border: AppColors.border,
        );
    }
  }
}

class _BadgeColors {
  const _BadgeColors({
    required this.background,
    required this.foreground,
    required this.border,
  });

  final Color background;
  final Color foreground;
  final Color border;
}

/// Verified stay pill matching web property-card treatment.
class IleVerifiedBadge extends StatelessWidget {
  const IleVerifiedBadge({
    super.key,
    this.label = 'Verified stay',
  });

  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
        decoration: BoxDecoration(
          color: AppColors.surface.withValues(alpha: 0.95),
          borderRadius: AppRadius.pillAll,
          border: Border.all(
            color: AppColors.border.withValues(alpha: 0.6),
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0D000000),
              offset: Offset(0, 1),
              blurRadius: 2,
            ),
          ],
        ),
        child: Text(
          label,
          style: AppTypography.microLabel.copyWith(
            fontSize: 11.5,
            fontWeight: FontWeight.w600,
            letterSpacing: 0,
            color: AppColors.foreground,
          ),
        ),
      ),
    );
  }
}
