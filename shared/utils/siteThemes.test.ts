import { describe, expect, it } from 'vitest'
import { SITE_FONTS, SITE_THEMES, THEME_ROLES, luminance, resolveTheme } from './siteThemes'

const ch = (s: string) => s.split(' ').map(Number) as [number, number, number]
const contrast = (a: string, b: string) => { const [x, y] = [luminance(ch(a)), luminance(ch(b))].sort((m, n) => n - m); return (x! + 0.05) / (y! + 0.05) }

describe('site themes', () => {
  it('a site without a theme (hand-built) gets none', () => {
    expect(resolveTheme(undefined)).toBeUndefined()
  })
  it('every preset fills all 13 roles with RGB channels and reads well', () => {
    for (const [id, t] of Object.entries(SITE_THEMES)) {
      expect(Object.keys(t.vars).sort(), id).toEqual([...THEME_ROLES].sort())
      for (const val of Object.values(t.vars)) expect(val, id).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/)
      expect(contrast(t.vars.text, t.vars.bg), `${id} text`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(t.vars['on-accent'], t.vars.accent), `${id} button`).toBeGreaterThanOrEqual(3)
      expect(SITE_FONTS[t.font], id).toBeTruthy()
    }
  })
  it('a preset, an accent and a font', () => {
    const t = resolveTheme({ preset: 'clean-light', accent: '#0d9488', font: 'montserrat', logo: 'https://x/logo.png' })!
    expect(t.vars.bg).toBe(SITE_THEMES['clean-light']!.vars.bg)
    expect(t.vars.accent).toBe('13 148 136')
    expect(t.vars['on-accent']).toBe('255 255 255')
    expect(t.fontDisplay).toContain('Montserrat')
    expect(t.fontUrl).toBe('https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800&display=swap')
    expect(t.logo).toBe('https://x/logo.png')
  })
  it('a light accent gets dark button text; unknown preset → the default', () => {
    expect(resolveTheme({ accent: '#fde047' })!.vars['on-accent']).toBe('10 10 10')
    expect(resolveTheme({ preset: 'nope' })!.vars.bg).toBe(SITE_THEMES['night-gold']!.vars.bg)
    expect(resolveTheme({})!.fontUrl).toBeUndefined()
  })
})
