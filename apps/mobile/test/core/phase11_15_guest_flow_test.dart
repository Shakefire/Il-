import 'package:flutter_test/flutter_test.dart';
import 'package:ile_mobile/core/guest_flow_errors.dart';
import 'package:ile_mobile/core/phase11_guest_outcome.dart';
import 'package:ile_mobile/core/pricing/guest_price_estimate.dart';

void main() {
  test('payment stays locked until PAYMENT_PENDING', () {
    expect(GuestReservationOutcome.paymentUnlocked('PENDING_HOST'), isFalse);
    expect(GuestReservationOutcome.paymentUnlocked('CANCELLED'), isFalse);
    expect(GuestReservationOutcome.paymentUnlocked('CONFIRMED'), isFalse);
    expect(GuestReservationOutcome.paymentUnlocked('PAYMENT_PENDING'), isTrue);
  });

  test('estimate matches Paystack cap and is not a final charge', () {
    final GuestPriceEstimate stay = GuestPriceEstimate.fromNightly(
      nightlyRate: 45000,
      nights: 3,
    );
    expect(stay.accommodationSubtotal, 135000);
    expect(stay.processingFee, 2000);
    expect(stay.estimatedTotal, 137000);
    expect(stay.isFinalPayable, isFalse);
    expect(reviewNoPaymentCopy, contains('No payment yet'));
    expect(reviewNoPaymentCopy.toLowerCase(), contains('after the host accepts'));
    expect(reviewNoPaymentCopy.toLowerCase(), isNot(contains('do not need to accept')));
  });

  test('guest flow errors name the failure', () {
    expect(
      GuestFlowError.from(Exception('SocketException: Failed host lookup')).title,
      'No internet',
    );
    expect(
      GuestFlowError.from('Guest count (6) exceeds property maximum of 4.').title,
      'Guest count exceeds capacity',
    );
    expect(
      GuestFlowError.from('Those dates are not available.', surface: 'request').title,
      'Property unavailable',
    );
    expect(
      GuestFlowError.from('Failed to initialize payment gateway.', surface: 'payment').title,
      'Payment initialization failure',
    );
  });
}
