import 'package:flutter/material.dart';

/// Diffuse, low-contrast elevation from `brand.md` §4.3.
abstract final class AppShadows {
  static const List<BoxShadow> xs = [
    BoxShadow(
      color: Color(0x0D000000),
      offset: Offset(0, 1),
      blurRadius: 2,
    ),
  ];

  static const List<BoxShadow> sm = [
    BoxShadow(
      color: Color(0x14000000),
      offset: Offset(0, 1),
      blurRadius: 3,
    ),
    BoxShadow(
      color: Color(0x14000000),
      offset: Offset(0, 1),
      blurRadius: 2,
      spreadRadius: -1,
    ),
  ];

  static const List<BoxShadow> md = [
    BoxShadow(
      color: Color(0x12000000),
      offset: Offset(0, 4),
      blurRadius: 6,
      spreadRadius: -1,
    ),
    BoxShadow(
      color: Color(0x0D000000),
      offset: Offset(0, 2),
      blurRadius: 4,
      spreadRadius: -2,
    ),
  ];

  static const List<BoxShadow> xl = [
    BoxShadow(
      color: Color(0x1A000000),
      offset: Offset(0, 20),
      blurRadius: 25,
      spreadRadius: -5,
    ),
    BoxShadow(
      color: Color(0x1A000000),
      offset: Offset(0, 8),
      blurRadius: 10,
      spreadRadius: -6,
    ),
  ];

  /// `0 12px 32px -4px rgba(7, 59, 46, 0.06)`.
  static const List<BoxShadow> editorialCard = [
    BoxShadow(
      color: Color(0x0F073B2E),
      offset: Offset(0, 12),
      blurRadius: 32,
      spreadRadius: -4,
    ),
  ];

  /// Map pill `0 8px 20px rgba(7, 59, 46, 0.25)`.
  static const List<BoxShadow> mapPill = [
    BoxShadow(
      color: Color(0x40073B2E),
      offset: Offset(0, 8),
      blurRadius: 20,
    ),
  ];

  /// Floating dock `0 12px 32px rgba(7, 59, 46, 0.10)`.
  static const List<BoxShadow> dock = [
    BoxShadow(
      color: Color(0x1A073B2E),
      offset: Offset(0, 12),
      blurRadius: 32,
    ),
  ];

  /// Search bar soft lift.
  static const List<BoxShadow> searchBar = [
    BoxShadow(
      color: Color(0x0F073B2E),
      offset: Offset(0, 8),
      blurRadius: 20,
      spreadRadius: -6,
    ),
  ];

  static const List<BoxShadow> focusEmerald = [
    BoxShadow(
      color: Color(0x26065F46),
      blurRadius: 0,
      spreadRadius: 2,
    ),
  ];

  static const List<BoxShadow> focusError = [
    BoxShadow(
      color: Color(0x26EF4444),
      blurRadius: 0,
      spreadRadius: 2,
    ),
  ];
}
