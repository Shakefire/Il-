import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import 'ile_button.dart';

/// Dialog / bottom-sheet presentation helpers — foundation only.
abstract final class IleModal {
  static Future<T?> showDialogSheet<T>({
    required BuildContext context,
    required String title,
    required Widget child,
    String? confirmLabel,
    String? cancelLabel,
    VoidCallback? onConfirm,
    bool barrierDismissible = true,
  }) {
    return showDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      barrierColor: AppColors.charcoal.withValues(alpha: 0.45),
      builder: (BuildContext dialogContext) {
        return AlertDialog(
          backgroundColor: AppColors.surface,
          surfaceTintColor: Colors.transparent,
          shape: const RoundedRectangleBorder(
            borderRadius: AppRadius.panelAll,
          ),
          title: Text(title, style: AppTypography.sectionHeading),
          content: child,
          actionsPadding: const EdgeInsets.fromLTRB(
            AppSpacing.xl,
            0,
            AppSpacing.xl,
            AppSpacing.xl,
          ),
          actions: [
            if (cancelLabel != null)
              IleButton(
                label: cancelLabel,
                variant: IleButtonVariant.text,
                onPressed: () => Navigator.of(dialogContext).pop(),
              ),
            if (confirmLabel != null)
              IleButton(
                label: confirmLabel,
                onPressed: () {
                  onConfirm?.call();
                  Navigator.of(dialogContext).pop();
                },
              ),
          ],
        );
      },
    );
  }

  static Future<T?> showBottomSheet<T>({
    required BuildContext context,
    required Widget child,
    String? title,
    bool isDismissible = true,
    bool enableDrag = true,
  }) {
    return showModalBottomSheet<T>(
      context: context,
      isDismissible: isDismissible,
      enableDrag: enableDrag,
      backgroundColor: AppColors.surface,
      barrierColor: AppColors.charcoal.withValues(alpha: 0.45),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppRadius.panel),
        ),
      ),
      builder: (BuildContext sheetContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl,
              AppSpacing.sm,
              AppSpacing.xl,
              AppSpacing.xl,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 36,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: AppSpacing.md),
                    decoration: BoxDecoration(
                      color: AppColors.border,
                      borderRadius: AppRadius.pillAll,
                    ),
                  ),
                ),
                if (title != null) ...[
                  Text(title, style: AppTypography.sectionHeading),
                  const SizedBox(height: AppSpacing.md),
                ],
                child,
              ],
            ),
          ),
        );
      },
    );
  }
}
