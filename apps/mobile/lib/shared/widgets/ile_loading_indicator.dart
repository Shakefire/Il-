import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';

/// Brand-tinted loading indicator with optional message.
class IleLoadingIndicator extends StatelessWidget {
  const IleLoadingIndicator({
    super.key,
    this.message,
    this.size = 28,
  });

  final String? message;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: message ?? 'Loading',
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: size,
            height: size,
            child: const CircularProgressIndicator(
              strokeWidth: 2.5,
              color: AppColors.emerald,
              backgroundColor: AppColors.emeraldLight,
            ),
          ),
          if (message != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              message!,
              textAlign: TextAlign.center,
              style: AppTypography.supporting,
            ),
          ],
        ],
      ),
    );
  }
}
