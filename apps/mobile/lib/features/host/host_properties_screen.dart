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
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';
import 'host_chrome.dart';

class HostPropertiesScreen extends StatefulWidget {
  const HostPropertiesScreen({super.key});

  @override
  State<HostPropertiesScreen> createState() => _HostPropertiesScreenState();
}

class _HostPropertiesScreenState extends State<HostPropertiesScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _properties = <Map<String, dynamic>>[];

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
      final List<Map<String, dynamic>> rows =
          await context.read<IleApi>().getHostProperties();
      if (!mounted) return;
      setState(() {
        _properties = rows;
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

  Future<void> _runAction(String id, String value) async {
    final IleApi api = context.read<IleApi>();
    final ScaffoldMessengerState messenger = ScaffoldMessenger.of(context);
    try {
      switch (value) {
        case 'publish':
          await api.publishHostProperty(id);
        case 'unpublish':
          await api.unpublishHostProperty(id);
        case 'relist':
          await api.relistHostProperty(id);
        case 'archive':
          final bool? ok = await showDialog<bool>(
            context: context,
            builder: (BuildContext ctx) => AlertDialog(
              title: const Text('Archive listing?'),
              content: const Text(
                'Listings with booking or finance history are soft-archived. Empty drafts may be removed.',
              ),
              actions: <Widget>[
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(ctx, true),
                  child: const Text('Archive'),
                ),
              ],
            ),
          );
          if (ok != true) return;
          await api.archiveHostProperty(id, confirm: true);
        case 'edit':
          if (!mounted) return;
          await context.push(AppRoutes.hostPropertyEditPath(id));
          await _load();
          return;
      }
      await _load();
    } on ApiException catch (err) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(err.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: HostChromeAppBar(
        title: 'Properties',
        actions: <Widget>[
          IconButton(
            tooltip: 'Create listing',
            onPressed: () async {
              await context.push(AppRoutes.hostPropertyCreate);
              await _load();
            },
            icon: const Icon(Icons.add),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : _error != null
              ? IleErrorState(
                  title: 'Could not load listings',
                  message: _error!,
                  onRetry: _load,
                )
              : _properties.isEmpty
                  ? IleEmptyState(
                      title: 'No listings yet',
                      message:
                          'Create a listing after KYC approval. Publish is enforced by the server.',
                      icon: Icons.apartment_outlined,
                      actionLabel: 'Create listing',
                      onAction: () =>
                          context.push(AppRoutes.hostPropertyCreate),
                    )
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding:
                            const EdgeInsets.all(AppSpacing.screenHorizontal),
                        itemCount: _properties.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (BuildContext context, int index) {
                          final Map<String, dynamic> p = _properties[index];
                          final String id = p['id']?.toString() ?? '';
                          final String status = p['status']?.toString() ?? '';
                          final int price =
                              (p['hostBasePrice'] as num?)?.toInt() ??
                                  (p['pricePerNight'] as num?)?.toInt() ??
                                  0;
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: Text(
                              p['title']?.toString() ?? 'Listing',
                              style: AppTypography.bodyMedium,
                            ),
                            subtitle: Text(
                              '${p['city']} · ₦${IleFormatters.formatInteger(price)} host rate',
                              style: AppTypography.supporting,
                            ),
                            leading: HostStatusChip(
                              label: status,
                              tone: toneForPropertyStatus(status),
                            ),
                            onTap: () async {
                              await context.push(
                                AppRoutes.hostPropertyDetailPath(id),
                              );
                              await _load();
                            },
                            trailing: PopupMenuButton<String>(
                              onSelected: (String value) =>
                                  _runAction(id, value),
                              itemBuilder: (_) => <PopupMenuEntry<String>>[
                                const PopupMenuItem(
                                  value: 'edit',
                                  child: Text('Edit'),
                                ),
                                if (status == 'PUBLISHED')
                                  const PopupMenuItem(
                                    value: 'unpublish',
                                    child: Text('Unpublish'),
                                  )
                                else if (status == 'ARCHIVED')
                                  const PopupMenuItem(
                                    value: 'relist',
                                    child: Text('Relist'),
                                  )
                                else
                                  const PopupMenuItem(
                                    value: 'publish',
                                    child: Text('Publish'),
                                  ),
                                const PopupMenuItem(
                                  value: 'archive',
                                  child: Text('Archive'),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
