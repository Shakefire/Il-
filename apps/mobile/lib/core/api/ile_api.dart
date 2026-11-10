import '../models/booking.dart';
import '../models/location_result.dart';
import '../models/property.dart';
import '../models/search_response.dart';
import 'api_client.dart';

/// Marketplace API surface — mirrors web `src/lib/api.ts` guest endpoints.
class IleApi {
  IleApi(this._client);

  final ApiClient _client;

  Future<List<LocationResult>> searchLocations(String query) async {
    final dynamic body = await _client.get(
      '/api/locations/search',
      query: <String, String>{'q': query},
    );
    if (body is! Map || body['success'] != true) {
      return const <LocationResult>[];
    }
    final List<dynamic> data = (body['data'] as List<dynamic>?) ?? <dynamic>[];
    return data
        .whereType<Map<String, dynamic>>()
        .map(LocationResult.fromJson)
        .toList();
  }

  Future<SearchResponse> search({
    String? location,
    double? lat,
    double? lng,
    double? radius,
    String? checkIn,
    String? checkOut,
    int? guests,
    String? type,
    int? bedrooms,
    int? bathrooms,
    int? minPrice,
    int? maxPrice,
    String? powerType,
    String? amenities,
    String sort = 'relevance',
    int page = 1,
    int limit = 20,
  }) async {
    final Map<String, String> query = <String, String>{
      'page': '$page',
      'limit': '$limit',
    };
    if (location != null && location.isNotEmpty) {
      query['location'] = location;
    }
    if (lat != null) query['lat'] = '$lat';
    if (lng != null) query['lng'] = '$lng';
    if (radius != null) query['radius'] = '$radius';
    if (checkIn != null && checkIn.isNotEmpty) query['checkIn'] = checkIn;
    if (checkOut != null && checkOut.isNotEmpty) query['checkOut'] = checkOut;
    if (guests != null) query['guests'] = '$guests';
    if (type != null && type.isNotEmpty && type != 'All Types') {
      query['type'] = type;
    }
    if (bedrooms != null) query['bedrooms'] = '$bedrooms';
    if (minPrice != null) query['minPrice'] = '$minPrice';
    if (maxPrice != null) query['maxPrice'] = '$maxPrice';
    if (powerType != null && powerType.isNotEmpty) {
      query['powerType'] = powerType;
    }
    if (amenities != null && amenities.isNotEmpty) {
      query['amenities'] = amenities;
    }
    // sort is applied client-side when backend lacks a sort param
    final dynamic body = await _client.get('/api/search', query: query);
    final SearchResponse response = SearchResponse.fromJson(
      body as Map<String, dynamic>,
    );
    return SearchResponse(
      properties: _sortProperties(response.properties, sort),
      pagination: response.pagination,
      location: response.location,
      resolvedDisplay: response.resolvedDisplay,
    );
  }

  List<IleProperty> _sortProperties(List<IleProperty> input, String sort) {
    final List<IleProperty> copy = List<IleProperty>.from(input);
    switch (sort) {
      case 'price_asc':
        copy.sort(
          (IleProperty a, IleProperty b) =>
              a.pricePerNight.compareTo(b.pricePerNight),
        );
      case 'price_desc':
        copy.sort(
          (IleProperty a, IleProperty b) =>
              b.pricePerNight.compareTo(a.pricePerNight),
        );
      case 'rating':
        copy.sort(
          (IleProperty a, IleProperty b) => b.rating.compareTo(a.rating),
        );
      default:
        break;
    }
    return copy;
  }

  Future<List<IleProperty>> getPublishedProperties({
    int page = 1,
    int limit = 20,
  }) async {
    final int offset = (page - 1) * limit;
    final dynamic body = await _client.get(
      '/api/properties',
      query: <String, String>{
        'limit': '$limit',
        'offset': '$offset',
        'page': '$page',
      },
    );
    final List<dynamic> raw =
        (body is Map ? body['properties'] as List<dynamic>? : null) ??
        <dynamic>[];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(IleProperty.fromJson)
        .toList();
  }

  Future<IleProperty?> getProperty(String slug) async {
    try {
      final dynamic body = await _client.get('/api/properties/$slug');
      if (body is Map && body['property'] is Map<String, dynamic>) {
        return IleProperty.fromJson(body['property'] as Map<String, dynamic>);
      }
      return null;
    } on ApiException catch (err) {
      if (err.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<Map<String, dynamic>> checkAvailability({
    required String propertyId,
    required String checkIn,
    required String checkOut,
  }) async {
    final dynamic body = await _client.get(
      '/api/bookings/availability',
      query: <String, String>{
        'propertyId': propertyId,
        'checkIn': checkIn,
        'checkOut': checkOut,
      },
    );
    return body is Map<String, dynamic>
        ? body
        : <String, dynamic>{'available': false};
  }

  Future<IleBooking> createBooking({
    required String propertyId,
    required String guestFirstName,
    required String guestLastName,
    required String guestEmail,
    required String guestPhone,
    required int guestCount,
    required String checkInDate,
    required String checkOutDate,
  }) async {
    final dynamic body = await _client.post(
      '/api/bookings',
      body: <String, dynamic>{
        'propertyId': propertyId,
        'guestFirstName': guestFirstName,
        'guestLastName': guestLastName,
        'guestEmail': guestEmail,
        'guestPhone': guestPhone,
        'guestCount': guestCount,
        'checkInDate': checkInDate,
        'checkOutDate': checkOutDate,
      },
    );
    return _bookingFromEnvelope(body);
  }

  Future<List<IleBooking>> getUserBookings() async {
    final dynamic body = await _client.get('/api/bookings');
    final List<dynamic> raw = body is Map
        ? (body['bookings'] as List<dynamic>? ??
              body['data'] as List<dynamic>? ??
              <dynamic>[])
        : <dynamic>[];
    return raw
        .whereType<Map<String, dynamic>>()
        .map(IleBooking.fromJson)
        .toList();
  }

  Future<IleBooking> getBooking(String id, {String? accessToken}) async {
    final dynamic body = await _client.get(
      '/api/bookings/$id',
      accessToken: accessToken,
    );
    return _bookingFromEnvelope(body, fallbackAccessToken: accessToken);
  }

  /// Refresh status from backend SoT — never recreates a booking.
  Future<IleBooking> refreshBookingStatus(String id, {String? accessToken}) =>
      getBooking(id, accessToken: accessToken);

  /// Guest confirms arrival (Phase 7). Idempotent.
  Future<IleBooking> confirmCheckIn({
    required String bookingId,
    String? accessToken,
  }) async {
    final dynamic body = await _client.post(
      '/api/bookings/$bookingId/confirm-check-in',
      body: <String, dynamic>{
        if (accessToken != null && accessToken.isNotEmpty)
          'accessToken': accessToken,
      },
      accessToken: accessToken,
    );
    return _bookingFromEnvelope(body, fallbackAccessToken: accessToken);
  }

  /// Host wallet projection from payouts (no separate balance table).
  Future<Map<String, dynamic>> getHostWallet() async {
    final dynamic body = await _client.get('/api/host/wallet');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> requestHostWithdrawal({int? amountNaira}) async {
    final dynamic body = await _client.post(
      '/api/host/wallet/withdraw',
      body: <String, dynamic>{
        'amountNaira': ?amountNaira,
      },
    );
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> getHostDashboard() async {
    final dynamic body = await _client.get('/api/host/dashboard');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> getHostProfile() async {
    final dynamic body = await _client.get('/api/host/profile');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> getHostOnboardingStatus() async {
    final dynamic body = await _client.get('/api/host/onboarding/status');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> updateHostOnboardingProfile(
    Map<String, dynamic> data,
  ) async {
    final dynamic body =
        await _client.put('/api/host/onboarding/profile', body: data);
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> updateHostOnboardingIdentity(
    Map<String, dynamic> data,
  ) async {
    final dynamic body =
        await _client.put('/api/host/onboarding/identity', body: data);
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> updateHostOnboardingAuthority(
    Map<String, dynamic> data,
  ) async {
    final dynamic body =
        await _client.put('/api/host/onboarding/authority', body: data);
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> saveHostOnboardingPropertyDraft(
    Map<String, dynamic> data,
  ) async {
    final dynamic body =
        await _client.put('/api/host/onboarding/property-draft', body: data);
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> submitHostOnboarding() async {
    final dynamic body = await _client.post('/api/host/onboarding/submit');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> updateHostProfile(Map<String, dynamic> data) async {
    final dynamic body = await _client.put('/api/host/profile', body: data);
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<List<Map<String, dynamic>>> getHostProperties() async {
    final dynamic body = await _client.get('/api/host/properties');
    if (body is List) {
      return body.whereType<Map>().map((Map e) => Map<String, dynamic>.from(e)).toList();
    }
    if (body is Map && body['properties'] is List) {
      return (body['properties'] as List)
          .whereType<Map>()
          .map((Map e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return <Map<String, dynamic>>[];
  }

  Future<Map<String, dynamic>> getHostProperty(String id) async {
    final dynamic body = await _client.get('/api/host/properties/$id');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> createHostProperty(Map<String, dynamic> data) async {
    final dynamic body = await _client.post('/api/host/properties', body: data);
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> updateHostProperty(
    String id,
    Map<String, dynamic> data,
  ) async {
    final dynamic body = await _client.put('/api/host/properties/$id', body: data);
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> publishHostProperty(String id) async {
    final dynamic body = await _client.post('/api/host/properties/$id/publish');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> submitHostProperty(String id) async {
    final dynamic body = await _client.post('/api/host/properties/$id/submit');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> unpublishHostProperty(String id) async {
    final dynamic body = await _client.post('/api/host/properties/$id/unpublish');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> relistHostProperty(String id) async {
    final dynamic body = await _client.post('/api/host/properties/$id/relist');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  /// Upload base64 image via Fastify uploads (R2 or local). Returns `{ url, storageKey }`.
  Future<Map<String, dynamic>> uploadImage({
    required String base64DataUriOrRaw,
    String folder = 'listings',
    String? propertyId,
    String? mimeType,
  }) async {
    final dynamic body = await _client.post(
      '/api/uploads',
      body: <String, dynamic>{
        'image': base64DataUriOrRaw,
        'folder': folder,
        if (propertyId != null) 'propertyId': propertyId,
        if (mimeType != null) 'mimeType': mimeType,
      },
    );
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<List<Map<String, dynamic>>> getNigerianBanks() async {
    final dynamic body = await _client.get('/api/banks');
    final List<dynamic> raw = body is Map
        ? (body['banks'] as List<dynamic>? ?? <dynamic>[])
        : <dynamic>[];
    return raw
        .whereType<Map>()
        .map((Map e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getHostPayouts() async {
    final dynamic body = await _client.get('/api/host/payouts');
    final List<dynamic> raw = body is Map
        ? (body['payouts'] as List<dynamic>? ?? <dynamic>[])
        : <dynamic>[];
    return raw
        .whereType<Map>()
        .map((Map e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<Map<String, dynamic>> archiveHostProperty(
    String id, {
    bool confirm = false,
  }) async {
    final String qs = confirm ? '?confirm=true&mode=archive' : '?mode=archive';
    final dynamic body = await _client.delete('/api/host/properties/$id$qs');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> reorderHostPropertyMedia({
    required String propertyId,
    required List<String> orderedImageIds,
    String? coverImageId,
  }) async {
    final dynamic body = await _client.put(
      '/api/host/properties/$propertyId/media-order',
      body: <String, dynamic>{
        'orderedImageIds': orderedImageIds,
        if (coverImageId != null) 'coverImageId': coverImageId,
      },
    );
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<List<Map<String, dynamic>>> getHostBookings() async {
    final dynamic body = await _client.get('/api/host/bookings');
    if (body is Map && body['bookings'] is List) {
      return (body['bookings'] as List)
          .whereType<Map>()
          .map((Map e) => Map<String, dynamic>.from(e))
          .toList();
    }
    return <Map<String, dynamic>>[];
  }

  Future<Map<String, dynamic>> acceptHostBooking(String bookingId) async {
    final dynamic body = await _client.post('/api/bookings/$bookingId/accept');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> declineHostBooking(String bookingId) async {
    final dynamic body = await _client.post('/api/bookings/$bookingId/decline');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> getHostPropertyAvailability(String propertyId) async {
    final dynamic body =
        await _client.get('/api/host/properties/$propertyId/availability');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> blockHostPropertyDates({
    required String propertyId,
    required String startDate,
    required String endDate,
    String? notes,
  }) async {
    final dynamic body = await _client.post(
      '/api/host/properties/$propertyId/availability/block',
      body: <String, dynamic>{
        'startDate': startDate,
        'endDate': endDate,
        if (notes != null) 'notes': notes,
      },
    );
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> unblockHostPropertyDates({
    required String propertyId,
    required String blockId,
  }) async {
    final dynamic body = await _client.delete(
      '/api/host/properties/$propertyId/availability/block/$blockId',
    );
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> getHostPayoutAccount() async {
    final dynamic body = await _client.get('/api/host/payout-account');
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  Future<Map<String, dynamic>> updateHostPayoutAccount({
    required String bankCode,
    required String accountNumber,
  }) async {
    final dynamic body = await _client.put(
      '/api/host/payout-account',
      body: <String, dynamic>{
        'bankCode': bankCode,
        'accountNumber': accountNumber,
      },
    );
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{};
  }

  /// Guest cancel unpaid holds — CONFIRMED → REFUND_REQUIRED (admin only).
  Future<IleBooking> cancelBooking({
    required String bookingId,
    String? accessToken,
    String? reason,
  }) async {
    final dynamic body = await _client.post(
      '/api/bookings/$bookingId/cancel',
      body: <String, dynamic>{
        if (accessToken != null && accessToken.isNotEmpty)
          'accessToken': accessToken,
        if (reason != null && reason.isNotEmpty) 'reason': reason,
      },
      accessToken: accessToken,
    );
    return _bookingFromEnvelope(body, fallbackAccessToken: accessToken);
  }

  /// Similar stays after decline/expire. Never auto-books or charges.
  Future<Map<String, dynamic>> getSimilarProperties(
    String bookingId, {
    int limit = 8,
  }) async {
    final dynamic body = await _client.get(
      '/api/bookings/$bookingId/similar?limit=$limit',
    );
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{'properties': <dynamic>[], 'autoBook': false};
  }

  Future<Map<String, dynamic>?> getCurrentUser() async {
    try {
      final dynamic body = await _client.get('/api/auth/me');
      if (body is Map && body['user'] is Map<String, dynamic>) {
        return body['user'] as Map<String, dynamic>;
      }
      return null;
    } on ApiException catch (err) {
      if (err.statusCode == 401) return null;
      rethrow;
    }
  }

  Future<Map<String, dynamic>> registerGuest({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    String? phone,
  }) async {
    final dynamic body = await _client.post(
      '/api/auth/register',
      body: <String, dynamic>{
        'firstName': firstName,
        'lastName': lastName,
        'email': email,
        'password': password,
        if (phone != null && phone.isNotEmpty) 'phone': phone,
      },
    );
    return body is Map<String, dynamic>
        ? body
        : <String, dynamic>{'success': true};
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final dynamic body = await _client.post(
      '/api/auth/login',
      body: <String, dynamic>{'email': email, 'password': password},
    );
    if (body is Map && body['token'] is String) {
      await _client.setToken(body['token'] as String);
    }
    return body is Map<String, dynamic>
        ? body
        : <String, dynamic>{'success': true};
  }

  Future<Map<String, dynamic>> verifyEmail({
    required String email,
    required String code,
  }) async {
    final dynamic body = await _client.post(
      '/api/auth/verify-email',
      body: <String, dynamic>{'email': email, 'code': code},
    );
    if (body is Map && body['token'] is String) {
      await _client.setToken(body['token'] as String);
    }
    return body is Map<String, dynamic>
        ? body
        : <String, dynamic>{'success': true};
  }

  Future<Map<String, dynamic>> resendEmailOtp({required String email}) async {
    final dynamic body = await _client.post(
      '/api/auth/resend-email-otp',
      body: <String, dynamic>{'email': email},
    );
    return body is Map<String, dynamic>
        ? body
        : <String, dynamic>{'success': true};
  }

  Future<Map<String, dynamic>> forgotPassword({required String email}) async {
    final dynamic body = await _client.post(
      '/api/auth/forgot-password',
      body: <String, dynamic>{'email': email},
    );
    return body is Map<String, dynamic>
        ? body
        : <String, dynamic>{'success': true};
  }

  Future<Map<String, dynamic>> resetPassword({
    required String token,
    required String password,
  }) async {
    final dynamic body = await _client.post(
      '/api/auth/reset-password',
      body: <String, dynamic>{'token': token, 'password': password},
    );
    return body is Map<String, dynamic>
        ? body
        : <String, dynamic>{'success': true};
  }

  Future<Map<String, dynamic>> updateProfile({
    String? firstName,
    String? lastName,
    String? phone,
  }) async {
    final dynamic body = await _client.patch(
      '/api/auth/profile',
      body: <String, dynamic>{
        if (firstName != null) 'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
        if (phone != null) 'phone': phone,
      },
    );
    return body is Map<String, dynamic>
        ? body
        : <String, dynamic>{'success': true};
  }

  Future<void> logout() async {
    try {
      await _client.post('/api/auth/logout');
    } catch (_) {
      // Local session clear still proceeds.
    }
    await _client.setToken(null);
  }

  Future<Map<String, dynamic>> getNotifications({
    int limit = 30,
    bool unreadOnly = false,
  }) async {
    final dynamic body = await _client.get(
      '/api/notifications',
      query: <String, String>{
        'limit': '$limit',
        if (unreadOnly) 'unreadOnly': 'true',
      },
    );
    return body is Map<String, dynamic>
        ? body
        : <String, dynamic>{
            'notifications': <dynamic>[],
            'unreadCount': 0,
          };
  }

  Future<void> markNotificationRead(String id) async {
    await _client.post('/api/notifications/$id/read');
  }

  Future<void> markAllNotificationsRead() async {
    await _client.post('/api/notifications/read-all');
  }

  Future<void> registerDeviceToken({
    required String token,
    required String platform,
    String provider = 'fcm',
    String? appVersion,
  }) async {
    await _client.post(
      '/api/notifications/devices',
      body: <String, dynamic>{
        'token': token,
        'platform': platform,
        'provider': provider,
        if (appVersion != null) 'appVersion': appVersion,
      },
    );
  }

  Future<void> revokeDeviceToken(String token) async {
    await _client.delete(
      '/api/notifications/devices',
      body: <String, dynamic>{'token': token},
    );
  }

  Future<Map<String, dynamic>> getNotificationPreferences() async {
    final dynamic body = await _client.get('/api/notifications/preferences');
    return body is Map<String, dynamic>
        ? body
        : <String, dynamic>{'preferences': <dynamic>[]};
  }

  Future<Map<String, dynamic>> updateNotificationPreference({
    required String category,
    bool? emailEnabled,
    bool? smsEnabled,
    bool? pushEnabled,
    bool? inboxEnabled,
  }) async {
    final dynamic body = await _client.patch(
      '/api/notifications/preferences',
      body: <String, dynamic>{
        'category': category,
        if (emailEnabled != null) 'emailEnabled': emailEnabled,
        if (smsEnabled != null) 'smsEnabled': smsEnabled,
        if (pushEnabled != null) 'pushEnabled': pushEnabled,
        if (inboxEnabled != null) 'inboxEnabled': inboxEnabled,
      },
    );
    return body is Map<String, dynamic>
        ? body
        : <String, dynamic>{'success': true};
  }

  /// Paystack init — only valid when booking status is PAYMENT_PENDING.
  Future<Map<String, dynamic>> initializePayment({
    required String bookingId,
    String? accessToken,
  }) async {
    final dynamic body = await _client.post(
      '/api/payments/initialize',
      body: <String, dynamic>{
        'bookingId': bookingId,
        if (accessToken != null && accessToken.isNotEmpty)
          'accessToken': accessToken,
      },
      accessToken: accessToken,
    );
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{'error': 'Unexpected payment response'};
  }

  /// Authoritative verify — never trust client callback alone.
  Future<Map<String, dynamic>> verifyPayment(String reference) async {
    final dynamic body = await _client.get(
      '/api/payments/verify/${Uri.encodeComponent(reference)}',
    );
    if (body is Map<String, dynamic>) return body;
    return <String, dynamic>{
      'verified': false,
      'error': 'Unexpected verify response',
    };
  }

  IleBooking _bookingFromEnvelope(dynamic body, {String? fallbackAccessToken}) {
    if (body is! Map) {
      return IleBooking.fromJson(<String, dynamic>{});
    }
    final Map<String, dynamic> root = Map<String, dynamic>.from(body);
    final Map<String, dynamic> bookingJson = root['booking'] is Map
        ? Map<String, dynamic>.from(root['booking'] as Map)
        : Map<String, dynamic>.from(root);
    if (root['timers'] is Map && bookingJson['timers'] == null) {
      bookingJson['timers'] = root['timers'];
    }
    if (root['recovery'] is Map) {
      final Map<String, dynamic> recovery =
          Map<String, dynamic>.from(root['recovery'] as Map);
      bookingJson['recovery'] = recovery;
      if (recovery['canConfirmCheckIn'] is bool) {
        bookingJson['canConfirmCheckIn'] = recovery['canConfirmCheckIn'];
      }
      if (recovery['guestCheckInConfirmedAt'] != null) {
        bookingJson['guestCheckInConfirmedAt'] =
            recovery['guestCheckInConfirmedAt'];
      }
    }
    if (root['guestCheckInConfirmedAt'] != null) {
      bookingJson['guestCheckInConfirmedAt'] = root['guestCheckInConfirmedAt'];
    }
    if (root['property'] is Map) {
      bookingJson['property'] = root['property'];
    }
    if (root['accessToken'] is String &&
        (bookingJson['accessToken'] == null ||
            (bookingJson['accessToken'] as String).isEmpty)) {
      bookingJson['accessToken'] = root['accessToken'];
    }
    if (fallbackAccessToken != null &&
        fallbackAccessToken.isNotEmpty &&
        (bookingJson['accessToken'] == null ||
            (bookingJson['accessToken'] as String).isEmpty)) {
      bookingJson['accessToken'] = fallbackAccessToken;
    }
    return IleBooking.fromJson(bookingJson);
  }
}
