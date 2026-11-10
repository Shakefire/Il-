import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/constants/app_assets.dart';
import '../../core/constants/app_routes.dart';
import '../../core/constants/app_strings.dart';
import '../../shared/widgets/widgets.dart';

/// Full-bleed welcome / get-started onboarding entry.
///
/// Features a wide, full-width frosted glass sheet anchored at the bottom
/// with a 40px top radius and stadium pill CTA.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  void _handleGetStarted(BuildContext context) {
    context.push(AppRoutes.login);
  }

  void _handleContinueAsGuest(BuildContext context) {
    context.go(AppRoutes.home);
  }

  @override
  Widget build(BuildContext context) {
    final double bottomInset = MediaQuery.paddingOf(context).bottom;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: AppColors.charcoal,
        body: Stack(
          fit: StackFit.expand,
          children: [
            // Full-screen background property photo
            Image.asset(
              AppAssets.welcomeInterior,
              fit: BoxFit.cover,
              filterQuality: FilterQuality.high,
              errorBuilder: (
                BuildContext context,
                Object error,
                StackTrace? stackTrace,
              ) {
                return const ColoredBox(color: AppColors.charcoal);
              },
            ),
            // Subtle ambient gradient scrim
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Color(0x1A000000),
                    Color(0x00000000),
                    Color(0x66000000),
                  ],
                  stops: [0, 0.42, 1],
                ),
              ),
            ),
            // Wide bottom-anchored frosted glass container (edge-to-edge)
            Align(
              alignment: Alignment.bottomCenter,
              child: ClipRRect(
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(40),
                ),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 32, sigmaY: 32),
                  child: Container(
                    width: double.infinity,
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.xl,
                      AppSpacing.xxl + AppSpacing.xs,
                      AppSpacing.xl,
                      AppSpacing.xl + bottomInset,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.charcoal.withValues(alpha: 0.32),
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          AppColors.charcoal.withValues(alpha: 0.22),
                          AppColors.charcoal.withValues(alpha: 0.48),
                        ],
                      ),
                      border: Border(
                        top: BorderSide(
                          color: AppColors.onDark.withValues(alpha: 0.12),
                          width: 1,
                        ),
                      ),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          AppStrings.welcomeHeadline,
                          textAlign: TextAlign.center,
                          style: AppTypography.Auth.welcomeHeadline,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          AppStrings.welcomeSupporting,
                          textAlign: TextAlign.center,
                          style: AppTypography.Auth.welcomeSupporting.copyWith(
                            color: AppColors.onDark.withValues(alpha: 0.85),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xxl),
                        IleButton(
                          label: AppStrings.getStarted,
                          isExpanded: true,
                          compact: true,
                          borderRadius: AppRadius.pillAll,
                          onPressed: () => _handleGetStarted(context),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        TextButton(
                          onPressed: () => _handleContinueAsGuest(context),
                          style: TextButton.styleFrom(
                            foregroundColor: AppColors.onDark,
                            minimumSize: const Size(44, 44),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: Text(
                            AppStrings.continueAsGuest,
                            style: AppTypography.Auth.guestLink,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
