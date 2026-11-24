import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/guest_flow_errors.dart';
import '../../core/guest_messages.dart';
import '../../core/models/booking.dart';
import '../../core/models/property.dart';
import '../../core/pricing/guest_price_estimate.dart';
import '../../core/state/search_session.dart';
import '../../core/utils/formatters.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_input.dart';
import '../../shared/widgets/luxury_date_range_sheet.dart';
import '../../shared/widgets/skeleton/skeleton_box.dart';
import '../search/filters_sheet.dart';

/// Review + send reservation request with full marketplace search context.
/// Inherits search destination, dates, guests, property type, power, and amenities.
/// Creates PENDING_HOST. Payment stays locked until the host accepts.
class ReserveScreen extends StatefulWidget {
  const ReserveScreen({super.key, required this.slug});

  final String slug;

  @override
  State<ReserveScreen> createState() => _ReserveScreenState();
}

class _ReserveScreenState extends State<ReserveScreen> {
  final TextEditingController _firstName = TextEditingController();
  final TextEditingController _lastName = TextEditingController();
  final TextEditingController _email = TextEditingController();
  final TextEditingController _phone = TextEditingController(text: '+234');
  IleProperty? _property;
  bool _loadingProperty = true;
  bool _submitting = false;
  GuestFlowError? _error;
  String? _firstNameError;
  String? _lastNameError;
  String? _emailError;
  String? _phoneError;
  String? _availabilityWarning;
  bool _revalidatingAvailability = false;

  @override
  void initState() {
    super.initState();
    _loadProperty();
  }

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _email.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _loadProperty() async {
    setState(() {
      _loadingProperty = true;
      _error = null;
    });
    try {
      final IleApi api = context.read<IleApi>();
      final IleProperty? property = await api.getProperty(widget.slug);
      if (!mounted) return;
      if (property != null) {
        final SearchSession session = context.read<SearchSession>();
        if (session.guests > property.maxGuests) {
          session.setGuests(property.maxGuests, maxCapacity: property.maxGuests);
        }
        if (session.hasDates) {
          _checkAvailability(property.id, session.checkIn!, session.checkOut!);
        }
      }
      try {
        final Map<String, dynamic>? user = await api.getCurrentUser();
        if (user != null && mounted) {
          final String first = (user['firstName'] as String?)?.trim() ?? '';
          final String last = (user['lastName'] as String?)?.trim() ?? '';
          final String email = (user['email'] as String?)?.trim() ?? '';
          if (_firstName.text.trim().isEmpty && first.isNotEmpty) {
            _firstName.text = first;
          }
          if (_lastName.text.trim().isEmpty && last.isNotEmpty) {
            _lastName.text = last;
          }
          if (_email.text.trim().isEmpty && email.isNotEmpty) {
            _email.text = email;
          }
        }
      } catch (_) {
        // Guest checkout does not require a session.
      }
      if (!mounted) return;
      setState(() {
        _property = property;
        _loadingProperty = false;
        if (property == null) {
          _error = const GuestFlowError(
            title: 'Property unavailable',
            message: 'This listing is not available to request.',
          );
        }
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = GuestFlowError.from(err, surface: 'property');
        _loadingProperty = false;
      });
    }
  }

  Future<void> _checkAvailability(String propertyId, String checkIn, String checkOut) async {
    setState(() {
      _revalidatingAvailability = true;
      _availabilityWarning = null;
    });
    try {
      final IleApi api = context.read<IleApi>();
      final Map<String, dynamic> result = await api.checkAvailability(
        propertyId: propertyId,
        checkIn: checkIn,
        checkOut: checkOut,
      );
      if (!mounted) return;
      if (result['available'] == false) {
        setState(() {
          _availabilityWarning = result['message']?.toString() ??
              'Those dates are no longer available for this stay.';
        });
      } else {
        setState(() => _availabilityWarning = null);
      }
    } catch (_) {
      // Non-fatal availability check failure; server creation will enforce final validation.
    } finally {
      if (mounted) setState(() => _revalidatingAvailability = false);
    }
  }

  Future<void> _handleEditDates() async {
    final IleProperty? property = _property;
    if (property == null) return;
    final SearchSession session = context.read<SearchSession>();

    DateTimeRange? initial;
    if (session.hasDates) {
      final DateTime? s = DateTime.tryParse(session.checkIn!);
      final DateTime? e = DateTime.tryParse(session.checkOut!);
      if (s != null && e != null) initial = DateTimeRange(start: s, end: e);
    }

    final DateTimeRange? picked = await LuxuryDateRangeSheet.show(
      context,
      initialRange: initial,
      nightlyRate: property.pricePerNight,
      minimumNights: property.minimumNights,
    );

    if (picked != null && mounted) {
      final String startStr = DateFormat('yyyy-MM-dd').format(picked.start);
      final String endStr = DateFormat('yyyy-MM-dd').format(picked.end);
      session.setDates(start: startStr, end: endStr);
      await _checkAvailability(property.id, startStr, endStr);
    }
  }

  void _adjustGuests(int delta) {
    final IleProperty? property = _property;
    final int maxCapacity = property?.maxGuests ?? 16;
    final SearchSession session = context.read<SearchSession>();
    final int target = session.guests + delta;
    if (target < 1) return;
    if (target > maxCapacity) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('This listing allows up to $maxCapacity guests.'),
          backgroundColor: const Color(0xFF073B2E),
          duration: const Duration(seconds: 2),
        ),
      );
      return;
    }
    session.setGuests(target, maxCapacity: maxCapacity);
  }

  void _handleOpenFilters() {
    final IleProperty? property = _property;
    final List<String> types = <String>[
      'Garden Villa',
      'House',
      'Penthouse',
      'Apartment',
      'Studio',
    ];
    final List<String> amenities = property != null
        ? property.amenityItems.map((a) => a.name).toList()
        : <String>['24/7 Power', 'Fast Wi-Fi', 'Gated Security', 'Swimming Pool'];

    FiltersSheet.show(
      context,
      availableTypes: types,
      availableAmenities: amenities,
      onApply: () {
        if (mounted) setState(() {});
      },
    );
  }

  bool _validateGuestFields() {
    final String first = _firstName.text.trim();
    final String last = _lastName.text.trim();
    final String email = _email.text.trim();
    String phone = _phone.text.trim().replaceAll(RegExp(r'[\s-]'), '');
    if (phone.startsWith('0') && phone.length >= 10) {
      phone = '+234${phone.substring(1)}';
    }
    if (!phone.startsWith('+')) {
      phone = phone.startsWith('234') ? '+$phone' : '+234$phone';
    }
    String? firstErr;
    String? lastErr;
    String? emailErr;
    String? phoneErr;
    if (first.isEmpty) firstErr = 'Enter your first name.';
    if (last.isEmpty) lastErr = 'Enter your last name.';
    if (email.isEmpty || !email.contains('@') || !email.contains('.')) {
      emailErr = 'Enter a valid email address.';
    }
    final String digits = phone.replaceAll(RegExp(r'\D'), '');
    if (!phone.startsWith('+234') || digits.length < 13) {
      phoneErr = 'Enter a Nigerian phone number starting with +234.';
    }
    setState(() {
      _firstNameError = firstErr;
      _lastNameError = lastErr;
      _emailError = emailErr;
      _phoneError = phoneErr;
      if (phoneErr == null && phone != _phone.text.trim()) {
        _phone.text = phone;
      }
    });
    return firstErr == null &&
        lastErr == null &&
        emailErr == null &&
        phoneErr == null;
  }

  Future<void> _handleReserve() async {
    if (_submitting) return;
    final SearchSession session = context.read<SearchSession>();
    final IleProperty? property = _property;
    if (property == null) return;
    if (!session.hasDates) {
      setState(
        () => _error = const GuestFlowError(
          title: 'Invalid dates',
          message: 'Choose check-in and check-out dates first.',
        ),
      );
      return;
    }
    final String? listingError = session.validateAgainstListing(
      maxGuests: property.maxGuests,
      minimumNights: property.minimumNights,
    );
    if (listingError != null) {
      setState(
        () => _error = GuestFlowError.from(
          listingError,
          surface: 'request',
        ),
      );
      return;
    }
    if (!_validateGuestFields()) {
      setState(
        () => _error = const GuestFlowError(
          title: 'Check guest details',
          message: 'Fix the highlighted fields, then try again.',
        ),
      );
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final IleApi api = context.read<IleApi>();
      final Map<String, dynamic> availability = await api.checkAvailability(
        propertyId: property.id,
        checkIn: session.checkIn!,
        checkOut: session.checkOut!,
      );
      if (availability['available'] == false) {
        throw Exception(
          availability['message']?.toString() ??
              'Those dates are no longer available for this stay.',
        );
      }
      final IleBooking booking = await api.createBooking(
        propertyId: property.id,
        guestFirstName: _firstName.text.trim(),
        guestLastName: _lastName.text.trim(),
        guestEmail: _email.text.trim(),
        guestPhone: _phone.text.trim(),
        guestCount: session.guests,
        checkInDate: session.checkIn!,
        checkOutDate: session.checkOut!,
      );
      if (!mounted) return;
      context.go(
        AppRoutes.reservationStatusPath(
          booking.id,
          accessToken: booking.accessToken,
        ),
      );
    } catch (err) {
      if (!mounted) return;
      setState(() => _error = GuestFlowError.from(err, surface: 'request'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final SearchSession session = context.watch<SearchSession>();
    final IleProperty? property = _property;

    if (_loadingProperty) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: _ReviewSkeleton(),
      );
    }

    if (property == null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.background,
          elevation: 0,
          leading: const IleCircularBackButton(),
          title: Text('Review your request', style: AppTypography.cardTitle),
        ),
        body: IleErrorState(
          title: _error?.title ?? 'Property unavailable',
          message: _error?.message,
          onRetry: _loadProperty,
        ),
      );
    }

    final int nights = session.nightsCount();
    final GuestPriceEstimate estimate = GuestPriceEstimate.fromNightly(
      nightlyRate: property.pricePerNight,
      nights: nights < 1 ? 0 : nights,
    );

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text('Review your request', style: AppTypography.cardTitle),
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
        children: [
          // ─── 1. SELECTED APARTMENT PREVIEW CARD ───
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: AppRadius.panelAll,
              border: Border.all(color: const Color(0xFFE7E5E0)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x08073B2E),
                  blurRadius: 10,
                  offset: Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: SizedBox(
                    width: 90,
                    height: 72,
                    child: property.primaryImage.isEmpty
                        ? const ColoredBox(
                            color: AppColors.border,
                            child: Icon(Icons.home_outlined, color: AppColors.foregroundSecondary),
                          )
                        : CachedNetworkImage(
                            imageUrl: property.primaryImage,
                            fit: BoxFit.cover,
                            errorWidget: (_, _, _) => const ColoredBox(
                              color: AppColors.border,
                              child: Icon(Icons.broken_image_outlined),
                            ),
                          ),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        property.title,
                        style: AppTypography.cardTitle.copyWith(fontSize: 16),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 3),
                      Text(
                        property.locationLabel.isEmpty
                            ? '${property.neighborhood}, ${property.city}'
                            : property.locationLabel,
                        style: AppTypography.supporting.copyWith(fontSize: 13, color: AppColors.foregroundSecondary),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          const Icon(Icons.star_rounded, size: 14, color: Color(0xFFD4AF37)),
                          const SizedBox(width: 3),
                          Text(
                            '${property.rating > 0 ? property.rating.toStringAsFixed(1) : "New"} · ${property.propertyType}',
                            style: AppTypography.caption.copyWith(fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          // ─── 2. DATES & GUEST CONTROLS ───
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: AppRadius.panelAll,
              border: Border.all(color: const Color(0xFFE7E5E0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Dates of Stay', style: AppTypography.cardTitle.copyWith(fontSize: 15)),
                    TextButton(
                      onPressed: _handleEditDates,
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Text(
                        session.hasDates ? 'Change' : 'Select dates',
                        style: AppTypography.supporting.copyWith(
                          color: const Color(0xFF073B2E),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  session.hasDates
                      ? '${session.datesLabel} · $nights ${nights == 1 ? "night" : "nights"}'
                      : 'Please choose check-in and check-out dates',
                  style: AppTypography.body.copyWith(
                    fontWeight: FontWeight.w600,
                    color: session.hasDates ? const Color(0xFF141917) : const Color(0xFFD97706),
                  ),
                ),
                Text(
                  'Minimum stay: ${property.minimumNights} night${property.minimumNights == 1 ? "" : "s"}',
                  style: AppTypography.caption,
                ),
                const Divider(height: 24, color: Color(0xFFF0EEE9)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Number of Guests', style: AppTypography.cardTitle.copyWith(fontSize: 15)),
                        const SizedBox(height: 2),
                        Text('Up to ${property.maxGuests} max capacity', style: AppTypography.caption),
                      ],
                    ),
                    Row(
                      children: [
                        _StepperButton(
                          icon: Icons.remove,
                          enabled: session.guests > 1,
                          onPressed: () => _adjustGuests(-1),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 14),
                          child: Text(
                            '${session.guests}',
                            style: AppTypography.cardTitle.copyWith(fontSize: 16),
                          ),
                        ),
                        _StepperButton(
                          icon: Icons.add,
                          enabled: session.guests < property.maxGuests,
                          onPressed: () => _adjustGuests(1),
                        ),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),

          // Availability warning alert (if dates are unavailable)
          if (_availabilityWarning != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: AppRadius.panelAll,
                border: Border.all(color: const Color(0xFFFCA5A5)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.event_busy_rounded, color: Color(0xFFDC2626), size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Dates unavailable',
                          style: AppTypography.cardTitle.copyWith(fontSize: 14, color: const Color(0xFF991B1B)),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _availabilityWarning!,
                          style: AppTypography.caption.copyWith(color: const Color(0xFFB91C1C)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],

          const SizedBox(height: AppSpacing.md),

          // ─── 3. INHERITED SEARCH & PREFERENCES ACCORDION ───
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFAFAF8),
              borderRadius: AppRadius.panelAll,
              border: Border.all(color: const Color(0xFFE7E5E0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.tune_rounded, size: 16, color: Color(0xFF073B2E)),
                        const SizedBox(width: 8),
                        Text(
                          'Marketplace Search Preferences',
                          style: AppTypography.cardTitle.copyWith(fontSize: 14),
                        ),
                      ],
                    ),
                    TextButton(
                      onPressed: _handleOpenFilters,
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Text(
                        'Refine',
                        style: AppTypography.supporting.copyWith(
                          color: const Color(0xFF073B2E),
                          fontWeight: FontWeight.w700,
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),

                // Location / Destination context
                _CriteriaPillRow(
                  icon: Icons.location_on_outlined,
                  label: 'Destination',
                  value: session.destination.isNotEmpty
                      ? session.destination
                      : '${property.city} (${property.neighborhood})',
                  matchNote: session.destination.isNotEmpty &&
                          property.city.toLowerCase().contains(session.destination.toLowerCase())
                      ? 'Matches search'
                      : null,
                ),

                // Property type context
                _CriteriaPillRow(
                  icon: Icons.apartment_rounded,
                  label: 'Property Type',
                  value: property.propertyType,
                  matchNote: session.propertyType != null &&
                          session.propertyType != 'All Stays' &&
                          session.propertyType == property.propertyType
                      ? 'Matches search preference'
                      : null,
                ),

                // Power reliability context
                _CriteriaPillRow(
                  icon: Icons.bolt_rounded,
                  label: 'Power Supply',
                  value: property.powerType,
                  matchNote: property.powerType.toLowerCase().contains('solar') ||
                          property.powerType.toLowerCase().contains('24/7')
                      ? 'Verified 24/7 Power'
                      : null,
                ),

                // Space context
                _CriteriaPillRow(
                  icon: Icons.bed_outlined,
                  label: 'Rooms',
                  value: '${property.bedrooms} Bed · ${property.bathrooms} Bath',
                  matchNote: session.bedrooms != null && property.bedrooms >= session.bedrooms!
                      ? 'Meets ${session.bedrooms}+ bed filter'
                      : null,
                ),

                // Key Amenities
                if (session.amenities.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: session.amenities.map((amenity) {
                      final bool matches = property.amenityItems
                          .any((a) => a.name.toLowerCase().contains(amenity.toLowerCase()));
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: matches ? const Color(0xFFEBF3F0) : const Color(0xFFF3F2EE),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: matches ? const Color(0xFF073B2E).withValues(alpha: 0.3) : const Color(0xFFE2DFD6),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              matches ? Icons.check_circle_outline : Icons.info_outline,
                              size: 12,
                              color: matches ? const Color(0xFF073B2E) : const Color(0xFF6E6B64),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              amenity,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: matches ? const Color(0xFF073B2E) : const Color(0xFF6E6B64),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ],
            ),
          ),

          const SizedBox(height: AppSpacing.lg),

          // ─── 4. PRICE SUMMARY ───
          Text('Price summary', style: AppTypography.cardTitle),
          const SizedBox(height: AppSpacing.sm),
          _PriceRow(
            label: 'Nightly rate',
            value: '₦${IleFormatters.formatInteger(estimate.nightlyRate)}',
          ),
          _PriceRow(
            label: 'Number of nights',
            value: '$nights',
          ),
          _PriceRow(
            label: 'Stay subtotal',
            value: '₦${IleFormatters.formatInteger(estimate.accommodationSubtotal)}',
          ),
          _PriceRow(
            label: 'Payment processing (estimate)',
            value: '₦${IleFormatters.formatInteger(estimate.processingFee)}',
          ),
          const SizedBox(height: 6),
          _PriceRow(
            label: 'Total estimate',
            value: '₦${IleFormatters.formatInteger(estimate.estimatedTotal)}',
            emphasize: true,
          ),

          const SizedBox(height: AppSpacing.xl),

          // ─── 5. GUEST DETAILS ───
          Text('Guest details', style: AppTypography.cardTitle),
          const SizedBox(height: 4),
          Text(
            'We share these with the host for your booking confirmation.',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.md),
          IleInput(
            controller: _firstName,
            label: 'First name',
            hintText: 'Ada',
            errorText: _firstNameError,
            textInputAction: TextInputAction.next,
            onChanged: (_) {
              if (_firstNameError != null) setState(() => _firstNameError = null);
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          IleInput(
            controller: _lastName,
            label: 'Last name',
            hintText: 'Okonkwo',
            errorText: _lastNameError,
            textInputAction: TextInputAction.next,
            onChanged: (_) {
              if (_lastNameError != null) setState(() => _lastNameError = null);
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          IleInput(
            controller: _email,
            label: 'Email',
            hintText: 'you@example.com',
            errorText: _emailError,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            onChanged: (_) {
              if (_emailError != null) setState(() => _emailError = null);
            },
          ),
          const SizedBox(height: AppSpacing.sm),
          IleInput(
            controller: _phone,
            label: 'Phone',
            hintText: '+234 803 123 4567',
            errorText: _phoneError,
            keyboardType: TextInputType.phone,
            textInputAction: TextInputAction.done,
            onChanged: (_) {
              if (_phoneError != null) setState(() => _phoneError = null);
            },
          ),

          if (_error != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              GuestMessages.sanitizeAlert('${_error!.title}. ${_error!.message}'),
              style: AppTypography.supporting.copyWith(color: AppColors.criticalText),
            ),
          ],

          const SizedBox(height: AppSpacing.md),
          Text(
            reviewNoPaymentCopy,
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.lg),

          if (!session.hasDates)
            IleButton(
              label: 'Choose dates to continue',
              onPressed: _handleEditDates,
              isExpanded: true,
            )
          else
            IleButton(
              label: GuestMessages.bookNow,
              onPressed: (_submitting || _availabilityWarning != null || _revalidatingAvailability)
                  ? null
                  : _handleReserve,
              isLoading: _submitting,
              isExpanded: true,
            ),
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({
    required this.icon,
    required this.onPressed,
    this.enabled = true,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: enabled ? onPressed : null,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: enabled ? const Color(0xFF073B2E) : const Color(0xFFDCD8D0),
          ),
          color: enabled ? Colors.transparent : const Color(0xFFF5F4F0),
        ),
        child: Icon(
          icon,
          size: 16,
          color: enabled ? const Color(0xFF073B2E) : const Color(0xFFA09C94),
        ),
      ),
    );
  }
}

class _CriteriaPillRow extends StatelessWidget {
  const _CriteriaPillRow({
    required this.icon,
    required this.label,
    required this.value,
    this.matchNote,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? matchNote;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(icon, size: 14, color: const Color(0xFF6E6B64)),
          const SizedBox(width: 6),
          Text('$label: ', style: AppTypography.caption.copyWith(color: const Color(0xFF6E6B64))),
          Expanded(
            child: Text(
              value,
              style: AppTypography.caption.copyWith(
                fontWeight: FontWeight.w600,
                color: const Color(0xFF141917),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (matchNote != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFEBF3F0),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(
                matchNote!,
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF073B2E),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.label,
    required this.value,
    this.emphasize = false,
  });

  final String label;
  final String value;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final TextStyle style = emphasize
        ? AppTypography.cardTitle.copyWith(fontSize: 16)
        : AppTypography.supporting;
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          Text(value, style: style),
        ],
      ),
    );
  }
}

class _ReviewSkeleton extends StatelessWidget {
  const _ReviewSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
      children: const [
        SizedBox(height: 56),
        SkeletonBox(height: 180, borderRadius: AppRadius.panelAll),
        SizedBox(height: AppSpacing.md),
        SkeletonBox(width: 220, height: 22),
        SizedBox(height: AppSpacing.sm),
        SkeletonBox(width: 140, height: 14),
        SizedBox(height: AppSpacing.lg),
        SkeletonBox(height: 48),
        SizedBox(height: AppSpacing.sm),
        SkeletonBox(height: 48),
        SizedBox(height: AppSpacing.lg),
        SkeletonBox(height: 120),
      ],
    );
  }
}
