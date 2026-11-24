import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/ile_api.dart';
import '../models/property.dart';

/// Saved stays. Local cache, synced to /api/favourites when a session exists.
class WishlistStore extends ChangeNotifier {
  WishlistStore();

  IleApi? _api;

  void attachApi(IleApi api) {
    _api = api;
  }

  static const String _idsKey = 'ile_wishlist_ids';
  final Map<String, IleProperty> _items = <String, IleProperty>{};
  bool _loaded = false;

  bool get isLoaded => _loaded;
  List<IleProperty> get items => _items.values.toList(growable: false);
  int get count => _items.length;
  bool contains(String id) => _items.containsKey(id);

  Future<void> load() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    final List<String> ids = prefs.getStringList(_idsKey) ?? <String>[];
    // IDs alone — hydrate when user saves a full property card.
    for (final String id in ids) {
      _items.putIfAbsent(
        id,
        () => IleProperty(
          id: id,
          slug: id,
          title: 'Saved stay',
          tagline: '',
          description: '',
          propertyType: '',
          bedrooms: 0,
          bathrooms: 0,
          beds: 0,
          maxGuests: 1,
          pricePerNight: 0,
          currency: 'NGN',
          city: '',
          neighborhood: '',
          state: '',
          coverImage: '',
          rating: 0,
          reviewCount: 0,
          verified: false,
          featured: false,
          powerType: '',
          images: const <String>[],
          amenityItems: const [],
          latitude: 0,
          longitude: 0,
          hostName: '',
          hostAvatar: '',
        ),
      );
    }
    if (_api != null) {
      try {
        final List<IleProperty> remote = await _api!.listFavourites();
        for (final IleProperty property in remote) {
          _items[property.id] = property;
        }
      } catch (_) {
        // Signed-out or offline: keep the device list.
      }
    }
    _loaded = true;
    notifyListeners();
  }

  Future<void> toggle(IleProperty property) async {
    final bool removing = _items.containsKey(property.id);
    if (removing) {
      _items.remove(property.id);
    } else {
      _items[property.id] = property;
    }
    await _persist();
    notifyListeners();
    if (_api == null) return;
    try {
      if (removing) {
        await _api!.removeFavourite(property.id);
      } else {
        await _api!.addFavourite(property.id);
      }
    } catch (_) {}
  }

  Future<void> remove(String id) async {
    _items.remove(id);
    await _persist();
    notifyListeners();
  }

  Future<void> _persist() async {
    final SharedPreferences prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_idsKey, _items.keys.toList());
  }
}
