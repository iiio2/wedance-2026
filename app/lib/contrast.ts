/** WCAG 2.x contrast helpers for the /docs/design colour docs. */

function channel(c: number) {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** Hex without '#', expanded to 6 digits: 3-digit shorthand doubles each digit, 8-digit drops the alpha. */
function hex6(hex: string) {
  const h = hex.replace('#', '')
  return h.length === 3 ? [...h].map(c => c + c).join('') : h.slice(0, 6)
}

export function luminance(hex: string) {
  const n = Number.parseInt(hex6(hex), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

/** 'AAA' ≥ 7, 'AA' ≥ 4.5, 'AA large' ≥ 3 (18px+ or 14px bold), else 'fail'. */
export function wcagLevel(ratio: number) {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA large'
  return 'fail'
}

const toHex = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
const rgb = (hex: string) => {
  const n = Number.parseInt(hex6(hex), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const
}

/** sRGB mix: `weight` of `a` over `b` (0..1). `mixHex(accent, '#fff', 0.094)` = the `accent + '18'` chip tint on white. */
export function mixHex(a: string, b: string, weight: number) {
  const [ar, ag, ab] = rgb(a)
  const [br, bg, bb] = rgb(b)
  return `#${toHex(ar * weight + br * (1 - weight))}${toHex(ag * weight + bg * (1 - weight))}${toHex(ab * weight + bb * (1 - weight))}`
}

/**
 * Darken `hex` toward black in 5% steps until it reaches `min` contrast on `bg`.
 * For accent text on an accent tint (chips): readableOn(accent, mixHex(accent, '#fff', 0.094)).
 * Colours that already pass come back unchanged.
 */
export function readableOn(hex: string, bg = '#fff', min = 4.5) {
  let out = `#${hex6(hex)}`
  for (let k = 0.05; contrastRatio(out, bg) < min && k <= 1; k += 0.05) out = mixHex('#000', hex, k)
  return out
}
