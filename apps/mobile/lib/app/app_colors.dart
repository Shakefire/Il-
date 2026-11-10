import 'package:flutter/material.dart';

/// Exact Ilé color tokens from `brand.md` + `src/app/globals.css`.
/// Do not invent brand colors.
abstract final class AppColors {
  // Core canvas & surfaces
  /// Warm alabaster canvas (editorial guest UI).
  static const Color background = Color(0xFFFAF8F5);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFF5F5F3);
  static const Color surfaceElevated = Color(0xFFFFFFFF);

  /// Auth input fill — soft light gray (slate-50). Prefer [AuthColors.inputFill].
  static const Color authInputFill = Color(0xFFF8FAFC);

  // Charcoal anchors (dark header)
  static const Color charcoal = Color(0xFF1A1A1A);
  static const Color charcoalSurface = Color(0xFF222222);
  static const Color charcoalBorder = Color(0xFF2E2E2E);
  static const Color charcoalHover = Color(0xFF282828);
  static const Color headerBorder = Color(0xFF2A2A2A);

  // Brand emerald / deep pine
  static const Color emerald = Color(0xFF0B5D45);
  static const Color emeraldHover = Color(0xFF084936);
  static const Color emeraldLight = Color(0xFFEDF5F2);
  static const Color brandPrimary = Color(0xFF1C3D32);
  static const Color brandHover = Color(0xFF152E26);
  static const Color accentSurface = Color(0xFFF4F7F5);

  /// Matches `.ile-btn-primary` in `globals.css` (slightly deeper fill).
  static const Color buttonPrimary = Color(0xFF073B2E);
  static const Color buttonPrimaryHover = Color(0xFF05281F);

  // Text
  static const Color foreground = Color(0xFF171717);
  static const Color foregroundSecondary = Color(0xFF6B6B67);
  static const Color foregroundMuted = Color(0xFF8B8B86);
  static const Color textMain = Color(0xFF111827);
  static const Color textMuted = Color(0xFF4B5563);
  static const Color placeholder = Color(0xFF9CA3AF);
  static const Color onDark = Color(0xFFFFFFFF);
  static const Color onDarkMuted = Color(0xFFDCDCDA);

  // Borders
  static const Color border = Color(0xFFE7E5E0);
  static const Color borderSubtle = Color(0xFFF0EFEA);
  static const Color borderLight = Color(0xFFE5E7EB);
  static const Color cardBorder = Color(0xFFEAE8E3);
  static const Color inputBorder = Color(0xFFD1D5DB);
  static const Color inputBorderHover = Color(0xFF9CA3AF);

  // Selection
  static const Color selectionBackground = Color(0xFFEDF3F0);
  static const Color selectionForeground = Color(0xFF24483A);

  // Semantic — Success
  static const Color successBg = Color(0xFFEDF5F2);
  static const Color successText = Color(0xFF0B5D45);
  static const Color successBorder = Color(0xFFD1E5DE);

  // Semantic — Warning
  static const Color warningBg = Color(0xFFFEF7ED);
  static const Color warningText = Color(0xFF9A5B13);
  static const Color warningBorder = Color(0xFFFCE8CF);

  // Semantic — Info
  static const Color infoBg = Color(0xFFF0F6FC);
  static const Color infoText = Color(0xFF1B65C5);
  static const Color infoBorder = Color(0xFFCDE1F3);

  // Semantic — Critical / Error
  static const Color criticalBg = Color(0xFFFDF2F2);
  static const Color criticalText = Color(0xFFB91C1C);
  static const Color criticalBorder = Color(0xFFF8D7D7);
  static const Color inputErrorBorder = Color(0xFFF87171);
  static const Color inputErrorText = Color(0xFF881337);
  static const Color inputErrorFocus = Color(0xFFEF4444);

  // Scrim for property card image overlays
  static const Color imageScrimStart = Color(0xE6000000);
  static const Color imageScrimMid = Color(0x8C000000);

  static const ColorScheme colorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: emerald,
    onPrimary: onDark,
    primaryContainer: emeraldLight,
    onPrimaryContainer: brandPrimary,
    secondary: brandPrimary,
    onSecondary: onDark,
    secondaryContainer: accentSurface,
    onSecondaryContainer: brandPrimary,
    tertiary: charcoal,
    onTertiary: onDark,
    tertiaryContainer: charcoalSurface,
    onTertiaryContainer: onDark,
    error: criticalText,
    onError: onDark,
    errorContainer: criticalBg,
    onErrorContainer: criticalText,
    surface: surface,
    onSurface: foreground,
    surfaceContainerHighest: surfaceMuted,
    onSurfaceVariant: foregroundSecondary,
    outline: border,
    outlineVariant: borderSubtle,
    shadow: Color(0x1A000000),
    scrim: Color(0x99000000),
    inverseSurface: charcoal,
    onInverseSurface: onDark,
    inversePrimary: emeraldLight,
  );
}

/// Auth / onboarding palette. Deep Forest Green for CTAs & text links only.
/// Does not replace app-wide [AppColors.emerald] elsewhere.
abstract final class AuthColors {
  /// Deep Forest Green — primary buttons and auth text links.
  static const Color primary = Color(0xFF13674B);
  static const Color primaryHover = Color(0xFF0F553D);

  /// Soft light gray input fill (Tailwind bg-slate-50).
  static const Color inputFill = Color(0xFFF8FAFC);

  /// Medium gray for auth icons, form labels, and supporting text.
  static const Color mediumGray = Color(0xFF64748B);

  /// Text color inside input fields (slate-800).
  static const Color inputText = Color(0xFF1E293B);

  /// Placeholder text inside input fields (slate-400).
  static const Color inputHint = Color(0xFF94A3B8);

  /// Thin border color for social buttons and dividers (gray-200 / slate-200).
  static const Color borderLight = Color(0xFFE2E8F0);

  /// Welcome glass sheet scrim (~40% black).
  static const Color glassScrim = Color(0x66000000);

  /// Translucent dark overlay behind intro text on auth hero (~38% black).
  static const Color heroOverlay = Color(0x61000000);

  /// Accent for Forgot Password link in auth hero (Ilé emerald).
  static const Color forgotPassword = primary;
}

/// Afro-luxe guest surfaces. Gold is for verified marks and ratings only.
abstract final class EditorialColors {
  static const Color background = Color(0xFFFAF8F5);
  static const Color card = Color(0xFFFFFFFF);
  static const Color hairline = Color(0xFFEFECE6);
  static const Color brand = Color(0xFF073B2E);
  static const Color brandPressed = Color(0xFF05281F);
  static const Color gold = Color(0xFFD4AF37);
  /// Spec swatch `#78756E` is about 4.4:1 on alabaster. This deeper mute clears WCAG AA for 13px copy.
  static const Color inkMuted = Color(0xFF5C5952);
  static const Color ink = Color(0xFF1C1A17);
  static const Color glass = Color(0xD1FAF8F5);
  static const Color glassBorder = Color(0x99FFFFFF);
  static const Color heart = Color(0xFFE11D48);
  static const Color shimmerStart = Color(0xFFF3EFE6);
  static const Color shimmerMid = Color(0xFFFAF8F5);
  static const Color shimmerEnd = Color(0xFFEAE4D7);
  static const Color onBrand = Color(0xFFFAF8F5);
}
