import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/guest_flow_errors.dart';
import '../../core/push/push_messaging_service.dart';
import '../../core/utils/user_role.dart';
import '../../shared/widgets/editorial_chrome.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/skeleton/guest_home_skeleton.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isLoading = true;
  Map<String, dynamic>? _user;
  GuestFlowError? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _loadError = null;
    });
    try {
      final Map<String, dynamic>? user =
          await context.read<IleApi>().getCurrentUser();
      if (!mounted) return;
      setState(() {
        _user = user;
        _isLoading = false;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _user = null;
        _loadError = GuestFlowError.from(err, surface: 'generic');
        _isLoading = false;
      });
    }
  }

  Future<void> _handleSignOut() async {
    final PushMessagingService push = context.read<PushMessagingService>();
    final IleApi api = context.read<IleApi>();
    try {
      await push.clearOnLogout();
    } catch (_) {
      // Push revoke is best-effort; session clear still proceeds.
    }
    await api.logout();
    if (!mounted) return;
    setState(() => _user = null);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Signed out on this device')),
    );
  }

  void _openLogin() {
    context.push(
      '${AppRoutes.login}?returnTo=${Uri.encodeComponent(AppRoutes.profile)}',
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: EditorialColors.background,
        body: SafeArea(child: ProfilePlaceholderSkeleton()),
      );
    }

    if (_loadError != null && _user == null) {
      return Scaffold(
        backgroundColor: EditorialColors.background,
        body: SafeArea(
          child: Column(
            children: [
              const EditorialToolbar(title: 'Profile', explorePill: true),
              Expanded(
                child: IleErrorState(
                  title: _loadError!.title,
                  message: _loadError!.message,
                  onRetry: _load,
                ),
              ),
            ],
          ),
        ),
      );
    }

    final bool signedIn = _user != null;
    final String first = (_user?['firstName'] as String?)?.trim() ?? '';
    final String last = (_user?['lastName'] as String?)?.trim() ?? '';
    final String name = '$first $last'.trim();
    final String email = (_user?['email'] as String?) ?? '';
    final double bottom = EditorialLayout.dockClearance(context) + 24;

    return Scaffold(
      backgroundColor: EditorialColors.background,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: EdgeInsets.fromLTRB(
            AppSpacing.screenHorizontal,
            12,
            AppSpacing.screenHorizontal,
            bottom,
          ),
          children: [
            Text('Profile', style: AppTypography.screenTitle),
            const SizedBox(height: AppSpacing.lg),
            if (!signedIn)
              EditorialCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const _Avatar(letter: 'G'),
                    const SizedBox(height: 16),
                    Text(
                      'Welcome to Ilé',
                      style: AppTypography.sectionHeading.copyWith(fontSize: 28),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Sign in to manage reservations and messages. You can still browse stays and save them on this phone.',
                      style: AppTypography.body.copyWith(
                        color: EditorialColors.inkMuted,
                      ),
                    ),
                    const SizedBox(height: 20),
                    IleButton(
                      label: 'Continue with phone or email',
                      onPressed: _openLogin,
                      isExpanded: true,
                    ),
                  ],
                ),
              )
            else
              EditorialCard(
                child: Row(
                  children: [
                    _Avatar(letter: name.isNotEmpty ? name[0].toUpperCase() : 'U'),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name.isEmpty ? email : name,
                            style: AppTypography.cardTitle,
                          ),
                          if (email.isNotEmpty)
                            Text(
                              email,
                              style: AppTypography.caption.copyWith(
                                color: EditorialColors.inkMuted,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: AppSpacing.lg),
            _HostBanner(user: _user),
            const SizedBox(height: AppSpacing.xl),
            if (signedIn) ...[
              const _SectionLabel('Account'),
              _ProfileTile(
                icon: Icons.edit_outlined,
                label: 'Personal information',
                onTap: () => context.push(AppRoutes.editProfile),
              ),
              _ProfileTile(
                icon: Icons.notifications_outlined,
                label: 'Notifications',
                onTap: () => context.push(AppRoutes.notifications),
              ),
              _ProfileTile(
                icon: Icons.luggage_outlined,
                label: 'Your reservations',
                onTap: () => context.go(AppRoutes.bookings),
              ),
              const SizedBox(height: AppSpacing.lg),
            ],
            const _SectionLabel('Support'),
            _ProfileTile(
              icon: Icons.help_outline_rounded,
              label: 'Help centre',
              onTap: () => context.push(AppRoutes.help),
            ),
            _ProfileTile(
              icon: Icons.description_outlined,
              label: 'Terms',
              onTap: () => context.push(AppRoutes.terms),
            ),
            _ProfileTile(
              icon: Icons.privacy_tip_outlined,
              label: 'Privacy',
              onTap: () => context.push(AppRoutes.privacy),
            ),
            if (signedIn) ...[
              const SizedBox(height: AppSpacing.lg),
              _ProfileTile(
                icon: Icons.logout_rounded,
                label: 'Sign out',
                onTap: _handleSignOut,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.letter});

  final String letter;

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: 28,
      backgroundColor: EditorialColors.shimmerStart,
      child: Text(
        letter,
        style: AppTypography.cardTitle.copyWith(color: EditorialColors.brand),
      ),
    );
  }
}

class _HostBanner extends StatelessWidget {
  const _HostBanner({this.user});

  final Map<String, dynamic>? user;

  @override
  Widget build(BuildContext context) {
    final bool isHost = UserRole.canAccessHostWallet(user?['role']);
    final String title = isHost ? 'Host dashboard' : 'Become a host';
    final String subtitle = isHost
        ? 'Manage listings, reservations, calendar, and earnings.'
        : 'Apply for host verification to publish listings on Ilé.';
    return Material(
      color: EditorialColors.card,
      borderRadius: AppRadius.editorialImageAll,
      child: InkWell(
        onTap: () {
          if (user == null) {
            context.push(
              '${AppRoutes.login}?returnTo=${Uri.encodeComponent(AppRoutes.hostDashboard)}',
            );
            return;
          }
          if (isHost) {
            context.push(AppRoutes.hostDashboard);
            return;
          }
          context.push(AppRoutes.hostOnboarding);
        },
        borderRadius: AppRadius.editorialImageAll,
        child: Ink(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: AppRadius.editorialImageAll,
            border: Border.all(color: EditorialColors.hairline),
          ),
          child: Row(
            children: [
              const Icon(Icons.villa_outlined, color: EditorialColors.brand),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.supporting.copyWith(
                        color: EditorialColors.ink,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: AppTypography.caption.copyWith(
                        color: EditorialColors.inkMuted,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: EditorialColors.inkMuted),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Text(
        label.toUpperCase(),
        style: AppTypography.microLabel.copyWith(
          color: EditorialColors.inkMuted,
          letterSpacing: 1.1,
        ),
      ),
    );
  }
}

class _ProfileTile extends StatelessWidget {
  const _ProfileTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      minVerticalPadding: 12,
      leading: Icon(icon, color: EditorialColors.inkMuted),
      title: Text(
        label,
        style: AppTypography.supporting.copyWith(
          color: EditorialColors.ink,
          fontWeight: FontWeight.w600,
        ),
      ),
      trailing: const Icon(
        Icons.chevron_right_rounded,
        color: EditorialColors.inkMuted,
      ),
      onTap: onTap,
    );
  }
}
