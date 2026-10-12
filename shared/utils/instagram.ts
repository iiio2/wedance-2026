/**
 * Instagram handle from whatever people paste: a profile URL (with or without
 * www., trailing slash, ?igsh=… share params), "@handle" or a bare handle.
 * Returns null when it isn't a plausible handle. Lowercased, like Instagram.
 */
export function parseInstagramHandle(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = input.trim()
    .replace(/^https?:\/\/(www\.|m\.)?instagram\.com\//i, '')
    .replace(/^instagram\.com\//i, '')
    .replace(/^@/, '')
    .split(/[/?#]/)[0]!
    .toLowerCase()
  return /^[a-z0-9._]{1,30}$/.test(raw) && !/^\.|\.$|\.\./.test(raw) ? raw : null
}

/** "ritmo_jg" → "ritmo-jg": a WeDance handle (letters, numbers, dashes). */
export function handleFromInstagram(ig: string): string {
  return ig.replace(/[._]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

/** "ritmo_jg" → "Ritmo Jg": a starting point for the display name, to be edited. */
export function nameFromInstagram(ig: string): string {
  return ig.split(/[._]+/).filter(Boolean).map(w => w[0]!.toUpperCase() + w.slice(1)).join(' ')
}

export const instagramUrl = (handle: string) => `https://instagram.com/${handle}`
