import 'package:flutter_test/flutter_test.dart';
import 'package:ile_mobile/core/host_messages.dart';

void main() {
  group('HostMessages', () {
    test('maps booking enums to host hospitality labels', () {
      expect(
        HostMessages.bookingStatusLabel('PENDING_HOST'),
        'Waiting for your response',
      );
      expect(
        HostMessages.bookingStatusLabel('PAYMENT_PENDING'),
        'Waiting for guest payment',
      );
      expect(HostMessages.bookingStatusLabel('CONFIRMED'), 'Confirmed');
      expect(
        HostMessages.bookingStatusLabel('PENDING_HOST'),
        isNot(contains('PENDING_HOST')),
      );
    });

    test('maps payout enums — held never reads as withdrawable', () {
      expect(HostMessages.payoutStatusLabel('HELD'), 'Held for settlement');
      expect(
        HostMessages.payoutStatusLabel('READY_FOR_PAYOUT'),
        'Ready to withdraw',
      );
      expect(
        HostMessages.payoutStatusLabel('PROCESSING'),
        'Transfer in progress',
      );
      expect(HostMessages.payoutStatusLabel('PAID'), 'Paid to your bank');
      expect(HostMessages.payoutStatusLabel('DISBURSED'), 'Paid to your bank');
      expect(HostMessages.payoutStatusLabel('HELD'), isNot(contains('Ready')));
      expect(
        HostMessages.payoutStatusLabel('READY_FOR_PAYOUT'),
        isNot(contains('READY_FOR')),
      );
    });

    test('verification labels avoid KYC jargon', () {
      expect(
        HostMessages.verificationLabel('UNDER_REVIEW'),
        'Identity under review',
      );
      expect(HostMessages.verificationLabel('APPROVED'), 'Verified host');
      expect(HostMessages.identityStatus.toLowerCase(), isNot(contains('kyc')));
    });
  });
}
