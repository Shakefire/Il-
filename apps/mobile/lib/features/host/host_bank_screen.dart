import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';

class HostBankScreen extends StatefulWidget {
  const HostBankScreen({super.key});

  @override
  State<HostBankScreen> createState() => _HostBankScreenState();
}

class _HostBankScreenState extends State<HostBankScreen> {
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _notice;
  Map<String, dynamic>? _account;
  List<Map<String, dynamic>> _banks = <Map<String, dynamic>>[];
  String? _bankCode;
  final TextEditingController _accountCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _accountCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final IleApi api = context.read<IleApi>();
      final List<dynamic> results = await Future.wait(<Future<dynamic>>[
        api.getHostPayoutAccount(),
        api.getNigerianBanks(),
      ]);
      if (!mounted) return;
      final Map<String, dynamic> res =
          Map<String, dynamic>.from(results[0] as Map);
      final Map<String, dynamic>? account = res['account'] is Map
          ? Map<String, dynamic>.from(res['account'] as Map)
          : (res['bank'] is Map
              ? Map<String, dynamic>.from(res['bank'] as Map)
              : null);
      final String? existingCode = account?['bankCode']?.toString();
      final String? existingNumber = account?['accountNumber']?.toString() ??
          account?['accountNumberMasked']?.toString();
      if (existingNumber != null &&
          existingNumber.length >= 10 &&
          !existingNumber.contains('*')) {
        _accountCtrl.text = existingNumber;
      }
      setState(() {
        _account = account;
        _banks = (results[1] as List).cast<Map<String, dynamic>>();
        _bankCode = existingCode?.isNotEmpty == true ? existingCode : _bankCode;
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

  Future<void> _save() async {
    if (_bankCode == null || _accountCtrl.text.trim().length < 10) {
      setState(() => _notice = 'Select a bank and enter a 10-digit NUBAN.');
      return;
    }
    setState(() {
      _saving = true;
      _notice = null;
    });
    try {
      final Map<String, dynamic> res =
          await context.read<IleApi>().updateHostPayoutAccount(
                bankCode: _bankCode!,
                accountNumber: _accountCtrl.text.trim(),
              );
      if (!mounted) return;
      setState(() {
        _notice = res['message']?.toString() ??
            'Payout account verified via Paystack resolve.';
      });
      await _load();
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() => _notice = err.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool codeInList =
        _banks.any((Map<String, dynamic> b) => b['code']?.toString() == _bankCode);

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text('Payout bank', style: AppTypography.sectionHeading),
      ),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : _error != null
              ? IleErrorState(
                  title: 'Could not load bank account',
                  message: _error!,
                  onRetry: _load,
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
                  children: <Widget>[
                    Text(
                      'Withdrawals require a Paystack-verified Nigerian account. This screen only resolves and saves — it does not initiate a live transfer.',
                      style: AppTypography.supporting,
                    ),
                    const SizedBox(height: AppSpacing.lg),
                    if (_account != null) ...[
                      Text(
                        '${_account!['bankName'] ?? ''} · ${_account!['accountNumberMasked'] ?? _account!['accountNumber'] ?? ''}',
                        style: AppTypography.bodyMedium,
                      ),
                      Text(
                        _account!['accountName']?.toString() ?? '',
                        style: AppTypography.supporting,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                    ],
                    DropdownButtonFormField<String>(
                      initialValue: codeInList ? _bankCode : null,
                      isExpanded: true,
                      items: _banks
                          .map(
                            (Map<String, dynamic> b) => DropdownMenuItem<String>(
                              value: b['code']?.toString(),
                              child: Text(b['name']?.toString() ?? ''),
                            ),
                          )
                          .toList(),
                      onChanged: (String? code) =>
                          setState(() => _bankCode = code),
                      decoration: const InputDecoration(labelText: 'Bank'),
                    ),
                    TextField(
                      controller: _accountCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Account number',
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    IleButton(
                      label: _saving ? 'Verifying…' : 'Save & verify',
                      onPressed: _saving ? null : _save,
                      isLoading: _saving,
                      isExpanded: true,
                    ),
                    if (_notice != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(_notice!, style: AppTypography.supporting),
                    ],
                  ],
                ),
    );
  }
}
