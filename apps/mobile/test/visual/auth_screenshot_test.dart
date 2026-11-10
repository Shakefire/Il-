import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ile_mobile/app/app_theme.dart';
import 'package:ile_mobile/core/constants/app_assets.dart';
import 'package:ile_mobile/core/constants/app_routes.dart';
import 'package:ile_mobile/features/auth/login_screen.dart';
import 'package:ile_mobile/features/auth/otp_verification_screen.dart';
import 'package:ile_mobile/features/auth/register_screen.dart';

const Size _phone = Size(390, 844);

Future<void> _loadTestFonts() async {
  final fontLoader = FontLoader('Plus Jakarta Sans');
  final regular = File('assets/fonts/PlusJakartaSans-Regular.ttf').readAsBytesSync();
  final medium = File('assets/fonts/PlusJakartaSans-Medium.ttf').readAsBytesSync();
  final semiBold = File('assets/fonts/PlusJakartaSans-SemiBold.ttf').readAsBytesSync();
  final bold = File('assets/fonts/PlusJakartaSans-Bold.ttf').readAsBytesSync();

  fontLoader.addFont(Future.value(ByteData.view(regular.buffer)));
  fontLoader.addFont(Future.value(ByteData.view(medium.buffer)));
  fontLoader.addFont(Future.value(ByteData.view(semiBold.buffer)));
  fontLoader.addFont(Future.value(ByteData.view(bold.buffer)));
  await fontLoader.load();

  const iconPath = r'C:\src\flutter\bin\cache\artifacts\material_fonts\materialicons-regular.otf';
  if (File(iconPath).existsSync()) {
    final iconLoader = FontLoader('MaterialIcons');
    final iconBytes = File(iconPath).readAsBytesSync();
    iconLoader.addFont(Future.value(ByteData.view(iconBytes.buffer)));
    await iconLoader.load();
  }
}

Future<void> _capture(
  WidgetTester tester,
  String name,
  Widget child,
) async {
  final GlobalKey repaintKey = GlobalKey();
  await tester.binding.setSurfaceSize(_phone);
  tester.view.physicalSize = _phone;
  tester.view.devicePixelRatio = 1.0;

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      home: MediaQuery(
        data: const MediaQueryData(
          size: _phone,
          padding: EdgeInsets.only(top: 47, bottom: 34),
        ),
        child: RepaintBoundary(
          key: repaintKey,
          child: child,
        ),
      ),
    ),
  );

  await tester.runAsync(() async {
    final element = tester.element(find.byType(MaterialApp));
    await precacheImage(const AssetImage(AppAssets.authInterior), element);
  });
  await tester.pumpAndSettle();

  await tester.runAsync(() async {
    final RenderRepaintBoundary boundary = repaintKey.currentContext!
        .findRenderObject()! as RenderRepaintBoundary;
    final ui.Image image = await boundary.toImage(pixelRatio: 2);
    final ByteData? bytes =
        await image.toByteData(format: ui.ImageByteFormat.png);
    expect(bytes, isNotNull);

    final Directory out = Directory('build/auth_screenshots');
    if (!out.existsSync()) {
      out.createSync(recursive: true);
    }
    final File file = File('${out.path}/$name.png');
    await file.writeAsBytes(bytes!.buffer.asUint8List());
  });
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await _loadTestFonts();
  });

  testWidgets('capture auth screens for visual review', (tester) async {
    await _capture(tester, 'login', const LoginScreen());
    await _capture(tester, 'register', const RegisterScreen());
  });
}
