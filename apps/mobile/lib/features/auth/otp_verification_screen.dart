import 'dart:async';

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
import '../../shared/widgets/widgets.dart';

/// Six-digit email OTP verification against `/api/auth/verify-email`.
class OtpVerificationScreen extends StatefulWidget {
  const OtpVerificationScreen({
    super.key,
    required this.email,
    this.maskedPhone = AppRoutesDefaults.maskedPhone,
  });

  final String email;
  final String maskedPhone;

  @override
  State<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen> {
  final GlobalKey<IleOtpInputState> _otpKey = GlobalKey<IleOtpInputState>();
  Timer? _countdownTimer;
  int _secondsRemaining = AppStrings.otpResendSeconds;
  bool _isVerifying = false;
  bool _hasError = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _startCountdown();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startCountdown() {
    _countdownTimer?.cancel();
    setState(() => _secondsRemaining = AppStrings.otpResendSeconds);
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (Timer timer) {
      if (_secondsRemaining <= 1) {
        timer.cancel();
        setState(() => _secondsRemaining = 0);
        return;
      }
      setState(() => _secondsRemaining -= 1);
    });
  }

  Future<void> _handleCompleted(String code) async {
    if (_isVerifying) return;
    setState(() {
      _isVerifying = true;
      _hasError = false;
      _errorMessage = null;
    });
    try {
      await context.read<IleApi>().verifyEmail(
            email: widget.email,
            code: code,
          );
      if (!mounted) return;
      setState(() => _isVerifying = false);
      await IleAlert.show(
        context: context,
        title: AppStrings.registerSuccessTitle,
        message: AppStrings.registerSuccessBody,
        confirmLabel: AppStrings.continueLabel,
        onConfirm: () {
          if (!mounted) return;
          context.go(AppRoutes.home);
        },
      );
    } on ApiException catch (err) {
      if (!mounted) return;
      _otpKey.currentState?.clear();
      setState(() {
        _isVerifying = false;
        _hasError = true;
        _errorMessage = err.message.isNotEmpty ? err.message : AppStrings.otpInvalid;
      });
    } catch (_) {
      if (!mounted) return;
      _otpKey.currentState?.clear();
      setState(() {
        _isVerifying = false;
        _hasError = true;
        _errorMessage = AppStrings.otpInvalid;
      });
    }
  }

  Future<void> _handleResend() async {
    if (_secondsRemaining > 0 || _isVerifying) return;
    setState(() {
      _hasError = false;
      _errorMessage = null;
    });
    try {
      await context.read<IleApi>().resendEmailOtp(email: widget.email);
      if (!mounted) return;
      _otpKey.currentState?.clear();
      _startCountdown();
      IleAlert.showSnackBar(
        context: context,
        message: 'A new code was sent to your email.',
        tone: IleAlertTone.info,
      );
    } on ApiException catch (err) {
      if (!mounted) return;
      IleAlert.showSnackBar(
        context: context,
        message: err.message,
        tone: IleAlertTone.critical,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool canResend = _secondsRemaining == 0 && !_isVerifying;
    final String destination = widget.email.isNotEmpty
        ? widget.email
        : widget.maskedPhone;
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: Alignment.centerLeft,
                child: IleCircularBackButton(
                  onPressed: () => context.pop(),
                ),
              ),
              const SizedBox(height: AppSpacing.xxl),
              Text(
                AppStrings.otpTitle,
                textAlign: TextAlign.center,
                style: AppTypography.Auth.otpTitle,
              ),
              const SizedBox(height: AppSpacing.sm),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                child: Text(
                  '${AppStrings.otpBodyPrefix}$destination'
                  '${AppStrings.otpBodySuffix}',
                  textAlign: TextAlign.center,
                  style: AppTypography.Auth.otpDescription,
                ),
              ),
              const SizedBox(height: AppSpacing.xxl),
              IleOtpInput(
                key: _otpKey,
                length: AppStrings.otpLength,
                enabled: !_isVerifying,
                hasError: _hasError,
                onCompleted: _handleCompleted,
                onChanged: (String value) {
                  if (_hasError && value.isNotEmpty) {
                    setState(() {
                      _hasError = false;
                      _errorMessage = null;
                    });
                  }
                },
              ),
              if (_isVerifying) ...[
                const SizedBox(height: AppSpacing.lg),
                const IleLoadingIndicator(message: AppStrings.otpVerifying),
              ],
              if (_errorMessage != null) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  _errorMessage!,
                  textAlign: TextAlign.center,
                  style: AppTypography.Auth.otpDescription.copyWith(
                    color: AppColors.criticalText,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              if (_secondsRemaining > 0)
                Text(
                  '${AppStrings.otpResendCountdownPrefix}'
                  '$_secondsRemaining'
                  '${AppStrings.otpResendCountdownSuffix}',
                  textAlign: TextAlign.center,
                  style: AppTypography.Auth.otpCountdown,
                )
              else
                Text(
                  'You can resend the code now',
                  textAlign: TextAlign.center,
                  style: AppTypography.Auth.otpCountdown,
                ),
              const SizedBox(height: AppSpacing.xs),
              Center(
                child: TextButton(
                  onPressed: canResend ? _handleResend : null,
                  style: TextButton.styleFrom(
                    foregroundColor: AuthColors.primary,
                    disabledForegroundColor: AppColors.foregroundMuted,
                    minimumSize: const Size(0, 32),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.xs,
                      vertical: AppSpacing.xxs,
                    ),
                  ),
                  child: Text(
                    AppStrings.otpResend,
                    style: AppTypography.Auth.otpResend.copyWith(
                      color: canResend
                          ? AuthColors.primary
                          : AppColors.foregroundMuted,
                      decorationColor: canResend
                          ? AuthColors.primary
                          : AppColors.foregroundMuted,
                    ),
                  ),
                ),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
