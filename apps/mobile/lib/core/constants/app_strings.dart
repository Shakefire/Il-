/// Centralized UI copy for guest auth / onboarding and placeholders.
abstract final class AppStrings {
  static const String brandName = 'Ilé';
  static const String brandTagline =
      'Boutique stays & architectural havens in Nigeria';

  // Welcome
  static const String welcomeHeadline = 'Ilé';
  static const String welcomeSupporting =
      'Boutique stays across Abuja, Lagos, and Nigeria — power-ready homes you can trust.';
  static const String getStarted = 'Sign in';
  static const String continueAsGuest = 'Browse stays';

  // Auth shared
  static const String authGreeting = 'Welcome back';
  static const String authSupporting =
      'Sign in to manage booking requests, payments, and confirmed stays.';
  static const String authSupportingRegister =
      'Create an account to request stays and save favourites.';
  static const String emailLabel = 'Email';
  static const String emailHint = 'you@email.com';
  static const String passwordLabel = 'Password';
  static const String passwordHint = '••••••••••••••••';
  static const String fullNameLabel = 'Full name';
  static const String fullNameHint = 'Adaeze Okonkwo';
  static const String orDivider = 'OR';
  static const String signIn = 'Sign in';
  static const String signUp = 'Create account';
  static const String forgotPassword = 'Forgot password?';
  static const String dontHaveAccount = "Don't have an account?";
  static const String alreadyHaveAccount = 'Already have an account?';
  static const String termsAgreementPrefix = 'I agree to the ';
  static const String termsLink = 'Terms of Service';
  static const String termsAgreementMiddle = ' and ';
  static const String privacyLink = 'Privacy Policy';
  static const String termsAgreementSuffix = '';

  // OTP (email verification — 6 digits from backend)
  static const String otpTitle = 'Enter verification code';
  static const String otpBodyPrefix =
      "Check your email. We've sent a 6-digit code to ";
  static const String otpBodySuffix =
      '. Enter it below to verify your account.';
  static const String otpResendCountdownPrefix = 'You can resend the code in ';
  static const String otpResendCountdownSuffix = ' seconds';
  static const String otpResend = 'Resend code';
  static const String otpInvalid = 'Incorrect code. Please try again.';
  static const String otpVerifying = 'Verifying code…';
  static const int otpLength = 6;
  static const int otpResendSeconds = 60;

  // Forgot / reset
  static const String forgotTitle = 'Forgot password';
  static const String forgotSupporting =
      'Enter your email address and we will send a reset link.';
  static const String sendResetLink = 'Send reset link';
  static const String forgotSuccessTitle = 'Reset link sent';
  static const String forgotSuccessBody =
      'If an account exists for that address, you will receive reset instructions shortly.';
  static const String resetTitle = 'Set new password';
  static const String resetSupporting =
      'Choose a strong password with at least 8 characters.';
  static const String newPasswordLabel = 'New password';
  static const String confirmPasswordLabel = 'Confirm password';
  static const String updatePassword = 'Update password';
  static const String resetSuccessTitle = 'Password updated';
  static const String resetSuccessBody =
      'Your password has been changed. Please sign in with your new credentials.';
  static const String doneLabel = 'Done';
  static const String passwordRequirement =
      'Must be at least 8 characters with letters and numbers.';
  static const String saveNewPassword = 'Save new password';
  static const String backToLogin = 'Back to sign in';

  // Success dialogs
  static const String loginSuccessTitle = 'Welcome back';
  static const String loginSuccessBody =
      'You are signed in to Ilé.';
  static const String registerSuccessTitle = 'Registration complete';
  static const String registerSuccessBody =
      'Your email is verified. Welcome to Ilé!';
  static const String continueLabel = 'Continue';

  // Form errors & validation
  static const String validationRequired = 'This field is required.';
  static const String validationEmail = 'Enter a valid email address.';
  static const String validationPasswordShort =
      'Password must be at least 8 characters.';
  static const String validationPasswordWeak =
      'Must include at least 1 letter and 1 number.';
  static const String validationNameShort =
      'Name must be at least 2 characters.';
  static const String validationPasswordMismatch = 'Passwords do not match.';
  static const String validationTerms =
      'You must accept the terms to continue.';
  static const String errRequiredField = 'This field is required';
  static const String errInvalidEmail = 'Enter a valid email address';
  static const String errPasswordLength =
      'Password must be at least 8 characters';
  static const String errNameLength = 'Enter your first and last name';
  static const String errTermsRequired = 'Please accept the terms to continue';
  static const String errPasswordMismatch = 'Passwords do not match';

  // Design system preview
  static const String designSystemTitle = 'Design system tokens';
  static const String designSystemSubtitle =
      'Living styleguide reference for mobile screens.';
}
