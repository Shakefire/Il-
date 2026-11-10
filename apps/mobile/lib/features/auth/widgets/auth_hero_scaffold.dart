import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../../app/app_colors.dart';
import '../../../app/app_radius.dart';
import '../../../app/app_spacing.dart';
import '../../../app/app_typography.dart';
import '../../../core/constants/app_assets.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/constants/app_strings.dart';
import '../../../shared/widgets/ile_circular_back_button.dart';

/// Edge-to-edge, bottom-anchored mobile authentication scaffold matching
/// the reference proportions:
///
/// 1. Apartment background image covers the upper ~35–38% of the screen.
/// 2. Compact introductory text inside a horizontal translucent dark overlay band.
/// 3. Clear visible image gap between the overlay band and the card.
/// 4. White form card overlapping the lower ~62–65% of the screen with a 16px top radius.
/// 5. Compact internal controls and comfortable bottom padding.
class AuthHeroScaffold extends StatelessWidget {
  const AuthHeroScaffold({
    super.key,
    required this.child,
    this.imageAsset = AppAssets.authInterior,
    this.supportingText,
    this.cardTopFraction = AppSpacing.authCardTopFractionLogin,
    this.showBack = true,
  });

  final Widget child;
  final String imageAsset;
  final String? supportingText;
  final double cardTopFraction;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: Colors.white,
        resizeToAvoidBottomInset: true,
        body: Stack(
          fit: StackFit.expand,
          children: [
            // 1. Full Screen Background Image (Framed to show artwork, lighting & headboard)
            Positioned.fill(
              child: Image.asset(
                imageAsset,
                fit: BoxFit.cover,
                alignment: const Alignment(0.0, -0.25),
                filterQuality: FilterQuality.high,
                errorBuilder: (
                  BuildContext context,
                  Object error,
                  StackTrace? stackTrace,
                ) {
                  return const ColoredBox(color: AppColors.surfaceMuted);
                },
              ),
            ),

            // Subtle soft ambient scrim preserving apartment visibility
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x24000000), // gentle tint at top
                      Color(0x05000000), // clear middle
                      Color(0x2E000000), // soft tint near bottom
                    ],
                    stops: [0.0, 0.45, 1.0],
                  ),
                ),
              ),
            ),

            // 2. Interactive scrollable content (Header overlay + form card)
            Positioned.fill(
              child: SafeArea(
                top: true,
                bottom: false,
                child: LayoutBuilder(
                  builder: (
                    BuildContext context,
                    BoxConstraints constraints,
                  ) {
                    final double topHeight =
                        constraints.maxHeight * cardTopFraction;
                    final router = GoRouter.maybeOf(context);
                    final bool canGoBack = showBack &&
                        ((router?.canPop() ?? false) ||
                            Navigator.canPop(context));

                    return SingleChildScrollView(
                      physics: const ClampingScrollPhysics(),
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          minHeight: constraints.maxHeight,
                        ),
                        child: IntrinsicHeight(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              // Upper Image Area: Contains the horizontal translucent overlay band
                              SizedBox(
                                height: topHeight,
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    if (canGoBack)
                                      Padding(
                                        padding: const EdgeInsets.fromLTRB(
                                          AppSpacing.authCardHorizontal - 4,
                                          AppSpacing.xs,
                                          AppSpacing.authCardHorizontal,
                                          0,
                                        ),
                                        child: Align(
                                          alignment: Alignment.centerLeft,
                                          child: IleCircularBackButton(
                                            onPressed: () {
                                              if (router != null &&
                                                  router.canPop()) {
                                                router.pop();
                                                return;
                                              }
                                              if (Navigator.canPop(context)) {
                                                Navigator.of(context).pop();
                                                return;
                                              }
                                              if (router != null) {
                                                router.go(AppRoutes.welcome);
                                              }
                                            },
                                          ),
                                        ),
                                      ),
                                    const Spacer(),

                                    // Translucent dark overlay extending horizontally across the image
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal:
                                            AppSpacing.authCardHorizontal,
                                      ),
                                      child: Container(
                                        width: double.infinity,
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 14,
                                          vertical: 7,
                                        ),
                                        decoration: BoxDecoration(
                                          color: AuthColors.heroOverlay,
                                          borderRadius:
                                              BorderRadius.circular(
                                            AppRadius.authOverlay,
                                          ),
                                        ),
                                        child: Column(
                                          crossAxisAlignment:
                                              CrossAxisAlignment.start,
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(
                                              AppStrings.authGreeting,
                                              style: AppTypography
                                                  .Auth.overlayHeading,
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              supportingText ??
                                                  AppStrings.authSupporting,
                                              style: AppTypography
                                                  .Auth.overlaySupporting,
                                            ),
                                          ],
                                        ),
                                      ),
                                    ),

                                    // Visible image gap separating overlay from the card
                                    const SizedBox(
                                      height: AppSpacing.authOverlayGap,
                                    ),
                                  ],
                                ),
                              ),

                              // 3. Form Card overlapping the lower image section
                              Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.authCardHorizontal,
                                ),
                                child: Container(
                                  width: double.infinity,
                                  decoration: const BoxDecoration(
                                    color: AppColors.surface,
                                    borderRadius: AppRadius.authCardAll,
                                    boxShadow: [
                                      BoxShadow(
                                        color: Color(0x14000000),
                                        offset: Offset(0, 4),
                                        blurRadius: 16,
                                      ),
                                    ],
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.fromLTRB(
                                      AppSpacing.authCardHorizontal,
                                      AppSpacing.authCardVertical,
                                      AppSpacing.authCardHorizontal,
                                      AppSpacing.authCardBottom,
                                    ),
                                    child: child,
                                  ),
                                ),
                              ),
                              const SizedBox(height: AppSpacing.xl),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
