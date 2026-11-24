/**
 * Strip markup and control characters from guest- or host-authored text.
 * Returns null when nothing readable remains.
 */
export function toPlainText(value: unknown, max = 2000): string | null {
  if (typeof value !== "string") return null
  const stripped = value
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
  if (!stripped) return null
  return stripped.slice(0, max)
}
