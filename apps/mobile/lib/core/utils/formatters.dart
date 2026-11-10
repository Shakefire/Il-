/// Shared presentation helpers (no network / persistence).
abstract final class IleFormatters {
  /// Formats an integer amount with thousands separators (e.g. 180000 → 180,000).
  static String formatInteger(num value) {
    final String raw = value.round().toString();
    final StringBuffer buffer = StringBuffer();
    for (int i = 0; i < raw.length; i++) {
      final int reverseIndex = raw.length - i;
      buffer.write(raw[i]);
      if (reverseIndex > 1 && reverseIndex % 3 == 1) {
        buffer.write(',');
      }
    }
    return buffer.toString();
  }
}
