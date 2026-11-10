/// Phase 9 guest cancel / refund UI copy — mirrors `src/lib/phase9-cancel-ui.ts`.
class Phase9CancelUi {
  const Phase9CancelUi._();

  static String? guestCancelCtaLabel(String status) {
    if (status == 'PENDING_HOST') return 'Cancel request';
    if (status == 'PAYMENT_PENDING' || status == 'PENDING') {
      return 'Cancel request';
    }
    if (status == 'CONFIRMED' || status == 'COMPLETED') {
      return 'Cancel booking';
    }
    return null;
  }

  static String? guestRefundStatusMessage(String? refundStatus) {
    if (refundStatus == null || refundStatus.isEmpty) return null;
    switch (refundStatus) {
      case 'REQUESTED':
        return 'Refund request pending admin review. Your stay stays confirmed until resolved.';
      case 'APPROVED':
        return 'Refund approved — admin is processing the Paystack refund.';
      case 'REJECTED':
        return 'Refund request was declined by Ilé admin. Contact support if you need help.';
      case 'PROCESSED':
        return 'Refund processed. Funds return via Paystack to your original payment method.';
      default:
        return 'Refund status: $refundStatus';
    }
  }

  static String hostCancelDeferredNotice() {
    return 'Host cancel after confirmation / post-check-in cancel fee schedules are Deferred — admin refund tools remain available for existing REQUESTED→PROCESSED path.';
  }
}
