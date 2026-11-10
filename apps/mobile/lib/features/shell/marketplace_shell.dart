import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';

/// Guest marketplace bottom navigation — Explore · Saved · Bookings · Inbox · Profile.
class MarketplaceShell extends StatefulWidget {
  const MarketplaceShell({
    super.key,
    required this.navigationShell,
  });

  final StatefulNavigationShell navigationShell;

  @override
  State<MarketplaceShell> createState() => _MarketplaceShellState();
}

class _MarketplaceShellState extends State<MarketplaceShell> {
  static const List<_NavItem> _items = <_NavItem>[
    _NavItem(
      label: 'Explore',
      icon: Icons.search_rounded,
    ),
    _NavItem(
      label: 'Saved',
      icon: Icons.favorite_border_rounded,
      activeIcon: Icons.favorite_rounded,
    ),
    _NavItem(
      label: 'Bookings',
      icon: Icons.luggage_outlined,
      activeIcon: Icons.luggage_rounded,
    ),
    _NavItem(
      label: 'Inbox',
      icon: Icons.chat_bubble_outline_rounded,
      activeIcon: Icons.chat_bubble_rounded,
    ),
    _NavItem(
      label: 'Profile',
      icon: Icons.person_outline_rounded,
      activeIcon: Icons.person_rounded,
    ),
  ];

  int _unread = 0;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshUnread();
      _poll = Timer.periodic(const Duration(seconds: 45), (_) => _refreshUnread());
    });
  }

  @override
  void dispose() {
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _refreshUnread() async {
    if (!mounted) return;
    try {
      final String? token = await context.read<ApiClient>().getToken();
      if (token == null || token.isEmpty) {
        if (mounted && _unread != 0) setState(() => _unread = 0);
        return;
      }
      final Map<String, dynamic> body =
          await context.read<IleApi>().getNotifications(limit: 1);
      final int next = (body['unreadCount'] as num?)?.toInt() ?? 0;
      if (mounted && next != _unread) {
        setState(() => _unread = next);
      }
    } catch (_) {
      // Badge is best-effort; do not surface shell errors.
    }
  }

  @override
  Widget build(BuildContext context) {
    final double bottom = MediaQuery.paddingOf(context).bottom;
    return Scaffold(
      backgroundColor: EditorialColors.background,
      extendBody: true,
      body: widget.navigationShell,
      bottomNavigationBar: Padding(
        padding: EdgeInsets.fromLTRB(
          AppSpacing.dockMarginH,
          0,
          AppSpacing.dockMarginH,
          AppSpacing.dockMarginBottom + bottom,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppSpacing.dockRadius),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: EditorialColors.glass,
                borderRadius: BorderRadius.circular(AppSpacing.dockRadius),
                border: Border.all(
                  color: EditorialColors.brand.withValues(alpha: 0.12),
                ),
                boxShadow: const <BoxShadow>[
                  BoxShadow(
                    color: Color(0x14000000),
                    blurRadius: 16,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: SizedBox(
                height: AppSpacing.dockHeight,
                child: Row(
                  children: List<Widget>.generate(_items.length, (int index) {
                    final _NavItem item = _items[index];
                    final bool selected =
                        widget.navigationShell.currentIndex == index;
                    final int badge =
                        index == MarketplaceTabs.profile ? _unread : 0;
                    return Expanded(
                      child: _DockButton(
                        item: item,
                        selected: selected,
                        badgeCount: badge,
                        onTap: () {
                          widget.navigationShell.goBranch(
                            index,
                            initialLocation:
                                index == widget.navigationShell.currentIndex,
                          );
                          if (index == MarketplaceTabs.profile) {
                            unawaited(_refreshUnread());
                          }
                        },
                      ),
                    );
                  }),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DockButton extends StatelessWidget {
  const _DockButton({
    required this.item,
    required this.selected,
    required this.onTap,
    this.badgeCount = 0,
  });

  final _NavItem item;
  final bool selected;
  final VoidCallback onTap;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    final Color color =
        selected ? EditorialColors.brand : EditorialColors.inkMuted.withValues(alpha: 0.72);
    final String label = badgeCount > 0
        ? '${item.label}, $badgeCount unread notifications'
        : item.label;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: onTap,
        child: AnimatedOpacity(
          duration: const Duration(milliseconds: 160),
          opacity: selected ? 1 : 0.88,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(
                    selected ? item.activeIcon : item.icon,
                    size: 22,
                    color: color,
                  ),
                  if (badgeCount > 0)
                    Positioned(
                      right: -8,
                      top: -4,
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 16),
                        height: 16,
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        decoration: BoxDecoration(
                          color: EditorialColors.brand,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        alignment: Alignment.center,
                        child: Text(
                          badgeCount > 9 ? '9+' : '$badgeCount',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 4),
              Container(
                width: 4,
                height: 4,
                decoration: BoxDecoration(
                  color: selected ? EditorialColors.gold : const Color(0x00000000),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.navLabel.copyWith(
                  fontSize: 11,
                  color: color,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  const _NavItem({
    required this.label,
    required this.icon,
    IconData? activeIcon,
  }) : activeIcon = activeIcon ?? icon;

  final String label;
  final IconData icon;
  final IconData activeIcon;
}

/// Helper for deep-linking into shell branches from outside.
abstract final class MarketplaceTabs {
  static const int explore = 0;
  static const int wishlist = 1;
  static const int bookings = 2;
  static const int inbox = 3;
  static const int profile = 4;

  static String pathFor(int index) {
    switch (index) {
      case wishlist:
        return AppRoutes.wishlist;
      case bookings:
        return AppRoutes.bookings;
      case inbox:
        return AppRoutes.inbox;
      case profile:
        return AppRoutes.profile;
      default:
        return AppRoutes.explore;
    }
  }
}
