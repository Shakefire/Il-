import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ile_mobile/core/api/api_client.dart';
import 'package:ile_mobile/core/api/ile_api.dart';
import 'package:ile_mobile/core/api/session_token_store.dart';
import 'package:ile_mobile/core/models/booking.dart';
import 'package:shared_preferences/shared_preferences.dart';

IleApi _api(MockClient mock) => IleApi(
      ApiClient(client: mock, tokenStore: MemorySessionTokenStore()),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('IleBooking Phase 7 check-in status', () {
    test('eligible CONFIRMED stay on/after check-in can confirm', () {
      final String today = DateTime.now().toUtc().toIso8601String().split('T').first;
      final IleBooking booking = IleBooking.fromJson(<String, dynamic>{
        'id': 'book_ci_1',
        'status': 'CONFIRMED',
        'checkInDate': today,
        'checkOutDate': '2099-12-31',
        'guestCount': 2,
        'totalAmount': 100000,
      });
      expect(booking.guestCheckInConfirmed, isFalse);
      expect(booking.canConfirmCheckIn, isTrue);
      expect(booking.isConfirmed, isTrue);
    });

    test('future check-in is not confirmable yet', () {
      final IleBooking booking = IleBooking.fromJson(<String, dynamic>{
        'id': 'book_ci_2',
        'status': 'CONFIRMED',
        'checkInDate': '2099-01-01',
        'checkOutDate': '2099-01-05',
        'guestCount': 1,
        'totalAmount': 50000,
      });
      expect(booking.canConfirmCheckIn, isFalse);
    });

    test('already confirmed check-in disables CTA and keeps status', () {
      final String today = DateTime.now().toUtc().toIso8601String().split('T').first;
      final IleBooking booking = IleBooking.fromJson(<String, dynamic>{
        'id': 'book_ci_3',
        'status': 'CONFIRMED',
        'checkInDate': today,
        'checkOutDate': '2099-12-31',
        'guestCount': 2,
        'totalAmount': 100000,
        'guestCheckInConfirmedAt': DateTime.now().toUtc().toIso8601String(),
      });
      expect(booking.guestCheckInConfirmed, isTrue);
      expect(booking.canConfirmCheckIn, isFalse);
      expect(booking.statusHeadline, isNotEmpty);
    });

    test('PENDING_HOST cannot confirm check-in', () {
      final String today = DateTime.now().toUtc().toIso8601String().split('T').first;
      final IleBooking booking = IleBooking.fromJson(<String, dynamic>{
        'id': 'book_ci_4',
        'status': 'PENDING_HOST',
        'checkInDate': today,
        'checkOutDate': '2099-12-31',
        'guestCount': 1,
        'totalAmount': 1,
      });
      expect(booking.canConfirmCheckIn, isFalse);
    });
  });

  group('IleApi Phase 7 check-in + wallet (mocked HTTP)', () {
    test('confirmCheckIn posts and maps guestCheckInConfirmedAt', () async {
      final MockClient mock = MockClient((http.Request request) async {
        expect(request.method, 'POST');
        expect(request.url.path, contains('/confirm-check-in'));
        return http.Response(
          jsonEncode(<String, dynamic>{
            'success': true,
            'booking': <String, dynamic>{
              'id': 'book_api_1',
              'status': 'CONFIRMED',
              'checkInDate': '2026-11-01',
              'checkOutDate': '2026-11-05',
              'guestCount': 2,
              'totalAmount': 100000,
              'guestCheckInConfirmedAt': '2026-11-01T10:00:00.000Z',
              'canConfirmCheckIn': false,
            },
          }),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });

      final IleApi api = _api(mock);
      final IleBooking updated = await api.confirmCheckIn(
        bookingId: 'book_api_1',
        accessToken: 'tok_test',
      );
      expect(updated.guestCheckInConfirmed, isTrue);
      expect(updated.canConfirmCheckIn, isFalse);
    });

    test('confirmCheckIn surfaces unauthorized errors', () async {
      final MockClient mock = MockClient((http.Request request) async {
        return http.Response(
          jsonEncode(<String, dynamic>{
            'error': 'Only the guest on this booking can confirm check-in.',
            'code': 'FORBIDDEN',
          }),
          403,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });

      final IleApi api = _api(mock);
      expect(
        () => api.confirmCheckIn(bookingId: 'book_x'),
        throwsA(
          isA<ApiException>().having(
            (ApiException e) => e.message,
            'message',
            contains('Only the guest'),
          ),
        ),
      );
    });

    test('getHostWallet maps balances projection', () async {
      final MockClient mock = MockClient((http.Request request) async {
        expect(request.url.path, contains('/api/host/wallet'));
        return http.Response(
          jsonEncode(<String, dynamic>{
            'success': true,
            'wallet': <String, dynamic>{
              'balances': <String, dynamic>{
                'pending': 81000,
                'available': 72000,
                'processing': 0,
                'paid': 54000,
              },
              'bank': <String, dynamic>{'verified': true},
              'feePolicy': <String, dynamic>{'withdrawalFeeNaira': 0},
            },
          }),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });

      final IleApi api = _api(mock);
      final Map<String, dynamic> body = await api.getHostWallet();
      final Map<String, dynamic> wallet =
          Map<String, dynamic>.from(body['wallet'] as Map);
      final Map<String, dynamic> balances =
          Map<String, dynamic>.from(wallet['balances'] as Map);
      expect(balances['pending'], 81000);
      expect(balances['available'], 72000);
      expect(balances['paid'], 54000);
      expect((wallet['feePolicy'] as Map)['withdrawalFeeNaira'], 0);
    });

    test('requestHostWithdrawal success and insufficient funds', () async {
      int calls = 0;
      final MockClient mock = MockClient((http.Request request) async {
        calls += 1;
        expect(request.method, 'POST');
        expect(request.url.path, contains('/wallet/withdraw'));
        final Map<String, dynamic> payload =
            jsonDecode(request.body) as Map<String, dynamic>;
        final int amount = (payload['amountNaira'] as num).toInt();
        if (amount > 100000) {
          return http.Response(
            jsonEncode(<String, dynamic>{
              'error': 'Requested ₦999999 exceeds available ₦72000.',
              'code': 'INSUFFICIENT_AVAILABLE',
            }),
            400,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }
        return http.Response(
          jsonEncode(<String, dynamic>{
            'success': true,
            'message': 'Withdrawal submitted.',
            'paidAmount': amount,
          }),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });

      final IleApi api = _api(mock);
      final Map<String, dynamic> ok =
          await api.requestHostWithdrawal(amountNaira: 72000);
      expect(ok['success'], isTrue);

      await expectLater(
        () => api.requestHostWithdrawal(amountNaira: 999999),
        throwsA(
          isA<ApiException>().having(
            (ApiException e) => e.message,
            'message',
            contains('exceeds available'),
          ),
        ),
      );
      expect(calls, 2);
    });
  });
}
