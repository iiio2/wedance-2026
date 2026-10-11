import { contrastRatio } from './contrast'

/**
 * Accent-tinted chips ("TIMBA" on the festival colour at 9 %) fail 4.5:1 when the
 * accent is light (amber, orange, sky). These helpers keep the hue but darken the
 * text just enough to pass — a lighter accent gets a darker tone, a dark one stays.
 */

const WHITE = 'white'

function parse(hex: string | null | undefined): [number, number, number] | null {
  if (typeof hex !== 'string') return null
  if (hex === WHITE) return [255, 255, 255]
  const m = /^#?([0-9a-f]{6})/i.exec(hex.trim())
  if (!m) return null
  const n = Number.parseInt(m[1]!, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map(c => Math.round(c).toString(16).padStart(2, '0')).join('')}`
}

/** `fg` laid over `bg` at `alpha` (0–1), like `color-mix(in srgb, fg alpha, bg)`. */
export function blend(fg: string, alpha: number, bg = WHITE): string {
  const a = parse(fg)
  const b = parse(bg)
  if (!a || !b) return bg
  return toHex([0, 1, 2].map(i => a[i]! * alpha + b[i]! * (1 - alpha)) as [number, number, number])
}

/** `hex` mixed toward black by `amount` (0–1), like `color-mix(in srgb, hex, black amount)`. */
export function darken(hex: string, amount: number): string {
  const a = parse(hex)
  if (!a) return hex
  return toHex(a.map(c => c * (1 - amount)) as [number, number, number])
}

/**
 * Text colour for `accent` on its own tint (`accent` at `tintAlpha` over `surface`).
 * Returns the accent itself when it already reaches `min`, otherwise the accent
 * darkened in 5 % steps until it does. Non-hex input is returned unchanged.
 */
export function accentText(accent: string, tintAlpha = 0.094, surface = WHITE, min = 4.5): string {
  if (!parse(accent)) return accent
  const bg = blend(accent, tintAlpha, surface)
  for (let k = 0; k <= 1; k += 0.05) {
    const c = darken(accent, k)
    if (contrastRatio(c, bg) >= min) return c
  }
  return darken(accent, 1)
}

/**
 * A festival accent safe to fill a button with white text (≥4.5:1), for
 * `<Button :accent>`. Light accents are darkened just enough; dark ones pass through.
 */
export function readableAccent(accent: string): string {
  return accentText(accent, 0)
}
