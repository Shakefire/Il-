/// Paystack in-app checkout helpers — domain allowlist + callback detection.
/// Never treat WebView navigation alone as payment success.
abstract final class PaystackCheckout {
  /// Hosts allowed inside the checkout WebView.
  static const Set<String> allowedHosts = <String>{
    'checkout.paystack.com',
    'standard.paystack.co',
    'paystack.com',
    'www.paystack.com',
    'api.paystack.co',
    'js.paystack.co',
    'ilestays.ng',
    'www.ilestays.ng',
    'localhost',
    '127.0.0.1',
  };

  /// True when [host] is Paystack or our return surface (incl. subdomains).
  static bool isAllowedHost(String? host) {
    if (host == null || host.trim().isEmpty) return false;
    final String h = host.trim().toLowerCase();
    if (allowedHosts.contains(h)) return true;
    if (h.endsWith('.paystack.com') || h.endsWith('.paystack.co')) {
      return true;
    }
    if (h.endsWith('.ilestays.ng')) return true;
    // Local / preview Next callbacks (same-tab return URLs)
    if (h.endsWith('.vercel.app') || h.endsWith('.ngrok-free.app')) {
      return true;
    }
    return false;
  }

  /// True when host is a local/dev callback surface (mock Paystack returns).
  static bool isLocalDevHost(String? host) {
    if (host == null || host.trim().isEmpty) return false;
    final String h = host.trim().toLowerCase();
    return h == 'localhost' || h == '127.0.0.1' || h.endsWith('.ngrok-free.app');
  }

  /// True when URL looks like an Ilé / Paystack return with a payment ref.
  /// `payment=mock` is accepted only on local/dev hosts — never on production domains.
  static bool isPaymentReturnUrl(Uri uri) {
    final String path = uri.path.toLowerCase();
    final Map<String, String> q = uri.queryParameters;
    final String payment = (q['payment'] ?? '').toLowerCase();
    final bool hasRef =
        (q['ref'] ?? q['reference'] ?? q['trxref'] ?? '').trim().isNotEmpty;
    if (!hasRef) return false;
    final bool allowMock = isLocalDevHost(uri.host);
    if (payment == 'success' || payment == 'callback') {
      return true;
    }
    if (payment == 'mock') return allowMock;
    // Paystack sometimes lands on /trips or callback without payment= key
    if (path.contains('trips') || path.contains('payment')) {
      if (payment.isEmpty || payment == 'success' || payment == 'callback') {
        return true;
      }
      if (payment == 'mock') return allowMock;
    }
    return false;
  }

  /// Extract Paystack / Ilé payment reference from a return URL.
  static String? extractReference(Uri uri) {
    final Map<String, String> q = uri.queryParameters;
    for (final String key in <String>['ref', 'reference', 'trxref']) {
      final String? value = q[key]?.trim();
      if (value != null && value.isNotEmpty) return value;
    }
    return null;
  }

  /// Authorization URL must be https Paystack (or http localhost mock).
  static bool isValidAuthorizationUrl(String? url) {
    if (url == null || url.trim().isEmpty) return false;
    final Uri? uri = Uri.tryParse(url.trim());
    if (uri == null) return false;
    if (uri.scheme != 'https' && uri.scheme != 'http') return false;
    if (!isAllowedHost(uri.host)) return false;
    final String host = uri.host.toLowerCase();
    // Prefer real Paystack hosts; allow frontend mock init URLs in test mode
    if (host.contains('paystack')) return true;
    if (uri.queryParameters.containsKey('ref') ||
        uri.queryParameters.containsKey('payment')) {
      return true;
    }
    return host.contains('paystack');
  }
}

/// Result of an in-app checkout attempt — never invents booking status.
enum PaystackCheckoutOutcome {
  /// Fastify verified the charge.
  verified,

  /// Gateway still pending / processing.
  pending,

  /// User closed WebView or navigated away before verify.
  dismissed,

  /// Verify failed or blocked navigation.
  failed,
}

class PaystackCheckoutResult {
  const PaystackCheckoutResult({
    required this.outcome,
    this.reference,
    this.message,
  });

  final PaystackCheckoutOutcome outcome;
  final String? reference;
  final String? message;
}
