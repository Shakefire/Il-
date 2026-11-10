import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/constants/app_strings.dart';
import '../../core/utils/validators.dart';
import '../../shared/widgets/widgets.dart';
import 'widgets/auth_hero_scaffold.dart';

/// Guest login — real `/api/auth/login` against the Ilé backend.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, this.returnTo});

  final String? returnTo;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  String? _emailError;
  String? _passwordError;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  bool _validate() {
    final String? emailError = Validators.validateEmail(_emailController.text);
    final String? passwordError =
        Validators.validatePassword(_passwordController.text);
    setState(() {
      _emailError = emailError;
      _passwordError = passwordError;
    });
    return emailError == null && passwordError == null;
  }

  Future<void> _handleSignIn() async {
    if (_isSubmitting || !_validate()) {
      return;
    }
    setState(() => _isSubmitting = true);
    try {
      await context.read<IleApi>().login(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      await IleAlert.show(
        context: context,
        title: AppStrings.loginSuccessTitle,
        message: AppStrings.loginSuccessBody,
        confirmLabel: AppStrings.continueLabel,
        onConfirm: () {
          if (!mounted) return;
          final String target = widget.returnTo?.isNotEmpty == true
              ? widget.returnTo!
              : AppRoutes.home;
          context.go(target);
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
        message: 'Unable to sign in. Check your connection and try again.',
        tone: IleAlertTone.critical,
      );
    }
  }

  void _handleForgotPassword() {
    context.push(AppRoutes.forgotPassword);
  }

  void _handleSignUp() {
    final String? returnTo = widget.returnTo;
    if (returnTo != null && returnTo.isNotEmpty) {
      context.push(
        '${AppRoutes.register}?returnTo=${Uri.encodeComponent(returnTo)}',
      );
      return;
    }
    context.push(AppRoutes.register);
  }

  @override
  Widget build(BuildContext context) {
    return AuthHeroScaffold(
      supportingText: AppStrings.authSupporting,
      cardTopFraction: AppSpacing.authCardTopFractionLogin,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          IleInput(
            label: AppStrings.emailLabel,
            hintText: AppStrings.emailHint,
            controller: _emailController,
            errorText: _emailError,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            compact: true,
            autocorrect: false,
            enableSuggestions: false,
            prefixIcon: const Icon(Icons.mail_outline_rounded),
            onChanged: (_) {
              if (_emailError != null) {
                setState(() => _emailError = null);
              }
            },
          ),
          const SizedBox(height: AppSpacing.authFieldGap),
          IleInput(
            label: AppStrings.passwordLabel,
            hintText: AppStrings.passwordHint,
            controller: _passwordController,
            type: IleInputType.password,
            errorText: _passwordError,
            textInputAction: TextInputAction.done,
            compact: true,
            prefixIcon: const Icon(Icons.lock_outline_rounded),
            onSubmitted: (_) => _handleSignIn(),
            onChanged: (_) {
              if (_passwordError != null) {
                setState(() => _passwordError = null);
              }
            },
          ),
          Align(
            alignment: Alignment.centerRight,
            child: Padding(
              padding: const EdgeInsets.only(top: 1, bottom: 2),
              child: TextButton(
                onPressed: _handleForgotPassword,
                style: TextButton.styleFrom(
                  foregroundColor: AuthColors.primary,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 2,
                    vertical: 1,
                  ),
                ),
                child: Text(
                  AppStrings.forgotPassword,
                  style: AppTypography.Auth.forgotPassword,
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.authSectionGap),
          IleButton(
            label: AppStrings.signIn,
            isExpanded: true,
            compact: true,
            borderRadius: AppRadius.authButtonAll,
            isLoading: _isSubmitting,
            onPressed: _isSubmitting ? null : _handleSignIn,
          ),
          const SizedBox(height: AppSpacing.authSectionGap),
          const IleOrDivider(),
          const SizedBox(height: AppSpacing.authSectionGap),
          const IleSocialButtons(),
          const SizedBox(height: AppSpacing.authSectionGap),
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                AppStrings.dontHaveAccount,
                style: AppTypography.Auth.bottomNav,
              ),
              const SizedBox(width: 4),
              TextButton(
                onPressed: _handleSignUp,
                style: TextButton.styleFrom(
                  foregroundColor: AuthColors.primary,
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 2,
                    vertical: 2,
                  ),
                ),
                child: Text(
                  AppStrings.signUp,
                  style: AppTypography.Auth.bottomNavLink,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
