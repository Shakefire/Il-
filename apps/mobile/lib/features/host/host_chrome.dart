import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_typography.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/host_messages.dart';
import '../../shared/widgets/ile_circular_back_button.dart';

/// Shared host app bar with notifications badge + profile.
class HostChromeAppBar extends StatefulWidget implements PreferredSizeWidget {
  const HostChromeAppBar({
    super.key,
    required this.title,
    this.showBack = false,
    this.actions = const <Widget>[],
  });

  final String title;
  final bool showBack;
  final List<Widget> actions;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  State<HostChromeAppBar> createState() => _HostChromeAppBarState();
}

class _HostChromeAppBarState extends State<HostChromeAppBar> {
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    _loadBadge();
  }

  Future<void> _loadBadge() async {
    try {
      final Map<String, dynamic> res =
          await context.read<IleApi>().getNotifications(limit: 1);
      final int count = (res['unreadCount'] as num?)?.toInt() ?? 0;
      if (!mounted) return;
      setState(() => _unread = count);
    } catch (_) {
      // Badge is best-effort; screen still works.
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppBar(
      backgroundColor: AppColors.background,
      elevation: 0,
      leading: widget.showBack
          ? const IleCircularBackButton()
          : IleCircularBackButton(
              onPressed: () => context.go(AppRoutes.profile),
            ),
      title: Text(widget.title, style: AppTypography.sectionHeading),
      actions: <Widget>[
        ...widget.actions,
        IconButton(
          tooltip: 'Notifications',
          onPressed: () async {
            await context.push(AppRoutes.hostNotifications);
            if (mounted) await _loadBadge();
          },
          icon: Badge(
            isLabelVisible: _unread > 0,
            label: Text(_unread > 99 ? '99+' : '$_unread'),
            child: const Icon(Icons.notifications_outlined),
          ),
        ),
        IconButton(
          tooltip: 'Host profile',
          onPressed: () => context.push(AppRoutes.hostProfile),
          icon: const Icon(Icons.person_outline),
        ),
      ],
    );
  }
}

/// Afro-luxe status chip for listing / booking states.
class HostStatusChip extends StatelessWidget {
  const HostStatusChip({
    super.key,
    required this.label,
    this.tone = HostStatusTone.neutral,
    this.kind = HostStatusChipKind.raw,
  });

  final String label;
  final HostStatusTone tone;
  final HostStatusChipKind kind;

  @override
  Widget build(BuildContext context) {
    final Color bg;
    final Color fg;
    switch (tone) {
      case HostStatusTone.success:
        bg = AppColors.successBg;
        fg = AppColors.successText;
      case HostStatusTone.warning:
        bg = AppColors.warningBg;
        fg = AppColors.warningText;
      case HostStatusTone.critical:
        bg = AppColors.criticalBg;
        fg = AppColors.criticalText;
      case HostStatusTone.info:
        bg = AppColors.infoBg;
        fg = AppColors.infoText;
      case HostStatusTone.neutral:
        bg = AppColors.surfaceMuted;
        fg = AppColors.foregroundSecondary;
    }
    final String display = switch (kind) {
      HostStatusChipKind.booking => HostMessages.bookingStatusLabel(label),
      HostStatusChipKind.listing => HostMessages.listingStatusLabel(label),
      HostStatusChipKind.verification => HostMessages.verificationLabel(label),
      HostStatusChipKind.raw => label,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        display,
        style: AppTypography.caption.copyWith(
          color: fg,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

enum HostStatusChipKind { raw, booking, listing, verification }

enum HostStatusTone { neutral, success, warning, critical, info }

HostStatusTone toneForPropertyStatus(String? status) {
  switch ((status ?? '').toUpperCase()) {
    case 'PUBLISHED':
      return HostStatusTone.success;
    case 'PENDING_REVIEW':
    case 'DRAFT':
      return HostStatusTone.warning;
    case 'ARCHIVED':
    case 'SUSPENDED':
      return HostStatusTone.critical;
    default:
      return HostStatusTone.neutral;
  }
}

HostStatusTone toneForBookingStatus(String? status) {
  switch ((status ?? '').toUpperCase()) {
    case 'CONFIRMED':
      return HostStatusTone.success;
    case 'PENDING_HOST':
    case 'PAYMENT_PENDING':
      return HostStatusTone.warning;
    case 'CANCELLED':
    case 'EXPIRED':
    case 'DECLINED':
      return HostStatusTone.critical;
    default:
      return HostStatusTone.info;
  }
}
