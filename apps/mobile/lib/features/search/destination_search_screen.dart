import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/models/location_result.dart';
import '../../core/state/search_session.dart';
import '../../shared/widgets/ile_circular_back_button.dart';

/// Destination search with Nominatim autocomplete via `/api/locations/search`.
class DestinationSearchScreen extends StatefulWidget {
  const DestinationSearchScreen({super.key});

  @override
  State<DestinationSearchScreen> createState() =>
      _DestinationSearchScreenState();
}

class _DestinationSearchScreenState extends State<DestinationSearchScreen> {
  static const List<String> _suggestedCities = <String>[
    'Abuja',
    'Lagos',
    'Kano',
    'Owerri',
  ];

  final TextEditingController _controller = TextEditingController();
  Timer? _debounce;
  bool _isSearching = false;
  bool _locating = false;
  String? _resolvingCity;
  String? _locationError;
  List<LocationResult> _suggestions = <LocationResult>[];

  bool get _showSuggestedCities {
    return _controller.text.trim().length < 2 && !_isSearching;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _handleQueryChanged(String value) {
    _debounce?.cancel();
    if (value.trim().length < 2) {
      setState(() {
        _suggestions = <LocationResult>[];
        _isSearching = false;
        _resolvingCity = null;
      });
      return;
    }
    setState(() {
      _isSearching = true;
      _resolvingCity = null;
    });
    _debounce = Timer(const Duration(milliseconds: 350), () async {
      try {
        final List<LocationResult> results =
            await context.read<IleApi>().searchLocations(value.trim());
        if (!mounted) return;
        setState(() {
          _suggestions = results;
          _isSearching = false;
        });
      } catch (_) {
        if (!mounted) return;
        setState(() {
          _suggestions = <LocationResult>[];
          _isSearching = false;
        });
      }
    });
  }

  Future<void> _handleNearMe() async {
    setState(() {
      _locating = true;
      _locationError = null;
    });
    try {
      final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        throw Exception('Turn on location services to search near you.');
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception(
          'Location permission is required for Near me. You can enable it in settings.',
        );
      }
      final Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
        ),
      );
      if (!mounted) return;
      context.read<SearchSession>().setDestination(
            label: 'Near me',
            latitude: position.latitude,
            longitude: position.longitude,
            isNearMe: true,
          );
      context.push(AppRoutes.searchResults);
    } catch (err) {
      if (!mounted) return;
      setState(() => _locationError = err.toString());
    } finally {
      if (mounted) setState(() => _locating = false);
    }
  }

  Future<void> _handleSuggestedCity(String city) async {
    if (_resolvingCity != null) return;
    setState(() {
      _resolvingCity = city;
      _locationError = null;
    });
    try {
      final List<LocationResult> results =
          await context.read<IleApi>().searchLocations(city);
      if (!mounted) return;
      if (results.isEmpty) {
        setState(() {
          _locationError = 'Couldn’t resolve $city. Try searching above.';
          _resolvingCity = null;
        });
        return;
      }
      setState(() => _resolvingCity = null);
      _selectLocation(results.first);
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _locationError = err.toString();
        _resolvingCity = null;
      });
    }
  }

  void _selectLocation(LocationResult loc) {
    context.read<SearchSession>().setDestination(
          label: loc.shortLabel,
          latitude: loc.latitude,
          longitude: loc.longitude,
        );
    context.push(AppRoutes.searchResults);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text('Where to?', style: AppTypography.cardTitle),
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
        children: [
          TextField(
            controller: _controller,
            autofocus: true,
            onChanged: _handleQueryChanged,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Search by location',
              prefixIcon: const Icon(Icons.search_rounded),
              filled: true,
              fillColor: AppColors.surface,
              border: OutlineInputBorder(
                borderRadius: AppRadius.panelAll,
                borderSide: const BorderSide(color: AppColors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: AppRadius.panelAll,
                borderSide: const BorderSide(color: AppColors.border),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: AppRadius.panelAll,
                borderSide: const BorderSide(color: AppColors.emerald, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.emeraldLight,
                borderRadius: AppRadius.subtleAll,
              ),
              child: _locating
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: AppColors.emerald,
                      ),
                    )
                  : const Icon(Icons.near_me_rounded, color: AppColors.emerald),
            ),
            title: Text(
              'Near me',
              style: AppTypography.supporting.copyWith(
                color: AppColors.foreground,
                fontWeight: FontWeight.w600,
              ),
            ),
            subtitle: Text(
              'Use current location (permission on tap)',
              style: AppTypography.caption,
            ),
            onTap: _locating ? null : _handleNearMe,
          ),
          if (_locationError != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: Text(
                _locationError!,
                style: AppTypography.caption.copyWith(
                  color: AppColors.criticalText,
                ),
              ),
            ),
          const Divider(color: AppColors.borderSubtle),
          if (_showSuggestedCities) ...[
            Padding(
              padding: const EdgeInsets.only(
                top: AppSpacing.sm,
                bottom: AppSpacing.xs,
              ),
              child: Text(
                'Suggested cities',
                style: AppTypography.caption.copyWith(
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.4,
                ),
              ),
            ),
            ..._suggestedCities.map(
              (String city) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: AppColors.surfaceMuted,
                    borderRadius: AppRadius.subtleAll,
                  ),
                  child: _resolvingCity == city
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.emerald,
                          ),
                        )
                      : const Icon(
                          Icons.location_city_outlined,
                          color: AppColors.foregroundSecondary,
                        ),
                ),
                title: Text(
                  city,
                  style: AppTypography.supporting.copyWith(
                    color: AppColors.foreground,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  'Nigeria',
                  style: AppTypography.caption,
                ),
                onTap: _resolvingCity != null
                    ? null
                    : () => _handleSuggestedCity(city),
              ),
            ),
          ] else if (_isSearching)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.emerald),
              ),
            )
          else if (_suggestions.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Text(
                'No places found. Try a Nigerian city or neighborhood.',
                style: AppTypography.supporting,
              ),
            )
          else
            ..._suggestions.map(
              (LocationResult loc) => ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(
                  Icons.location_on_outlined,
                  color: AppColors.foregroundSecondary,
                ),
                title: Text(
                  loc.shortLabel,
                  style: AppTypography.supporting.copyWith(
                    color: AppColors.foreground,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                subtitle: Text(
                  loc.displayName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption,
                ),
                onTap: () => _selectLocation(loc),
              ),
            ),
        ],
      ),
    );
  }
}
