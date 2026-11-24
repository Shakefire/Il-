/// Authoritative user and host profile representations matching the Ilé backend.
class UserProfile {
  const UserProfile({
    this.id,
    this.userId,
    this.isVerified = false,
    this.verificationStatus = 'REGISTERED',
    this.onboardingStep = 1,
    this.onboardingCompleted = false,
    this.hostType = 'individual_owner',
    this.companyName,
    this.operatingCity = 'Abuja',
    this.reviewFeedback,
  });

  final String? id;
  final String? userId;
  final bool isVerified;
  final String verificationStatus;
  final int onboardingStep;
  final bool onboardingCompleted;
  final String hostType;
  final String? companyName;
  final String operatingCity;
  final String? reviewFeedback;

  bool get isApproved => verificationStatus == 'APPROVED' || isVerified;
  bool get isInReview =>
      verificationStatus == 'SUBMITTED' || verificationStatus == 'IN_REVIEW';
  bool get isRejected => verificationStatus == 'REJECTED';

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id'] as String?,
      userId: json['userId'] as String?,
      isVerified: json['isVerified'] == true,
      verificationStatus: (json['verificationStatus'] as String?) ?? 'REGISTERED',
      onboardingStep: (json['onboardingStep'] as num?)?.toInt() ?? 1,
      onboardingCompleted: json['onboardingCompleted'] == true,
      hostType: (json['hostType'] as String?) ?? 'individual_owner',
      companyName: json['companyName'] as String?,
      operatingCity: (json['operatingCity'] as String?) ?? 'Abuja',
      reviewFeedback: json['reviewFeedback'] as String?,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        if (id != null) 'id': id,
        if (userId != null) 'userId': userId,
        'isVerified': isVerified,
        'verificationStatus': verificationStatus,
        'onboardingStep': onboardingStep,
        'onboardingCompleted': onboardingCompleted,
        'hostType': hostType,
        if (companyName != null) 'companyName': companyName,
        'operatingCity': operatingCity,
        if (reviewFeedback != null) 'reviewFeedback': reviewFeedback,
      };
}

class User {
  const User({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    this.phone,
    this.role = 'guest',
    this.avatarUrl,
    this.emailVerified = false,
    this.phoneVerified = false,
    this.status = 'ACTIVE',
    this.profile,
  });

  final String id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String role;
  final String? avatarUrl;
  final bool emailVerified;
  final bool phoneVerified;
  final String status;
  final UserProfile? profile;

  String get displayName {
    final String f = firstName?.trim() ?? '';
    final String l = lastName?.trim() ?? '';
    if (f.isNotEmpty || l.isNotEmpty) {
      return '$f $l'.trim();
    }
    return email.split('@').first;
  }

  bool get isHost => role.toLowerCase() == 'host';
  bool get isAdmin => role.toLowerCase() == 'admin';
  bool get isGuest => !isHost && !isAdmin;
  bool get isSuspended => status.toUpperCase() == 'SUSPENDED';

  factory User.fromJson(Map<String, dynamic> json) {
    UserProfile? prof;
    if (json['profile'] is Map<String, dynamic>) {
      prof = UserProfile.fromJson(json['profile'] as Map<String, dynamic>);
    } else if (json['profile'] is Map) {
      prof = UserProfile.fromJson(
        Map<String, dynamic>.from(json['profile'] as Map),
      );
    }

    return User(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      firstName: json['firstName']?.toString(),
      lastName: json['lastName']?.toString(),
      phone: json['phone']?.toString(),
      role: json['role']?.toString() ?? 'guest',
      avatarUrl: json['avatarUrl']?.toString(),
      emailVerified: json['emailVerified'] == true,
      phoneVerified: json['phoneVerified'] == true,
      status: json['status']?.toString() ?? 'ACTIVE',
      profile: prof,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'email': email,
        if (firstName != null) 'firstName': firstName,
        if (lastName != null) 'lastName': lastName,
        if (phone != null) 'phone': phone,
        'role': role,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
        'emailVerified': emailVerified,
        'phoneVerified': phoneVerified,
        'status': status,
        if (profile != null) 'profile': profile!.toJson(),
      };
}
