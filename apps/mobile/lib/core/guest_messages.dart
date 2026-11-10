/// Central guest-facing copy for statuses, alerts, cancel dialogs, and CTAs.
/// Never surface raw API enums (PAYMENT_PENDING, REQUESTED) or stack traces.
abstract final class GuestMessages {
  static const String bookNow = 'Request to book';

  static const String confirmingStayHeadline = 'Waiting for the host';
  static const String confirmingStayBody =
      "We've sent your booking request. You'll only pay after the host accepts.";

  static const String acceptedHeadline = 'Your stay has been accepted';
  /// Exact lifecycle badge/label for PAYMENT_PENDING.
  static const String paymentWaitingHeadline = 'Payment waiting';
  static const String paymentWaitingBody =
      'Complete payment before the window ends to confirm your stay.';
  static const String proceedToPayment = 'Proceed to payment';
  static const String completePayment = 'Complete payment';
  static const String confirmed = 'Confirmed';
  static const String completed = 'Completed';
  static const String cancelled = 'Cancelled';
  static const String declined = 'Host declined';
  static const String requestExpiredLabel = 'Request expired';
  static const String paymentWindowClosedLabel = 'Payment window closed';

  static const String unpaidCancelTitle = 'Cancel booking request?';
  static const String unpaidCancelBody =
      'This will cancel the booking request you started. No payment was taken.';
  static const String unpaidCancelKeep = 'Keep request';
  static const String unpaidCancelConfirm = 'Cancel request';

  static const String paidCancelTitle = 'Cancel booking?';
  static const String paidCancelBody =
      'Request cancellation for this confirmed stay. Ilé reviews refunds — you will not trigger a bank refund yourself.';
  static const String paidCancelKeep = 'Keep booking';
  static const String paidCancelConfirm = 'Request cancellation';

  static const String paymentWindowClosed =
      'The payment window ended. This stay is not confirmed.';
  static const String hostDeclined =
      'The host declined this request. No payment was taken.';
  static const String requestExpired =
      'The host did not respond in time. You can search for another stay.';
  static const String latePaymentTitle =
      'Payment received — stay not confirmed';
  static const String latePaymentBody =
      'A payment arrived after this booking was no longer payable. Your stay was not confirmed. Ilé is reviewing a refund — do not pay again.';
  static const String findAnotherStay = 'Find another stay';
  static const String exploreStays = 'Explore stays';

  static const String openingPaystack =
      'Opening secure checkout…';
  static const String paymentVerified =
      'Payment verified. Your stay is confirmed.';
  static const String paymentStillProcessing =
      'Payment is still processing. Pull to refresh — we confirm from the server.';

  static const String emptyTripsTitle = 'No trips yet';
  static const String emptyTripsBody =
      'When you request a stay, it will show up here with its status.';

  static const String genericError = 'Something went wrong. Try again.';

  /// Map backend status → guest language. Never return the raw enum alone.
  static String statusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING_HOST':
      case 'PENDING':
        return confirmingStayHeadline;
      case 'PAYMENT_PENDING':
        return paymentWaitingHeadline;
      case 'CONFIRMED':
        return confirmed;
      case 'COMPLETED':
        return completed;
      case 'CANCELLED':
      case 'FAILED':
        return cancelled;
      default:
        return 'Booking update';
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
      case 'CANCELLED':
      case 'FAILED':
        return 'This booking is no longer active.';
      default:
        return 'Check the details below for the latest update.';
    }
  }

  static String sanitizeAlert(String? raw) {
    if (raw == null || raw.trim().isEmpty) {
      return genericError;
    }
    final String trimmed = raw.trim();
    final String upper = trimmed.toUpperCase();
    if (upper == 'PAYMENT_PENDING') return paymentWaitingHeadline;
    if (upper == 'PENDING_HOST' || upper == 'PENDING') {
      return confirmingStayHeadline;
    }
    if (upper == 'CONFIRMED') return confirmed;
    if (upper == 'COMPLETED') return completed;
    if (upper == 'CANCELLED' || upper == 'FAILED') return cancelled;
    if (upper == 'REQUESTED') {
      return 'Your refund request is with Ilé for review.';
    }
    if (RegExp(r'status\s*[:=]?\s*\d{3}', caseSensitive: false)
            .hasMatch(trimmed) ||
        trimmed.contains('Exception') ||
        trimmed.contains('Stack Trace') ||
        trimmed.startsWith('Error:') ||
        RegExp(r'^[A-Z][A-Z0-9_]{3,}$').hasMatch(trimmed)) {
      return genericError;
    }
    return trimmed;
  }
}
