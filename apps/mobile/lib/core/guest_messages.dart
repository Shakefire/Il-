/// Central guest-facing copy for statuses, alerts, cancel dialogs, and CTAs.
/// Never surface raw API enums (PAYMENT_PENDING, REQUESTED) or stack traces.
abstract final class GuestMessages {
  static const String bookNow = 'Book Now';

  static const String confirmingStayHeadline = 'Waiting for the host';
  static const String confirmingStayBody =
      "We've sent your booking request. Payment unlocks only after the host accepts.";

  static const String acceptedHeadline = 'Your stay has been accepted!';
  static const String paymentWaitingHeadline = 'Payment is waiting for you.';
  static const String paymentWaitingBody =
      'Complete payment before the window ends to confirm your stay.';

  static const String unpaidCancelTitle = 'Cancel booking request?';
  static const String unpaidCancelBody =
      'This will cancel the booking request you started.';
  static const String unpaidCancelKeep = 'Keep request';
  static const String unpaidCancelConfirm = 'Cancel request';

  static const String paidCancelTitle = 'Cancel booking?';
  static const String paidCancelBody =
      'Are you sure you want to cancel this booking?';
  static const String paidCancelKeep = 'Keep booking';
  static const String paidCancelConfirm = 'Cancel booking';

  static const String paymentWindowClosed =
      'The payment window ended. This stay is not confirmed.';
  static const String hostDeclined =
      'The host declined this request. No payment was taken.';
  static const String requestExpired =
      'The host did not respond in time. You can search for another stay.';
  static const String findAnotherStay = 'Find another stay';

  static const String openingPaystack =
      'Opening secure Paystack checkout…';
  static const String paymentVerified =
      'Payment verified. Your stay is confirmed.';
  static const String paymentStillProcessing =
      'Payment is still processing. Pull to refresh — we confirm from the server.';

  /// Map backend status → guest language. Never return the raw enum alone.
  static String statusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING_HOST':
      case 'PENDING':
        return confirmingStayHeadline;
      case 'PAYMENT_PENDING':
        return paymentWaitingHeadline;
      case 'CONFIRMED':
        return 'Confirmed';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
      case 'FAILED':
        return 'Cancelled';
      default:
        return 'Reservation update';
    }
  }

  static String statusDetail(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING_HOST':
      case 'PENDING':
        return confirmingStayBody;
      case 'PAYMENT_PENDING':
        return paymentWaitingBody;
      case 'CONFIRMED':
        return 'Payment verified. Arrival details unlock for confirmed stays.';
      case 'COMPLETED':
        return 'Thank you for staying with Ilé.';
      default:
        return 'Check the details below for the latest update.';
    }
  }

  static String sanitizeAlert(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return 'Something went wrong. Try again.';
    }
    final String trimmed = raw.trim();
    final String upper = trimmed.toUpperCase();
    if (upper == 'PAYMENT_PENDING') return paymentWaitingHeadline;
    if (upper == 'PENDING_HOST' || upper == 'PENDING') {
      return confirmingStayHeadline;
    }
    if (upper == 'REQUESTED') {
      return 'Your refund request is with Ilé admin for review.';
    }
    if (RegExp(r'status\s*[:=]?\s*\d{3}', caseSensitive: false)
            .hasMatch(trimmed) ||
        trimmed.contains('Exception') ||
        trimmed.contains('Stack Trace') ||
        trimmed.startsWith('Error:')) {
      return 'Something went wrong. Try again.';
    }
    return trimmed;
  }
}
