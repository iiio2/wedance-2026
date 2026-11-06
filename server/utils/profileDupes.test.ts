import { describe, it, expect } from 'vitest'
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core'
import * as schema from '../database/schema'
import { nameTokens, similarNames, dupeReasonText } from './profileDupes'
import { instagramHandles, PROFILE_REFS, PROFILE_REFS_KEPT } from './mergeProfiles'

describe('similarNames', () => {
  it('sees the same place written in another order (#458)', () => {
    expect(similarNames('Bar Buena Vista', 'Buena Vista Bar')).toBe(true)
    expect(nameTokens('Bar Buena Vista')).toEqual(['buena', 'vista'])
  })
  it('ignores accents, punctuation and the city name', () => {
    expect(similarNames('Café Tanzbär', 'tanzbar')).toBe(true)
    expect(similarNames('Salsa Club München', 'Salsa', 'München')).toBe(false)
    expect(similarNames('Kizz Talk Munich', 'Kizz Talk', 'Munich')).toBe(true)
  })
  it('matches a longer name that holds two distinctive words of the shorter one', () => {
    expect(similarNames('Buena Vista', 'Buena Vista Social Club')).toBe(true)
    expect(similarNames('Vista', 'Buena Vista Social Club')).toBe(false)
  })
  it('tells different names apart', () => {
    expect(similarNames('Bar Buena Vista', 'Bar Centrale')).toBe(false)
    expect(similarNames('The Club', 'Club Bar')).toBe(false)
  })
  it('explains the reasons', () => {
    expect(dupeReasonText(['instagram', 'name'])).toBe('same Instagram account, similar name in the same city')
  })
})

describe('instagramHandles', () => {
  it('reads the main account from socials and adds the aliases', () => {
    expect(instagramHandles({ socials: [{ platform: 'instagram', url: 'https://www.instagram.com/Buena_Vista_Bar/' }, { platform: 'website', url: 'https://x.de' }], instagramAliases: ['@barbuenavista', 'buena_vista_bar'] }))
      .toEqual(['buena_vista_bar', 'barbuenavista'])
  })
})

describe('PROFILE_REFS', () => {
  it('covers every column that references profiles.id', () => {
    const handled = new Set([...PROFILE_REFS.map(r => `${r.table}.${r.col}`), ...PROFILE_REFS_KEPT])
    const missing: string[] = []
    for (const t of Object.values(schema)) {
      if (!t || typeof t !== 'object' || !(Symbol.for('drizzle:IsDrizzleTable') in (t as object))) continue
      const cfg = getTableConfig(t as PgTable)
      for (const fk of cfg.foreignKeys) {
        const ref = fk.reference()
        if (getTableConfig(ref.foreignTable).name !== 'profiles') continue
        for (const c of ref.columns) if (!handled.has(`${cfg.name}.${c.name}`)) missing.push(`${cfg.name}.${c.name}`)
      }
    }
    expect(missing).toEqual([])
  })
})
