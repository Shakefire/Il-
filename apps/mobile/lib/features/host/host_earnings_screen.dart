import 'package:flutter/material.dart';

import 'host_wallet_screen.dart';

/// Earnings tab — FinanceService wallet projection + withdraw submit.
class HostEarningsScreen extends StatelessWidget {
  const HostEarningsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const HostWalletScreen(embedded: true);
  }
}
