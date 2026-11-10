import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'device_token_registrar.dart';
import 'ile_firebase_options.dart';

const String _prefsTokenKey = 'ile_fcm_token';
const String _prefsEnabledKey = 'ile_push_enabled';

/// Optional FCM wiring. Missing Firebase config → graceful no-op.
/// Permission is only requested from [enableAfterUserAction].
class PushMessagingService {
  PushMessagingService({
    required DeviceTokenRegistrar registrar,
    GlobalKey<ScaffoldMessengerState>? scaffoldMessengerKey,
  })  : _registrar = registrar,
        _scaffoldMessengerKey = scaffoldMessengerKey;

  final DeviceTokenRegistrar _registrar;
  final GlobalKey<ScaffoldMessengerState>? _scaffoldMessengerKey;

  bool _initialized = false;
  bool _firebaseReady = false;
  String? _currentToken;
  StreamSubscription<String>? _tokenRefreshSub;
  StreamSubscription<RemoteMessage>? _foregroundSub;

  bool get isFirebaseReady => _firebaseReady;
  bool get isConfigured => IleFirebaseOptions.isConfigured;
  String? get currentToken => _currentToken;

  /// Safe to call on cold start — never prompts for permission.
  Future<bool> initialize() async {
    if (_initialized) return _firebaseReady;
    _initialized = true;

    final FirebaseOptions? options = IleFirebaseOptions.currentPlatform();
    if (options == null) {
      IleFirebaseOptions.logSkipReason();
      return false;
    }

    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(options: options);
      }
      _firebaseReady = true;

      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final bool wasEnabled = prefs.getBool(_prefsEnabledKey) == true;
      if (wasEnabled) {
        await _attachListeners();
        await _syncTokenQuietly();
      }
      return true;
    } catch (err, stack) {
      debugPrint('[IlePush] Firebase init failed (no-op): $err');
      debugPrint('$stack');
      _firebaseReady = false;
      return false;
    }
  }

  /// User-gesture entry point (e.g. Notifications screen button).
  Future<PushEnableResult> enableAfterUserAction() async {
    if (!_firebaseReady) {
      final bool ready = await initialize();
      if (!ready) {
        return PushEnableResult.unavailable;
      }
    }

    try {
      final NotificationSettings settings =
          await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.denied) {
        return PushEnableResult.denied;
      }

      await FirebaseMessaging.instance
          .setForegroundNotificationPresentationOptions(
        alert: false,
        badge: true,
        sound: false,
      );

      await _attachListeners();
      final String? token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) {
        return PushEnableResult.noToken;
      }

      await _registerToken(token);
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_prefsEnabledKey, true);
      return PushEnableResult.enabled;
    } catch (err) {
      debugPrint('[IlePush] enable failed: $err');
      return PushEnableResult.failed;
    }
  }

  Future<void> clearOnLogout() async {
    final String? token = _currentToken ?? await _readStoredToken();
    if (token != null && token.isNotEmpty) {
      try {
        await _registrar.revoke(token);
      } catch (err) {
        debugPrint('[IlePush] revoke on logout failed: $err');
      }
    }
    if (_firebaseReady) {
      try {
        await FirebaseMessaging.instance.deleteToken();
      } catch (_) {}
    }
    _currentToken = null;
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.remove(_prefsTokenKey);
    await prefs.setBool(_prefsEnabledKey, false);
  }

  Future<void> dispose() async {
    await _tokenRefreshSub?.cancel();
    await _foregroundSub?.cancel();
  }

  Future<void> _attachListeners() async {
    _tokenRefreshSub ??=
        FirebaseMessaging.instance.onTokenRefresh.listen((String token) {
      unawaited(_registerToken(token));
    });

    // Foreground: show in-app snackbar only. System tray is reserved for
    // background/terminated so we never duplicate banners.
    _foregroundSub ??= FirebaseMessaging.onMessage.listen((RemoteMessage msg) {
      final String title = msg.notification?.title ??
          msg.data['title']?.toString() ??
          'Ilé';
      final String body = msg.notification?.body ??
          msg.data['body']?.toString() ??
          '';
      _scaffoldMessengerKey?.currentState?.showSnackBar(
        SnackBar(
          content: Text(body.isEmpty ? title : '$title — $body'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    });
  }

  Future<void> _syncTokenQuietly() async {
    try {
      final String? token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        await _registerToken(token);
      }
    } catch (err) {
      debugPrint('[IlePush] quiet token sync failed: $err');
    }
  }

  Future<void> _registerToken(String token) async {
    final String platform = _resolvePlatform();
    await _registrar.register(
      token: token,
      platform: platform,
      provider: 'fcm',
    );
    _currentToken = token;
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefsTokenKey, token);
  }

  Future<String?> _readStoredToken() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    return prefs.getString(_prefsTokenKey);
  }

  String _resolvePlatform() {
    if (kIsWeb) return 'web';
    if (defaultTargetPlatform == TargetPlatform.iOS) return 'ios';
    return 'android';
  }
}

enum PushEnableResult {
  enabled,
  denied,
  unavailable,
  noToken,
  failed,
}
