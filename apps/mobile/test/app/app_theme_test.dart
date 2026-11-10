import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ile_mobile/app/app_colors.dart';
import 'package:ile_mobile/app/app_theme.dart';
import 'package:ile_mobile/app/app_typography.dart';

void main() {
  group('AppTheme', () {
    test('light theme uses Ilé canvas and emerald primary', () {
      final ThemeData theme = AppTheme.light;

      expect(theme.scaffoldBackgroundColor, AppColors.background);
      expect(theme.colorScheme.primary, AppColors.emerald);
      expect(theme.colorScheme.surface, AppColors.surface);
      expect(theme.colorScheme.error, AppColors.criticalText);
      expect(theme.appBarTheme.backgroundColor, AppColors.charcoal);
      expect(
        theme.textTheme.bodyLarge?.fontFamily,
        AppTypography.sansFamily,
      );
    });

    test('color tokens match brand.md hex values', () {
      expect(AppColors.background.toARGB32(), 0xFFFAF8F5);
      expect(EditorialColors.brand.toARGB32(), 0xFF073B2E);
      expect(EditorialColors.gold.toARGB32(), 0xFFD4AF37);
      expect(AppColors.emerald.toARGB32(), 0xFF0B5D45);
      expect(AppColors.charcoal.toARGB32(), 0xFF1A1A1A);
      expect(AppColors.successText.toARGB32(), 0xFF0B5D45);
      expect(AppColors.warningText.toARGB32(), 0xFF9A5B13);
      expect(AppColors.infoText.toARGB32(), 0xFF1B65C5);
      expect(AppColors.criticalText.toARGB32(), 0xFFB91C1C);
    });
  });
}
