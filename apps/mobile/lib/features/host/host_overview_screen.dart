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
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/skeleton/skeleton_box.dart';
import 'host_chrome.dart';

class HostOverviewScreen extends StatefulWidget {
  const HostOverviewScreen({super.key});

  @override
  State<HostOverviewScreen> createState() => _HostOverviewScreenState();
}

class _HostOverviewScreenState extends State<HostOverviewScreen> {
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _dashboard;
  Map<String, dynamic>? _onboarding;
  Map<String, dynamic>? _wallet;
  int _unread = 0;

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
        api.getHostDashboard(),
        api.getHostOnboardingStatus(),
        api.getHostWallet(),
        api.getNotifications(limit: 5),
      ]);
      if (!mounted) return;
      final Map<String, dynamic> walletRes =
          Map<String, dynamic>.from(results[2] as Map);
      final Map<String, dynamic> notifRes =
          Map<String, dynamic>.from(results[3] as Map);
      setState(() {
        _dashboard = Map<String, dynamic>.from(results[0] as Map);
        _onboarding = Map<String, dynamic>.from(results[1] as Map);
        _wallet = walletRes['wallet'] is Map
            ? Map<String, dynamic>.from(walletRes['wallet'] as Map)
            : walletRes;
        _unread = (notifRes['unreadCount'] as num?)?.toInt() ?? 0;
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

  bool get _kycApproved {
    final String status =
        (_onboarding?['verificationStatus']?.toString() ?? '').toUpperCase();
    return status == 'APPROVED' || _onboarding?['isVerified'] == true;
  }

  @override
  Widget build(BuildContext context) {
    final Map<String, dynamic>? earnings =
        _dashboard?['earnings'] as Map<String, dynamic>?;
    final Map<String, dynamic>? walletBalances =
        (_wallet?['balances'] as Map<String, dynamic>?) ??
            (earnings?['wallet'] as Map<String, dynamic>?);
    final Map<String, dynamic>? occupancy =
        _dashboard?['occupancy'] as Map<String, dynamic>?;
    final Map<String, dynamic>? counts =
        _dashboard?['counts'] as Map<String, dynamic>?;
    final List<dynamic> alerts =
        (_dashboard?['alerts'] as List<dynamic>?) ?? <dynamic>[];
    final int available = (walletBalances?['available'] as num?)?.toInt() ?? 0;
    final int pending = (walletBalances?['pending'] as num?)?.toInt() ?? 0;
    final int lifetime =
        (earnings?['lifetimeHostEarnings'] as num?)?.toInt() ??
            (earnings?['totalNet'] as num?)?.toInt() ??
            0;
    final double occRate =
        (occupancy?['occupancyRate'] as num?)?.toDouble() ?? 0;
    final int pendingRequests =
        (counts?['pendingHost'] as num?)?.toInt() ??
            alerts
                .where(
                  (dynamic a) =>
                      (a is Map) && a['type']?.toString() == 'PENDING_HOST',
                )
                .length;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: HostChromeAppBar(
        title: 'Ilé Host',
        actions: <Widget>[
          if (_unread > 0)
            Padding(
              padding: const EdgeInsets.only(right: 4),
              child: Center(
                child: HostStatusChip(
                  label: '$_unread new',
                  tone: HostStatusTone.info,
                ),
              ),
            ),
        ],
      ),
      body: _loading
          ? const _OverviewSkeleton()
          : _error != null
              ? IleErrorState(
                  title: 'Could not load dashboard',
                  message: _error!,
                  onRetry: _load,
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
                    children: <Widget>[
                      Text(
                        'Earnings use confirmed stay snapshots. Guest list prices include platform markup.',
                        style: AppTypography.supporting,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      _KycBanner(
                        status: _onboarding?['verificationStatus']?.toString() ??
                            'UNKNOWN',
                        progress:
                            (_onboarding?['progressPct'] as num?)?.toInt() ?? 0,
                        approved: _kycApproved,
                        missing: ((_onboarding?['missingRequirements']
                                    as List<dynamic>?) ??
                                <dynamic>[])
                            .map((dynamic e) => e.toString())
                            .toList(),
                        onContinue: () =>
                            context.push(AppRoutes.hostOnboarding),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: _MetricCard(
                              label: 'Available',
                              value:
                                  '₦${IleFormatters.formatInteger(available)}',
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: _MetricCard(
                              label: 'Pending',
                              value: '₦${IleFormatters.formatInteger(pending)}',
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: _MetricCard(
                              label: 'Lifetime',
                              value:
                                  '₦${IleFormatters.formatInteger(lifetime)}',
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: _MetricCard(
                              label: 'Occupancy 30d',
                              value: '${(occRate * 100).round()}%',
                            ),
                          ),
                        ],
                      ),
                      if (pendingRequests > 0) ...[
                        const SizedBox(height: AppSpacing.lg),
                        Material(
                          color: AppColors.warningBg,
                          borderRadius: BorderRadius.circular(12),
                          child: ListTile(
                            title: Text(
                              '$pendingRequests request${pendingRequests == 1 ? '' : 's'} waiting',
                              style: AppTypography.bodyMedium,
                            ),
                            subtitle: Text(
                              'Respond before the deadline ends.',
                              style: AppTypography.caption,
                            ),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () {
                              // Parent shell uses IndexedStack; Reservations is the accept/decline tab.
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Open the Reservations tab to accept or decline.',
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      Text('Alerts', style: AppTypography.sectionHeading),
                      const SizedBox(height: AppSpacing.sm),
                      if (alerts.isEmpty)
                        Text(
                          'No host alerts right now.',
                          style: AppTypography.supporting,
                        )
                      else
                        ...alerts.take(5).map((dynamic raw) {
                          final Map<String, dynamic> a =
                              Map<String, dynamic>.from(raw as Map);
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              a['title']?.toString() ?? 'Alert',
                              style: AppTypography.body,
                            ),
                            subtitle: Text(
                              a['body']?.toString() ?? '',
                              style: AppTypography.supporting,
                            ),
                          );
                        }),
                      const SizedBox(height: AppSpacing.lg),
                      IleButton(
                        label: 'Payout bank account',
                        onPressed: () => context.push(AppRoutes.hostBank),
                        isExpanded: true,
                        variant: IleButtonVariant.secondary,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      IleButton(
                        label: 'Create listing',
                        onPressed: _kycApproved
                            ? () => context.push(AppRoutes.hostPropertyCreate)
                            : () => context.push(AppRoutes.hostOnboarding),
                        isExpanded: true,
                      ),
                    ],
                  ),
                ),
    );
  }
}

class _KycBanner extends StatelessWidget {
  const _KycBanner({
    required this.status,
    required this.progress,
    required this.approved,
    required this.missing,
    required this.onContinue,
  });

  final String status;
  final int progress;
  final bool approved;
  final List<String> missing;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: approved ? AppColors.successBg : AppColors.accentSurface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: approved ? AppColors.successBorder : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  approved ? 'Verified host' : 'Identity verification',
                  style: AppTypography.bodyMedium,
                ),
              ),
              HostStatusChip(
                label: status,
                kind: HostStatusChipKind.verification,
                tone: approved
                    ? HostStatusTone.success
                    : HostStatusTone.warning,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (progress.clamp(0, 100)) / 100,
              minHeight: 6,
              backgroundColor: AppColors.borderSubtle,
              color: AppColors.emerald,
            ),
          ),
          if (!approved) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              missing.isEmpty
                  ? 'Complete verification to publish listings.'
                  : missing.first,
              style: AppTypography.supporting,
            ),
            const SizedBox(height: AppSpacing.sm),
            TextButton(
              onPressed: onContinue,
              child: const Text('Continue onboarding'),
            ),
          ],
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(label, style: AppTypography.caption),
          const SizedBox(height: 4),
          Text(value, style: AppTypography.sectionHeading),
        ],
      ),
    );
  }
}

class _OverviewSkeleton extends StatelessWidget {
  const _OverviewSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
      children: const <Widget>[
        SkeletonBox(height: 16, width: 220),
        SizedBox(height: AppSpacing.lg),
        SkeletonBox(height: 110),
        SizedBox(height: AppSpacing.md),
        Row(
          children: <Widget>[
            Expanded(child: SkeletonBox(height: 88)),
            SizedBox(width: AppSpacing.sm),
            Expanded(child: SkeletonBox(height: 88)),
          ],
        ),
        SizedBox(height: AppSpacing.sm),
        Row(
          children: <Widget>[
            Expanded(child: SkeletonBox(height: 88)),
            SizedBox(width: AppSpacing.sm),
            Expanded(child: SkeletonBox(height: 88)),
          ],
        ),
        SizedBox(height: AppSpacing.lg),
        SkeletonBox(height: 24, width: 100),
        SizedBox(height: AppSpacing.sm),
        SkeletonBox(height: 56),
        SizedBox(height: AppSpacing.sm),
        SkeletonBox(height: 56),
      ],
    );
  }
}
