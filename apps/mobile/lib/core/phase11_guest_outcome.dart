/// Guest-facing labels for live booking statuses.
/// Mirrors `src/lib/phase11-guest-outcome.ts`. Does not rename API statuses.
class GuestReservationOutcome {
  const GuestReservationOutcome({
    required this.kind,
    required this.headline,
    required this.body,
    required this.paymentAvailable,
  });

  final String kind;
  final String headline;
  final String body;

  /// True only when status is PAYMENT_PENDING.
  final bool paymentAvailable;

  static bool paymentUnlocked(String? status) => status == 'PAYMENT_PENDING';

  static GuestReservationOutcome resolve({
    required String status,
    String? cancellationReason,
    String? hostResponse,
  }) {
    final String normalized = status.toUpperCase();
    if (normalized == 'PENDING_HOST' || normalized == 'PENDING') {
      return const GuestReservationOutcome(
        kind: 'waiting_host',
        headline: 'Waiting for the host',
        body: "We've sent your booking request to the host.",
        paymentAvailable: false,
      );
    }
    if (normalized == 'PAYMENT_PENDING') {
      return const GuestReservationOutcome(
        kind: 'payment_due',
        headline: 'Payment is waiting for you.',
        body:
            'Your stay has been accepted! Complete payment before the window ends.',
        paymentAvailable: true,
      );
    }
    if (normalized == 'CONFIRMED') {
      return const GuestReservationOutcome(
        kind: 'confirmed',
        headline: 'Confirmed',
        body: 'Payment verified. Arrival details unlock for confirmed stays.',
        paymentAvailable: false,
      );
    }
    if (normalized == 'COMPLETED') {
      return const GuestReservationOutcome(
        kind: 'completed',
        headline: 'Completed',
        body: 'Thank you for staying with Ilé.',
        paymentAvailable: false,
      );
    }
    if (normalized == 'CANCELLED' || normalized == 'FAILED') {
      final String reason =
          '${cancellationReason ?? ''} ${hostResponse ?? ''}'.toUpperCase();
      if (reason.contains('LATE_PAYMENT_RECONCILIATION')) {
        return const GuestReservationOutcome(
          kind: 'late_reconciliation',
          headline: 'Payment window closed',
          body:
              'This hold closed after the payment window. Late payment reconciliation is handled by Ilé admin — this is not a confirmed stay.',
          paymentAvailable: false,
        );
      }
      if (reason.contains('PAYMENT_WINDOW_EXPIRED')) {
        return const GuestReservationOutcome(
          kind: 'payment_expired',
          headline: 'Payment window closed',
          body:
              'The payment window ended before Paystack verified a payment. This is not a confirmed stay.',
          paymentAvailable: false,
        );
      }
      if (reason.contains('HOST_WINDOW_EXPIRED') || reason.contains('EXPIRED')) {
        return const GuestReservationOutcome(
          kind: 'request_expired',
          headline: 'Request expired',
          body:
              'The host did not respond in time. You can search for another stay.',
          paymentAvailable: false,
        );
      }
      if (reason.contains('HOST_DECLINED') || reason.contains('DECLINED')) {
        return const GuestReservationOutcome(
          kind: 'declined',
          headline: 'Host declined',
          body:
              'The host declined this request. No payment was taken. Search again when you are ready.',
          paymentAvailable: false,
        );
      }
      if (reason.contains('SUPERSEDED')) {
        return const GuestReservationOutcome(
          kind: 'superseded',
          headline: 'Request replaced',
          body:
              'This unpaid request was replaced by a newer one from you. No payment was taken.',
          paymentAvailable: false,
        );
      }
      if (reason.contains('GUEST_CANCELLED')) {
        return const GuestReservationOutcome(
          kind: 'guest_cancelled',
          headline: 'Request cancelled',
          body: 'You cancelled this unpaid request. No payment was taken.',
          paymentAvailable: false,
        );
      }
      return const GuestReservationOutcome(
        kind: 'cancelled',
        headline: 'Cancelled',
        body:
            'This reservation was cancelled. No new charge was created from this screen.',
        paymentAvailable: false,
      );
    }
    return GuestReservationOutcome(
      kind: 'other',
      headline: normalized.isEmpty ? 'Reservation' : normalized,
      body: 'Status from server: ${normalized.isEmpty ? 'unknown' : normalized}.',
      paymentAvailable: false,
    );
  }
}
