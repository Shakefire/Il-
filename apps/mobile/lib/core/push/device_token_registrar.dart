import '../api/ile_api.dart';

/// Thin client around `/api/notifications/devices` for FCM / web-push tokens.
/// Kept separate from Firebase so unit tests can mock registration without SDK.
class DeviceTokenRegistrar {
  DeviceTokenRegistrar(this._api);

  final IleApi _api;

  Future<void> register({
    required String token,
    required String platform,
    String provider = 'fcm',
    String? appVersion,
  }) async {
    await _api.registerDeviceToken(
      token: token,
      platform: platform,
      provider: provider,
      appVersion: appVersion,
    );
  }

  Future<void> revoke(String token) async {
    await _api.revokeDeviceToken(token);
  }
}
