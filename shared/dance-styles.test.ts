import { describe, expect, it } from 'vitest'
import { STYLE_MAP } from '../server/utils/v3EventSync'
import {
  ALL_DANCE_STYLES,
  DANCE_FAMILIES,
  DANCE_STYLES,
  canonicalDanceStyle,
  danceStyleAccent,
  danceStyleKey,
  displayDanceStyle,
  findDanceStyle,
  matchesDanceStyleQuery,
  sameDanceStyle,
  sortDanceStyles,
} from './dance-styles'

/**
 * Distinct `styles` values stored in production on 2026-10-12 (read-only SELECT
 * over dancers.dance_styles, festivals, events, profiles, community_groups,
 * booking_requests, gigs). Every one must resolve, except the known junk below.
 */
const PROD_VALUES = [
  'Salsa', 'Bachata', 'Casino', 'Zouk', 'Kizomba', 'Timba', 'Urban Kiz', 'Rueda', 'Tarraxo', 'Rumba',
  'Afro', 'Son', 'Lambada', 'Ballroom', 'Tango', 'Afrobeats', 'Reggaeton', 'Reparto', 'Dancehall',
  'Merengue', 'Amapiano', 'Semba', 'Cuban', 'Hip Hop', 'Samba', 'Rumba Columbia', 'Afro House',
  'Rumba Yambu', 'Ladies', 'Theory', 'timba',
]
/** Not a style — a slug leaked into gigs.styles. Reported, not mapped. */
const KNOWN_JUNK = ['timba-2']

/** Values the pre-taxonomy hard-coded lists offered (settings/onboarding/my-plan/@handle). */
const LEGACY_PICKER_VALUES = ['Salsa', 'Bachata', 'Kizomba', 'Zouk', 'Timba', 'Semba', 'Afro-Cuban', 'Reggaeton', 'Cha-Cha', 'Casino', 'Rueda', 'Afro']

describe('dance-style taxonomy', () => {
  it('has unique ids and names', () => {
    const ids = ALL_DANCE_STYLES.map(s => s.id)
    const names = ALL_DANCE_STYLES.map(s => danceStyleKey(s.name))
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(names).size).toBe(names.length)
  })

  it('ids are kebab-case', () => {
    for (const s of ALL_DANCE_STYLES) expect(s.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('no alias points at two different styles', () => {
    const owner = new Map<string, string>()
    const clashes: string[] = []
    for (const s of ALL_DANCE_STYLES) {
      for (const k of new Set([s.name, s.id, s.label, ...s.aliases].filter(Boolean).map(v => danceStyleKey(v!)))) {
        const prev = owner.get(k)
        if (prev && prev !== s.id) clashes.push(`${k}: ${prev} vs ${s.id}`)
        owner.set(k, s.id)
      }
    }
    expect(clashes).toEqual([])
  })

  it('every family is used and every parent exists', () => {
    const ids = new Set(ALL_DANCE_STYLES.map(s => s.id))
    for (const f of DANCE_FAMILIES) expect(ALL_DANCE_STYLES.some(s => s.family === f.id), f.id).toBe(true)
    for (const s of ALL_DANCE_STYLES) if (s.parent) expect(ids.has(s.parent), `${s.id} → ${s.parent}`).toBe(true)
  })

  it('is in popularity order, the big three first', () => {
    expect(DANCE_STYLES.slice(0, 3).map(s => s.name)).toEqual(['Salsa', 'Bachata', 'Kizomba'])
    const ranks = DANCE_STYLES.map(s => s.rank ?? Infinity)
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks)
  })

  it('excludes workshop topics from pickable styles', () => {
    expect(DANCE_STYLES.find(s => s.name === 'Ladies')).toBeUndefined()
    expect(findDanceStyle('Ladies')?.topic).toBe(true)
  })

  it('maps every stored prod value', () => {
    const unmapped = PROD_VALUES.filter(v => !findDanceStyle(v))
    expect(unmapped).toEqual([])
    for (const junk of KNOWN_JUNK) expect(findDanceStyle(junk)).toBeUndefined()
  })

  it('stored canonical names round-trip unchanged (backward compatible)', () => {
    for (const v of PROD_VALUES.filter(v => v !== 'Cuban' && v !== 'timba')) expect(canonicalDanceStyle(v)).toBe(v)
  })

  it('maps every legacy picker value and every v3 sync label', () => {
    expect(LEGACY_PICKER_VALUES.filter(v => !findDanceStyle(v))).toEqual([])
    expect(Object.values(STYLE_MAP).filter(v => !findDanceStyle(v))).toEqual([])
    expect(Object.keys(STYLE_MAP).filter(k => !findDanceStyle(k))).toEqual([])
  })

  it('resolves aliases case-, accent- and punctuation-insensitively', () => {
    expect(canonicalDanceStyle('salsa on1')).toBe('Salsa LA')
    expect(canonicalDanceStyle('Rueda de Casino')).toBe('Rueda')
    expect(canonicalDanceStyle('Afro-Cuban')).toBe('Afro')
    expect(canonicalDanceStyle('cha-cha')).toBe('Cha-Cha-Cha')
    expect(canonicalDanceStyle('Danzon')).toBe('Danzón')
    expect(canonicalDanceStyle('URBANKIZZ')).toBe('Urban Kiz')
    expect(canonicalDanceStyle('Pole fusion')).toBe('Pole fusion')
    expect(displayDanceStyle('Afro')).toBe('Afro-Cuban')
    expect(sameDanceStyle('Rueda', 'rueda de casino')).toBe(true)
  })

  it('sorts and de-duplicates by popularity, unknown last', () => {
    expect(sortDanceStyles(['Zouk', 'mystery', 'Salsa', 'salsa', 'Rueda de Casino'])).toEqual(['Salsa', 'Zouk', 'Rueda de Casino', 'mystery'])
  })

  it('searches names, aliases and families', () => {
    const hits = (q: string) => DANCE_STYLES.filter(s => matchesDanceStyleQuery(s, q)).map(s => s.name)
    expect(hits('LA style')).toEqual(['Salsa LA'])
    expect(hits('kompa')).toEqual(['Kompa'])
    expect(hits('swing')).toContain('Lindy Hop')
    expect(hits('forro')).toEqual(['Forró'])
  })

  it('colours come from WD tokens', () => {
    expect(danceStyleAccent('Salsa')).toMatch(/^#[0-9a-f]{6}$/i)
    expect(danceStyleAccent('unknown')).toMatch(/^#[0-9a-f]{6}$/i)
  })
})

describe('detectDanceStyle', () => {
  it('finds whole-word mentions, longest first, and ignores common words', async () => {
    const { detectDanceStyle } = await import('./dance-styles')
    expect(detectDanceStyle('Nail my salsa on2 turns')?.name).toBe('Salsa NY')
    expect(detectDanceStyle('Dance bachata at a festival')?.name).toBe('Bachata')
    expect(detectDanceStyle('Take a lesson with my son at the bar')?.name).toBeUndefined()
    expect(detectDanceStyle('Learn Rueda de Casino calls')?.name).toBe('Rueda')
  })
})

describe('relatedDanceStyles', () => {
  it('links variants to their ancestors, not siblings', async () => {
    const { relatedDanceStyles } = await import('./dance-styles')
    expect(relatedDanceStyles('Rueda', 'Salsa')).toBe(true)
    expect(relatedDanceStyles('Salsa', 'Salsa NY')).toBe(true)
    expect(relatedDanceStyles('Salsa NY', 'Salsa LA')).toBe(false)
    expect(relatedDanceStyles('Bachata', 'Salsa')).toBe(false)
  })
})
