import 'property.dart';

class SearchPagination {
  const SearchPagination({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
    required this.hasNext,
    required this.hasPrev,
  });

  final int page;
  final int limit;
  final int total;
  final int totalPages;
  final bool hasNext;
  final bool hasPrev;

  factory SearchPagination.fromJson(Map<String, dynamic>? json) {
    final Map<String, dynamic> data = json ?? <String, dynamic>{};
    return SearchPagination(
      page: (data['page'] as num?)?.toInt() ?? 1,
      limit: (data['limit'] as num?)?.toInt() ?? 20,
      total: (data['total'] as num?)?.toInt() ?? 0,
      totalPages: (data['totalPages'] as num?)?.toInt() ?? 0,
      hasNext: data['hasNext'] == true,
      hasPrev: data['hasPrev'] == true,
    );
  }
}

class SearchResponse {
  const SearchResponse({
    required this.properties,
    required this.pagination,
    this.location = '',
    this.resolvedDisplay,
  });

  final List<IleProperty> properties;
  final SearchPagination pagination;
  final String location;
  final String? resolvedDisplay;

  factory SearchResponse.fromJson(Map<String, dynamic> json) {
    final List<dynamic> raw =
        (json['properties'] as List<dynamic>?) ?? <dynamic>[];
    final Map<String, dynamic> query =
        (json['query'] as Map<String, dynamic>?) ?? <String, dynamic>{};
    final dynamic resolved = query['resolvedLocation'];
    String? resolvedDisplay;
    if (resolved is Map) {
      resolvedDisplay = (resolved['displayName'] as String?) ??
          (resolved['name'] as String?) ??
          (resolved['city'] as String?);
    }
    return SearchResponse(
      properties: raw
          .whereType<Map<String, dynamic>>()
          .map(IleProperty.fromJson)
          .toList(),
      pagination: SearchPagination.fromJson(
        json['pagination'] as Map<String, dynamic>?,
      ),
      location: (query['location'] as String?) ?? '',
      resolvedDisplay: resolvedDisplay,
    );
  }
}
