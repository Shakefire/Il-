import 'dart:math' as math;

class NearbyNeighborhood {
  const NearbyNeighborhood({
    required this.name,
    required this.descriptor,
    required this.distanceKm,
    required this.city,
    required this.state,
  });

  final String name;
  final String descriptor;
  final double distanceKm;
  final String city;
  final String state;

  String get distanceLabel => '${distanceKm.toStringAsFixed(1)} km';
}

class NearbyNeighborhoodsService {
  static const Map<String, List<NearbyNeighborhood>> _curatedGraphs = {
    'maitama': [
      NearbyNeighborhood(
        name: 'Wuse II',
        descriptor: 'Short-let stays',
        distanceKm: 3.2,
        city: 'Abuja',
        state: 'FCT',
      ),
      NearbyNeighborhood(
        name: 'Asokoro',
        descriptor: 'Short-let stays',
        distanceKm: 4.8,
        city: 'Abuja',
        state: 'FCT',
      ),
      NearbyNeighborhood(
        name: 'Jabi',
        descriptor: 'Waterfront stays',
        distanceKm: 6.1,
        city: 'Abuja',
        state: 'FCT',
      ),
      NearbyNeighborhood(
        name: 'Garki II',
        descriptor: 'Short-let stays',
        distanceKm: 5.4,
        city: 'Abuja',
        state: 'FCT',
      ),
      NearbyNeighborhood(
        name: 'Utako',
        descriptor: 'Serviced apartments',
        distanceKm: 5.0,
        city: 'Abuja',
        state: 'FCT',
      ),
      NearbyNeighborhood(
        name: 'Guzape',
        descriptor: 'Luxury hills villas',
        distanceKm: 7.2,
        city: 'Abuja',
        state: 'FCT',
      ),
    ],
    'ikoyi': [
      NearbyNeighborhood(
        name: 'Victoria Island',
        descriptor: 'Executive stays',
        distanceKm: 2.8,
        city: 'Lagos',
        state: 'Lagos State',
      ),
      NearbyNeighborhood(
        name: 'Lekki Phase 1',
        descriptor: 'Vibrant short-lets',
        distanceKm: 4.5,
        city: 'Lagos',
        state: 'Lagos State',
      ),
      NearbyNeighborhood(
        name: 'Oniru',
        descriptor: 'Coastal apartments',
        distanceKm: 3.6,
        city: 'Lagos',
        state: 'Lagos State',
      ),
      NearbyNeighborhood(
        name: 'Eko Atlantic',
        descriptor: 'Luxury skyline towers',
        distanceKm: 4.1,
        city: 'Lagos',
        state: 'Lagos State',
      ),
      NearbyNeighborhood(
        name: 'Banana Island',
        descriptor: 'Ultra-luxury estates',
        distanceKm: 2.2,
        city: 'Lagos',
        state: 'Lagos State',
      ),
      NearbyNeighborhood(
        name: 'Ikate',
        descriptor: 'Modern serviced flats',
        distanceKm: 6.0,
        city: 'Lagos',
        state: 'Lagos State',
      ),
    ],
    'wuse': [
      NearbyNeighborhood(
        name: 'Maitama',
        descriptor: 'Diplomatic luxury',
        distanceKm: 3.2,
        city: 'Abuja',
        state: 'FCT',
      ),
      NearbyNeighborhood(
        name: 'Utako',
        descriptor: 'Commercial & serviced',
        distanceKm: 2.5,
        city: 'Abuja',
        state: 'FCT',
      ),
      NearbyNeighborhood(
        name: 'Jabi',
        descriptor: 'Lakeview apartments',
        distanceKm: 4.2,
        city: 'Abuja',
        state: 'FCT',
      ),
      NearbyNeighborhood(
        name: 'Garki',
        descriptor: 'Central apartments',
        distanceKm: 4.0,
        city: 'Abuja',
        state: 'FCT',
      ),
      NearbyNeighborhood(
        name: 'Asokoro',
        descriptor: 'Exclusive mansions',
        distanceKm: 6.5,
        city: 'Abuja',
        state: 'FCT',
      ),
      NearbyNeighborhood(
        name: 'Guzape',
        descriptor: 'Scenic hills villas',
        distanceKm: 7.8,
        city: 'Abuja',
        state: 'FCT',
      ),
    ],
    'lekki': [
      NearbyNeighborhood(
        name: 'Ikate',
        descriptor: 'Modern short-lets',
        distanceKm: 2.4,
        city: 'Lagos',
        state: 'Lagos State',
      ),
      NearbyNeighborhood(
        name: 'Oniru',
        descriptor: 'Beachfront living',
        distanceKm: 3.8,
        city: 'Lagos',
        state: 'Lagos State',
      ),
      NearbyNeighborhood(
        name: 'Victoria Island',
        descriptor: 'Corporate & nightlife',
        distanceKm: 5.1,
        city: 'Lagos',
        state: 'Lagos State',
      ),
      NearbyNeighborhood(
        name: 'Ikoyi',
        descriptor: 'Heritage luxury',
        distanceKm: 6.2,
        city: 'Lagos',
        state: 'Lagos State',
      ),
      NearbyNeighborhood(
        name: 'Chevron / Agungi',
        descriptor: 'Quiet residential',
        distanceKm: 4.6,
        city: 'Lagos',
        state: 'Lagos State',
      ),
      NearbyNeighborhood(
        name: 'Osapa London',
        descriptor: 'Gated community stays',
        distanceKm: 3.5,
        city: 'Lagos',
        state: 'Lagos State',
      ),
    ],
  };

  /// Returns 6 nearby neighborhoods based on district name and coordinates.
  static List<NearbyNeighborhood> getNearby({
    required String neighborhood,
    required String city,
    required String state,
    double? latitude,
    double? longitude,
  }) {
    final String key = neighborhood.trim().toLowerCase();
    for (final MapEntry<String, List<NearbyNeighborhood>> entry in _curatedGraphs.entries) {
      if (key.contains(entry.key)) {
        return entry.value;
      }
    }

    final bool isLagos = city.toLowerCase().contains('lagos') || state.toLowerCase().contains('lagos');
    final List<NearbyNeighborhood> fallback = isLagos
        ? _curatedGraphs['ikoyi']!
        : _curatedGraphs['maitama']!;

    // If coordinates are provided, recalculate distances using Haversine
    if (latitude != null && longitude != null && latitude != 0 && longitude != 0) {
      return fallback.map((NearbyNeighborhood n) {
        final double dist = _estimateDistance(latitude, longitude, n.name);
        return NearbyNeighborhood(
          name: n.name,
          descriptor: n.descriptor,
          distanceKm: dist > 0 ? dist : n.distanceKm,
          city: n.city,
          state: n.state,
        );
      }).toList();
    }

    return fallback;
  }

  static double _estimateDistance(double lat, double lng, String targetName) {
    // Known reference coordinates for Nigerian prime districts
    final Map<String, (double, double)> coords = {
      'Wuse II': (9.0722, 7.4644),
      'Asokoro': (9.0433, 7.5255),
      'Jabi': (9.0689, 7.4244),
      'Garki II': (9.0278, 7.4889),
      'Utako': (9.0633, 7.4378),
      'Guzape': (9.0189, 7.5211),
      'Maitama': (9.0833, 7.4983),
      'Victoria Island': (6.4281, 3.4219),
      'Lekki Phase 1': (6.4474, 3.4723),
      'Oniru': (6.4352, 3.4431),
      'Eko Atlantic': (6.4167, 3.4000),
      'Banana Island': (6.4633, 3.4478),
      'Ikate': (6.4389, 3.5022),
      'Ikoyi': (6.4500, 3.4333),
    };

    final (double, double)? target = coords[targetName];
    if (target == null) return 0.0;

    const double p = 0.017453292519943295; // Math.PI / 180
    final double c = 0.5 -
        math.cos((target.$1 - lat) * p) / 2 +
        math.cos(lat * p) * math.cos(target.$1 * p) * (1 - math.cos((target.$2 - lng) * p)) / 2;
    final double km = 12742 * math.asin(math.sqrt(c)); // 2 * R; R = 6371 km
    return double.parse(km.toStringAsFixed(1));
  }
}
