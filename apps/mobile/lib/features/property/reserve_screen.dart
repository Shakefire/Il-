import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
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
import '../../shared/widgets/skeleton/skeleton_box.dart';

/// Review + send reservation request.
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

  void _handleEditDatesGuests() {
    final IleProperty? property = _property;
    context.push(
      AppRoutes.dateGuestPickerPath(
        editMode: true,
        maxGuests: property?.maxGuests,
        minimumNights: property?.minimumNights ?? 1,
        propertyId: property?.id,
        slug: property?.slug,
      ),
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
              'Those dates are no longer available.',
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
          ClipRRect(
            borderRadius: AppRadius.panelAll,
            child: AspectRatio(
              aspectRatio: 16 / 9,
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
          const SizedBox(height: AppSpacing.md),
          Text(property.title, style: AppTypography.sectionHeading),
          const SizedBox(height: 4),
          Text(
            property.locationLabel.isEmpty ? 'Location shared after confirmation' : property.locationLabel,
            style: AppTypography.supporting,
          ),
          const SizedBox(height: AppSpacing.md),
          _EditRow(
            label: 'Dates',
            value: session.hasDates ? session.datesLabel : 'Add dates',
            onEdit: _handleEditDatesGuests,
          ),
          _EditRow(
            label: 'Guests',
            value: session.guestsLabel,
            onEdit: _handleEditDatesGuests,
          ),
          Text(
            'Max ${property.maxGuests} guests · min ${property.minimumNights} night${property.minimumNights == 1 ? '' : 's'}',
            style: AppTypography.caption,
          ),
          const SizedBox(height: AppSpacing.lg),
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
          Text('Guest details', style: AppTypography.cardTitle),
          const SizedBox(height: 6),
          Text(
            'We share these with the host for your booking.',
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
              if (_firstNameError != null) {
                setState(() => _firstNameError = null);
              }
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
              if (_lastNameError != null) {
                setState(() => _lastNameError = null);
              }
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
              label: 'Choose dates',
              onPressed: _handleEditDatesGuests,
              isExpanded: true,
            )
          else
            IleButton(
              label: GuestMessages.bookNow,
              onPressed: _submitting ? null : _handleReserve,
              isLoading: _submitting,
              isExpanded: true,
            ),
          const SizedBox(height: AppSpacing.xxl),
        ],
      ),
    );
  }
}

class _EditRow extends StatelessWidget {
  const _EditRow({
    required this.label,
    required this.value,
    required this.onEdit,
  });

  final String label;
  final String value;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: AppTypography.caption),
                Text(
                  value,
                  style: AppTypography.supporting.copyWith(
                    color: AppColors.foreground,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: onEdit,
            style: TextButton.styleFrom(minimumSize: const Size(44, 44)),
            child: Text(
              'Edit',
              style: AppTypography.supporting.copyWith(
                color: AppColors.emerald,
                fontWeight: FontWeight.w700,
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
