import 'api/api_client.dart';

/// Guest-facing error titles for booking-journey screens.
/// Mirrors `src/lib/phase13-guest-errors.ts`.
class GuestFlowError {
  const GuestFlowError({required this.title, required this.message});

  final String title;
  final String message;

  static GuestFlowError from(Object error, {String surface = 'generic'}) {
    final int? status = error is ApiException ? error.statusCode : null;
    final String raw = error is ApiException ? error.message : error.toString();
    final String lower = raw.toLowerCase();

    if (_isOffline(lower)) {
      return const GuestFlowError(
        title: 'No internet',
        message: 'Check your connection and try again.',
      );
    }
    if (status == 401 || status == 403 || lower.contains('sign in')) {
      return const GuestFlowError(
        title: 'Authentication required',
        message:
            'Sign in to continue. Public stays stay browsable without an account.',
      );
    }
    if (lower.contains('guest count') ||
        lower.contains('exceeds') ||
        lower.contains('maximum of') ||
        lower.contains('allows up to')) {
      return GuestFlowError(
        title: 'Guest count exceeds capacity',
        message: raw.isEmpty ? 'Choose fewer guests than this stay allows.' : raw,
      );
    }
    if (lower.contains('minimum stay') ||
        lower.contains('check-in') ||
        lower.contains('check-out') ||
        (lower.contains('invalid') && lower.contains('date'))) {
      return GuestFlowError(
        title: 'Invalid dates',
        message: raw.isEmpty ? 'Choose a check-out after check-in.' : raw,
      );
    }
    if (lower.contains('not available') ||
        lower.contains('date_conflict') ||
        lower.contains('conflict')) {
      return GuestFlowError(
        title: 'Property unavailable',
        message: raw.isEmpty ? 'Those dates are no longer available.' : raw,
      );
    }
    if (lower.contains('host response window') ||
        lower.contains('host_window_expired')) {
      return GuestFlowError(
        title: 'Request expired',
        message: raw.isEmpty
            ? 'The host response window ended. Send a new request if you still want these dates.'
            : raw,
      );
    }
    if (surface == 'payment' ||
        lower.contains('paystack') ||
        lower.contains('payment')) {
      if (lower.contains('pending') || lower.contains('processing')) {
        return GuestFlowError(
          title: 'Payment verification pending',
          message: raw.isEmpty
              ? 'Paystack has not confirmed this payment yet. Do not start a second charge.'
              : raw,
        );
      }
      return GuestFlowError(
        title: 'Payment initialization failure',
        message: raw.isEmpty
            ? 'Payment could not be started. Your reservation was not marked confirmed.'
            : raw,
      );
    }
    if (surface == 'request') {
      return GuestFlowError(
        title: 'Host request failed',
        message: raw.isEmpty
            ? 'The reservation request was not sent. No charge was created.'
            : raw,
      );
    }
    if (surface == 'search') {
      return GuestFlowError(
        title: 'Search failed',
        message: raw.isEmpty ? 'Search could not be completed. Try again.' : raw,
      );
    }
    if (surface == 'property') {
      return GuestFlowError(
        title: 'Couldn’t load stay',
        message: raw.isEmpty ? 'This listing could not be loaded.' : raw,
      );
    }
    return GuestFlowError(
      title: 'Unexpected error',
      message: raw.isEmpty ? 'Something went wrong. Try again.' : raw,
    );
  }

  static bool _isOffline(String lower) {
    return lower.contains('socketexception') ||
        lower.contains('clientexception') ||
        lower.contains('failed host lookup') ||
        lower.contains('network') ||
        lower.contains('timed out') ||
        lower.contains('timeout') ||
        lower.contains('connection refused') ||
        lower.contains('connection reset');
  }
}
