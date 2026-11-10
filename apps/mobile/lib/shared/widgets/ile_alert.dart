import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import 'ile_button.dart';

enum IleAlertTone { success, info, warning, critical }

/// Reusable success / info dialog used across mock auth flows.
abstract final class IleAlert {
  static Future<void> show({
    required BuildContext context,
    required String title,
    required String message,
    String confirmLabel = 'Continue',
    VoidCallback? onConfirm,
    IleAlertTone tone = IleAlertTone.success,
    bool barrierDismissible = false,
  }) {
    return showDialog<void>(
      context: context,
      barrierDismissible: barrierDismissible,
      barrierColor: AppColors.charcoal.withValues(alpha: 0.45),
      builder: (BuildContext dialogContext) {
        return IleAlertDialog(
          title: title,
          message: message,
          confirmLabel: confirmLabel,
          tone: tone,
          onConfirm: () {
            Navigator.of(dialogContext).pop();
            onConfirm?.call();
          },
        );
      },
    );
  }

  static void showSnackBar({
    required BuildContext context,
    required String message,
    IleAlertTone tone = IleAlertTone.success,
  }) {
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    messenger.hideCurrentSnackBar();
    messenger.showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: tone == IleAlertTone.critical
            ? AppColors.criticalText
            : AppColors.charcoal,
      ),
    );
  }
}

/// Polished centered alert dialog with semantic tone icon.
class IleAlertDialog extends StatelessWidget {
  const IleAlertDialog({
    super.key,
    required this.title,
    required this.message,
    required this.confirmLabel,
    this.onConfirm,
    this.tone = IleAlertTone.success,
  });

  final String title;
  final String message;
  final String confirmLabel;
  final VoidCallback? onConfirm;
  final IleAlertTone tone;

  @override
  Widget build(BuildContext context) {
    final _ToneStyle style = _resolveTone(tone);
    return Dialog(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: const RoundedRectangleBorder(
        borderRadius: AppRadius.panelAll,
      ),
      insetPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.xl,
          AppSpacing.xxl,
          AppSpacing.xl,
          AppSpacing.xl,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: style.background,
                shape: BoxShape.circle,
                border: Border.all(color: style.border),
              ),
              child: Icon(style.icon, color: style.foreground, size: 28),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              title,
              textAlign: TextAlign.center,
              style: AppTypography.sectionHeading,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              message,
              textAlign: TextAlign.center,
              style: AppTypography.supporting,
            ),
            const SizedBox(height: AppSpacing.xl),
            IleButton(
              label: confirmLabel,
              isExpanded: true,
              onPressed: onConfirm,
            ),
          ],
        ),
      ),
    );
  }

  _ToneStyle _resolveTone(IleAlertTone tone) {
    switch (tone) {
      case IleAlertTone.success:
        return const _ToneStyle(
          background: AppColors.successBg,
          border: AppColors.successBorder,
          foreground: AppColors.successText,
          icon: Icons.check_rounded,
        );
      case IleAlertTone.info:
        return const _ToneStyle(
          background: AppColors.infoBg,
          border: AppColors.infoBorder,
          foreground: AppColors.infoText,
          icon: Icons.info_outline_rounded,
        );
      case IleAlertTone.warning:
        return const _ToneStyle(
          background: AppColors.warningBg,
          border: AppColors.warningBorder,
          foreground: AppColors.warningText,
          icon: Icons.warning_amber_rounded,
        );
      case IleAlertTone.critical:
        return const _ToneStyle(
          background: AppColors.criticalBg,
          border: AppColors.criticalBorder,
          foreground: AppColors.criticalText,
          icon: Icons.error_outline_rounded,
        );
    }
  }
}

class _ToneStyle {
  const _ToneStyle({
    required this.background,
    required this.border,
    required this.foreground,
    required this.icon,
  });

  final Color background;
  final Color border;
  final Color foreground;
  final IconData icon;
}
