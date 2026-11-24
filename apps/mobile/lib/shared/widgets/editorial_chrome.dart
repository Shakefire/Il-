import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_shadows.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/constants/app_routes.dart';
import '../../core/utils/formatters.dart';
import 'ile_button.dart';
import 'ile_circular_back_button.dart';

abstract final class EditorialLayout {
  static double dockClearance(BuildContext context) {
    return AppSpacing.dockHeight +
        AppSpacing.dockMarginBottom +
        MediaQuery.paddingOf(context).bottom;
  }

  static bool reduceMotion(BuildContext context) {
    return MediaQuery.disableAnimationsOf(context);
  }

  /// Style 1 page snap curve ≈ `cubic-bezier(0.22, 1, 0.36, 1)`.
  static const Curve tabSnap = Cubic(0.22, 1.0, 0.36, 1.0);
}

class EditorialPrice extends StatelessWidget {
  const EditorialPrice({super.key, required this.amount, this.suffix = '/ night'});

  final int amount;
  final String suffix;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        children: [
          TextSpan(
            text: '₦${IleFormatters.formatInteger(amount)}',
            style: AppTypography.price,
          ),
          TextSpan(
            text: ' $suffix',
            style: AppTypography.supporting.copyWith(
              fontSize: 13,
              color: EditorialColors.inkMuted,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class EditorialShimmer extends StatefulWidget {
  const EditorialShimmer({super.key, this.showMark = false});

  final bool showMark;

  @override
  State<EditorialShimmer> createState() => _EditorialShimmerState();
}

class _EditorialShimmerState extends State<EditorialShimmer>
    with SingleTickerProviderStateMixin {
  AnimationController? _controller;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final bool reduce = EditorialLayout.reduceMotion(context);
    if (reduce) {
      _controller?.dispose();
      _controller = null;
      return;
    }
    _controller ??= AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AnimationController? controller = _controller;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (controller == null)
          const ColoredBox(color: EditorialColors.shimmerMid)
        else
          AnimatedBuilder(
            animation: controller,
            builder: (BuildContext context, Widget? child) {
              final double t = controller.value;
              return DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment(-1.2 + (t * 2.6), -0.15),
                    end: Alignment(-0.1 + (t * 2.6), 0.35),
                    colors: const <Color>[
                      EditorialColors.shimmerStart,
                      EditorialColors.shimmerMid,
                      EditorialColors.shimmerStart,
                    ],
                    stops: const <double>[0.08, 0.18, 0.33],
                  ),
                ),
              );
            },
          ),
        if (widget.showMark) const Center(child: _StayMark(size: 72)),
      ],
    );
  }
}

class EditorialImage extends StatelessWidget {
  const EditorialImage({super.key, required this.url});

  final String url;

  @override
  Widget build(BuildContext context) {
    if (url.isEmpty) {
      return const EditorialShimmer(showMark: true);
    }
    return CachedNetworkImage(
      imageUrl: url,
      fit: BoxFit.cover,
      fadeInDuration: EditorialLayout.reduceMotion(context)
          ? Duration.zero
          : const Duration(milliseconds: 180),
      placeholder: (BuildContext context, String imageUrl) =>
          const EditorialShimmer(),
      errorWidget: (BuildContext context, String imageUrl, Object error) =>
          const EditorialShimmer(showMark: true),
    );
  }
}

class _StayMark extends StatelessWidget {
  const _StayMark({required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _StayMarkPainter(),
    );
  }
}

class _StayMarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = EditorialColors.brand.withValues(alpha: 0.28)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final double w = size.width;
    final double h = size.height;
    final Path roof = Path()
      ..moveTo(w * 0.18, h * 0.58)
      ..lineTo(w * 0.5, h * 0.28)
      ..lineTo(w * 0.82, h * 0.58);
    canvas.drawPath(roof, paint);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTWH(w * 0.3, h * 0.58, w * 0.4, h * 0.24),
        const Radius.circular(3),
      ),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class WishlistHeartButton extends StatefulWidget {
  const WishlistHeartButton({
    super.key,
    required this.isSaved,
    required this.onPressed,
    this.size = 36,
  });

  final bool isSaved;
  final VoidCallback onPressed;
  final double size;

  @override
  State<WishlistHeartButton> createState() => _WishlistHeartButtonState();
}

class _WishlistHeartButtonState extends State<WishlistHeartButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTap() {
    if (!EditorialLayout.reduceMotion(context)) {
      HapticFeedback.lightImpact();
      _controller.forward(from: 0);
    }
    widget.onPressed();
  }

  double _scaleFor(double t) {
    if (t < 0.45) return 1 + (0.18 * (t / 0.45));
    if (t < 0.75) return 1.18 - (0.24 * ((t - 0.45) / 0.3));
    return 0.94 + (0.06 * ((t - 0.75) / 0.25));
  }

  @override
  Widget build(BuildContext context) {
    final double size = widget.size;
    return Semantics(
      button: true,
      label: widget.isSaved ? 'Remove from saved' : 'Save stay',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _handleTap,
          customBorder: const CircleBorder(),
          child: AnimatedBuilder(
            animation: _controller,
            builder: (BuildContext context, Widget? child) {
              final double scale = _controller.isAnimating
                  ? _scaleFor(_controller.value)
                  : 1;
              return Transform.scale(scale: scale, child: child);
            },
            child: Ink(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xEBFFFFFF),
                border: Border.all(color: EditorialColors.glassBorder),
              ),
              child: Icon(
                widget.isSaved
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                size: size * 0.5,
                color: widget.isSaved
                    ? EditorialColors.heart
                    : EditorialColors.brand,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Unified frosted top bar for shell tabs and pushed child screens.
class TopNavBar extends StatelessWidget implements PreferredSizeWidget {
  const TopNavBar({
    super.key,
    required this.title,
    this.explorePill = false,
    this.onBack,
    this.trailing,
  });

  final String title;
  final bool explorePill;
  final VoidCallback? onBack;
  final Widget? trailing;

  @override
  Size get preferredSize => const Size.fromHeight(AppSpacing.topNavHeight);

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: Color(0xE0FAF8F5),
            border: Border(
              bottom: BorderSide(color: EditorialColors.headerRule),
            ),
          ),
          child: SizedBox(
            height: AppSpacing.topNavHeight,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 108),
                    child: Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: AppTypography.screenTitle,
                    ),
                  ),
                  Positioned(
                    left: 0,
                    child: explorePill
                        ? const _ExplorePill()
                        : IleCircularBackButton(
                            onPressed: onBack,
                            visualSize: 38,
                            fillColor: EditorialColors.card,
                            iconColor: EditorialColors.brand,
                            borderColor: EditorialColors.stroke,
                          ),
                  ),
                  Positioned(
                    right: 0,
                    child: trailing ?? const SizedBox(width: 38, height: 38),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Alias kept for existing call sites.
typedef EditorialToolbar = TopNavBar;

class _ExplorePill extends StatelessWidget {
  const _ExplorePill();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Back to Explore',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => context.go(AppRoutes.explore),
          borderRadius: AppRadius.pillAll,
          child: Ink(
            height: 36,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: EditorialColors.explorePillFill,
              borderRadius: AppRadius.pillAll,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.arrow_back_rounded,
                  size: 16,
                  color: EditorialColors.ink,
                ),
                const SizedBox(width: 4),
                Text(
                  'Explore',
                  style: AppTypography.supporting.copyWith(
                    color: EditorialColors.ink,
                    fontWeight: FontWeight.w500,
                    fontSize: 13,
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

class EditorialHelpButton extends StatelessWidget {
  const EditorialHelpButton({super.key});

  @override
  Widget build(BuildContext context) {
    return _ChromeIconButton(
      tooltip: 'Help',
      icon: Icons.help_outline_rounded,
      onPressed: () => context.push(AppRoutes.help),
    );
  }
}

class EditorialSettingsButton extends StatelessWidget {
  const EditorialSettingsButton({super.key, required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return _ChromeIconButton(
      tooltip: 'Settings',
      icon: Icons.settings_outlined,
      onPressed: onPressed,
    );
  }
}

class EditorialMarkReadButton extends StatelessWidget {
  const EditorialMarkReadButton({super.key, this.onPressed});

  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return _ChromeIconButton(
      tooltip: 'Mark all read',
      icon: Icons.done_all_rounded,
      onPressed: onPressed ?? () {},
    );
  }
}

class _ChromeIconButton extends StatelessWidget {
  const _ChromeIconButton({
    required this.tooltip,
    required this.icon,
    required this.onPressed,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: EditorialColors.card,
        shape: const CircleBorder(
          side: BorderSide(color: EditorialColors.stroke),
        ),
        child: InkWell(
          onTap: onPressed,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: 38,
            height: 38,
            child: Icon(icon, size: 18, color: EditorialColors.brand),
          ),
        ),
      ),
    );
  }
}

class EditorialCard extends StatelessWidget {
  const EditorialCard({super.key, required this.child, this.padding});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: EditorialColors.card,
        borderRadius: AppRadius.editorialCardAll,
        border: Border.all(color: EditorialColors.hairline),
        boxShadow: AppShadows.editorialCard,
      ),
      child: Padding(
        padding: padding ?? const EdgeInsets.all(AppSpacing.lg),
        child: child,
      ),
    );
  }
}

/// Sign-in gate — empty-state copy only; no demo bookings or fake threads.
class GuestSignInGate extends StatelessWidget {
  const GuestSignInGate({
    super.key,
    required this.returnPath,
    required this.message,
    this.title = 'Sign in to continue',
    this.icon = Icons.lock_outline_rounded,
  });

  final String returnPath;
  final String message;
  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final String login =
        '${AppRoutes.login}?returnTo=${Uri.encodeComponent(returnPath)}';
    final String register =
        '${AppRoutes.register}?returnTo=${Uri.encodeComponent(returnPath)}';
    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.screenHorizontal,
        8,
        AppSpacing.screenHorizontal,
        EditorialLayout.dockClearance(context) + AppSpacing.lg,
      ),
      children: [
        const SizedBox(height: 24),
        Center(
          child: Container(
            width: AppSpacing.guestGateIcon,
            height: AppSpacing.guestGateIcon,
            margin: const EdgeInsets.only(top: 0),
            clipBehavior: Clip.none,
            decoration: BoxDecoration(
              color: EditorialColors.tint,
              borderRadius: BorderRadius.circular(20),
            ),
            alignment: Alignment.center,
            child: Icon(icon, size: 28, color: EditorialColors.brand),
          ),
        ),
        const SizedBox(height: 20),
        EditorialCard(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                title,
                textAlign: TextAlign.center,
                style: AppTypography.sectionHeading.copyWith(fontSize: 22),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                message,
                textAlign: TextAlign.center,
                style: AppTypography.body.copyWith(
                  color: EditorialColors.inkMuted,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              IleButton(
                label: 'Sign in',
                onPressed: () => context.push(login),
                isExpanded: true,
                height: AppSpacing.guestCtaHeight,
                borderRadius: BorderRadius.circular(14),
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: AppSpacing.guestCtaHeight,
                child: OutlinedButton(
                  onPressed: () => context.push(register),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: EditorialColors.ink,
                    side: const BorderSide(color: EditorialColors.outlineButton),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                    minimumSize: const Size.fromHeight(AppSpacing.guestCtaHeight),
                  ),
                  child: Text(
                    'Create account',
                    style: AppTypography.buttonSecondary.copyWith(
                      color: EditorialColors.ink,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// Design-system-only preview (not used on production guest shells).
@Deprecated('Demo sample removed from guest shells; keep only for design kit')
class SampleStayPass extends StatelessWidget {
  const SampleStayPass({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}

/// Design-system-only preview (not used on production guest shells).
@Deprecated('Demo sample removed from guest shells; keep only for design kit')
class SampleConciergeThread extends StatelessWidget {
  const SampleConciergeThread({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox.shrink();
  }
}

class EditorialGlassChip extends StatelessWidget {
  const EditorialGlassChip({
    super.key,
    required this.icon,
    required this.label,
    this.iconColor = EditorialColors.gold,
    this.dark = false,
  });

  final IconData icon;
  final String label;
  final Color iconColor;
  final bool dark;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.pillAll,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: dark ? 8 : 20, sigmaY: dark ? 8 : 20),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: dark
                ? EditorialColors.trustScrim
                : const Color(0xEBFFFFFF),
            borderRadius: AppRadius.pillAll,
            border: dark
                ? null
                : Border.all(color: EditorialColors.glassBorder),
          ),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: dark ? 12 : 12,
              vertical: dark ? 0 : 6,
            ),
            child: SizedBox(
              height: dark ? 30 : null,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(icon, size: dark ? 12 : 14, color: iconColor),
                  const SizedBox(width: 4),
                  Text(
                    label,
                    style: AppTypography.caption.copyWith(
                      color: dark ? Colors.white : EditorialColors.ink,
                      fontWeight: FontWeight.w600,
                      fontSize: dark ? 11 : 12,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Continuous tab swipe offset (0…4) shared by dock indicator + Map fade.
class MarketplaceSwipeScope extends InheritedNotifier<ValueNotifier<double>> {
  const MarketplaceSwipeScope({
    super.key,
    required ValueNotifier<double> notifier,
    required super.child,
  }) : super(notifier: notifier);

  static double offsetOf(BuildContext context) {
    final MarketplaceSwipeScope? scope =
        context.dependOnInheritedWidgetOfExactType<MarketplaceSwipeScope>();
    return scope?.notifier?.value ?? 0;
  }

  static ValueNotifier<double>? notifierOf(BuildContext context) {
    return context
        .dependOnInheritedWidgetOfExactType<MarketplaceSwipeScope>()
        ?.notifier;
  }
}
