import 'package:flutter/material.dart';

import 'skeleton_box.dart';

/// Circular skeleton placeholder (avatars, social icons, OTP slots).
class SkeletonCircle extends StatelessWidget {
  const SkeletonCircle({
    super.key,
    this.size = 44,
  });

  final double size;

  @override
  Widget build(BuildContext context) {
    return SkeletonBox(
      width: size,
      height: size,
      borderRadius: BorderRadius.circular(size / 2),
    );
  }
}
