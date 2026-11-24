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
import '../../core/state/session_store.dart';
import '../../core/utils/formatters.dart';
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_card.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_error_state.dart';
import '../../shared/widgets/ile_loading_indicator.dart';
import '../../shared/widgets/location_autocomplete_sheet.dart';
import '../../core/models/location_result.dart';

/// Full Web-Mobile Parity Host Onboarding & KYC Wizard.
///
/// Implements the authoritative 6-stage verification flow:
/// Stage 1: Partner Qualification (Individual, Manager, Company) + Company info
/// Stage 2: Personal Profile & Operating Location (with calendar Date of Birth picker)
/// Stage 3: Identity & KYC Verification (Govt ID + Front/Back + Selfie)
/// Stage 4: Property Authority & Nigerian Bank Resolution (NUBAN + Paystack name inquiry)
/// Stage 5: Preliminary Property Details & Infrastructure Standards (4-point commitment)
/// Stage 6: Application Review & Official Submission Lifecycle (Under Review / Approved / Rejected)
class HostOnboardingScreen extends StatefulWidget {
  const HostOnboardingScreen({super.key});

  @override
  State<HostOnboardingScreen> createState() => _HostOnboardingScreenState();
}

class _HostOnboardingScreenState extends State<HostOnboardingScreen> {
  static const Color _brandEmerald = Color(0xFF073B2E);

  bool _loading = true;
  bool _saving = false;
  String? _error;
  String? _notice;
  int _stage = 1; // 1 to 6
  Map<String, dynamic>? _status;
  List<Map<String, dynamic>> _banks = <Map<String, dynamic>>[];

  // Stage 1: Partner Qualification
  String _hostType = 'individual_owner'; // 'individual_owner', 'property_manager', 'company'
  final TextEditingController _companyNameCtrl = TextEditingController();
  final TextEditingController _companyRegCtrl = TextEditingController();
  final TextEditingController _phoneCtrl = TextEditingController();

  // Stage 2: Personal Profile & Location
  final TextEditingController _firstNameCtrl = TextEditingController();
  final TextEditingController _lastNameCtrl = TextEditingController();
  final TextEditingController _dobCtrl = TextEditingController();
  final TextEditingController _addressCtrl = TextEditingController();
  String _operatingCity = 'Abuja';
  final TextEditingController _operatingAreasCtrl = TextEditingController();
  final TextEditingController _bioCtrl = TextEditingController();

  // Stage 3: Identity & KYC
  String _idType = 'nin'; // 'nin', 'drivers_license', 'passport', 'voters_card'
  final TextEditingController _idNumberCtrl = TextEditingController();
  String? _idFrontUrl;
  String? _idBackUrl;
  String? _selfieUrl;
  bool _isUploadingDoc = false;
  String? _uploadingField;

  // Stage 4: Authority & Bank Details
  String _authorityDocType = 'deed_of_ownership';
  String? _authorityDocUrl;
  String? _bankCode;
  String? _bankName;
  final TextEditingController _bankAccountCtrl = TextEditingController();
  String? _resolvedAccountName;
  bool _isResolvingAccount = false;
  String? _bankResolveError;

  // Stage 5: Property Draft & Infrastructure
  final TextEditingController _propertyTitleCtrl = TextEditingController();
  String _propertyType = 'Apartment';
  String _neighborhood = 'Maitama';
  int _bedrooms = 2;
  int _bathrooms = 2;
  int _nightlyRate = 65000;
  String _powerType = '';
  bool _commitPower = true;
  bool _commitSecurity = true;
  bool _commitInternet = true;
  bool _commitWater = true;

  // Verification state from backend
  String _verificationStatus = 'REGISTERED';
  String? _reviewFeedback;
  bool _isSubmitted = false;

  static const List<String> _cities = <String>[
    'Abuja',
    'Lagos',
    'Port Harcourt',
    'Ibadan',
    'Enugu',
    'Calabar',
    'Kaduna',
  ];

  static const Map<String, List<String>> _cityNeighborhoods = <String, List<String>>{
    'Abuja': <String>['Maitama', 'Wuse 2', 'Jabi', 'Gwarinpa', 'Asokoro', 'Guzape', 'Central Area'],
    'Lagos': <String>['Ikoyi', 'Victoria Island', 'Lekki Phase 1', 'Ikeja GRA', 'Banana Island', 'Epe'],
  };

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _companyNameCtrl.dispose();
    _companyRegCtrl.dispose();
    _phoneCtrl.dispose();
    _firstNameCtrl.dispose();
    _lastNameCtrl.dispose();
    _dobCtrl.dispose();
    _addressCtrl.dispose();
    _operatingAreasCtrl.dispose();
    _bioCtrl.dispose();
    _idNumberCtrl.dispose();
    _bankAccountCtrl.dispose();
    _propertyTitleCtrl.dispose();
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

      final Map<String, dynamic> status = Map<String, dynamic>.from(results[0] as Map);
      final List<Map<String, dynamic>> banks =
          (results[1] as List).cast<Map<String, dynamic>>();

      final Map<String, dynamic>? user = status['user'] is Map
          ? Map<String, dynamic>.from(status['user'] as Map)
          : null;
      final Map<String, dynamic>? profile = status['profile'] is Map
          ? Map<String, dynamic>.from(status['profile'] as Map)
          : null;

      if (user != null) {
        _firstNameCtrl.text = user['firstName']?.toString() ?? '';
        _lastNameCtrl.text = user['lastName']?.toString() ?? '';
        if (user['phone'] != null) _phoneCtrl.text = user['phone'].toString();
      }

      if (profile != null) {
        _hostType = profile['hostType']?.toString().toLowerCase() ?? 'individual_owner';
        if (_hostType == 'individual') _hostType = 'individual_owner';
        _companyNameCtrl.text = profile['companyName']?.toString() ?? '';
        _companyRegCtrl.text = profile['companyRegistrationNumber']?.toString() ?? '';
        if (profile['phone'] != null && _phoneCtrl.text.isEmpty) {
          _phoneCtrl.text = profile['phone'].toString();
        }

        _dobCtrl.text = profile['dateOfBirth']?.toString() ?? '';
        _addressCtrl.text = profile['residentialAddress']?.toString() ?? '';
        _operatingCity = profile['operatingCity']?.toString() ?? 'Abuja';
        _operatingAreasCtrl.text = profile['operatingAreas']?.toString() ?? '';
        _bioCtrl.text = profile['bio']?.toString() ?? '';

        _idType = profile['idType']?.toString().toLowerCase() ?? 'nin';
        _idNumberCtrl.text = profile['idNumber']?.toString() ?? '';
        _idFrontUrl = profile['identityDocumentUrl']?.toString();
        _idBackUrl = profile['idDocumentBackUrl']?.toString();
        _selfieUrl = profile['selfieUrl']?.toString();

        _authorityDocType = profile['authorityDocType']?.toString() ?? 'deed_of_ownership';
        _authorityDocUrl = profile['authorityDocUrl']?.toString();
        _bankName = profile['bankName']?.toString();
        _bankCode = profile['bankCode']?.toString();
        _bankAccountCtrl.text = profile['bankAccountNumber']?.toString() ?? '';
        _resolvedAccountName = profile['bankAccountName']?.toString();

        if (profile['propertyDraftData'] != null) {
          try {
            final dynamic parsed = jsonDecode(profile['propertyDraftData'].toString());
            if (parsed is Map) {
              _propertyTitleCtrl.text = parsed['propertyTitle']?.toString() ?? '';
              if (parsed['propertyType'] != null) _propertyType = parsed['propertyType'].toString();
              if (parsed['neighborhood'] != null) _neighborhood = parsed['neighborhood'].toString();
              if (parsed['bedrooms'] != null) _bedrooms = (parsed['bedrooms'] as num).toInt();
              if (parsed['bathrooms'] != null) _bathrooms = (parsed['bathrooms'] as num).toInt();
              if (parsed['nightlyRate'] != null) _nightlyRate = (parsed['nightlyRate'] as num).toInt();
              if (parsed['powerType'] != null) _powerType = parsed['powerType'].toString();
            }
          } catch (_) {}
        }

        _verificationStatus =
            profile['verificationStatus']?.toString().toUpperCase() ?? 'REGISTERED';
        _reviewFeedback = profile['reviewFeedback']?.toString();

        if (_verificationStatus == 'UNDER_REVIEW' || _verificationStatus == 'APPROVED') {
          _isSubmitted = true;
          _stage = 6;
        } else {
          final int serverStep = (profile['onboardingStep'] as num?)?.toInt() ??
              (status['step'] as num?)?.toInt() ??
              1;
          _stage = serverStep.clamp(1, 6);
        }
      }

      setState(() {
        _status = status;
        _banks = banks;
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

  Future<void> _pickAndUpload(String field, String folder) async {
    ImageSource source = ImageSource.gallery;
    if (field == 'selfie') {
      source = ImageSource.camera;
    } else {
      final ImageSource? selectedSource = await showModalBottomSheet<ImageSource>(
        context: context,
        builder: (BuildContext ctx) => SafeArea(
          child: Wrap(
            children: [
              ListTile(
                leading: const Icon(Icons.camera_alt_outlined),
                title: const Text('Take photo of document'),
                onTap: () => Navigator.of(ctx).pop(ImageSource.camera),
              ),
              ListTile(
                leading: const Icon(Icons.photo_library_outlined),
                title: const Text('Choose from photo gallery'),
                onTap: () => Navigator.of(ctx).pop(ImageSource.gallery),
              ),
            ],
          ),
        ),
      );
      if (selectedSource == null) return;
      source = selectedSource;
    }

    setState(() {
      _isUploadingDoc = true;
      _uploadingField = field;
      _error = null;
      _notice = null;
    });

    try {
      final ImagePicker picker = ImagePicker();
      final XFile? file = await picker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 2000,
      );

      if (file == null) {
        setState(() {
          _isUploadingDoc = false;
          _uploadingField = null;
        });
        return;
      }

      final Uint8List bytes = await file.readAsBytes();
      final String b64 = base64Encode(bytes);
      final String mime = file.mimeType ?? 'image/jpeg';

      if (!mounted) return;

      final Map<String, dynamic> res = await context.read<IleApi>().uploadImage(
            base64DataUriOrRaw: 'data:$mime;base64,$b64',
            folder: folder,
            mimeType: mime,
          );

      final String? url = res['url']?.toString();
      if (url != null && mounted) {
        setState(() {
          if (field == 'idFront') _idFrontUrl = url;
          if (field == 'idBack') _idBackUrl = url;
          if (field == 'selfie') _selfieUrl = url;
          if (field == 'authority') _authorityDocUrl = url;
          _notice = 'File uploaded successfully.';
        });
      }
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } catch (err) {
      setState(() => _error = err.toString());
    } finally {
      if (mounted) {
        setState(() {
          _isUploadingDoc = false;
          _uploadingField = null;
        });
      }
    }
  }

  Future<void> _selectDateOfBirth() async {
    final DateTime initial = _dobCtrl.text.isNotEmpty
        ? (DateTime.tryParse(_dobCtrl.text) ?? DateTime(1990, 1, 1))
        : DateTime(1990, 1, 1);

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1940),
      lastDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
      builder: (BuildContext context, Widget? child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: _brandEmerald,
              onPrimary: Colors.white,
              surface: Colors.white,
              onSurface: AppColors.foreground,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      final String formatted =
          "${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
      setState(() {
        _dobCtrl.text = formatted;
      });
    }
  }

  Future<void> _openLocationSearch() async {
    final LocationResult? loc = await LocationAutocompleteSheet.show(
      context,
      initialQuery: _addressCtrl.text,
      title: 'Find Residential or Office Address',
    );
    if (loc == null || !mounted) return;

    setState(() {
      _addressCtrl.text =
          loc.displayName.isNotEmpty ? loc.displayName : loc.shortLabel;
      if (loc.city.isNotEmpty) {
        for (final String c in _cities) {
          if (loc.city.toLowerCase().contains(c.toLowerCase()) ||
              c.toLowerCase().contains(loc.city.toLowerCase())) {
            _operatingCity = c;
            final List<String>? nhs = _cityNeighborhoods[c];
            if (nhs != null && nhs.isNotEmpty) {
              _neighborhood = nhs.first;
            }
            break;
          }
        }
      }
      if (loc.neighborhood.isNotEmpty) {
        if (_operatingAreasCtrl.text.isEmpty) {
          _operatingAreasCtrl.text = loc.neighborhood;
        } else if (!_operatingAreasCtrl.text
            .toLowerCase()
            .contains(loc.neighborhood.toLowerCase())) {
          _operatingAreasCtrl.text =
              '${_operatingAreasCtrl.text}, ${loc.neighborhood}';
        }
      }
    });
  }

  Future<void> _verifyBankAccount() async {
    final String acc = _bankAccountCtrl.text.replaceAll(RegExp(r'\D'), '');
    if (_bankCode == null || _bankCode!.isEmpty) {
      setState(() => _bankResolveError = 'Please select your bank first.');
      return;
    }
    if (acc.length != 10) {
      setState(() => _bankResolveError = 'Account number must be exactly 10 digits.');
      return;
    }

    setState(() {
      _isResolvingAccount = true;
      _bankResolveError = null;
      _resolvedAccountName = null;
    });

    try {
      final Map<String, dynamic> res = await context.read<IleApi>().resolveBankAccount(
            bankCode: _bankCode!,
            accountNumber: acc,
          );

      if (res['resolved'] == true && res['accountName'] != null) {
        setState(() {
          _resolvedAccountName = res['accountName'].toString();
          if (res['bankName'] != null) _bankName = res['bankName'].toString();
        });
      } else {
        setState(() {
          _bankResolveError =
              res['error']?.toString() ?? 'Could not resolve Nigerian bank account.';
        });
      }
    } on ApiException catch (err) {
      setState(() => _bankResolveError = err.message);
    } catch (err) {
      setState(() => _bankResolveError = err.toString());
    } finally {
      if (mounted) setState(() => _isResolvingAccount = false);
    }
  }

  Future<void> _saveStage(int stage) async {
    setState(() {
      _saving = true;
      _error = null;
      _notice = null;
    });

    final IleApi api = context.read<IleApi>();

    try {
      switch (stage) {
        case 1:
          if (_hostType == 'company' && _companyNameCtrl.text.trim().isEmpty) {
            throw ApiException(message: 'Please enter company name.', statusCode: 400);
          }
          await api.updateHostOnboardingAuthority(<String, dynamic>{
            'hostType': _hostType,
            if (_hostType == 'company') 'companyName': _companyNameCtrl.text.trim(),
            if (_hostType == 'company')
              'companyRegistrationNumber': _companyRegCtrl.text.trim(),
          });
          if (_phoneCtrl.text.trim().isNotEmpty) {
            await api.updateHostOnboardingProfile(<String, dynamic>{
              'phone': _phoneCtrl.text.trim(),
            });
          }
          setState(() {
            _stage = 2;
            _notice = 'Business qualification saved.';
          });
          break;

        case 2:
          if (_addressCtrl.text.trim().isEmpty || _operatingCity.isEmpty) {
            throw ApiException(
              message: 'Please enter residential address and operating city.',
              statusCode: 400,
            );
          }
          await api.updateHostOnboardingProfile(<String, dynamic>{
            'firstName': _firstNameCtrl.text.trim(),
            'lastName': _lastNameCtrl.text.trim(),
            'phone': _phoneCtrl.text.trim(),
            'dateOfBirth': _dobCtrl.text.trim(),
            'residentialAddress': _addressCtrl.text.trim(),
            'operatingCity': _operatingCity,
            'operatingAreas': _operatingAreasCtrl.text.trim(),
            'bio': _bioCtrl.text.trim(),
          });
          setState(() {
            _stage = 3;
            _notice = 'Personal profile saved.';
          });
          break;

        case 3:
          if (_idNumberCtrl.text.trim().isEmpty) {
            throw ApiException(message: 'Please enter your ID number.', statusCode: 400);
          }
          if (_idFrontUrl == null) {
            throw ApiException(message: 'Please upload your ID document.', statusCode: 400);
          }
          if (_selfieUrl == null) {
            throw ApiException(
              message: 'Please take or upload a verification selfie.',
              statusCode: 400,
            );
          }
          await api.updateHostOnboardingIdentity(<String, dynamic>{
            'idType': _idType,
            'idNumber': _idNumberCtrl.text.trim(),
            'identityDocumentUrl': _idFrontUrl,
            if (_idBackUrl != null) 'idDocumentBackUrl': _idBackUrl,
            'selfieUrl': _selfieUrl,
          });
          setState(() {
            _stage = 4;
            _notice = 'Identity documents submitted.';
          });
          break;

        case 4:
          if (_authorityDocUrl == null) {
            throw ApiException(
              message: 'Please upload property ownership or authority document.',
              statusCode: 400,
            );
          }
          if (_bankCode == null || _bankAccountCtrl.text.trim().length < 10) {
            throw ApiException(
              message: 'Select a Nigerian bank and enter a valid 10-digit NUBAN.',
              statusCode: 400,
            );
          }
          await api.updateHostOnboardingAuthority(<String, dynamic>{
            'hostType': _hostType,
            'authorityDocType': _authorityDocType,
            'authorityDocUrl': _authorityDocUrl,
            'bankName': _bankName,
            'bankCode': _bankCode,
            'bankAccountNumber': _bankAccountCtrl.text.trim(),
            'bankAccountName': _resolvedAccountName ?? '',
          });
          setState(() {
            _stage = 5;
            _notice = 'Authority and bank details recorded.';
          });
          break;

        case 5:
          if (_propertyTitleCtrl.text.trim().isEmpty) {
            throw ApiException(
              message: 'Please provide a title for your first property listing.',
              statusCode: 400,
            );
          }
          if (!_commitPower || !_commitSecurity || !_commitInternet || !_commitWater) {
            throw ApiException(
              message: 'You must agree to all 4 Ilé Quality Infrastructure Standards.',
              statusCode: 400,
            );
          }
          await api.saveHostOnboardingPropertyDraft(<String, dynamic>{
            'propertyTitle': _propertyTitleCtrl.text.trim(),
            'propertyType': _propertyType,
            'city': _operatingCity,
            'neighborhood': _neighborhood,
            'bedrooms': _bedrooms,
            'bathrooms': _bathrooms,
            'nightlyRate': _nightlyRate,
            'powerType': _powerType,
            'infrastructureStandards': <String, bool>{
              'power': _commitPower,
              'security': _commitSecurity,
              'internet': _commitInternet,
              'water': _commitWater,
            },
          });
          setState(() {
            _stage = 6;
            _notice = 'Property draft details saved.';
          });
          break;

        case 6:
          await api.submitHostOnboarding();
          if (!mounted) return;
          final SessionStore session = context.read<SessionStore>();
          await session.restoreSession();
          if (!mounted) return;
          setState(() {
            _isSubmitted = true;
            _verificationStatus = 'UNDER_REVIEW';
            _notice = 'Application successfully submitted for official review!';
          });
          break;
      }
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } catch (err) {
      setState(() => _error = err.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  int get _progressPct {
    if (_verificationStatus == 'APPROVED') return 100;
    if (_verificationStatus == 'UNDER_REVIEW' || _isSubmitted) return 95;
    return (((_stage - 1) / 5) * 80 + 20).round();
  }

  @override
  Widget build(BuildContext context) {
    final bool approved = _verificationStatus == 'APPROVED';
    final bool underReview = _verificationStatus == 'UNDER_REVIEW' || _isSubmitted;
    final bool isRejected = _verificationStatus == 'REJECTED';

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        elevation: 0,
        leading: const IleCircularBackButton(),
        title: Text(
          'Host Verification',
          style: AppTypography.sectionHeading.copyWith(
            color: _brandEmerald,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : _error != null && _status == null
              ? IleErrorState(
                  title: 'Could not load verification status',
                  message: _error!,
                  onRetry: _bootstrap,
                )
              : ListView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.screenHorizontal,
                    vertical: 12,
                  ),
                  children: <Widget>[
                    // Top Progress & Title Card
                    _buildHeader(approved, underReview, isRejected),
                    const SizedBox(height: AppSpacing.lg),

                    if (_error != null) ...<Widget>[
                      _buildAlert(
                        text: _error!,
                        color: const Color(0xFFFEE2E2),
                        textColor: const Color(0xFF991B1B),
                        icon: Icons.error_outline_rounded,
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],

                    if (_notice != null) ...<Widget>[
                      _buildAlert(
                        text: _notice!,
                        color: const Color(0xFFD1FAE5),
                        textColor: const Color(0xFF065F46),
                        icon: Icons.check_circle_outline_rounded,
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],

                    if (isRejected && _reviewFeedback != null) ...<Widget>[
                      _buildAlert(
                        text: 'Action required by verification team: $_reviewFeedback',
                        color: const Color(0xFFFEF3C7),
                        textColor: const Color(0xFF92400E),
                        icon: Icons.warning_amber_rounded,
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],

                    // Current Stage Content
                    if (_stage == 1) _buildStage1(),
                    if (_stage == 2) _buildStage2(),
                    if (_stage == 3) _buildStage3(),
                    if (_stage == 4) _buildStage4(),
                    if (_stage == 5) _buildStage5(),
                    if (_stage == 6) _buildStage6(approved, underReview, isRejected),

                    const SizedBox(height: 48),
                  ],
                ),
    );
  }

  Widget _buildHeader(bool approved, bool underReview, bool isRejected) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: const <BoxShadow>[
          BoxShadow(
            color: Color(0x0A000000),
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Row(
                children: <Widget>[
                  const Icon(Icons.verified_user_rounded, color: _brandEmerald, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'PARTNER ONBOARDING',
                    style: AppTypography.microLabel.copyWith(
                      color: _brandEmerald,
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
              Text(
                '$_progressPct% Complete',
                style: AppTypography.caption.copyWith(
                  color: _brandEmerald,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: _progressPct / 100,
              backgroundColor: const Color(0xFFE5E7EB),
              valueColor: const AlwaysStoppedAnimation<Color>(_brandEmerald),
              minHeight: 6,
            ),
          ),
          const SizedBox(height: 14),
          // Step pill tabs
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: <Map<String, dynamic>>[
                <String, dynamic>{'num': 1, 'label': 'Business'},
                <String, dynamic>{'num': 2, 'label': 'Profile'},
                <String, dynamic>{'num': 3, 'label': 'Identity'},
                <String, dynamic>{'num': 4, 'label': 'Authority'},
                <String, dynamic>{'num': 5, 'label': 'Property'},
                <String, dynamic>{'num': 6, 'label': 'Review'},
              ].map((Map<String, dynamic> item) {
                final int num = item['num'] as int;
                final String label = item['label'] as String;
                final bool isCurrent = _stage == num;
                final bool isPast = _stage > num;

                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: (!underReview && !approved && (isPast || isCurrent))
                        ? () => setState(() => _stage = num)
                        : null,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: isCurrent
                            ? _brandEmerald
                            : (isPast
                                ? const Color(0xFF073B2E).withValues(alpha: 0.1)
                                : const Color(0xFFF3F4F6)),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '$num. $label',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w500,
                          color: isCurrent
                              ? Colors.white
                              : (isPast ? _brandEmerald : const Color(0xFF9CA3AF)),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAlert({
    required String text,
    required Color color,
    required Color textColor,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, color: textColor, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(fontSize: 13, color: textColor, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  // ─── STAGE 1: BUSINESS QUALIFICATION ───
  Widget _buildStage1() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('Step 1 of 6', style: AppTypography.microLabel.copyWith(color: _brandEmerald)),
        const SizedBox(height: 4),
        Text('Property Partner Qualification', style: AppTypography.cardTitle),
        const SizedBox(height: 4),
        Text(
          'Select how you operate your properties in Nigeria.',
          style: AppTypography.supporting,
        ),
        const SizedBox(height: AppSpacing.lg),

        _buildHostTypeCard(
          type: 'individual_owner',
          title: 'I own the property',
          subtitle: 'Individual Property Owner',
          desc: 'I directly own this property and hold title deed, C of O, or utility records.',
          icon: Icons.home_rounded,
        ),
        const SizedBox(height: AppSpacing.sm),
        _buildHostTypeCard(
          type: 'property_manager',
          title: 'I manage property for someone else',
          subtitle: 'Authorized Property Manager',
          desc: 'I am contracted with written authorization or mandate letter to list and host.',
          icon: Icons.real_estate_agent_rounded,
        ),
        const SizedBox(height: AppSpacing.sm),
        _buildHostTypeCard(
          type: 'company',
          title: 'I represent a company / brand',
          subtitle: 'Corporate Entity / Hospitality Brand',
          desc: 'The property is managed or owned by a registered Nigerian business entity.',
          icon: Icons.business_rounded,
        ),
        const SizedBox(height: AppSpacing.lg),

        if (_hostType == 'company') ...<Widget>[
          TextField(
            controller: _companyNameCtrl,
            decoration: const InputDecoration(
              labelText: 'Company / Brand Name *',
              hintText: 'e.g. Apex Luxury Suites Ltd',
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          TextField(
            controller: _companyRegCtrl,
            decoration: const InputDecoration(
              labelText: 'CAC Registration Number (RC / BN)',
              hintText: 'e.g. RC 1234567',
            ),
          ),
          const SizedBox(height: AppSpacing.md),
        ],

        TextField(
          controller: _phoneCtrl,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
            labelText: 'Operating Nigerian Phone Number *',
            hintText: '+234 801 234 5678',
            prefixIcon: Icon(Icons.phone_outlined),
          ),
        ),
        const SizedBox(height: AppSpacing.xl),

        IleButton(
          label: _saving ? 'Saving...' : 'Save & Proceed to Profile →',
          onPressed: _saving ? null : () => _saveStage(1),
          isLoading: _saving,
          isExpanded: true,
        ),
      ],
    );
  }

  Widget _buildHostTypeCard({
    required String type,
    required String title,
    required String subtitle,
    required String desc,
    required IconData icon,
  }) {
    final bool selected = _hostType == type;

    return InkWell(
      onTap: () => setState(() => _hostType = type),
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: selected ? const Color(0xFF073B2E).withValues(alpha: 0.05) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? _brandEmerald : AppColors.border,
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Icon(
              selected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
              color: selected ? _brandEmerald : const Color(0xFF9CA3AF),
              size: 20,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: selected ? _brandEmerald : AppColors.foreground,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    desc,
                    style: const TextStyle(
                      fontSize: 12,
                      color: Color(0xFF6B7280),
                      height: 1.3,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── STAGE 2: PERSONAL PROFILE & LOCATION ───
  Widget _buildStage2() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('Step 2 of 6', style: AppTypography.microLabel.copyWith(color: _brandEmerald)),
        const SizedBox(height: 4),
        Text('Personal Profile & Operating Location', style: AppTypography.cardTitle),
        const SizedBox(height: 4),
        Text(
          'Ilé operates in Abuja, Lagos, and primary Nigerian metropolitan areas.',
          style: AppTypography.supporting,
        ),
        const SizedBox(height: AppSpacing.lg),

        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                controller: _firstNameCtrl,
                decoration: const InputDecoration(labelText: 'First Name *'),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: TextField(
                controller: _lastNameCtrl,
                decoration: const InputDecoration(labelText: 'Last Name *'),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),

        // Date of Birth Calendar Picker Field
        InkWell(
          onTap: _selectDateOfBirth,
          borderRadius: BorderRadius.circular(12),
          child: IgnorePointer(
            child: TextField(
              controller: _dobCtrl,
              decoration: const InputDecoration(
                labelText: 'Date of Birth (YYYY-MM-DD) *',
                hintText: 'Select from calendar',
                suffixIcon: Icon(Icons.calendar_today_outlined, color: _brandEmerald),
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        TextField(
          controller: _addressCtrl,
          decoration: InputDecoration(
            labelText: 'Residential / Office Address *',
            hintText: 'Street address, building, suite',
            suffixIcon: IconButton(
              icon: const Icon(Icons.location_searching, color: _brandEmerald),
              tooltip: 'Search address or detect GPS location',
              onPressed: _openLocationSearch,
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        DropdownButtonFormField<String>(
          initialValue: _operatingCity,
          decoration: const InputDecoration(labelText: 'Primary Operating City *'),
          items: _cities
              .map((String c) => DropdownMenuItem<String>(value: c, child: Text(c)))
              .toList(),
          onChanged: (String? val) {
            if (val != null) {
              setState(() {
                _operatingCity = val;
                // auto update neighborhood default if city changes
                final List<String>? nhs = _cityNeighborhoods[val];
                if (nhs != null && nhs.isNotEmpty) {
                  _neighborhood = nhs.first;
                }
              });
            }
          },
        ),
        const SizedBox(height: AppSpacing.md),

        TextField(
          controller: _operatingAreasCtrl,
          decoration: const InputDecoration(
            labelText: 'Operating Neighborhoods / Districts',
            hintText: 'e.g. Maitama, Wuse 2, Jabi, Lekki Phase 1',
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        TextField(
          controller: _bioCtrl,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Short Host Bio',
            hintText: 'Tell guests about your hospitality experience and commitment.',
          ),
        ),
        const SizedBox(height: AppSpacing.xl),

        Row(
          children: <Widget>[
            OutlinedButton(
              onPressed: () => setState(() => _stage = 1),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Back'),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: IleButton(
                label: _saving ? 'Saving...' : 'Save & Proceed to Identity →',
                onPressed: _saving ? null : () => _saveStage(2),
                isLoading: _saving,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ─── STAGE 3: IDENTITY & KYC ───
  Widget _buildStage3() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('Step 3 of 6', style: AppTypography.microLabel.copyWith(color: _brandEmerald)),
        const SizedBox(height: 4),
        Text('Identity Verification & KYC', style: AppTypography.cardTitle),
        const SizedBox(height: 4),
        Text(
          'To ensure trust across the Ilé platform, government ID and selfie verification are mandatory.',
          style: AppTypography.supporting,
        ),
        const SizedBox(height: AppSpacing.lg),

        DropdownButtonFormField<String>(
          initialValue: _idType,
          decoration: const InputDecoration(labelText: 'Government ID Type *'),
          items: const <DropdownMenuItem<String>>[
            DropdownMenuItem(value: 'nin', child: Text('National Identification Number (NIN)')),
            DropdownMenuItem(value: 'drivers_license', child: Text("Driver's Licence (FRSC)")),
            DropdownMenuItem(value: 'passport', child: Text('International Passport')),
            DropdownMenuItem(value: 'voters_card', child: Text("Voter's Card (INEC PVC)")),
          ],
          onChanged: (String? val) => setState(() => _idType = val ?? 'nin'),
        ),
        const SizedBox(height: AppSpacing.md),

        TextField(
          controller: _idNumberCtrl,
          decoration: const InputDecoration(
            labelText: 'ID / NIN Number *',
            hintText: 'Enter registration number exactly as on card',
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // Document Upload Cards
        _buildUploadCard(
          field: 'idFront',
          label: 'Front of Government ID *',
          hint: 'Clear, well-lit photo or scan of front side',
          url: _idFrontUrl,
          folder: 'kyc',
          icon: Icons.badge_outlined,
        ),
        const SizedBox(height: AppSpacing.md),

        _buildUploadCard(
          field: 'idBack',
          label: 'Back of Government ID (Optional)',
          hint: 'Back side of card or slip',
          url: _idBackUrl,
          folder: 'kyc',
          icon: Icons.flip_to_back_rounded,
        ),
        const SizedBox(height: AppSpacing.md),

        _buildUploadCard(
          field: 'selfie',
          label: 'Verification Selfie Photo *',
          hint: 'Clear photo of your face, matching the ID document',
          url: _selfieUrl,
          folder: 'kyc',
          icon: Icons.camera_alt_outlined,
        ),
        const SizedBox(height: AppSpacing.xl),

        Row(
          children: <Widget>[
            OutlinedButton(
              onPressed: () => setState(() => _stage = 2),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Back'),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: IleButton(
                label: _saving ? 'Saving...' : 'Save & Proceed to Authority →',
                onPressed: _saving ? null : () => _saveStage(3),
                isLoading: _saving,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildUploadCard({
    required String field,
    required String label,
    required String hint,
    required String? url,
    required String folder,
    required IconData icon,
  }) {
    final bool uploaded = url != null && url.isNotEmpty;
    final bool isUploading = _isUploadingDoc && _uploadingField == field;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: uploaded ? _brandEmerald : AppColors.border,
          width: uploaded ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: <Widget>[
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: uploaded ? const Color(0xFFD1FAE5) : const Color(0xFFF3F4F6),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              uploaded ? Icons.check_circle_rounded : icon,
              color: uploaded ? const Color(0xFF065F46) : const Color(0xFF6B7280),
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  label,
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
                Text(
                  uploaded ? 'Document attached' : hint,
                  style: TextStyle(
                    fontSize: 11,
                    color: uploaded ? const Color(0xFF065F46) : const Color(0xFF9CA3AF),
                  ),
                ),
              ],
            ),
          ),
          ElevatedButton(
            onPressed: isUploading ? null : () => _pickAndUpload(field, folder),
            style: ElevatedButton.styleFrom(
              backgroundColor: uploaded ? const Color(0xFFF3F4F6) : _brandEmerald,
              foregroundColor: uploaded ? AppColors.foreground : Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: isUploading
                ? const SizedBox(
                    width: 14,
                    height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Text(uploaded ? 'Replace' : 'Upload', style: const TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }

  // ─── STAGE 4: AUTHORITY & NIGERIAN BANK PAYOUTS ───
  Widget _buildStage4() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('Step 4 of 6', style: AppTypography.microLabel.copyWith(color: _brandEmerald)),
        const SizedBox(height: 4),
        Text('Property Authority & Nigerian Bank Payouts', style: AppTypography.cardTitle),
        const SizedBox(height: 4),
        Text(
          'Provide proof of ownership or authorization, and link your Nigerian bank account for automated payouts.',
          style: AppTypography.supporting,
        ),
        const SizedBox(height: AppSpacing.lg),

        DropdownButtonFormField<String>(
          initialValue: _authorityDocType,
          decoration: const InputDecoration(labelText: 'Authority Credential Type *'),
          items: const <DropdownMenuItem<String>>[
            DropdownMenuItem(
              value: 'deed_of_ownership',
              child: Text('Proof of Ownership (Deed of Assignment / C of O)'),
            ),
            DropdownMenuItem(
              value: 'utility_bill',
              child: Text('Recent Utility Bill (Electricity token / NEPA)'),
            ),
            DropdownMenuItem(
              value: 'management_agreement',
              child: Text('Management Agreement / Mandate Letter'),
            ),
            DropdownMenuItem(
              value: 'tenancy_agreement',
              child: Text('Long-term Tenancy / Sublease Authorization'),
            ),
            DropdownMenuItem(
              value: 'cac_document',
              child: Text('CAC Registration Certificate'),
            ),
          ],
          onChanged: (String? val) =>
              setState(() => _authorityDocType = val ?? 'deed_of_ownership'),
        ),
        const SizedBox(height: AppSpacing.md),

        _buildUploadCard(
          field: 'authority',
          label: 'Ownership / Authority Document *',
          hint: 'Deed, C of O, Utility bill, or Mandate letter (Photo/PDF)',
          url: _authorityDocUrl,
          folder: 'kyc',
          icon: Icons.description_outlined,
        ),
        const SizedBox(height: AppSpacing.xl),

        // Bank Details Section
        Text('Nigerian Payout Bank Account', style: AppTypography.sectionHeading),
        const SizedBox(height: 4),
        Text(
          'Earnings from completed stays are disbursed directly via NIBSS / Paystack.',
          style: AppTypography.supporting,
        ),
        const SizedBox(height: AppSpacing.md),

        DropdownButtonFormField<String>(
          initialValue: _bankCode,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Select Bank *'),
          items: _banks.map((Map<String, dynamic> b) {
            return DropdownMenuItem<String>(
              value: b['code']?.toString(),
              child: Text(b['name']?.toString() ?? ''),
            );
          }).toList(),
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
              _resolvedAccountName = null;
              _bankResolveError = null;
            });
          },
        ),
        const SizedBox(height: AppSpacing.md),

        TextField(
          controller: _bankAccountCtrl,
          keyboardType: TextInputType.number,
          maxLength: 10,
          decoration: InputDecoration(
            labelText: '10-Digit NUBAN Account Number *',
            hintText: '0123456789',
            counterText: '',
            suffixIcon: IconButton(
              icon: _isResolvingAccount
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.search_rounded, color: _brandEmerald),
              onPressed: _isResolvingAccount ? null : _verifyBankAccount,
              tooltip: 'Verify Bank Account',
            ),
          ),
          onChanged: (_) {
            if (_resolvedAccountName != null) {
              setState(() => _resolvedAccountName = null);
            }
          },
        ),

        if (_resolvedAccountName != null) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: const Color(0xFFD1FAE5),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF10B981)),
            ),
            child: Row(
              children: <Widget>[
                const Icon(Icons.check_circle_rounded, color: Color(0xFF065F46), size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      const Text(
                        'Verified Account Holder',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF065F46),
                        ),
                      ),
                      Text(
                        _resolvedAccountName!,
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF065F46),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],

        if (_bankResolveError != null) ...<Widget>[
          const SizedBox(height: AppSpacing.sm),
          Text(
            _bankResolveError!,
            style: const TextStyle(fontSize: 12, color: AppColors.criticalText),
          ),
        ],

        const SizedBox(height: AppSpacing.xl),

        Row(
          children: <Widget>[
            OutlinedButton(
              onPressed: () => setState(() => _stage = 3),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Back'),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: IleButton(
                label: _saving ? 'Saving...' : 'Save & Proceed to Property →',
                onPressed: _saving ? null : () => _saveStage(4),
                isLoading: _saving,
              ),
            ),
          ],
        ),
      ],
    );
  }

  // ─── STAGE 5: PROPERTY DRAFT & INFRASTRUCTURE STANDARDS ───
  Widget _buildStage5() {
    final List<String> neighborhoods =
        _cityNeighborhoods[_operatingCity] ?? <String>['Maitama', 'Wuse 2', 'Jabi', 'Gwarinpa'];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('Step 5 of 6', style: AppTypography.microLabel.copyWith(color: _brandEmerald)),
        const SizedBox(height: 4),
        Text('Preliminary Property & Infrastructure', style: AppTypography.cardTitle),
        const SizedBox(height: 4),
        Text(
          'Tell us about your first property and confirm the 4 Ilé Infrastructure Standards.',
          style: AppTypography.supporting,
        ),
        const SizedBox(height: AppSpacing.lg),

        TextField(
          controller: _propertyTitleCtrl,
          decoration: const InputDecoration(
            labelText: 'Listing Title *',
            hintText: 'e.g. The Olive Residence, Maitama',
          ),
        ),
        const SizedBox(height: AppSpacing.md),

        DropdownButtonFormField<String>(
          initialValue: _propertyType,
          decoration: const InputDecoration(labelText: 'Property Type *'),
          items: const <String>[
            'Apartment',
            'Serviced Apartment',
            'House / Duplex',
            'Studio',
            'Villa',
          ].map((String t) => DropdownMenuItem<String>(value: t, child: Text(t))).toList(),
          onChanged: (String? val) => setState(() => _propertyType = val ?? 'Apartment'),
        ),
        const SizedBox(height: AppSpacing.md),

        DropdownButtonFormField<String>(
          initialValue: neighborhoods.contains(_neighborhood) ? _neighborhood : neighborhoods.first,
          decoration: const InputDecoration(labelText: 'Neighborhood / District *'),
          items: neighborhoods
              .map((String nh) => DropdownMenuItem<String>(value: nh, child: Text(nh)))
              .toList(),
          onChanged: (String? val) => setState(() => _neighborhood = val ?? neighborhoods.first),
        ),
        const SizedBox(height: AppSpacing.md),

        Row(
          children: <Widget>[
            Expanded(
              child: _buildCounterField(
                label: 'Bedrooms',
                value: _bedrooms,
                onChanged: (int v) => setState(() => _bedrooms = v),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: _buildCounterField(
                label: 'Bathrooms',
                value: _bathrooms,
                onChanged: (int v) => setState(() => _bathrooms = v),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),

        TextField(
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: 'Nightly Rate (₦ NGN) *',
            prefixText: '₦ ',
            hintText: '65,000',
          ),
          controller: TextEditingController(text: _nightlyRate.toString()),
          onChanged: (String v) {
            final int? val = int.tryParse(v);
            if (val != null) _nightlyRate = val;
          },
        ),
        const SizedBox(height: AppSpacing.md),

        DropdownButtonFormField<String>(
          initialValue: _powerType,
          decoration: const InputDecoration(labelText: 'Power Setup *'),
          items: const <String>[
            'Solar + Inverter with Generator Backup',
            '24/7 Dedicated Estate Transformer + Gen',
            'Dual High-Capacity Generators',
            'Inverter + Central Grid',
          ].map((String p) => DropdownMenuItem<String>(value: p, child: Text(p))).toList(),
          onChanged: (String? val) =>
              setState(() => _powerType = val ?? ''),
        ),
        const SizedBox(height: AppSpacing.lg),

        // 4 Quality Standards Checkboxes Card
        IleCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  const Icon(Icons.shield_outlined, color: _brandEmerald, size: 20),
                  const SizedBox(width: 8),
                  Text(
                    'Ilé Infrastructure Commitment',
                    style: AppTypography.cardTitle.copyWith(fontSize: 14),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Every property on Ilé is booked by discerning guests expecting seamless uptime:',
                style: AppTypography.caption,
              ),
              const SizedBox(height: AppSpacing.md),

              _buildCheckboxItem(
                checked: _commitPower,
                title: 'Guaranteed 24/7 Power',
                desc: 'Automatic switchover without prolonged blackouts or outages.',
                onChanged: (bool v) => setState(() => _commitPower = v),
              ),
              _buildCheckboxItem(
                checked: _commitSecurity,
                title: 'Active Estate Security',
                desc: 'Gated perimeter or controlled entrance access clearance.',
                onChanged: (bool v) => setState(() => _commitSecurity = v),
              ),
              _buildCheckboxItem(
                checked: _commitInternet,
                title: 'High-Speed Wi-Fi',
                desc: 'Reliable fiber broadband connection available for guests.',
                onChanged: (bool v) => setState(() => _commitInternet = v),
              ),
              _buildCheckboxItem(
                checked: _commitWater,
                title: 'Treated Clean Water',
                desc: 'Overhead reservoir backup with consistent pressurized water.',
                onChanged: (bool v) => setState(() => _commitWater = v),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),

        Row(
          children: <Widget>[
            OutlinedButton(
              onPressed: () => setState(() => _stage = 4),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Back'),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: IleButton(
                label: _saving ? 'Saving...' : 'Save & Proceed to Review →',
                onPressed: _saving ? null : () => _saveStage(5),
                isLoading: _saving,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildCounterField({
    required String label,
    required int value,
    required ValueChanged<int> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
              Text('$value', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            ],
          ),
          Row(
            children: <Widget>[
              IconButton(
                icon: const Icon(Icons.remove_circle_outline, size: 20),
                onPressed: value > 1 ? () => onChanged(value - 1) : null,
              ),
              IconButton(
                icon: const Icon(Icons.add_circle_outline, size: 20),
                onPressed: value < 20 ? () => onChanged(value + 1) : null,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCheckboxItem({
    required bool checked,
    required String title,
    required String desc,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: InkWell(
        onTap: () => onChanged(!checked),
        borderRadius: BorderRadius.circular(8),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Checkbox(
              value: checked,
              activeColor: _brandEmerald,
              onChanged: (bool? v) => onChanged(v ?? false),
            ),
            const SizedBox(width: 4),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(
                    title,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                  ),
                  Text(
                    desc,
                    style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── STAGE 6: FINAL REVIEW & VERIFICATION LIFECYCLE ───
  Widget _buildStage6(bool approved, bool underReview, bool isRejected) {
    if (approved) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: Column(
            children: <Widget>[
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: const Color(0xFFD1FAE5),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.verified_rounded, color: Color(0xFF065F46), size: 40),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Verification Approved!',
                style: AppTypography.cardTitle.copyWith(fontSize: 20),
              ),
              const SizedBox(height: 6),
              Text(
                'Your partner account is active. You can now publish listings and accept bookings.',
                textAlign: TextAlign.center,
                style: AppTypography.supporting,
              ),
              const SizedBox(height: AppSpacing.xl),
              IleButton(
                label: 'Go to Host Dashboard',
                onPressed: () => context.go(AppRoutes.hostDashboard),
                isExpanded: true,
              ),
            ],
          ),
        ),
      );
    }

    if (underReview) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: Column(
            children: <Widget>[
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Icon(Icons.hourglass_top_rounded, color: Color(0xFF92400E), size: 40),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                'Application Under Priority Review',
                style: AppTypography.cardTitle.copyWith(fontSize: 20),
              ),
              const SizedBox(height: 6),
              Text(
                'Thank you, ${_firstNameCtrl.text.isNotEmpty ? _firstNameCtrl.text : 'Partner'}. Your identity documents, property authority credentials, and Nigerian bank details have been safely received by our compliance team.',
                textAlign: TextAlign.center,
                style: AppTypography.supporting,
              ),
              const SizedBox(height: AppSpacing.lg),
              IleCard(
                child: Column(
                  children: <Widget>[
                    _buildSummaryRow('Status', 'Under Priority Review', isBadge: true),
                    const Divider(height: 20),
                    _buildSummaryRow('Estimated Time', '24 – 48 Hours'),
                    const Divider(height: 20),
                    _buildSummaryRow('Operating City', _operatingCity),
                    const Divider(height: 20),
                    _buildSummaryRow('Contact Support', 'compliance@ile.ng'),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
              OutlinedButton(
                onPressed: () => context.go(AppRoutes.hostDashboard),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size.fromHeight(48),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Return to Host Home'),
              ),
            ],
          ),
        ),
      );
    }

    // Unsubmitted Review Stage
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text('Step 6 of 6', style: AppTypography.microLabel.copyWith(color: _brandEmerald)),
        const SizedBox(height: 4),
        Text('Review Application & Submit', style: AppTypography.cardTitle),
        const SizedBox(height: 4),
        Text(
          'Confirm your details before dispatching to the moderation team.',
          style: AppTypography.supporting,
        ),
        const SizedBox(height: AppSpacing.lg),

        IleCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text('Partner Profile', style: AppTypography.cardTitle.copyWith(fontSize: 14)),
              const SizedBox(height: 8),
              _buildSummaryRow(
                'Host Type',
                _hostType == 'individual_owner'
                    ? 'Individual Owner'
                    : (_hostType == 'property_manager' ? 'Property Manager' : 'Company Entity'),
              ),
              const Divider(height: 16),
              _buildSummaryRow('Name', '${_firstNameCtrl.text} ${_lastNameCtrl.text}'),
              const Divider(height: 16),
              _buildSummaryRow('City', _operatingCity),
              const Divider(height: 16),
              _buildSummaryRow('Government ID', '${_idType.toUpperCase()} - ${_idNumberCtrl.text}'),
              const Divider(height: 16),
              _buildSummaryRow(
                'Payout Bank',
                '${_bankName ?? 'Bank'} (***${_bankAccountCtrl.text.length >= 4 ? _bankAccountCtrl.text.substring(_bankAccountCtrl.text.length - 4) : ''})',
              ),
              if (_resolvedAccountName != null) ...<Widget>[
                const Divider(height: 16),
                _buildSummaryRow('Account Name', _resolvedAccountName!),
              ],
              const Divider(height: 16),
              _buildSummaryRow('First Listing', _propertyTitleCtrl.text),
              const Divider(height: 16),
              _buildSummaryRow(
                'Nightly Rate',
                '₦${IleFormatters.formatInteger(_nightlyRate)}',
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),

        IleButton(
          label: _saving ? 'Submitting Application...' : 'Submit Application for Review',
          onPressed: _saving ? null : () => _saveStage(6),
          isLoading: _saving,
          isExpanded: true,
        ),
        const SizedBox(height: AppSpacing.sm),
        OutlinedButton(
          onPressed: () => setState(() => _stage = 5),
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: const Text('Back to Property Details'),
        ),
      ],
    );
  }

  Widget _buildSummaryRow(String label, String value, {bool isBadge = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Text(label, style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280))),
        if (isBadge)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              value,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: Color(0xFF92400E),
              ),
            ),
          )
        else
          Text(
            value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
          ),
      ],
    );
  }
}
