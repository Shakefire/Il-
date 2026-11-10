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

/// Forgot password — calls `/api/auth/forgot-password` (no email existence leak).
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final TextEditingController _emailController = TextEditingController();
  String? _emailError;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _handleSend() async {
    final String? emailError = Validators.validateEmail(_emailController.text);
    setState(() => _emailError = emailError);
    if (emailError != null || _isSubmitting) return;
    setState(() => _isSubmitting = true);
    try {
      await context.read<IleApi>().forgotPassword(
            email: _emailController.text.trim(),
          );
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      await IleAlert.show(
        context: context,
        title: AppStrings.forgotSuccessTitle,
        message: AppStrings.forgotSuccessBody,
        confirmLabel: AppStrings.continueLabel,
        tone: IleAlertTone.info,
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
        message: 'Unable to send reset link. Please try again.',
        tone: IleAlertTone.critical,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: IleAppBar(
        title: AppStrings.forgotTitle,
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.foreground,
        automaticallyImplyLeading: true,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.xl),
          keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                AppStrings.forgotSupporting,
                style: AppTypography.supporting.copyWith(height: 1.5),
              ),
              const SizedBox(height: AppSpacing.xl),
              IleInput(
                label: AppStrings.emailLabel,
                hintText: AppStrings.emailHint,
                controller: _emailController,
                errorText: _emailError,
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.done,
                fillColor: AppColors.surfaceMuted,
                autocorrect: false,
                enableSuggestions: false,
                prefixIcon: const Icon(Icons.mail_outline_rounded, size: 20),
                onSubmitted: (_) => _handleSend(),
                onChanged: (_) {
                  if (_emailError != null) {
                    setState(() => _emailError = null);
                  }
                },
              ),
              const SizedBox(height: AppSpacing.xl),
              IleButton(
                label: AppStrings.sendResetLink,
                isExpanded: true,
                isLoading: _isSubmitting,
                onPressed: _isSubmitting ? null : _handleSend,
              ),
              const SizedBox(height: AppSpacing.md),
              IleButton(
                label: AppStrings.backToLogin,
                variant: IleButtonVariant.text,
                onPressed: () => context.go(AppRoutes.login),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
