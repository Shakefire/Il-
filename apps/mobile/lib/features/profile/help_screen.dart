import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../app/app_colors.dart';
import '../../app/app_radius.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/constants/app_routes.dart';
import '../../shared/widgets/editorial_chrome.dart';
import '../../shared/widgets/ile_button.dart';

/// Ilé help center — topics aligned with real Terms / Privacy / support emails.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);
  final TextEditingController _search = TextEditingController();
  String _query = '';

  static const String _supportEmail = 'hello@ilestays.ng';

  static const List<_HelpTopic> _guestTopics = <_HelpTopic>[
    _HelpTopic(
      title: 'How booking & payment work',
      body:
          'Tap Request to book to send a request to the host. When they accept, proceed to payment. Your stay is confirmed only after payment is verified. Address and arrival details unlock after confirmation. Refunds on paid stays are handled by Ilé admin only.',
      tags: 'booking payment pending confirmed',
    ),
    _HelpTopic(
      title: 'Cancellation & refunds',
      body:
          'Unpaid booking requests can be cancelled in the app for free. After payment, request cancellation in-app so Ilé admin can review a refund. Guests never trigger Paystack refunds directly; refund amount is paid minus the recorded Paystack fee.',
      tags: 'cancel refund policy admin',
    ),
    _HelpTopic(
      title: 'Guest capacities & estate rules',
      body:
          'Do not exceed the listing’s maximum guests without host authorization. Gated estates may require names and vehicle plates 12 hours before arrival. Quiet hours are typically 10:00 PM–7:00 AM.',
      tags: 'guests capacity estate gate',
    ),
    _HelpTopic(
      title: 'Guest guarantee / infrastructure',
      body:
          'Ilé listings emphasize verified power, water, and access standards. See Terms → Guest Guarantee for the full commitment and outage remedies.',
      tags: 'guarantee power water',
    ),
  ];

  static const List<_HelpTopic> _hostTopics = <_HelpTopic>[
    _HelpTopic(
      title: 'Publishing a listing',
      body:
          'Hosts complete identity verification in the Host section (or on the web). Listings can publish only after Ilé marks you verified — the server enforces this.',
      tags: 'host listing publish',
    ),
    _HelpTopic(
      title: 'Payouts & commission',
      body:
          'Guest payment confirms the booking. Host earnings and platform commission are calculated server-side at booking time. Manage payouts from Profile → Host dashboard → Earnings in this app.',
      tags: 'payout commission host',
    ),
  ];

  static const List<_HelpTopic> _accountTopics = <_HelpTopic>[
    _HelpTopic(
      title: 'Privacy & your data',
      body:
          'Under the Nigeria Data Protection Act you may request access, correction, or deletion via privacy@ilestays.ng. Full policy is linked from Profile → Privacy.',
      tags: 'privacy data ndpa',
    ),
    _HelpTopic(
      title: 'Sign in & security',
      body:
          'Use the same account as the Ilé website. Password reset is available from the Sign in screen. Never share OTP codes.',
      tags: 'login password otp account',
    ),
  ];

  @override
  void dispose() {
    _tabs.dispose();
    _search.dispose();
    super.dispose();
  }

  List<_HelpTopic> _filtered(List<_HelpTopic> source) {
    final String q = _query.trim().toLowerCase();
    if (q.isEmpty) return source;
    return source
        .where(
          (_HelpTopic t) =>
              t.title.toLowerCase().contains(q) ||
              t.body.toLowerCase().contains(q) ||
              t.tags.contains(q),
        )
        .toList();
  }

  Future<void> _handleContact() async {
    await Clipboard.setData(const ClipboardData(text: _supportEmail));
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Support email copied')));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EditorialColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
        children: [
          const EditorialToolbar(title: 'Help centre'),
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.screenHorizontal,
            ),
            child: TextField(
              controller: _search,
              onChanged: (String v) => setState(() => _query = v),
              decoration: InputDecoration(
                hintText: 'Search help topics',
                prefixIcon: const Icon(Icons.search_rounded),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(
                  borderRadius: AppRadius.panelAll,
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: AppRadius.panelAll,
                  borderSide: const BorderSide(color: AppColors.border),
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          TabBar(
            controller: _tabs,
            labelColor: AppColors.emerald,
            unselectedLabelColor: AppColors.foregroundMuted,
            indicatorColor: AppColors.emerald,
            tabs: const [
              Tab(text: 'Guest'),
              Tab(text: 'Host'),
              Tab(text: 'Account'),
            ],
          ),
          Expanded(
            child: TabBarView(
              controller: _tabs,
              children: [
                _TopicList(topics: _filtered(_guestTopics)),
                _TopicList(topics: _filtered(_hostTopics)),
                _TopicList(topics: _filtered(_accountTopics)),
              ],
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screenHorizontal,
                8,
                AppSpacing.screenHorizontal,
                12,
              ),
              child: Column(
                children: [
                  IleButton(
                    label: 'Contact support',
                    onPressed: _handleContact,
                    isExpanded: true,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _supportEmail,
                    style: AppTypography.caption.copyWith(
                      color: AppColors.emerald,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  TextButton(
                    onPressed: () => context.push(AppRoutes.terms),
                    child: Text(
                      'View Terms & Guest Guarantee',
                      style: AppTypography.caption.copyWith(
                        color: AppColors.foregroundSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
        ),
      ),
    );
  }
}

class _HelpTopic {
  const _HelpTopic({
    required this.title,
    required this.body,
    required this.tags,
  });

  final String title;
  final String body;
  final String tags;
}

class _TopicList extends StatelessWidget {
  const _TopicList({required this.topics});

  final List<_HelpTopic> topics;

  @override
  Widget build(BuildContext context) {
    if (topics.isEmpty) {
      return Center(
        child: Text(
          'No topics match your search',
          style: AppTypography.supporting,
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
      itemCount: topics.length,
      separatorBuilder: (_, _) => const SizedBox(height: 10),
      itemBuilder: (BuildContext context, int index) {
        final _HelpTopic topic = topics[index];
        return ExpansionTile(
          tilePadding: EdgeInsets.zero,
          childrenPadding: const EdgeInsets.only(bottom: 12),
          title: Text(
            topic.title,
            style: AppTypography.supporting.copyWith(
              color: AppColors.foreground,
              fontWeight: FontWeight.w700,
            ),
          ),
          children: [Text(topic.body, style: AppTypography.supporting)],
        );
      },
    );
  }
}
