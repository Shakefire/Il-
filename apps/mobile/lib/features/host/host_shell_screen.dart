import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../core/utils/user_role.dart';
import '../../shared/widgets/ile_empty_state.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';
import 'host_calendar_screen.dart';
import 'host_earnings_screen.dart';
import 'host_overview_screen.dart';
import 'host_properties_screen.dart';
import 'host_reservations_screen.dart';

/// Host operations shell — real Fastify APIs, no mock host data.
class HostShellScreen extends StatefulWidget {
  const HostShellScreen({super.key});

  @override
  State<HostShellScreen> createState() => _HostShellScreenState();
}

class _HostShellScreenState extends State<HostShellScreen> {
  int _index = 0;
  bool _loading = true;
  bool _isHost = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _gate();
  }

  Future<void> _gate() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final IleApi api = context.read<IleApi>();
      final Map<String, dynamic>? user = await api.getCurrentUser();
      final bool allowed = UserRole.canAccessHostWallet(user?['role']);
      if (!mounted) return;
      setState(() {
        _isHost = allowed;
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
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.background,
        body: Center(child: IleLoadingIndicator()),
      );
    }
    if (_error != null) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: IleErrorState(
          title: 'Could not open host tools',
          message: _error!,
          onRetry: _gate,
        ),
      );
    }
    if (!_isHost) {
      return Scaffold(
        backgroundColor: AppColors.background,
        body: IleEmptyState(
          title: 'Host access required',
          message:
              'Complete host verification to manage listings, reservations, and earnings. Guests start KYC from Become a host.',
          icon: Icons.home_work_outlined,
          actionLabel: 'Become a host',
          onAction: () => context.push(AppRoutes.hostOnboarding),
        ),
      );
    }

    final List<Widget> pages = <Widget>[
      const HostOverviewScreen(),
      const HostPropertiesScreen(),
      const HostReservationsScreen(),
      const HostCalendarScreen(),
      const HostEarningsScreen(),
    ];

    return Scaffold(
      backgroundColor: AppColors.background,
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (int value) => setState(() => _index = value),
        destinations: const <NavigationDestination>[
          NavigationDestination(
            icon: Icon(Icons.dashboard_outlined),
            selectedIcon: Icon(Icons.dashboard),
            label: 'Overview',
          ),
          NavigationDestination(
            icon: Icon(Icons.apartment_outlined),
            selectedIcon: Icon(Icons.apartment),
            label: 'Properties',
          ),
          NavigationDestination(
            icon: Icon(Icons.event_note_outlined),
            selectedIcon: Icon(Icons.event_note),
            label: 'Reservations',
          ),
          NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month),
            label: 'Calendar',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_balance_wallet_outlined),
            selectedIcon: Icon(Icons.account_balance_wallet),
            label: 'Earnings',
          ),
        ],
      ),
    );
  }
}
