import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import 'package:provider/provider.dart';

import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/constants/app_strings.dart';
import '../../core/utils/validators.dart';
import '../../shared/widgets/widgets.dart';
import 'widgets/auth_hero_scaffold.dart';

/// Guest registration screen matching the compact reference composition.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, this.returnTo});

  final String? returnTo;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TapGestureRecognizer _termsRecognizer = TapGestureRecognizer();
  final TapGestureRecognizer _privacyRecognizer = TapGestureRecognizer();
  String? _nameError;
  String? _emailError;
  String? _passwordError;
  String? _termsError;
  bool _isTermsAccepted = false;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _termsRecognizer.onTap = () {
      IleAlert.showSnackBar(
        context: context,
        message: 'Terms preview — UI only.',
        tone: IleAlertTone.info,
      );
    };
    _privacyRecognizer.onTap = () {
      IleAlert.showSnackBar(
        context: context,
        message: 'Privacy policy preview — UI only.',
        tone: IleAlertTone.info,
      );
    };
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _termsRecognizer.dispose();
    _privacyRecognizer.dispose();
    super.dispose();
  }

  bool _validate() {
    final String? nameError =
        Validators.validateFullName(_nameController.text);
    final String? emailError = Validators.validateEmail(_emailController.text);
    final String? passwordError =
        Validators.validatePassword(_passwordController.text);
    final String? termsError =
        Validators.validateTermsAccepted(_isTermsAccepted);
    setState(() {
      _nameError = nameError;
      _emailError = emailError;
      _passwordError = passwordError;
      _termsError = termsError;
    });
    return nameError == null &&
        emailError == null &&
        passwordError == null &&
        termsError == null;
  }

  (String firstName, String lastName) _splitName(String fullName) {
    final List<String> parts =
        fullName.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return ('Guest', 'User');
    if (parts.length == 1) return (parts.first, 'Guest');
    return (parts.first, parts.sublist(1).join(' '));
  }

  Future<void> _handleSignUp() async {
    if (_isSubmitting || !_validate()) {
      return;
    }
    setState(() => _isSubmitting = true);
    final (String firstName, String lastName) =
        _splitName(_nameController.text);
    try {
      await context.read<IleApi>().registerGuest(
            firstName: firstName,
            lastName: lastName,
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
      if (!mounted) return;
      setState(() => _isSubmitting = false);
      context.push(
        AppRoutes.otpPath(email: _emailController.text.trim()),
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
        message: 'Unable to create account. Please try again.',
        tone: IleAlertTone.critical,
      );
    }
  }

  void _handleSignIn() {
    final String? returnTo = widget.returnTo;
    if (returnTo != null && returnTo.isNotEmpty) {
      context.go(
        '${AppRoutes.login}?returnTo=${Uri.encodeComponent(returnTo)}',
      );
      return;
    }
    context.go(AppRoutes.login);
  }

  @override
  Widget build(BuildContext context) {
    return AuthHeroScaffold(
      supportingText: AppStrings.authSupportingRegister,
      cardTopFraction: AppSpacing.authCardTopFractionSignup,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Section 1: Full Name Input
          IleInput(
            label: AppStrings.fullNameLabel,
            hintText: AppStrings.fullNameHint,
            controller: _nameController,
            errorText: _nameError,
            textInputAction: TextInputAction.next,
            compact: true,
            prefixIcon: const Icon(Icons.person_outline_rounded),
            onChanged: (_) {
              if (_nameError != null) {
                setState(() => _nameError = null);
              }
            },
          ),
          const SizedBox(height: AppSpacing.authFieldGap),

          // Section 2: Email Input
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

          // Section 3: Password Input
          IleInput(
            label: AppStrings.passwordLabel,
            hintText: AppStrings.passwordHint,
            controller: _passwordController,
            type: IleInputType.password,
            errorText: _passwordError,
            textInputAction: TextInputAction.done,
            compact: true,
            prefixIcon: const Icon(Icons.lock_outline_rounded),
            onSubmitted: (_) => _handleSignUp(),
            onChanged: (_) {
              if (_passwordError != null) {
                setState(() => _passwordError = null);
              }
            },
          ),
          const SizedBox(height: AppSpacing.authFieldGap),

          // Section 4: Terms & Conditions Checkbox (Compact, aligned with text)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.only(top: 1.5),
                child: SizedBox(
                  width: 14,
                  height: 14,
                  child: Checkbox(
                    value: _isTermsAccepted,
                    materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    visualDensity: VisualDensity.compact,
                    fillColor: WidgetStateProperty.resolveWith(
                      (Set<WidgetState> states) {
                        if (states.contains(WidgetState.selected)) {
                          return AuthColors.primary;
                        }
                        return Colors.transparent;
                      },
                    ),
                    checkColor: AppColors.onDark,
                    side: const BorderSide(
                      color: Color(0xFFCBD5E1),
                      width: 1.0,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(3),
                    ),
                    onChanged: (bool? value) {
                      setState(() {
                        _isTermsAccepted = value ?? false;
                        _termsError = null;
                      });
                    },
                  ),
                ),
              ),
              const SizedBox(width: 7),
              Expanded(
                child: Text.rich(
                  TextSpan(
                    style: AppTypography.Auth.terms,
                    children: [
                      const TextSpan(
                        text: AppStrings.termsAgreementPrefix,
                      ),
                      TextSpan(
                        text: AppStrings.termsLink,
                        style: AppTypography.Auth.termsLink,
                        recognizer: _termsRecognizer,
                      ),
                      const TextSpan(text: AppStrings.termsAgreementMiddle),
                      TextSpan(
                        text: AppStrings.privacyLink,
                        style: AppTypography.Auth.termsLink,
                        recognizer: _privacyRecognizer,
                      ),
                      const TextSpan(
                        text: AppStrings.termsAgreementSuffix,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (_termsError != null) ...[
            const SizedBox(height: AppSpacing.xxs),
            Text(
              _termsError!,
              style: AppTypography.Auth.formLabel.copyWith(
                color: AppColors.criticalText,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.authSectionGap),

          // Section 5: Main Submit Button
          IleButton(
            label: AppStrings.signUp,
            isExpanded: true,
            compact: true,
            borderRadius: AppRadius.authButtonAll,
            isLoading: _isSubmitting,
            onPressed: _isSubmitting ? null : _handleSignUp,
          ),
          const SizedBox(height: AppSpacing.authSectionGap),

          // Section 6: OR Divider
          const IleOrDivider(),
          const SizedBox(height: AppSpacing.authSectionGap),

          // Section 7: Social Logins (Google & Apple)
          const IleSocialButtons(),
          const SizedBox(height: AppSpacing.authSectionGap),

          // Section 8: Bottom Navigation Link
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                AppStrings.alreadyHaveAccount,
                style: AppTypography.Auth.bottomNav,
              ),
              const SizedBox(width: 4),
              TextButton(
                onPressed: _handleSignIn,
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
                  AppStrings.signIn,
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
