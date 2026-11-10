import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ile_mobile/core/api/api_client.dart';
import 'package:ile_mobile/core/api/ile_api.dart';
import 'package:ile_mobile/core/api/session_token_store.dart';
import 'package:ile_mobile/core/push/device_token_registrar.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  test('register posts FCM token to devices API', () async {
    http.Request? captured;
    final IleApi api = IleApi(
      ApiClient(
        tokenStore: MemorySessionTokenStore(),
        client: MockClient((http.Request request) async {
          captured = request;
          expect(request.method, 'POST');
          expect(request.url.path, '/api/notifications/devices');
          return http.Response(
            jsonEncode(<String, dynamic>{
              'success': true,
              'device': <String, dynamic>{'id': 'dtoken_1'},
            }),
            201,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }),
      ),
    );

    final DeviceTokenRegistrar registrar = DeviceTokenRegistrar(api);
    await registrar.register(
      token: 'fcm_test_token_abcdefghijkl',
      platform: 'android',
      provider: 'fcm',
      appVersion: '1.0.0',
    );

    expect(captured, isNotNull);
    final Map<String, dynamic> body =
        jsonDecode(captured!.body) as Map<String, dynamic>;
    expect(body['token'], 'fcm_test_token_abcdefghijkl');
    expect(body['platform'], 'android');
    expect(body['provider'], 'fcm');
    expect(body['appVersion'], '1.0.0');
  });

  test('revoke deletes device token via devices API', () async {
    http.Request? captured;
    final IleApi api = IleApi(
      ApiClient(
        tokenStore: MemorySessionTokenStore(),
        client: MockClient((http.Request request) async {
          captured = request;
          expect(request.method, 'DELETE');
          expect(request.url.path, '/api/notifications/devices');
          return http.Response(
            jsonEncode(<String, dynamic>{'success': true}),
            200,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }),
      ),
    );

    final DeviceTokenRegistrar registrar = DeviceTokenRegistrar(api);
    await registrar.revoke('fcm_test_token_to_revoke_xyz');

    expect(captured, isNotNull);
    final Map<String, dynamic> body =
        jsonDecode(captured!.body) as Map<String, dynamic>;
    expect(body['token'], 'fcm_test_token_to_revoke_xyz');
  });
}
