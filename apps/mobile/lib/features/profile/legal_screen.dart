import 'package:flutter/material.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../shared/widgets/editorial_chrome.dart';

/// Lightweight in-app summary of real Ilé legal pages (not a full mirror).
class LegalScreen extends StatelessWidget {
  const LegalScreen({
    super.key,
    required this.title,
    required this.sections,
  });

  final String title;
  final List<LegalSection> sections;

  static const LegalScreen terms = LegalScreen(
    title: 'Terms of Service',
    sections: <LegalSection>[
      LegalSection(
        heading: 'Guest Guarantee',
        body:
            'Ilé listings emphasize verified infrastructure standards across power, water, and access. See the full Guest Guarantee on the website Terms page.',
      ),
      LegalSection(
        heading: 'Cancellations',
        body:
            'Flexible (48h+): 100% refund of accommodation fees. Within 48 hours: first night non-refundable; 50% on remaining nights. Infrastructure failure on arrival may qualify for a full refund.',
      ),
      LegalSection(
        heading: 'Estate conduct',
        body:
            'Respect gate registration, guest capacity, and quiet hours (typically 10:00 PM–7:00 AM). Unauthorized parties may lead to termination without refund.',
      ),
      LegalSection(
        heading: 'Contact',
        body: 'hello@ilestays.ng — governed by the laws of Nigeria.',
      ),
    ],
  );

  static const LegalScreen privacy = LegalScreen(
    title: 'Privacy Policy',
    sections: <LegalSection>[
      LegalSection(
        heading: 'Your data',
        body:
            'Ilé processes account and booking data to operate stays. Under the Nigeria Data Protection Act you may request access, correction, or deletion.',
      ),
      LegalSection(
        heading: 'Data Protection Officer',
        body: 'privacy@ilestays.ng',
      ),
      LegalSection(
        heading: 'Full policy',
        body:
            'This screen is a concise summary. The complete Privacy Policy lives on the Ilé website.',
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EditorialColors.background,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            EditorialToolbar(title: title),
            Expanded(
              child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
        itemCount: sections.length,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
        itemBuilder: (BuildContext context, int index) {
          final LegalSection section = sections[index];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(section.heading, style: AppTypography.cardTitle),
              const SizedBox(height: 8),
              Text(section.body, style: AppTypography.supporting),
            ],
          );
        },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class LegalSection {
  const LegalSection({required this.heading, required this.body});

  final String heading;
  final String body;
}
