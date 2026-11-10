import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/constants/app_assets.dart';
import 'ile_alert.dart';

/// Social auth row (Google + Apple) — two circular buttons, thin subtle border.
class IleSocialButtons extends StatelessWidget {
  const IleSocialButtons({super.key});

  void _handleTap(BuildContext context, String provider) {
    IleAlert.showSnackBar(
      context: context,
      message: '$provider sign-in is UI-only in this build.',
      tone: IleAlertTone.info,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _SocialCircleButton(
          semanticLabel: 'Continue with Google',
          onPressed: () => _handleTap(context, 'Google'),
          child: SvgPicture.asset(
            AppAssets.iconGoogle,
            width: AppSpacing.authSocialIconSize,
            height: AppSpacing.authSocialIconSize,
            fit: BoxFit.contain,
            semanticsLabel: 'Google',
          ),
        ),
        const SizedBox(width: 14),
        _SocialCircleButton(
          semanticLabel: 'Continue with Apple',
          onPressed: () => _handleTap(context, 'Apple'),
          child: SvgPicture.asset(
            AppAssets.iconApple,
            width: AppSpacing.authSocialIconSize,
            height: AppSpacing.authSocialIconSize,
            fit: BoxFit.contain,
            colorFilter: const ColorFilter.mode(
              AppColors.charcoal,
              BlendMode.srcIn,
            ),
            semanticsLabel: 'Apple',
          ),
        ),
      ],
    );
  }
}

class _SocialCircleButton extends StatelessWidget {
  const _SocialCircleButton({
    required this.child,
    required this.onPressed,
    required this.semanticLabel,
  });

  final Widget child;
  final VoidCallback onPressed;
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          customBorder: const CircleBorder(),
          child: Ink(
            width: AppSpacing.authSocialSize,
            height: AppSpacing.authSocialSize,
            decoration: BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
              border: Border.all(
                color: AuthColors.borderLight,
                width: 0.85,
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0D000000),
                  offset: Offset(0, 1),
                  blurRadius: 2,
                ),
              ],
            ),
            child: Center(child: child),
          ),
        ),
      ),
    );
  }
}

/// Horizontal OR divider used under primary auth CTAs.
class IleOrDivider extends StatelessWidget {
  const IleOrDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Expanded(
          child: Divider(
            color: AuthColors.borderLight,
            thickness: 0.85,
            height: 1,
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
          child: Text(
            'OR',
            style: AppTypography.Auth.orDivider,
          ),
        ),
        const Expanded(
          child: Divider(
            color: AuthColors.borderLight,
            thickness: 0.85,
            height: 1,
          ),
        ),
      ],
    );
  }
}
