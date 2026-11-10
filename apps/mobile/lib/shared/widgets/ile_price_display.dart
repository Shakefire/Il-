import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_typography.dart';

/// Nightly price display with optional period suffix.
class IlePriceDisplay extends StatelessWidget {
  const IlePriceDisplay({
    super.key,
    required this.amount,
    this.currencySymbol = '₦',
    this.period = '/ night',
    this.compact = false,
  });

  final num amount;
  final String currencySymbol;
  final String? period;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final String formatted = _formatAmount(amount);

    return Semantics(
      label: '$currencySymbol$formatted${period ?? ''}',
      child: Text.rich(
        TextSpan(
          children: [
            TextSpan(
              text: '$currencySymbol$formatted',
              style: (compact ? AppTypography.cardTitle : AppTypography.price)
                  .copyWith(color: AppColors.foreground),
            ),
            if (period != null)
              TextSpan(
                text: ' $period',
                style: AppTypography.supporting.copyWith(
                  color: AppColors.foregroundSecondary,
                  fontWeight: FontWeight.w400,
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _formatAmount(num value) {
    final String raw = value.round().toString();
    final StringBuffer buffer = StringBuffer();
    for (int i = 0; i < raw.length; i++) {
      final int reverseIndex = raw.length - i;
      buffer.write(raw[i]);
      if (reverseIndex > 1 && reverseIndex % 3 == 1) {
        buffer.write(',');
      }
    }
    return buffer.toString();
  }
}
