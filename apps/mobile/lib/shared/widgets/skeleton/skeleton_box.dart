import 'package:flutter/material.dart';

import '../../../app/app_colors.dart';
import '../../../app/app_radius.dart';

/// Pulsing rectangular placeholder. Honors reduced-motion preferences.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox({
    super.key,
    this.width,
    this.height = 16,
    this.borderRadius = AppRadius.subtleAll,
    this.color,
  });

  final double? width;
  final double height;
  final BorderRadius borderRadius;
  final Color? color;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  AnimationController? _controller;
  Animation<double>? _animation;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final bool reduceMotion = MediaQuery.of(context).disableAnimations;
    if (reduceMotion) {
      _controller?.dispose();
      _controller = null;
      _animation = null;
      return;
    }
    if (_controller != null) {
      return;
    }
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
    _animation = CurvedAnimation(
      parent: _controller!,
      curve: Curves.easeInOut,
    );
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final Color base = widget.color ?? EditorialColors.shimmerStart;
    final Animation<double>? animation = _animation;
    if (animation == null) {
      return _buildBox(base);
    }
    return AnimatedBuilder(
      animation: animation,
      builder: (BuildContext context, Widget? child) {
        final double t = animation.value;
        return _buildBox(
          Color.lerp(base, EditorialColors.shimmerEnd, t) ?? base,
        );
      },
    );
  }

  Widget _buildBox(Color color) {
    return Semantics(
      label: 'Loading',
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: color,
          borderRadius: widget.borderRadius,
        ),
      ),
    );
  }
}
