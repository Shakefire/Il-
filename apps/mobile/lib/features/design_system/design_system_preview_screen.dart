import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/constants/app_routes.dart';
import '../../core/constants/app_strings.dart';
import '../../shared/widgets/widgets.dart';

/// Temporary design-system gallery — deep-link /dev route only.
class DesignSystemPreviewScreen extends StatefulWidget {
  const DesignSystemPreviewScreen({super.key});

  @override
  State<DesignSystemPreviewScreen> createState() =>
      _DesignSystemPreviewScreenState();
}

class _DesignSystemPreviewScreenState extends State<DesignSystemPreviewScreen> {
  final TextEditingController _textController =
      TextEditingController(text: 'Maitama');
  final TextEditingController _passwordController = TextEditingController();
  String? _city;
  bool _isPrimaryLoading = false;
  bool _switchValue = true;

  @override
  void dispose() {
    _textController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handlePrimaryLoading() {
    setState(() => _isPrimaryLoading = true);
    Future<void>.delayed(const Duration(milliseconds: 1200), () {
      if (!mounted) return;
      setState(() => _isPrimaryLoading = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: IleAppBar(
        showBrand: true,
        actions: [
          IconButton(
            tooltip: 'Open Explore',
            onPressed: () => context.go(AppRoutes.explore),
            icon: const Icon(Icons.home_outlined),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screenHorizontal,
          AppSpacing.lg,
          AppSpacing.screenHorizontal,
          AppSpacing.section,
        ),
        children: [
          const IleBrandMark(fontSize: 40),
          const SizedBox(height: AppSpacing.xs),
          Text(
            AppStrings.brandTagline,
            style: AppTypography.supporting,
          ),
          const SizedBox(height: AppSpacing.xl),
          Text(
            AppStrings.designSystemTitle,
            style: AppTypography.screenTitle,
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            AppStrings.designSystemSubtitle,
            style: AppTypography.supporting,
          ),
          const IleDivider(),
          _buildColorSection(),
          const IleDivider(),
          _buildTypographySection(),
          const IleDivider(),
          _buildButtonsSection(),
          const IleDivider(),
          _buildInputsSection(),
          const IleDivider(),
          _buildBadgesSection(),
          const IleDivider(),
          _buildCardsSection(),
          const IleDivider(),
          _buildStatesSection(),
          const IleDivider(),
          _buildControlsSection(),
          const IleDivider(),
          _buildNavigationSection(),
        ],
      ),
    );
  }

  Widget _buildColorSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IleSectionHeading(
          title: 'Color tokens',
          subtitle: 'Exact values from brand.md and globals.css',
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: const [
            _Swatch(label: 'Background', color: AppColors.background),
            _Swatch(label: 'Surface', color: AppColors.surface),
            _Swatch(label: 'Muted', color: AppColors.surfaceMuted),
            _Swatch(label: 'Charcoal', color: AppColors.charcoal, onDark: true),
            _Swatch(label: 'Emerald', color: AppColors.emerald, onDark: true),
            _Swatch(label: 'Deep Pine', color: AppColors.brandPrimary, onDark: true),
            _Swatch(label: 'Success', color: AppColors.successBg),
            _Swatch(label: 'Warning', color: AppColors.warningBg),
            _Swatch(label: 'Info', color: AppColors.infoBg),
            _Swatch(label: 'Critical', color: AppColors.criticalBg),
          ],
        ),
      ],
    );
  }

  Widget _buildTypographySection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IleSectionHeading(title: 'Typography'),
        const SizedBox(height: AppSpacing.md),
        Text('Display', style: AppTypography.display.copyWith(fontSize: 32)),
        const SizedBox(height: AppSpacing.xs),
        Text('Screen title', style: AppTypography.screenTitle),
        const SizedBox(height: AppSpacing.xs),
        Text('Section heading', style: AppTypography.sectionHeading),
        const SizedBox(height: AppSpacing.xs),
        Text('Card title — Maitama Heights', style: AppTypography.cardTitle),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Body copy describes architecture-first short-lets with solar power and Starlink.',
          style: AppTypography.body,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text('Supporting metadata · Wuse 2, Abuja', style: AppTypography.supporting),
        const SizedBox(height: AppSpacing.xs),
        Text('CAPTION / MICRO', style: AppTypography.microLabel),
        const SizedBox(height: AppSpacing.xs),
        const IlePriceDisplay(amount: 180000),
      ],
    );
  }

  Widget _buildButtonsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IleSectionHeading(title: 'Buttons'),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            IleButton(
              label: 'Primary',
              onPressed: _handlePrimaryLoading,
              isLoading: _isPrimaryLoading,
            ),
            IleButton(
              label: 'Secondary',
              variant: IleButtonVariant.secondary,
              onPressed: () {},
            ),
            IleButton(
              label: 'Neutral',
              variant: IleButtonVariant.neutral,
              onPressed: () {},
            ),
            IleButton(
              label: 'Text',
              variant: IleButtonVariant.text,
              onPressed: () {},
            ),
            const IleButton(
              label: 'Disabled',
              onPressed: null,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        IleButton(
          label: 'Open bottom sheet',
          variant: IleButtonVariant.secondary,
          isExpanded: true,
          onPressed: () {
            IleModal.showBottomSheet<void>(
              context: context,
              title: 'Bottom sheet',
              child: Text(
                'Foundation sheet for filters, date pickers, and confirmations.',
                style: AppTypography.body,
              ),
            );
          },
        ),
        const SizedBox(height: AppSpacing.xs),
        IleButton(
          label: 'Open dialog',
          variant: IleButtonVariant.secondary,
          isExpanded: true,
          onPressed: () {
            IleModal.showDialogSheet<void>(
              context: context,
              title: 'Confirm stay',
              child: Text(
                'Dialog foundation uses warm surface and Ilé type.',
                style: AppTypography.body,
              ),
              cancelLabel: 'Cancel',
              confirmLabel: 'Continue',
            );
          },
        ),
      ],
    );
  }

  Widget _buildInputsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IleSectionHeading(title: 'Inputs'),
        const SizedBox(height: AppSpacing.md),
        IleInput(
          label: 'Destination',
          hintText: 'Search neighborhoods',
          controller: _textController,
          type: IleInputType.search,
          helperText: 'Try Maitama, Ikoyi, or Victoria Island',
        ),
        const SizedBox(height: AppSpacing.md),
        IleInput(
          label: 'Password',
          hintText: 'Enter password',
          controller: _passwordController,
          type: IleInputType.password,
        ),
        const SizedBox(height: AppSpacing.md),
        IleInput(
          label: 'City',
          type: IleInputType.dropdown,
          hintText: 'Select city',
          dropdownValue: _city,
          dropdownItems: const [
            DropdownMenuItem(value: 'Abuja', child: Text('Abuja')),
            DropdownMenuItem(value: 'Lagos', child: Text('Lagos')),
          ],
          onDropdownChanged: (value) => setState(() => _city = value),
        ),
        const SizedBox(height: AppSpacing.md),
        IleInput(
          label: 'Check-in',
          type: IleInputType.date,
          hintText: 'Select date',
          readOnly: true,
          onTap: () async {
            await showDatePicker(
              context: context,
              initialDate: DateTime.now(),
              firstDate: DateTime.now(),
              lastDate: DateTime.now().add(const Duration(days: 365)),
            );
          },
        ),
        const SizedBox(height: AppSpacing.md),
        const IleInput(
          label: 'Email',
          hintText: 'you@example.com',
          errorText: 'Enter a valid email address',
        ),
      ],
    );
  }

  Widget _buildBadgesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IleSectionHeading(title: 'Badges'),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: const [
            IleVerifiedBadge(),
            IleBadge(label: 'Confirmed', tone: IleBadgeTone.success),
            IleBadge(label: 'Pending', tone: IleBadgeTone.warning),
            IleBadge(label: 'Scheduled', tone: IleBadgeTone.info),
            IleBadge(label: 'Cancelled', tone: IleBadgeTone.critical),
            IleBadge(
              label: 'Verified stay',
              tone: IleBadgeTone.emerald,
              isUppercase: true,
            ),
            IleAvatar(initials: 'AB', size: 36),
          ],
        ),
      ],
    );
  }

  Widget _buildCardsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IleSectionHeading(title: 'Cards'),
        const SizedBox(height: AppSpacing.md),
        IlePropertyCard(
          title: 'Maitama Heights Executive Suite',
          location: 'Maitama, Abuja',
          pricePerNight: 180000,
          rating: 4.96,
          reviewCount: 38,
          onTap: () => context.go(AppRoutes.propertyDetailsPath('demo')),
        ),
      ],
    );
  }

  Widget _buildStatesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IleSectionHeading(title: 'States'),
        const SizedBox(height: AppSpacing.md),
        const IleCard(
          child: IleLoadingIndicator(message: 'Loading curated stays…'),
        ),
        const SizedBox(height: AppSpacing.sm),
        IleCard(
          child: IleEmptyState(
            title: 'No favorites yet',
            message: 'Save verified stays to revisit them here.',
            actionLabel: 'Explore',
            onAction: () => context.go(AppRoutes.search),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        IleCard(
          child: IleErrorState(
            title: 'We couldn’t load this listing',
            message: 'Check your connection and try again.',
            onRetry: () {},
          ),
        ),
      ],
    );
  }

  Widget _buildControlsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IleSectionHeading(title: 'Selection controls'),
        const SizedBox(height: AppSpacing.sm),
        CheckboxListTile(
          value: true,
          onChanged: (_) {},
          title: Text('Solar + inverter guaranteed', style: AppTypography.body),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
        ),
        SwitchListTile(
          value: _switchValue,
          onChanged: (value) => setState(() => _switchValue = value),
          title: Text('Push arrival reminders', style: AppTypography.body),
          contentPadding: EdgeInsets.zero,
        ),
      ],
    );
  }

  Widget _buildNavigationSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const IleSectionHeading(
          title: 'Marketplace routes',
          subtitle: 'Jumps into the live guest shell tabs and tools',
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            IleButton(
              label: 'Explore',
              variant: IleButtonVariant.secondary,
              onPressed: () => context.go(AppRoutes.explore),
            ),
            IleButton(
              label: 'Search',
              variant: IleButtonVariant.secondary,
              onPressed: () => context.go(AppRoutes.searchResults),
            ),
            IleButton(
              label: 'Bookings',
              variant: IleButtonVariant.secondary,
              onPressed: () => context.go(AppRoutes.bookings),
            ),
            IleButton(
              label: 'Saved',
              variant: IleButtonVariant.secondary,
              onPressed: () => context.go(AppRoutes.wishlist),
            ),
            IleButton(
              label: 'Profile',
              variant: IleButtonVariant.secondary,
              onPressed: () => context.go(AppRoutes.profile),
            ),
            IleButton(
              label: 'Host',
              variant: IleButtonVariant.secondary,
              onPressed: () => context.go(AppRoutes.hostDashboard),
            ),
          ],
        ),
      ],
    );
  }
}

class _Swatch extends StatelessWidget {
  const _Swatch({
    required this.label,
    required this.color,
    this.onDark = false,
  });

  final String label;
  final Color color;
  final bool onDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 104,
      padding: const EdgeInsets.all(AppSpacing.xs),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 36,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.borderSubtle),
            ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            label,
            style: AppTypography.caption.copyWith(
              color: AppColors.foreground,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
