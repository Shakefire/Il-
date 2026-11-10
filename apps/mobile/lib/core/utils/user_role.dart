/// Role helpers for guest-safe UI gating.
///
/// Unknown / missing roles default to guest (no host wallet / payouts).
abstract final class UserRole {
  static String normalize(Object? raw) {
    if (raw is! String) return 'guest';
    final String value = raw.trim().toLowerCase();
    if (value.isEmpty) return 'guest';
    return value;
  }

  /// Host wallet / earnings / withdraw are host-dashboard only.
  static bool canAccessHostWallet(Object? rawRole) {
    final String role = normalize(rawRole);
    return role == 'host' || role == 'admin';
  }
}
