import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import 'ile_badge.dart';
import 'ile_card.dart';
import 'ile_price_display.dart';

/// Property card foundation — layout shell only, no API data.
class IlePropertyCard extends StatelessWidget {
  const IlePropertyCard({
    super.key,
    required this.title,
    required this.location,
    required this.pricePerNight,
    this.image,
    this.isVerified = true,
    this.rating,
    this.reviewCount,
    this.onTap,
  });

  final String title;
  final String location;
  final num pricePerNight;
  final Widget? image;
  final bool isVerified;
  final double? rating;
  final int? reviewCount;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return IleCard(
      onTap: onTap,
      semanticLabel: '$title in $location',
      padding: const EdgeInsets.all(AppSpacing.cardPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 16 / 10,
            child: Stack(
              fit: StackFit.expand,
              children: [
                ClipRRect(
                  borderRadius: AppRadius.imageInnerAll,
                  child: ColoredBox(
                    color: AppColors.border,
                    child: image ??
                        const Center(
                          child: Icon(
                            Icons.home_work_outlined,
                            color: AppColors.foregroundMuted,
                            size: 36,
                          ),
                        ),
                  ),
                ),
                if (isVerified)
                  const Positioned(
                    top: 12,
                    left: 12,
                    child: IleVerifiedBadge(),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.cardTitle,
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(location, style: AppTypography.supporting),
          const SizedBox(height: AppSpacing.xs),
          Row(
            children: [
              Expanded(
                child: IlePriceDisplay(amount: pricePerNight, compact: true),
              ),
              if (rating != null) ...[
                const Icon(Icons.star_rounded, size: 16, color: AppColors.foreground),
                const SizedBox(width: 2),
                Text(
                  rating!.toStringAsFixed(2),
                  style: AppTypography.supporting.copyWith(
                    color: AppColors.foreground,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (reviewCount != null)
                  Text(
                    ' ($reviewCount)',
                    style: AppTypography.caption,
                  ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
