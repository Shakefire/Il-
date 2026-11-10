import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_input.dart';
import '../../shared/widgets/ile_loading_indicator.dart';
import '../../shared/widgets/widgets.dart';

/// Guest profile edit — PATCH `/api/auth/profile` (name + phone; email read-only).
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final TextEditingController _firstName = TextEditingController();
  final TextEditingController _lastName = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  final TextEditingController _email = TextEditingController();
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _hydrate();
  }

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _phone.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _hydrate() async {
    final Map<String, dynamic>? user =
        await context.read<IleApi>().getCurrentUser();
    if (!mounted) return;
    if (user != null) {
      _firstName.text = '${user['firstName'] ?? ''}';
      _lastName.text = '${user['lastName'] ?? ''}';
      _phone.text = '${user['phone'] ?? ''}';
      _email.text = '${user['email'] ?? ''}';
    }
    setState(() => _loading = false);
  }

  Future<void> _save() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await context.read<IleApi>().updateProfile(
            firstName: _firstName.text.trim(),
            lastName: _lastName.text.trim(),
            phone: _phone.text.trim(),
          );
      if (!mounted) return;
      setState(() => _saving = false);
      IleAlert.showSnackBar(
        context: context,
        message: 'Profile updated.',
        tone: IleAlertTone.success,
      );
    } on ApiException catch (err) {
      if (!mounted) return;
      setState(() => _saving = false);
      IleAlert.showSnackBar(
        context: context,
        message: err.message,
        tone: IleAlertTone.critical,
      );
    } catch (_) {
      if (!mounted) return;
      setState(() => _saving = false);
      IleAlert.showSnackBar(
        context: context,
        message: 'Unable to save profile.',
        tone: IleAlertTone.critical,
      );
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
        title: Text('Edit profile', style: AppTypography.cardTitle),
      ),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
              children: [
                IleInput(
                  controller: _firstName,
                  label: 'First name',
                  hintText: 'First name',
                ),
                const SizedBox(height: AppSpacing.sm),
                IleInput(
                  controller: _lastName,
                  label: 'Last name',
                  hintText: 'Last name',
                ),
                const SizedBox(height: AppSpacing.sm),
                IleInput(
                  controller: _phone,
                  label: 'Phone',
                  hintText: '0803…',
                  keyboardType: TextInputType.phone,
                ),
                const SizedBox(height: AppSpacing.sm),
                IleInput(
                  controller: _email,
                  label: 'Email',
                  hintText: 'Email',
                  enabled: false,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Email changes require support. Phone changes need re-verification.',
                  style: AppTypography.caption,
                ),
                const SizedBox(height: AppSpacing.xl),
                IleButton(
                  label: 'Save',
                  onPressed: _saving ? null : _save,
                  isLoading: _saving,
                  isExpanded: true,
                ),
              ],
            ),
    );
  }
}
