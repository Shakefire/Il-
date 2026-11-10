import 'package:flutter/material.dart';

/// Host-configured amenity — mirrors `property_amenities` rows.
class IleAmenity {
  const IleAmenity({
    required this.name,
    this.category = 'General',
    this.isHighlight = false,
  });

  final String name;
  final String category;
  final bool isHighlight;

  factory IleAmenity.fromJson(dynamic raw) {
    if (raw is String) {
      return IleAmenity(name: raw, category: AmenityCatalog.categoryFor(raw));
    }
    if (raw is Map) {
      final String name = (raw['name'] as String?) ?? '';
      final String category = (raw['category'] as String?) ??
          AmenityCatalog.categoryFor(name);
      return IleAmenity(
        name: name,
        category: category.isEmpty ? 'General' : category,
        isHighlight: raw['isHighlight'] == true,
      );
    }
    return const IleAmenity(name: '');
  }
}

/// Centralized labels → icons / categories from web host amenity list.
/// No emoji. Unknown names get a generic icon under General.
abstract final class AmenityCatalog {
  static const List<String> knownNames = <String>[
    '24/7 Solar + Inverter Power',
    'Dedicated Transformer',
    'High-Speed Fiber Internet',
    'Air Conditioning',
    'Gated Estate Security',
    'Uniformed Guards',
    'Smart Lock / Keyless Entry',
    'Swimming Pool',
    'Fully Equipped Kitchen',
    'Dedicated Workspace',
    'Washing Machine',
    'Free On-Premises Parking',
    'Daily Housekeeping',
    'Smart TV with Netflix',
    'Water Treatment Plant',
  ];

  static String categoryFor(String name) {
    final String n = name.toLowerCase();
    if (n.contains('solar') ||
        n.contains('transformer') ||
        n.contains('power') ||
        n.contains('inverter') ||
        n.contains('water treatment')) {
      return 'Infrastructure';
    }
    if (n.contains('internet') ||
        n.contains('wifi') ||
        n.contains('fiber') ||
        n.contains('workspace') ||
        n.contains('tv') ||
        n.contains('netflix')) {
      return 'Workspace & connectivity';
    }
    if (n.contains('security') ||
        n.contains('guard') ||
        n.contains('gate') ||
        n.contains('smart lock') ||
        n.contains('keyless')) {
      return 'Safety';
    }
    if (n.contains('kitchen') ||
        n.contains('washing') ||
        n.contains('housekeep') ||
        n.contains('pool') ||
        n.contains('parking') ||
        n.contains('air conditioning') ||
        n.contains('ac ')) {
      return 'Comfort';
    }
    return 'General';
  }

  static IconData iconFor(String name) {
    final String n = name.toLowerCase();
    if (n.contains('solar') || n.contains('inverter') || n.contains('power')) {
      return Icons.bolt_outlined;
    }
    if (n.contains('transformer')) return Icons.electrical_services_outlined;
    if (n.contains('internet') || n.contains('wifi') || n.contains('fiber')) {
      return Icons.wifi_rounded;
    }
    if (n.contains('air conditioning') || n.contains('ac')) {
      return Icons.ac_unit_rounded;
    }
    if (n.contains('security') || n.contains('guard') || n.contains('gated')) {
      return Icons.shield_outlined;
    }
    if (n.contains('smart lock') || n.contains('keyless')) {
      return Icons.lock_outline_rounded;
    }
    if (n.contains('pool')) return Icons.pool_rounded;
    if (n.contains('kitchen')) return Icons.kitchen_outlined;
    if (n.contains('workspace')) return Icons.laptop_chromebook_outlined;
    if (n.contains('washing')) return Icons.local_laundry_service_outlined;
    if (n.contains('parking')) return Icons.local_parking_rounded;
    if (n.contains('housekeep')) return Icons.cleaning_services_outlined;
    if (n.contains('tv') || n.contains('netflix')) {
      return Icons.tv_outlined;
    }
    if (n.contains('water')) return Icons.water_drop_outlined;
    return Icons.check_circle_outline_rounded;
  }

  static Map<String, List<IleAmenity>> groupByCategory(List<IleAmenity> items) {
    final Map<String, List<IleAmenity>> grouped = <String, List<IleAmenity>>{};
    for (final IleAmenity item in items) {
      if (item.name.isEmpty) continue;
      grouped.putIfAbsent(item.category, () => <IleAmenity>[]).add(item);
    }
    return grouped;
  }
}
