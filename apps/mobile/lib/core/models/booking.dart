import '../phase11_guest_outcome.dart';

/// Guest booking — statuses mirror backend `BOOKING_STATUS` (Phase 3 SoT).
/// Never invent client-only statuses.
class IleBooking {
  const IleBooking({
    required this.id,
    required this.status,
    required this.checkInDate,
    required this.checkOutDate,
    required this.guestCount,
    required this.totalAmount,
    this.accessToken,
    this.propertyTitle,
    this.propertyCover,
    this.propertySlug,
    this.propertyId,
    this.propertyCity,
    this.propertyNeighborhood,
    this.currency = 'NGN',
    this.reference,
    this.hostResponseDeadlineAt,
    this.paymentDeadlineAt,
    this.cancellationReason,
    this.hostResponse,
    this.guestCheckInConfirmedAt,
    this.canConfirmCheckInFlag,
  });

  final String id;
  final String status;
  final String checkInDate;
  final String checkOutDate;
  final int guestCount;
  final int totalAmount;
  final String? accessToken;
  final String? propertyTitle;
  final String? propertyCover;
  final String? propertySlug;
  final String? propertyId;
  final String? propertyCity;
  final String? propertyNeighborhood;
  final String currency;
  final String? reference;
  final DateTime? hostResponseDeadlineAt;
  final DateTime? paymentDeadlineAt;
  final String? cancellationReason;
  final String? hostResponse;
  final DateTime? guestCheckInConfirmedAt;
  /// From recovery payload when present; otherwise derived locally.
  final bool? canConfirmCheckInFlag;

  /// Known backend statuses — unknown values kept as raw string (safe parse).
  static const Set<String> knownStatuses = <String>{
    'PENDING',
    'PENDING_HOST',
    'PAYMENT_PENDING',
    'CONFIRMED',
    'CANCELLED',
    'COMPLETED',
    'FAILED',
  };

  static String normalizeStatus(Object? raw) {
    final String value = (raw?.toString() ?? '').trim().toUpperCase();
    if (value.isEmpty) return 'PENDING';
    if (knownStatuses.contains(value)) return value;
    // Do not invent aliases — surface unknown for honest UI
    return value;
  }

  static DateTime? _parseDeadline(Object? raw) {
    if (raw == null) return null;
    if (raw is DateTime) return raw.toUtc();
    final String s = raw.toString().trim();
    if (s.isEmpty) return null;
    return DateTime.tryParse(s)?.toUtc();
  }

  /// Active guest action / hold requests (real API statuses only).
  bool get isRequest =>
      status == 'PAYMENT_PENDING' ||
      status == 'PENDING_HOST' ||
      status == 'PENDING';

  bool get isPaymentDue => status == 'PAYMENT_PENDING';

  bool get isHostPending => status == 'PENDING_HOST' || status == 'PENDING';

  bool get isConfirmed => status == 'CONFIRMED';
  bool get isCancelled => status == 'CANCELLED' || status == 'FAILED';
  bool get isCompleted => status == 'COMPLETED';

  /// Pay only after host accept → PAYMENT_PENDING (never on PENDING_HOST).
  bool get canPay => status == 'PAYMENT_PENDING';

  bool get canCancelUnpaid =>
      status == 'PENDING_HOST' ||
      status == 'PAYMENT_PENDING' ||
      status == 'PENDING';

  bool get guestCheckInConfirmed => guestCheckInConfirmedAt != null;

  bool get canConfirmCheckIn {
    if (canConfirmCheckInFlag != null) return canConfirmCheckInFlag!;
    if (guestCheckInConfirmed) return false;
    if (!isConfirmed && !isCompleted) return false;
    final DateTime? start = checkInDay;
    if (start == null) return false;
    return !start.isAfter(_today);
  }

  String get locationLabel {
    final List<String> parts = <String>[
      if (propertyNeighborhood != null && propertyNeighborhood!.isNotEmpty)
        propertyNeighborhood!,
      if (propertyCity != null && propertyCity!.isNotEmpty) propertyCity!,
    ];
    return parts.join(', ');
  }

  String get guestsLabel => guestCount == 1 ? '1 guest' : '$guestCount guests';

  DateTime? get checkInDay {
    final DateTime? parsed = DateTime.tryParse(checkInDate);
    if (parsed == null) return null;
    return DateTime(parsed.year, parsed.month, parsed.day);
  }

  DateTime? get checkOutDay {
    final DateTime? parsed = DateTime.tryParse(checkOutDate);
    if (parsed == null) return null;
    return DateTime(parsed.year, parsed.month, parsed.day);
  }

  static DateTime get _today {
    final DateTime now = DateTime.now();
    return DateTime(now.year, now.month, now.day);
  }

  bool get isOngoing {
    if (!isConfirmed) return false;
    final DateTime? start = checkInDay;
    final DateTime? end = checkOutDay;
    if (start == null || end == null) return false;
    final DateTime day = _today;
    return !start.isAfter(day) && day.isBefore(end);
  }

  bool get isUpcoming {
    if (!isConfirmed) return false;
    final DateTime? start = checkInDay;
    if (start == null) return true;
    return start.isAfter(_today);
  }

  bool get isPast {
    if (isCancelled || isRequest) return false;
    if (isCompleted) return true;
    if (isOngoing) return false;
    final DateTime? end = checkOutDay;
    if (end == null) return false;
    return !end.isAfter(_today);
  }

  Duration? get hostResponseRemaining {
    final DateTime? deadline = hostResponseDeadlineAt;
    if (deadline == null) return null;
    return deadline.difference(DateTime.now().toUtc());
  }

  Duration? get paymentRemaining {
    final DateTime? deadline = paymentDeadlineAt;
    if (deadline == null) return null;
    return deadline.difference(DateTime.now().toUtc());
  }

  GuestReservationOutcome get outcome => GuestReservationOutcome.resolve(
        status: status,
        cancellationReason: cancellationReason,
        hostResponse: hostResponse,
      );

  /// Honest guest-facing label matching CURRENT API.
  String get statusHeadline {
    if (status == 'CONFIRMED') {
      if (isOngoing) return 'Stay in progress';
      if (isPast) return 'Stay ended';
      return 'Confirmed';
    }
    return outcome.headline;
  }

  String get statusBody {
    if (status == 'CONFIRMED' && isOngoing) {
      return 'You are currently checked in. Arrival details stay available for this stay.';
    }
    return outcome.body;
  }

  String get listActionLabel {
    if (canPay) return 'Complete payment';
    if (isHostPending) return 'Waiting for the host';
    if (isOngoing) return 'View stay';
    if (isConfirmed) return 'View details';
    return 'View status';
  }

  IleBooking copyWith({
    String? status,
    String? accessToken,
    DateTime? hostResponseDeadlineAt,
    DateTime? paymentDeadlineAt,
    String? cancellationReason,
    String? hostResponse,
    DateTime? guestCheckInConfirmedAt,
    bool? canConfirmCheckInFlag,
  }) {
    return IleBooking(
      id: id,
      status: status ?? this.status,
      checkInDate: checkInDate,
      checkOutDate: checkOutDate,
      guestCount: guestCount,
      totalAmount: totalAmount,
      accessToken: accessToken ?? this.accessToken,
      propertyTitle: propertyTitle,
      propertyCover: propertyCover,
      propertySlug: propertySlug,
      propertyId: propertyId,
      propertyCity: propertyCity,
      propertyNeighborhood: propertyNeighborhood,
      currency: currency,
      reference: reference,
      hostResponseDeadlineAt:
          hostResponseDeadlineAt ?? this.hostResponseDeadlineAt,
      paymentDeadlineAt: paymentDeadlineAt ?? this.paymentDeadlineAt,
      cancellationReason: cancellationReason ?? this.cancellationReason,
      hostResponse: hostResponse ?? this.hostResponse,
      guestCheckInConfirmedAt:
          guestCheckInConfirmedAt ?? this.guestCheckInConfirmedAt,
      canConfirmCheckInFlag:
          canConfirmCheckInFlag ?? this.canConfirmCheckInFlag,
    );
  }

  factory IleBooking.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> property =
        (json['property'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    final Map<String, dynamic> timers =
        (json['timers'] as Map<String, dynamic>?) ?? <String, dynamic>{};

    return IleBooking(
      id: (json['id'] as String?) ?? '',
      status: normalizeStatus(json['status'] ?? json['bookingStatus']),
      checkInDate:
          (json['checkInDate'] as String?) ??
          (json['startDate'] as String?) ??
          '',
      checkOutDate:
          (json['checkOutDate'] as String?) ??
          (json['endDate'] as String?) ??
          '',
      guestCount: (json['guestCount'] as num?)?.toInt() ?? 1,
      totalAmount:
          (json['totalAmount'] as num?)?.toInt() ??
          (json['totalPrice'] as num?)?.toInt() ??
          (json['total'] as num?)?.toInt() ??
          0,
      accessToken: json['accessToken'] as String?,
      propertyTitle:
          (property['title'] as String?) ?? json['propertyTitle'] as String?,
      propertyCover:
          (property['coverImage'] as String?) ??
          json['propertyCover'] as String?,
      propertySlug: property['slug'] as String?,
      propertyId: (property['id'] as String?) ?? json['propertyId'] as String?,
      propertyCity: (property['city'] as String?) ?? json['city'] as String?,
      propertyNeighborhood:
          (property['neighborhood'] as String?) ??
          json['neighborhood'] as String?,
      currency: (json['currency'] as String?) ?? 'NGN',
      reference:
          json['referenceCode'] as String? ??
          json['reference'] as String? ??
          json['bookingRef'] as String?,
      hostResponseDeadlineAt: _parseDeadline(
        json['hostResponseDeadlineAt'] ?? timers['hostResponseDeadlineAt'],
      ),
      paymentDeadlineAt: _parseDeadline(
        json['paymentDeadlineAt'] ?? timers['paymentDeadlineAt'],
      ),
      cancellationReason: json['cancellationReason'] as String?,
      hostResponse: json['hostResponse'] as String?,
      guestCheckInConfirmedAt: _parseDeadline(
        json['guestCheckInConfirmedAt'] ??
            (json['recovery'] is Map
                ? (json['recovery'] as Map)['guestCheckInConfirmedAt']
                : null),
      ),
      canConfirmCheckInFlag: json['canConfirmCheckIn'] is bool
          ? json['canConfirmCheckIn'] as bool
          : (json['recovery'] is Map &&
                  (json['recovery'] as Map)['canConfirmCheckIn'] is bool)
              ? (json['recovery'] as Map)['canConfirmCheckIn'] as bool
              : null,
    );
  }
}
