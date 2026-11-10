import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/constants/app_routes.dart';
import '../../shared/widgets/editorial_chrome.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/skeleton/skeleton_box.dart';

/// Inbox requires auth; messaging API is still coming soon.
class InboxScreen extends StatefulWidget {
  const InboxScreen({super.key});

  @override
  State<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends State<InboxScreen> {
  bool _loading = true;
  bool _signedIn = false;

  static const String _conciergeEmail = 'hello@ilestays.ng';

  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final String? token = await context.read<ApiClient>().getToken();
    if (!mounted) return;
    setState(() {
      _signedIn = token != null && token.isNotEmpty;
      _loading = false;
    });
  }

  Future<void> _handleCopy() async {
    await Clipboard.setData(const ClipboardData(text: _conciergeEmail));
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Concierge email copied')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EditorialColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const EditorialToolbar(
              title: 'Inbox',
              explorePill: true,
              trailing: EditorialHelpButton(),
            ),
            Expanded(
              child: _loading
                  ? ListView(
                      padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
                      children: const [
                        SizedBox(height: AppSpacing.xl),
                        SkeletonBox(height: 72),
                        SizedBox(height: AppSpacing.sm),
                        SkeletonBox(height: 72),
                      ],
                    )
                  : !_signedIn
                      ? const GuestSignInGate(
                          returnPath: AppRoutes.inbox,
                          preview: SampleConciergeThread(),
                          message:
                              'Sign in to keep a thread with your host and the Ilé desk. The conversation above is a sample, not a message waiting for you.',
                        )
                      : Padding(
                          padding: EdgeInsets.fromLTRB(
                            AppSpacing.screenHorizontal,
                            AppSpacing.lg,
                            AppSpacing.screenHorizontal,
                            EditorialLayout.dockClearance(context) + 16,
                          ),
                          child: Column(
                            children: [
                              Text(
                                'Messaging is coming soon',
                                textAlign: TextAlign.center,
                                style: AppTypography.sectionHeading,
                              ),
                              const SizedBox(height: AppSpacing.sm),
                              Text(
                                'Direct guest–host chat is not available in the API yet. The concierge desk can help meanwhile.',
                                textAlign: TextAlign.center,
                                style: AppTypography.supporting.copyWith(
                                  color: EditorialColors.inkMuted,
                                ),
                              ),
                              const SizedBox(height: AppSpacing.xl),
                              EditorialCard(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Guest desk',
                                      style: AppTypography.cardTitle.copyWith(
                                        fontSize: 15,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      _conciergeEmail,
                                      style: AppTypography.supporting.copyWith(
                                        color: EditorialColors.brand,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Spacer(),
                              IleButton(
                                label: 'Copy concierge email',
                                onPressed: _handleCopy,
                                isExpanded: true,
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
