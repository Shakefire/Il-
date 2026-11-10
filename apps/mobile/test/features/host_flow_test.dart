import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:ile_mobile/core/api/api_client.dart';
import 'package:ile_mobile/core/api/ile_api.dart';
import 'package:ile_mobile/core/api/session_token_store.dart';
import 'package:ile_mobile/core/utils/user_role.dart';
import 'package:shared_preferences/shared_preferences.dart';

IleApi _api(MockClient mock) => IleApi(
      ApiClient(client: mock, tokenStore: MemorySessionTokenStore()),
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  group('UserRole host gate', () {
    test('guest cannot access host wallet', () {
      expect(UserRole.canAccessHostWallet('guest'), isFalse);
      expect(UserRole.canAccessHostWallet(null), isFalse);
      expect(UserRole.canAccessHostWallet(''), isFalse);
    });

    test('host and admin can access host wallet', () {
      expect(UserRole.canAccessHostWallet('host'), isTrue);
      expect(UserRole.canAccessHostWallet('HOST'), isTrue);
      expect(UserRole.canAccessHostWallet('admin'), isTrue);
    });
  });

  group('IleApi host surface (mocked HTTP)', () {
    test('getHostDashboard maps metrics envelope', () async {
      final MockClient mock = MockClient((http.Request request) async {
        expect(request.url.path, contains('/api/host/dashboard'));
        return http.Response(
          jsonEncode(<String, dynamic>{
            'earnings': <String, dynamic>{'lifetimeHostEarnings': 120000},
            'occupancy': <String, dynamic>{'occupancyRate': 0.42},
            'alerts': <dynamic>[],
          }),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final IleApi api = _api(mock);
      final Map<String, dynamic> dash = await api.getHostDashboard();
      expect(dash['earnings']['lifetimeHostEarnings'], 120000);
      expect(dash['occupancy']['occupancyRate'], 0.42);
    });

    test('acceptHostBooking posts to bookings accept', () async {
      final MockClient mock = MockClient((http.Request request) async {
        expect(request.method, 'POST');
        expect(request.url.path, contains('/api/bookings/book_1/accept'));
        return http.Response(
          jsonEncode(<String, dynamic>{
            'success': true,
            'booking': <String, dynamic>{
              'id': 'book_1',
              'status': 'PAYMENT_PENDING',
            },
          }),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final IleApi api = _api(mock);
      final Map<String, dynamic> res = await api.acceptHostBooking('book_1');
      expect(res['booking']['status'], 'PAYMENT_PENDING');
    });

    test('declineHostBooking posts to bookings decline', () async {
      final MockClient mock = MockClient((http.Request request) async {
        expect(request.method, 'POST');
        expect(request.url.path, contains('/api/bookings/book_2/decline'));
        return http.Response(
          jsonEncode(<String, dynamic>{'success': true}),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final IleApi api = _api(mock);
      final Map<String, dynamic> res = await api.declineHostBooking('book_2');
      expect(res['success'], isTrue);
    });

    test('block and unblock availability', () async {
      String? lastPath;
      final MockClient mock = MockClient((http.Request request) async {
        lastPath = request.url.path;
        if (request.method == 'POST') {
          expect(request.url.path, contains('/availability/block'));
          return http.Response(
            jsonEncode(<String, dynamic>{'success': true, 'id': 'blk_1'}),
            201,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }
        expect(request.method, 'DELETE');
        expect(request.url.path, contains('/availability/block/blk_1'));
        return http.Response(
          jsonEncode(<String, dynamic>{'success': true}),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final IleApi api = _api(mock);
      await api.blockHostPropertyDates(
        propertyId: 'prop_1',
        startDate: '2026-12-01',
        endDate: '2026-12-05',
      );
      expect(lastPath, contains('/availability/block'));
      await api.unblockHostPropertyDates(
        propertyId: 'prop_1',
        blockId: 'blk_1',
      );
      expect(lastPath, contains('/availability/block/blk_1'));
    });

    test('relist + publish + unpublish property actions', () async {
      final List<String> paths = <String>[];
      final MockClient mock = MockClient((http.Request request) async {
        paths.add('${request.method} ${request.url.path}');
        return http.Response(
          jsonEncode(<String, dynamic>{'success': true}),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final IleApi api = _api(mock);
      await api.publishHostProperty('p1');
      await api.unpublishHostProperty('p1');
      await api.relistHostProperty('p1');
      expect(paths.any((String p) => p.contains('/publish')), isTrue);
      expect(paths.any((String p) => p.contains('/unpublish')), isTrue);
      expect(paths.any((String p) => p.contains('/relist')), isTrue);
    });

    test('onboarding status + submit endpoints', () async {
      final MockClient mock = MockClient((http.Request request) async {
        if (request.method == 'GET') {
          expect(request.url.path, contains('/onboarding/status'));
          return http.Response(
            jsonEncode(<String, dynamic>{
              'verificationStatus': 'PROFILE_COMPLETED',
              'progressPct': 40,
              'missingRequirements': <String>['Upload ID'],
            }),
            200,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }
        expect(request.url.path, contains('/onboarding/submit'));
        return http.Response(
          jsonEncode(<String, dynamic>{
            'success': true,
            'message': 'Application submitted',
          }),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final IleApi api = _api(mock);
      final Map<String, dynamic> status = await api.getHostOnboardingStatus();
      expect(status['progressPct'], 40);
      final Map<String, dynamic> submitted = await api.submitHostOnboarding();
      expect(submitted['success'], isTrue);
    });

    test('payout account update + banks list', () async {
      final MockClient mock = MockClient((http.Request request) async {
        if (request.url.path.contains('/api/banks')) {
          return http.Response(
            jsonEncode(<String, dynamic>{
              'banks': <Map<String, dynamic>>[
                <String, dynamic>{'name': 'GTBank', 'code': '058'},
              ],
            }),
            200,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }
        expect(request.method, 'PUT');
        expect(request.url.path, contains('/payout-account'));
        return http.Response(
          jsonEncode(<String, dynamic>{
            'success': true,
            'message': 'Verified',
          }),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final IleApi api = _api(mock);
      final List<Map<String, dynamic>> banks = await api.getNigerianBanks();
      expect(banks.first['code'], '058');
      final Map<String, dynamic> updated = await api.updateHostPayoutAccount(
        bankCode: '058',
        accountNumber: '0123456789',
      );
      expect(updated['success'], isTrue);
    });

    test('withdraw submits amount only (no client transfer)', () async {
      final MockClient mock = MockClient((http.Request request) async {
        expect(request.method, 'POST');
        expect(request.url.path, contains('/wallet/withdraw'));
        final Map<String, dynamic> body =
            jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['amountNaira'], 50000);
        return http.Response(
          jsonEncode(<String, dynamic>{
            'success': true,
            'message': 'Withdrawal submitted',
          }),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final IleApi api = _api(mock);
      final Map<String, dynamic> res =
          await api.requestHostWithdrawal(amountNaira: 50000);
      expect(res['message'], contains('Withdrawal'));
    });

    test('notifications inbox + preferences', () async {
      final MockClient mock = MockClient((http.Request request) async {
        if (request.url.path.endsWith('/preferences')) {
          return http.Response(
            jsonEncode(<String, dynamic>{
              'preferences': <Map<String, dynamic>>[
                <String, dynamic>{
                  'category': 'HOST',
                  'inboxEnabled': true,
                  'pushEnabled': true,
                },
              ],
            }),
            200,
            headers: <String, String>{'content-type': 'application/json'},
          );
        }
        return http.Response(
          jsonEncode(<String, dynamic>{
            'notifications': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'n1',
                'title': 'New request',
                'body': 'Guest waiting',
              },
            ],
            'unreadCount': 1,
          }),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final IleApi api = _api(mock);
      final Map<String, dynamic> inbox = await api.getNotifications();
      expect(inbox['unreadCount'], 1);
      final Map<String, dynamic> prefs = await api.getNotificationPreferences();
      expect((prefs['preferences'] as List).length, 1);
    });

    test('getHostPayouts maps payout ledger', () async {
      final MockClient mock = MockClient((http.Request request) async {
        expect(request.url.path, contains('/api/host/payouts'));
        return http.Response(
          jsonEncode(<String, dynamic>{
            'payouts': <Map<String, dynamic>>[
              <String, dynamic>{
                'id': 'pay_1',
                'amount': 45000,
                'status': 'READY_FOR_PAYOUT',
                'bookingRef': 'ILE-1',
              },
            ],
          }),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final IleApi api = _api(mock);
      final List<Map<String, dynamic>> rows = await api.getHostPayouts();
      expect(rows, hasLength(1));
      expect(rows.first['amount'], 45000);
    });

    test('media order PUT sends ordered ids', () async {
      final MockClient mock = MockClient((http.Request request) async {
        expect(request.method, 'PUT');
        expect(request.url.path, contains('/media-order'));
        final Map<String, dynamic> body =
            jsonDecode(request.body) as Map<String, dynamic>;
        expect(body['orderedImageIds'], <String>['a', 'b']);
        expect(body['coverImageId'], 'b');
        return http.Response(
          jsonEncode(<String, dynamic>{'success': true}),
          200,
          headers: <String, String>{'content-type': 'application/json'},
        );
      });
      final IleApi api = _api(mock);
      final Map<String, dynamic> res = await api.reorderHostPropertyMedia(
        propertyId: 'prop_1',
        orderedImageIds: <String>['a', 'b'],
        coverImageId: 'b',
      );
      expect(res['success'], isTrue);
    });
  });
}
