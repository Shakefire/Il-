import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';

enum IleInputType { text, password, search, dropdown, date }

/// Foundation text field aligned to `.ile-input` styles.
///
/// Set [compact] for auth screens (borderless fill field, Plus Jakarta).
class IleInput extends StatefulWidget {
  const IleInput({
    super.key,
    this.label,
    this.hintText,
    this.helperText,
    this.errorText,
    this.controller,
    this.focusNode,
    this.type = IleInputType.text,
    this.enabled = true,
    this.readOnly = false,
    this.onChanged,
    this.onSubmitted,
    this.onTap,
    this.prefixIcon,
    this.suffixIcon,
    this.keyboardType,
    this.textInputAction,
    this.inputFormatters,
    this.dropdownItems,
    this.dropdownValue,
    this.onDropdownChanged,
    this.semanticLabel,
    this.fillColor,
    this.autocorrect = true,
    this.enableSuggestions = true,
    this.compact = false,
  });

  final String? label;
  final String? hintText;
  final String? helperText;
  final String? errorText;
  final TextEditingController? controller;
  final FocusNode? focusNode;
  final IleInputType type;
  final bool enabled;
  final bool readOnly;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final VoidCallback? onTap;
  final Widget? prefixIcon;
  final Widget? suffixIcon;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final List<TextInputFormatter>? inputFormatters;
  final List<DropdownMenuItem<String>>? dropdownItems;
  final String? dropdownValue;
  final ValueChanged<String?>? onDropdownChanged;
  final String? semanticLabel;
  final Color? fillColor;
  final bool autocorrect;
  final bool enableSuggestions;
  final bool compact;

  @override
  State<IleInput> createState() => _IleInputState();
}

class _IleInputState extends State<IleInput> {
  late bool _obscureText;
  FocusNode? _internalFocus;

  FocusNode get _focusNode => widget.focusNode ?? _internalFocus!;

  @override
  void initState() {
    super.initState();
    _obscureText = widget.type == IleInputType.password;
    if (widget.focusNode == null) {
      _internalFocus = FocusNode();
    }
  }

  @override
  void dispose() {
    _internalFocus?.dispose();
    super.dispose();
  }

  void _handleToggleObscure() {
    setState(() => _obscureText = !_obscureText);
  }

  double get _fieldHeight =>
      widget.compact ? AppSpacing.authInputHeight : AppSpacing.touchTarget;

  BorderRadius get _radius =>
      widget.compact ? AppRadius.authInputAll : AppRadius.inputAll;

  TextStyle get _labelStyle => widget.compact
      ? AppTypography.Auth.formLabel
      : AppTypography.supporting.copyWith(
          fontWeight: FontWeight.w500,
          color: AppColors.foreground,
        );

  TextStyle get _inputStyle => widget.compact
      ? AppTypography.Auth.input
      : AppTypography.body.copyWith(fontSize: 14, color: AppColors.textMain);

  TextStyle get _hintStyle => widget.compact
      ? AppTypography.Auth.inputHint
      : AppTypography.supporting.copyWith(color: AppColors.placeholder);

  double get _iconSize =>
      widget.compact ? AppSpacing.authFieldIconSize : 20;

  @override
  Widget build(BuildContext context) {
    final bool hasError =
        widget.errorText != null && widget.errorText!.isNotEmpty;

    return Semantics(
      textField: widget.type != IleInputType.dropdown,
      label: widget.semanticLabel ?? widget.label,
      enabled: widget.enabled,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (widget.label != null) ...[
            Text(widget.label!, style: _labelStyle),
            SizedBox(
              height: widget.compact
                  ? AppSpacing.authLabelGap
                  : AppSpacing.xs,
            ),
          ],
          if (widget.type == IleInputType.dropdown)
            _buildDropdown(hasError)
          else
            _buildTextField(hasError),
          if (hasError) ...[
            const SizedBox(height: AppSpacing.xxs),
            Text(
              widget.errorText!,
              style: (widget.compact
                      ? AppTypography.Auth.formLabel
                      : AppTypography.caption)
                  .copyWith(color: AppColors.criticalText),
            ),
          ] else if (widget.helperText != null) ...[
            const SizedBox(height: AppSpacing.xxs),
            Text(
              widget.helperText!,
              style: widget.compact
                  ? AppTypography.Auth.formLabel
                  : AppTypography.caption,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTextField(bool hasError) {
    final Color fill = widget.fillColor ??
        (widget.compact ? AuthColors.inputFill : AppColors.surface);
    final InputBorder enabledBorder = widget.compact
        ? OutlineInputBorder(
            borderRadius: _radius,
            borderSide: const BorderSide(
              color: AuthColors.borderLight,
              width: 0.85,
            ),
          )
        : const OutlineInputBorder(
            borderRadius: AppRadius.inputAll,
            borderSide: BorderSide(color: AppColors.inputBorder, width: 1),
          );
    final InputBorder focusedBorder = OutlineInputBorder(
      borderRadius: _radius,
      borderSide: BorderSide(
        color: hasError
            ? AppColors.inputErrorFocus
            : (widget.compact ? AuthColors.primary : AppColors.buttonPrimary),
        width: widget.compact ? 1.1 : 1.5,
      ),
    );
    final InputBorder errorBorder = OutlineInputBorder(
      borderRadius: _radius,
      borderSide: const BorderSide(
        color: AppColors.inputErrorBorder,
        width: 1,
      ),
    );
    final InputBorder restingBorder = widget.compact
        ? (hasError ? errorBorder : enabledBorder)
        : enabledBorder;

    return SizedBox(
      height: _fieldHeight,
      child: TextField(
        controller: widget.controller,
        focusNode: _focusNode,
        enabled: widget.enabled,
        readOnly: widget.readOnly ||
            widget.type == IleInputType.date ||
            widget.type == IleInputType.dropdown,
        obscureText: widget.type == IleInputType.password && _obscureText,
        onChanged: widget.onChanged,
        onSubmitted: widget.onSubmitted,
        onTap: widget.onTap,
        keyboardType: widget.keyboardType ?? _defaultKeyboardType(),
        textInputAction: widget.textInputAction,
        inputFormatters: widget.inputFormatters,
        style: _inputStyle.copyWith(
          color: hasError ? AppColors.inputErrorText : AuthColors.inputText,
        ),
        cursorColor:
            widget.compact ? AuthColors.primary : AppColors.buttonPrimary,
        autocorrect: widget.autocorrect,
        enableSuggestions: widget.enableSuggestions,
        decoration: InputDecoration(
          hintText: widget.hintText,
          hintStyle: _hintStyle,
          errorText: null,
          filled: true,
          fillColor: fill,
          contentPadding: EdgeInsets.symmetric(
            horizontal: widget.compact ? 10 : AppSpacing.inputHorizontal,
            vertical: 0,
          ),
          prefixIcon: _wrapPrefix(),
          prefixIconConstraints: widget.compact
              ? BoxConstraints(
                  minWidth: 36,
                  minHeight: _fieldHeight,
                )
              : null,
          suffixIcon: _buildSuffix(),
          suffixIconConstraints: widget.compact
              ? BoxConstraints(
                  minWidth: 36,
                  minHeight: _fieldHeight,
                )
              : null,
          isDense: true,
          border: restingBorder,
          enabledBorder: restingBorder,
          focusedBorder: focusedBorder,
          errorBorder: errorBorder,
          focusedErrorBorder: errorBorder,
          disabledBorder: restingBorder,
        ),
      ),
    );
  }

  Widget? _wrapPrefix() {
    final Widget? icon = widget.prefixIcon ??
        (widget.type == IleInputType.search
            ? Icon(Icons.search, size: _iconSize)
            : widget.type == IleInputType.date
                ? Icon(Icons.calendar_today_outlined, size: _iconSize)
                : null);
    if (icon == null) {
      return null;
    }
    return IconTheme(
      data: IconThemeData(
        size: _iconSize,
        color: widget.compact
            ? AuthColors.mediumGray
            : AppColors.foregroundMuted,
      ),
      child: icon,
    );
  }

  Widget _buildDropdown(bool hasError) {
    return SizedBox(
      height: _fieldHeight,
      child: InputDecorator(
        decoration: InputDecoration(
          hintText: widget.hintText,
          errorText: null,
          contentPadding: EdgeInsets.symmetric(
            horizontal: widget.compact ? 14 : AppSpacing.inputHorizontal,
            vertical: 0,
          ),
          enabled: widget.enabled,
          filled: true,
          fillColor: widget.fillColor ??
              (widget.compact ? AuthColors.inputFill : AppColors.surface),
          border: OutlineInputBorder(
            borderRadius: _radius,
            borderSide: widget.compact
                ? BorderSide.none
                : const BorderSide(color: AppColors.inputBorder),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: _radius,
            borderSide: widget.compact
                ? BorderSide.none
                : const BorderSide(color: AppColors.inputBorder),
          ),
        ),
        isEmpty: widget.dropdownValue == null,
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: widget.dropdownValue,
            isExpanded: true,
            hint: Text(widget.hintText ?? 'Select', style: _hintStyle),
            icon: Icon(
              Icons.keyboard_arrow_down_rounded,
              color: hasError
                  ? AppColors.criticalText
                  : AuthColors.mediumGray,
              size: _iconSize,
            ),
            style: _inputStyle,
            items: widget.dropdownItems,
            onChanged: widget.enabled ? widget.onDropdownChanged : null,
          ),
        ),
      ),
    );
  }

  Widget? _buildSuffix() {
    if (widget.type == IleInputType.password) {
      return IconButton(
        onPressed: widget.enabled ? _handleToggleObscure : null,
        tooltip: _obscureText ? 'Show password' : 'Hide password',
        padding: EdgeInsets.zero,
        constraints: BoxConstraints(
          minWidth: widget.compact ? 36 : AppSpacing.touchTarget,
          minHeight: widget.compact ? _fieldHeight : AppSpacing.touchTarget,
        ),
        icon: Icon(
          _obscureText
              ? Icons.visibility_outlined
              : Icons.visibility_off_outlined,
          size: _iconSize,
          color: widget.compact
              ? AuthColors.mediumGray
              : AppColors.foregroundSecondary,
        ),
      );
    }
    return widget.suffixIcon;
  }

  TextInputType? _defaultKeyboardType() {
    switch (widget.type) {
      case IleInputType.search:
        return TextInputType.text;
      case IleInputType.password:
        return TextInputType.visiblePassword;
      case IleInputType.date:
      case IleInputType.dropdown:
      case IleInputType.text:
        return TextInputType.text;
    }
  }
}
