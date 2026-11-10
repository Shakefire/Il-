/// Normalized location from `GET /api/locations/search` (Nominatim-backed).
class LocationResult {
  const LocationResult({
    required this.displayName,
    required this.name,
    required this.city,
    required this.state,
    required this.country,
    required this.neighborhood,
    required this.latitude,
    required this.longitude,
  });

  final String displayName;
  final String name;
  final String city;
  final String state;
  final String country;
  final String neighborhood;
  final double latitude;
  final double longitude;

  factory LocationResult.fromJson(Map<String, dynamic> json) {
    return LocationResult(
      displayName: (json['displayName'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      city: (json['city'] as String?) ?? '',
      state: (json['state'] as String?) ?? '',
      country: (json['country'] as String?) ?? 'Nigeria',
      neighborhood: (json['neighborhood'] as String?) ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0,
    );
  }

  String get shortLabel {
    if (name.isNotEmpty) return name;
    if (neighborhood.isNotEmpty) return neighborhood;
    if (city.isNotEmpty) return city;
    return displayName;
  }
}
