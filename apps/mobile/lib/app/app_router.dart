import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../core/constants/app_routes.dart';
import '../features/auth/forgot_password_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/otp_verification_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/auth/reset_password_screen.dart';
import '../features/auth/welcome_screen.dart';
import '../features/bookings/bookings_screen.dart';
import '../features/bookings/reservation_status_screen.dart';
import '../features/design_system/design_system_preview_screen.dart';
import '../features/explore/explore_screen.dart';
import '../features/host/host_bank_screen.dart';
import '../features/host/host_notifications_screen.dart';
import '../features/host/host_onboarding_screen.dart';
import '../features/host/host_profile_screen.dart';
import '../features/host/host_property_editor_screen.dart';
import '../features/host/host_reservation_detail_screen.dart';
import '../features/host/host_shell_screen.dart';
import '../features/host/host_wallet_screen.dart';
import '../features/inbox/inbox_screen.dart';
import '../features/profile/edit_profile_screen.dart';
import '../features/profile/help_screen.dart';
import '../features/profile/legal_screen.dart';
import '../features/profile/notifications_screen.dart';
import '../features/profile/profile_screen.dart';
import '../features/property/property_detail_screen.dart';
import '../features/property/reserve_screen.dart';
import '../features/search/date_guest_picker_screen.dart';
import '../features/search/destination_search_screen.dart';
import '../features/search/map_search_screen.dart';
import '../features/search/search_results_screen.dart';
import '../features/shell/marketplace_shell.dart';
import '../features/wishlist/wishlist_screen.dart';

/// go_router shell for auth + guest marketplace.
GoRouter createAppRouter() {
  return GoRouter(
    initialLocation: AppRoutes.welcome,
    routes: <RouteBase>[
      GoRoute(
        path: AppRoutes.welcome,
        name: 'welcome',
        builder: (BuildContext context, GoRouterState state) {
          return const WelcomeScreen();
        },
      ),
      GoRoute(
        path: AppRoutes.login,
        name: 'login',
        builder: (BuildContext context, GoRouterState state) {
          final String? returnTo = state.uri.queryParameters['returnTo'];
          return LoginScreen(returnTo: returnTo);
        },
      ),
      GoRoute(
        path: AppRoutes.register,
        name: 'register',
        builder: (BuildContext context, GoRouterState state) {
          final String? returnTo = state.uri.queryParameters['returnTo'];
          return RegisterScreen(returnTo: returnTo);
        },
      ),
      GoRoute(
        path: AppRoutes.otp,
        name: 'otp',
        builder: (BuildContext context, GoRouterState state) {
          final String email =
              state.uri.queryParameters['email'] ?? 'guest@ile.app';
          final String phone = state.uri.queryParameters['phone'] ??
              AppRoutesDefaults.maskedPhone;
          return OtpVerificationScreen(
            email: email,
            maskedPhone: Uri.decodeComponent(phone),
          );
        },
      ),
      GoRoute(
        path: AppRoutes.forgotPassword,
        name: 'forgotPassword',
        builder: (BuildContext context, GoRouterState state) {
          return const ForgotPasswordScreen();
        },
      ),
      GoRoute(
        path: AppRoutes.resetPassword,
        name: 'resetPassword',
        builder: (BuildContext context, GoRouterState state) {
          return ResetPasswordScreen(
            token: state.uri.queryParameters['token'],
          );
        },
      ),
      GoRoute(
        path: AppRoutes.designSystem,
        name: 'designSystem',
        builder: (BuildContext context, GoRouterState state) {
          return const DesignSystemPreviewScreen();
        },
      ),
      StatefulShellRoute.indexedStack(
        builder: (
          BuildContext context,
          GoRouterState state,
          StatefulNavigationShell navigationShell,
        ) {
          return MarketplaceShell(navigationShell: navigationShell);
        },
        branches: <StatefulShellBranch>[
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: AppRoutes.explore,
                name: 'explore',
                builder: (BuildContext context, GoRouterState state) {
                  return const ExploreScreen();
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: AppRoutes.wishlist,
                name: 'wishlist',
                builder: (BuildContext context, GoRouterState state) {
                  return const WishlistScreen();
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: AppRoutes.bookings,
                name: 'bookings',
                builder: (BuildContext context, GoRouterState state) {
                  return const BookingsScreen();
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: AppRoutes.inbox,
                name: 'inbox',
                builder: (BuildContext context, GoRouterState state) {
                  return const InboxScreen();
                },
              ),
            ],
          ),
          StatefulShellBranch(
            routes: <RouteBase>[
              GoRoute(
                path: AppRoutes.profile,
                name: 'profile',
                builder: (BuildContext context, GoRouterState state) {
                  return const ProfileScreen();
                },
              ),
            ],
          ),
        ],
      ),
      GoRoute(
        path: AppRoutes.destinationSearch,
        name: 'destinationSearch',
        builder: (BuildContext context, GoRouterState state) {
          return const DestinationSearchScreen();
        },
      ),
      GoRoute(
        path: AppRoutes.dateGuestPicker,
        name: 'dateGuestPicker',
        builder: (BuildContext context, GoRouterState state) {
          final Map<String, String> q = state.uri.queryParameters;
          return DateGuestPickerScreen(
            editMode: q['edit'] == '1',
            maxGuests: int.tryParse(q['maxGuests'] ?? ''),
            minimumNights: int.tryParse(q['minNights'] ?? '') ?? 1,
            propertyId: q['propertyId'],
          );
        },
      ),
      GoRoute(
        path: AppRoutes.searchResults,
        name: 'searchResults',
        builder: (BuildContext context, GoRouterState state) {
          return const SearchResultsScreen();
        },
      ),
      GoRoute(
        path: AppRoutes.mapSearch,
        name: 'mapSearch',
        builder: (BuildContext context, GoRouterState state) {
          return const MapSearchScreen();
        },
      ),
      GoRoute(
        path: AppRoutes.propertyDetails,
        name: 'propertyDetails',
        pageBuilder: (BuildContext context, GoRouterState state) {
          final bool reduceMotion = MediaQuery.disableAnimationsOf(context);
          final String slug = state.pathParameters['slug'] ?? '';
          return CustomTransitionPage<void>(
            key: state.pageKey,
            transitionDuration: reduceMotion
                ? Duration.zero
                : const Duration(milliseconds: 380),
            reverseTransitionDuration: reduceMotion
                ? Duration.zero
                : const Duration(milliseconds: 240),
            child: PropertyDetailScreen(
              slug: slug,
              heroScope: state.uri.queryParameters['hero'],
            ),
            transitionsBuilder: (
              BuildContext context,
              Animation<double> animation,
              Animation<double> secondaryAnimation,
              Widget child,
            ) {
              return FadeTransition(
                opacity: CurvedAnimation(
                  parent: animation,
                  curve: Curves.easeOutCubic,
                ),
                child: child,
              );
            },
          );
        },
      ),
      GoRoute(
        path: AppRoutes.reserve,
        name: 'reserve',
        builder: (BuildContext context, GoRouterState state) {
          final String slug = state.pathParameters['slug'] ?? '';
          return ReserveScreen(slug: slug);
        },
      ),
      GoRoute(
        path: AppRoutes.reservationStatus,
        name: 'reservationStatus',
        builder: (BuildContext context, GoRouterState state) {
          final String id = state.pathParameters['id'] ?? '';
          final String? token = state.uri.queryParameters['token'];
          return ReservationStatusScreen(
            bookingId: id,
            accessToken: token,
          );
        },
      ),
      GoRoute(
        path: AppRoutes.editProfile,
        name: 'editProfile',
        builder: (BuildContext context, GoRouterState state) {
          return const EditProfileScreen();
        },
      ),
      GoRoute(
        path: AppRoutes.notifications,
        name: 'notifications',
        builder: (BuildContext context, GoRouterState state) {
          return const NotificationsScreen();
        },
      ),
      GoRoute(
        path: AppRoutes.help,
        name: 'help',
        builder: (BuildContext context, GoRouterState state) {
          return const HelpScreen();
        },
      ),
      GoRoute(
        path: AppRoutes.terms,
        name: 'terms',
        builder: (BuildContext context, GoRouterState state) {
          return LegalScreen.terms;
        },
      ),
      GoRoute(
        path: AppRoutes.privacy,
        name: 'privacy',
        builder: (BuildContext context, GoRouterState state) {
          return LegalScreen.privacy;
        },
      ),
      GoRoute(
        path: AppRoutes.hostDashboard,
        name: 'hostDashboard',
        builder: (BuildContext context, GoRouterState state) {
          return const HostShellScreen();
        },
        routes: <RouteBase>[
          GoRoute(
            path: 'profile',
            name: 'hostProfile',
            builder: (BuildContext context, GoRouterState state) {
              return const HostProfileScreen();
            },
          ),
          GoRoute(
            path: 'onboarding',
            name: 'hostOnboarding',
            builder: (BuildContext context, GoRouterState state) {
              return const HostOnboardingScreen();
            },
          ),
          GoRoute(
            path: 'bank',
            name: 'hostBank',
            builder: (BuildContext context, GoRouterState state) {
              return const HostBankScreen();
            },
          ),
          GoRoute(
            path: 'notifications',
            name: 'hostNotifications',
            builder: (BuildContext context, GoRouterState state) {
              return const HostNotificationsScreen();
            },
          ),
          GoRoute(
            path: 'wallet',
            name: 'hostWallet',
            builder: (BuildContext context, GoRouterState state) {
              return const HostWalletScreen();
            },
          ),
          GoRoute(
            path: 'reservations/:id',
            name: 'hostReservationDetail',
            builder: (BuildContext context, GoRouterState state) {
              final String id = state.pathParameters['id'] ?? '';
              return HostReservationDetailScreen(bookingId: id);
            },
          ),
          GoRoute(
            path: 'properties/new',
            name: 'hostPropertyCreate',
            builder: (BuildContext context, GoRouterState state) {
              return const HostPropertyEditorScreen();
            },
          ),
          GoRoute(
            path: 'properties/:id',
            name: 'hostPropertyDetail',
            builder: (BuildContext context, GoRouterState state) {
              final String id = state.pathParameters['id'] ?? '';
              return HostPropertyEditorScreen(propertyId: id);
            },
            routes: <RouteBase>[
              GoRoute(
                path: 'edit',
                name: 'hostPropertyEdit',
                builder: (BuildContext context, GoRouterState state) {
                  final String id = state.pathParameters['id'] ?? '';
                  return HostPropertyEditorScreen(propertyId: id);
                },
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
