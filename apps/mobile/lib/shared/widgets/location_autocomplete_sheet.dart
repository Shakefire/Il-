import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_typography.dart';
import '../../core/api/ile_api.dart';
import '../../core/models/location_result.dart';

/// Modal bottom sheet for searching and autocompleting Nigerian addresses/locations.
/// Backed by Nominatim via `/api/locations/search` with GPS location integration.
class LocationAutocompleteSheet extends StatefulWidget {
  const LocationAutocompleteSheet({
    super.key,
    this.initialQuery = '',
    this.title = 'Search Address or Location',
  });

  final String initialQuery;
  final String title;

  static Future<LocationResult?> show(
    BuildContext context, {
    String initialQuery = '',
    String title = 'Search Address or Location',
  }) {
    return showModalBottomSheet<LocationResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (BuildContext ctx) => LocationAutocompleteSheet(
        initialQuery: initialQuery,
        title: title,
      ),
    );
  }

  @override
  State<LocationAutocompleteSheet> createState() =>
      _LocationAutocompleteSheetState();
}

class _LocationAutocompleteSheetState extends State<LocationAutocompleteSheet> {
  final TextEditingController _queryCtrl = TextEditingController();
  Timer? _debounce;
  bool _isLoading = false;
  bool _isLocating = false;
  String? _errorMessage;
  List<LocationResult> _suggestions = <LocationResult>[];

  static const List<String> _quickCities = <String>[
    'Maitama, Abuja',
    'Wuse 2, Abuja',
    'Victoria Island, Lagos',
    'Ikoyi, Lagos',
    'Lekki Phase 1, Lagos',
    'GRA Phase 2, Port Harcourt',
  ];

  @override
  void initState() {
    super.initState();
    _queryCtrl.text = widget.initialQuery;
    if (widget.initialQuery.trim().length >= 2) {
      _search(widget.initialQuery.trim());
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _queryCtrl.dispose();
    super.dispose();
  }

  void _onQueryChanged(String val) {
    _debounce?.cancel();
    final String clean = val.trim();
    if (clean.length < 2) {
      setState(() {
        _suggestions = <LocationResult>[];
        _isLoading = false;
        _errorMessage = null;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    _debounce = Timer(const Duration(milliseconds: 300), () {
      _search(clean);
    });
  }

  Future<void> _search(String query) async {
    try {
      final List<LocationResult> results =
          await context.read<IleApi>().searchLocations(query);
      if (!mounted) return;
      setState(() {
        _suggestions = results;
        _isLoading = false;
        if (results.isEmpty) {
          _errorMessage = 'No Nigerian addresses found for "$query". Try typing your street or neighborhood.';
        }
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _suggestions = <LocationResult>[];
        _isLoading = false;
        _errorMessage = 'Could not load address suggestions. Please try again.';
      });
    }
  }

  Future<void> _useCurrentLocation() async {
    setState(() {
      _isLocating = true;
      _errorMessage = null;
    });

    try {
      final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw Exception('Location services are turned off. Please enable GPS.');
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception(
          'Location permission was denied. Please select your address manually.',
        );
      }

      final Position pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );

      if (!mounted) return;

      // Reverse geocode or query with coordinates
      final LocationResult result = LocationResult(
        displayName: 'Current Location (${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)})',
        name: 'Current Location',
        city: 'Nigeria',
        state: 'Nigeria',
        country: 'Nigeria',
        neighborhood: '',
        latitude: pos.latitude,
        longitude: pos.longitude,
      );

      Navigator.of(context).pop(result);
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isLocating = false;
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final double bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.85,
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFDCD8CE),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                widget.title,
                style: AppTypography.cardTitle.copyWith(fontSize: 17),
              ),
              IconButton(
                icon: const Icon(Icons.close_rounded, size: 20),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Search Field
          TextField(
            controller: _queryCtrl,
            autofocus: true,
            decoration: InputDecoration(
              hintText: 'Type street, neighborhood, or landmark…',
              prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF073B2E)),
              suffixIcon: _queryCtrl.text.isNotEmpty
                  ? IconButton(
                      icon: const Icon(Icons.clear_rounded, size: 18),
                      onPressed: () {
                        _queryCtrl.clear();
                        _onQueryChanged('');
                      },
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFDCD8CE)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFF073B2E), width: 1.5),
              ),
            ),
            onChanged: _onQueryChanged,
          ),
          const SizedBox(height: 8),

          // Use Current Location CTA
          InkWell(
            onTap: _isLocating ? null : _useCurrentLocation,
            borderRadius: BorderRadius.circular(10),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
              child: Row(
                children: [
                  _isLocating
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF073B2E)),
                          ),
                        )
                      : const Icon(
                          Icons.my_location_rounded,
                          size: 18,
                          color: Color(0xFF073B2E),
                        ),
                  const SizedBox(width: 10),
                  Text(
                    _isLocating
                        ? 'Acquiring GPS coordinates…'
                        : 'Use my current location',
                    style: AppTypography.supporting.copyWith(
                      color: const Color(0xFF073B2E),
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const Divider(height: 16),

          // Loading / Error / Results
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: SizedBox(
                  width: 24,
                  height: 24,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.2,
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF073B2E)),
                  ),
                ),
              ),
            )
          else if (_errorMessage != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text(
                _errorMessage!,
                textAlign: TextAlign.center,
                style: AppTypography.caption.copyWith(color: AppColors.criticalText),
              ),
            )
          else if (_suggestions.isNotEmpty)
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _suggestions.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (BuildContext context, int index) {
                  final LocationResult loc = _suggestions[index];
                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    leading: const Icon(
                      Icons.location_on_outlined,
                      color: Color(0xFF073B2E),
                      size: 22,
                    ),
                    title: Text(
                      loc.shortLabel,
                      style: AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600),
                    ),
                    subtitle: Text(
                      loc.displayName,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(color: const Color(0xFF6E6B64)),
                    ),
                    onTap: () => Navigator.of(context).pop(loc),
                  );
                },
              ),
            )
          else
            // Quick-pick Nigerian prime hubs
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      'Popular Nigerian Destinations',
                      style: AppTypography.microLabel.copyWith(
                        color: const Color(0xFF8A8780),
                        letterSpacing: 1.1,
                      ),
                    ),
                  ),
                  ..._quickCities.map((String city) {
                    return ListTile(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                      leading: const Icon(Icons.location_city_outlined, size: 20, color: Color(0xFF6E6B64)),
                      title: Text(city, style: AppTypography.bodyMedium),
                      onTap: () {
                        _queryCtrl.text = city;
                        _search(city);
                      },
                    );
                  }),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
