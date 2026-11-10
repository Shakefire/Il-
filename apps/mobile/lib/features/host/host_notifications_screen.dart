import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';

/// Real notification inbox + preferences for hosts.
class HostNotificationsScreen extends StatefulWidget {
  const HostNotificationsScreen({super.key});

  @override
  State<HostNotificationsScreen> createState() =>
      _HostNotificationsScreenState();
}

class _HostNotificationsScreenState extends State<HostNotificationsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs;
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _notifications = <Map<String, dynamic>>[];
  List<Map<String, dynamic>> _preferences = <Map<String, dynamic>>[];
  List<Map<String, dynamic>> _alerts = <Map<String, dynamic>>[];
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
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
        api.getNotifications(limit: 50),
        api.getNotificationPreferences(),
        api.getHostDashboard(),
      ]);
      if (!mounted) return;
      final Map<String, dynamic> inbox =
          Map<String, dynamic>.from(results[0] as Map);
      final Map<String, dynamic> prefs =
          Map<String, dynamic>.from(results[1] as Map);
      final Map<String, dynamic> dash =
          Map<String, dynamic>.from(results[2] as Map);
      setState(() {
        _notifications = ((inbox['notifications'] as List<dynamic>?) ??
                <dynamic>[])
            .whereType<Map>()
            .map((Map e) => Map<String, dynamic>.from(e))
            .toList();
        _unread = (inbox['unreadCount'] as num?)?.toInt() ?? 0;
        _preferences = ((prefs['preferences'] as List<dynamic>?) ?? <dynamic>[])
            .whereType<Map>()
            .map((Map e) => Map<String, dynamic>.from(e))
            .toList();
        _alerts = ((dash['alerts'] as List<dynamic>?) ?? <dynamic>[])
            .whereType<Map>()
            .map((Map e) => Map<String, dynamic>.from(e))
            .toList();
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

  Future<void> _markRead(String id) async {
    try {
      await context.read<IleApi>().markNotificationRead(id);
      await _load();
    } on ApiException catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(err.message)));
    }
  }

  Future<void> _markAll() async {
    try {
      await context.read<IleApi>().markAllNotificationsRead();
      await _load();
    } on ApiException catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(err.message)));
    }
  }

  Future<void> _togglePref(Map<String, dynamic> pref, String channel, bool value) async {
    try {
      await context.read<IleApi>().updateNotificationPreference(
            category: pref['category']?.toString() ?? 'HOST',
            emailEnabled: channel == 'email' ? value : null,
            smsEnabled: channel == 'sms' ? value : null,
            pushEnabled: channel == 'push' ? value : null,
            inboxEnabled: channel == 'inbox' ? value : null,
          );
      await _load();
    } on ApiException catch (err) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(err.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text(
          _unread > 0 ? 'Notifications ($_unread)' : 'Notifications',
          style: AppTypography.sectionHeading,
        ),
        actions: <Widget>[
          if (_unread > 0)
            TextButton(onPressed: _markAll, child: const Text('Mark all read')),
        ],
        bottom: TabBar(
          controller: _tabs,
          labelColor: AppColors.emerald,
          unselectedLabelColor: AppColors.foregroundSecondary,
          tabs: const <Widget>[
            Tab(text: 'Inbox'),
            Tab(text: 'Alerts'),
            Tab(text: 'Prefs'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : _error != null
              ? IleErrorState(
                  title: 'Could not load notifications',
                  message: _error!,
                  onRetry: _load,
                )
              : TabBarView(
                  controller: _tabs,
                  children: <Widget>[
                    _inboxTab(),
                    _alertsTab(),
                    _prefsTab(),
                  ],
                ),
    );
  }

  Widget _inboxTab() {
    if (_notifications.isEmpty) {
      return const IleEmptyState(
        title: 'Inbox empty',
        message:
            'Host booking and KYC messages appear here as real notification records.',
        icon: Icons.inbox_outlined,
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
        itemCount: _notifications.length,
        separatorBuilder: (_, _) => const Divider(height: 1),
        itemBuilder: (BuildContext context, int index) {
          final Map<String, dynamic> n = _notifications[index];
          final bool unread = n['readAt'] == null && n['isRead'] != true;
          final String id = n['id']?.toString() ?? '';
          return ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(
              unread
                  ? Icons.mark_email_unread_outlined
                  : Icons.mark_email_read_outlined,
              color: unread ? AppColors.emerald : AppColors.foregroundMuted,
            ),
            title: Text(
              n['title']?.toString() ?? n['subject']?.toString() ?? 'Notice',
              style: AppTypography.bodyMedium.copyWith(
                fontWeight: unread ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
            subtitle: Text(
              n['body']?.toString() ?? n['message']?.toString() ?? '',
              style: AppTypography.supporting,
            ),
            onTap: unread && id.isNotEmpty ? () => _markRead(id) : null,
          );
        },
      ),
    );
  }

  Widget _alertsTab() {
    if (_alerts.isEmpty) {
      return const IleEmptyState(
        title: 'No operational alerts',
        message: 'Pending requests and KYC reminders surface here from the dashboard.',
        icon: Icons.notifications_none,
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
        itemCount: _alerts.length,
        separatorBuilder: (_, _) => const Divider(height: 1),
        itemBuilder: (BuildContext context, int index) {
          final Map<String, dynamic> a = _alerts[index];
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
        },
      ),
    );
  }

  Widget _prefsTab() {
    if (_preferences.isEmpty) {
      return const IleEmptyState(
        title: 'No preferences yet',
        message: 'Notification preference rows are created when you receive the first host message.',
        icon: Icons.tune,
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
      itemCount: _preferences.length,
      itemBuilder: (BuildContext context, int index) {
        final Map<String, dynamic> p = _preferences[index];
        final String category = p['category']?.toString() ?? 'HOST';
        return ExpansionTile(
          title: Text(category, style: AppTypography.bodyMedium),
          children: <Widget>[
            SwitchListTile(
              title: const Text('Inbox'),
              value: p['inboxEnabled'] != false,
              onChanged: (bool v) => _togglePref(p, 'inbox', v),
            ),
            SwitchListTile(
              title: const Text('Push'),
              value: p['pushEnabled'] != false,
              onChanged: (bool v) => _togglePref(p, 'push', v),
            ),
            SwitchListTile(
              title: const Text('Email'),
              value: p['emailEnabled'] != false,
              onChanged: (bool v) => _togglePref(p, 'email', v),
            ),
            SwitchListTile(
              title: const Text('SMS'),
              value: p['smsEnabled'] == true,
              onChanged: (bool v) => _togglePref(p, 'sms', v),
            ),
          ],
        );
      },
    );
  }
}
