import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/constants/app_strings.dart';
import '../../core/utils/validators.dart';
import '../../shared/widgets/widgets.dart';

/// Reset password — requires token from email deep link query `?token=`.
class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, this.token});

  final String? token;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _confirmController = TextEditingController();
  String? _passwordError;
  String? _confirmError;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _passwordController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  bool _validate() {
    final String? passwordError =
        Validators.validatePassword(_passwordController.text);
    final String? confirmError = Validators.validateConfirmPassword(
      password: _passwordController.text,
      confirm: _confirmController.text,
    );
    setState(() {
      _passwordError = passwordError;
      _confirmError = confirmError;
    });
    return passwordError == null && confirmError == null;
  }

  Future<void> _handleSave() async {
    if (_isSubmitting || !_validate()) return;
    final String? token = widget.token?.trim();
    if (token == null || token.isEmpty) {
      IleAlert.showSnackBar(
        context: context,
        message: 'Open the reset link from your email to continue.',
        tone: IleAlertTone.critical,
      );
      return;
    }
    setState(() => _isSubmitting = true);
    try {
      await context.read<IleApi>().resetPassword(
            token: token,
            password: _passwordController.text,
          );
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      await IleAlert.show(
        context: context,
        title: AppStrings.resetSuccessTitle,
        message: AppStrings.resetSuccessBody,
        confirmLabel: AppStrings.doneLabel,
        onConfirm: () {
          if (!mounted) return;
          context.go(AppRoutes.login);
        },
      );
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      IleAlert.showSnackBar(
        context: context,
        message: err.message,
        tone: IleAlertTone.critical,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      IleAlert.showSnackBar(
        context: context,
        message: 'Unable to reset password. Please try again.',
        tone: IleAlertTone.critical,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: IleAppBar(
        title: AppStrings.resetTitle,
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.foreground,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                AppStrings.resetSupporting,
                style: AppTypography.supporting.copyWith(height: 1.5),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                AppStrings.passwordRequirement,
                style: AppTypography.caption,
              ),
              if (widget.token == null || widget.token!.isEmpty) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Missing reset token. Use the link from your email.',
                  style: AppTypography.caption.copyWith(
                    color: AppColors.criticalText,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              IleInput(
                label: AppStrings.newPasswordLabel,
                hintText: AppStrings.passwordHint,
                controller: _passwordController,
                type: IleInputType.password,
                errorText: _passwordError,
                textInputAction: TextInputAction.next,
                fillColor: AppColors.surfaceMuted,
                prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                onChanged: (_) {
                  if (_passwordError != null) {
                    setState(() => _passwordError = null);
                  }
                },
              ),
              const SizedBox(height: AppSpacing.md),
              IleInput(
                label: AppStrings.confirmPasswordLabel,
                hintText: AppStrings.passwordHint,
                controller: _confirmController,
                type: IleInputType.password,
                errorText: _confirmError,
                textInputAction: TextInputAction.done,
                fillColor: AppColors.surfaceMuted,
                prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                onSubmitted: (_) => _handleSave(),
                onChanged: (_) {
                  if (_confirmError != null) {
                    setState(() => _confirmError = null);
                  }
                },
              ),
              const SizedBox(height: AppSpacing.xl),
              IleButton(
                label: AppStrings.saveNewPassword,
                isExpanded: true,
                isLoading: _isSubmitting,
                onPressed: _isSubmitting ? null : _handleSave,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
