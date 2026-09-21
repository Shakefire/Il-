export function getFallbackImage(title: string, subtitle: string): string {
  const cleanTitle = title.replace(/[<>&"]/g, "");
  const cleanSub = subtitle.replace(/[<>&"]/g, "");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#F2F1ED"/>
        <stop offset="100%" stop-color="#E5E2DA"/>
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#bg)"/>
    <circle cx="400" cy="190" r="80" fill="#24483A" opacity="0.08"/>
    <rect x="220" y="255" width="360" height="135" rx="14" fill="#FFFFFF" opacity="0.85"/>
    <text x="400" y="305" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="600" fill="#171717" text-anchor="middle">${cleanTitle}</text>
    <path d="M300 330 L500 330" stroke="#E7E5E0" stroke-width="1.5"/>
    <text x="400" y="362" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="#6B6B67" text-anchor="middle">${cleanSub}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
