import 'package:flutter_test/flutter_test.dart';
import 'package:ile_mobile/core/models/booking.dart';
import 'package:ile_mobile/core/utils/user_role.dart';

void main() {
  group('Phase 8 guest profile + status consistency', () {
    test('guest / unknown roles cannot access host wallet', () {
      expect(UserRole.canAccessHostWallet('guest'), isFalse);
      expect(UserRole.canAccessHostWallet(null), isFalse);
      expect(UserRole.canAccessHostWallet(''), isFalse);
      expect(UserRole.canAccessHostWallet('user'), isFalse);
      expect(UserRole.canAccessHostWallet('HOST'), isTrue);
      expect(UserRole.canAccessHostWallet('admin'), isTrue);
    });

    test('Flutter headlines match Phase 8 web consistency helpers', () {
      expect(
        IleBooking.fromJson(<String, dynamic>{
          'id': 'b1',
          'status': 'PENDING_HOST',
          'checkInDate': '2099-01-01',
          'checkOutDate': '2099-01-03',
          'guestCount': 1,
          'totalAmount': 1,
        }).statusHeadline,
        'Waiting for the host',
      );
      expect(
        IleBooking.fromJson(<String, dynamic>{
          'id': 'b2',
          'status': 'PAYMENT_PENDING',
          'checkInDate': '2099-01-01',
          'checkOutDate': '2099-01-03',
          'guestCount': 1,
          'totalAmount': 1,
        }).statusHeadline,
        'Payment waiting',
      );
      expect(
        IleBooking.fromJson(<String, dynamic>{
          'id': 'b3',
          'status': 'CONFIRMED',
          'checkInDate': '2099-01-01',
          'checkOutDate': '2099-01-03',
          'guestCount': 1,
          'totalAmount': 1,
        }).canCancelUnpaid,
        isFalse,
      );
    });
  });
}
