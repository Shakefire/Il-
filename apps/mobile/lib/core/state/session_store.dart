import 'dart:async';
import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/ile_api.dart';
import '../models/user.dart';

/// Central reactive session store for Ilé mobile.
///
/// Holds the authoritative user profile, role, onboarding status, and session token.
/// Acts as GoRouter's refreshListenable for role-based navigation and authentication guards.
class SessionStore extends ChangeNotifier {
  SessionStore(this._api) {
    restoreSession();
  }

  final IleApi _api;

  User? _currentUser;
  bool _isRestoringSession = true;
  bool _isSubmitting = false;
  String? _errorMessage;

  User? get currentUser => _currentUser;
  bool get isRestoringSession => _isRestoringSession;
  bool get isSubmitting => _isSubmitting;
  String? get errorMessage => _errorMessage;

  bool get isAuthenticated => _currentUser != null;
  bool get isHost => _currentUser?.isHost ?? false;
  bool get isAdmin => _currentUser?.isAdmin ?? false;
  bool get isGuest => !isHost && !isAdmin;
  bool get isEmailVerified => _currentUser?.emailVerified ?? false;
  String get role => _currentUser?.role ?? 'guest';
  UserProfile? get hostProfile => _currentUser?.profile;
  int get onboardingStep => _currentUser?.profile?.onboardingStep ?? 1;
  bool get isOnboardingComplete =>
      _currentUser?.profile?.onboardingCompleted ?? false;
  bool get isHostApproved => _currentUser?.profile?.isApproved ?? false;

  /// Restores session on cold start or network reconnect without wiping credentials on network failures.
  Future<bool> restoreSession() async {
    _isRestoringSession = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final Map<String, dynamic>? rawUser = await _api.getCurrentUser();
      if (rawUser != null) {
        _currentUser = User.fromJson(rawUser);
        _isRestoringSession = false;
        notifyListeners();
        return true;
      } else {
        _currentUser = null;
        _isRestoringSession = false;
        notifyListeners();
        return false;
      }
    } on ApiException catch (err) {
      if (err.statusCode == 401) {
        // Expired or invalid token — safely clear local session
        await _api.logout();
        _currentUser = null;
      }
      _isRestoringSession = false;
      notifyListeners();
      return false;
    } catch (e) {
      // Temporary network error — preserve state, avoid kicking logged-in user
      debugPrint('[SessionStore] Session check network glitch: $e');
      _isRestoringSession = false;
      notifyListeners();
      return _currentUser != null;
    }
  }

  /// Authenticates with email and password, establishing token and fetching profile.
  Future<User> login({
    required String email,
    required String password,
  }) async {
    _isSubmitting = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final Map<String, dynamic> res = await _api.login(
        email: email.trim().toLowerCase(),
        password: password,
      );

      // Fetch the full authoritative user & profile record
      final Map<String, dynamic>? fullUser = await _api.getCurrentUser();
      if (fullUser != null) {
        _currentUser = User.fromJson(fullUser);
      } else if (res['user'] is Map<String, dynamic>) {
        _currentUser = User.fromJson(res['user'] as Map<String, dynamic>);
      } else {
        throw ApiException(
          message: 'Unable to retrieve user profile after sign in.',
          statusCode: 500,
        );
      }

      _isSubmitting = false;
      notifyListeners();
      return _currentUser!;
    } catch (err) {
      _isSubmitting = false;
      if (err is ApiException) {
        _errorMessage = err.message;
      } else {
        _errorMessage = err.toString();
      }
      notifyListeners();
      rethrow;
    }
  }

  /// Registers a guest account. Returns result requiring OTP verification before session issue.
  Future<Map<String, dynamic>> registerGuest({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    String? phone,
  }) async {
    _isSubmitting = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final Map<String, dynamic> res = await _api.registerGuest(
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        phone: phone?.trim(),
      );
      _isSubmitting = false;
      notifyListeners();
      return res;
    } catch (err) {
      _isSubmitting = false;
      if (err is ApiException) {
        _errorMessage = err.message;
      } else {
        _errorMessage = err.toString();
      }
      notifyListeners();
      rethrow;
    }
  }

  /// Registers a property owner / host account. Returns result requiring OTP verification.
  Future<Map<String, dynamic>> registerOwner({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
    String? phone,
    String? hostType,
    String? companyName,
    String? operatingCity,
  }) async {
    _isSubmitting = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final Map<String, dynamic> res = await _api.registerOwner(
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        phone: phone?.trim(),
        hostType: hostType,
        companyName: companyName?.trim(),
        operatingCity: operatingCity,
      );
      _isSubmitting = false;
      notifyListeners();
      return res;
    } catch (err) {
      _isSubmitting = false;
      if (err is ApiException) {
        _errorMessage = err.message;
      } else {
        _errorMessage = err.toString();
      }
      notifyListeners();
      rethrow;
    }
  }

  /// Verifies email with 6-digit OTP code, receives session token, and establishes user state.
  Future<User> verifyEmail({
    required String email,
    required String code,
  }) async {
    _isSubmitting = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _api.verifyEmail(
        email: email.trim().toLowerCase(),
        code: code.trim(),
      );

      // Fetch newly authenticated full user
      final Map<String, dynamic>? fullUser = await _api.getCurrentUser();
      if (fullUser != null) {
        _currentUser = User.fromJson(fullUser);
      } else {
        throw ApiException(
          message: 'Email verified but profile could not be loaded.',
          statusCode: 500,
        );
      }

      _isSubmitting = false;
      notifyListeners();
      return _currentUser!;
    } catch (err) {
      _isSubmitting = false;
      if (err is ApiException) {
        _errorMessage = err.message;
      } else {
        _errorMessage = err.toString();
      }
      notifyListeners();
      rethrow;
    }
  }

  /// Resends email OTP code.
  Future<void> resendOtp({required String email}) async {
    try {
      await _api.resendEmailOtp(email: email.trim().toLowerCase());
    } catch (err) {
      if (err is ApiException) {
        _errorMessage = err.message;
      } else {
        _errorMessage = err.toString();
      }
      rethrow;
    }
  }

  /// Refreshes current user profile from backend without full splash.
  Future<User?> refreshUser() async {
    try {
      final Map<String, dynamic>? fullUser = await _api.getCurrentUser();
      if (fullUser != null) {
        _currentUser = User.fromJson(fullUser);
        notifyListeners();
      }
      return _currentUser;
    } catch (_) {
      return _currentUser;
    }
  }

  /// Signs out, revokes device session, and resets local state.
  Future<void> logout() async {
    try {
      await _api.logout();
    } catch (_) {
      // Best-effort logout
    }
    _currentUser = null;
    notifyListeners();
  }
}
