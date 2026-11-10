/// Legacy UI timing helpers. Auth screens now call the real Fastify APIs.
/// Kept only so older tests/docs that reference [mockLatency] still compile.
@Deprecated('Use real IleApi auth endpoints; do not mock credentials in production UI')
abstract final class MockAuth {
  static const String mockOtp = '000000';
  static const Duration mockLatency = Duration(milliseconds: 100);
  static const Duration skeletonDemoDuration = Duration(milliseconds: 1400);
  static const int otpResendSeconds = 60;
}
