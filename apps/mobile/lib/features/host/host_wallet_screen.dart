import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/user_role.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';
import 'host_chrome.dart';

/// Host wallet — projection of payout statuses (HELD / READY / PROCESSING / PAID).
class HostWalletScreen extends StatefulWidget {
  const HostWalletScreen({
    super.key,
    this.embedded = false,
  });

  /// When true (Earnings tab), hide back button and use Host chrome title.
  final bool embedded;

  @override
  State<HostWalletScreen> createState() => _HostWalletScreenState();
}

class _HostWalletScreenState extends State<HostWalletScreen> {
  bool _loading = true;
  bool _withdrawing = false;
  bool _isHost = false;
  String? _error;
  String? _notice;
  Map<String, dynamic>? _wallet;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final IleApi api = context.read<IleApi>();
      final Map<String, dynamic>? user = await api.getCurrentUser();
      final bool allowed = UserRole.canAccessHostWallet(user?['role']);
      if (!mounted) return;
      if (!allowed) {
        setState(() {
          _isHost = false;
          _wallet = null;
          _loading = false;
          _error = null;
        });
        return;
      }
      final List<dynamic> results = await Future.wait(<Future<dynamic>>[
        api.getHostWallet(),
        api.getHostPayouts(),
      ]);
      if (!mounted) return;
      final Map<String, dynamic> res =
          Map<String, dynamic>.from(results[0] as Map);
      final Map<String, dynamic> wallet = res['wallet'] is Map
          ? Map<String, dynamic>.from(res['wallet'] as Map)
          : res;
      final List<dynamic> walletHistory =
          (wallet['history'] as List<dynamic>?) ?? <dynamic>[];
      final List<Map<String, dynamic>> payouts =
          (results[1] as List).cast<Map<String, dynamic>>();
      // Prefer Finance wallet history; fall back to /api/host/payouts ledger.
      if (walletHistory.isEmpty && payouts.isNotEmpty) {
        wallet['history'] = payouts
            .map(
              (Map<String, dynamic> p) => <String, dynamic>{
                ...p,
                'displayStatus': p['status'],
                'accountNumberMasked':
                    p['accountNumberMasked'] ?? p['accountNumber'],
              },
            )
            .toList();
      }
      setState(() {
        _isHost = true;
        _wallet = wallet;
        _loading = false;
      });
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err.message;
        _loading = false;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _error = err.toString();
        _loading = false;
      });
    }
  }

  Future<void> _withdraw() async {
    final Map<String, dynamic>? balances =
        _wallet?['balances'] as Map<String, dynamic>?;
    final int available = (balances?['available'] as num?)?.toInt() ?? 0;
    if (available <= 0) return;
    setState(() {
      _withdrawing = true;
      _notice = null;
    });
    try {
      final Map<String, dynamic> result =
          await context.read<IleApi>().requestHostWithdrawal(
                amountNaira: available,
              );
      if (!mounted) return;
      setState(() {
        _notice = (result['message'] as String?) ?? 'Withdrawal submitted.';
      });
      await _load();
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() => _notice = err.message);
    } catch (err) {
      if (!mounted) return;
      setState(() => _notice = err.toString());
    } finally {
      if (mounted) setState(() => _withdrawing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final Map<String, dynamic>? balances =
        _wallet?['balances'] as Map<String, dynamic>?;
    final Map<String, dynamic>? bank =
        _wallet?['bank'] as Map<String, dynamic>?;
    final List<dynamic> history =
        (_wallet?['history'] as List<dynamic>?) ?? <dynamic>[];

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: widget.embedded
          ? const HostChromeAppBar(title: 'Earnings')
          : AppBar(
              backgroundColor: AppColors.background,
              elevation: 0,
              leading: const IleCircularBackButton(),
              title: Text('Host wallet', style: AppTypography.sectionHeading),
            ),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : !_isHost
              ? const IleEmptyState(
                  title: 'Host wallet unavailable',
                  message:
                      'Earnings and withdrawals are only available on the host dashboard for host accounts.',
                  icon: Icons.account_balance_wallet_outlined,
                )
              : _error != null
              ? IleErrorState(title: 'Could not load wallet', message: _error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
                    children: [
                      Text(
                        'Balances come from your payout records — not a separate wallet ledger. Guest payments, Ilé commission, and host payable amounts are calculated server-side.',
                        style: AppTypography.supporting,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        (_wallet?['payoutMode']?.toString() == 'AUTOMATIC')
                            ? 'Platform payout mode: Automatic — host net may transfer after verified guest payment when your bank is verified (check-in does not block).'
                            : 'Platform payout mode: Manual — earnings stay pending until check-in settlement and admin disbursement.',
                        style: AppTypography.caption,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      _BalanceTile(
                        label: 'Pending',
                        hint: (_wallet?['labels']
                                    as Map<String, dynamic>?)?['pending']
                                ?.toString() ??
                            'Held until settlement',
                        amount: (balances?['pending'] as num?)?.toInt() ?? 0,
                      ),
                      _BalanceTile(
                        label: 'Available / payable',
                        hint: (_wallet?['labels']
                                    as Map<String, dynamic>?)?['available']
                                ?.toString() ??
                            'Ready to withdraw',
                        amount: (balances?['available'] as num?)?.toInt() ?? 0,
                      ),
                      _BalanceTile(
                        label: 'Processing',
                        hint: (_wallet?['labels']
                                    as Map<String, dynamic>?)?['processing']
                                ?.toString() ??
                            'Transfer in flight',
                        amount:
                            (balances?['processing'] as num?)?.toInt() ?? 0,
                      ),
                      _BalanceTile(
                        label: 'Paid (success)',
                        hint: (_wallet?['labels']
                                    as Map<String, dynamic>?)?['paid']
                                ?.toString() ??
                            'Sent to your bank',
                        amount: (balances?['paid'] as num?)?.toInt() ?? 0,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      if (bank?['verified'] == true)
                        Text(
                          'Bank: ${bank?['bankName'] ?? ''} ${bank?['accountNumberMasked'] ?? ''}',
                          style: AppTypography.caption,
                        )
                      else ...[
                        Text(
                          'Add a verified bank account before withdrawing.',
                          style: AppTypography.caption.copyWith(
                            color: AppColors.criticalText,
                          ),
                        ),
                        TextButton(
                          onPressed: () => context.push(AppRoutes.hostBank),
                          child: const Text('Set payout bank'),
                        ),
                      ],
                      if (_notice != null) ...[
                        const SizedBox(height: 8),
                        Text(_notice!, style: AppTypography.caption),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      IleButton(
                        label: 'Withdraw available',
                        onPressed:
                            ((balances?['available'] as num?)?.toInt() ?? 0) > 0
                                ? (_withdrawing ? null : _withdraw)
                                : null,
                        isLoading: _withdrawing,
                        isExpanded: true,
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Text('History', style: AppTypography.sectionHeading),
                      const SizedBox(height: AppSpacing.sm),
                      if (history.isEmpty)
                        Text(
                          'No payout history yet.',
                          style: AppTypography.supporting,
                        )
                      else
                        ...history.take(20).map((dynamic row) {
                          final Map<String, dynamic> item =
                              Map<String, dynamic>.from(row as Map);
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              item['displayStatus']?.toString() ??
                                  item['status']?.toString() ??
                                  '',
                              style: AppTypography.bodyMedium,
                            ),
                            subtitle: Text(
                              '${item['bookingRef'] ?? item['bookingId'] ?? ''} · ${item['accountNumberMasked'] ?? ''}',
                              style: AppTypography.caption,
                            ),
                            trailing: Text(
                              '₦${IleFormatters.formatInteger((item['amount'] as num?)?.toInt() ?? 0)}',
                              style: AppTypography.bodyMedium,
                            ),
                          );
                        }),
                    ],
                  ),
                ),
    );
  }
}

class _BalanceTile extends StatelessWidget {
  const _BalanceTile({
    required this.label,
    required this.hint,
    required this.amount,
  });

  final String label;
  final String hint;
  final int amount;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: AppTypography.bodyMedium),
                  Text(hint, style: AppTypography.caption),
                ],
              ),
            ),
            Text(
              '₦${IleFormatters.formatInteger(amount)}',
              style: AppTypography.sectionHeading,
            ),
          ],
        ),
      ),
    );
  }
}
