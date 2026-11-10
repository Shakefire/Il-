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
import '../../core/models/search_response.dart';
import '../../core/state/search_session.dart';
import '../../core/state/wishlist_store.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/skeleton/property_card_skeleton.dart';
import '../explore/widgets/marketplace_property_card.dart';
import 'filters_sheet.dart';

class SearchResultsScreen extends StatefulWidget {
  const SearchResultsScreen({super.key});

  @override
  State<SearchResultsScreen> createState() => _SearchResultsScreenState();
}

class _SearchResultsScreenState extends State<SearchResultsScreen> {
  bool _isLoading = true;
  GuestFlowError? _error;
  List<IleProperty> _properties = <IleProperty>[];
  SearchPagination _pagination = const SearchPagination(
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  );
  int _page = 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _search());
  }

  Future<void> _search({int page = 1}) async {
    final SearchSession session = context.read<SearchSession>();
    setState(() {
      _isLoading = true;
      _error = null;
      _page = page;
    });
    try {
      final SearchResponse response = await context.read<IleApi>().search(
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
            powerType: session.powerType,
            amenities: session.amenities.isEmpty
                ? null
                : session.amenities.join(','),
            sort: session.sort,
            page: page,
            limit: 20,
          );
      if (!mounted) return;
      setState(() {
        _properties = response.properties;
        // Client-side bathrooms filter (backend SearchParams lacks bathrooms)
        if (session.bathrooms != null) {
          _properties = _properties
              .where((IleProperty p) => p.bathrooms >= session.bathrooms!)
              .toList();
        }
        _pagination = response.pagination;
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

  List<String> get _typesFromResults {
    return _properties
        .map((IleProperty p) => p.propertyType)
        .where((String t) => t.isNotEmpty)
        .toSet()
        .toList()
      ..sort();
  }

  List<String> get _amenitiesFromResults {
    final Set<String> set = <String>{};
    for (final IleProperty p in _properties) {
      set.addAll(p.amenities);
    }
    return set.toList()..sort();
  }

  @override
  Widget build(BuildContext context) {
    final SearchSession session = context.watch<SearchSession>();
    final WishlistStore wishlist = context.watch<WishlistStore>();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: InkWell(
          onTap: () async {
            await context.push(
              AppRoutes.dateGuestPickerPath(editMode: true),
            );
            if (!mounted) return;
            await _search(page: _page);
          },
          borderRadius: BorderRadius.circular(8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                session.destinationLabel,
                style: AppTypography.cardTitle,
              ),
              Text(
                '${session.datesLabel} · ${session.guestsLabel}',
                style: AppTypography.caption,
              ),
            ],
          ),
        ),
        actions: [
          IconButton(
            tooltip: 'Filters',
            onPressed: () => FiltersSheet.show(
              context,
              availableTypes: _typesFromResults,
              availableAmenities: _amenitiesFromResults,
              onApply: () => _search(),
            ),
            icon: const Icon(Icons.tune_rounded, color: AppColors.emerald),
          ),
        ],
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
                  onRetry: () => _search(page: _page),
                )
              : _properties.isEmpty
                  ? IleEmptyState(
                      title: 'No stays match',
                      message:
                          'Try a wider area, different dates, or clear filters.',
                      icon: Icons.search_off_rounded,
                      actionLabel: 'Edit search',
                      onAction: () =>
                          context.push(AppRoutes.destinationSearch),
                    )
                  : RefreshIndicator(
                      color: AppColors.emerald,
                      onRefresh: () => _search(page: _page),
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.screenHorizontal,
                          AppSpacing.sm,
                          AppSpacing.screenHorizontal,
                          AppSpacing.xxl,
                        ),
                        itemCount: _properties.length + 1,
                        itemBuilder: (BuildContext context, int index) {
                          if (index == _properties.length) {
                            return _PaginationBar(
                              pagination: _pagination,
                              onPrev: _pagination.hasPrev
                                  ? () => _search(page: _page - 1)
                                  : null,
                              onNext: _pagination.hasNext
                                  ? () => _search(page: _page + 1)
                                  : null,
                            );
                          }
                          final IleProperty property = _properties[index];
                          return Padding(
                            padding:
                                const EdgeInsets.only(bottom: AppSpacing.xl),
                            child: MarketplacePropertyCard(
                              property: property,
                              heroScope: 'search',
                              isWishListed: wishlist.contains(property.id),
                              onTap: () => context.push(
                                AppRoutes.propertyDetailsPath(
                                  property.slug,
                                  heroScope: 'search',
                                ),
                              ),
                              onToggleWishlist: () =>
                                  wishlist.toggle(property),
                            ),
                          );
                        },
                      ),
                    ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(AppRoutes.mapSearch),
        backgroundColor: AppColors.charcoal,
        foregroundColor: AppColors.onDark,
        icon: const Icon(Icons.map_outlined),
        label: const Text('Map'),
      ),
    );
  }
}

class _PaginationBar extends StatelessWidget {
  const _PaginationBar({
    required this.pagination,
    required this.onPrev,
    required this.onNext,
  });

  final SearchPagination pagination;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  @override
  Widget build(BuildContext context) {
    if (pagination.totalPages <= 1) {
      return Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 24),
        child: Text(
          '${pagination.total} stays',
          textAlign: TextAlign.center,
          style: AppTypography.caption,
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          TextButton(
            onPressed: onPrev,
            child: const Text('Previous'),
          ),
          Text(
            'Page ${pagination.page} of ${pagination.totalPages}',
            style: AppTypography.supporting,
          ),
          TextButton(
            onPressed: onNext,
            child: const Text('Next'),
          ),
        ],
      ),
    );
  }
}
