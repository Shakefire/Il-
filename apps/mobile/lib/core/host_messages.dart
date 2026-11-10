/// Central host-facing copy. Prefer hospitality language over KYC/ledger jargon.
abstract final class HostMessages {
  static const String overviewTitle = 'Your listings and earnings';
  static const String overviewBody =
      'Guest list prices include Ilé’s platform fee. Your earnings use the host amount saved on each confirmed stay.';

  static const String respondNow = 'Respond now';
  static const String manageListings = 'Manage listings';
  static const String identityStatus = 'Identity verification';
  static const String availableToWithdraw = 'Available to withdraw';
  static const String readyToWithdraw = 'Ready to withdraw';
  static const String lifetimeEarnings = 'Lifetime earnings (confirmed)';
  static const String pendingHeld = 'Held for settlement';
  static const String transferring = 'Transfer in progress';
  static const String paidToBank = 'Paid to your bank';

  static const String noPayoutsTitle = 'No payouts yet';
  static const String noPayoutsBody =
      'After a stay is confirmed and settlement rules are met, your host earnings appear here. Held amounts are not yet ready to withdraw.';

  static const String noRequestsTitle = 'No open requests';
  static const String noRequestsBody =
      'When a guest requests your stay, you’ll have a short window to accept or decline.';

  static const String noListingsTitle = 'No listings yet';
  static const String noListingsBody =
      'Create a listing after identity verification. Publish is allowed only when Ilé marks you verified.';

  static const String bankRequiredTitle = 'Add a payout bank account';
  static const String bankRequiredBody =
      'Withdrawals need a verified Nigerian bank account. Saving an account does not send money by itself.';

  static const String shellGateTitle = 'Finish host verification';
  static const String shellGateBody =
      'Complete identity verification to manage listings, booking requests, and earnings.';

  static const String walletUnavailableTitle = 'Earnings unavailable';
  static const String walletUnavailableBody =
      'Earnings and withdrawals are only available for verified host accounts.';

  static const String walletExplainer =
      'Balances come from your payout records. Guest payments and host amounts are calculated on the server — held funds are not withdrawable yet.';

  static String bookingStatusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'PENDING_HOST':
      case 'PENDING':
        return 'Waiting for your response';
      case 'PAYMENT_PENDING':
        return 'Waiting for guest payment';
      case 'CONFIRMED':
        return 'Confirmed';
      case 'COMPLETED':
        return 'Completed';
      case 'CANCELLED':
      case 'FAILED':
        return 'Cancelled';
      case 'ALL':
        return 'All';
      default:
        return 'Booking update';
    }
  }

  static String listingStatusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'PUBLISHED':
        return 'Published';
      case 'DRAFT':
        return 'Draft';
      case 'PENDING_REVIEW':
        return 'Under review';
      case 'REJECTED':
        return 'Needs changes';
      case 'SUSPENDED':
      case 'ARCHIVED':
        return 'Unavailable';
      default:
        return 'Listing update';
    }
  }

  static String payoutStatusLabel(String status) {
    switch (status.toUpperCase()) {
      case 'HELD':
      case 'SCHEDULED':
        return pendingHeld;
      case 'READY_FOR_PAYOUT':
        return readyToWithdraw;
      case 'PROCESSING':
        return transferring;
      case 'PAID':
      case 'DISBURSED':
        return paidToBank;
      case 'FAILED':
        return 'Transfer failed — contact support';
      case 'CANCELLED':
      case 'REVERSED':
        return 'Payout cancelled';
      default:
        return 'Payout update';
    }
  }

  static String verificationLabel(String status) {
    switch (status.toUpperCase()) {
      case 'APPROVED':
        return 'Verified host';
      case 'UNDER_REVIEW':
        return 'Identity under review';
      case 'REJECTED':
      case 'NEEDS_MORE_INFO':
        return 'More information needed';
      case 'NOT_STARTED':
      case 'REGISTERED':
      case 'PROFILE_COMPLETED':
        return 'Identity verification incomplete';
      default:
        return identityStatus;
    }
  }
}
