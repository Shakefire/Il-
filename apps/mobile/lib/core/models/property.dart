import 'amenity.dart';

class IleThingsToKnow {
  const IleThingsToKnow({
    this.checkInAfter = '2:00 PM',
    this.checkOutBefore = '12:00 PM',
    this.checkInMethod = 'Smart lock',
    this.maxOvernightGuests,
    this.petsAllowed = false,
    this.smokingAllowed = false,
    this.partiesAllowed = false,
    this.quietHours = '10:00 PM - 7:00 AM',
    this.customRules = const <String>[
      'Visitor gate pass requires 2hr notice',
      'No commercial photography without prior approval',
      'Keep air conditioners off when stepping out of the apartment',
    ],
    this.hasSolarInverter = true,
    this.hasBackupGenerator = true,
    this.hasExteriorCCTV = true,
    this.hasSmokeAlarm = true,
    this.hasArmedEstateSecurity = true,
    this.powerScheduleNote =
        'Continuous 24/7 power supply with automatic inverter switchover during grid cuts.',
    this.cautionFeeNgn = 0,
    this.cancellationPolicy = 'FLEXIBLE_48H',
  });

  final String checkInAfter;
  final String checkOutBefore;
  final String checkInMethod;
  final int? maxOvernightGuests;
  final bool petsAllowed;
  final bool smokingAllowed;
  final bool partiesAllowed;
  final String quietHours;
  final List<String> customRules;
  final bool hasSolarInverter;
  final bool hasBackupGenerator;
  final bool hasExteriorCCTV;
  final bool hasSmokeAlarm;
  final bool hasArmedEstateSecurity;
  final String powerScheduleNote;
  final int cautionFeeNgn;
  final String cancellationPolicy;

  factory IleThingsToKnow.fromJson(
    Map<String, dynamic>? json, {
    int? fallbackMaxGuests,
    String? fallbackPowerNote,
  }) {
    if (json == null) {
      return IleThingsToKnow(
        maxOvernightGuests: fallbackMaxGuests,
        powerScheduleNote: fallbackPowerNote ??
            'Continuous 24/7 power supply with automatic inverter switchover during grid cuts.',
      );
    }
    final dynamic sp = json['safetyAndPower'];
    final Map<String, dynamic> safety = sp is Map<String, dynamic>
        ? sp
        : (sp is Map ? Map<String, dynamic>.from(sp) : <String, dynamic>{});
    final List<dynamic> rawRules =
        (json['customRules'] as List<dynamic>?) ?? <dynamic>[];

    return IleThingsToKnow(
      checkInAfter: (json['checkInAfter'] as String?) ?? '2:00 PM',
      checkOutBefore: (json['checkOutBefore'] as String?) ?? '12:00 PM',
      checkInMethod: (json['checkInMethod'] as String?) ?? 'Smart lock',
      maxOvernightGuests:
          (json['maxOvernightGuests'] as num?)?.toInt() ?? fallbackMaxGuests,
      petsAllowed: json['petsAllowed'] == true,
      smokingAllowed: json['smokingAllowed'] == true,
      partiesAllowed: json['partiesAllowed'] == true,
      quietHours: (json['quietHours'] as String?) ?? '10:00 PM - 7:00 AM',
      customRules: rawRules.isNotEmpty
          ? rawRules.map((dynamic r) => r.toString()).toList()
          : const <String>[
              'Visitor gate pass requires 2hr notice',
              'No commercial photography without prior approval',
              'Keep air conditioners off when stepping out of the apartment',
            ],
      hasSolarInverter: safety['hasSolarInverter'] != false,
      hasBackupGenerator: safety['hasBackupGenerator'] != false,
      hasExteriorCCTV: safety['hasExteriorCCTV'] != false,
      hasSmokeAlarm: safety['hasSmokeAlarm'] != false,
      hasArmedEstateSecurity: safety['hasArmedEstateSecurity'] != false,
      powerScheduleNote: (safety['powerScheduleNote'] as String?) ??
          fallbackPowerNote ??
          'Continuous 24/7 power supply with automatic inverter switchover during grid cuts.',
      cautionFeeNgn: (json['cautionFeeNgn'] as num?)?.toInt() ?? 0,
      cancellationPolicy:
          (json['cancellationPolicy'] as String?) ?? 'FLEXIBLE_48H',
    );
  }

  Map<String, dynamic> toJson() {
    return <String, dynamic>{
      'checkInAfter': checkInAfter,
      'checkOutBefore': checkOutBefore,
      'checkInMethod': checkInMethod,
      'maxOvernightGuests': maxOvernightGuests,
      'petsAllowed': petsAllowed,
      'smokingAllowed': smokingAllowed,
      'partiesAllowed': partiesAllowed,
      'quietHours': quietHours,
      'customRules': customRules,
      'safetyAndPower': <String, dynamic>{
        'hasSolarInverter': hasSolarInverter,
        'hasBackupGenerator': hasBackupGenerator,
        'hasExteriorCCTV': hasExteriorCCTV,
        'hasSmokeAlarm': hasSmokeAlarm,
        'hasArmedEstateSecurity': hasArmedEstateSecurity,
        'powerScheduleNote': powerScheduleNote,
      },
      'cautionFeeNgn': cautionFeeNgn,
      'cancellationPolicy': cancellationPolicy,
    };
  }
}


/// Property shape aligned with backend `enrichProperty`.
class IleProperty {
  const IleProperty({
    required this.id,
    required this.slug,
    required this.title,
    required this.tagline,
    required this.description,
    required this.propertyType,
    required this.bedrooms,
    required this.bathrooms,
    required this.beds,
    required this.maxGuests,
    required this.pricePerNight,
    required this.currency,
    required this.city,
    required this.neighborhood,
    required this.state,
    required this.coverImage,
    required this.rating,
    required this.reviewCount,
    required this.verified,
    required this.featured,
    required this.powerType,
    required this.images,
    required this.amenityItems,
    required this.latitude,
    required this.longitude,
    required this.hostName,
    required this.hostAvatar,
    this.distanceKm,
    this.isReserved = false,
    this.infrastructure = const <String, String>{},
    this.minimumNights = 1,
    this.thingsToKnow = const IleThingsToKnow(),
  });

  final String id;
  final String slug;
  final String title;
  final String tagline;
  final String description;
  final String propertyType;
  final int bedrooms;
  final int bathrooms;
  final int beds;
  final int maxGuests;
  final int pricePerNight;
  final String currency;
  final String city;
  final String neighborhood;
  final String state;
  final String coverImage;
  final double rating;
  final int reviewCount;
  final bool verified;
  final bool featured;
  final String powerType;
  final List<String> images;
  final List<IleAmenity> amenityItems;
  final double latitude;
  final double longitude;
  final String hostName;
  final String hostAvatar;
  final double? distanceKm;
  final bool isReserved;
  final Map<String, String> infrastructure;
  final int minimumNights;
  final IleThingsToKnow thingsToKnow;

  /// Display names only — derived from host-configured amenities.
  List<String> get amenities => amenityItems
      .map((IleAmenity a) => a.name)
      .where((String n) => n.isNotEmpty)
      .toList();

  String get locationLabel {
    final List<String> parts = <String>[
      if (neighborhood.isNotEmpty) neighborhood,
      if (city.isNotEmpty) city,
    ];
    return parts.join(', ');
  }

  String get primaryImage {
    if (coverImage.isNotEmpty) return coverImage;
    if (images.isNotEmpty) return images.first;
    return '';
  }

  factory IleProperty.fromJson(Map<String, dynamic> json) {
    final dynamic coords = json['coordinates'];
    final List<dynamic> rawImages = (json['images'] as List<dynamic>?) ?? <dynamic>[];
    final List<dynamic> rawAmenities =
        (json['amenities'] as List<dynamic>?) ?? <dynamic>[];
    final Map<String, dynamic> host =
        (json['host'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    final Map<String, dynamic> infra =
        (json['infrastructure'] as Map<String, dynamic>?) ?? <String, dynamic>{};

    return IleProperty(
      id: (json['id'] as String?) ?? '',
      slug: (json['slug'] as String?) ?? (json['id'] as String?) ?? '',
      title: (json['title'] as String?) ?? 'Stay',
      tagline: (json['tagline'] as String?) ?? '',
      description: (json['description'] as String?) ?? '',
      propertyType: (json['propertyType'] as String?) ?? '',
      bedrooms: (json['bedrooms'] as num?)?.toInt() ?? 0,
      bathrooms: (json['bathrooms'] as num?)?.toInt() ?? 0,
      beds: (json['beds'] as num?)?.toInt() ?? 0,
      maxGuests: (json['maxGuests'] as num?)?.toInt() ?? 1,
      pricePerNight: (json['pricePerNight'] as num?)?.toInt() ?? 0,
      currency: (json['currency'] as String?) ?? 'NGN',
      city: (json['city'] as String?) ?? '',
      neighborhood: (json['neighborhood'] as String?) ?? '',
      state: (json['state'] as String?) ?? '',
      coverImage: (json['coverImage'] as String?) ?? '',
      rating: (json['rating'] as num?)?.toDouble() ?? 0,
      reviewCount: (json['reviewCount'] as num?)?.toInt() ?? 0,
      verified: json['verified'] == true,
      featured: json['featured'] == true,
      powerType: (json['powerType'] as String?) ??
          (infra['powerType'] as String?) ??
          '',
      images: rawImages
          .map((dynamic e) {
            if (e is String) return e;
            if (e is Map && e['url'] is String) return e['url'] as String;
            return '';
          })
          .where((String u) => u.isNotEmpty)
          .toList(),
      amenityItems: rawAmenities
          .map(IleAmenity.fromJson)
          .where((IleAmenity a) => a.name.isNotEmpty)
          .toList(),
      latitude: coords is Map
          ? (coords['lat'] as num?)?.toDouble() ?? 0
          : (json['latitude'] as num?)?.toDouble() ?? 0,
      longitude: coords is Map
          ? (coords['lng'] as num?)?.toDouble() ?? 0
          : (json['longitude'] as num?)?.toDouble() ?? 0,
      hostName: (host['name'] as String?) ?? 'Host',
      hostAvatar: (host['avatar'] as String?) ?? '',
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      isReserved: json['isReserved'] == true,
      infrastructure: infra.map(
        (String k, dynamic v) => MapEntry<String, String>(k, '$v'),
      ),
      minimumNights: (json['minimumNights'] as num?)?.toInt() ?? 1,
      thingsToKnow: IleThingsToKnow.fromJson(
        json['thingsToKnow'] is Map ? Map<String, dynamic>.from(json['thingsToKnow'] as Map) : null,
        fallbackMaxGuests: (json['maxGuests'] as num?)?.toInt() ?? 2,
        fallbackPowerNote: infra['power'] ?? (json['powerDescription'] as String?),
      ),
    );
  }
}
