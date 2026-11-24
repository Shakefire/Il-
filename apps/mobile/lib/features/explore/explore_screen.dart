import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../app/app_spacing.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/guest_flow_errors.dart';
import '../../core/models/property.dart';
import '../../core/state/search_session.dart';
import '../../core/state/wishlist_store.dart';
import '../../core/utils/stay_display.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/skeleton/property_card_skeleton.dart';
import '../search/filters_sheet.dart';
import 'widgets/marketplace_property_card.dart';
/// Apartment Type definition for the horizontal pill bar
class _ApartmentTypeOption {
  const _ApartmentTypeOption({
    required this.label,
    required this.icon,
    this.value,
  });

  final String label;
  final String icon;
  final String? value;
}

const List<_ApartmentTypeOption> _kApartmentTypes = [
  _ApartmentTypeOption(label: 'All Stays', icon: '🏠', value: null),
  _ApartmentTypeOption(label: 'Garden Villa', icon: '🌴', value: 'Garden Villa'),
  _ApartmentTypeOption(label: 'House', icon: '🏡', value: 'House'),
  _ApartmentTypeOption(label: 'Penthouse', icon: '👑', value: 'Penthouse'),
  _ApartmentTypeOption(label: 'Apartment', icon: '🏢', value: 'Apartment'),
  _ApartmentTypeOption(label: 'Studio', icon: '🛋️', value: 'Studio'),
];

/// Marketplace Explore — Booking.com-inspired Architectural Header & Search Flow.
class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen>
    with AutomaticKeepAliveClientMixin {
  final ScrollController _scrollController = ScrollController();
  bool _isLoading = true;
  GuestFlowError? _error;
  List<IleProperty> _properties = <IleProperty>[];
  List<String> _types = <String>[];

  // Local occupancy and toggle state
  int _adults = 2;
  int _children = 0;
  int _bedrooms = 1;
  bool _workFriendly = false;
  bool _petsOnly = false;
  String? _flexibleBadge;

  // Scroll collapse threshold tracking
  bool _isScrolledPastHero = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    final bool past = _scrollController.hasClients && _scrollController.offset > 230;
    if (past != _isScrolledPastHero) {
      setState(() => _isScrolledPastHero = past);
    }
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final IleApi api = context.read<IleApi>();
      final List<IleProperty> list = await api.getPublishedProperties(limit: 40);
      final Set<String> types = <String>{};
      for (final IleProperty property in list) {
        if (property.propertyType.isNotEmpty) types.add(property.propertyType);
      }
      if (!mounted) return;
      setState(() {
        _properties = list;
        _types = types.toList()..sort();
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
      // 1. Apartment Type filter
      final String? type = session.propertyType;
      if (type != null && type.isNotEmpty) {
        final String pType = property.propertyType.toLowerCase();
        final String sType = type.toLowerCase();
        if (sType == 'house' || sType == 'homes') {
          if (!pType.contains('house') && !pType.contains('home')) return false;
        } else if (sType == 'apartment' || sType == 'apartments') {
          if (!pType.contains('apartment')) return false;
        } else if (sType == 'villa' || sType == 'garden villa' || sType == 'villas') {
          if (!pType.contains('villa')) return false;
        } else if (sType == 'penthouse') {
          if (!pType.contains('penthouse')) return false;
        } else if (sType == 'studio') {
          if (!pType.contains('studio')) return false;
        } else if (!pType.contains(sType)) {
          return false;
        }
      }

      // 2. Pet friendly toggle filter
      if (_petsOnly && !property.thingsToKnow.petsAllowed) {
        return false;
      }

      // 3. Guests capacity filter
      final int totalGuests = _adults + _children;
      if (totalGuests > property.maxGuests) {
        return false;
      }

      // 4. Destination filter
      if (session.nearMe) return true;
      if (session.destination.isEmpty) return true;
      return StayDisplay.matchesPlace(property, session.destination);
    }).toList();
  }

  void _selectApartmentType(String? type) {
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

  void _openDestinationSheet() async {
    final SearchSession session = context.read<SearchSession>();
    final String? chosen = await _DestinationSearchSheet.show(
      context,
      initialQuery: session.destination,
    );
    if (chosen != null && mounted) {
      session.setDestination(label: chosen);
      // Auto-advance to date picker to keep the user flow seamless
      _openDatesSheet();
    }
  }

  void _openDatesSheet() async {
    final SearchSession session = context.read<SearchSession>();
    final _DateSelectionResult? res = await _DualTabDateSheet.show(
      context,
      initialCheckIn: session.checkIn,
      initialCheckOut: session.checkOut,
    );
    if (res != null && mounted) {
      session.setDates(start: res.checkIn, end: res.checkOut);
      setState(() {
        _flexibleBadge = res.badge;
      });
    }
  }

  void _openOccupancySheet() async {
    final SearchSession session = context.read<SearchSession>();
    final _OccupancyResult? res = await _OccupancySheet.show(
      context,
      adults: _adults,
      children: _children,
      bedrooms: _bedrooms,
      workFriendly: _workFriendly,
      petsOnly: _petsOnly,
    );
    if (res != null && mounted) {
      setState(() {
        _adults = res.adults;
        _children = res.children;
        _bedrooms = res.bedrooms;
        _workFriendly = res.workFriendly;
        _petsOnly = res.petsOnly;
      });
      session.setGuests(_adults + _children);
    }
  }

  void _openFilters() {
    FiltersSheet.show(
      context,
      availableTypes: _types,
      availableAmenities: _properties
          .expand((p) => p.amenities)
          .toSet()
          .toList()
        ..sort(),
      onApply: () => context.push(AppRoutes.searchResults),
    );
  }

  void _executeSearch() {
    // Smoothly scroll down to the listing feed
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        290,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    }
  }

  void _openProperty(IleProperty property) {
    context.push(
      AppRoutes.propertyDetailsPath(property.slug, heroScope: 'explore'),
    );
  }

  String get _heroTitle {
    final SearchSession session = context.read<SearchSession>();
    final String? type = session.propertyType;
    final String destination = session.destination;
    final String place = destination.isNotEmpty
        ? destination.split(',').first.trim()
        : 'Nigeria';
    if (type == null || type.isEmpty) {
      return 'Search verified stays in $place';
    }
    final String plural = type.endsWith('s') ? type : '${type}s';
    return 'Search $plural in $place';
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final SearchSession session = context.watch<SearchSession>();
    final WishlistStore wishlist = context.watch<WishlistStore>();
    final List<IleProperty> visible = _visible(session);
    final double topInset = MediaQuery.paddingOf(context).top;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: const Color(0xFFFAF8F5), // Warm Alabaster
        body: RefreshIndicator(
          color: const Color(0xFF073B2E),
          onRefresh: _load,
          child: CustomScrollView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              // LAYER 1: Solid Deep Forest Emerald Header with Apartment Types
              SliverPersistentHeader(
                pinned: true,
                delegate: _BookingHeaderDelegate(
                  topInset: topInset,
                  isScrolled: _isScrolledPastHero,
                  selectedType: session.propertyType,
                  onSelectType: _selectApartmentType,
                  destinationLabel: session.destination.isNotEmpty
                      ? session.destination.split(',').first.trim()
                      : 'Anywhere',
                  datesLabel: session.hasDates ? session.datesLabel : 'Any dates',
                  guestsLabel: '${_adults + _children} guests',
                  onTapCompactBar: () {
                    _scrollController.animateTo(
                      0,
                      duration: const Duration(milliseconds: 350),
                      curve: Curves.easeInOut,
                    );
                  },
                  onTapFilter: _openFilters,
                  onTapNotifications: () => context.push(AppRoutes.notifications),
                ),
              ),

              // LAYER 2: Hero Headline & 4-Row Gold-Framed Search Container
              SliverToBoxAdapter(
                child: _HeroSearchSection(
                  heroTitle: _heroTitle,
                  session: session,
                  adults: _adults,
                  children: _children,
                  bedrooms: _bedrooms,
                  flexibleBadge: _flexibleBadge,
                  onTapDestination: _openDestinationSheet,
                  onTapDates: _openDatesSheet,
                  onTapOccupancy: _openOccupancySheet,
                  onClearDestination: () => session.clearPlace(),
                  onSearch: _executeSearch,
                ),
              ),

              // FEED SECTION TITLE ROW
              if (!_isLoading && _error == null && visible.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.screenHorizontal,
                      22,
                      AppSpacing.screenHorizontal,
                      8,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Expanded(
                          child: Text(
                            session.destination.isNotEmpty
                                ? 'Popular stays in ${session.destination.split(',').first.trim()}'
                                : session.propertyType != null
                                    ? 'Curated ${session.propertyType}s'
                                    : 'Popular homes in Abuja & Lagos',
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF141917),
                              letterSpacing: -0.02,
                              fontFamily: 'DM Serif Display',
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Material(
                          color: Colors.white,
                          shape: const CircleBorder(
                            side: BorderSide(color: Color(0xFFE6E2D8)),
                          ),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: _openFilters,
                            child: const SizedBox(
                              width: 32,
                              height: 32,
                              child: Icon(
                                Icons.tune_rounded,
                                size: 16,
                                color: Color(0xFF141917),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

              // LISTING FEED / EMPTY / ERROR / LOADING
              if (_isLoading)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.screenHorizontal,
                    AppSpacing.md,
                    AppSpacing.screenHorizontal,
                    AppSpacing.exploreFeedBottom,
                  ),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (BuildContext context, int index) => const Padding(
                        padding: EdgeInsets.only(bottom: 12),
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
                    title: 'No stays match your criteria',
                    message: session.destination.isNotEmpty
                        ? 'No properties found for "${session.destination}". Try selecting "All Stays" or a nearby district.'
                        : 'No properties found for the selected apartment type.',
                    icon: Icons.apartment_outlined,
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.screenHorizontal,
                    0,
                    AppSpacing.screenHorizontal,
                    AppSpacing.exploreFeedBottom,
                  ),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (BuildContext context, int index) {
                        final IleProperty property = visible[index];
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 14, top: 8),
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
      ),
    );
  }
}

// ============================================================================
// LAYER 1: SOLID DEEP FOREST EMERALD PINNED HEADER DELEGATE
// ============================================================================
class _BookingHeaderDelegate extends SliverPersistentHeaderDelegate {
  _BookingHeaderDelegate({
    required this.topInset,
    required this.isScrolled,
    required this.selectedType,
    required this.onSelectType,
    required this.destinationLabel,
    required this.datesLabel,
    required this.guestsLabel,
    required this.onTapCompactBar,
    required this.onTapFilter,
    required this.onTapNotifications,
  });

  final double topInset;
  final bool isScrolled;
  final String? selectedType;
  final ValueChanged<String?> onSelectType;
  final String destinationLabel;
  final String datesLabel;
  final String guestsLabel;
  final VoidCallback onTapCompactBar;
  final VoidCallback onTapFilter;
  final VoidCallback onTapNotifications;

  static const double _headerContentHeight = 104;

  @override
  double get minExtent => topInset + _headerContentHeight;

  @override
  double get maxExtent => topInset + _headerContentHeight;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF073B2E), // Solid Deep Forest Emerald
        boxShadow: [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.15),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      padding: EdgeInsets.only(top: topInset),
      child: Column(
        children: [
          // ROW 1: Brand title OR Sticky Compact 1-Line Gold Pill
          SizedBox(
            height: 52,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 200),
                child: isScrolled
                    ? _buildCompactGoldBar()
                    : _buildExpandedBrandBar(),
              ),
            ),
          ),

          // ROW 2: Horizontal Apartment-Type Pills (Always pinned, pure contrast)
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              itemCount: _kApartmentTypes.length,
              separatorBuilder: (_, _) => const SizedBox(width: 8),
              itemBuilder: (BuildContext context, int index) {
                final _ApartmentTypeOption opt = _kApartmentTypes[index];
                final bool isSelected = (opt.value == null && selectedType == null) ||
                    (opt.value != null &&
                        selectedType != null &&
                        opt.value!.toLowerCase() == selectedType!.toLowerCase());
                return _ApartmentTypePill(
                  icon: opt.icon,
                  label: opt.label,
                  isSelected: isSelected,
                  onTap: () => onSelectType(opt.value),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExpandedBrandBar() {
    return Row(
      key: const ValueKey('brand_bar'),
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          'Ilé',
          style: TextStyle(
            color: Colors.white,
            fontSize: 26,
            fontWeight: FontWeight.w700,
            fontFamily: 'DM Serif Display',
            letterSpacing: -0.02,
          ),
        ),
        Row(
          children: [
            Material(
              color: Colors.transparent,
              shape: CircleBorder(
                side: BorderSide(
                  color: Colors.white.withOpacity(0.28),
                ),
              ),
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: onTapNotifications,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    const SizedBox(
                      width: 38,
                      height: 38,
                      child: Icon(
                        Icons.notifications_none_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                    Positioned(
                      top: 8,
                      right: 9,
                      child: Container(
                        width: 7,
                        height: 7,
                        decoration: const BoxDecoration(
                          color: Color(0xFFD4AF37),
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCompactGoldBar() {
    return Container(
      key: const ValueKey('compact_bar'),
      height: 42,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFD4AF37), width: 1.5),
        boxShadow: const [
          BoxShadow(
            color: Color.fromRGBO(0, 0, 0, 0.16),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: InkWell(
        onTap: onTapCompactBar,
        borderRadius: BorderRadius.circular(999),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Row(
            children: [
              const Icon(
                Icons.search_rounded,
                color: Color(0xFF073B2E),
                size: 18,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  '$destinationLabel  •  $datesLabel  •  $guestsLabel',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF141917),
                  ),
                ),
              ),
              const SizedBox(width: 6),
              GestureDetector(
                onTap: onTapFilter,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: const BoxDecoration(
                    color: Color(0xFF073B2E),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.tune_rounded,
                    color: Colors.white,
                    size: 14,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  bool shouldRebuild(covariant _BookingHeaderDelegate oldDelegate) {
    return oldDelegate.isScrolled != isScrolled ||
        oldDelegate.selectedType != selectedType ||
        oldDelegate.destinationLabel != destinationLabel ||
        oldDelegate.datesLabel != datesLabel ||
        oldDelegate.guestsLabel != guestsLabel;
  }
}

// ============================================================================
// APARTMENT TYPE PILL (Booking.com style on Emerald)
// ============================================================================
class _ApartmentTypePill extends StatelessWidget {
  const _ApartmentTypePill({
    required this.icon,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String icon;
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: isSelected,
      label: label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: isSelected
                ? Colors.white.withOpacity(0.18)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: isSelected ? Colors.white : Colors.transparent,
              width: 1.5,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(icon, style: const TextStyle(fontSize: 16)),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  color: isSelected
                      ? Colors.white
                      : Colors.white.withOpacity(0.80),
                  letterSpacing: -0.01,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// LAYER 2: HERO SECTION BACKDROP & 4-ROW STACKED SEARCH BOX
// ============================================================================
class _HeroSearchSection extends StatelessWidget {
  const _HeroSearchSection({
    required this.heroTitle,
    required this.session,
    required this.adults,
    required this.children,
    required this.bedrooms,
    required this.flexibleBadge,
    required this.onTapDestination,
    required this.onTapDates,
    required this.onTapOccupancy,
    required this.onClearDestination,
    required this.onSearch,
  });

  final String heroTitle;
  final SearchSession session;
  final int adults;
  final int children;
  final int bedrooms;
  final String? flexibleBadge;
  final VoidCallback onTapDestination;
  final VoidCallback onTapDates;
  final VoidCallback onTapOccupancy;
  final VoidCallback onClearDestination;
  final VoidCallback onSearch;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFF073B2E), // Deep Forest Emerald
            Color(0xFF0D4A3B), // Medium Emerald
            Color(0xFFFAF8F5), // Blends cleanly into Warm Alabaster feed
          ],
          stops: [0.0, 0.72, 1.0],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Dynamic Hero Copy
          Text(
            heroTitle,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.w700,
              color: Colors.white,
              fontFamily: 'DM Serif Display',
              letterSpacing: -0.02,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Enter your dates to see the latest verified prices and instant-book stays',
            style: TextStyle(
              fontSize: 13.5,
              color: Colors.white.withOpacity(0.88),
              height: 1.35,
            ),
          ),
          const SizedBox(height: 18),

          // 4-ROW STACKED SEARCH BOX FRAME (Champagne Gold #D4AF37)
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFFD4AF37), // 4px Gold Outer Frame
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(
                  color: Color.fromRGBO(7, 59, 46, 0.22),
                  blurRadius: 28,
                  offset: Offset(0, 14),
                ),
              ],
            ),
            padding: const EdgeInsets.all(4), // 4px frame border
            child: Column(
              children: [
                // ROW 1: Destination Trigger
                _SearchInputRow(
                  icon: Icons.bed_outlined,
                  topLabel: 'Enter destination',
                  valueText: session.destination.isNotEmpty
                      ? session.destination
                      : 'Where are you going?',
                  isPlaceholder: session.destination.isEmpty,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                  onTap: onTapDestination,
                  trailing: session.destination.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.close, size: 18, color: Color(0xFF6E6B64)),
                          onPressed: onClearDestination,
                        )
                      : null,
                ),
                const SizedBox(height: 3), // 3px gold divider

                // ROW 2: Dates Trigger
                _SearchInputRow(
                  icon: Icons.calendar_today_outlined,
                  topLabel: 'Select dates',
                  valueText: session.hasDates
                      ? session.datesLabel
                      : 'Check-in date — Check-out date',
                  badgeText: flexibleBadge,
                  isPlaceholder: !session.hasDates,
                  borderRadius: BorderRadius.circular(4),
                  onTap: onTapDates,
                ),
                const SizedBox(height: 3), // 3px gold divider

                // ROW 3: Occupancy Trigger
                _SearchInputRow(
                  icon: Icons.person_outline_rounded,
                  topLabel: 'Select occupancy',
                  valueText:
                      '$adults adults · $children children · $bedrooms bedroom${bedrooms > 1 ? 's' : ''}',
                  isPlaceholder: false,
                  borderRadius: BorderRadius.circular(4),
                  trailing: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    size: 22,
                    color: Color(0xFF4A4842),
                  ),
                  onTap: onTapOccupancy,
                ),
                const SizedBox(height: 3), // 3px gold divider

                // ROW 4: Primary Search CTA
                Material(
                  color: const Color(0xFF073B2E),
                  borderRadius:
                      const BorderRadius.vertical(bottom: Radius.circular(12)),
                  child: InkWell(
                    borderRadius:
                        const BorderRadius.vertical(bottom: Radius.circular(12)),
                    onTap: onSearch,
                    child: Container(
                      height: 52,
                      alignment: Alignment.center,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.search_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            session.propertyType != null &&
                                    session.propertyType!.isNotEmpty
                                ? 'Search ${session.propertyType}s'
                                : 'Search verified stays',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 15.5,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.01,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// SEARCH INPUT ROW COMPONENT
// ============================================================================
class _SearchInputRow extends StatelessWidget {
  const _SearchInputRow({
    required this.icon,
    required this.topLabel,
    required this.valueText,
    required this.isPlaceholder,
    required this.borderRadius,
    required this.onTap,
    this.badgeText,
    this.trailing,
  });

  final IconData icon;
  final String topLabel;
  final String valueText;
  final bool isPlaceholder;
  final BorderRadius borderRadius;
  final VoidCallback onTap;
  final String? badgeText;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: borderRadius,
      child: InkWell(
        onTap: onTap,
        borderRadius: borderRadius,
        child: Container(
          height: 58,
          padding: const EdgeInsets.symmetric(horizontal: 14),
          alignment: Alignment.centerLeft,
          child: Row(
            children: [
              Icon(icon, color: const Color(0xFF4A4842), size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      topLabel,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFF6E6B64),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            valueText,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: isPlaceholder
                                  ? FontWeight.w500
                                  : FontWeight.w600,
                              color: isPlaceholder
                                  ? const Color(0xFF8A8780)
                                  : const Color(0xFF141917),
                            ),
                          ),
                        ),
                        if (badgeText != null && badgeText!.isNotEmpty) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEBF3F0),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              badgeText!,
                              style: const TextStyle(
                                fontSize: 10.5,
                                color: Color(0xFF073B2E),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              if (trailing != null) trailing!,
            ],
          ),
        ),
      ),
    );
  }
}

// ============================================================================
// FLOW A: DESTINATION SEARCH & TRENDING DISTRICTS SHEET
// ============================================================================
class _DestinationItem {
  const _DestinationItem({
    required this.cityDistrict,
    required this.stateCountry,
    required this.verifiedCount,
  });
  final String cityDistrict;
  final String stateCountry;
  final int verifiedCount;
}

const List<_DestinationItem> _kTrendingDestinations = [
  _DestinationItem(
    cityDistrict: 'Maitama, Abuja',
    stateCountry: 'Federal Capital Territory • 18 verified stays',
    verifiedCount: 18,
  ),
  _DestinationItem(
    cityDistrict: 'Victoria Island, Lagos',
    stateCountry: 'Lagos State • 24 verified stays',
    verifiedCount: 24,
  ),
  _DestinationItem(
    cityDistrict: 'Ikoyi, Lagos',
    stateCountry: 'Lagos State • 15 verified stays',
    verifiedCount: 15,
  ),
  _DestinationItem(
    cityDistrict: 'Wuse II, Abuja',
    stateCountry: 'Federal Capital Territory • 12 verified stays',
    verifiedCount: 12,
  ),
  _DestinationItem(
    cityDistrict: 'Asokoro, Abuja',
    stateCountry: 'Federal Capital Territory • 9 verified stays',
    verifiedCount: 9,
  ),
  _DestinationItem(
    cityDistrict: 'Lekki Phase 1, Lagos',
    stateCountry: 'Lagos State • 20 verified stays',
    verifiedCount: 20,
  ),
];

class _DestinationSearchSheet extends StatefulWidget {
  const _DestinationSearchSheet({
    required this.initialQuery,
    required this.onSelect,
  });

  final String initialQuery;
  final ValueChanged<String> onSelect;

  static Future<String?> show(BuildContext context, {String initialQuery = ''}) {
    return showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _DestinationSearchSheet(
        initialQuery: initialQuery,
        onSelect: (dest) => Navigator.of(context).pop(dest),
      ),
    );
  }

  @override
  State<_DestinationSearchSheet> createState() =>
      _DestinationSearchSheetState();
}

class _DestinationSearchSheetState extends State<_DestinationSearchSheet> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.initialQuery);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final String query = _ctrl.text.trim().toLowerCase();
    final List<_DestinationItem> filtered = _kTrendingDestinations.where((item) {
      if (query.isEmpty) return true;
      return item.cityDistrict.toLowerCase().contains(query) ||
          item.stateCountry.toLowerCase().contains(query);
    }).toList();

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFDCD8CE),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Search Input Field
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 12),
            child: Container(
              height: 52,
              decoration: BoxDecoration(
                color: const Color(0xFFF7F5F0),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE6E2D8)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Row(
                children: [
                  const Icon(Icons.search_rounded, color: Color(0xFF073B2E)),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      autofocus: true,
                      decoration: const InputDecoration(
                        hintText: 'Where are you going? (e.g. Maitama, Ikoyi)',
                        border: InputBorder.none,
                        isDense: true,
                      ),
                      onChanged: (_) => setState(() {}),
                      onSubmitted: (val) {
                        if (val.trim().isNotEmpty) {
                          widget.onSelect(val.trim());
                        }
                      },
                    ),
                  ),
                  if (_ctrl.text.isNotEmpty)
                    IconButton(
                      icon: const Icon(Icons.close, size: 18),
                      onPressed: () {
                        _ctrl.clear();
                        setState(() {});
                      },
                    ),
                ],
              ),
            ),
          ),

          // Trending Header
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 8, 20, 8),
            child: Text(
              'Trending destinations in Nigeria',
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
                color: Color(0xFF141917),
              ),
            ),
          ),

          // Destinations List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: filtered.length,
              separatorBuilder: (_, _) => const Divider(
                height: 1,
                color: Color(0xFFEFECE6),
              ),
              itemBuilder: (context, index) {
                final _DestinationItem item = filtered[index];
                return ListTile(
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  leading: Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF4F3EF),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(
                      Icons.location_on_outlined,
                      color: Color(0xFF073B2E),
                      size: 22,
                    ),
                  ),
                  title: Text(
                    item.cityDistrict,
                    style: const TextStyle(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF141917),
                    ),
                  ),
                  subtitle: Text(
                    item.stateCountry,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6E6B64),
                    ),
                  ),
                  onTap: () => widget.onSelect(item.cityDistrict),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// FLOW B: DUAL-TAB CALENDAR | I'M FLEXIBLE SHEET
// ============================================================================
class _DateSelectionResult {
  const _DateSelectionResult({
    required this.checkIn,
    required this.checkOut,
    this.badge,
  });
  final String checkIn;
  final String checkOut;
  final String? badge;
}

class _DualTabDateSheet extends StatefulWidget {
  const _DualTabDateSheet({
    this.initialCheckIn,
    this.initialCheckOut,
  });

  final String? initialCheckIn;
  final String? initialCheckOut;

  static Future<_DateSelectionResult?> show(
    BuildContext context, {
    String? initialCheckIn,
    String? initialCheckOut,
  }) {
    return showModalBottomSheet<_DateSelectionResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _DualTabDateSheet(
        initialCheckIn: initialCheckIn,
        initialCheckOut: initialCheckOut,
      ),
    );
  }

  @override
  State<_DualTabDateSheet> createState() => _DualTabDateSheetState();
}

class _DualTabDateSheetState extends State<_DualTabDateSheet>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  DateTime? _startDate;
  DateTime? _endDate;
  String _flexiblePill = 'Exact dates';

  // "I'm flexible" state
  String _stayDuration = 'A weekend';
  final Set<String> _selectedMonths = {'Nov 2026', 'Dec 2026'};

  final List<String> _kMonthCards = [
    'Nov 2026',
    'Dec 2026',
    'Jan 2027',
    'Feb 2027',
    'Mar 2027',
    'Apr 2027',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    if (widget.initialCheckIn != null) {
      _startDate = DateTime.tryParse(widget.initialCheckIn!);
    }
    if (widget.initialCheckOut != null) {
      _endDate = DateTime.tryParse(widget.initialCheckOut!);
    }
    if (_startDate == null) {
      _startDate = DateTime.now().add(const Duration(days: 1));
      _endDate = DateTime.now().add(const Duration(days: 4));
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _onDayTap(DateTime day) {
    setState(() {
      if (_startDate == null || (_startDate != null && _endDate != null)) {
        _startDate = day;
        _endDate = null;
      } else if (_startDate != null && _endDate == null) {
        if (day.isBefore(_startDate!)) {
          _startDate = day;
        } else {
          _endDate = day;
        }
      }
    });
  }

  void _submitDates() {
    if (_tabController.index == 0) {
      if (_startDate == null) return;
      final DateTime end = _endDate ?? _startDate!.add(const Duration(days: 2));
      final String badge =
          _flexiblePill != 'Exact dates' ? '($_flexiblePill)' : '';
      Navigator.of(context).pop(
        _DateSelectionResult(
          checkIn: DateFormat('yyyy-MM-dd').format(_startDate!),
          checkOut: DateFormat('yyyy-MM-dd').format(end),
          badge: badge.isNotEmpty ? badge : null,
        ),
      );
    } else {
      // Flexible Tab submission
      final DateTime now = DateTime.now();
      final DateTime start = now.add(const Duration(days: 2));
      final DateTime end = _stayDuration == 'A week'
          ? start.add(const Duration(days: 7))
          : start.add(const Duration(days: 3));
      Navigator.of(context).pop(
        _DateSelectionResult(
          checkIn: DateFormat('yyyy-MM-dd').format(start),
          checkOut: DateFormat('yyyy-MM-dd').format(end),
          badge: '($_stayDuration)',
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 4),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFDCD8CE),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Two-Tab Switcher
          Container(
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Color(0xFFEFECE6), width: 1),
              ),
            ),
            child: TabBar(
              controller: _tabController,
              indicatorColor: const Color(0xFF073B2E),
              indicatorWeight: 2.5,
              labelColor: const Color(0xFF073B2E),
              unselectedLabelColor: const Color(0xFF6E6B64),
              labelStyle: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
              ),
              tabs: const [
                Tab(text: 'Calendar'),
                Tab(text: "I'm flexible"),
              ],
            ),
          ),

          // Tab Views
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildCalendarTab(),
                _buildFlexibleTab(),
              ],
            ),
          ),

          // Sticky Bottom Confirmation Bar
          Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Color(0xFFEFECE6))),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        _startDate != null && _endDate != null
                            ? '${DateFormat('MMM d').format(_startDate!)} – ${DateFormat('MMM d').format(_endDate!)}'
                            : 'Select dates',
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF141917),
                        ),
                      ),
                      Text(
                        _startDate != null && _endDate != null
                            ? '${_endDate!.difference(_startDate!).inDays} nights · $_flexiblePill'
                            : 'Minimum 1 night stay',
                        style: const TextStyle(
                          fontSize: 12,
                          color: Color(0xFF6E6B64),
                        ),
                      ),
                    ],
                  ),
                ),
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  style: TextButton.styleFrom(
                    foregroundColor: const Color(0xFF6E6B64),
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                  child: const Text('Cancel', style: TextStyle(fontWeight: FontWeight.w600)),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: _startDate != null && _endDate != null ? _submitDates : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF073B2E),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: const Color(0xFFEAE6DF),
                    disabledForegroundColor: const Color(0xFF9E9A90),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 22,
                      vertical: 14,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    _startDate != null && _endDate != null ? 'Confirm Dates' : 'Select dates',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCalendarTab() {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
      children: [
        // Day of week header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: const ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              .map(
                (d) => Text(
                  d,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF6E6B64),
                  ),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 12),

        // Next 3 Months
        _buildMonthCalendar(DateTime(2026, 11, 1)),
        const SizedBox(height: 16),
        _buildMonthCalendar(DateTime(2026, 12, 1)),
        const SizedBox(height: 16),
        _buildMonthCalendar(DateTime(2027, 1, 1)),

        // Flexible date options pills
        const SizedBox(height: 16),
        const Text(
          'Flexible date options',
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: Color(0xFF141917),
          ),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 6,
          children: [
            'Exact dates',
            '± 1 day',
            '± 2 days',
            '± 3 days',
            '± 7 days',
          ].map((pill) {
            final bool sel = _flexiblePill == pill;
            return ChoiceChip(
              label: Text(pill),
              selected: sel,
              selectedColor: const Color(0xFFEBF3F0),
              backgroundColor: Colors.white,
              labelStyle: TextStyle(
                fontSize: 12,
                fontWeight: sel ? FontWeight.w600 : FontWeight.w500,
                color: sel ? const Color(0xFF073B2E) : const Color(0xFF141917),
              ),
              side: BorderSide(
                color: sel ? const Color(0xFF073B2E) : const Color(0xFFDCD8CE),
              ),
              onSelected: (_) => setState(() => _flexiblePill = pill),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildMonthCalendar(DateTime month) {
    final int daysInMonth = DateTime(month.year, month.month + 1, 0).day;
    final int firstWeekday = DateTime(month.year, month.month, 1).weekday; // 1 = Mon
    final String monthName = DateFormat('MMMM yyyy').format(month);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Text(
            monthName,
            style: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              fontFamily: 'DM Serif Display',
              color: Color(0xFF141917),
            ),
          ),
        ),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 7,
            mainAxisSpacing: 4,
            crossAxisSpacing: 4,
          ),
          itemCount: (firstWeekday - 1) + daysInMonth,
          itemBuilder: (context, index) {
            if (index < firstWeekday - 1) {
              return const SizedBox();
            }
            final int dayNum = index - (firstWeekday - 2);
            final DateTime current = DateTime(month.year, month.month, dayNum);

            final bool isStart = _startDate != null &&
                _startDate!.year == current.year &&
                _startDate!.month == current.month &&
                _startDate!.day == current.day;

            final bool isEnd = _endDate != null &&
                _endDate!.year == current.year &&
                _endDate!.month == current.month &&
                _endDate!.day == current.day;

            final bool isInRange = _startDate != null &&
                _endDate != null &&
                current.isAfter(_startDate!) &&
                current.isBefore(_endDate!);

            return InkWell(
              onTap: () => _onDayTap(current),
              borderRadius: BorderRadius.circular(20),
              child: Container(
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: isStart || isEnd
                      ? const Color(0xFF073B2E)
                      : isInRange
                          ? const Color(0xFFEBF3F0)
                          : Colors.transparent,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  '$dayNum',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: isStart || isEnd || isInRange
                        ? FontWeight.w700
                        : FontWeight.w500,
                    color: isStart || isEnd
                        ? Colors.white
                        : isInRange
                            ? const Color(0xFF073B2E)
                            : const Color(0xFF141917),
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildFlexibleTab() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Heading 1: Duration
        const Text(
          'How long do you want to stay?',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Color(0xFF141917),
          ),
        ),
        const SizedBox(height: 10),
        Column(
          children: ['A weekend', 'A week', 'A month', 'Other'].map((opt) {
            final bool sel = _stayDuration == opt;
            return ListTile(
              contentPadding: EdgeInsets.zero,
              leading: Icon(
                sel ? Icons.radio_button_checked : Icons.radio_button_off,
                color: sel ? const Color(0xFF073B2E) : const Color(0xFF8A8780),
              ),
              title: Text(
                opt,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: sel ? FontWeight.w600 : FontWeight.w500,
                  color: const Color(0xFF141917),
                ),
              ),
              onTap: () => setState(() => _stayDuration = opt),
            );
          }).toList(),
        ),
        const SizedBox(height: 20),

        // Heading 2: Months
        const Text(
          'When do you want to go?',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Color(0xFF141917),
          ),
        ),
        const SizedBox(height: 2),
        const Text(
          'Select up to 3 months',
          style: TextStyle(fontSize: 12, color: Color(0xFF6E6B64)),
        ),
        const SizedBox(height: 14),

        SizedBox(
          height: 94,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _kMonthCards.length,
            separatorBuilder: (_, _) => const SizedBox(width: 10),
            itemBuilder: (context, index) {
              final String m = _kMonthCards[index];
              final bool sel = _selectedMonths.contains(m);
              final List<String> parts = m.split(' ');
              return InkWell(
                onTap: () {
                  setState(() {
                    if (sel) {
                      _selectedMonths.remove(m);
                    } else if (_selectedMonths.length < 3) {
                      _selectedMonths.add(m);
                    }
                  });
                },
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  width: 86,
                  height: 92,
                  decoration: BoxDecoration(
                    color: sel ? const Color(0xFFEBF3F0) : Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: sel
                          ? const Color(0xFF073B2E)
                          : const Color(0xFFD5D0C5),
                      width: sel ? 1.5 : 1,
                    ),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.calendar_month_outlined,
                        color: sel
                            ? const Color(0xFF073B2E)
                            : const Color(0xFF6E6B64),
                        size: 22,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        parts[0],
                        style: TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: sel
                              ? const Color(0xFF073B2E)
                              : const Color(0xFF141917),
                        ),
                      ),
                      Text(
                        parts[1],
                        style: const TextStyle(
                          fontSize: 11,
                          color: Color(0xFF6E6B64),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

// ============================================================================
// FLOW C: OCCUPANCY & WORK/PET TOGGLES SHEET
// ============================================================================
class _OccupancyResult {
  const _OccupancyResult({
    required this.adults,
    required this.children,
    required this.bedrooms,
    required this.workFriendly,
    required this.petsOnly,
  });

  final int adults;
  final int children;
  final int bedrooms;
  final bool workFriendly;
  final bool petsOnly;
}

class _OccupancySheet extends StatefulWidget {
  const _OccupancySheet({
    required this.adults,
    required this.children,
    required this.bedrooms,
    required this.workFriendly,
    required this.petsOnly,
  });

  final int adults;
  final int children;
  final int bedrooms;
  final bool workFriendly;
  final bool petsOnly;

  static Future<_OccupancyResult?> show(
    BuildContext context, {
    required int adults,
    required int children,
    required int bedrooms,
    required bool workFriendly,
    required bool petsOnly,
  }) {
    return showModalBottomSheet<_OccupancyResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _OccupancySheet(
        adults: adults,
        children: children,
        bedrooms: bedrooms,
        workFriendly: workFriendly,
        petsOnly: petsOnly,
      ),
    );
  }

  @override
  State<_OccupancySheet> createState() => _OccupancySheetState();
}

class _OccupancySheetState extends State<_OccupancySheet> {
  late int _adults;
  late int _children;
  late int _bedrooms;
  late bool _workFriendly;
  late bool _petsOnly;

  @override
  void initState() {
    super.initState();
    _adults = widget.adults;
    _children = widget.children;
    _bedrooms = widget.bedrooms;
    _workFriendly = widget.workFriendly;
    _petsOnly = widget.petsOnly;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(bottom: 16),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFDCD8CE),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Stepper Rows
          _buildStepperRow(
            label: 'Adults',
            subtitle: 'Ages 13 or above',
            count: _adults,
            min: 1,
            max: 16,
            onChanged: (val) => setState(() => _adults = val),
          ),
          const Divider(height: 24, color: Color(0xFFEFECE6)),
          _buildStepperRow(
            label: 'Children',
            subtitle: 'Ages 0 – 12',
            count: _children,
            min: 0,
            max: 10,
            onChanged: (val) => setState(() => _children = val),
          ),
          const Divider(height: 24, color: Color(0xFFEFECE6)),
          _buildStepperRow(
            label: 'Bedrooms / Units',
            subtitle: 'Minimum bedrooms required',
            count: _bedrooms,
            min: 1,
            max: 10,
            onChanged: (val) => setState(() => _bedrooms = val),
          ),
          const Divider(height: 28, color: Color(0xFFEFECE6)),

          // 2 Switch Rows
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'Travelling for work / Remote work?',
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF141917),
              ),
            ),
            subtitle: const Text(
              'Prioritizes stays with Starlink WiFi & dedicated desk',
              style: TextStyle(fontSize: 12, color: Color(0xFF6E6B64)),
            ),
            value: _workFriendly,
            activeColor: const Color(0xFF073B2E),
            onChanged: (v) => setState(() => _workFriendly = v),
          ),
          const SizedBox(height: 6),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text(
              'Travelling with pets?',
              style: TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF141917),
              ),
            ),
            subtitle: const Text(
              "Assistance animals aren't considered pets.",
              style: TextStyle(fontSize: 12, color: Color(0xFF6E6B64)),
            ),
            value: _petsOnly,
            activeColor: const Color(0xFF073B2E),
            onChanged: (v) => setState(() => _petsOnly = v),
          ),
          const SizedBox(height: 20),

          // Done Button
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop(
                  _OccupancyResult(
                    adults: _adults,
                    children: _children,
                    bedrooms: _bedrooms,
                    workFriendly: _workFriendly,
                    petsOnly: _petsOnly,
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF073B2E),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                'Done',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepperRow({
    required String label,
    required String subtitle,
    required int count,
    required int min,
    required int max,
    required ValueChanged<int> onChanged,
  }) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: const TextStyle(
                fontSize: 14.5,
                fontWeight: FontWeight.w600,
                color: Color(0xFF141917),
              ),
            ),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 12, color: Color(0xFF6E6B64)),
            ),
          ],
        ),
        Container(
          width: 126,
          height: 38,
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFFDCD8CE)),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                padding: EdgeInsets.zero,
                iconSize: 18,
                icon: Icon(
                  Icons.remove,
                  color: count > min
                      ? const Color(0xFF073B2E)
                      : const Color(0xFFC5C1B8),
                ),
                onPressed: count > min ? () => onChanged(count - 1) : null,
              ),
              Text(
                '$count',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF141917),
                ),
              ),
              IconButton(
                padding: EdgeInsets.zero,
                iconSize: 18,
                icon: Icon(
                  Icons.add,
                  color: count < max
                      ? const Color(0xFF073B2E)
                      : const Color(0xFFC5C1B8),
                ),
                onPressed: count < max ? () => onChanged(count + 1) : null,
              ),
            ],
          ),
        ),
      ],
    );
  }
}
