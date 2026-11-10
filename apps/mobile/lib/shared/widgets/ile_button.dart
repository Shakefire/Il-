import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';

enum IleButtonVariant { primary, secondary, neutral, text }

/// Ilé action button with restrained press scale.
///
/// Set [compact] for auth CTAs (rounded-2xl, Deep Forest Green #13674B, Plus Jakarta).
class IleButton extends StatefulWidget {
  const IleButton({
    super.key,
    required this.label,
    this.onPressed,
    this.variant = IleButtonVariant.primary,
    this.isLoading = false,
    this.isExpanded = false,
    this.leading,
    this.trailing,
    this.semanticLabel,
    this.compact = false,
    this.borderRadius,
  });

  final String label;
  final VoidCallback? onPressed;
  final IleButtonVariant variant;
  final bool isLoading;
  final bool isExpanded;
  final Widget? leading;
  final Widget? trailing;
  final String? semanticLabel;
  final bool compact;
  final BorderRadius? borderRadius;

  @override
  State<IleButton> createState() => _IleButtonState();
}

class _IleButtonState extends State<IleButton> {
  bool _isPressed = false;

  bool get _isDisabled => widget.onPressed == null || widget.isLoading;

  void _handleTapDown(TapDownDetails details) {
    if (_isDisabled) return;
    setState(() => _isPressed = true);
  }

  void _handleTapUp(TapUpDetails details) {
    if (_isDisabled) return;
    setState(() => _isPressed = false);
  }

  void _handleTapCancel() {
    if (_isDisabled) return;
    setState(() => _isPressed = false);
  }

  @override
  Widget build(BuildContext context) {
    final Color background = _resolveBackground();
    final Color foreground = _resolveForeground();
    final Border? border = _resolveBorder();
    final double height =
        widget.compact ? AppSpacing.authButtonHeight : AppSpacing.touchTarget;
    final BorderRadius radius = widget.borderRadius ??
        (widget.compact ? AppRadius.authButtonAll : AppRadius.buttonAll);
    final TextStyle labelStyle = widget.compact
        ? AppTypography.Auth.button.copyWith(color: foreground)
        : (widget.variant == IleButtonVariant.primary
                ? AppTypography.button
                : AppTypography.buttonSecondary)
            .copyWith(color: foreground);

    final Widget child = AnimatedScale(
      scale: _isPressed ? 0.99 : 1,
      duration: const Duration(milliseconds: 150),
      curve: Curves.easeOut,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        height: height,
        padding: EdgeInsets.symmetric(
          horizontal: widget.variant == IleButtonVariant.text
              ? AppSpacing.xs
              : widget.variant == IleButtonVariant.primary
                  ? AppSpacing.buttonHorizontal
                  : AppSpacing.buttonHorizontalSecondary,
        ),
        decoration: BoxDecoration(
          color: background,
          borderRadius: radius,
          border: border,
          boxShadow: widget.variant == IleButtonVariant.primary &&
                  !_isDisabled &&
                  !widget.compact
              ? const [
                  BoxShadow(
                    color: Color(0x0D000000),
                    offset: Offset(0, 1),
                    blurRadius: 2,
                  ),
                ]
              : null,
        ),
        alignment: Alignment.center,
        child: widget.isLoading
            ? SizedBox(
                width: widget.compact ? 14 : 18,
                height: widget.compact ? 14 : 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: foreground,
                ),
              )
            : Row(
                mainAxisSize:
                    widget.isExpanded ? MainAxisSize.max : MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (widget.leading != null) ...[
                    IconTheme(
                      data: IconThemeData(
                        color: foreground,
                        size: widget.compact ? 15 : 18,
                      ),
                      child: widget.leading!,
                    ),
                    const SizedBox(width: AppSpacing.xs),
                  ],
                  Flexible(
                    child: Text(
                      widget.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: labelStyle,
                    ),
                  ),
                  if (widget.trailing != null) ...[
                    const SizedBox(width: AppSpacing.xs),
                    IconTheme(
                      data: IconThemeData(
                        color: foreground,
                        size: widget.compact ? 15 : 18,
                      ),
                      child: widget.trailing!,
                    ),
                  ],
                ],
              ),
      ),
    );

    return Semantics(
      button: true,
      enabled: !_isDisabled,
      label: widget.semanticLabel ?? widget.label,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: _isDisabled ? null : widget.onPressed,
          onTapDown: _handleTapDown,
          onTapUp: _handleTapUp,
          onTapCancel: _handleTapCancel,
          borderRadius: radius,
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
          child: widget.isExpanded
              ? SizedBox(width: double.infinity, child: child)
              : child,
        ),
      ),
    );
  }

  Color get _primaryFill =>
      widget.compact ? AuthColors.primary : AppColors.buttonPrimary;

  Color get _primaryPressed =>
      widget.compact ? AuthColors.primaryHover : AppColors.buttonPrimaryHover;

  Color _resolveBackground() {
    if (widget.variant == IleButtonVariant.text) {
      return Colors.transparent;
    }
    if (_isDisabled) {
      if (widget.variant == IleButtonVariant.primary) {
        return _primaryFill.withValues(alpha: 0.5);
      }
      return AppColors.surface.withValues(alpha: 0.5);
    }
    if (_isPressed) {
      switch (widget.variant) {
        case IleButtonVariant.primary:
          return _primaryPressed;
        case IleButtonVariant.secondary:
        case IleButtonVariant.neutral:
          return AppColors.background;
        case IleButtonVariant.text:
          return Colors.transparent;
      }
    }
    switch (widget.variant) {
      case IleButtonVariant.primary:
        return _primaryFill;
      case IleButtonVariant.secondary:
      case IleButtonVariant.neutral:
        return AppColors.surface;
      case IleButtonVariant.text:
        return Colors.transparent;
    }
  }

  Color _resolveForeground() {
    if (_isDisabled && widget.variant != IleButtonVariant.primary) {
      return AppColors.foregroundMuted;
    }
    switch (widget.variant) {
      case IleButtonVariant.primary:
        return AppColors.onDark;
      case IleButtonVariant.secondary:
      case IleButtonVariant.neutral:
        return _isPressed ? AppColors.textMain : AppColors.textMuted;
      case IleButtonVariant.text:
        return _isPressed
            ? (widget.compact ? AuthColors.primaryHover : AppColors.emeraldHover)
            : (widget.compact ? AuthColors.primary : AppColors.emerald);
    }
  }

  Border? _resolveBorder() {
    if (widget.variant == IleButtonVariant.primary ||
        widget.variant == IleButtonVariant.text) {
      return null;
    }
    return Border.all(
      color: _isPressed ? AppColors.inputBorderHover : AppColors.borderLight,
    );
  }
}
