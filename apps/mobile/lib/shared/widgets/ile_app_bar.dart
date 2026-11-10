import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/constants/app_strings.dart';

/// Charcoal sticky-style app bar with optional Ilé wordmark.
class IleAppBar extends StatelessWidget implements PreferredSizeWidget {
  const IleAppBar({
    super.key,
    this.title,
    this.showBrand = false,
    this.actions,
    this.leading,
    this.automaticallyImplyLeading = true,
    this.backgroundColor = AppColors.charcoal,
    this.foregroundColor = AppColors.onDark,
  });

  final String? title;
  final bool showBrand;
  final List<Widget>? actions;
  final Widget? leading;
  final bool automaticallyImplyLeading;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: backgroundColor,
      foregroundColor: foregroundColor,
      elevation: 0,
      scrolledUnderElevation: 0,
      systemOverlayStyle: backgroundColor == AppColors.charcoal
          ? SystemUiOverlayStyle.light
          : SystemUiOverlayStyle.dark,
      automaticallyImplyLeading: automaticallyImplyLeading,
      leading: leading,
      actions: actions,
      title: showBrand
          ? const IleBrandMark(onDark: true)
          : (title != null
              ? Text(
                  title!,
                  style: AppTypography.screenTitle.copyWith(
                    fontSize: 20,
                    color: foregroundColor,
                  ),
                )
              : null),
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Container(
          height: 1,
          color: backgroundColor == AppColors.charcoal
              ? AppColors.headerBorder
              : AppColors.borderSubtle,
        ),
      ),
    );
  }
}

/// Ilé wordmark with emerald accent dot.
class IleBrandMark extends StatelessWidget {
  const IleBrandMark({
    super.key,
    this.onDark = false,
    this.fontSize = 26,
  });

  final bool onDark;
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      header: true,
      label: AppStrings.brandName,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            AppStrings.brandName,
            style: AppTypography.wordmark.copyWith(
              fontSize: fontSize,
              color: onDark ? AppColors.onDark : AppColors.foreground,
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Container(
            width: 8,
            height: 8,
            margin: const EdgeInsets.only(top: 4),
            decoration: const BoxDecoration(
              color: AppColors.emerald,
              shape: BoxShape.circle,
            ),
          ),
        ],
      ),
    );
  }
}
