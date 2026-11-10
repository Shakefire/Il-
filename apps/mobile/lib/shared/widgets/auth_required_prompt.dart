import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/constants/app_routes.dart';
import 'ile_button.dart';

/// Sign-in wall for auth-required tabs/actions. Preserves return route.
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

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.emeraldLight,
              borderRadius: AppRadius.panelAll,
            ),
            child: Icon(icon, color: AppColors.emerald, size: 32),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            title,
            textAlign: TextAlign.center,
            style: AppTypography.sectionHeading,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            message,
            textAlign: TextAlign.center,
            style: AppTypography.supporting,
          ),
          const SizedBox(height: AppSpacing.xl),
          IleButton(
            label: 'Continue with phone or email',
            onPressed: () => context.push(_loginPath),
            isExpanded: true,
          ),
        ],
      ),
    );
  }
}
