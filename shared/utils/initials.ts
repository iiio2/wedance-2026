/**
 * Avatar initials from a display name, safe for any Unicode.
 *
 * `name.charAt(0)` / `word[0]` take one UTF-16 code unit, which cuts astral
 * characters in half: a synced title in styled "math bold" letters
 * ("𝐆𝐋𝐎𝐁𝐀𝐋 𝐓𝐀𝐑𝐑𝐀𝐗𝐎 …") or an emoji yields a lone surrogate. SSR can't encode
 * it and sends "�" while the client renders "\ud835", so /festivals logged
 * "Hydration completed but contains mismatches" — and showed a broken glyph.
 *
 * NFKC folds the styled letters back to plain ones ("𝐆" → "G"); iterating the
 * string walks code points, and the first letter or digit wins, so "¡Menéate"
 * reads "M" and an emoji-only name falls back.
 */
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u

/** First letter or digit of `name`, upper-cased — `fallback` when there is none. */
export function initialOf(name: string | null | undefined, fallback = '?'): string {
  for (const ch of (name ?? '').normalize('NFKC')) {
    if (LETTER_OR_DIGIT.test(ch)) return ch.toUpperCase()
  }
  return fallback
}

/** The initials of the first `max` words that have a letter or digit ("Ana María" → "AM"). */
export function initialsOf(name: string | null | undefined, max = 2, fallback = '?'): string {
  const out = (name ?? '')
    .normalize('NFKC')
    .split(/\s+/)
    .map(word => initialOf(word, ''))
    .filter(Boolean)
    .slice(0, max)
    .join('')
  return out || fallback
}
