import { HANDLE_MAX, isValidHandle } from './handle'

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

/**
 * The WeDance handle for an Instagram handle: the same one ("caliente.nights"),
 * lowercased. Only when that can't be a handle (too short, "admin", ends like a
 * file: "salsa.js") do dots and underscores become dashes ("salsa-js").
 */
export function handleFromInstagram(ig: string): string {
  const same = ig.toLowerCase()
  if (isValidHandle(same)) return same
  return same.replace(/[._]+/g, '-').replace(/^-+|-+$/g, '').slice(0, HANDLE_MAX)
}

/** "ritmo_jg" → "Ritmo Jg": a starting point for the display name, to be edited. */
export function nameFromInstagram(ig: string): string {
  return ig.split(/[._]+/).filter(Boolean).map(w => w[0]!.toUpperCase() + w.slice(1)).join(' ')
}

export const instagramUrl = (handle: string) => `https://instagram.com/${handle}`
