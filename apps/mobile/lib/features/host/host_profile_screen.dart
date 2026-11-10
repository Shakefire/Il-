import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';
import 'host_chrome.dart';

class HostProfileScreen extends StatefulWidget {
  const HostProfileScreen({super.key});

  @override
  State<HostProfileScreen> createState() => _HostProfileScreenState();
}

class _HostProfileScreenState extends State<HostProfileScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _profile;
  Map<String, dynamic>? _onboarding;

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
      final List<dynamic> results = await Future.wait(<Future<dynamic>>[
        api.getHostProfile(),
        api.getHostOnboardingStatus(),
      ]);
      if (!mounted) return;
      setState(() {
        _profile = Map<String, dynamic>.from(results[0] as Map);
        _onboarding = Map<String, dynamic>.from(results[1] as Map);
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

  @override
  Widget build(BuildContext context) {
    final String status =
        _onboarding?['verificationStatus']?.toString() ?? 'UNKNOWN';
    final bool approved =
        status == 'APPROVED' || _onboarding?['isVerified'] == true;
    final Map<String, dynamic>? user = _profile?['user'] is Map
        ? Map<String, dynamic>.from(_profile!['user'] as Map)
        : _profile;
    final String name =
        '${user?['firstName'] ?? ''} ${user?['lastName'] ?? ''}'.trim();
    final String email = user?['email']?.toString() ?? '';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text('Host profile', style: AppTypography.sectionHeading),
      ),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : _error != null
              ? IleErrorState(
                  title: 'Could not load host profile',
                  message: _error!,
                  onRetry: _load,
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
                    children: <Widget>[
                      Text(
                        name.isEmpty ? 'Host' : name,
                        style: AppTypography.sectionHeading,
                      ),
                      Text(email, style: AppTypography.supporting),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        children: <Widget>[
                          Text('KYC', style: AppTypography.caption),
                          const SizedBox(width: 8),
                          HostStatusChip(
                            label: status,
                            tone: approved
                                ? HostStatusTone.success
                                : HostStatusTone.warning,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        approved
                            ? 'You can publish listings. Server gates still apply.'
                            : 'Complete onboarding to unlock publishing.',
                        style: AppTypography.supporting,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      if (!approved)
                        IleButton(
                          label: 'Continue KYC onboarding',
                          onPressed: () =>
                              context.push(AppRoutes.hostOnboarding),
                          isExpanded: true,
                        ),
                      const SizedBox(height: AppSpacing.md),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.account_balance_outlined),
                        title: const Text('Payout bank'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push(AppRoutes.hostBank),
                      ),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.notifications_outlined),
                        title: const Text('Notifications & preferences'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push(AppRoutes.hostNotifications),
                      ),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.edit_outlined),
                        title: const Text('Account details'),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.push(AppRoutes.editProfile),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'Currency is fixed to NGN on Ilé — no currency preference.',
                        style: AppTypography.caption,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      IleButton(
                        label: 'Back to guest marketplace',
                        onPressed: () => context.go(AppRoutes.explore),
                        variant: IleButtonVariant.secondary,
                        isExpanded: true,
                      ),
                    ],
                  ),
                ),
    );
  }
}
