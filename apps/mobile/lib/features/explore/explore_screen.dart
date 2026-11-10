import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/guest_flow_errors.dart';
import '../../core/models/property.dart';
import '../../core/state/search_session.dart';
import '../../core/state/wishlist_store.dart';
import '../../core/utils/stay_display.dart';
import '../../shared/widgets/editorial_chrome.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/skeleton/property_card_skeleton.dart';
import '../../shared/widgets/skeleton/skeleton_box.dart';
import '../search/filters_sheet.dart';
import 'widgets/marketplace_property_card.dart';

/// Marketplace Explore — editorial greeting, search, and curated stays.
class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  bool _isLoading = true;
  GuestFlowError? _error;
  List<IleProperty> _properties = <IleProperty>[];
  List<String> _types = <String>[];
  Map<String, dynamic>? _user;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final IleApi api = context.read<IleApi>();
      final List<IleProperty> list = await api.getPublishedProperties(limit: 40);
      final Map<String, dynamic>? user = await api.getCurrentUser();
      final Set<String> types = <String>{};
      for (final IleProperty property in list) {
        if (property.propertyType.isNotEmpty) types.add(property.propertyType);
      }
      if (!mounted) return;
      setState(() {
        _properties = list;
        _types = types.toList()..sort();
        _user = user;
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

  List<IleProperty> _visible(SearchSession session) {
    return _properties.where((IleProperty property) {
      final String? type = session.propertyType;
      if (type != null &&
          property.propertyType.toLowerCase() != type.toLowerCase()) {
        return false;
      }
      if (session.nearMe) return true;
      if (session.destination.isEmpty) return true;
      return StayDisplay.matchesPlace(property, session.destination);
    }).toList();
  }

  List<String> get _availableAmenities {
    final Set<String> set = <String>{};
    for (final IleProperty property in _properties) {
      set.addAll(property.amenities);
    }
    return set.toList()..sort();
  }

  void _openFilters() {
    FiltersSheet.show(
      context,
      availableTypes: _types,
      availableAmenities: _availableAmenities,
      onApply: () => context.push(AppRoutes.searchResults),
    );
  }

  void _openProperty(IleProperty property) {
    context.push(
      AppRoutes.propertyDetailsPath(property.slug, heroScope: 'explore'),
    );
  }

  String get _firstName {
    final dynamic raw = _user?['firstName'];
    if (raw is String && raw.trim().isNotEmpty) return raw.trim();
    return '';
  }

  bool _placeActive(SearchSession session) {
    return session.nearMe || session.destination.isNotEmpty;
  }

  void _selectType(String? type) {
    final SearchSession session = context.read<SearchSession>();
    session.setFilters(
      type: type,
      beds: session.bedrooms,
      baths: session.bathrooms,
      min: session.minPrice,
      max: session.maxPrice,
      power: session.powerType,
      amenitySet: session.amenities,
    );
  }

  void _resetBrowse(SearchSession session) {
    session.clearPlace();
    session.setFilters(
      beds: session.bedrooms,
      baths: session.bathrooms,
      min: session.minPrice,
      max: session.maxPrice,
      power: session.powerType,
      amenitySet: session.amenities,
    );
  }

  @override
  Widget build(BuildContext context) {
    final SearchSession session = context.watch<SearchSession>();
    final WishlistStore wishlist = context.watch<WishlistStore>();
    final bool signedIn = _user != null;
    final bool showReset =
        session.propertyType != null || _placeActive(session);
    final List<IleProperty> visible = _visible(session);
    final double top = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.dark,
      child: Scaffold(
        backgroundColor: EditorialColors.background,
        body: Stack(
          children: [
            RefreshIndicator(
              color: EditorialColors.brand,
              onRefresh: _load,
              child: CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _ExploreHeaderDelegate(
                      topInset: top,
                      showReset: showReset,
                      onReset: () => _resetBrowse(session),
                      greeting: _Greeting(
                        loading: _isLoading && _properties.isEmpty,
                        name: signedIn ? _firstName : '',
                        onNotifications: () =>
                            context.push(AppRoutes.notifications),
                      ),
                      search: _SearchField(
                        session: session,
                        onSearchTap: () =>
                            context.push(AppRoutes.destinationSearch),
                        onFilterTap: _openFilters,
                        compact: false,
                      ),
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: SizedBox(
                      height: 52,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.screenHorizontal,
                        ),
                        itemCount: _types.length + 1,
                        separatorBuilder: (_, _) => const SizedBox(width: 8),
                        itemBuilder: (BuildContext context, int index) {
                          if (index == 0) {
                            return _ChoiceChip(
                              label: 'All Stays',
                              selected: session.propertyType == null,
                              onTap: () => _selectType(null),
                            );
                          }
                          final String type = _types[index - 1];
                          return _ChoiceChip(
                            label: type,
                            selected: session.propertyType == type,
                            onTap: () => _selectType(
                              session.propertyType == type ? null : type,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  if (_isLoading)
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.screenHorizontal,
                        AppSpacing.md,
                        AppSpacing.screenHorizontal,
                        AppSpacing.xxl,
                      ),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (BuildContext context, int index) => const Padding(
                            padding: EdgeInsets.only(bottom: AppSpacing.lg),
                            child: PropertyCardSkeleton(),
                          ),
                          childCount: 3,
                        ),
                      ),
                    )
                  else if (_error != null)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: IleErrorState(
                        title: _error!.title,
                        message: _error!.message,
                        onRetry: _load,
                      ),
                    )
                  else if (visible.isEmpty)
                    SliverFillRemaining(
                      hasScrollBody: false,
                      child: IleEmptyState(
                        title: _placeActive(session) || session.propertyType != null
                            ? 'No stays match this filter'
                            : 'No published stays yet',
                        message: _placeActive(session)
                            ? 'Nothing published for ${session.destination} yet. Try another place.'
                            : 'When hosts publish listings, they will appear here.',
                        icon: Icons.home_work_outlined,
                      ),
                    )
                  else
                    SliverPadding(
                      padding: EdgeInsets.fromLTRB(
                        AppSpacing.screenHorizontal,
                        AppSpacing.md,
                        AppSpacing.screenHorizontal,
                        EditorialLayout.dockClearance(context) + 88,
                      ),
                      sliver: SliverList(
                        delegate: SliverChildBuilderDelegate(
                          (BuildContext context, int index) {
                            final IleProperty property = visible[index];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                              child: MarketplacePropertyCard(
                                property: property,
                                heroScope: 'explore',
                                isWishListed: wishlist.contains(property.id),
                                onTap: () => _openProperty(property),
                                onToggleWishlist: () => wishlist.toggle(property),
                              ),
                            );
                          },
                          childCount: visible.length,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              // Thumb zone above floating dock — fixed to viewport, not feed scroll.
              bottom: EditorialLayout.dockClearance(context) + 16,
              child: SafeArea(
                top: false,
                left: false,
                right: false,
                bottom: false,
                child: Center(
                  child: _MapPill(
                    onPressed: () => context.push(AppRoutes.mapSearch),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExploreHeaderDelegate extends SliverPersistentHeaderDelegate {
  _ExploreHeaderDelegate({
    required this.topInset,
    required this.greeting,
    required this.search,
    required this.showReset,
    required this.onReset,
  });

  final double topInset;
  final Widget greeting;
  final Widget search;
  final bool showReset;
  final VoidCallback onReset;

  static const double _greet = 78;
  static const double _search = 68;

  @override
  double get minExtent => topInset + _search;

  @override
  double get maxExtent => topInset + _greet + _search;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    final double range = maxExtent - minExtent;
    final double t = range <= 0 ? 1 : (shrinkOffset / range).clamp(0, 1);
    final bool reduce = EditorialLayout.reduceMotion(context);
    final double greetOpacity = reduce ? (t > 0.5 ? 0 : 1) : (1 - t);
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(
          sigmaX: t > 0.05 ? 20 : 0,
          sigmaY: t > 0.05 ? 20 : 0,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: Color.lerp(
              EditorialColors.background,
              EditorialColors.glass,
              t,
            ),
            border: Border(
              bottom: BorderSide(
                color: EditorialColors.hairline.withValues(alpha: t),
              ),
            ),
          ),
          child: Padding(
            padding: EdgeInsets.only(top: topInset),
            child: Column(
              children: [
                SizedBox(
                  height: _greet * (1 - t),
                  child: ClipRect(
                    child: Opacity(
                    opacity: greetOpacity,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.screenHorizontal,
                      ),
                      child: greeting,
                    ),
                  ),
                  ),
                ),
                SizedBox(
                  height: _search,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      8,
                      6,
                      AppSpacing.screenHorizontal,
                      8,
                    ),
                    child: Row(
                      children: [
                        if (showReset)
                          IleResetButton(onPressed: onReset)
                        else
                          const SizedBox(width: 12),
                        Expanded(child: search),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _ExploreHeaderDelegate oldDelegate) => true;
}

class IleResetButton extends StatelessWidget {
  const IleResetButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'All stays',
      onPressed: onPressed,
      icon: const Icon(Icons.arrow_back_rounded, color: EditorialColors.brand),
      constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({
    required this.loading,
    required this.name,
    required this.onNotifications,
  });

  final bool loading;
  final String name;
  final VoidCallback onNotifications;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 20,
          backgroundColor: EditorialColors.shimmerStart,
          child: Text(
            name.isNotEmpty ? name[0].toUpperCase() : 'G',
            style: AppTypography.cardTitle.copyWith(
              color: EditorialColors.brand,
              fontSize: 16,
            ),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: loading
              ? const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SkeletonBox(width: 148, height: 16),
                    SizedBox(height: 6),
                    SkeletonBox(width: 180, height: 12),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      name.isNotEmpty ? 'Hello $name,' : 'Hello,',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.cardTitle.copyWith(
                        fontFamily: AppTypography.displayFamily,
                        fontWeight: FontWeight.w400,
                        fontSize: 22,
                        color: EditorialColors.ink,
                      ),
                    ),
                    Text(
                      'Discover curated stays in Nigeria',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.supporting.copyWith(
                        color: EditorialColors.inkMuted,
                      ),
                    ),
                  ],
                ),
        ),
        IconButton(
          tooltip: 'Notifications',
          onPressed: onNotifications,
          icon: const Icon(
            Icons.notifications_none_rounded,
            color: EditorialColors.brand,
          ),
          constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
        ),
      ],
    );
  }
}

class _SearchField extends StatelessWidget {
  const _SearchField({
    required this.session,
    required this.onSearchTap,
    required this.onFilterTap,
    required this.compact,
  });

  final SearchSession session;
  final VoidCallback onSearchTap;
  final VoidCallback onFilterTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final bool hasPlace = session.nearMe || session.destination.isNotEmpty;
    final String title = hasPlace ? session.destinationLabel : 'Where to next?';
    final String subtitle = <String>[
      if (!hasPlace) 'Anywhere',
      session.datesLabel,
      session.guestsLabel,
    ].join('  •  ');
    return Material(
      color: EditorialColors.card,
      borderRadius: AppRadius.pillAll,
      child: InkWell(
        onTap: onSearchTap,
        borderRadius: AppRadius.pillAll,
        child: Ink(
          height: 52,
          decoration: BoxDecoration(
            color: EditorialColors.card,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: EditorialColors.hairline),
            boxShadow: const [
              BoxShadow(
                color: Color(0x0F0A2E24),
                offset: Offset(0, 8),
                blurRadius: 20,
                spreadRadius: -6,
              ),
            ],
          ),
          child: Row(
            children: [
              const SizedBox(width: 14),
              const Icon(Icons.search_rounded, color: EditorialColors.brand, size: 22),
              const SizedBox(width: 10),
              Expanded(
                child: compact
                    ? Text(
                        '$title  •  $subtitle',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.supporting.copyWith(
                          color: EditorialColors.ink,
                          fontWeight: FontWeight.w600,
                        ),
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.supporting.copyWith(
                              color: EditorialColors.ink,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          Text(
                            subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.caption.copyWith(
                              color: EditorialColors.inkMuted,
                            ),
                          ),
                        ],
                      ),
              ),
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: Material(
                  color: session.hasActiveFilters
                      ? EditorialColors.brandPressed
                      : EditorialColors.brand,
                  shape: const CircleBorder(),
                  child: InkWell(
                    onTap: onFilterTap,
                    customBorder: const CircleBorder(),
                    child: const SizedBox(
                      width: 44,
                      height: 44,
                      child: Icon(
                        Icons.tune_rounded,
                        color: EditorialColors.onBrand,
                        size: 18,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ChoiceChip extends StatelessWidget {
  const _ChoiceChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color fill =
        selected ? EditorialColors.brand : EditorialColors.card;
    final Color border = selected
        ? EditorialColors.brand
        : EditorialColors.hairline;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: Ink(
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: fill,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: border),
          ),
          child: Center(
            child: Text(
              label,
              style: AppTypography.supporting.copyWith(
                color: selected ? EditorialColors.onBrand : EditorialColors.ink,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MapPill extends StatelessWidget {
  const _MapPill({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Map',
      child: Material(
        color: EditorialColors.brand,
        borderRadius: AppRadius.pillAll,
        elevation: 0,
        child: InkWell(
          onTap: onPressed,
          borderRadius: AppRadius.pillAll,
          child: Ink(
            height: 48,
            padding: const EdgeInsets.symmetric(horizontal: 18),
            decoration: BoxDecoration(
              color: EditorialColors.brand,
              borderRadius: AppRadius.pillAll,
              boxShadow: const [
                BoxShadow(
                  color: Color(0x33073B2E),
                  offset: Offset(0, 8),
                  blurRadius: 18,
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.map_outlined, color: EditorialColors.onBrand, size: 18),
                const SizedBox(width: 8),
                Text(
                  'Map',
                  style: AppTypography.supporting.copyWith(
                    color: EditorialColors.onBrand,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
