import '../models/property.dart';

/// Guest-facing stay copy. Never surfaces raw record ids or invented amenities.
abstract final class StayDisplay {
  /// Trailing / whole-string DB id fragments (`p3a_179…`, `prop_44`, …).
  static final RegExp _idToken = RegExp(
    r'(?:^|[\s\-_])(?:p3a_|prop[_-]?|property_)[a-z0-9_\-]+$',
    caseSensitive: false,
  );

  static final RegExp _embeddedId = RegExp(
    r'\s*(?:p3a_|prop[_-]?|property_)[a-z0-9_\-]+\s*',
    caseSensitive: false,
  );

  static final RegExp _compactId = RegExp(r'^[a-z0-9]+_[a-z0-9_]+$');

  static bool looksLikeRecordId(String value) {
    final String trimmed = value.trim();
    if (trimmed.isEmpty) return true;
    final String lower = trimmed.toLowerCase();
    if (lower.startsWith('p3a_') ||
        lower.startsWith('prop_') ||
        lower.startsWith('prop-') ||
        lower.startsWith('property_')) {
      return true;
    }
    final bool compactId =
        _compactId.hasMatch(lower) && !lower.contains(' ');
    return compactId && lower.length >= 8;
  }

  /// Strip raw DB id suffixes so only a clean human title remains.
  static String sanitizeTitle(String raw) {
    String cleaned = raw.trim();
    if (cleaned.isEmpty) return cleaned;
    cleaned = cleaned.replaceAll(_embeddedId, ' ').trim();
    cleaned = cleaned.replaceAll(_idToken, '').trim();
    cleaned = cleaned.replaceAll(RegExp(r'\s{2,}'), ' ').trim();
    if (looksLikeRecordId(cleaned)) return '';
    return cleaned;
  }

  static String title(IleProperty property) {
    final String cleaned = sanitizeTitle(property.title);
    if (cleaned.isNotEmpty && cleaned != 'Stay') return cleaned;
    final String tagline = sanitizeTitle(property.tagline);
    if (tagline.isNotEmpty) return tagline;
    if (property.neighborhood.isNotEmpty && property.city.isNotEmpty) {
      return '${property.neighborhood}, ${property.city}';
    }
    if (property.city.isNotEmpty) return 'Stay in ${property.city}';
    if (property.propertyType.isNotEmpty) return property.propertyType;
    return 'Curated stay';
  }

  /// One real amenity in the power / connectivity / security families.
  /// Returns the host's label unchanged — never a hardcoded stand-in.
  static String? highlightAmenity(IleProperty property) {
    const List<String> keys = <String>[
      'inverter',
      'solar',
      'power',
      'wifi',
      'wi-fi',
      'internet',
      'fiber',
      'security',
      'guard',
      'gated',
    ];
    for (final String name in property.amenities) {
      final String lower = name.toLowerCase();
      if (keys.any(lower.contains)) return name;
    }
    return null;
  }

  /// Compact trust chips from real amenity labels (security / power).
  static List<String> trustBadges(IleProperty property) {
    final List<String> badges = <String>[];
    for (final String name in property.amenities) {
      final String lower = name.toLowerCase();
      final bool isSecurity = lower.contains('security') ||
          lower.contains('guard') ||
          lower.contains('gated');
      final bool isPower = lower.contains('power') ||
          lower.contains('inverter') ||
          lower.contains('solar');
      if (!isSecurity && !isPower) continue;
      if (badges.contains(name)) continue;
      badges.add(name);
      if (badges.length >= 2) break;
    }
    return badges;
  }

  static List<String> gallery(IleProperty property) {
    final List<String> urls = <String>[];
    if (property.coverImage.isNotEmpty) urls.add(property.coverImage);
    for (final String url in property.images) {
      if (url.isNotEmpty && !urls.contains(url)) urls.add(url);
    }
    return urls;
  }

  static bool matchesPlace(IleProperty property, String query) {
    final String needle = query.trim().toLowerCase();
    if (needle.isEmpty) return true;
    final String hay = <String>[
      property.city,
      property.neighborhood,
      property.state,
      property.locationLabel,
    ].join(' ').toLowerCase();
    if (needle.contains('victoria')) return hay.contains('victoria');
    return hay.contains(needle);
  }

  static String heroTag(String scope, String id) => 'ile-stay-$scope-$id';

  static bool hasRealHost(IleProperty property) {
    final String name = property.hostName.trim();
    if (name.isEmpty) return false;
    if (name == 'Host' && property.hostAvatar.isEmpty) return false;
    return true;
  }
}
