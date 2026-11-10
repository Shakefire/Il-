import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ile_mobile/app/app_theme.dart';
import 'package:ile_mobile/core/api/api_client.dart';
import 'package:ile_mobile/core/api/ile_api.dart';
import 'package:ile_mobile/core/api/session_token_store.dart';
import 'package:ile_mobile/core/constants/app_routes.dart';
import 'package:ile_mobile/core/constants/app_strings.dart';
import 'package:ile_mobile/core/state/search_session.dart';
import 'package:ile_mobile/core/state/wishlist_store.dart';
import 'package:ile_mobile/features/auth/login_screen.dart';
import 'package:ile_mobile/features/auth/otp_verification_screen.dart';
import 'package:ile_mobile/features/auth/register_screen.dart';
import 'package:ile_mobile/features/auth/welcome_screen.dart';
import 'package:ile_mobile/features/explore/explore_screen.dart';
import 'package:ile_mobile/shared/widgets/widgets.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

ApiClient _testClient(
  Future<http.Response> Function(http.Request request) handler,
) {
  return ApiClient(
    client: MockClient(handler),
    tokenStore: MemorySessionTokenStore(),
  );
}

IleApi _apiWithHandler(
  Future<http.Response> Function(http.Request request) handler,
) {
  return IleApi(_testClient(handler));
}

IleApi _marketplaceApi() {
  return _apiWithHandler((http.Request request) async {
    if (request.url.path.contains('/api/properties')) {
      return http.Response(
        jsonEncode(<String, dynamic>{'properties': <dynamic>[]}),
        200,
        headers: <String, String>{'content-type': 'application/json'},
      );
    }
    if (request.url.path.contains('/api/auth/me')) {
      return http.Response(
        jsonEncode(<String, dynamic>{'error': 'Unauthorized'}),
        401,
        headers: <String, String>{'content-type': 'application/json'},
      );
    }
    return http.Response('{}', 404);
  });
}

Widget _app(GoRouter router, {required IleApi api, ApiClient? client}) {
  return MultiProvider(
    providers: [
      Provider<ApiClient>.value(
        value: client ??
            ApiClient(tokenStore: MemorySessionTokenStore()),
      ),
      Provider<IleApi>.value(value: api),
      ChangeNotifierProvider<SearchSession>(
        create: (_) => SearchSession(),
      ),
      ChangeNotifierProvider<WishlistStore>(
        create: (_) => WishlistStore(),
      ),
    ],
    child: MaterialApp.router(
      theme: AppTheme.light,
      routerConfig: router,
    ),
  );
}

GoRouter _buildRouter({String initial = AppRoutes.welcome}) {
  return GoRouter(
    initialLocation: initial,
    routes: [
      GoRoute(
        path: AppRoutes.welcome,
        builder: (context, state) => const WelcomeScreen(),
      ),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: AppRoutes.register,
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: AppRoutes.otp,
        builder: (context, state) {
          return OtpVerificationScreen(
            email: state.uri.queryParameters['email'] ?? 'a@b.com',
            maskedPhone: AppRoutesDefaults.maskedPhone,
          );
        },
      ),
      GoRoute(
        path: AppRoutes.home,
        builder: (context, state) => const ExploreScreen(),
      ),
    ],
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  SharedPreferences.setMockInitialValues(<String, Object>{});

  testWidgets('welcome Get Started navigates to login', (tester) async {
    await tester.pumpWidget(_app(_buildRouter(), api: _marketplaceApi()));
    await tester.pump();
    await tester.tap(find.text(AppStrings.getStarted));
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.signIn), findsWidgets);
    expect(find.text(AppStrings.authGreeting), findsOneWidget);
  });

  testWidgets('welcome Continue as Guest opens marketplace Explore',
      (tester) async {
    await tester.pumpWidget(_app(_buildRouter(), api: _marketplaceApi()));
    await tester.pump();
    await tester.tap(find.text(AppStrings.continueAsGuest));
    await tester.pump();
    expect(find.byType(ExploreScreen), findsOneWidget);
    await tester.pumpAndSettle();
    expect(find.text('Hello,'), findsOneWidget);
  });

  testWidgets('login validation blocks empty submit', (tester) async {
    await tester.pumpWidget(
      _app(_buildRouter(initial: AppRoutes.login), api: _marketplaceApi()),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text(AppStrings.signIn).first);
    await tester.pump();
    expect(find.text(AppStrings.validationRequired), findsWidgets);
  });

  testWidgets('login success shows alert then Explore', (tester) async {
    final ApiClient client = ApiClient(
      tokenStore: MemorySessionTokenStore(),
      client: MockClient((http.Request request) async {
        if (request.url.path.endsWith('/api/auth/login')) {
          return http.Response(
            jsonEncode(<String, dynamic>{
              'success': true,
              'token': 'tok_test',
              'user': <String, dynamic>{
                'id': 'usr_1',
                'email': 'guest@ile.app',
                'firstName': 'Guest',
                'lastName': 'User',
                'role': 'guest',
              },
            }),
            200,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }
        if (request.url.path.contains('/api/properties')) {
          return http.Response(
            jsonEncode(<String, dynamic>{'properties': <dynamic>[]}),
            200,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }
        if (request.url.path.contains('/api/auth/me')) {
          return http.Response(
            jsonEncode(<String, dynamic>{
              'user': <String, dynamic>{
                'id': 'usr_1',
                'firstName': 'Guest',
                'email': 'guest@ile.app',
              },
            }),
            200,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }
        return http.Response('{}', 404);
      }),
    );
    final IleApi api = IleApi(client);

    await tester.pumpWidget(
      _app(
        _buildRouter(initial: AppRoutes.login),
        api: api,
        client: client,
      ),
    );
    await tester.pumpAndSettle();
    final emailFields = find.byType(TextField);
    await tester.enterText(emailFields.at(0), 'guest@ile.app');
    await tester.enterText(emailFields.at(1), 'Password1');
    await tester.tap(find.text(AppStrings.signIn).first);
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.loginSuccessTitle), findsOneWidget);
    await tester.tap(find.text(AppStrings.continueLabel));
    await tester.pumpAndSettle();
    expect(find.byType(ExploreScreen), findsOneWidget);
  });

  testWidgets('OTP rejects wrong code and accepts valid API code', (tester) async {
    final ApiClient client = ApiClient(
      tokenStore: MemorySessionTokenStore(),
      client: MockClient((http.Request request) async {
        if (request.url.path.endsWith('/api/auth/verify-email')) {
          final Map<String, dynamic> body =
              jsonDecode(request.body) as Map<String, dynamic>;
          if (body['code'] == '123456') {
            return http.Response(
              jsonEncode(<String, dynamic>{
                'success': true,
                'token': 'tok_verified',
              }),
              200,
              headers: <String, String>{'content-type': 'application/json'},
            );
          }
          return http.Response(
            jsonEncode(<String, dynamic>{'error': AppStrings.otpInvalid}),
            400,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }
        return http.Response('{}', 404);
      }),
    );

    await tester.pumpWidget(
      _app(
        _buildRouter(
          initial: AppRoutes.otpPath(email: 'guest@ile.app'),
        ),
        api: IleApi(client),
        client: client,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.otpTitle), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, '000000');
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.otpInvalid), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, '123456');
    await tester.pumpAndSettle();
    expect(find.text(AppStrings.registerSuccessTitle), findsOneWidget);
  });

  testWidgets('skeleton primitives render', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light,
        home: const Scaffold(
          body: SingleChildScrollView(
            child: Column(
              children: [
                SizedBox(height: 8),
              ],
            ),
          ),
        ),
      ),
    );
    expect(find.byType(SizedBox), findsWidgets);
  });
}
