import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_typography.dart';
import '../../core/state/session_store.dart';

/// Branded Afro-Luxe splash screen shown during initial session restoration.
///
/// Prevents blank screens and flashing unauthenticated layouts on app startup.
class AppSplashScreen extends StatefulWidget {
  const AppSplashScreen({super.key});

  @override
  State<AppSplashScreen> createState() => _AppSplashScreenState();
}

class _AppSplashScreenState extends State<AppSplashScreen> {
  @override
  Widget build(BuildContext context) {
    const Color deepEmerald = Color(0xFF073B2E);
    const Color champagneGold = Color(0xFFD4AF37);

    return Scaffold(
      backgroundColor: deepEmerald,
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              // Ilé Brand Header
              const Text(
                'Ilé',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 54,
                  fontWeight: FontWeight.w800,
                  letterSpacing: -1.2,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'CURATED NIGERIAN STAYS',
                style: AppTypography.microLabel.copyWith(
                  color: champagneGold,
                  letterSpacing: 3.2,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              // Polished loading indicator
              const SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.4,
                  valueColor: AlwaysStoppedAnimation<Color>(champagneGold),
                ),
              ),
              const SizedBox(height: 20),
              Consumer<SessionStore>(
                builder: (context, session, _) {
                  return Text(
                    session.isRestoringSession
                        ? 'Restoring secure session...'
                        : 'Starting Ilé...',
                    style: AppTypography.caption.copyWith(
                      color: Colors.white.withValues(alpha: 0.65),
                      fontSize: 12.5,
                    ),
                  );
                },
              ),
              const SizedBox(height: 48),
            ],
          ),
        ),
      ),
    );
  }
}
