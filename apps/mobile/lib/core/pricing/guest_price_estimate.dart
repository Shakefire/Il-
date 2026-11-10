/// Display-only stay estimate. Mirrors `calculatePaystackFee` in src/lib/utils.ts.
/// Final payable amount is the server `totalAmount` after the request is created.
/// Platform commission is intentionally omitted.
const String reviewNoPaymentCopy =
    'No payment yet. You only pay after the host accepts. This total is an estimate until your request is created.';

class GuestPriceEstimate {
  const GuestPriceEstimate({
    required this.nightlyRate,
    required this.nights,
    required this.accommodationSubtotal,
    required this.processingFee,
    required this.estimatedTotal,
  });

  final int nightlyRate;
  final int nights;
  final int accommodationSubtotal;
  final int processingFee;
  final int estimatedTotal;

  /// Always false: this object is never the charge amount.
  bool get isFinalPayable => false;

  static int paystackFee(int subtotal) {
    if (subtotal <= 0) return 0;
    final int fee;
    if (subtotal < 2500) {
      fee = (subtotal / 0.985).ceil() - subtotal;
    } else {
      fee = ((subtotal + 100) / 0.985).ceil() - subtotal;
    }
    return fee > 2000 ? 2000 : fee;
  }

  static GuestPriceEstimate fromNightly({
    required int nightlyRate,
    required int nights,
  }) {
    final int safeNightly = nightlyRate < 0 ? 0 : nightlyRate;
    final int safeNights = nights < 0 ? 0 : nights;
    final int subtotal = safeNightly * safeNights;
    final int fee = paystackFee(subtotal);
    return GuestPriceEstimate(
      nightlyRate: safeNightly,
      nights: safeNights,
      accommodationSubtotal: subtotal,
      processingFee: fee,
      estimatedTotal: subtotal + fee,
    );
  }
}
