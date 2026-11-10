import 'package:flutter_test/flutter_test.dart';
import 'package:ile_mobile/core/guest_messages.dart';

void main() {
  group('GuestMessages', () {
    test('never surfaces raw PAYMENT_PENDING to guests', () {
      expect(
        GuestMessages.statusLabel('PAYMENT_PENDING'),
        GuestMessages.paymentWaitingHeadline,
      );
      expect(GuestMessages.statusLabel('PAYMENT_PENDING'), 'Payment waiting');
      expect(
        GuestMessages.statusLabel('PAYMENT_PENDING'),
        isNot(contains('PAYMENT_PENDING')),
      );
      expect(
        GuestMessages.sanitizeAlert('PAYMENT_PENDING'),
        GuestMessages.paymentWaitingHeadline,
      );
    });

    test('exact lifecycle labels match product language', () {
      expect(
        GuestMessages.statusLabel('PENDING_HOST'),
        'Waiting for the host',
      );
      expect(GuestMessages.statusLabel('CONFIRMED'), 'Confirmed');
      expect(GuestMessages.statusLabel('COMPLETED'), 'Completed');
      expect(GuestMessages.statusLabel('CANCELLED'), 'Cancelled');
    });

    test('cancel dialog copy stays short', () {
      expect(
        GuestMessages.unpaidCancelBody.toLowerCase(),
        isNot(contains('date hold')),
      );
      expect(
        GuestMessages.unpaidCancelBody.toLowerCase(),
        isNot(contains('inventory')),
      );
      expect(GuestMessages.bookNow, 'Request to book');
    });

    test('scrubs stack-like alerts', () {
      expect(
        GuestMessages.sanitizeAlert('Error: Exception status 500'),
        'Something went wrong. Try again.',
      );
    });
  });
}
