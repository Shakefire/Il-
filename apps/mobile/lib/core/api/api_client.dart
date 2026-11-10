import 'dart:convert';

import 'package:http/http.dart' as http;

import 'api_config.dart';
import 'session_token_store.dart';

/// Thin HTTP client that hits the same backend contracts as `src/lib/api.ts`.
/// Session tokens are stored via [SessionTokenStore] (secure storage by default).
class ApiClient {
  ApiClient({
    http.Client? client,
    SessionTokenStore? tokenStore,
  })  : _client = client ?? http.Client(),
        _tokenStore = tokenStore ?? SecureSessionTokenStore();

  final http.Client _client;
  final SessionTokenStore _tokenStore;

  Future<String?> getToken() => _tokenStore.read();

  Future<void> setToken(String? token) => _tokenStore.write(token);

  Future<Map<String, String>> _headers({
    bool jsonBody = false,
    String? accessToken,
  }) async {
    final Map<String, String> headers = <String, String>{
      'Accept': 'application/json',
    };
    if (jsonBody) {
      headers['Content-Type'] = 'application/json';
    }
    final String? session = await getToken();
    if (session != null && session.isNotEmpty) {
      headers['Authorization'] = 'Bearer $session';
    }
    if (accessToken != null && accessToken.isNotEmpty) {
      headers['X-Access-Token'] = accessToken;
    }
    return headers;
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final String normalized = path.startsWith('/') ? path : '/$path';
    return Uri.parse('${ApiConfig.baseUrl}$normalized').replace(
      queryParameters: query == null || query.isEmpty ? null : query,
    );
  }

  Future<dynamic> get(
    String path, {
    Map<String, String>? query,
    String? accessToken,
  }) async {
    final http.Response response = await _client
        .get(
          _uri(path, query),
          headers: await _headers(accessToken: accessToken),
        )
        .timeout(ApiConfig.timeout);
    return _decode(response);
  }

  Future<dynamic> post(
    String path, {
    Object? body,
    String? accessToken,
  }) async {
    final http.Response response = await _client
        .post(
          _uri(path),
          headers: await _headers(jsonBody: true, accessToken: accessToken),
          body: body == null ? null : jsonEncode(body),
        )
        .timeout(ApiConfig.timeout);
    return _decode(response);
  }

  Future<dynamic> put(
    String path, {
    Object? body,
    String? accessToken,
  }) async {
    final http.Response response = await _client
        .put(
          _uri(path),
          headers: await _headers(jsonBody: true, accessToken: accessToken),
          body: body == null ? null : jsonEncode(body),
        )
        .timeout(ApiConfig.timeout);
    return _decode(response);
  }

  Future<dynamic> patch(
    String path, {
    Object? body,
    String? accessToken,
  }) async {
    final http.Response response = await _client
        .patch(
          _uri(path),
          headers: await _headers(jsonBody: true, accessToken: accessToken),
          body: body == null ? null : jsonEncode(body),
        )
        .timeout(ApiConfig.timeout);
    return _decode(response);
  }

  Future<dynamic> delete(
    String path, {
    Object? body,
    String? accessToken,
  }) async {
    final http.Request request = http.Request('DELETE', _uri(path));
    request.headers.addAll(
      await _headers(jsonBody: body != null, accessToken: accessToken),
    );
    if (body != null) {
      request.body = jsonEncode(body);
    }
    final http.StreamedResponse streamed =
        await _client.send(request).timeout(ApiConfig.timeout);
    final http.Response response = await http.Response.fromStream(streamed);
    return _decode(response);
  }

  dynamic _decode(http.Response response) {
    final dynamic body = response.body.isEmpty
        ? <String, dynamic>{}
        : jsonDecode(response.body);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return body;
    }
    final String message = body is Map && body['error'] is String
        ? body['error'] as String
        : 'Request failed (${response.statusCode})';
    throw ApiException(
      message: message,
      statusCode: response.statusCode,
      body: body,
    );
  }

  void dispose() => _client.close();
}

class ApiException implements Exception {
  ApiException({
    required this.message,
    required this.statusCode,
    this.body,
  });

  final String message;
  final int statusCode;
  final dynamic body;

  @override
  String toString() => message;
}
