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
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/skeleton/skeleton_box.dart';
import 'amenities_screen.dart';

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
                SizedBox(
                  width: 148,
                  child: IleButton(
                    label: property.isReserved ? 'Unavailable' : 'Request to book',
                    onPressed: property.isReserved ? null : onReserve,
                    isExpanded: true,
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
