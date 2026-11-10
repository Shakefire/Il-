import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/ile_api.dart';
import '../../core/guest_flow_errors.dart';
import '../../core/constants/app_routes.dart';
import '../../core/models/property.dart';
import '../../core/utils/stay_display.dart';
import '../../core/state/search_session.dart';
import '../../core/utils/formatters.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/skeleton/property_card_skeleton.dart';

/// Map search deferred: web uses a custom neighborhood panel, not Google Maps.
/// Shows geo-sorted results with privacy-offset coordinates from the API.
class MapSearchScreen extends StatefulWidget {
  const MapSearchScreen({super.key});

  @override
  State<MapSearchScreen> createState() => _MapSearchScreenState();
}

class _MapSearchScreenState extends State<MapSearchScreen> {
  bool _isLoading = true;
  GuestFlowError? _error;
  List<IleProperty> _properties = <IleProperty>[];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final SearchSession session = context.read<SearchSession>();
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final result = await context.read<IleApi>().search(
            location: session.nearMe ? null : session.destination,
            lat: session.lat,
            lng: session.lng,
            checkIn: session.checkIn,
            checkOut: session.checkOut,
            guests: session.guests,
            type: session.propertyType,
            bedrooms: session.bedrooms,
            minPrice: session.minPrice,
            maxPrice: session.maxPrice,
            limit: 40,
          );
      if (!mounted) return;
      setState(() {
        _properties = result.properties;
        _isLoading = false;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = GuestFlowError.from(err, surface: 'search');
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text('Map search', style: AppTypography.cardTitle),
      ),
      body: _isLoading
          ? ListView.builder(
              padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
              itemCount: 4,
              itemBuilder: (_, _) => const Padding(
                padding: EdgeInsets.only(bottom: AppSpacing.lg),
                child: PropertyCardSkeleton(),
              ),
            )
          : _error != null
              ? IleErrorState(
                  title: _error!.title,
                  message: _error!.message,
                  onRetry: _load,
                )
              : _properties.isEmpty
                  ? const IleEmptyState(
                      title: 'No stays in this area',
                      message: 'Adjust destination or filters and try again.',
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(
                        AppSpacing.screenHorizontal,
                      ),
                      itemCount: _properties.length,
                      separatorBuilder: (_, _) =>
                          const SizedBox(height: 10),
                      itemBuilder: (BuildContext context, int index) {
                        final IleProperty p = _properties[index];
                        return ListTile(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: const BorderSide(color: AppColors.border),
                          ),
                          title: Text(
                            StayDisplay.title(p),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.supporting.copyWith(
                              color: AppColors.foreground,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          subtitle: Text(
                            [
                              p.locationLabel,
                              if (p.distanceKm != null)
                                '${p.distanceKm} km',
                              '≈ ${p.latitude.toStringAsFixed(3)}, ${p.longitude.toStringAsFixed(3)} (offset)',
                            ].join(' · '),
                            style: AppTypography.caption,
                          ),
                          trailing: Text(
                            '₦${IleFormatters.formatInteger(p.pricePerNight)}',
                            style: AppTypography.caption.copyWith(
                              color: AppColors.emerald,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          onTap: () => context.push(
                            AppRoutes.propertyDetailsPath(p.slug),
                          ),
                        );
                      },
                    ),
    );
  }
}
