import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../app/app_colors.dart';
import '../../app/app_spacing.dart';
import '../../app/app_typography.dart';
import '../../core/api/api_client.dart';
import '../../core/api/ile_api.dart';
import '../../core/constants/app_routes.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';

/// Multi-step host KYC — persists via Fastify onboarding endpoints.
class HostOnboardingScreen extends StatefulWidget {
  const HostOnboardingScreen({super.key});

  @override
  State<HostOnboardingScreen> createState() => _HostOnboardingScreenState();
}

class _HostOnboardingScreenState extends State<HostOnboardingScreen> {
  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _notice;
  int _step = 0;
  Map<String, dynamic>? _status;

  final TextEditingController _dobCtrl = TextEditingController();
  final TextEditingController _addressCtrl = TextEditingController();
  final TextEditingController _cityCtrl = TextEditingController(text: 'Abuja');
  final TextEditingController _bioCtrl = TextEditingController();
  final TextEditingController _idNumberCtrl = TextEditingController();
  final TextEditingController _bankAccountCtrl = TextEditingController();
  final TextEditingController _draftTitleCtrl = TextEditingController();

  String _idType = 'NIN';
  String _hostType = 'INDIVIDUAL';
  String _authorityDocType = 'UTILITY_BILL';
  String? _idDocUrl;
  String? _selfieUrl;
  String? _authorityDocUrl;
  String? _bankCode;
  String? _bankName;
  List<Map<String, dynamic>> _banks = <Map<String, dynamic>>[];

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _dobCtrl.dispose();
    _addressCtrl.dispose();
    _cityCtrl.dispose();
    _bioCtrl.dispose();
    _idNumberCtrl.dispose();
    _bankAccountCtrl.dispose();
    _draftTitleCtrl.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final IleApi api = context.read<IleApi>();
      final List<dynamic> results = await Future.wait(<Future<dynamic>>[
        api.getHostOnboardingStatus(),
        api.getNigerianBanks(),
      ]);
      if (!mounted) return;
      final Map<String, dynamic> status =
          Map<String, dynamic>.from(results[0] as Map);
      final Map<String, dynamic>? profile = status['profile'] is Map
          ? Map<String, dynamic>.from(status['profile'] as Map)
          : null;
      _dobCtrl.text = profile?['dateOfBirth']?.toString() ?? '';
      _addressCtrl.text = profile?['residentialAddress']?.toString() ?? '';
      _cityCtrl.text = profile?['operatingCity']?.toString() ?? 'Abuja';
      _bioCtrl.text = profile?['bio']?.toString() ?? '';
      _idNumberCtrl.text = profile?['idNumber']?.toString() ?? '';
      _idType = profile?['idType']?.toString() ?? 'NIN';
      _idDocUrl = profile?['identityDocumentUrl']?.toString();
      _selfieUrl = profile?['selfieUrl']?.toString();
      _authorityDocUrl = profile?['authorityDocUrl']?.toString();
      _authorityDocType =
          profile?['authorityDocType']?.toString() ?? 'UTILITY_BILL';
      _hostType = profile?['hostType']?.toString() ?? 'INDIVIDUAL';
      _bankCode = profile?['bankCode']?.toString();
      _bankName = profile?['bankName']?.toString();
      _bankAccountCtrl.text = profile?['bankAccountNumber']?.toString() ?? '';
      final int serverStep = (status['step'] as num?)?.toInt() ?? 1;
      setState(() {
        _status = status;
        _banks = (results[1] as List).cast<Map<String, dynamic>>();
        _step = (serverStep - 1).clamp(0, 4);
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

  Future<String?> _pickAndUpload(String folder) async {
    final ImagePicker picker = ImagePicker();
    final XFile? file = await picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 85,
      maxWidth: 2000,
    );
    if (file == null) return null;
    final Uint8List bytes = await file.readAsBytes();
    final String b64 = base64Encode(bytes);
    final String mime = file.mimeType ?? 'image/jpeg';
    if (!mounted) return null;
    final Map<String, dynamic> res = await context.read<IleApi>().uploadImage(
          base64DataUriOrRaw: 'data:$mime;base64,$b64',
          folder: folder,
          mimeType: mime,
        );
    return res['url']?.toString();
  }

  Future<void> _saveStep() async {
    setState(() {
      _saving = true;
      _notice = null;
      _error = null;
    });
    final IleApi api = context.read<IleApi>();
    try {
      switch (_step) {
        case 0:
          await api.updateHostOnboardingProfile(<String, dynamic>{
            'dateOfBirth': _dobCtrl.text.trim(),
            'residentialAddress': _addressCtrl.text.trim(),
            'operatingCity': _cityCtrl.text.trim(),
            'bio': _bioCtrl.text.trim(),
          });
        case 1:
          if (_idDocUrl == null || _selfieUrl == null) {
            throw ApiException(
              message: 'Upload government ID and selfie before continuing.',
              statusCode: 400,
            );
          }
          await api.updateHostOnboardingIdentity(<String, dynamic>{
            'idType': _idType,
            'idNumber': _idNumberCtrl.text.trim(),
            'identityDocumentUrl': _idDocUrl,
            'selfieUrl': _selfieUrl,
          });
        case 2:
          if (_authorityDocUrl == null) {
            throw ApiException(
              message: 'Upload proof of residence / authority document.',
              statusCode: 400,
            );
          }
          if (_bankCode == null || _bankAccountCtrl.text.trim().length < 10) {
            throw ApiException(
              message: 'Select a bank and enter a valid NUBAN account number.',
              statusCode: 400,
            );
          }
          await api.updateHostOnboardingAuthority(<String, dynamic>{
            'hostType': _hostType,
            'authorityDocType': _authorityDocType,
            'authorityDocUrl': _authorityDocUrl,
            'bankCode': _bankCode,
            'bankAccountNumber': _bankAccountCtrl.text.trim(),
            'bankName': _bankName,
          });
        case 3:
          await api.saveHostOnboardingPropertyDraft(<String, dynamic>{
            'title': _draftTitleCtrl.text.trim().isEmpty
                ? 'First listing draft'
                : _draftTitleCtrl.text.trim(),
            'city': _cityCtrl.text.trim(),
          });
        case 4:
          final Map<String, dynamic> res = await api.submitHostOnboarding();
          setState(() {
            _notice = res['message']?.toString() ??
                'Application submitted for review.';
          });
          await _bootstrap();
          return;
      }
      setState(() {
        _notice = 'Saved.';
        if (_step < 4) _step += 1;
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } catch (err) {
      setState(() => _error = err.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final String verification =
        _status?['verificationStatus']?.toString() ?? 'UNKNOWN';
    final bool approved =
        verification == 'APPROVED' || _status?['isVerified'] == true;
    final bool underReview = verification == 'UNDER_REVIEW';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text('Host onboarding', style: AppTypography.sectionHeading),
      ),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : _error != null && _status == null
              ? IleErrorState(
                  title: 'Could not load onboarding',
                  message: _error!,
                  onRetry: _bootstrap,
                )
              : approved
                  ? ListView(
                      padding:
                          const EdgeInsets.all(AppSpacing.screenHorizontal),
                      children: <Widget>[
                        Text(
                          'Your host verification is approved.',
                          style: AppTypography.sectionHeading,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          'You can publish listings. Publishing remains gated by the server.',
                          style: AppTypography.supporting,
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        IleButton(
                          label: 'Go to host home',
                          onPressed: () => context.go(AppRoutes.hostDashboard),
                          isExpanded: true,
                        ),
                      ],
                    )
                  : underReview && _step == 4
                      ? ListView(
                          padding: const EdgeInsets.all(
                            AppSpacing.screenHorizontal,
                          ),
                          children: <Widget>[
                            Text(
                              'Under review',
                              style: AppTypography.sectionHeading,
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              _status?['reviewFeedback']?.toString().isNotEmpty ==
                                      true
                                  ? _status!['reviewFeedback'].toString()
                                  : 'Ilé is reviewing your documents. Publishing stays blocked until APPROVED.',
                              style: AppTypography.supporting,
                            ),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.all(
                            AppSpacing.screenHorizontal,
                          ),
                          children: <Widget>[
                            Text(
                              'Step ${_step + 1} of 5 · $verification',
                              style: AppTypography.caption,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            if (_step == 0) ..._profileFields(),
                            if (_step == 1) ..._identityFields(),
                            if (_step == 2) ..._authorityFields(),
                            if (_step == 3) ..._draftFields(),
                            if (_step == 4) ..._reviewFields(),
                            if (_error != null) ...[
                              const SizedBox(height: AppSpacing.sm),
                              Text(
                                _error!,
                                style: AppTypography.supporting.copyWith(
                                  color: AppColors.criticalText,
                                ),
                              ),
                            ],
                            if (_notice != null) ...[
                              const SizedBox(height: AppSpacing.sm),
                              Text(_notice!, style: AppTypography.supporting),
                            ],
                            const SizedBox(height: AppSpacing.lg),
                            IleButton(
                              label: _step == 4
                                  ? (_saving ? 'Submitting…' : 'Submit for review')
                                  : (_saving ? 'Saving…' : 'Save & continue'),
                              onPressed: _saving ? null : _saveStep,
                              isLoading: _saving,
                              isExpanded: true,
                            ),
                            if (_step > 0)
                              TextButton(
                                onPressed: _saving
                                    ? null
                                    : () => setState(() => _step -= 1),
                                child: const Text('Back'),
                              ),
                          ],
                        ),
    );
  }

  List<Widget> _profileFields() {
    return <Widget>[
      Text('Personal profile', style: AppTypography.sectionHeading),
      TextField(
        controller: _dobCtrl,
        decoration: const InputDecoration(
          labelText: 'Date of birth (YYYY-MM-DD)',
        ),
      ),
      TextField(
        controller: _addressCtrl,
        decoration: const InputDecoration(labelText: 'Residential address'),
      ),
      TextField(
        controller: _cityCtrl,
        decoration: const InputDecoration(labelText: 'Operating city'),
      ),
      TextField(
        controller: _bioCtrl,
        maxLines: 3,
        decoration: const InputDecoration(labelText: 'Short bio'),
      ),
    ];
  }

  List<Widget> _identityFields() {
    return <Widget>[
      Text('Government ID', style: AppTypography.sectionHeading),
      DropdownButtonFormField<String>(
        initialValue: _idType,
        items: const <DropdownMenuItem<String>>[
          DropdownMenuItem(value: 'NIN', child: Text('NIN')),
          DropdownMenuItem(value: 'PASSPORT', child: Text('Passport')),
          DropdownMenuItem(value: 'DRIVERS_LICENSE', child: Text("Driver's licence")),
          DropdownMenuItem(value: 'VOTERS_CARD', child: Text("Voter's card")),
        ],
        onChanged: (String? v) => setState(() => _idType = v ?? 'NIN'),
        decoration: const InputDecoration(labelText: 'ID type'),
      ),
      TextField(
        controller: _idNumberCtrl,
        decoration: const InputDecoration(labelText: 'ID number'),
      ),
      const SizedBox(height: AppSpacing.sm),
      IleButton(
        label: _idDocUrl == null ? 'Upload ID photo' : 'Replace ID photo',
        onPressed: () async {
          try {
            final String? url = await _pickAndUpload('kyc');
            if (url != null) setState(() => _idDocUrl = url);
          } on ApiException catch (err) {
            setState(() => _error = err.message);
          }
        },
        variant: IleButtonVariant.secondary,
        isExpanded: true,
      ),
      if (_idDocUrl != null)
        Text('ID uploaded', style: AppTypography.caption),
      const SizedBox(height: AppSpacing.sm),
      IleButton(
        label: _selfieUrl == null ? 'Upload selfie' : 'Replace selfie',
        onPressed: () async {
          try {
            final String? url = await _pickAndUpload('kyc');
            if (url != null) setState(() => _selfieUrl = url);
          } on ApiException catch (err) {
            setState(() => _error = err.message);
          }
        },
        variant: IleButtonVariant.secondary,
        isExpanded: true,
      ),
      if (_selfieUrl != null)
        Text('Selfie uploaded', style: AppTypography.caption),
    ];
  }

  List<Widget> _authorityFields() {
    return <Widget>[
      Text('Authority & payout bank', style: AppTypography.sectionHeading),
      DropdownButtonFormField<String>(
        initialValue: _hostType,
        items: const <DropdownMenuItem<String>>[
          DropdownMenuItem(value: 'INDIVIDUAL', child: Text('Individual')),
          DropdownMenuItem(value: 'COMPANY', child: Text('Company')),
        ],
        onChanged: (String? v) => setState(() => _hostType = v ?? 'INDIVIDUAL'),
        decoration: const InputDecoration(labelText: 'Host type'),
      ),
      DropdownButtonFormField<String>(
        initialValue: _authorityDocType,
        items: const <DropdownMenuItem<String>>[
          DropdownMenuItem(value: 'UTILITY_BILL', child: Text('Utility bill')),
          DropdownMenuItem(
            value: 'TENANCY_AGREEMENT',
            child: Text('Tenancy agreement'),
          ),
          DropdownMenuItem(
            value: 'ESTATE_CLEARANCE',
            child: Text('Estate clearance'),
          ),
          DropdownMenuItem(value: 'CAC', child: Text('CAC document')),
        ],
        onChanged: (String? v) =>
            setState(() => _authorityDocType = v ?? 'UTILITY_BILL'),
        decoration: const InputDecoration(labelText: 'Authority document'),
      ),
      IleButton(
        label: _authorityDocUrl == null
            ? 'Upload authority document'
            : 'Replace document',
        onPressed: () async {
          try {
            final String? url = await _pickAndUpload('kyc');
            if (url != null) setState(() => _authorityDocUrl = url);
          } on ApiException catch (err) {
            setState(() => _error = err.message);
          }
        },
        variant: IleButtonVariant.secondary,
        isExpanded: true,
      ),
      const SizedBox(height: AppSpacing.md),
      DropdownButtonFormField<String>(
        initialValue: _bankCode,
        isExpanded: true,
        items: _banks
            .map(
              (Map<String, dynamic> b) => DropdownMenuItem<String>(
                value: b['code']?.toString(),
                child: Text(b['name']?.toString() ?? ''),
              ),
            )
            .toList(),
        onChanged: (String? code) {
          String? name;
          for (final Map<String, dynamic> b in _banks) {
            if (b['code']?.toString() == code) {
              name = b['name']?.toString();
              break;
            }
          }
          setState(() {
            _bankCode = code;
            _bankName = name;
          });
        },
        decoration: const InputDecoration(labelText: 'Bank'),
      ),
      TextField(
        controller: _bankAccountCtrl,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: 'Account number (NUBAN)'),
      ),
      Text(
        'Account name is resolved by Paystack on the server — not typed here.',
        style: AppTypography.caption,
      ),
    ];
  }

  List<Widget> _draftFields() {
    return <Widget>[
      Text('First listing draft', style: AppTypography.sectionHeading),
      Text(
        'Optional draft title. You can finish the listing after KYC approval.',
        style: AppTypography.supporting,
      ),
      TextField(
        controller: _draftTitleCtrl,
        decoration: const InputDecoration(labelText: 'Draft title'),
      ),
    ];
  }

  List<Widget> _reviewFields() {
    final List<dynamic> missing =
        (_status?['missingRequirements'] as List<dynamic>?) ?? <dynamic>[];
    return <Widget>[
      Text('Review & submit', style: AppTypography.sectionHeading),
      Text(
        'Publishing stays blocked until an admin marks your KYC APPROVED.',
        style: AppTypography.supporting,
      ),
      const SizedBox(height: AppSpacing.sm),
      if (missing.isNotEmpty)
        ...missing.map(
          (dynamic m) => ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.warning_amber_outlined),
            title: Text(m.toString(), style: AppTypography.body),
          ),
        )
      else
        Text(
          'All required fields look complete. Submit for review.',
          style: AppTypography.body,
        ),
    ];
  }
}
