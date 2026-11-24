import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/constants/app_routes.dart';
import '../../core/constants/app_strings.dart';
import '../../core/state/session_store.dart';
import '../../core/utils/validators.dart';
import '../../shared/widgets/widgets.dart';
import 'widgets/auth_hero_scaffold.dart';

/// Registration screen matching the web platform with Guest and Host / Partner roles.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key, this.returnTo});

  final String? returnTo;

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  bool _isHostMode = false;
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _companyController = TextEditingController();

  String _hostType = 'individual_owner';
  String _operatingCity = 'Abuja';

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
      context.push(AppRoutes.terms);
    };
    _privacyRecognizer.onTap = () {
      context.push(AppRoutes.privacy);
    };
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _companyController.dispose();
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
    if (parts.isEmpty) return ('Partner', 'Owner');
    if (parts.length == 1) return (parts.first, 'Owner');
    return (parts.first, parts.sublist(1).join(' '));
  }

  Future<void> _handleSignUp() async {
    if (_isSubmitting || !_validate()) {
      return;
    }
    setState(() => _isSubmitting = true);
    final (String firstName, String lastName) =
        _splitName(_nameController.text);
    final String email = _emailController.text.trim().toLowerCase();

    try {
      final SessionStore session = context.read<SessionStore>();
      if (_isHostMode) {
        await session.registerOwner(
          firstName: firstName,
          lastName: lastName,
          email: email,
          password: _passwordController.text,
          phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
          hostType: _hostType,
          companyName: _companyController.text.trim().isEmpty ? null : _companyController.text.trim(),
          operatingCity: _operatingCity,
        );
      } else {
        await session.registerGuest(
          firstName: firstName,
          lastName: lastName,
          email: email,
          password: _passwordController.text,
          phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
        );
      }

      if (!mounted) return;
      setState(() => _isSubmitting = false);

      // Navigate to OTP with replacement so back-button cannot bypass verification
      context.go(
        AppRoutes.otpPath(
          email: email,
          maskedPhone: _phoneController.text.trim().isNotEmpty
              ? _phoneController.text.trim()
              : null,
          role: _isHostMode ? 'host' : 'guest',
        ),
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
      supportingText: _isHostMode
          ? 'Partner with Ilé to host verified stays across Nigeria.'
          : AppStrings.authSupportingRegister,
      cardTopFraction: AppSpacing.authCardTopFractionSignup,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Role Selection Tabs: Guest vs Host Partner
          Container(
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _isHostMode = false),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: !_isHostMode ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: !_isHostMode
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.05),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ]
                            : null,
                      ),
                      child: Text(
                        'Guest',
                        style: AppTypography.supporting.copyWith(
                          fontWeight: !_isHostMode ? FontWeight.w700 : FontWeight.w500,
                          color: !_isHostMode ? AppColors.charcoal : const Color(0xFF8B8B86),
                          fontSize: 13,
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: InkWell(
                    onTap: () => setState(() => _isHostMode = true),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _isHostMode ? Colors.white : Colors.transparent,
                        borderRadius: BorderRadius.circular(8),
                        boxShadow: _isHostMode
                            ? [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.05),
                                  blurRadius: 4,
                                  offset: const Offset(0, 1),
                                ),
                              ]
                            : null,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            Icons.villa_outlined,
                            size: 15,
                            color: _isHostMode ? const Color(0xFF073B2E) : const Color(0xFF8B8B86),
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Host / Partner',
                            style: AppTypography.supporting.copyWith(
                              fontWeight: _isHostMode ? FontWeight.w700 : FontWeight.w500,
                              color: _isHostMode ? const Color(0xFF073B2E) : const Color(0xFF8B8B86),
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.authFieldGap),

          // Section 1: Full Legal Name Input
          IleInput(
            label: _isHostMode ? 'Legal Representative Name' : AppStrings.fullNameLabel,
            hintText: _isHostMode ? 'e.g. Chukwuma Adebayo' : AppStrings.fullNameHint,
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

          // Section 2B (Host Mode): Operating City & Host Type
          if (_isHostMode) ...[
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Operating City',
                        style: AppTypography.caption.copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppColors.charcoal,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _operatingCity,
                            isExpanded: true,
                            items: [
                              const DropdownMenuItem(value: 'Abuja', child: Text('Abuja (FCT)')),
                              const DropdownMenuItem(value: 'Lagos', child: Text('Lagos State')),
                            ],
                            onChanged: (val) {
                              if (val != null) setState(() => _operatingCity = val);
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Host Type',
                        style: AppTypography.caption.copyWith(
                          fontWeight: FontWeight.w600,
                          color: AppColors.charcoal,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          border: Border.all(color: const Color(0xFFCBD5E1)),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _hostType,
                            isExpanded: true,
                            items: [
                              const DropdownMenuItem(
                                value: 'individual_owner',
                                child: Text('Owner', overflow: TextOverflow.ellipsis),
                              ),
                              const DropdownMenuItem(
                                value: 'property_manager',
                                child: Text('Manager', overflow: TextOverflow.ellipsis),
                              ),
                              const DropdownMenuItem(
                                value: 'company',
                                child: Text('Company', overflow: TextOverflow.ellipsis),
                              ),
                            ],
                            onChanged: (val) {
                              if (val != null) setState(() => _hostType = val);
                            },
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.authFieldGap),
          ],

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

          // Section 4: Terms & Conditions Checkbox
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

          // Primary CTA Button
          IleButton(
            label: _isHostMode ? 'Register as Property Partner' : AppStrings.signUp,
            isExpanded: true,
            compact: true,
            borderRadius: AppRadius.authButtonAll,
            isLoading: _isSubmitting,
            onPressed: _isSubmitting ? null : _handleSignUp,
          ),
          const SizedBox(height: AppSpacing.authSectionGap),

          // Bottom Sign In Prompt Link
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
