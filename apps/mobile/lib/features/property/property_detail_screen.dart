import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_shadows.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/guest_flow_errors.dart';
import '../../core/models/amenity.dart';
import '../../core/models/property.dart';
import '../../core/pricing/guest_price_estimate.dart';
import '../../core/state/search_session.dart';
import '../../core/state/wishlist_store.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/stay_display.dart';
import '../../shared/widgets/editorial_chrome.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/skeleton/skeleton_box.dart';
import 'amenities_screen.dart';
import '../../core/services/nearby_neighborhoods_service.dart';

class PropertyDetailScreen extends StatefulWidget {
  const PropertyDetailScreen({
    super.key,
    required this.slug,
    this.heroScope,
  });

  final String slug;
  final String? heroScope;

  @override
  State<PropertyDetailScreen> createState() => _PropertyDetailScreenState();
}

class _PropertyDetailScreenState extends State<PropertyDetailScreen> {
  final ScrollController _scroll = ScrollController();
  bool _isLoading = true;
  GuestFlowError? _error;
  IleProperty? _property;
  int _galleryIndex = 0;
  double _collapse = 0;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_handleScroll);
    _load();
  }

  @override
  void dispose() {
    _scroll
      ..removeListener(_handleScroll)
      ..dispose();
    super.dispose();
  }

  void _handleScroll() {
    final double next = ((_scroll.offset - 220) / 80).clamp(0, 1);
    if ((next - _collapse).abs() < 0.02) return;
    setState(() => _collapse = next);
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final IleProperty? property =
          await context.read<IleApi>().getProperty(widget.slug);
      if (!mounted) return;
      setState(() {
        _property = property;
        _isLoading = false;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = GuestFlowError.from(err, surface: 'property');
        _isLoading = false;
      });
    }
  }

  void _openDateEditor(IleProperty property) {
    context.push(
      AppRoutes.dateGuestPickerPath(
        editMode: true,
        maxGuests: property.maxGuests,
        minimumNights: property.minimumNights,
        propertyId: property.id,
        slug: property.slug,
        nightlyRate: property.pricePerNight,
      ),
    );
  }

  void _openAmenities(IleProperty property) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AmenitiesScreen(
          title: StayDisplay.title(property),
          amenities: property.amenityItems,
        ),
      ),
    );
  }

  Future<void> _share(IleProperty property) async {
    final String summary = <String>[
      StayDisplay.title(property),
      if (property.locationLabel.isNotEmpty) property.locationLabel,
      '₦${IleFormatters.formatInteger(property.pricePerNight)} per night',
    ].join(' · ');
    await Clipboard.setData(ClipboardData(text: summary));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Stay summary copied')),
    );
  }

  List<_SleepCardData> _sleepCards(IleProperty property) {
    if (property.bedrooms <= 0 && property.beds <= 0) {
      return const <_SleepCardData>[];
    }
    final int rooms = property.bedrooms > 0 ? property.bedrooms : 1;
    final int totalBeds = property.beds > 0 ? property.beds : rooms;
    final List<_SleepCardData> cards = <_SleepCardData>[];
    int remaining = totalBeds;
    for (int i = 0; i < rooms; i++) {
      final int leftRooms = rooms - i;
      final int bedsHere = (remaining / leftRooms).ceil().clamp(1, remaining);
      remaining -= bedsHere;
      cards.add(
        _SleepCardData(
          title: rooms == 1 ? 'Bedroom' : 'Bedroom ${i + 1}',
          subtitle: bedsHere == 1 ? '1 bed' : '$bedsHere beds',
        ),
      );
    }
    return cards;
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: EditorialColors.background,
        body: SafeArea(
          child: Padding(
            padding: EdgeInsets.all(AppSpacing.screenHorizontal),
            child: Column(
              children: [
                SkeletonBox(width: double.infinity, height: 320),
                SizedBox(height: AppSpacing.md),
                SkeletonBox(width: 220, height: 22),
                SizedBox(height: AppSpacing.sm),
                SkeletonBox(width: 160, height: 14),
              ],
            ),
          ),
        ),
      );
    }
    if (_error != null) {
      return Scaffold(
        backgroundColor: EditorialColors.background,
        body: SafeArea(
          child: Column(
            children: [
              const Align(
                alignment: Alignment.centerLeft,
                child: IleCircularBackButton(visualSize: 38),
              ),
              Expanded(
                child: IleErrorState(
                  title: _error!.title,
                  message: _error!.message,
                  onRetry: _load,
                ),
              ),
            ],
          ),
        ),
      );
    }
    final IleProperty? property = _property;
    if (property == null) {
      return Scaffold(
        backgroundColor: EditorialColors.background,
        body: SafeArea(
          child: Column(
            children: [
              const Align(
                alignment: Alignment.centerLeft,
                child: IleCircularBackButton(visualSize: 38),
              ),
              const Expanded(
                child: IleEmptyState(
                  title: 'Stay not found',
                  message: 'This listing may be unpublished or removed.',
                ),
              ),
            ],
          ),
        ),
      );
    }

    final WishlistStore wishlist = context.watch<WishlistStore>();
    final SearchSession session = context.watch<SearchSession>();
    final List<String> images = StayDisplay.gallery(property);
    final String title = StayDisplay.title(property);
    final List<_SleepCardData> sleepCards = _sleepCards(property);
    final List<IleAmenity> previewAmenities = property.amenityItems.take(6).toList();
    final String? capacityHint = session.validateAgainstListing(
      maxGuests: property.maxGuests,
      minimumNights: property.minimumNights,
    );
    final int nights = session.nightsCount();
    final GuestPriceEstimate? estimate = session.hasDates && nights > 0
        ? GuestPriceEstimate.fromNightly(
            nightlyRate: property.pricePerNight,
            nights: nights,
          )
        : null;
    final bool saved = wishlist.contains(property.id);
    // Always brand ink on glass — cream-on-cream made the back circle look blank.
    const Color iconColor = EditorialColors.brand;
    final Widget gallery = images.isEmpty
        ? const EditorialShimmer(showMark: true)
        : PageView.builder(
            itemCount: images.length,
            onPageChanged: (int index) => setState(() => _galleryIndex = index),
            itemBuilder: (BuildContext context, int index) {
              return EditorialImage(url: images[index]);
            },
          );
    final Widget heroChild = SizedBox(
      height: 420,
      width: double.infinity,
      child: gallery,
    );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: _collapse > 0.55
          ? SystemUiOverlayStyle.dark
          : SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: EditorialColors.background,
        body: Stack(
          children: [
            CustomScrollView(
              controller: _scroll,
              slivers: [
                SliverToBoxAdapter(
                  child: Stack(
                    children: [
                      widget.heroScope == null
                          ? heroChild
                          : Hero(
                              tag: StayDisplay.heroTag(
                                widget.heroScope!,
                                property.id,
                              ),
                              child: heroChild,
                            ),
                      if (images.length > 1)
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 16,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: List<Widget>.generate(images.length, (
                              int index,
                            ) {
                              final bool active = index == _galleryIndex;
                              return Container(
                                width: active ? 8 : 5,
                                height: 5,
                                margin: const EdgeInsets.symmetric(horizontal: 2),
                                decoration: BoxDecoration(
                                  color: active
                                      ? EditorialColors.onBrand
                                      : EditorialColors.onBrand
                                          .withValues(alpha: 0.55),
                                  borderRadius: AppRadius.pillAll,
                                ),
                              );
                            }),
                          ),
                        ),
                    ],
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.screenHorizontal,
                      AppSpacing.lg,
                      AppSpacing.screenHorizontal,
                      160,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AppTypography.screenTitle),
                        if (property.locationLabel.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            property.locationLabel,
                            style: AppTypography.supporting.copyWith(
                              color: EditorialColors.inkMuted,
                            ),
                          ),
                        ],
                        if (property.verified ||
                            property.rating > 0 ||
                            StayDisplay.hasRealHost(property)) ...[
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              if (property.verified)
                                const EditorialGlassChip(
                                  icon: Icons.verified_rounded,
                                  label: 'Verified',
                                ),
                              if (StayDisplay.hasRealHost(property))
                                EditorialGlassChip(
                                  icon: Icons.person_outline_rounded,
                                  label: property.hostName,
                                  iconColor: EditorialColors.brand,
                                ),
                              if (property.rating > 0)
                                EditorialGlassChip(
                                  icon: Icons.star_rounded,
                                  label: property.reviewCount > 0
                                      ? '${property.rating.toStringAsFixed(1)} · ${property.reviewCount}'
                                      : property.rating.toStringAsFixed(1),
                                ),
                            ],
                          ),
                        ],
                        const SizedBox(height: AppSpacing.lg),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            if (property.bedrooms > 0)
                              _SpecChip(
                                '${property.bedrooms} bedroom${property.bedrooms == 1 ? '' : 's'}',
                              ),
                            if (property.bathrooms > 0)
                              _SpecChip(
                                '${property.bathrooms} bath${property.bathrooms == 1 ? '' : 's'}',
                              ),
                            if (property.beds > 0)
                              _SpecChip(
                                '${property.beds} bed${property.beds == 1 ? '' : 's'}',
                              ),
                            _SpecChip('Up to ${property.maxGuests} guests'),
                            if (property.propertyType.isNotEmpty)
                              _SpecChip(property.propertyType),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        Text(
                          property.description.isEmpty
                              ? (property.tagline.isEmpty
                                  ? 'Details will appear when the host adds a description.'
                                  : property.tagline)
                              : property.description,
                          style: AppTypography.body,
                        ),
                        if (sleepCards.isNotEmpty) ...[
                          const SizedBox(height: AppSpacing.xl),
                          Text('Where you’ll sleep', style: AppTypography.cardTitle),
                          const SizedBox(height: 4),
                          Text(
                            'Based on the host’s bedroom and bed counts.',
                            style: AppTypography.caption.copyWith(
                              color: EditorialColors.inkMuted,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          SizedBox(
                            height: 112,
                            child: ListView.separated(
                              scrollDirection: Axis.horizontal,
                              itemCount: sleepCards.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(width: 10),
                              itemBuilder: (BuildContext context, int index) {
                                final _SleepCardData card = sleepCards[index];
                                return Container(
                                  width: 148,
                                  padding: const EdgeInsets.all(AppSpacing.md),
                                  decoration: BoxDecoration(
                                    color: EditorialColors.card,
                                    borderRadius: AppRadius.editorialImageAll,
                                    border: Border.all(
                                      color: EditorialColors.hairline,
                                    ),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Icon(
                                        Icons.bed_outlined,
                                        color: EditorialColors.brand,
                                      ),
                                      const Spacer(),
                                      Text(
                                        card.title,
                                        style: AppTypography.supporting.copyWith(
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      Text(card.subtitle, style: AppTypography.caption),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ),
                        ],
                        if (property.amenityItems.isNotEmpty) ...[
                          const SizedBox(height: AppSpacing.xl),
                          Text(
                            'What this place offers',
                            style: AppTypography.cardTitle,
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          ...previewAmenities.map(
                            (IleAmenity amenity) => Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Row(
                                children: [
                                  Icon(
                                    AmenityCatalog.iconFor(amenity.name),
                                    size: 22,
                                    color: EditorialColors.brand,
                                  ),
                                  const SizedBox(width: 14),
                                  Expanded(
                                    child: Text(
                                      amenity.name,
                                      style: AppTypography.supporting.copyWith(
                                        color: EditorialColors.ink,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: () => _openAmenities(property),
                            style: TextButton.styleFrom(
                              minimumSize: const Size(44, 44),
                              foregroundColor: EditorialColors.brand,
                            ),
                            child: Text(
                              property.amenityItems.length > 6
                                  ? 'Show all ${property.amenityItems.length} amenities'
                                  : 'Show all amenities',
                              style: AppTypography.supporting.copyWith(
                                color: EditorialColors.brand,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(height: AppSpacing.lg),
                        _NeighborhoodNote(property: property),
                        const SizedBox(height: AppSpacing.xl),
                        _ThingsToKnowSection(property: property, session: session),
                        const SizedBox(height: AppSpacing.xl),
                        _NearbyNeighborhoodsSection(property: property),
                        if (capacityHint != null) ...[
                          const SizedBox(height: AppSpacing.md),
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(AppSpacing.md),
                            decoration: BoxDecoration(
                              color: AppColors.warningBg,
                              borderRadius: AppRadius.editorialImageAll,
                              border: Border.all(color: AppColors.warningBorder),
                            ),
                            child: Text(
                              capacityHint,
                              style: AppTypography.supporting.copyWith(
                                color: AppColors.warningText,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: _CollapsedBar(
                collapse: _collapse,
                title: title,
                priceLabel:
                    '₦${IleFormatters.formatInteger(property.pricePerNight)}',
                rating: property.rating > 0 ? property.rating : null,
                iconColor: iconColor,
                saved: saved,
                onSave: () => wishlist.toggle(property),
                onShare: () => _share(property),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: _ReserveBar(
                property: property,
                session: session,
                estimate: estimate,
                onEditDates: () => _openDateEditor(property),
                onReserve: () {
                  if (!session.hasDates) {
                    _openDateEditor(property);
                    return;
                  }
                  if (capacityHint != null) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(capacityHint)),
                    );
                    return;
                  }
                  context.push(AppRoutes.reservePath(property.slug));
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CollapsedBar extends StatelessWidget {
  const _CollapsedBar({
    required this.collapse,
    required this.title,
    required this.priceLabel,
    required this.rating,
    required this.iconColor,
    required this.saved,
    required this.onSave,
    required this.onShare,
  });

  final double collapse;
  final String title;
  final String priceLabel;
  final double? rating;
  final Color iconColor;
  final bool saved;
  final VoidCallback onSave;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final double top = MediaQuery.paddingOf(context).top;
    return ColoredBox(
      color: EditorialColors.background.withValues(alpha: collapse),
      child: Padding(
        padding: EdgeInsets.fromLTRB(8, top + 6, 8, 8),
        child: Row(
          children: [
            _GlassIconButton(
              tooltip: 'Back',
              icon: Icons.arrow_back_rounded,
              color: iconColor,
              fill: collapse,
              onPressed: () {
                if (context.canPop()) {
                  context.pop();
                  return;
                }
                context.go(AppRoutes.explore);
              },
            ),
            Expanded(
              child: Opacity(
                opacity: collapse,
                child: Column(
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.supporting.copyWith(
                        fontFamily: AppTypography.displayFamily,
                        fontSize: 16,
                        color: EditorialColors.ink,
                      ),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          priceLabel,
                          style: AppTypography.caption.copyWith(
                            color: EditorialColors.brand,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        if (rating != null) ...[
                          const SizedBox(width: 8),
                          const Icon(
                            Icons.star_rounded,
                            size: 14,
                            color: EditorialColors.gold,
                          ),
                          Text(
                            rating!.toStringAsFixed(1),
                            style: AppTypography.caption.copyWith(
                              color: EditorialColors.ink,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ),
            _GlassIconButton(
              tooltip: 'Share',
              icon: Icons.ios_share_rounded,
              color: iconColor,
              fill: collapse,
              onPressed: onShare,
            ),
            const SizedBox(width: 4),
            _GlassIconButton(
              tooltip: saved ? 'Remove from saved' : 'Save stay',
              icon: saved ? Icons.favorite_rounded : Icons.favorite_border_rounded,
              color: saved ? EditorialColors.heart : iconColor,
              fill: collapse,
              onPressed: () {
                if (!EditorialLayout.reduceMotion(context)) {
                  HapticFeedback.lightImpact();
                }
                onSave();
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _GlassIconButton extends StatelessWidget {
  const _GlassIconButton({
    required this.tooltip,
    required this.icon,
    required this.color,
    required this.fill,
    required this.onPressed,
  });

  final String tooltip;
  final IconData icon;
  final Color color;
  final double fill;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final Color background = Color.lerp(
      const Color(0xF2FFFFFF),
      EditorialColors.card,
      fill,
    )!;
    return IconButton(
      tooltip: tooltip,
      onPressed: onPressed,
      constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
      icon: DecoratedBox(
        decoration: BoxDecoration(
          color: background,
          shape: BoxShape.circle,
          border: Border.all(
            color: EditorialColors.brand.withValues(alpha: 0.14),
          ),
          boxShadow: const <BoxShadow>[
            BoxShadow(
              color: Color(0x14000000),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 18, color: color),
        ),
      ),
    );
  }
}

class _ReserveBar extends StatelessWidget {
  const _ReserveBar({
    required this.property,
    required this.session,
    required this.estimate,
    required this.onEditDates,
    required this.onReserve,
  });

  final IleProperty property;
  final SearchSession session;
  final GuestPriceEstimate? estimate;
  final VoidCallback onEditDates;
  final VoidCallback onReserve;

  @override
  Widget build(BuildContext context) {
    final String dates = session.hasDates
        ? '${session.datesLabel} · ${session.guestsLabel}'
        : 'Select dates';
    return DecoratedBox(
      decoration: const BoxDecoration(
        color: EditorialColors.card,
        border: Border(top: BorderSide(color: EditorialColors.hairline)),
        boxShadow: AppShadows.editorialCard,
      ),
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.screenHorizontal,
          12,
          AppSpacing.screenHorizontal,
          MediaQuery.paddingOf(context).bottom + 12,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: onEditDates,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(minHeight: 44),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          EditorialPrice(amount: property.pricePerNight),
                          Text(
                            estimate == null
                                ? dates
                                : '$dates · est. ₦${IleFormatters.formatInteger(estimate!.estimatedTotal)}',
                            style: AppTypography.caption.copyWith(
                              color: EditorialColors.inkMuted,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                ConstrainedBox(
                  constraints: const BoxConstraints(minHeight: 48),
                  child: ElevatedButton(
                    onPressed: property.isReserved ? null : onReserve,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: EditorialColors.brand,
                      foregroundColor: EditorialColors.onBrand,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                      textStyle: AppTypography.button.copyWith(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.01,
                      ),
                    ),
                    child: Text(
                      property.isReserved ? 'Unavailable' : 'Request to book',
                      maxLines: 1,
                      overflow: TextOverflow.visible,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _NeighborhoodNote extends StatelessWidget {
  const _NeighborhoodNote({required this.property});

  final IleProperty property;

  @override
  Widget build(BuildContext context) {
    final bool hasPin = property.latitude != 0 || property.longitude != 0;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: EditorialColors.card,
        borderRadius: AppRadius.editorialImageAll,
        border: Border.all(color: EditorialColors.hairline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Neighborhood', style: AppTypography.cardTitle),
          const SizedBox(height: 4),
          Text(
            property.locationLabel.isEmpty
                ? 'Area details appear when the host adds them.'
                : property.locationLabel,
            style: AppTypography.supporting,
          ),
          const SizedBox(height: 8),
          Text(
            'Approximate area only. The street address stays private until the stay is confirmed.',
            style: AppTypography.caption.copyWith(color: EditorialColors.inkMuted),
          ),
          if (hasPin) ...[
            const SizedBox(height: 6),
            Text(
              'Offset pin ${property.latitude.toStringAsFixed(2)}, ${property.longitude.toStringAsFixed(2)}',
              style: AppTypography.caption.copyWith(color: EditorialColors.inkMuted),
            ),
          ],
        ],
      ),
    );
  }
}

class _SleepCardData {
  const _SleepCardData({required this.title, required this.subtitle});

  final String title;
  final String subtitle;
}

class _SpecChip extends StatelessWidget {
  const _SpecChip(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: EditorialColors.shimmerStart,
        borderRadius: AppRadius.pillAll,
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(
          color: EditorialColors.ink,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}


class _ThingsToKnowSection extends StatelessWidget {
  const _ThingsToKnowSection({
    required this.property,
    required this.session,
  });

  final IleProperty property;
  final SearchSession session;

  void _openHouseRules(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x730A1C16),
      builder: (BuildContext sheetContext) {
        return _HouseRulesSheet(property: property);
      },
    );
  }

  void _openSafety(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x730A1C16),
      builder: (BuildContext sheetContext) {
        return _SafetyPolicySheet(property: property);
      },
    );
  }

  void _openCancellation(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: const Color(0x730A1C16),
      builder: (BuildContext sheetContext) {
        return _CancellationPolicySheet(property: property, session: session);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final IleThingsToKnow ttk = property.thingsToKnow;
    final int maxGuests = ttk.maxOvernightGuests ?? property.maxGuests;
    final String smokeLabel = ttk.smokingAllowed ? 'Smoking allowed' : 'No indoor smoking';
    final String partyLabel = ttk.partiesAllowed ? 'Parties allowed' : 'No parties';
    final String powerLabel = ttk.hasSolarInverter ? '24/7 Solar Inverter' : 'Generator backup';
    final String securityLabel = ttk.hasExteriorCCTV ? 'CCTV at entrance' : 'Armed security';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Things to know',
          style: AppTypography.screenTitle.copyWith(fontSize: 20),
        ),
        const SizedBox(height: 14),

        // Row 1: Check-in & Access
        _ThingsToKnowRow(
          icon: Icons.meeting_room_outlined,
          title: 'Check-in & Access',
          subtitle: 'Check-in after ${ttk.checkInAfter} • Checkout before ${ttk.checkOutBefore}\nSelf check-in with ${ttk.checkInMethod}',
          hasChevron: false,
        ),
        const Divider(color: Color(0xFFEFECE6), height: 24, thickness: 1),

        // Row 2: House rules
        _ThingsToKnowRow(
          icon: Icons.assignment_outlined,
          title: 'House rules',
          subtitle: 'Up to $maxGuests overnight guests • $smokeLabel • $partyLabel',
          hasChevron: true,
          onTap: () => _openHouseRules(context),
        ),
        const Divider(color: Color(0xFFEFECE6), height: 24, thickness: 1),

        // Row 3: Safety & power. Caution fee is not charged.
        _ThingsToKnowRow(
          icon: Icons.shield_outlined,
          title: 'Safety & power',
          subtitle: '$powerLabel • $securityLabel',
          hasChevron: true,
          onTap: () => _openSafety(context),
        ),
        const Divider(color: Color(0xFFEFECE6), height: 24, thickness: 1),

        // Row 4: Cancellation policy
        _ThingsToKnowRow(
          icon: Icons.event_available_outlined,
          title: 'Cancellation policy',
          subtitle: 'Free cancellation up to 48 hours before check-in.\nReview the cancellation policy.',
          hasChevron: true,
          onTap: () => _openCancellation(context),
        ),
        const SizedBox(height: 16),

        // Report this listing
        InkWell(
          onTap: () {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Listing report submitted for review. Thank you.'),
                backgroundColor: EditorialColors.brand,
              ),
            );
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('🏳️', style: TextStyle(fontSize: 14)),
                const SizedBox(width: 8),
                Text(
                  'Report this listing',
                  style: AppTypography.supporting.copyWith(
                    fontSize: 14,
                    color: EditorialColors.ink,
                    decoration: TextDecoration.underline,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ThingsToKnowRow extends StatelessWidget {
  const _ThingsToKnowRow({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.hasChevron,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final bool hasChevron;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final Widget content = Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: EditorialColors.tint,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: EditorialColors.brand, size: 20),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTypography.supporting.copyWith(
                  fontWeight: FontWeight.w700,
                  fontSize: 15,
                  color: EditorialColors.ink,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                subtitle,
                style: AppTypography.caption.copyWith(
                  fontSize: 13,
                  color: EditorialColors.inkMuted,
                  height: 1.35,
                ),
              ),
            ],
          ),
        ),
        if (hasChevron)
          const Padding(
            padding: EdgeInsets.only(top: 8, left: 8),
            child: Icon(Icons.chevron_right_rounded, color: EditorialColors.inkMuted, size: 20),
          ),
      ],
    );

    if (onTap != null) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: content,
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: content,
    );
  }
}

class _HouseRulesSheet extends StatelessWidget {
  const _HouseRulesSheet({required this.property});

  final IleProperty property;

  @override
  Widget build(BuildContext context) {
    final IleThingsToKnow ttk = property.thingsToKnow;
    final int maxGuests = ttk.maxOvernightGuests ?? property.maxGuests;

    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.85,
        ),
        child: Material(
          color: EditorialColors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD5D0C5),
                    borderRadius: AppRadius.pillAll,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 12, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'House rules',
                        style: AppTypography.screenTitle.copyWith(fontSize: 19),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 22),
                      color: EditorialColors.ink,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFFEAE4D7)),
              Flexible(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
                  children: [
                    Text(
                      'These rules are set by the host. Please treat the property and estate security protocols with respect.',
                      style: AppTypography.supporting.copyWith(
                        color: EditorialColors.inkMuted,
                        fontSize: 14,
                        height: 1.45,
                      ),
                    ),
                    const SizedBox(height: 20),
                    _RuleDetailRow(
                      icon: Icons.groups_outlined,
                      title: 'Up to $maxGuests overnight guests',
                      subtitle: 'Visitor gate passes require 2 hours notice for security clearance.',
                    ),
                    _RuleDetailRow(
                      icon: Icons.smoke_free_outlined,
                      title: ttk.smokingAllowed ? 'Indoor smoking allowed' : 'No indoor smoking',
                      subtitle: 'Including shisha, vaping, and e-cigarettes inside the unit.',
                    ),
                    _RuleDetailRow(
                      icon: Icons.celebration_outlined,
                      title: ttk.partiesAllowed ? 'Parties allowed' : 'No unauthorized parties or commercial shoots',
                      subtitle: 'Estate quiet hours start at ${ttk.quietHours}.',
                    ),
                    _RuleDetailRow(
                      icon: Icons.pets_outlined,
                      title: ttk.petsAllowed ? 'Pets allowed' : 'No pets allowed',
                      subtitle: ttk.petsAllowed
                          ? 'Prior notification required before bringing pets.'
                          : 'Pets are strictly prohibited by building bylaws.',
                    ),
                    _RuleDetailRow(
                      icon: Icons.bolt_outlined,
                      title: 'Power & Generator Protocol',
                      subtitle: ttk.powerScheduleNote,
                    ),
                    if (ttk.customRules.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Text(
                        'Additional rules from host',
                        style: AppTypography.cardTitle.copyWith(fontSize: 15),
                      ),
                      const SizedBox(height: 10),
                      for (final String rule in ttk.customRules)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Padding(
                                padding: EdgeInsets.only(top: 4, right: 10),
                                child: Icon(Icons.check_circle_outline, size: 16, color: EditorialColors.brand),
                              ),
                              Expanded(
                                child: Text(
                                  rule,
                                  style: AppTypography.supporting.copyWith(
                                    fontSize: 13.5,
                                    color: EditorialColors.ink,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SafetyPolicySheet extends StatelessWidget {
  const _SafetyPolicySheet({required this.property});

  final IleProperty property;

  @override
  Widget build(BuildContext context) {
    final IleThingsToKnow ttk = property.thingsToKnow;

    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.82,
        ),
        child: Material(
          color: EditorialColors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD5D0C5),
                    borderRadius: AppRadius.pillAll,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 12, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Safety & Property Disclosures',
                        style: AppTypography.screenTitle.copyWith(fontSize: 19),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 22),
                      color: EditorialColors.ink,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFFEAE4D7)),
              Flexible(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
                  children: [
                    _RuleDetailRow(
                      icon: Icons.videocam_outlined,
                      title: ttk.hasExteriorCCTV ? 'Exterior Security Cameras' : 'Private Premise',
                      subtitle: ttk.hasExteriorCCTV
                          ? 'CCTV monitors building entrance and perimeter for guest safety. No cameras inside private areas.'
                          : 'No recording devices on premise.',
                    ),
                    _RuleDetailRow(
                      icon: Icons.local_police_outlined,
                      title: ttk.hasArmedEstateSecurity ? 'Estate Manned Gate Security' : 'Gated Compound',
                      subtitle: '24-hour uniformed security officers station at the estate entrance gate.',
                    ),
                    _RuleDetailRow(
                      icon: Icons.sensors_outlined,
                      title: ttk.hasSmokeAlarm ? 'Smoke & Fire Alarm' : 'Fire Extinguisher on Site',
                      subtitle: 'Smoke alarms and fire blankets installed in the kitchen and common areas.',
                    ),
                    _RuleDetailRow(
                      icon: Icons.solar_power_outlined,
                      title: 'Uninterrupted Power Architecture',
                      subtitle: ttk.powerScheduleNote,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CancellationPolicySheet extends StatelessWidget {
  const _CancellationPolicySheet({
    required this.property,
    required this.session,
  });

  final IleProperty property;
  final SearchSession session;

  @override
  Widget build(BuildContext context) {
    final IleThingsToKnow ttk = property.thingsToKnow;

    return Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * 0.75,
        ),
        child: Material(
          color: EditorialColors.background,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 12),
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD5D0C5),
                    borderRadius: AppRadius.pillAll,
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 12, 12),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        'Cancellation Policy',
                        style: AppTypography.screenTitle.copyWith(fontSize: 19),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 22),
                      color: EditorialColors.ink,
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFFEAE4D7)),
              Flexible(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
                  children: [
                    _RuleDetailRow(
                      icon: Icons.check_circle_outline,
                      title: ttk.cancellationPolicy == 'FLEXIBLE_48H'
                          ? 'Flexible: Free cancellation before 48 hrs'
                          : ttk.cancellationPolicy == 'MODERATE_5D'
                              ? 'Moderate: Free cancellation before 5 days'
                              : 'Firm: 50% refund up to 7 days before check-in',
                      subtitle: 'Cancellation follows the policy on this listing. Guests can request a refund; only Ilé admin can execute one.',
                    ),
                    _RuleDetailRow(
                      icon: Icons.history_toggle_off_outlined,
                      title: 'Non-refundable period',
                      subtitle: 'Cancellations within 48 hours of check-in forfeit the first night payment; remaining nights refunded at 50%.',
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RuleDetailRow extends StatelessWidget {
  const _RuleDetailRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: EditorialColors.tint,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: EditorialColors.brand, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: AppTypography.supporting.copyWith(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: EditorialColors.ink,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: AppTypography.caption.copyWith(
                    fontSize: 13,
                    color: EditorialColors.inkMuted,
                    height: 1.35,
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

class _NearbyNeighborhoodsSection extends StatelessWidget {
  const _NearbyNeighborhoodsSection({required this.property});

  final IleProperty property;

  @override
  Widget build(BuildContext context) {
    final List<NearbyNeighborhood> nearby = NearbyNeighborhoodsService.getNearby(
      neighborhood: property.neighborhood,
      city: property.city,
      state: property.state,
      latitude: property.latitude,
      longitude: property.longitude,
    );

    final String stateName = property.state.isNotEmpty ? property.state : 'FCT';
    final String cityName = property.city.isNotEmpty ? property.city : 'Abuja';
    final String hoodName = property.neighborhood.isNotEmpty ? property.neighborhood : 'Maitama';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 8px Warm Alabaster section divider
        Container(
          height: 8,
          margin: const EdgeInsets.only(bottom: 24),
          decoration: BoxDecoration(
            color: const Color(0xFFEFECE6),
            borderRadius: BorderRadius.circular(4),
          ),
        ),

        // Breadcrumbs trail: Ilé › Nigeria › State › City › Neighborhood
        Text(
          'Ilé  ›  Nigeria  ›  $stateName  ›  $cityName  ›  $hoodName',
          style: AppTypography.caption.copyWith(
            color: EditorialColors.inkMuted,
            fontSize: 12,
            letterSpacing: 0.2,
          ),
        ),
        const SizedBox(height: 16),

        Text(
          'Explore other options in and around $hoodName',
          style: AppTypography.cardTitle.copyWith(
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Auto-populated via Google Maps Nearby District Lookup',
          style: AppTypography.caption.copyWith(
            color: EditorialColors.inkMuted,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 14),

        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 2.1,
          ),
          itemCount: nearby.length,
          itemBuilder: (BuildContext context, int index) {
            final NearbyNeighborhood item = nearby[index];
            return Material(
              color: EditorialColors.card,
              borderRadius: BorderRadius.circular(14),
              child: InkWell(
                borderRadius: BorderRadius.circular(14),
                onTap: () {
                  context.read<SearchSession>().setPlace(item.name);
                  context.go(AppRoutes.explore);
                },
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: EditorialColors.stroke),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        item.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.supporting.copyWith(
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          color: EditorialColors.ink,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${item.descriptor} (${item.distanceLabel})',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.caption.copyWith(
                          fontSize: 11,
                          color: EditorialColors.inkMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ],
    );
  }
}
