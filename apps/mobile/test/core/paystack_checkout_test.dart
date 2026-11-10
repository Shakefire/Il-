import 'package:flutter_test/flutter_test.dart';
import 'package:ile_mobile/core/payments/paystack_checkout.dart';

void main() {
  group('PaystackCheckout allowlist', () {
    test('allows Paystack checkout hosts', () {
      expect(PaystackCheckout.isAllowedHost('checkout.paystack.com'), isTrue);
      expect(PaystackCheckout.isAllowedHost('standard.paystack.co'), isTrue);
      expect(PaystackCheckout.isAllowedHost('js.paystack.co'), isTrue);
    });

    test('allows Ilé return hosts and blocks random domains', () {
      expect(PaystackCheckout.isAllowedHost('ilestays.ng'), isTrue);
      expect(PaystackCheckout.isAllowedHost('www.ilestays.ng'), isTrue);
      expect(PaystackCheckout.isAllowedHost('evil.example'), isFalse);
      expect(PaystackCheckout.isAllowedHost(null), isFalse);
    });

    test('detects payment return URLs and extracts refs', () {
      final Uri success = Uri.parse(
        'https://ilestays.ng/trips?payment=success&ref=ILE_abc123',
      );
      expect(PaystackCheckout.isPaymentReturnUrl(success), isTrue);
      expect(PaystackCheckout.extractReference(success), 'ILE_abc123');

      final Uri mock = Uri.parse(
        'http://localhost:3000/trips?payment=mock&reference=ref_1',
      );
      expect(PaystackCheckout.isPaymentReturnUrl(mock), isTrue);
      expect(PaystackCheckout.extractReference(mock), 'ref_1');

      final Uri unrelated = Uri.parse('https://checkout.paystack.com/pay/xyz');
      expect(PaystackCheckout.isPaymentReturnUrl(unrelated), isFalse);
    });

    test('validates authorization URLs', () {
      expect(
        PaystackCheckout.isValidAuthorizationUrl(
          'https://checkout.paystack.com/c/xyz',
        ),
        isTrue,
      );
      expect(
        PaystackCheckout.isValidAuthorizationUrl(
          'https://evil.example/pay',
        ),
        isFalse,
      );
      expect(PaystackCheckout.isValidAuthorizationUrl(''), isFalse);
    });
  });
}
