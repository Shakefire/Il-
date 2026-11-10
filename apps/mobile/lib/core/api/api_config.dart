/// Backend base URL — same Fastify API the web app proxies via `next.config.mjs`.
///
/// Override at run time:
/// `flutter run --dart-define=API_BASE_URL=http://127.0.0.1:4000`
abstract final class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://il-production.up.railway.app',
  );

  static const Duration timeout = Duration(seconds: 20);
}
