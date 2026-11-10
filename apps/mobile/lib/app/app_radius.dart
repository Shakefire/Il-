import 'package:flutter/material.dart';

/// Border radius hierarchy from `brand.md` §4.2.
abstract final class AppRadius {
  static const double button = 8;
  static const double input = 8;
  static const double subtle = 10;
  static const double imageInner = 13;
  static const double panel = 16;
  static const double card = 18;
  static const double editorialCard = 24;
  static const double editorialImage = 18;
  static const double editorialSheet = 28;
  static const double pill = 9999;

  /// Auth form chrome (login / register card + compact controls).
  static const double authCard = 16;
  static const double authInput = 10;
  static const double authButton = 18;
  static const double authOverlay = 6;

  /// Welcome glass sheet — `rounded-[32px]`.
  static const double authWelcomeSheet = 32;

  static const BorderRadius buttonAll = BorderRadius.all(Radius.circular(button));
  static const BorderRadius inputAll = BorderRadius.all(Radius.circular(input));
  static const BorderRadius subtleAll = BorderRadius.all(Radius.circular(subtle));
  static const BorderRadius imageInnerAll =
      BorderRadius.all(Radius.circular(imageInner));
  static const BorderRadius panelAll = BorderRadius.all(Radius.circular(panel));
  static const BorderRadius cardAll = BorderRadius.all(Radius.circular(card));
  static const BorderRadius editorialCardAll =
      BorderRadius.all(Radius.circular(editorialCard));
  static const BorderRadius editorialImageAll =
      BorderRadius.all(Radius.circular(editorialImage));
  static const BorderRadius pillAll = BorderRadius.all(Radius.circular(pill));
  static const BorderRadius authCardAll =
      BorderRadius.all(Radius.circular(authCard));
  static const BorderRadius authInputAll =
      BorderRadius.all(Radius.circular(authInput));
  static const BorderRadius authButtonAll =
      BorderRadius.all(Radius.circular(authButton));
  static const BorderRadius authCardTop = BorderRadius.vertical(
    top: Radius.circular(authCard),
  );
  static const BorderRadius authWelcomeSheetTop = BorderRadius.vertical(
    top: Radius.circular(authWelcomeSheet),
  );
  static const BorderRadius authWelcomeSheetAll =
      BorderRadius.all(Radius.circular(authWelcomeSheet));
}
