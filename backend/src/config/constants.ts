/**
 * Ilé Platform Business Constants
 * Single source of truth — never hardcode these values in modules.
 */

// ─── Currency ───
export const DEFAULT_CURRENCY = "NGN";

// ─── Pricing & Fees ───
/** Platform commission percentage (applied to booking gross) */
export const PLATFORM_COMMISSION_PCT = 8;
/** Default cleaning fee as percentage of nightly rate */
export const DEFAULT_CLEANING_FEE_PCT = 5;
/** Minimum price per night in NGN (₦5,000) */
export const MIN_PRICE_PER_NIGHT = 5_000;

// ─── Booking Rules ───
export const MIN_NIGHTS = 1;
export const MAX_NIGHTS = 90;
export const MAX_GUESTS = 20;
export const BOOKING_REFERENCE_PREFIX = "ILE";

// ─── Pagination ───
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ─── Search ───
/** Default search radius in kilometers */
export const DEFAULT_SEARCH_RADIUS_KM = 25;
/** Maximum search radius in kilometers */
export const MAX_SEARCH_RADIUS_KM = 100;

// ─── Security ───
/** Session token expiry in seconds (7 days) */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
/** Bcrypt salt rounds */
export const BCRYPT_SALT_ROUNDS = 10;
/** Coordinate offset range for location privacy (±0.003 ≈ 300m) */
export const COORDINATE_OFFSET_RANGE = 0.003;

// ─── Uploads ───
/** Max image upload size in bytes (10 MB) */
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
/** Allowed image MIME types */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
/** Max images per property */
export const MAX_IMAGES_PER_PROPERTY = 20;

// ─── User Roles ───
export const ROLES = {
  GUEST: "guest",
  HOST: "host",
  ADMIN: "admin",
} as const;

// ─── Property Statuses ───
export const PROPERTY_STATUS = {
  DRAFT: "DRAFT",
  PENDING_REVIEW: "PENDING_REVIEW",
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED",
  SUSPENDED: "SUSPENDED",
} as const;

// ─── Booking Statuses ───
export const BOOKING_STATUS = {
  PENDING: "PENDING",
  PAYMENT_PENDING: "PAYMENT_PENDING",
  CONFIRMED: "CONFIRMED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
} as const;

// ─── Payment Statuses ───
export const PAYMENT_STATUS = {
  INITIALIZED: "INITIALIZED",
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
} as const;

// ─── Nigerian Property Types ───
export const PROPERTY_TYPES = [
  "Apartment",
  "House",
  "Villa",
  "Serviced Apartment",
  "Studio",
  "Hotel",
  "Guest House",
  "Penthouse",
  "Duplex",
  "Bungalow",
] as const;

// ─── Space Types ───
export const SPACE_TYPES = [
  "Entire place",
  "Private room",
  "Shared room",
] as const;

// ─── Power Types (Nigerian Infrastructure) ───
export const POWER_TYPES = [
  "Solar + Inverter",
  "Dual Silent Generator",
  "24/7 Dedicated Grid + Inverter",
  "Generator + Inverter",
  "Full Solar Array",
  "Grid + Solar Hybrid",
] as const;

// ─── Amenity Categories ───
export const AMENITY_CATEGORIES = [
  "comfort",
  "connectivity",
  "kitchen",
  "safety",
  "wellness",
  "entertainment",
  "outdoor",
] as const;
