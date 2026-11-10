/// Route paths for the Ilé mobile shell.
abstract final class AppRoutes {
  static const String welcome = '/';
  static const String designSystem = '/design-system';
  static const String login = '/auth/login';
  static const String register = '/auth/register';
  static const String otp = '/auth/otp';
  static const String forgotPassword = '/auth/forgot-password';
  static const String resetPassword = '/auth/reset-password';

  // Marketplace shell tabs
  static const String explore = '/explore';
  static const String wishlist = '/wishlist';
  static const String bookings = '/bookings';
  static const String inbox = '/inbox';
  static const String profile = '/profile';

  // Search & property flows
  static const String destinationSearch = '/search/destination';
  static const String dateGuestPicker = '/search/dates';
  static const String searchResults = '/search/results';
  static const String mapSearch = '/search/map';
  static const String propertyDetails = '/property/:slug';
  static const String reserve = '/property/:slug/reserve';
  static const String reservationStatus = '/bookings/status/:id';
  static const String editProfile = '/profile/edit';
  static const String notifications = '/profile/notifications';
  static const String help = '/profile/help';
  static const String amenities = '/property/:slug/amenities';
  static const String terms = '/legal/terms';
  static const String privacy = '/legal/privacy';

  // Legacy aliases kept for existing auth navigation
  static const String home = explore;
  static const String search = searchResults;
  static const String booking = bookings;
  static const String favorites = wishlist;
  static const String hostDashboard = '/host';
  static const String hostProfile = '/host/profile';
  static const String hostBank = '/host/bank';
  static const String hostNotifications = '/host/notifications';
  static const String hostOnboarding = '/host/onboarding';
  static const String hostPropertyCreate = '/host/properties/new';
  static const String hostPropertyDetail = '/host/properties/:id';
  static const String hostPropertyEdit = '/host/properties/:id/edit';
  static const String hostReservationDetail = '/host/reservations/:id';

  static String hostReservationDetailPath(String id) =>
      '/host/reservations/$id';

  static String hostPropertyDetailPath(String id) => '/host/properties/$id';

  static String hostPropertyEditPath(String id) => '/host/properties/$id/edit';

  static String propertyDetailsPath(String slug, {String? heroScope}) {
    final String path = '/property/$slug';
    if (heroScope == null || heroScope.isEmpty) return path;
    return '$path?hero=${Uri.encodeComponent(heroScope)}';
  }

  static String reservePath(String slug) => '/property/$slug/reserve';

  static String amenitiesPath(String slug) => '/property/$slug/amenities';

  static String dateGuestPickerPath({
    bool editMode = false,
    int? maxGuests,
    int? minimumNights,
    String? propertyId,
    String? slug,
  }) {
    final Map<String, String> q = <String, String>{
      if (editMode) 'edit': '1',
      if (maxGuests != null) 'maxGuests': '$maxGuests',
      if (minimumNights != null) 'minNights': '$minimumNights',
      if (propertyId != null && propertyId.isNotEmpty) 'propertyId': propertyId,
      if (slug != null && slug.isNotEmpty) 'slug': slug,
    };
    if (q.isEmpty) return dateGuestPicker;
    return '$dateGuestPicker?${Uri(queryParameters: q).query}';
  }

  static String reservationStatusPath(String id, {String? accessToken}) {
    final String base = '/bookings/status/$id';
    if (accessToken == null || accessToken.isEmpty) return base;
    return '$base?token=${Uri.encodeComponent(accessToken)}';
  }

  static String otpPath({
    required String email,
    String? maskedPhone,
  }) {
    final String phone = Uri.encodeComponent(
      maskedPhone ?? AppRoutesDefaults.maskedPhone,
    );
    return '$otp?email=${Uri.encodeComponent(email)}&phone=$phone';
  }
}

/// Default query values used when building auth deep links locally.
abstract final class AppRoutesDefaults {
  static const String maskedPhone = '+234 ••• ••• ••89';
}
