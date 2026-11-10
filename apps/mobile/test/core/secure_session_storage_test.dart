import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ile_mobile/core/api/api_client.dart';
import 'package:ile_mobile/core/api/session_token_store.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('ApiClient persists session via token store', () async {
    final MemorySessionTokenStore store = MemorySessionTokenStore();
    final ApiClient client = ApiClient(
      client: MockClient((_) async => http.Response('{}', 200)),
      tokenStore: store,
    );

    await client.setToken('secure_token_abc');
    expect(await client.getToken(), 'secure_token_abc');
    await client.setToken(null);
    expect(await client.getToken(), isNull);
  });

  test('SecureSessionTokenStore migrates plaintext SharedPreferences token', () async {
    SharedPreferences.setMockInitialValues(<String, Object>{
      'ile_token': 'legacy_plain_token',
    });

    final MemorySessionTokenStore backend = MemorySessionTokenStore();
    final SecureSessionTokenStore store = SecureSessionTokenStore(
      secureBackend: backend,
    );

    expect(await store.read(), 'legacy_plain_token');
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('ile_token'), isNull);

    await store.write('next_token');
    expect(await store.read(), 'next_token');
  });
}
