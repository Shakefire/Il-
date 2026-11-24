import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/constants/app_routes.dart';
import 'ile_button.dart';

/// Sign-in wall for auth-required tabs/actions. Preserves return route.
/// No "Not now" dead-end — return via Explore pill / system back.
class AuthRequiredPrompt extends StatelessWidget {
  const AuthRequiredPrompt({
    super.key,
    required this.title,
    required this.message,
    this.icon = Icons.lock_outline_rounded,
    this.returnPath,
  });

  final String title;
  final String message;
  final IconData icon;
  final String? returnPath;

  String get _loginPath {
    final String target = returnPath ?? AppRoutes.explore;
    return '${AppRoutes.login}?returnTo=${Uri.encodeComponent(target)}';
  }

  String get _registerPath {
    final String target = returnPath ?? AppRoutes.explore;
    return '${AppRoutes.register}?returnTo=${Uri.encodeComponent(target)}';
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: AppSpacing.guestGateIcon,
            height: AppSpacing.guestGateIcon,
            clipBehavior: Clip.none,
            decoration: BoxDecoration(
              color: EditorialColors.tint,
              borderRadius: BorderRadius.circular(20),
            ),
            alignment: Alignment.center,
            child: Icon(icon, color: EditorialColors.brand, size: 28),
          ),
          const SizedBox(height: AppSpacing.lg),
          DecoratedBox(
            decoration: BoxDecoration(
              color: EditorialColors.card,
              borderRadius: AppRadius.editorialCardAll,
              border: Border.all(color: EditorialColors.hairline),
            ),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                children: [
                  Text(
                    title,
                    textAlign: TextAlign.center,
                    style: AppTypography.sectionHeading.copyWith(fontSize: 22),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    message,
                    textAlign: TextAlign.center,
                    style: AppTypography.supporting.copyWith(
                      color: EditorialColors.inkMuted,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  IleButton(
                    label: 'Continue with phone or email',
                    onPressed: () => context.push(_loginPath),
                    isExpanded: true,
                    height: AppSpacing.guestCtaHeight,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    height: AppSpacing.guestCtaHeight,
                    width: double.infinity,
                    child: OutlinedButton(
                      onPressed: () => context.push(_registerPath),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: EditorialColors.ink,
                        side: const BorderSide(
                          color: EditorialColors.outlineButton,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: Text(
                        'Create account',
                        style: AppTypography.buttonSecondary.copyWith(
                          color: EditorialColors.ink,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
