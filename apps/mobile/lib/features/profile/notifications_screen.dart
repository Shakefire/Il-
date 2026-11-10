import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/guest_flow_errors.dart';
import '../../core/push/push_messaging_service.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';
import '../../shared/widgets/skeleton/skeleton_text.dart';

/// In-app notification inbox backed by `/api/notifications`.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _loading = true;
  bool _enablingPush = false;
  String? _error;
  List<Map<String, dynamic>> _items = <Map<String, dynamic>>[];
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _handleEnablePush() async {
    setState(() => _enablingPush = true);
    final PushMessagingService push = context.read<PushMessagingService>();
    final PushEnableResult result = await push.enableAfterUserAction();
    if (!mounted) return;
    setState(() => _enablingPush = false);
    final String message = switch (result) {
      PushEnableResult.enabled => 'Push alerts enabled on this device',
      PushEnableResult.denied => 'Notification permission was denied',
      PushEnableResult.unavailable =>
        'Push is not configured yet (Firebase options missing)',
      PushEnableResult.noToken => 'Could not obtain a device push token',
      PushEnableResult.failed => 'Could not enable push alerts',
    };
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final String? token = await context.read<ApiClient>().getToken();
      if (token == null || token.isEmpty) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _items = <Map<String, dynamic>>[];
          _unread = 0;
        });
        return;
      }
      final Map<String, dynamic> body =
          await context.read<IleApi>().getNotifications();
      final List<dynamic> raw =
          (body['notifications'] as List<dynamic>?) ?? <dynamic>[];
      if (!mounted) return;
      setState(() {
        _items = raw
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        _unread = (body['unreadCount'] as num?)?.toInt() ?? 0;
        _loading = false;
      });
    } catch (err) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = GuestFlowError.from(err).message;
      });
    }
  }

  Future<void> _markAllRead() async {
    try {
      await context.read<IleApi>().markAllNotificationsRead();
      await _load();
    } catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(GuestFlowError.from(err).message)),
      );
    }
  }

  Future<void> _openItem(Map<String, dynamic> item) async {
    final String id = '${item['id'] ?? ''}';
    if (id.isNotEmpty && item['readAt'] == null) {
      try {
        await context.read<IleApi>().markNotificationRead(id);
      } catch (_) {}
    }
    final String? deepLink = item['deepLink'] as String?;
    if (deepLink != null && deepLink.contains('/bookings/')) {
      final String bookingId = deepLink.split('/').last;
      if (bookingId.isNotEmpty && mounted) {
        context.push(AppRoutes.reservationStatusPath(bookingId));
      }
    }
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text('Notifications', style: AppTypography.cardTitle),
        actions: [
          TextButton(
            onPressed: _enablingPush ? null : _handleEnablePush,
            child: Text(_enablingPush ? 'Enabling…' : 'Enable push'),
          ),
          if (_unread > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read'),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _buildBody(),
      ),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return ListView(
        padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
        children: const [
          SkeletonText(lines: 2, widthFactor: 0.95),
          SizedBox(height: 16),
          SkeletonText(lines: 2, widthFactor: 0.8),
        ],
      );
    }
    if (_error != null) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
        children: [
          IleEmptyState(
            title: 'Could not load notifications',
            message: _error!,
            icon: Icons.error_outline_rounded,
            actionLabel: 'Retry',
            onAction: _load,
          ),
        ],
      );
    }

    return FutureBuilder<String?>(
      future: context.read<ApiClient>().getToken(),
      builder: (context, snap) {
        final String? token = snap.data;
        if (snap.connectionState != ConnectionState.done) {
          return const Center(child: IleLoadingIndicator());
        }
        if (token == null || token.isEmpty) {
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
            children: [
              IleEmptyState(
                title: 'Sign in to view notifications',
                message:
                    'Booking updates and host responses appear here after you sign in.',
                icon: Icons.notifications_none_rounded,
                actionLabel: 'Sign in',
                onAction: () => context.push(AppRoutes.login),
              ),
            ],
          );
        }
        if (_items.isEmpty) {
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
            children: const [
              IleEmptyState(
                title: 'No notifications yet',
                message:
                    'When hosts respond or payment updates arrive, they will show up here.',
                icon: Icons.notifications_none_rounded,
              ),
            ],
          );
        }
        return ListView.separated(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
          itemCount: _items.length,
          separatorBuilder: (_, __) => const SizedBox(height: 8),
          itemBuilder: (context, index) {
            final Map<String, dynamic> item = _items[index];
            final bool unread = item['readAt'] == null;
            return Material(
              color: unread
                  ? AppColors.surfaceMuted
                  : AppColors.background,
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: () => _openItem(item),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${item['title'] ?? 'Update'}',
                        style: AppTypography.cardTitle.copyWith(
                          fontWeight:
                              unread ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '${item['body'] ?? ''}',
                        style: AppTypography.supporting,
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        );
      },
    );
  }
}
