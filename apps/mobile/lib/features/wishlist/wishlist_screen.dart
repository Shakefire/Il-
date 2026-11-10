import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/constants/app_routes.dart';
import '../../core/models/property.dart';
import '../../core/state/wishlist_store.dart';
import '../../shared/widgets/editorial_chrome.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/skeleton/property_card_skeleton.dart';
import '../explore/widgets/marketplace_property_card.dart';

/// Local wishlist — no backend favourites API exists yet.
class WishlistScreen extends StatelessWidget {
  const WishlistScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final WishlistStore store = context.watch<WishlistStore>();
    final List<IleProperty> items = store.items
        .where((IleProperty p) => p.pricePerNight > 0 || p.title != 'Saved stay')
        .toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        automaticallyImplyLeading: false,
        title: Text('Saved', style: AppTypography.screenTitle),
      ),
      body: !store.isLoaded
          ? ListView.builder(
              padding: EdgeInsets.fromLTRB(
                AppSpacing.screenHorizontal,
                AppSpacing.screenHorizontal,
                AppSpacing.screenHorizontal,
                EditorialLayout.dockClearance(context) + 24,
              ),
              itemCount: 3,
              itemBuilder: (_, _) => const Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.lg),
                child: PropertyCardSkeleton(),
              ),
            )
          : items.isEmpty
              ? IleEmptyState(
                  title: 'No saved stays',
                  message:
                      'Tap the heart on a listing to save it on this device. Cloud sync needs a favourites API.',
                  icon: Icons.favorite_border_rounded,
                  actionLabel: 'Explore stays',
                  onAction: () => context.go(AppRoutes.explore),
                )
              : ListView.builder(
                  padding: EdgeInsets.fromLTRB(
                    AppSpacing.screenHorizontal,
                    AppSpacing.screenHorizontal,
                    AppSpacing.screenHorizontal,
                    EditorialLayout.dockClearance(context) + 24,
                  ),
                  itemCount: items.length + 1,
                  itemBuilder: (BuildContext context, int index) {
                    if (index == 0) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.md),
                        child: Text(
                          'Saved on this device only',
                          style: AppTypography.caption,
                        ),
                      );
                    }
                    final IleProperty property = items[index - 1];
                    return Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
                        child: MarketplacePropertyCard(
                        property: property,
                        heroScope: 'saved',
                        isWishListed: true,
                        onTap: () => context.push(
                          AppRoutes.propertyDetailsPath(
                            property.slug,
                            heroScope: 'saved',
                          ),
                        ),
                        onToggleWishlist: () => store.toggle(property),
                      ),
                    );
                  },
                ),
    );
  }
}
