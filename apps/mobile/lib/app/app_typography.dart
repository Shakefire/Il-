import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Ilé typography — DM Serif Display + Plus Jakarta Sans.
/// Mobile sizes from `brand.md` §3.2.
/// Auth screens use [Auth] tokens only (Plus Jakarta Sans — no DM Serif).
abstract final class AppTypography {
  static const String displayFamily = 'DM Serif Display';
  static const String sansFamily = 'Plus Jakarta Sans';
  static const String authFamily = sansFamily;

  static const TextStyle display = TextStyle(
    fontFamily: displayFamily,
    fontWeight: FontWeight.w400,
    fontSize: 40,
    height: 1.1,
    letterSpacing: -0.8,
    color: AppColors.foreground,
  );

  static const TextStyle displayXl = TextStyle(
    fontFamily: displayFamily,
    fontWeight: FontWeight.w400,
    fontSize: 30,
    height: 1.15,
    letterSpacing: -0.6,
    color: AppColors.foreground,
  );

  static const TextStyle screenTitle = TextStyle(
    fontFamily: displayFamily,
    fontWeight: FontWeight.w400,
    fontSize: 24,
    height: 1.2,
    letterSpacing: -0.36,
    color: AppColors.foreground,
  );

  static const TextStyle sectionHeading = TextStyle(
    fontFamily: displayFamily,
    fontWeight: FontWeight.w400,
    fontSize: 24,
    height: 1.2,
    letterSpacing: -0.36,
    color: AppColors.foreground,
  );

  static const TextStyle cardTitle = TextStyle(
    fontFamily: sansFamily,
    fontWeight: FontWeight.w600,
    fontSize: 17,
    height: 1.3,
    letterSpacing: -0.17,
    color: AppColors.foreground,
  );

  static const TextStyle body = TextStyle(
    fontFamily: sansFamily,
    fontWeight: FontWeight.w400,
    fontSize: 15,
    height: 1.55,
    letterSpacing: 0,
    color: AppColors.foreground,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontFamily: sansFamily,
    fontWeight: FontWeight.w500,
    fontSize: 15,
    height: 1.55,
    letterSpacing: 0,
    color: AppColors.foreground,
  );

  static const TextStyle supporting = TextStyle(
    fontFamily: sansFamily,
    fontWeight: FontWeight.w400,
    fontSize: 13,
    height: 1.45,
    letterSpacing: 0,
    color: AppColors.foregroundSecondary,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: sansFamily,
    fontWeight: FontWeight.w400,
    fontSize: 12,
    height: 1.4,
    letterSpacing: 0,
    color: AppColors.foregroundMuted,
  );

  static const TextStyle button = TextStyle(
    fontFamily: sansFamily,
    fontWeight: FontWeight.w600,
    fontSize: 14,
    height: 1.2,
    letterSpacing: 0,
    color: AppColors.onDark,
  );

  static const TextStyle buttonSecondary = TextStyle(
    fontFamily: sansFamily,
    fontWeight: FontWeight.w500,
    fontSize: 14,
    height: 1.2,
    letterSpacing: 0,
    color: AppColors.textMuted,
  );

  static const TextStyle price = TextStyle(
    fontFamily: sansFamily,
    fontWeight: FontWeight.w700,
    fontSize: 18,
    height: 1.2,
    letterSpacing: -0.36,
    color: EditorialColors.brand,
  );

  static const TextStyle microLabel = TextStyle(
    fontFamily: sansFamily,
    fontWeight: FontWeight.w700,
    fontSize: 11,
    height: 1.2,
    letterSpacing: 0.55,
    color: AppColors.foreground,
  );

  static const TextStyle wordmark = TextStyle(
    fontFamily: displayFamily,
    fontWeight: FontWeight.w400,
    fontSize: 28,
    height: 1.1,
    letterSpacing: -0.5,
    color: AppColors.foreground,
  );

  static const TextStyle navLabel = TextStyle(
    fontFamily: sansFamily,
    fontWeight: FontWeight.w500,
    fontSize: 12,
    height: 1.2,
    letterSpacing: 0,
  );

  /// Named auth / onboarding type scale (Plus Jakarta Sans — no DM Serif).
  // ignore: constant_identifier_names
  static const AuthTypography Auth = AuthTypography._();

  static TextTheme textTheme = const TextTheme(
    displayLarge: display,
    displayMedium: displayXl,
    displaySmall: screenTitle,
    headlineLarge: sectionHeading,
    headlineMedium: sectionHeading,
    headlineSmall: cardTitle,
    titleLarge: cardTitle,
    titleMedium: bodyMedium,
    titleSmall: supporting,
    bodyLarge: body,
    bodyMedium: body,
    bodySmall: supporting,
    labelLarge: button,
    labelMedium: caption,
    labelSmall: microLabel,
  );
}

/// Auth screen type scale — access via [AppTypography.Auth] or this class.
class AuthTypography {
  const AuthTypography._();

  static const String _family = AppTypography.sansFamily;

  final TextStyle welcomeHeadline = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w700,
    fontSize: 28,
    height: 34 / 28,
    letterSpacing: -0.4,
    color: AppColors.onDark,
  );

  final TextStyle welcomeSupporting = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w400,
    fontSize: 14,
    height: 20 / 14,
    letterSpacing: 0,
    color: AppColors.onDark,
  );

  /// `text-sm font-bold` over auth hero (~14–15 px).
  final TextStyle overlayHeading = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w700,
    fontSize: 14.5,
    height: 1.15,
    letterSpacing: -0.25,
    color: AppColors.onDark,
  );

  /// Compact subtitle over auth hero (~8–9 px).
  final TextStyle overlaySupporting = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w400,
    fontSize: 8.5,
    height: 1.3,
    letterSpacing: 0,
    color: Color(0xEEFFFFFF),
  );

  /// Small form label (~9–10 px).
  final TextStyle formLabel = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w500,
    fontSize: 9.5,
    height: 1.2,
    letterSpacing: 0,
    color: AuthColors.mediumGray,
  );

  /// Compact input text (~10–12 px).
  final TextStyle input = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w500,
    fontSize: 11.0,
    height: 1.2,
    letterSpacing: 0,
    color: AuthColors.inputText,
  );

  final TextStyle inputHint = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w400,
    fontSize: 11.0,
    height: 1.2,
    letterSpacing: 0,
    color: AuthColors.inputHint,
  );

  /// Compact CTA button (~12 px).
  final TextStyle button = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w600,
    fontSize: 12.0,
    height: 1.2,
    letterSpacing: 0,
    color: AppColors.onDark,
  );

  /// Forgot Password text in Ilé emerald (~9 px).
  final TextStyle forgotPassword = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w600,
    fontSize: 9.0,
    height: 1.2,
    letterSpacing: 0,
    color: AuthColors.primary,
  );

  /// Compact OR divider text (~8–9 px).
  final TextStyle orDivider = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w500,
    fontSize: 8.5,
    height: 1.2,
    letterSpacing: 0.5,
    color: AuthColors.inputHint,
  );

  /// Compact bottom prompt text (~10 px).
  final TextStyle bottomNav = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w400,
    fontSize: 10.0,
    height: 1.25,
    letterSpacing: 0,
    color: AuthColors.mediumGray,
  );

  final TextStyle bottomNavLink = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w600,
    fontSize: 10.0,
    height: 1.25,
    letterSpacing: 0,
    color: AuthColors.primary,
  );

  /// Terms & Conditions text (~9 px).
  final TextStyle terms = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w400,
    fontSize: 9.0,
    height: 1.3,
    letterSpacing: 0,
    color: AuthColors.mediumGray,
  );

  final TextStyle termsLink = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w600,
    fontSize: 9.0,
    height: 1.3,
    letterSpacing: 0,
    color: AuthColors.primary,
  );

  final TextStyle otpTitle = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w600,
    fontSize: 22,
    height: 27 / 22,
    letterSpacing: -0.25,
    color: AppColors.foreground,
  );

  final TextStyle otpDescription = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w400,
    fontSize: 12,
    height: 15 / 12,
    letterSpacing: 0,
    color: AppColors.foregroundSecondary,
  );

  final TextStyle otpDigit = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w600,
    fontSize: 16,
    height: 20 / 16,
    letterSpacing: 0,
    color: AppColors.foreground,
  );

  final TextStyle otpCountdown = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w400,
    fontSize: 12,
    height: 15 / 12,
    letterSpacing: 0,
    color: AppColors.foreground,
  );

  final TextStyle otpResend = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w500,
    fontSize: 12,
    height: 15 / 12,
    letterSpacing: 0,
    color: AuthColors.primary,
    decoration: TextDecoration.underline,
    decorationColor: AuthColors.primary,
  );

  final TextStyle guestLink = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w500,
    fontSize: 14,
    height: 20 / 14,
    letterSpacing: 0,
    color: AppColors.onDark,
  );

  final TextStyle dialogTitle = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w600,
    fontSize: 16,
    height: 20 / 16,
    letterSpacing: -0.15,
    color: AppColors.foreground,
  );

  final TextStyle dialogBody = const TextStyle(
    fontFamily: _family,
    fontWeight: FontWeight.w400,
    fontSize: 12,
    height: 16 / 12,
    letterSpacing: 0,
    color: AppColors.foregroundSecondary,
  );
}
