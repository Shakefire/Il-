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
    final String? amenity = StayDisplay.highlightAmenity(property);
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
          padding: const EdgeInsets.all(6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AspectRatio(
                aspectRatio: 4 / 3,
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
                    Positioned(
                      top: 10,
                      right: 10,
                      child: WishlistHeartButton(
                        isSaved: widget.isWishListed,
                        onPressed: widget.onToggleWishlist,
                      ),
                    ),
                    if (property.verified)
                      const Positioned(
                        left: 10,
                        top: 10,
                        child: EditorialGlassChip(
                          icon: Icons.verified_rounded,
                          label: 'Verified',
                        ),
                      ),
                    if (amenity != null)
                      Positioned(
                        left: 10,
                        bottom: images.length > 1 ? 28 : 10,
                        right: 56,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: EditorialGlassChip(
                            icon: Icons.check_rounded,
                            label: amenity,
                            iconColor: EditorialColors.brand,
                          ),
                        ),
                      ),
                    if (property.isReserved)
                      Positioned(
                        right: 10,
                        bottom: images.length > 1 ? 28 : 10,
                        child: const EditorialGlassChip(
                          icon: Icons.event_busy_outlined,
                          label: 'Dates reserved',
                          iconColor: EditorialColors.brand,
                        ),
                      ),
                    if (images.length > 1)
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 10,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List<Widget>.generate(images.length, (int i) {
                            final bool active = i == _page;
                            return Container(
                              width: active ? 8 : 5,
                              height: 5,
                              margin: const EdgeInsets.symmetric(horizontal: 2),
                              decoration: BoxDecoration(
                                color: active
                                    ? EditorialColors.onBrand
                                    : EditorialColors.onBrand.withValues(alpha: 0.55),
                                borderRadius: AppRadius.pillAll,
                              ),
                            );
                          }),
                        ),
                      ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 12, 10, 8),
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
                            style: AppTypography.cardTitle.copyWith(
                              color: EditorialColors.ink,
                            ),
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
                            property.rating.toStringAsFixed(1),
                            style: AppTypography.supporting.copyWith(
                              color: EditorialColors.ink,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          if (property.reviewCount > 0)
                            Text(
                              ' (${property.reviewCount})',
                              style: AppTypography.caption.copyWith(
                                color: EditorialColors.inkMuted,
                              ),
                            ),
                        ],
                      ],
                    ),
                    if (property.locationLabel.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        property.locationLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.supporting.copyWith(
                          color: EditorialColors.inkMuted,
                        ),
                      ),
                    ],
                    const SizedBox(height: 10),
                    Text(
                      _specs(property),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.supporting.copyWith(
                        color: EditorialColors.ink,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(child: EditorialPrice(amount: property.pricePerNight)),
                        TextButton(
                          onPressed: widget.onTap,
                          style: TextButton.styleFrom(
                            foregroundColor: EditorialColors.brand,
                            minimumSize: const Size(44, 44),
                          ),
                          child: Text(
                            'View stay',
                            style: AppTypography.supporting.copyWith(
                              color: EditorialColors.brand,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
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

  String _specs(IleProperty property) {
    final List<String> parts = <String>[
      if (property.bedrooms > 0)
        '${property.bedrooms} bed${property.bedrooms == 1 ? '' : 's'}',
      if (property.bathrooms > 0)
        '${property.bathrooms} bath${property.bathrooms == 1 ? '' : 's'}',
      if (property.maxGuests > 0)
        '${property.maxGuests} guest${property.maxGuests == 1 ? '' : 's'}',
    ];
    if (parts.isEmpty) return 'Details from the host';
    return parts.join('  ·  ');
  }
}
