/**
 * Ilé Platform Recipient Validator & Normalizer
 *
 * Enforces strict recipient typing, RFC 5322 email validation,
 * ITU-T E.164 international phone normalization, and prevents
 * cross-channel substitution (e.g. email in phone fields, phones in email fields).
 */

export type RecipientValidationResult<T> =
  | { valid: true; value: T; error?: never }
  | { valid: false; value?: never; error: string }

const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

/**
 * Validate that an email address is syntactically valid and not a phone number or token.
 */
export function validateEmail(raw: unknown): RecipientValidationResult<string> {
  if (typeof raw !== "string") {
    return { valid: false, error: "Email must be a string" }
  }
  const email = raw.trim().toLowerCase()
  if (!email) {
    return { valid: false, error: "Email cannot be empty" }
  }
  if (email.length > 254) {
    return { valid: false, error: "Email exceeds maximum length (254 chars)" }
  }
  // Disallow phone numbers in email field
  if (/^\+?\d{7,15}$/.test(email.replace(/[\s-]/g, ""))) {
    return { valid: false, error: "Phone number cannot be passed into email recipient field" }
  }
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: `Invalid email address format: '${email}'` }
  }
  return { valid: true, value: email }
}

/**
 * Validate and normalize a phone number according to ITU-T E.164 rules.
 * Supports Nigerian numbers (with/without leading 0 or country code) and
 * international numbers safely without incorrectly assuming non-NG numbers are Nigerian.
 */
export function validateAndNormalizePhone(
  raw: unknown,
  countryContext: string = "NG"
): RecipientValidationResult<string> {
  if (typeof raw !== "string") {
    return { valid: false, error: "Phone must be a string" }
  }
  const trimmed = raw.trim()
  if (!trimmed) {
    return { valid: false, error: "Phone number cannot be empty" }
  }

  // Strictly forbid email addresses in phone fields
  if (trimmed.includes("@")) {
    return { valid: false, error: "Email address cannot be passed into SMS phone recipient field" }
  }

  // Disallow alphabetic characters
  if (/[a-zA-Z]/.test(trimmed)) {
    return { valid: false, error: "Phone number cannot contain letters" }
  }

  // Handle international dial-out prefix "00"
  let clean = trimmed
  if (clean.startsWith("00")) {
    clean = "+" + clean.slice(2)
  }

  const hasPlus = clean.startsWith("+")
  const digitsOnly = clean.replace(/\D/g, "")

  if (digitsOnly.length < 7 || digitsOnly.length > 15) {
    return {
      valid: false,
      error: `Phone digit count (${digitsOnly.length}) is outside E.164 range (7-15 digits)`,
    }
  }

  // 1. Explicit international format (+...)
  if (hasPlus) {
    return { valid: true, value: `+${digitsOnly}` }
  }

  // 2. Nigerian context normalization
  const isNgContext = countryContext.toUpperCase() === "NG"

  // Already prefixed with 234 without +
  if (digitsOnly.startsWith("234") && digitsOnly.length === 13) {
    return { valid: true, value: `+${digitsOnly}` }
  }

  // Local Nigerian 11-digit numbers starting with 0 (e.g. 08031234567, 070, 090, 081)
  if (digitsOnly.startsWith("0") && digitsOnly.length === 11 && isNgContext) {
    return { valid: true, value: `+234${digitsOnly.slice(1)}` }
  }

  // 10-digit Nigerian number without leading zero (e.g. 8031234567)
  if (digitsOnly.length === 10 && isNgContext && /^[789]\d{9}$/.test(digitsOnly)) {
    return { valid: true, value: `+234${digitsOnly}` }
  }

  // 3. Other international numbers provided with full country code (digits only)
  if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    return { valid: true, value: `+${digitsOnly}` }
  }

  return {
    valid: false,
    error: `Ambiguous local phone number '${trimmed}' outside country context '${countryContext}'. Provide with '+' country code.`,
  }
}

/**
 * Validate an authenticated internal user ID for in-app notifications.
 */
export function validateUserId(raw: unknown): RecipientValidationResult<string> {
  if (typeof raw !== "string") {
    return { valid: false, error: "User ID must be a string" }
  }
  const id = raw.trim()
  if (!id) {
    return { valid: false, error: "User ID cannot be empty" }
  }
  if (id.includes("@")) {
    return { valid: false, error: "Email address cannot be used as an in-app user ID" }
  }
  if (/^\+?\d{8,15}$/.test(id)) {
    return { valid: false, error: "Phone number cannot be used as an in-app user ID" }
  }
  return { valid: true, value: id }
}

/**
 * Validate a device token (FCM or Web Push).
 */
export function validateDeviceToken(
  raw: unknown,
  provider: "fcm" | "web_push"
): RecipientValidationResult<string> {
  if (typeof raw !== "string") {
    return { valid: false, error: "Device token must be a string" }
  }
  const token = raw.trim()
  if (!token) {
    return { valid: false, error: "Device token cannot be empty" }
  }
  if (token.includes("@")) {
    return { valid: false, error: "Email address cannot be used as a device token" }
  }
  if (/^\+?\d{7,15}$/.test(token)) {
    return { valid: false, error: "Phone number cannot be used as a device token" }
  }

  if (provider === "web_push") {
    // Web Push must be a URL or a JSON object containing an endpoint
    if (token.startsWith("http://") || token.startsWith("https://")) {
      return { valid: true, value: token }
    }
    if (token.startsWith("{")) {
      try {
        const parsed = JSON.parse(token)
        if (parsed.endpoint && typeof parsed.endpoint === "string") {
          return { valid: true, value: token }
        }
      } catch {}
    }
    return { valid: false, error: "Web Push subscription must be a valid URL endpoint or JSON object" }
  }

  // FCM token validation
  if (token.length < 16) {
    return { valid: false, error: `FCM token is suspiciously short (${token.length} chars)` }
  }

  return { valid: true, value: token }
}

/**
 * Mask sensitive recipient destinations for privacy in logs and audit tables.
 */
export function maskRecipient(
  recipient: string,
  type: "email" | "phone" | "token" | "userId" | "unknown"
): string {
  if (!recipient) return "[empty]"
  if (type === "email" || recipient.includes("@")) {
    const [local, domain] = recipient.split("@")
    if (!domain) return recipient.slice(0, 3) + "***"
    const visible = local.length <= 2 ? local[0] : local.slice(0, 2)
    return `${visible}***@${domain}`
  }
  if (type === "phone" || /^\+?\d+$/.test(recipient.replace(/[\s-]/g, ""))) {
    const clean = recipient.replace(/\s+/g, "")
    if (clean.length <= 6) return clean.slice(0, 2) + "***"
    return `${clean.slice(0, 4)}***${clean.slice(-3)}`
  }
  if (type === "token") {
    if (recipient.length <= 12) return "***"
    return `${recipient.slice(0, 6)}...${recipient.slice(-4)}`
  }
  if (type === "userId") {
    if (recipient.length <= 8) return recipient
    return `${recipient.slice(0, 8)}...`
  }
  return recipient.slice(0, 4) + "***"
}
