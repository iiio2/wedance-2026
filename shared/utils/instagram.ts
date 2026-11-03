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

export type InstagramLink =
  | { kind: 'post' | 'reel'; code: string; url: string }
  | { kind: 'profile'; handle: string }

/**
 * What an Instagram link points at (#453): a post or reel (by its short code,
 * the canonical URL back) or a page. `/p/`, `/reel/`, `/reels/`, `/tv/` and the
 * `/<handle>/p/<code>` form (a post opened from a profile) are posts; share
 * params (?igsh=…) are dropped. Null when it isn't an Instagram link at all.
 */
export function parseInstagramLink(input: string | null | undefined): InstagramLink | null {
  const raw = (input ?? '').trim()
  const m = raw.match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/([^?#\s]*)/i)
  if (!m) return null
  const parts = m[1]!.split('/').filter(Boolean)
  const at = parts.findIndex(p => /^(p|reels?|tv)$/i.test(p))
  if (at >= 0 && at <= 1) {
    const code = parts[at + 1]
    if (!code || !/^[\w-]{5,40}$/.test(code)) return null
    const kind = /^p$/i.test(parts[at]!) ? 'post' : 'reel'
    return { kind, code, url: `https://www.instagram.com/${kind === 'post' ? 'p' : 'reel'}/${code}/` }
  }
  const handle = parseInstagramHandle(raw)
  return handle ? { kind: 'profile', handle } : null
}
