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
                    begin: Alignment(-1.4 + (t * 2.8), -0.2),
                    end: Alignment(-0.2 + (t * 2.8), 0.4),
                    colors: const <Color>[
                      EditorialColors.shimmerStart,
                      EditorialColors.shimmerMid,
                      EditorialColors.shimmerEnd,
                    ],
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
      ..color = EditorialColors.brand.withValues(alpha: 0.34)
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
  });

  final bool isSaved;
  final VoidCallback onPressed;

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
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: EditorialColors.glass,
                border: Border.all(color: EditorialColors.glassBorder),
              ),
              child: Icon(
                widget.isSaved
                    ? Icons.favorite_rounded
                    : Icons.favorite_border_rounded,
                size: 22,
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

class EditorialToolbar extends StatelessWidget {
  const EditorialToolbar({
    super.key,
    required this.title,
    this.onBack,
    this.trailing,
    this.explorePill = false,
  });

  final String title;
  final VoidCallback? onBack;
  final Widget? trailing;
  final bool explorePill;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: EditorialColors.glass,
      child: SizedBox(
        height: 56,
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
                style: AppTypography.screenTitle.copyWith(
                  color: EditorialColors.ink,
                  fontSize: 22,
                ),
              ),
            ),
            Positioned(
              left: 8,
              child: explorePill
                  ? _ExplorePill(
                      onPressed: () => context.go(AppRoutes.explore),
                    )
                  : IleCircularBackButton(
                      onPressed: onBack,
                      visualSize: 38,
                      fillColor: EditorialColors.card,
                      iconColor: EditorialColors.brand,
                    ),
            ),
            Positioned(
              right: 8,
              child: trailing ?? const SizedBox(width: 44, height: 44),
            ),
          ],
        ),
      ),
    );
  }
}

class _ExplorePill extends StatelessWidget {
  const _ExplorePill({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Back to Explore',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: AppRadius.pillAll,
            child: Ink(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: EditorialColors.card,
              borderRadius: AppRadius.pillAll,
              border: Border.all(color: EditorialColors.hairline),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.arrow_back_rounded,
                  size: 16,
                  color: EditorialColors.brand,
                ),
                const SizedBox(width: 4),
                Text(
                  'Explore',
                  style: AppTypography.supporting.copyWith(
                    color: EditorialColors.brand,
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

class EditorialHelpButton extends StatelessWidget {
  const EditorialHelpButton({super.key});

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: 'Help',
      onPressed: () => context.push(AppRoutes.help),
      icon: const Icon(Icons.help_outline_rounded, color: EditorialColors.brand),
      constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
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

/// Frosted sign-in gate. Auth itself stays on the existing login route.
class GuestSignInGate extends StatelessWidget {
  const GuestSignInGate({
    super.key,
    required this.returnPath,
    required this.preview,
    required this.message,
  });

  final String returnPath;
  final Widget preview;
  final String message;

  @override
  Widget build(BuildContext context) {
    final String login =
        '${AppRoutes.login}?returnTo=${Uri.encodeComponent(returnPath)}';
    return ListView(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.screenHorizontal,
        AppSpacing.md,
        AppSpacing.screenHorizontal,
        EditorialLayout.dockClearance(context) + AppSpacing.lg,
      ),
      children: [
        preview,
        const SizedBox(height: AppSpacing.lg),
        Text(message, style: AppTypography.body.copyWith(color: EditorialColors.ink)),
        const SizedBox(height: AppSpacing.lg),
        IleButton(
          label: 'Continue with phone or email',
          onPressed: () => context.push(login),
          isExpanded: true,
        ),
      ],
    );
  }
}

/// Clearly labeled sample gate pass. Not a reservation and not a real code.
class SampleStayPass extends StatelessWidget {
  const SampleStayPass({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Sample digital key card. This is not your reservation.',
      child: SizedBox(
        height: 248,
        child: Stack(
          children: [
            Positioned(
              left: 16,
              right: 16,
              top: 18,
              child: Container(
                height: 180,
                decoration: BoxDecoration(
                  color: EditorialColors.brand.withValues(alpha: 0.72),
                  borderRadius: AppRadius.editorialCardAll,
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              top: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
                decoration: BoxDecoration(
                  color: EditorialColors.brand,
                  borderRadius: AppRadius.editorialCardAll,
                  boxShadow: AppShadows.editorialCard,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'SAMPLE',
                          style: AppTypography.microLabel.copyWith(
                            color: EditorialColors.gold,
                            letterSpacing: 1.4,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          'Preview',
                          style: AppTypography.caption.copyWith(
                            color: EditorialColors.onBrand.withValues(alpha: 0.8),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Gate pass',
                      style: AppTypography.screenTitle.copyWith(
                        color: EditorialColors.onBrand,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Not your reservation',
                      style: AppTypography.supporting.copyWith(
                        color: EditorialColors.onBrand.withValues(alpha: 0.86),
                      ),
                    ),
                    const SizedBox(height: 16),
                    const _PassRow(
                      label: 'Gate code',
                      value: 'Shown after the host confirms',
                    ),
                    const _PassRow(
                      label: 'Wi-Fi',
                      value: 'Sent with your check-in note',
                    ),
                    const _PassRow(
                      label: 'Concierge',
                      value: 'Desk messages live in Inbox',
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PassRow extends StatelessWidget {
  const _PassRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 88,
            child: Text(
              label,
              style: AppTypography.caption.copyWith(
                color: EditorialColors.gold,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: AppTypography.supporting.copyWith(
                color: EditorialColors.onBrand,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Sample concierge thread. Distinct from the bookings key card.
class SampleConciergeThread extends StatelessWidget {
  const SampleConciergeThread({super.key});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Sample concierge conversation. Not a real message thread.',
      child: EditorialCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'SAMPLE THREAD',
              style: AppTypography.microLabel.copyWith(
                color: EditorialColors.gold,
                letterSpacing: 1.2,
              ),
            ),
            const SizedBox(height: 8),
            Text('Concierge', style: AppTypography.cardTitle),
            const SizedBox(height: 4),
            Text(
              'A preview of Inbox. Nothing here is a message to you.',
              style: AppTypography.caption.copyWith(color: EditorialColors.inkMuted),
            ),
            const SizedBox(height: 16),
            const _ThreadBubble(
              text:
                  'Hi — I can help with arrival questions after your host confirms the stay.',
            ),
            const SizedBox(height: 8),
            const _ThreadBubble(
              text:
                  'Gate codes and Wi-Fi are not in this preview. They appear on a confirmed booking.',
            ),
          ],
        ),
      ),
    );
  }
}

class _ThreadBubble extends StatelessWidget {
  const _ThreadBubble({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: EditorialColors.shimmerStart,
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(6),
          topRight: Radius.circular(18),
          bottomLeft: Radius.circular(18),
          bottomRight: Radius.circular(18),
        ),
      ),
      child: Text(
        text,
        style: AppTypography.supporting.copyWith(color: EditorialColors.ink),
      ),
    );
  }
}

class EditorialGlassChip extends StatelessWidget {
  const EditorialGlassChip({
    super.key,
    required this.icon,
    required this.label,
    this.iconColor = EditorialColors.gold,
  });

  final IconData icon;
  final String label;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.pillAll,
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: EditorialColors.glass,
            borderRadius: AppRadius.pillAll,
            border: Border.all(color: EditorialColors.glassBorder),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 14, color: iconColor),
                const SizedBox(width: 4),
                Text(
                  label,
                  style: AppTypography.caption.copyWith(
                    color: EditorialColors.ink,
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
