import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ile_mobile/app/app_theme.dart';
import 'package:ile_mobile/shared/widgets/widgets.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: AppTheme.light,
    home: Scaffold(body: child),
  );
}

void main() {
  group('IleButton', () {
    testWidgets('renders label and handles press', (tester) async {
      var pressed = false;

      await tester.pumpWidget(
        _wrap(
          IleButton(
            label: 'Book stay',
            onPressed: () => pressed = true,
          ),
        ),
      );

      expect(find.text('Book stay'), findsOneWidget);
      await tester.tap(find.text('Book stay'));
      await tester.pumpAndSettle();
      expect(pressed, isTrue);
    });

    testWidgets('shows loading indicator when isLoading', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const IleButton(
            label: 'Book stay',
            onPressed: null,
            isLoading: true,
          ),
        ),
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.text('Book stay'), findsNothing);
    });

    testWidgets('disabled button does not fire', (tester) async {
      var pressed = false;

      await tester.pumpWidget(
        _wrap(
          IleButton(
            label: 'Disabled',
            onPressed: null,
          ),
        ),
      );

      await tester.tap(find.text('Disabled'));
      await tester.pump();
      expect(pressed, isFalse);
    });
  });

  group('IleInput', () {
    testWidgets('shows label, helper, and accepts text', (tester) async {
      final controller = TextEditingController();

      await tester.pumpWidget(
        _wrap(
          IleInput(
            label: 'Destination',
            hintText: 'Search',
            helperText: 'Abuja or Lagos',
            controller: controller,
          ),
        ),
      );

      expect(find.text('Destination'), findsOneWidget);
      expect(find.text('Abuja or Lagos'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Maitama');
      expect(controller.text, 'Maitama');
    });

    testWidgets('shows error text', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const IleInput(
            label: 'Email',
            errorText: 'Required',
          ),
        ),
      );

      expect(find.text('Required'), findsOneWidget);
    });
  });

  group('IleBadge / IleCard / IlePriceDisplay', () {
    testWidgets('badge and verified badge render', (tester) async {
      await tester.pumpWidget(
        _wrap(
          const Column(
            children: [
              IleBadge(label: 'Confirmed', tone: IleBadgeTone.success),
              IleVerifiedBadge(),
            ],
          ),
        ),
      );

      expect(find.text('Confirmed'), findsOneWidget);
      expect(find.text('Verified stay'), findsOneWidget);
    });

    testWidgets('price display formats amount', (tester) async {
      await tester.pumpWidget(
        _wrap(const IlePriceDisplay(amount: 180000)),
      );

      expect(find.textContaining('180,000'), findsOneWidget);
      expect(find.textContaining('₦'), findsOneWidget);
    });

    testWidgets('property card foundation renders', (tester) async {
      await tester.pumpWidget(
        _wrap(
          IlePropertyCard(
            title: 'Maitama Heights',
            location: 'Abuja',
            pricePerNight: 180000,
            onTap: () {},
          ),
        ),
      );

      expect(find.text('Maitama Heights'), findsOneWidget);
      expect(find.text('Abuja'), findsOneWidget);
      expect(find.text('Verified stay'), findsOneWidget);
    });
  });

  group('IleSocialButtons', () {
    testWidgets('renders Google and Apple only — no Facebook', (tester) async {
      await tester.pumpWidget(_wrap(const IleSocialButtons()));
      await tester.pumpAndSettle();

      expect(find.bySemanticsLabel('Continue with Google'), findsOneWidget);
      expect(find.bySemanticsLabel('Continue with Apple'), findsOneWidget);
      expect(find.bySemanticsLabel('Continue with Facebook'), findsNothing);
      expect(find.byIcon(Icons.facebook), findsNothing);
    });
  });

  group('Empty / error / loading', () {
    testWidgets('empty and error states render actions', (tester) async {
      var retried = false;

      await tester.pumpWidget(
        _wrap(
          IleErrorState(
            title: 'Could not load',
            message: 'Check your connection',
            retryLabel: 'Retry listing',
            onRetry: () => retried = true,
          ),
        ),
      );

      expect(find.text('Could not load'), findsOneWidget);
      expect(find.text('Check your connection'), findsOneWidget);
      await tester.tap(find.text('Retry listing'));
      await tester.pump();
      expect(retried, isTrue);
    });

    testWidgets('loading indicator exposes semantics', (tester) async {
      await tester.pumpWidget(
        _wrap(const IleLoadingIndicator(message: 'Loading')),
      );

      expect(find.text('Loading'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });
}
