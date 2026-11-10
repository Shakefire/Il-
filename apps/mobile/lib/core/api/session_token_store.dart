import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Session token persistence — secure storage with one-time prefs migration.
abstract class SessionTokenStore {
  Future<String?> read();
  Future<void> write(String? token);
}

class SecureSessionTokenStore implements SessionTokenStore {
  SecureSessionTokenStore({
    FlutterSecureStorage? secureStorage,
    SessionTokenStore? secureBackend,
  }) : _secureBackend = secureBackend,
       _secureStorage = secureStorage ??
           (secureBackend == null
               ? const FlutterSecureStorage(aOptions: AndroidOptions())
               : null);

  final FlutterSecureStorage? _secureStorage;
  final SessionTokenStore? _secureBackend;
  static const String tokenKey = 'ile_token';
  bool _migratedLegacyToken = false;

  Future<String?> _secureRead() async {
    if (_secureBackend != null) return _secureBackend.read();
    return _secureStorage!.read(key: tokenKey);
  }

  Future<void> _secureWrite(String? token) async {
    if (_secureBackend != null) {
      await _secureBackend.write(token);
      return;
    }
    if (token == null || token.isEmpty) {
      await _secureStorage!.delete(key: tokenKey);
      return;
    }
    await _secureStorage!.write(key: tokenKey, value: token);
  }

  @override
  Future<String?> read() async {
    await _migrateLegacyPlaintextToken();
    return _secureRead();
  }

  @override
  Future<void> write(String? token) async {
    await _migrateLegacyPlaintextToken();
    await _secureWrite(token);
  }

  Future<void> _migrateLegacyPlaintextToken() async {
    if (_migratedLegacyToken) return;
    _migratedLegacyToken = true;
    try {
      final SharedPreferences prefs = await SharedPreferences.getInstance();
      final String? legacy = prefs.getString(tokenKey);
      if (legacy == null || legacy.isEmpty) return;
      final String? existing = await _secureRead();
      if (existing == null || existing.isEmpty) {
        await _secureWrite(legacy);
      }
      await prefs.remove(tokenKey);
    } catch (_) {
      // Best-effort migration.
    }
  }
}

/// In-memory store for unit tests.
class MemorySessionTokenStore implements SessionTokenStore {
  String? _token;

  @override
  Future<String?> read() async => _token;

  @override
  Future<void> write(String? token) async {
    _token = (token == null || token.isEmpty) ? null : token;
  }
}
