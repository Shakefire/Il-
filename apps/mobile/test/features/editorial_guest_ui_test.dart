import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ile_mobile/app/app_theme.dart';
import 'package:ile_mobile/core/models/amenity.dart';
import 'package:ile_mobile/core/models/property.dart';
import 'package:ile_mobile/core/utils/stay_display.dart';
import 'package:ile_mobile/shared/widgets/auth_required_prompt.dart';
import 'package:ile_mobile/shared/widgets/editorial_chrome.dart';

IleProperty _stay({
  String title = 'Maitama suite',
  String tagline = '',
  String city = 'Abuja',
  String neighborhood = 'Maitama',
  List<IleAmenity> amenities = const <IleAmenity>[],
  bool verified = false,
  double rating = 0,
}) {
  return IleProperty(
    id: 'stay-1',
    slug: 'maitama-suite',
    title: title,
    tagline: tagline,
    description: '',
    propertyType: 'Apartment',
    bedrooms: 2,
    bathrooms: 2,
    beds: 2,
    maxGuests: 4,
    pricePerNight: 180000,
    currency: 'NGN',
    city: city,
    neighborhood: neighborhood,
    state: 'FCT',
    coverImage: '',
    rating: rating,
    reviewCount: 0,
    verified: verified,
    featured: false,
    powerType: '',
    images: const <String>[],
    amenityItems: amenities,
    latitude: 0,
    longitude: 0,
    hostName: 'Ada',
    hostAvatar: '',
  );
}

void main() {
  test('hides raw record ids and keeps a real place name', () {
    expect(
      StayDisplay.title(_stay(title: 'p3a_listing_9')),
      'Maitama, Abuja',
    );
    expect(
      StayDisplay.title(_stay(title: 'prop_44', tagline: 'Garden duplex')),
      'Garden duplex',
    );
    expect(StayDisplay.title(_stay()), 'Maitama suite');
  });

  test('amenity pill uses the host label only', () {
    expect(StayDisplay.highlightAmenity(_stay()), isNull);
    expect(
      StayDisplay.highlightAmenity(
        _stay(amenities: const <IleAmenity>[IleAmenity(name: 'Swimming Pool')]),
      ),
      isNull,
    );
    expect(
      StayDisplay.highlightAmenity(
        _stay(
          amenities: const <IleAmenity>[
            IleAmenity(name: 'High-Speed Fiber Internet'),
          ],
        ),
      ),
      'High-Speed Fiber Internet',
    );
  });

  testWidgets('sign-in prompt has no Not now dead end', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(
          body: AuthRequiredPrompt(
            title: 'Sign in',
            message: 'Bookings stay on your account.',
          ),
        ),
      ),
    );
    expect(find.text('Not now'), findsNothing);
    expect(find.text('Continue with phone or email'), findsOneWidget);
    expect(find.text('Instant Book'), findsNothing);
  });

  testWidgets('sample pass is labeled and has no gate code', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(body: SampleStayPass()),
      ),
    );
    expect(find.text('SAMPLE'), findsOneWidget);
    expect(find.text('Not your reservation'), findsOneWidget);
    expect(find.textContaining('Armed Security'), findsNothing);
    expect(find.textContaining('24/7 Power'), findsNothing);
  });
}
