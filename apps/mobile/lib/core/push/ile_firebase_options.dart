import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

/// Optional Firebase options from `--dart-define` values.
///
/// When any required key is missing, returns null and push stays a no-op.
/// Native `google-services.json` / `GoogleService-Info.plist` remain the
/// preferred console path; dart-defines cover CI and optional local runs.
class IleFirebaseOptions {
  const IleFirebaseOptions._();

  static const String _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const String _appId = String.fromEnvironment('FIREBASE_APP_ID');
  static const String _messagingSenderId =
      String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID');
  static const String _projectId =
      String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const String _storageBucket =
      String.fromEnvironment('FIREBASE_STORAGE_BUCKET');

  static bool get isConfigured =>
      _apiKey.isNotEmpty &&
      _appId.isNotEmpty &&
      _messagingSenderId.isNotEmpty &&
      _projectId.isNotEmpty;

  static FirebaseOptions? currentPlatform() {
    if (!isConfigured) return null;
    return FirebaseOptions(
      apiKey: _apiKey,
      appId: _appId,
      messagingSenderId: _messagingSenderId,
      projectId: _projectId,
      storageBucket:
          _storageBucket.isEmpty ? '$_projectId.appspot.com' : _storageBucket,
    );
  }

  static String describeMissing() {
    final List<String> missing = <String>[];
    if (_apiKey.isEmpty) missing.add('FIREBASE_API_KEY');
    if (_appId.isEmpty) missing.add('FIREBASE_APP_ID');
    if (_messagingSenderId.isEmpty) {
      missing.add('FIREBASE_MESSAGING_SENDER_ID');
    }
    if (_projectId.isEmpty) missing.add('FIREBASE_PROJECT_ID');
    return missing.join(', ');
  }

  static void logSkipReason() {
    debugPrint(
      '[IlePush] Firebase options missing (${describeMissing()}) — '
      'push SDK stays idle; inbox API still works.',
    );
  }
}
