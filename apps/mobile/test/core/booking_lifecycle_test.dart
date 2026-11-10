import 'package:flutter_test/flutter_test.dart';
import 'package:ile_mobile/core/models/booking.dart';

void main() {
  group('IleBooking Phase 5 lifecycle', () {
    test('normalizeStatus keeps known values and does not invent aliases', () {
      expect(IleBooking.normalizeStatus('pending_host'), 'PENDING_HOST');
      expect(IleBooking.normalizeStatus('PAYMENT_PENDING'), 'PAYMENT_PENDING');
      expect(IleBooking.normalizeStatus(null), 'PENDING');
      expect(
        IleBooking.normalizeStatus('AWAITING_PAYMENT'),
        'AWAITING_PAYMENT',
      );
    });

    test('fromJson maps PENDING_HOST + deadlines from timers', () {
      final IleBooking b = IleBooking.fromJson(<String, dynamic>{
        'id': 'book_1',
        'status': 'PENDING_HOST',
        'checkInDate': '2026-12-01',
        'checkOutDate': '2026-12-03',
        'guestCount': 2,
        'totalAmount': 100000,
        'timers': <String, dynamic>{
          'hostResponseDeadlineAt': DateTime.now()
              .toUtc()
              .add(const Duration(seconds: 90))
              .toIso8601String(),
        },
      });
      expect(b.status, 'PENDING_HOST');
      expect(b.isRequest, isTrue);
      expect(b.isHostPending, isTrue);
      expect(b.canPay, isFalse);
      expect(b.canCancelUnpaid, isTrue);
      expect(b.hostResponseDeadlineAt, isNotNull);
      expect(b.statusHeadline, 'Waiting for the host');
    });

    test('PAYMENT_PENDING is payable; CONFIRMED is not cancellable unpaid', () {
      final IleBooking pay = IleBooking.fromJson(<String, dynamic>{
        'id': 'book_2',
        'bookingStatus': 'PAYMENT_PENDING',
        'checkInDate': '2026-12-10',
        'checkOutDate': '2026-12-12',
        'guestCount': 1,
        'totalPrice': 50000,
        'paymentDeadlineAt': DateTime.now()
            .toUtc()
            .add(const Duration(minutes: 8))
            .toIso8601String(),
      });
      expect(pay.canPay, isTrue);
      expect(pay.isRequest, isTrue);
      expect(pay.statusHeadline, 'Payment is waiting for you.');

      final IleBooking confirmed = IleBooking.fromJson(<String, dynamic>{
        'id': 'book_3',
        'status': 'CONFIRMED',
        'checkInDate': '2027-01-01',
        'checkOutDate': '2027-01-05',
        'guestCount': 2,
        'totalAmount': 200000,
      });
      expect(confirmed.canPay, isFalse);
      expect(confirmed.canCancelUnpaid, isFalse);
      expect(confirmed.isUpcoming, isTrue);
    });

    test('late-pay cancellation copy is not confirmed', () {
      final IleBooking b = IleBooking.fromJson(<String, dynamic>{
        'id': 'book_4',
        'status': 'CANCELLED',
        'cancellationReason': 'LATE_PAYMENT_RECONCILIATION',
        'checkInDate': '2026-12-01',
        'checkOutDate': '2026-12-02',
        'guestCount': 1,
        'totalAmount': 1,
      });
      expect(b.statusBody.toLowerCase(), contains('not a confirmed'));
      expect(b.statusBody.toLowerCase(), contains('admin'));
    });

    test('declined, expired, and guest cancel are distinct and not payable', () {
      IleBooking ended(String reason) {
        return IleBooking.fromJson(<String, dynamic>{
          'id': 'book_end',
          'status': 'CANCELLED',
          'cancellationReason': reason,
          'checkInDate': '2026-12-01',
          'checkOutDate': '2026-12-03',
          'guestCount': 2,
          'totalAmount': 1,
        });
      }

      final IleBooking declined = ended('HOST_DECLINED');
      expect(declined.statusHeadline, 'Host declined');
      expect(declined.canPay, isFalse);

      final IleBooking expired = ended('HOST_WINDOW_EXPIRED');
      expect(expired.statusHeadline, 'Request expired');
      expect(expired.canPay, isFalse);

      final IleBooking cancelled = ended('GUEST_CANCELLED_BEFORE_PAYMENT');
      expect(cancelled.statusHeadline, 'Request cancelled');
      expect(cancelled.statusBody.toLowerCase(), contains('no payment'));
    });

    test('tabs: Requests includes PENDING_HOST', () {
      final IleBooking hostWait = IleBooking.fromJson(<String, dynamic>{
        'id': 'x',
        'status': 'PENDING_HOST',
        'checkInDate': '2026-12-01',
        'checkOutDate': '2026-12-02',
        'guestCount': 1,
        'totalAmount': 1,
      });
      expect(hostWait.isRequest, isTrue);
      expect(hostWait.isUpcoming, isFalse);
      expect(hostWait.isCancelled, isFalse);
    });
  });
}
