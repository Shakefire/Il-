import '../constants/app_strings.dart';

/// Local form validators for mock auth screens (no backend).
abstract final class Validators {
  static final RegExp _emailPattern = RegExp(
    r'^[^\s@]+@[^\s@]+\.[^\s@]+$',
  );
  static final RegExp _hasLetter = RegExp(r'[A-Za-z]');
  static final RegExp _hasDigit = RegExp(r'\d');

  static String? validateEmail(String? value) {
    final String trimmed = (value ?? '').trim();
    if (trimmed.isEmpty) {
      return AppStrings.validationRequired;
    }
    if (!_emailPattern.hasMatch(trimmed)) {
      return AppStrings.validationEmail;
    }
    return null;
  }

  static String? validatePassword(String? value) {
    final String text = value ?? '';
    if (text.isEmpty) {
      return AppStrings.validationRequired;
    }
    if (text.length < 8) {
      return AppStrings.validationPasswordShort;
    }
    if (!_hasLetter.hasMatch(text) || !_hasDigit.hasMatch(text)) {
      return AppStrings.validationPasswordWeak;
    }
    return null;
  }

  static String? validateFullName(String? value) {
    final String trimmed = (value ?? '').trim();
    if (trimmed.length < 2) {
      return AppStrings.validationNameShort;
    }
    return null;
  }

  static String? validateConfirmPassword({
    required String? password,
    required String? confirm,
  }) {
    final String? base = validatePassword(confirm);
    if (base != null) {
      return base;
    }
    if (password != confirm) {
      return AppStrings.validationPasswordMismatch;
    }
    return null;
  }

  static String? validateTermsAccepted(bool isAccepted) {
    if (!isAccepted) {
      return AppStrings.validationTerms;
    }
    return null;
  }
}
