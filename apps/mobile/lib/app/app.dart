import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../core/api/api_client.dart';
import '../core/api/ile_api.dart';
import '../core/push/device_token_registrar.dart';
import '../core/push/push_messaging_service.dart';
import '../core/state/search_session.dart';
import '../core/state/wishlist_store.dart';
import 'app_router.dart';
import 'app_theme.dart';

/// Root Ilé mobile application — guest marketplace + auth UI.
class IleApp extends StatefulWidget {
  IleApp({
    super.key,
    GoRouter? router,
    ApiClient? apiClient,
    PushMessagingService? pushMessaging,
  })  : _injectedRouter = router,
        _apiClient = apiClient ?? ApiClient(),
        _injectedPush = pushMessaging;

  final GoRouter? _injectedRouter;
  final ApiClient _apiClient;
  final PushMessagingService? _injectedPush;

  @override
  State<IleApp> createState() => _IleAppState();
}

class _IleAppState extends State<IleApp> {
  final GlobalKey<ScaffoldMessengerState> _scaffoldMessengerKey =
      GlobalKey<ScaffoldMessengerState>();
  late final GoRouter _router =
      widget._injectedRouter ?? createAppRouter();
  late final IleApi _api = IleApi(widget._apiClient);
  late final DeviceTokenRegistrar _deviceTokenRegistrar =
      DeviceTokenRegistrar(_api);
  late final PushMessagingService _pushMessaging = widget._injectedPush ??
      PushMessagingService(
        registrar: _deviceTokenRegistrar,
        scaffoldMessengerKey: _scaffoldMessengerKey,
      );
  late final SearchSession _searchSession = SearchSession();
  late final WishlistStore _wishlistStore = WishlistStore();

  @override
  void initState() {
    super.initState();
    _wishlistStore.load();
    // Cold start: init Firebase if configured; never request permission here.
    _pushMessaging.initialize();
  }

  @override
  void dispose() {
    _pushMessaging.dispose();
    widget._apiClient.dispose();
    _searchSession.dispose();
    _wishlistStore.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        Provider<ApiClient>.value(value: widget._apiClient),
        Provider<IleApi>.value(value: _api),
        Provider<DeviceTokenRegistrar>.value(value: _deviceTokenRegistrar),
        Provider<PushMessagingService>.value(value: _pushMessaging),
        ChangeNotifierProvider<SearchSession>.value(value: _searchSession),
        ChangeNotifierProvider<WishlistStore>.value(value: _wishlistStore),
      ],
      child: MaterialApp.router(
        title: 'Ilé',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.light,
        scaffoldMessengerKey: _scaffoldMessengerKey,
        routerConfig: _router,
      ),
    );
  }
}
