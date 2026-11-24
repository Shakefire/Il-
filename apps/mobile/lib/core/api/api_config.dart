import 'package:flutter/foundation.dart';

/// Backend base URL — same Fastify API the web app proxies via `next.config.mjs`.
///
/// Override at run time:
/// `flutter run --dart-define=API_BASE_URL=http://127.0.0.1:4000`
abstract final class ApiConfig {
  static const String _envUrl = String.fromEnvironment('API_BASE_URL');

  static String get baseUrl {
    if (_envUrl.isNotEmpty) return _envUrl;
    if (kIsWeb) {
      // In Flutter Web development mode, route through the local CORS proxy to avoid browser CORS blocks
      return 'http://127.0.0.1:4000';
    }
    return 'https://il-production.up.railway.app';
  }

  static const Duration timeout = Duration(seconds: 20);
}
