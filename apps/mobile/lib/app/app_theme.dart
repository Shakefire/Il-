import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app_colors.dart';
import 'app_radius.dart';
import 'app_spacing.dart';
import 'app_typography.dart';

/// Full Material [ThemeData] wired to Ilé tokens. Prefer theme over hardcoding.
abstract final class AppTheme {
  static ThemeData get light {
    final ColorScheme scheme = AppColors.colorScheme;
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.background,
      canvasColor: AppColors.background,
      cardColor: AppColors.surface,
      dividerColor: AppColors.borderSubtle,
      fontFamily: AppTypography.sansFamily,
      textTheme: AppTypography.textTheme,
      primaryTextTheme: AppTypography.textTheme.apply(
        bodyColor: AppColors.onDark,
        displayColor: AppColors.onDark,
      ),
      appBarTheme: const AppBarTheme(
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        backgroundColor: AppColors.charcoal,
        foregroundColor: AppColors.onDark,
        surfaceTintColor: Colors.transparent,
        systemOverlayStyle: SystemUiOverlayStyle.light,
        titleTextStyle: TextStyle(
          fontFamily: AppTypography.displayFamily,
          fontWeight: FontWeight.w400,
          fontSize: 22,
          color: AppColors.onDark,
          letterSpacing: -0.4,
        ),
        iconTheme: IconThemeData(color: AppColors.onDark, size: 22),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          minimumSize: const WidgetStatePropertyAll(
            Size(0, AppSpacing.touchTarget),
          ),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: AppSpacing.buttonHorizontal),
          ),
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadius.buttonAll),
          ),
          elevation: const WidgetStatePropertyAll(0),
          shadowColor: const WidgetStatePropertyAll(Colors.transparent),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return AppColors.buttonPrimary.withValues(alpha: 0.5);
            }
            if (states.contains(WidgetState.pressed) ||
                states.contains(WidgetState.hovered)) {
              return AppColors.buttonPrimaryHover;
            }
            return AppColors.buttonPrimary;
          }),
          foregroundColor: const WidgetStatePropertyAll(AppColors.onDark),
          textStyle: const WidgetStatePropertyAll(AppTypography.button),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          minimumSize: const WidgetStatePropertyAll(
            Size(0, AppSpacing.touchTarget),
          ),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(
              horizontal: AppSpacing.buttonHorizontalSecondary,
            ),
          ),
          shape: const WidgetStatePropertyAll(
            RoundedRectangleBorder(borderRadius: AppRadius.buttonAll),
          ),
          side: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.pressed)) {
              return const BorderSide(color: AppColors.inputBorderHover);
            }
            return const BorderSide(color: AppColors.borderLight);
          }),
          backgroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.pressed)) {
              return AppColors.background;
            }
            return AppColors.surface;
          }),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.hovered) ||
                states.contains(WidgetState.pressed)) {
              return AppColors.textMain;
            }
            return AppColors.textMuted;
          }),
          textStyle: const WidgetStatePropertyAll(AppTypography.buttonSecondary),
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: ButtonStyle(
          minimumSize: const WidgetStatePropertyAll(
            Size(0, AppSpacing.touchTarget),
          ),
          foregroundColor: WidgetStateProperty.resolveWith((states) {
            if (states.contains(WidgetState.disabled)) {
              return AppColors.foregroundMuted;
            }
            if (states.contains(WidgetState.pressed)) {
              return AppColors.emeraldHover;
            }
            return AppColors.emerald;
          }),
          textStyle: const WidgetStatePropertyAll(
            TextStyle(
              fontFamily: AppTypography.sansFamily,
              fontWeight: FontWeight.w600,
              fontSize: 14,
            ),
          ),
          overlayColor: WidgetStatePropertyAll(
            AppColors.emerald.withValues(alpha: 0.06),
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        contentPadding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.inputHorizontal,
          vertical: 12,
        ),
        hintStyle: AppTypography.supporting.copyWith(
          color: AppColors.placeholder,
        ),
        labelStyle: AppTypography.supporting.copyWith(
          color: AppColors.foregroundSecondary,
        ),
        helperStyle: AppTypography.caption,
        errorStyle: AppTypography.caption.copyWith(
          color: AppColors.criticalText,
        ),
        border: OutlineInputBorder(
          borderRadius: AppRadius.inputAll,
          borderSide: const BorderSide(color: AppColors.inputBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.inputAll,
          borderSide: const BorderSide(color: AppColors.inputBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: AppRadius.inputAll,
          borderSide: const BorderSide(color: AppColors.buttonPrimary, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: AppRadius.inputAll,
          borderSide: const BorderSide(color: AppColors.inputErrorBorder),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: AppRadius.inputAll,
          borderSide: const BorderSide(color: AppColors.inputErrorFocus, width: 1.5),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: AppRadius.inputAll,
          borderSide: BorderSide(
            color: AppColors.inputBorder.withValues(alpha: 0.6),
          ),
        ),
      ),
      cardTheme: const CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.cardAll,
          side: BorderSide(color: AppColors.cardBorder),
        ),
        clipBehavior: Clip.antiAlias,
      ),
      dialogTheme: const DialogThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.panelAll),
        titleTextStyle: AppTypography.sectionHeading,
        contentTextStyle: AppTypography.body,
      ),
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        showDragHandle: true,
        dragHandleColor: AppColors.border,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppRadius.panel),
          ),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.emeraldLight,
        elevation: 0,
        height: 64,
        labelTextStyle: WidgetStateProperty.resolveWith((states) {
          final bool selected = states.contains(WidgetState.selected);
          return AppTypography.navLabel.copyWith(
            color: selected ? AppColors.emerald : AppColors.foregroundMuted,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
          );
        }),
        iconTheme: WidgetStateProperty.resolveWith((states) {
          final bool selected = states.contains(WidgetState.selected);
          return IconThemeData(
            color: selected ? AppColors.emerald : AppColors.foregroundMuted,
            size: 22,
          );
        }),
      ),
      navigationRailTheme: const NavigationRailThemeData(
        backgroundColor: AppColors.surface,
        indicatorColor: AppColors.emeraldLight,
        selectedIconTheme: IconThemeData(color: AppColors.emerald),
        unselectedIconTheme: IconThemeData(color: AppColors.foregroundMuted),
        selectedLabelTextStyle: TextStyle(
          fontFamily: AppTypography.sansFamily,
          fontWeight: FontWeight.w600,
          fontSize: 12,
          color: AppColors.emerald,
        ),
        unselectedLabelTextStyle: TextStyle(
          fontFamily: AppTypography.sansFamily,
          fontWeight: FontWeight.w500,
          fontSize: 12,
          color: AppColors.foregroundMuted,
        ),
      ),
      dividerTheme: const DividerThemeData(
        color: AppColors.borderSubtle,
        thickness: 1,
        space: 1,
      ),
      checkboxTheme: CheckboxThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.emerald;
          }
          return AppColors.surface;
        }),
        checkColor: const WidgetStatePropertyAll(AppColors.onDark),
        side: const BorderSide(color: AppColors.inputBorder, width: 1.5),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
      ),
      radioTheme: RadioThemeData(
        fillColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.emerald;
          }
          return AppColors.foregroundMuted;
        }),
      ),
      switchTheme: SwitchThemeData(
        thumbColor: WidgetStateProperty.resolveWith((states) {
          return AppColors.surface;
        }),
        trackColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.emerald;
          }
          return AppColors.border;
        }),
        trackOutlineColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return AppColors.emerald;
          }
          return AppColors.borderLight;
        }),
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: AppColors.charcoal,
        contentTextStyle: AppTypography.body.copyWith(color: AppColors.onDark),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.subtleAll),
        elevation: 0,
      ),
      progressIndicatorTheme: const ProgressIndicatorThemeData(
        color: AppColors.emerald,
        linearTrackColor: AppColors.emeraldLight,
        circularTrackColor: AppColors.emeraldLight,
      ),
      chipTheme: ChipThemeData(
        backgroundColor: AppColors.emeraldLight,
        disabledColor: AppColors.surfaceMuted,
        selectedColor: AppColors.emerald,
        secondarySelectedColor: AppColors.emerald,
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        labelStyle: AppTypography.microLabel.copyWith(
          color: AppColors.successText,
          letterSpacing: 0.2,
          fontWeight: FontWeight.w600,
        ),
        secondaryLabelStyle: AppTypography.microLabel.copyWith(
          color: AppColors.onDark,
        ),
        shape: const StadiumBorder(
          side: BorderSide(color: AppColors.successBorder),
        ),
        side: const BorderSide(color: AppColors.successBorder),
      ),
      iconTheme: const IconThemeData(color: AppColors.foreground, size: 22),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: AppColors.buttonPrimary,
        foregroundColor: AppColors.onDark,
        elevation: 0,
        focusElevation: 0,
        hoverElevation: 0,
        highlightElevation: 0,
        shape: RoundedRectangleBorder(borderRadius: AppRadius.buttonAll),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: AppColors.surface,
        selectedItemColor: AppColors.emerald,
        unselectedItemColor: AppColors.foregroundMuted,
        type: BottomNavigationBarType.fixed,
        elevation: 0,
        selectedLabelStyle: AppTypography.navLabel,
        unselectedLabelStyle: AppTypography.navLabel,
      ),
      listTileTheme: const ListTileThemeData(
        iconColor: AppColors.foregroundSecondary,
        textColor: AppColors.foreground,
        contentPadding: EdgeInsets.symmetric(horizontal: AppSpacing.md),
      ),
    );
  }
}
