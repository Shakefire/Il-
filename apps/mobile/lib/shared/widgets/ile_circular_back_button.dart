import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../core/constants/app_routes.dart';

/// Circular back control matching the OTP reference layout.
class IleCircularBackButton extends StatelessWidget {
  const IleCircularBackButton({
    super.key,
    this.onPressed,
    this.semanticLabel = 'Go back',
    this.fallbackLocation = AppRoutes.explore,
    this.visualSize = AppSpacing.authBackSize,
    this.iconColor = AppColors.foreground,
    this.fillColor = AppColors.surfaceMuted,
  });

  final VoidCallback? onPressed;
  final String semanticLabel;
  final String fallbackLocation;
  final double visualSize;
  final Color iconColor;
  final Color fillColor;

  void _handleBack(BuildContext context) {
    if (onPressed != null) {
      onPressed!();
      return;
    }
    if (context.canPop()) {
      context.pop();
      return;
    }
    final bool didPop = Navigator.of(context).canPop();
    if (didPop) {
      Navigator.of(context).pop();
      return;
    }
    context.go(fallbackLocation);
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => _handleBack(context),
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: AppSpacing.touchTarget,
            height: AppSpacing.touchTarget,
            child: Center(
              child: Ink(
                width: visualSize,
                height: visualSize,
                decoration: BoxDecoration(
                  color: fillColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  Icons.arrow_back_ios_new_rounded,
                  size: 14,
                  color: iconColor,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
