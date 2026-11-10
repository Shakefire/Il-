import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_typography.dart';

/// Circular avatar with initials fallback.
class IleAvatar extends StatelessWidget {
  const IleAvatar({
    super.key,
    this.imageUrl,
    this.initials,
    this.size = 40,
    this.semanticLabel,
  });

  final String? imageUrl;
  final String? initials;
  final double size;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final String resolvedInitials = (initials ?? '?').trim().isEmpty
        ? '?'
        : initials!.trim().substring(0, initials!.trim().length.clamp(1, 2));

    return Semantics(
      label: semanticLabel ?? 'Avatar $resolvedInitials',
      image: imageUrl != null,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.emeraldLight,
          border: Border.all(color: AppColors.border),
          image: imageUrl != null
              ? DecorationImage(
                  image: NetworkImage(imageUrl!),
                  fit: BoxFit.cover,
                )
              : null,
        ),
        alignment: Alignment.center,
        child: imageUrl == null
            ? Text(
                resolvedInitials.toUpperCase(),
                style: AppTypography.microLabel.copyWith(
                  fontSize: size * 0.32,
                  color: AppColors.emerald,
                  letterSpacing: 0,
                ),
              )
            : null,
      ),
    );
  }
}
