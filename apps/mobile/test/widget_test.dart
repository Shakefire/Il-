import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:ile_mobile/app/app.dart';
import 'package:ile_mobile/core/constants/app_strings.dart';
import 'package:ile_mobile/features/auth/welcome_screen.dart';

void main() {
  testWidgets('app boots into welcome screen', (tester) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const WelcomeScreen(),
        ),
      ],
    );

    await tester.pumpWidget(IleApp(router: router));
    await tester.pump();

    expect(find.text(AppStrings.welcomeHeadline), findsOneWidget);
    expect(find.text(AppStrings.getStarted), findsOneWidget);
    expect(find.text(AppStrings.continueAsGuest), findsOneWidget);
  });
}
