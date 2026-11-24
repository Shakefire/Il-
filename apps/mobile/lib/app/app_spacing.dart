/// Ilé 4px sub-grid / 8px primary rhythm (`brand.md` §4.1).
abstract final class AppSpacing {
  static const double xxs = 4;
  static const double xs = 8;
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 20;
  static const double xl = 24;
  static const double xxl = 32;
  static const double xxxl = 48;
  static const double section = 64;

  /// Minimum interactive touch target (WCAG / Ilé button height).
  static const double touchTarget = 44;

  static const double buttonHorizontal = 24;
  static const double buttonHorizontalSecondary = 20;
  static const double inputHorizontal = 14;
  static const double cardPadding = 14;
  static const double screenHorizontal = 20;
  static const double dockHeight = 68;
  static const double dockRadius = 34;
  static const double dockMarginH = 16;
  static const double dockMarginBottom = 16;
  /// Feed clearance above Map pill + dock (Style 1).
  static const double exploreFeedBottom = 120;
  /// Viewport-locked Map pill from bottom edge.
  static const double mapPillBottom = 96;
  static const double mapPillHeight = 42;
  static const double categoryPillHeight = 38;
  static const double topNavHeight = 60;
  static const double searchBarHeight = 54;
  static const double guestGateIcon = 64;
  static const double guestCtaHeight = 50;

  /// Compact auth form metrics (login / register / OTP).
  static const double authInputHeight = 35;
  static const double authButtonHeight = 35;
  static const double authCardHorizontal = 20;
  static const double authCardVertical = 15;
  static const double authCardBottom = 22;
  static const double authFieldGap = 7;
  static const double authLabelGap = 3;
  static const double authSectionGap = 8;
  static const double authSocialSize = 31;
  static const double authSocialIconSize = 14;
  static const double authFieldIconSize = 15;
  static const double authCardTopFractionLogin = 0.38;
  static const double authCardTopFractionSignup = 0.35;
  static const double authOverlayGap = 20;
  static const double authOtpDiameter = 45;
  static const double authOtpGap = 10;
  static const double authBackSize = 40;
}
