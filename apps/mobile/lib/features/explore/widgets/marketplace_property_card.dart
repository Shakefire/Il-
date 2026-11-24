import 'package:flutter/material.dart';

import '../../../app/app_colors.dart';
import '../../../app/app_radius.dart';
import '../../../app/app_shadows.dart';
import '../../../app/app_typography.dart';
import '../../../core/models/property.dart';
import '../../../core/utils/stay_display.dart';
import '../../../shared/widgets/editorial_chrome.dart';

/// Discovery card. Amenity copy and verification come only from the listing.
class MarketplacePropertyCard extends StatefulWidget {
  const MarketplacePropertyCard({
    super.key,
    required this.property,
    required this.isWishListed,
    required this.onTap,
    required this.onToggleWishlist,
    this.heroScope,
  });

  final IleProperty property;
  final bool isWishListed;
  final VoidCallback onTap;
  final VoidCallback onToggleWishlist;
  final String? heroScope;

  @override
  State<MarketplacePropertyCard> createState() => _MarketplacePropertyCardState();
}

class _MarketplacePropertyCardState extends State<MarketplacePropertyCard> {
  int _page = 0;

  @override
  Widget build(BuildContext context) {
    final IleProperty property = widget.property;
    final String title = StayDisplay.title(property);
    final List<String> images = StayDisplay.gallery(property);
    final List<String> trust = StayDisplay.trustBadges(property);
    final Widget photo = images.isEmpty
        ? const EditorialShimmer(showMark: true)
        : PageView.builder(
            itemCount: images.length,
            onPageChanged: (int index) => setState(() => _page = index),
            itemBuilder: (BuildContext context, int index) {
              return EditorialImage(url: images[index]);
            },
          );
    final Widget framed = ClipRRect(
      borderRadius: AppRadius.editorialImageAll,
      child: photo,
    );

    return Semantics(
      button: true,
      label: 'View stay, $title in ${property.locationLabel}',
      child: GestureDetector(
        onTap: widget.onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: EditorialColors.card,
            borderRadius: AppRadius.editorialCardAll,
            border: Border.all(color: EditorialColors.hairline),
            boxShadow: AppShadows.editorialCard,
          ),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  height: 225,
                  width: double.infinity,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      widget.heroScope == null
                          ? framed
                          : Hero(
                              tag: StayDisplay.heroTag(
                                widget.heroScope!,
                                property.id,
                              ),
                              child: framed,
                            ),
                      if (property.verified)
                        const Positioned(
                          left: 12,
                          top: 12,
                          child: EditorialGlassChip(
                            icon: Icons.verified_rounded,
                            label: 'Verified',
                            iconColor: EditorialColors.gold,
                          ),
                        ),
                      Positioned(
                        top: 12,
                        right: 12,
                        child: WishlistHeartButton(
                          isSaved: widget.isWishListed,
                          onPressed: widget.onToggleWishlist,
                          size: 36,
                        ),
                      ),
                      if (trust.isNotEmpty)
                        Positioned(
                          left: 12,
                          bottom: 12,
                          right: images.length > 1 ? 56 : 12,
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: EditorialGlassChip(
                              icon: Icons.check_rounded,
                              label: trust.join('  •  '),
                              iconColor: Colors.white,
                              dark: true,
                            ),
                          ),
                        ),
                      if (property.isReserved)
                        Positioned(
                          right: 12,
                          bottom: images.length > 1 ? 36 : 12,
                          child: const EditorialGlassChip(
                            icon: Icons.event_busy_outlined,
                            label: 'Dates reserved',
                            iconColor: EditorialColors.brand,
                          ),
                        ),
                      if (images.length > 1)
                        Positioned(
                          right: 14,
                          bottom: 14,
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: List<Widget>.generate(images.length, (
                              int i,
                            ) {
                              final bool active = i == _page;
                              return Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 2,
                                ),
                                child: Text(
                                  active ? '•' : '○',
                                  style: TextStyle(
                                    color: Colors.white.withValues(
                                      alpha: active ? 1 : 0.7,
                                    ),
                                    fontSize: 10,
                                    height: 1,
                                  ),
                                ),
                              );
                            }),
                          ),
                        ),
                    ],
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 12, 4, 4),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.cardTitle,
                            ),
                          ),
                          if (property.rating > 0) ...[
                            const SizedBox(width: 8),
                            const Icon(
                              Icons.star_rounded,
                              size: 16,
                              color: EditorialColors.gold,
                            ),
                            const SizedBox(width: 2),
                            Text(
                              property.rating.toStringAsFixed(2),
                              style: AppTypography.supporting.copyWith(
                                color: EditorialColors.ink,
                                fontWeight: FontWeight.w600,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _metaLine(property),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.supporting.copyWith(
                          color: EditorialColors.inkMuted,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 12),
                      DecoratedBox(
                        decoration: const BoxDecoration(
                          border: Border(
                            top: BorderSide(color: EditorialColors.rule),
                          ),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: Row(
                            children: [
                              Expanded(
                                child: EditorialPrice(
                                  amount: property.pricePerNight,
                                ),
                              ),
                              Material(
                                color: EditorialColors.tint,
                                borderRadius: AppRadius.pillAll,
                                child: InkWell(
                                  onTap: widget.onTap,
                                  borderRadius: AppRadius.pillAll,
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 6,
                                    ),
                                    child: Text(
                                      'View Stay →',
                                      style: AppTypography.supporting.copyWith(
                                        color: EditorialColors.brand,
                                        fontWeight: FontWeight.w600,
                                        fontSize: 13,
                                      ),
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
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _metaLine(IleProperty property) {
    final List<String> parts = <String>[
      if (property.locationLabel.isNotEmpty) property.locationLabel,
      if (property.bedrooms > 0)
        '${property.bedrooms} bed${property.bedrooms == 1 ? '' : 's'}',
      if (property.bathrooms > 0)
        '${property.bathrooms} bath${property.bathrooms == 1 ? '' : 's'}',
      if (property.maxGuests > 0)
        '${property.maxGuests} guest${property.maxGuests == 1 ? '' : 's'}',
    ];
    if (parts.isEmpty) return 'Details from the host';
    return parts.join('  •  ');
  }
}
