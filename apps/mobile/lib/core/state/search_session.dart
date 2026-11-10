import 'package:flutter/foundation.dart';

/// Shared guest search criteria — persists across Explore → Search → Details.
class SearchSession extends ChangeNotifier {
  String destination = '';
  double? lat;
  double? lng;
  String? checkIn;
  String? checkOut;
  int guests = 2;
  String? propertyType;
  int? bedrooms;
  int? bathrooms;
  int? minPrice;
  int? maxPrice;
  String? powerType;
  final Set<String> amenities = <String>{};
  String sort = 'relevance';
  bool nearMe = false;

  bool get hasDates =>
      checkIn != null &&
      checkIn!.isNotEmpty &&
      checkOut != null &&
      checkOut!.isNotEmpty;

  String get datesLabel {
    if (!hasDates) return 'Add dates';
    return '${checkIn!} → ${checkOut!}';
  }

  String get guestsLabel => guests == 1 ? '1 guest' : '$guests guests';

  String get destinationLabel {
    if (nearMe) return 'Near me';
    if (destination.isNotEmpty) return destination;
    return 'Search by location';
  }

  bool get hasActiveFilters =>
      propertyType != null ||
      bedrooms != null ||
      bathrooms != null ||
      minPrice != null ||
      maxPrice != null ||
      powerType != null ||
      amenities.isNotEmpty;

  int get activeFilterCount {
    int count = 0;
    if (propertyType != null) count++;
    if (bedrooms != null) count++;
    if (bathrooms != null) count++;
    if (minPrice != null || maxPrice != null) count++;
    if (powerType != null) count++;
    count += amenities.length;
    return count;
  }

  String get filtersLabel {
    if (!hasActiveFilters) return 'Add filters';
    if (activeFilterCount == 1) return '1 filter';
    return '$activeFilterCount filters';
  }

  /// Compact search-bar summary under the destination title.
  String get searchBarSubtitle {
    final bool hasDestination =
        nearMe || destination.isNotEmpty;
    final List<String> parts = <String>[
      if (!hasDestination) 'Anywhere',
      datesLabel,
      guestsLabel,
      if (hasActiveFilters) filtersLabel,
    ];
    return parts.join(' · ');
  }

  void clearPlace() {
    destination = '';
    lat = null;
    lng = null;
    nearMe = false;
    notifyListeners();
  }

  void setDestination({
    required String label,
    double? latitude,
    double? longitude,
    bool isNearMe = false,
  }) {
    destination = label;
    lat = latitude;
    lng = longitude;
    nearMe = isNearMe;
    notifyListeners();
  }

  void setDates({required String? start, required String? end}) {
    checkIn = start;
    checkOut = end;
    notifyListeners();
  }

  /// Guest count only — never use listing [maxGuests] as the booked count.
  /// Pass [maxCapacity] from the listing to clamp selection, not substitute it.
  void setGuests(int value, {int? maxCapacity}) {
    final int upper = (maxCapacity ?? 16).clamp(1, 16);
    guests = value.clamp(1, upper);
    notifyListeners();
  }

  int nightsCount() {
    if (!hasDates) return 0;
    final DateTime? start = DateTime.tryParse(checkIn!);
    final DateTime? end = DateTime.tryParse(checkOut!);
    if (start == null || end == null) return 0;
    return end.difference(start).inDays;
  }

  String? validateAgainstListing({
    required int maxGuests,
    required int minimumNights,
  }) {
    if (guests > maxGuests) {
      return 'This stay allows up to $maxGuests guests. You selected $guests.';
    }
    if (hasDates) {
      final int nights = nightsCount();
      if (nights < 1) {
        return 'Check-out must be after check-in.';
      }
      if (nights < minimumNights) {
        return 'Minimum stay is $minimumNights night${minimumNights == 1 ? '' : 's'}.';
      }
    }
    return null;
  }

  void setFilters({
    String? type,
    int? beds,
    int? baths,
    int? min,
    int? max,
    String? power,
    Set<String>? amenitySet,
  }) {
    propertyType = type;
    bedrooms = beds;
    bathrooms = baths;
    minPrice = min;
    maxPrice = max;
    powerType = power;
    amenities
      ..clear()
      ..addAll(amenitySet ?? const <String>{});
    notifyListeners();
  }

  void setSort(String value) {
    sort = value;
    notifyListeners();
  }

  void clearFilters() {
    propertyType = null;
    bedrooms = null;
    bathrooms = null;
    minPrice = null;
    maxPrice = null;
    powerType = null;
    amenities.clear();
    sort = 'relevance';
    notifyListeners();
  }

  Map<String, String> toQueryParameters() {
    final Map<String, String> query = <String, String>{
      if (destination.isNotEmpty && !nearMe) 'destination': destination,
      if (lat != null) 'lat': '$lat',
      if (lng != null) 'lng': '$lng',
      if (checkIn != null) 'checkIn': checkIn!,
      if (checkOut != null) 'checkOut': checkOut!,
      'guests': '$guests',
      if (propertyType != null) 'type': propertyType!,
      if (bedrooms != null) 'bedrooms': '$bedrooms',
      if (minPrice != null) 'minPrice': '$minPrice',
      if (maxPrice != null) 'maxPrice': '$maxPrice',
      if (powerType != null) 'powerType': powerType!,
      if (amenities.isNotEmpty) 'amenities': amenities.join(','),
      'sort': sort,
    };
    return query;
  }

  void applyQueryParameters(Map<String, String> params) {
    destination = params['destination'] ?? params['location'] ?? destination;
    lat = double.tryParse(params['lat'] ?? '') ?? lat;
    lng = double.tryParse(params['lng'] ?? '') ?? lng;
    checkIn = params['checkIn'] ?? checkIn;
    checkOut = params['checkOut'] ?? checkOut;
    guests = int.tryParse(params['guests'] ?? '') ?? guests;
    propertyType = params['type'] ?? propertyType;
    bedrooms = int.tryParse(params['bedrooms'] ?? '') ?? bedrooms;
    minPrice = int.tryParse(params['minPrice'] ?? '') ?? minPrice;
    maxPrice = int.tryParse(params['maxPrice'] ?? '') ?? maxPrice;
    powerType = params['powerType'] ?? powerType;
    if (params['amenities'] != null && params['amenities']!.isNotEmpty) {
      amenities
        ..clear()
        ..addAll(params['amenities']!.split(','));
    }
    sort = params['sort'] ?? sort;
    nearMe = params['nearMe'] == '1';
    notifyListeners();
  }
}
