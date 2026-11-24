import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_shadows.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../shared/widgets/editorial_chrome.dart';

/// Shared swipe offset notifier for dock + Map fade (created once per shell).
final ValueNotifier<double> marketplaceSwipeOffset = ValueNotifier<double>(0);

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

class _MarketplaceShellState extends State<MarketplaceShell>
    with WidgetsBindingObserver {
  static const List<_NavItem> _items = <_NavItem>[
    _NavItem(label: 'Explore', icon: Icons.search_rounded),
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
  PageController? _pageController;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    marketplaceSwipeOffset.value =
        widget.navigationShell.currentIndex.toDouble();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startPoll();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _poll?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startPoll();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _poll?.cancel();
      _poll = null;
    }
  }

  void _startPoll() {
    _poll?.cancel();
    _refreshUnread();
    _poll = Timer.periodic(
        const Duration(seconds: 45), (_) => _refreshUnread());
  }

  Future<void> _refreshUnread() async {
    if (!mounted) return;
    try {
      final String? token = await context.read<ApiClient>().getToken();
      if (token == null || token.isEmpty) {
        if (mounted && _unread != 0) setState(() => _unread = 0);
        _poll?.cancel();
        _poll = null;
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

  void _bindController(PageController controller) {
    if (_pageController == controller) return;
    _pageController = controller;
  }

  void _handleDockTap(int index) {
    final int current = widget.navigationShell.currentIndex;
    final PageController? controller = _pageController;
    if (index == current) {
      widget.navigationShell.goBranch(index, initialLocation: true);
      return;
    }
    HapticFeedback.selectionClick();
    if (controller == null || !controller.hasClients) {
      widget.navigationShell.goBranch(index);
      marketplaceSwipeOffset.value = index.toDouble();
      return;
    }
    final bool adjacent = (index - current).abs() == 1;
    if (adjacent) {
      controller.animateToPage(
        index,
        duration: const Duration(milliseconds: 320),
        curve: EditorialLayout.tabSnap,
      );
    } else {
      // Non-adjacent: jump without flashing intermediate tabs.
      controller.jumpToPage(index);
      widget.navigationShell.goBranch(index);
      marketplaceSwipeOffset.value = index.toDouble();
    }
  }

  @override
  Widget build(BuildContext context) {
    final double bottom = MediaQuery.paddingOf(context).bottom;
    return MarketplaceSwipeScope(
      notifier: marketplaceSwipeOffset,
      child: Scaffold(
        backgroundColor: EditorialColors.background,
        extendBody: true,
        body: Stack(
          children: [
            widget.navigationShell,
            Positioned(
              left: 0,
              right: 0,
              bottom: AppSpacing.mapPillBottom,
              child: ValueListenableBuilder<double>(
                valueListenable: marketplaceSwipeOffset,
                builder: (BuildContext context, double offset, Widget? child) {
                  // Fade + scale over first 40% of Explore → Saved swipe.
                  final double t = (offset / 0.4).clamp(0.0, 1.0);
                  final double opacity = 1 - t;
                  final double scale = 1 - (0.15 * t);
                  if (opacity <= 0.01) return const SizedBox.shrink();
                  return IgnorePointer(
                    ignoring: opacity < 0.4,
                    child: Opacity(
                      opacity: opacity,
                      child: Transform.scale(
                        scale: scale,
                        child: child,
                      ),
                    ),
                  );
                },
                child: Center(
                  child: _MapPill(
                    onPressed: () => context.push(AppRoutes.mapSearch),
                  ),
                ),
              ),
            ),
          ],
        ),
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
                  color: EditorialColors.dockGlass,
                  borderRadius: BorderRadius.circular(AppSpacing.dockRadius),
                  border: Border.all(color: EditorialColors.glassStroke),
                  boxShadow: AppShadows.dock,
                ),
                child: SizedBox(
                  height: AppSpacing.dockHeight,
                  child: ValueListenableBuilder<double>(
                    valueListenable: marketplaceSwipeOffset,
                    builder: (
                      BuildContext context,
                      double pageOffset,
                      Widget? child,
                    ) {
                      return Row(
                        children: List<Widget>.generate(_items.length, (
                          int index,
                        ) {
                          final _NavItem item = _items[index];
                          final double dist = (pageOffset - index).abs();
                          final double selectedAmount =
                              (1 - dist).clamp(0.0, 1.0);
                          final int badge = index == MarketplaceTabs.profile
                              ? _unread
                              : 0;
                          return Expanded(
                            child: _DockButton(
                              item: item,
                              selectedAmount: selectedAmount,
                              badgeCount: badge,
                              onTap: () => _handleDockTap(index),
                            ),
                          );
                        }),
                      );
                    },
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// PageView container for shell branches — keep-alive + dock offset sync.
class MarketplaceBranchPager extends StatefulWidget {
  const MarketplaceBranchPager({
    super.key,
    required this.navigationShell,
    required this.children,
    this.onControllerReady,
  });

  final StatefulNavigationShell navigationShell;
  final List<Widget> children;
  final ValueChanged<PageController>? onControllerReady;

  @override
  State<MarketplaceBranchPager> createState() => _MarketplaceBranchPagerState();
}

class _MarketplaceBranchPagerState extends State<MarketplaceBranchPager> {
  late final PageController _controller;
  bool _ignoreShellSync = false;
  int _lastCommitted = -1;

  @override
  void initState() {
    super.initState();
    final int initial = widget.navigationShell.currentIndex;
    _controller = PageController(initialPage: initial);
    marketplaceSwipeOffset.value = initial.toDouble();
    _lastCommitted = initial;
    _controller.addListener(_handleScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      widget.onControllerReady?.call(_controller);
      // Reach into ancestor shell if present.
      final _MarketplaceShellState? shell =
          context.findAncestorStateOfType<_MarketplaceShellState>();
      shell?._bindController(_controller);
    });
  }

  @override
  void didUpdateWidget(covariant MarketplaceBranchPager oldWidget) {
    super.didUpdateWidget(oldWidget);
    final int target = widget.navigationShell.currentIndex;
    if (_ignoreShellSync) return;
    if (!_controller.hasClients) return;
    final int current = _controller.page?.round() ?? target;
    if (current == target) return;
    _controller.jumpToPage(target);
    marketplaceSwipeOffset.value = target.toDouble();
  }

  void _handleScroll() {
    if (!_controller.hasClients || _controller.page == null) return;
    final double page = _controller.page!;
    marketplaceSwipeOffset.value = page;
  }

  void _handlePageChanged(int index) {
    if (index != _lastCommitted) {
      HapticFeedback.selectionClick();
      _lastCommitted = index;
    }
    if (index == widget.navigationShell.currentIndex) return;
    _ignoreShellSync = true;
    widget.navigationShell.goBranch(index);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _ignoreShellSync = false;
    });
  }

  @override
  void dispose() {
    _controller.removeListener(_handleScroll);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PageView.builder(
      controller: _controller,
      itemCount: widget.children.length,
      physics: const PageScrollPhysics(parent: BouncingScrollPhysics()),
      onPageChanged: _handlePageChanged,
      itemBuilder: (BuildContext context, int index) {
        return _KeepAliveBranch(child: widget.children[index]);
      },
    );
  }
}

class _KeepAliveBranch extends StatefulWidget {
  const _KeepAliveBranch({required this.child});

  final Widget child;

  @override
  State<_KeepAliveBranch> createState() => _KeepAliveBranchState();
}

class _KeepAliveBranchState extends State<_KeepAliveBranch>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return widget.child;
  }
}

class _MapPill extends StatelessWidget {
  const _MapPill({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Map',
      child: Material(
        color: EditorialColors.brand,
        borderRadius: AppRadius.pillAll,
        elevation: 0,
        child: InkWell(
          onTap: onPressed,
          borderRadius: AppRadius.pillAll,
          child: Ink(
            height: AppSpacing.mapPillHeight,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            decoration: BoxDecoration(
              color: EditorialColors.brand,
              borderRadius: AppRadius.pillAll,
              boxShadow: AppShadows.mapPill,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.map_outlined,
                  color: EditorialColors.onBrand,
                  size: 18,
                ),
                const SizedBox(width: 8),
                Text(
                  'Map',
                  style: AppTypography.supporting.copyWith(
                    color: EditorialColors.onBrand,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
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
    required this.selectedAmount,
    required this.onTap,
    this.badgeCount = 0,
  });

  final _NavItem item;
  final double selectedAmount;
  final VoidCallback onTap;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    final Color color = Color.lerp(
      EditorialColors.inkMuted.withValues(alpha: 0.72),
      EditorialColors.brand,
      selectedAmount,
    )!;
    final String label = badgeCount > 0
        ? '${item.label}, $badgeCount unread notifications'
        : item.label;
    final bool selected = selectedAmount > 0.55;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: InkWell(
        onTap: onTap,
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
            Opacity(
              opacity: selectedAmount,
              child: Container(
                width: 4 + (selectedAmount * 4),
                height: 4,
                decoration: BoxDecoration(
                  color: Color.lerp(
                    EditorialColors.brand,
                    EditorialColors.gold,
                    selectedAmount,
                  ),
                  borderRadius: BorderRadius.circular(999),
                ),
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
