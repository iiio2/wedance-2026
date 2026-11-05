/**
 * Looks for WeDance-hosted websites (hosted websites v1): a few presets that
 * fill the site kit's 13 role colours, a short list of heading fonts, and
 * resolveTheme(), which turns a site's settings (preset + optional accent and
 * font) into what the kit writes into <head> (wedance-site-kit SiteTheme).
 *
 * Colours are space-separated RGB channels ("245 158 11"), like the kit's
 * CSS variables, so Tailwind opacity modifiers keep working.
 */
import type { SiteThemeSettings } from '../types/profileSite'

export const THEME_ROLES = ['bg', 'surface', 'border', 'border-strong', 'border-button', 'heading', 'text', 'muted', 'subtle', 'faint', 'accent', 'highlight', 'on-accent'] as const
export type ThemeRole = (typeof THEME_ROLES)[number]
type Vars = Record<ThemeRole, string>

const v = (...rows: string[]): Vars => Object.fromEntries(THEME_ROLES.map((r, i) => [r, rows[i]!])) as Vars

export const SITE_FONTS: Record<string, { label: string; family: string; google?: string }> = {
  'georgia': { label: 'Classic serif', family: "Georgia, 'Times New Roman', serif" },
  'playfair': { label: 'Playfair Display', family: "'Playfair Display', Georgia, serif", google: 'Playfair+Display:wght@600;700' },
  'dm-serif': { label: 'DM Serif Display', family: "'DM Serif Display', Georgia, serif", google: 'DM+Serif+Display' },
  'fraunces': { label: 'Fraunces', family: "'Fraunces', Georgia, serif", google: 'Fraunces:wght@600;700' },
  'bebas': { label: 'Bebas Neue', family: "'Bebas Neue', Impact, sans-serif", google: 'Bebas+Neue' },
  'montserrat': { label: 'Montserrat', family: "'Montserrat', Arial, sans-serif", google: 'Montserrat:wght@700;800' },
  'archivo-black': { label: 'Archivo Black', family: "'Archivo Black', Arial, sans-serif", google: 'Archivo+Black' },
}

export const SITE_THEMES: Record<string, { label: string; dark: boolean; font: keyof typeof SITE_FONTS; vars: Vars }> = {
  'night-gold': {
    label: 'Night & gold', dark: true, font: 'georgia',
    vars: v('9 9 11', '24 24 27', '39 39 42', '63 63 70', '82 82 91', '255 255 255', '228 228 231', '212 212 216', '161 161 170', '113 113 122', '245 158 11', '251 191 36', '9 9 11'),
  },
  'havana-wine': {
    label: 'Havana wine', dark: true, font: 'playfair',
    vars: v('30 8 14', '48 14 24', '72 24 36', '98 36 52', '120 48 66', '250 240 228', '236 222 206', '222 204 186', '182 160 142', '140 118 104', '201 162 39', '222 186 80', '30 8 14'),
  },
  'midnight-coral': {
    label: 'Midnight & coral', dark: true, font: 'bebas',
    vars: v('12 18 36', '20 29 54', '33 45 78', '51 65 105', '71 85 130', '248 250 252', '226 232 240', '203 213 225', '148 163 184', '100 116 139', '251 113 133', '253 164 175', '12 18 36'),
  },
  'clean-light': {
    label: 'Clean light', dark: false, font: 'dm-serif',
    vars: v('250 250 249', '241 240 237', '228 226 222', '205 202 196', '180 176 170', '24 24 27', '39 39 42', '63 63 70', '113 113 122', '161 161 170', '220 38 38', '185 28 28', '255 255 255'),
  },
  'tropical': {
    label: 'Tropical', dark: false, font: 'fraunces',
    vars: v('255 251 245', '254 243 226', '245 222 190', '230 196 150', '214 172 120', '28 25 23', '41 37 36', '68 64 60', '120 113 108', '168 162 158', '13 148 136', '15 118 110', '255 255 255'),
  },
  'mono': {
    label: 'Black & white', dark: false, font: 'archivo-black',
    vars: v('255 255 255', '245 245 245', '229 229 229', '212 212 212', '163 163 163', '10 10 10', '23 23 23', '64 64 64', '115 115 115', '163 163 163', '10 10 10', '64 64 64', '255 255 255'),
  },
}
export const DEFAULT_THEME = 'night-gold'

/** What the site kit's useSiteTheme() applies (mirrors wedance-site-kit SiteTheme). */
export type ResolvedSiteTheme = { vars: Partial<Vars>; fontDisplay?: string; fontUrl?: string; logo?: string; favicon?: string }

const channels = (hex: string): [number, number, number] | null => {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : null
}
const rgb = (c: number[]) => c.map(n => Math.round(Math.min(255, Math.max(0, n)))).join(' ')
/** Relative luminance (WCAG), 0 = black, 1 = white. */
export function luminance([r, g, b]: [number, number, number]) {
  const lin = (x: number) => { const s = x / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
const mix = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i]! - x) * t)

/**
 * The look a hosted site gets, or undefined when it has none (hand-built sites:
 * they keep their own). An unknown preset falls back to the default one.
 */
export function resolveTheme(settings: SiteThemeSettings | undefined | null): ResolvedSiteTheme | undefined {
  if (!settings) return undefined
  const preset = SITE_THEMES[settings.preset ?? ''] ?? SITE_THEMES[DEFAULT_THEME]!
  const vars: Vars = { ...preset.vars }
  const accent = settings.accent ? channels(settings.accent) : null
  if (accent) {
    vars.accent = rgb(accent)
    // Hovers and the highlighted end of titles: the accent, a little towards the text colour.
    vars.highlight = rgb(mix(accent, preset.dark ? [255, 255, 255] : [0, 0, 0], 0.25))
    // Text on accent buttons: whichever of black and white reads better.
    vars['on-accent'] = luminance(accent) > 0.4 ? '10 10 10' : '255 255 255'
  }
  const font = SITE_FONTS[settings.font ?? ''] ?? SITE_FONTS[preset.font]!
  return {
    vars,
    fontDisplay: font.family,
    fontUrl: font.google ? `https://fonts.googleapis.com/css2?family=${font.google}&display=swap` : undefined,
    logo: settings.logo || undefined,
    favicon: settings.favicon || undefined,
  }
}
