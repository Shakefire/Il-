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
import '../../shared/widgets/ile_button.dart';
import '../../shared/widgets/ile_circular_back_button.dart';
import '../../shared/widgets/ile_loading_indicator.dart';
import 'host_chrome.dart';

/// Multi-step create / edit listing with media upload, cover, and publish actions.
class HostPropertyEditorScreen extends StatefulWidget {
  const HostPropertyEditorScreen({
    super.key,
    this.propertyId,
  });

  final String? propertyId;

  @override
  State<HostPropertyEditorScreen> createState() =>
      _HostPropertyEditorScreenState();
}

class _HostPropertyEditorScreenState extends State<HostPropertyEditorScreen> {
  bool _loading = false;
  bool _saving = false;
  String? _error;
  String? _notice;
  int _step = 0;
  String? _createdId;

  final TextEditingController _titleCtrl = TextEditingController();
  final TextEditingController _cityCtrl = TextEditingController(text: 'Abuja');
  final TextEditingController _neighborhoodCtrl = TextEditingController();
  final TextEditingController _stateCtrl = TextEditingController(text: 'FCT');
  final TextEditingController _priceCtrl = TextEditingController(text: '50000');
  final TextEditingController _descriptionCtrl = TextEditingController();
  final TextEditingController _addressCtrl = TextEditingController();
  final TextEditingController _maxGuestsCtrl = TextEditingController(text: '2');
  final TextEditingController _bedroomsCtrl = TextEditingController(text: '1');
  final TextEditingController _bathroomsCtrl = TextEditingController(text: '1');

  String _propertyType = 'Apartment';
  String _status = 'DRAFT';
  List<Map<String, dynamic>> _media = <Map<String, dynamic>>[];
  List<String> _imageUrls = <String>[];
  String? _coverUrl;

  bool get _isEdit =>
      (widget.propertyId != null && widget.propertyId!.isNotEmpty) ||
      (_createdId != null && _createdId!.isNotEmpty);

  String? get _effectiveId => widget.propertyId?.isNotEmpty == true
      ? widget.propertyId
      : _createdId;

  @override
  void initState() {
    super.initState();
    if (widget.propertyId != null && widget.propertyId!.isNotEmpty) {
      _load();
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _cityCtrl.dispose();
    _neighborhoodCtrl.dispose();
    _stateCtrl.dispose();
    _priceCtrl.dispose();
    _descriptionCtrl.dispose();
    _addressCtrl.dispose();
    _maxGuestsCtrl.dispose();
    _bedroomsCtrl.dispose();
    _bathroomsCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final Map<String, dynamic> res =
          await context.read<IleApi>().getHostProperty(widget.propertyId!);
      final Map<String, dynamic> prop = res['property'] is Map
          ? Map<String, dynamic>.from(res['property'] as Map)
          : res;
      if (!mounted) return;
      _titleCtrl.text = prop['title']?.toString() ?? '';
      _cityCtrl.text = prop['city']?.toString() ?? 'Abuja';
      _neighborhoodCtrl.text = prop['neighborhood']?.toString() ?? '';
      _stateCtrl.text = prop['state']?.toString() ?? 'FCT';
      _priceCtrl.text =
          ((prop['hostBasePrice'] as num?) ?? (prop['pricePerNight'] as num?) ?? 0)
              .toInt()
              .toString();
      _descriptionCtrl.text = prop['description']?.toString() ?? '';
      _addressCtrl.text = prop['exactAddress']?.toString() ?? '';
      _maxGuestsCtrl.text = ((prop['maxGuests'] as num?) ?? 2).toInt().toString();
      _bedroomsCtrl.text = ((prop['bedrooms'] as num?) ?? 1).toInt().toString();
      _bathroomsCtrl.text =
          ((prop['bathrooms'] as num?) ?? 1).toInt().toString();
      _propertyType = prop['propertyType']?.toString() ?? 'Apartment';
      _status = prop['status']?.toString() ?? 'DRAFT';
      _coverUrl = prop['coverImage']?.toString();
      final List<dynamic> urls =
          (prop['images'] as List<dynamic>?) ?? <dynamic>[];
      _imageUrls = urls.map((dynamic e) => e.toString()).toList();
      final List<dynamic> media =
          (prop['media'] as List<dynamic>?) ?? <dynamic>[];
      _media = media
          .whereType<Map>()
          .map((Map e) => Map<String, dynamic>.from(e))
          .toList();
      setState(() => _loading = false);
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

  Map<String, dynamic> _payload() {
    final int hostRate = int.tryParse(_priceCtrl.text.trim()) ?? 0;
    return <String, dynamic>{
      'title': _titleCtrl.text.trim(),
      'city': _cityCtrl.text.trim(),
      'neighborhood': _neighborhoodCtrl.text.trim(),
      'state': _stateCtrl.text.trim(),
      'hostBasePrice': hostRate,
      'description': _descriptionCtrl.text.trim(),
      'exactAddress': _addressCtrl.text.trim(),
      'propertyType': _propertyType,
      'maxGuests': int.tryParse(_maxGuestsCtrl.text.trim()) ?? 2,
      'bedrooms': int.tryParse(_bedroomsCtrl.text.trim()) ?? 1,
      'bathrooms': int.tryParse(_bathroomsCtrl.text.trim()) ?? 1,
      if (_coverUrl != null && _coverUrl!.isNotEmpty) 'coverImage': _coverUrl,
      if (_imageUrls.isNotEmpty) 'images': _imageUrls,
    };
  }

  Future<void> _saveDraft({bool advance = true}) async {
    setState(() {
      _saving = true;
      _notice = null;
      _error = null;
    });
    try {
      final IleApi api = context.read<IleApi>();
      if (_isEdit && _effectiveId != null) {
        await api.updateHostProperty(_effectiveId!, _payload());
        setState(() {
          _notice =
              'Listing saved. Confirmed booking price snapshots were not rewritten.';
        });
      } else {
        final Map<String, dynamic> created =
            await api.createHostProperty(_payload());
        final String? id = created['id']?.toString() ??
            (created['property'] is Map
                ? created['property']['id']?.toString()
                : null);
        setState(() {
          _createdId = id;
          _notice = 'Listing created as draft.';
          _status = 'DRAFT';
        });
      }
      if (advance && _step < 2) {
        setState(() => _step += 1);
      }
      if (_effectiveId != null && widget.propertyId == null) {
        // Reload media after create
      }
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } catch (err) {
      setState(() => _error = err.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _uploadMedia() async {
    final String? id = _effectiveId;
    if (id == null) {
      setState(() => _error = 'Save basics first so media can attach to the listing.');
      return;
    }
    setState(() => _saving = true);
    try {
      final ImagePicker picker = ImagePicker();
      final XFile? file = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 85,
        maxWidth: 2400,
      );
      if (file == null) {
        setState(() => _saving = false);
        return;
      }
      final Uint8List bytes = await file.readAsBytes();
      final String mime = file.mimeType ?? 'image/jpeg';
      if (!mounted) return;
      final IleApi api = context.read<IleApi>();
      final Map<String, dynamic> up = await api.uploadImage(
            base64DataUriOrRaw: 'data:$mime;base64,${base64Encode(bytes)}',
            folder: 'listings',
            propertyId: id,
            mimeType: mime,
          );
      final String? url = up['url']?.toString();
      if (url == null || url.isEmpty) {
        throw ApiException(message: 'Upload did not return a URL', statusCode: 400);
      }
      final List<String> next = <String>[..._imageUrls, url];
      await api.updateHostProperty(id, <String, dynamic>{
        'images': next,
        if (_coverUrl == null || _coverUrl!.isEmpty) 'coverImage': url,
      });
      setState(() {
        _imageUrls = next;
        _coverUrl ??= url;
        _notice = 'Photo uploaded.';
      });
      await _reloadMedia(id);
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } catch (err) {
      setState(() => _error = err.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _reloadMedia(String id) async {
    final Map<String, dynamic> res =
        await context.read<IleApi>().getHostProperty(id);
    final Map<String, dynamic> prop = res['property'] is Map
        ? Map<String, dynamic>.from(res['property'] as Map)
        : res;
    final List<dynamic> media = (prop['media'] as List<dynamic>?) ?? <dynamic>[];
    final List<dynamic> urls = (prop['images'] as List<dynamic>?) ?? <dynamic>[];
    if (!mounted) return;
    setState(() {
      _media = media
          .whereType<Map>()
          .map((Map e) => Map<String, dynamic>.from(e))
          .toList();
      _imageUrls = urls.map((dynamic e) => e.toString()).toList();
      _coverUrl = prop['coverImage']?.toString() ?? _coverUrl;
      _status = prop['status']?.toString() ?? _status;
    });
  }

  Future<void> _setCover(String imageId, String url) async {
    final String? id = _effectiveId;
    if (id == null || _media.isEmpty) return;
    final List<String> ordered =
        _media.map((Map<String, dynamic> m) => m['id'].toString()).toList();
    try {
      await context.read<IleApi>().reorderHostPropertyMedia(
            propertyId: id,
            orderedImageIds: ordered,
            coverImageId: imageId,
          );
      setState(() {
        _coverUrl = url;
        _notice = 'Cover photo updated.';
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    }
  }

  Future<void> _moveMedia(int index, int delta) async {
    final String? id = _effectiveId;
    if (id == null || _media.isEmpty) return;
    final int next = index + delta;
    if (next < 0 || next >= _media.length) return;
    final List<Map<String, dynamic>> copy =
        List<Map<String, dynamic>>.from(_media);
    final Map<String, dynamic> item = copy.removeAt(index);
    copy.insert(next, item);
    final List<String> ordered =
        copy.map((Map<String, dynamic> m) => m['id'].toString()).toList();
    try {
      await context.read<IleApi>().reorderHostPropertyMedia(
            propertyId: id,
            orderedImageIds: ordered,
          );
      setState(() {
        _media = copy;
        _notice = 'Gallery order saved.';
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    }
  }

  Future<void> _publish() async {
    final String? id = _effectiveId;
    if (id == null) return;
    setState(() => _saving = true);
    try {
      await context.read<IleApi>().publishHostProperty(id);
      setState(() {
        _status = 'PUBLISHED';
        _notice = 'Listing published.';
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _unpublish() async {
    final String? id = _effectiveId;
    if (id == null) return;
    setState(() => _saving = true);
    try {
      await context.read<IleApi>().unpublishHostProperty(id);
      setState(() {
        _status = 'DRAFT';
        _notice = 'Listing unpublished.';
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _relist() async {
    final String? id = _effectiveId;
    if (id == null) return;
    setState(() => _saving = true);
    try {
      await context.read<IleApi>().relistHostProperty(id);
      setState(() {
        _status = 'PUBLISHED';
        _notice = 'Listing relisted.';
      });
    } on ApiException catch (err) {
      setState(() => _error = err.message);
    } finally {
      if (mounted) setState(() => _saving = false);
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
        title: Text(
          _isEdit ? 'Edit listing' : 'Create listing',
          style: AppTypography.sectionHeading,
        ),
        actions: <Widget>[
          if (_isEdit)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: HostStatusChip(
                  label: _status,
                  tone: toneForPropertyStatus(_status),
                ),
              ),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: IleLoadingIndicator())
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.screenHorizontal),
              children: <Widget>[
                Text(
                  'Step ${_step + 1} of 3',
                  style: AppTypography.caption,
                ),
                const SizedBox(height: AppSpacing.md),
                if (_step == 0) ..._basicsStep(),
                if (_step == 1) ..._detailsStep(),
                if (_step == 2) ..._mediaStep(),
                if (_error != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    _error!,
                    style: AppTypography.supporting
                        .copyWith(color: AppColors.criticalText),
                  ),
                ],
                if (_notice != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  Text(_notice!, style: AppTypography.supporting),
                ],
                const SizedBox(height: AppSpacing.lg),
                if (_step < 2)
                  IleButton(
                    label: _saving ? 'Saving…' : 'Save & continue',
                    onPressed: _saving ? null : () => _saveDraft(),
                    isLoading: _saving,
                    isExpanded: true,
                  )
                else ...[
                  IleButton(
                    label: _saving ? 'Saving…' : 'Save listing',
                    onPressed: _saving ? null : () => _saveDraft(advance: false),
                    isLoading: _saving,
                    isExpanded: true,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  if (_status == 'PUBLISHED')
                    IleButton(
                      label: 'Unpublish',
                      onPressed: _saving ? null : _unpublish,
                      variant: IleButtonVariant.secondary,
                      isExpanded: true,
                    )
                  else if (_status == 'ARCHIVED')
                    IleButton(
                      label: 'Relist',
                      onPressed: _saving ? null : _relist,
                      isExpanded: true,
                    )
                  else
                    IleButton(
                      label: 'Publish',
                      onPressed: _saving ? null : _publish,
                      isExpanded: true,
                    ),
                ],
                if (_step > 0)
                  TextButton(
                    onPressed: _saving ? null : () => setState(() => _step -= 1),
                    child: const Text('Back'),
                  ),
                if (_isEdit)
                  TextButton(
                    onPressed: () => context.pop(),
                    child: const Text('Done'),
                  ),
              ],
            ),
    );
  }

  List<Widget> _basicsStep() {
    return <Widget>[
      Text('Basics', style: AppTypography.sectionHeading),
      TextField(
        controller: _titleCtrl,
        decoration: const InputDecoration(labelText: 'Title'),
      ),
      DropdownButtonFormField<String>(
        initialValue: _propertyType,
        items: const <DropdownMenuItem<String>>[
          DropdownMenuItem(value: 'Apartment', child: Text('Apartment')),
          DropdownMenuItem(value: 'House', child: Text('House')),
          DropdownMenuItem(value: 'Studio', child: Text('Studio')),
          DropdownMenuItem(value: 'Villa', child: Text('Villa')),
          DropdownMenuItem(value: 'Short let', child: Text('Short let')),
        ],
        onChanged: (String? v) =>
            setState(() => _propertyType = v ?? 'Apartment'),
        decoration: const InputDecoration(labelText: 'Property type'),
      ),
      TextField(
        controller: _cityCtrl,
        decoration: const InputDecoration(labelText: 'City'),
      ),
      TextField(
        controller: _neighborhoodCtrl,
        decoration: const InputDecoration(labelText: 'Neighborhood'),
      ),
      TextField(
        controller: _stateCtrl,
        decoration: const InputDecoration(labelText: 'State'),
      ),
      TextField(
        controller: _priceCtrl,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(
          labelText: 'Host rate / night (NGN)',
          helperText:
              'Guest list price is host rate × 1.10. Edits do not rewrite confirmed bookings.',
        ),
      ),
    ];
  }

  List<Widget> _detailsStep() {
    return <Widget>[
      Text('Details', style: AppTypography.sectionHeading),
      TextField(
        controller: _descriptionCtrl,
        maxLines: 5,
        decoration: const InputDecoration(labelText: 'Description'),
      ),
      TextField(
        controller: _addressCtrl,
        decoration: const InputDecoration(
          labelText: 'Exact address (private until confirmed)',
        ),
      ),
      TextField(
        controller: _bedroomsCtrl,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: 'Bedrooms'),
      ),
      TextField(
        controller: _bathroomsCtrl,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: 'Bathrooms'),
      ),
      TextField(
        controller: _maxGuestsCtrl,
        keyboardType: TextInputType.number,
        decoration: const InputDecoration(labelText: 'Max guests'),
      ),
    ];
  }

  List<Widget> _mediaStep() {
    return <Widget>[
      Text('Photos', style: AppTypography.sectionHeading),
      Text(
        'Upload, reorder, and set cover. Order persists via media-order API.',
        style: AppTypography.supporting,
      ),
      const SizedBox(height: AppSpacing.sm),
      IleButton(
        label: _saving ? 'Uploading…' : 'Add photo',
        onPressed: _saving ? null : _uploadMedia,
        variant: IleButtonVariant.secondary,
        isExpanded: true,
      ),
      const SizedBox(height: AppSpacing.md),
      if (_media.isEmpty && _imageUrls.isEmpty)
        Text('No photos yet.', style: AppTypography.supporting)
      else if (_media.isNotEmpty)
        ...List<Widget>.generate(_media.length, (int i) {
          final Map<String, dynamic> m = _media[i];
          final String url = m['url']?.toString() ?? '';
          final String mid = m['id']?.toString() ?? '';
          final bool isCover = url == _coverUrl;
          return ListTile(
            contentPadding: EdgeInsets.zero,
            leading: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.network(
                url,
                width: 56,
                height: 56,
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Container(
                  width: 56,
                  height: 56,
                  color: AppColors.surfaceMuted,
                  child: const Icon(Icons.image_not_supported_outlined),
                ),
              ),
            ),
            title: Text(
              isCover ? 'Cover photo' : 'Photo ${i + 1}',
              style: AppTypography.body,
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                IconButton(
                  tooltip: 'Move up',
                  onPressed: () => _moveMedia(i, -1),
                  icon: const Icon(Icons.arrow_upward),
                ),
                IconButton(
                  tooltip: 'Move down',
                  onPressed: () => _moveMedia(i, 1),
                  icon: const Icon(Icons.arrow_downward),
                ),
                IconButton(
                  tooltip: 'Set cover',
                  onPressed: () => _setCover(mid, url),
                  icon: Icon(
                    isCover ? Icons.star : Icons.star_border,
                    color: isCover ? AppColors.emerald : null,
                  ),
                ),
              ],
            ),
          );
        })
      else
        ..._imageUrls.map(
          (String url) => ListTile(
            contentPadding: EdgeInsets.zero,
            title: Text(url, style: AppTypography.caption, maxLines: 1),
          ),
        ),
    ];
  }
}
