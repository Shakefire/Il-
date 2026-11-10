import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../app/app_colors.dart';
import '../../app/app_typography.dart';
import '../../core/api/ile_api.dart';
import '../../core/guest_messages.dart';
import '../../core/payments/paystack_checkout.dart';
import '../../shared/widgets/ile_circular_back_button.dart';

/// In-app Paystack checkout — never uses an external browser.
/// Success is only claimed after Fastify `verifyPayment`.
class PaystackCheckoutScreen extends StatefulWidget {
  const PaystackCheckoutScreen({
    super.key,
    required this.authorizationUrl,
    this.expectedReference,
  });

  final String authorizationUrl;
  final String? expectedReference;

  @override
  State<PaystackCheckoutScreen> createState() => _PaystackCheckoutScreenState();
}

class _PaystackCheckoutScreenState extends State<PaystackCheckoutScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  bool _verifying = false;
  bool _hasLoadError = false;
  String? _banner;
  bool _finished = false;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(AppColors.background)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) {
            if (mounted) setState(() => _loading = true);
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onWebResourceError: (WebResourceError error) {
            if (!mounted || _finished) return;
            setState(() {
              _banner =
                  'Checkout connection issue. Tap Retry below — your booking was not duplicated.';
              _loading = false;
              _hasLoadError = true;
            });
          },
          onNavigationRequest: (NavigationRequest request) {
            return _handleNavigation(request.url);
          },
        ),
      );
    final Uri? start = Uri.tryParse(widget.authorizationUrl);
    if (start == null || !PaystackCheckout.isValidAuthorizationUrl(widget.authorizationUrl)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _finish(
          PaystackCheckoutResult(
            outcome: PaystackCheckoutOutcome.failed,
            message: 'Invalid Paystack checkout URL.',
          ),
        );
      });
      return;
    }
    _controller.loadRequest(start);
  }

  NavigationDecision _handleNavigation(String url) {
    final Uri? uri = Uri.tryParse(url);
    if (uri == null) return NavigationDecision.prevent;
    if (!PaystackCheckout.isAllowedHost(uri.host)) {
      setState(() {
        _banner = 'Blocked a non-Paystack destination for your safety.';
      });
      return NavigationDecision.prevent;
    }
    if (PaystackCheckout.isPaymentReturnUrl(uri)) {
      final String? ref = PaystackCheckout.extractReference(uri) ??
          widget.expectedReference;
      if (ref != null && ref.isNotEmpty) {
        _verifyAndFinish(ref);
      } else {
        _finish(
          const PaystackCheckoutResult(
            outcome: PaystackCheckoutOutcome.pending,
            message: GuestMessages.paymentStillProcessing,
          ),
        );
      }
      return NavigationDecision.prevent;
    }
    return NavigationDecision.navigate;
  }

  Future<void> _verifyAndFinish(String reference) async {
    if (_verifying || _finished) return;
    setState(() {
      _verifying = true;
      _banner = 'Confirming payment with Ilé…';
    });
    try {
      final Map<String, dynamic> verified =
          await context.read<IleApi>().verifyPayment(reference);
      if (!mounted) return;
      if (verified['verified'] == true) {
        final bool late = verified['reconciliationRequired'] == true ||
            verified['resolutionPending'] == true ||
            verified['bookingConfirmed'] == false;
        _finish(
          PaystackCheckoutResult(
            outcome: late
                ? PaystackCheckoutOutcome.pending
                : PaystackCheckoutOutcome.verified,
            reference: reference,
            message: late
                ? 'Payment recorded — admin resolution may be required. Stay not auto-confirmed.'
                : GuestMessages.paymentVerified,
          ),
        );
        return;
      }
      if (verified['pending'] == true || verified['status'] == 'pending') {
        _finish(
          PaystackCheckoutResult(
            outcome: PaystackCheckoutOutcome.pending,
            reference: reference,
            message: GuestMessages.paymentStillProcessing,
          ),
        );
        return;
      }
      _finish(
        PaystackCheckoutResult(
          outcome: PaystackCheckoutOutcome.failed,
          reference: reference,
          message: GuestMessages.sanitizeAlert(
            verified['error']?.toString() ??
                'Payment not verified yet. Refresh your reservation.',
          ),
        ),
      );
    } catch (_) {
      if (!mounted) return;
      _finish(
        PaystackCheckoutResult(
          outcome: PaystackCheckoutOutcome.pending,
          reference: reference,
          message: GuestMessages.paymentStillProcessing,
        ),
      );
    }
  }

  void _finish(PaystackCheckoutResult result) {
    if (_finished || !mounted) return;
    _finished = true;
    Navigator.of(context).pop(result);
  }

  void _handleClose() {
    _finish(
      PaystackCheckoutResult(
        outcome: PaystackCheckoutOutcome.dismissed,
        reference: widget.expectedReference,
        message:
            'Checkout closed. If you paid, we still confirm from the server — refresh this reservation.',
      ),
    );
  }

  void _handleRetryLoad() {
    if (_finished || _verifying) return;
    final Uri? start = Uri.tryParse(widget.authorizationUrl);
    if (start == null) return;
    setState(() {
      _hasLoadError = false;
      _banner = null;
      _loading = true;
    });
    _controller.loadRequest(start);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (bool didPop, Object? result) {
        if (didPop) return;
        _handleClose();
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.background,
          elevation: 0,
          leading: IleCircularBackButton(onPressed: _handleClose),
          title: Text(
            'Secure payment',
            style: AppTypography.cardTitle,
          ),
          actions: [
            if (_verifying)
              const Padding(
                padding: EdgeInsets.only(right: 16),
                child: Center(
                  child: SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              ),
          ],
        ),
        body: Column(
          children: [
            if (_banner != null)
              Material(
                color: AppColors.warningBg,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 10,
                  ),
                  child: Text(
                    _banner!,
                    style: AppTypography.caption.copyWith(
                      color: AppColors.warningText,
                    ),
                  ),
                ),
              ),
            if (_loading) const LinearProgressIndicator(minHeight: 2),
            Expanded(
              child: WebViewWidget(controller: _controller),
            ),
            if (_hasLoadError)
              SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton(
                      onPressed: _handleRetryLoad,
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.buttonPrimary,
                        foregroundColor: AppColors.onDark,
                      ),
                      child: const Text('Retry checkout'),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
