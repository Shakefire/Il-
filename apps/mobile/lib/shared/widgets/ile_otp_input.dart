import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';

/// Five circular OTP digit fields with auto-advance, backspace, and paste.
class IleOtpInput extends StatefulWidget {
  const IleOtpInput({
    super.key,
    this.length = 5,
    this.onCompleted,
    this.onChanged,
    this.enabled = true,
    this.hasError = false,
  });

  final int length;
  final ValueChanged<String>? onCompleted;
  final ValueChanged<String>? onChanged;
  final bool enabled;
  final bool hasError;

  @override
  State<IleOtpInput> createState() => IleOtpInputState();
}

class IleOtpInputState extends State<IleOtpInput> {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _focusNodes;

  @override
  void initState() {
    super.initState();
    _controllers = List<TextEditingController>.generate(
      widget.length,
      (_) => TextEditingController(),
    );
    _focusNodes = List<FocusNode>.generate(
      widget.length,
      (_) => FocusNode(),
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted && widget.enabled) {
        _focusNodes.first.requestFocus();
      }
    });
  }

  @override
  void dispose() {
    for (final TextEditingController controller in _controllers) {
      controller.dispose();
    }
    for (final FocusNode node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  String get code =>
      _controllers.map((TextEditingController c) => c.text).join();

  void clear() {
    for (final TextEditingController controller in _controllers) {
      controller.clear();
    }
    setState(() {});
    _focusNodes.first.requestFocus();
    widget.onChanged?.call('');
  }

  void _emitChanged() {
    final String value = code;
    widget.onChanged?.call(value);
    if (value.length == widget.length) {
      widget.onCompleted?.call(value);
    }
  }

  void _handleChanged(int index, String value) {
    if (value.length > 1) {
      _handlePaste(value);
      return;
    }
    if (value.isEmpty) {
      _emitChanged();
      return;
    }
    final String digit = value.substring(value.length - 1);
    _controllers[index].text = digit;
    _controllers[index].selection = const TextSelection.collapsed(offset: 1);
    if (index < widget.length - 1) {
      _focusNodes[index + 1].requestFocus();
    } else {
      _focusNodes[index].unfocus();
    }
    _emitChanged();
  }

  void _handlePaste(String raw) {
    final String digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.isEmpty) {
      return;
    }
    for (int i = 0; i < widget.length; i++) {
      _controllers[i].text = i < digits.length ? digits[i] : '';
    }
    final int focusIndex = digits.length.clamp(0, widget.length) - 1;
    if (focusIndex >= 0 && focusIndex < widget.length - 1) {
      _focusNodes[focusIndex + 1].requestFocus();
    } else {
      _focusNodes.last.unfocus();
    }
    setState(() {});
    _emitChanged();
  }

  KeyEventResult _handleKey(int index, KeyEvent event) {
    if (event is! KeyDownEvent) {
      return KeyEventResult.ignored;
    }
    if (event.logicalKey != LogicalKeyboardKey.backspace) {
      return KeyEventResult.ignored;
    }
    if (_controllers[index].text.isNotEmpty) {
      _controllers[index].clear();
      _emitChanged();
      return KeyEventResult.handled;
    }
    if (index > 0) {
      _controllers[index - 1].clear();
      _focusNodes[index - 1].requestFocus();
      _emitChanged();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'One-time password',
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List<Widget>.generate(widget.length, (int index) {
          return Padding(
            padding: EdgeInsets.only(
              right: index == widget.length - 1 ? 0 : AppSpacing.authOtpGap,
            ),
            child: _OtpCircleField(
              controller: _controllers[index],
              focusNode: _focusNodes[index],
              enabled: widget.enabled,
              hasError: widget.hasError,
              onChanged: (String value) => _handleChanged(index, value),
              onKeyEvent: (KeyEvent event) => _handleKey(index, event),
            ),
          );
        }),
      ),
    );
  }
}

class _OtpCircleField extends StatelessWidget {
  const _OtpCircleField({
    required this.controller,
    required this.focusNode,
    required this.enabled,
    required this.hasError,
    required this.onChanged,
    required this.onKeyEvent,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool enabled;
  final bool hasError;
  final ValueChanged<String> onChanged;
  final KeyEventResult Function(KeyEvent event) onKeyEvent;

  @override
  Widget build(BuildContext context) {
    return Focus(
      onKeyEvent: (FocusNode node, KeyEvent event) => onKeyEvent(event),
      child: AnimatedBuilder(
        animation: Listenable.merge(<Listenable>[focusNode, controller]),
        builder: (BuildContext context, Widget? child) {
          final bool focused = focusNode.hasFocus;
          final bool hasDigit = controller.text.isNotEmpty;
          return AnimatedContainer(
            duration: const Duration(milliseconds: 160),
            width: AppSpacing.authOtpDiameter,
            height: AppSpacing.authOtpDiameter,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: focused && !hasDigit
                  ? AppColors.surface
                  : AppColors.surfaceMuted,
              shape: BoxShape.circle,
              border: Border.all(
                color: hasError
                    ? AppColors.inputErrorBorder
                    : focused
                        ? AuthColors.primary
                        : Colors.transparent,
                width: 1,
              ),
            ),
            child: child,
          );
        },
        child: TextField(
          controller: controller,
          focusNode: focusNode,
          enabled: enabled,
          textAlign: TextAlign.center,
          keyboardType: TextInputType.number,
          textInputAction: TextInputAction.next,
          // Allow paste of full OTP into the focused cell (length comes from parent).
          maxLength: 12,
          style: AppTypography.Auth.otpDigit,
          cursorColor: AuthColors.primary,
          inputFormatters: [
            FilteringTextInputFormatter.digitsOnly,
          ],
          decoration: const InputDecoration(
            counterText: '',
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            disabledBorder: InputBorder.none,
            filled: false,
            contentPadding: EdgeInsets.zero,
            isDense: true,
          ),
          onChanged: onChanged,
        ),
      ),
    );
  }
}
