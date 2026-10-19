import { describe, expect, it } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import { candidates, freeHandle, handleSlug, pickHandle, unreadable } from './handles'

describe('unreadable', () => {
  it('spots handles nobody could say', () => {
    expect(unreadable('ChIJpTxPR1XZnUcRER0LZABcUuE')).toBe('google id')
    expect(unreadable('1396922169')).toBe('number')
    expect(unreadable('salsamc3a1spasing')).toBe('garbled')
    expect(unreadable('alosha-589fb')).toBe('random suffix')
    expect(unreadable('bodylanguageng2')).toBe('numbered copy')
    expect(unreadable('web.archive.orgweb20060107010')).toBe('not a handle')
    expect(unreadable('SalsamásPasing')).toBe('not a handle')
  })
  it('leaves readable ones alone', () => {
    for (const h of ['salsea', 'salsa.cubano', 'djlole', 'my-mia.de', 'alosha', 'evergreen-goes-luma', 'barbara-jimenez']) expect(unreadable(h)).toBeNull()
  })
})

describe('picking a handle', () => {
  it('prefers the Instagram handle, then the name, then name + city, then a number', () => {
    const p = { name: 'Salsa y Corazón', citySlug: 'munich', socials: [{ platform: 'instagram', url: 'https://instagram.com/salsaycorazon' }] }
    expect(candidates(p)).toEqual(['salsaycorazon', 'salsa-y-corazon', 'salsa-y-corazon-munich'])
    expect(pickHandle(candidates(p), new Set(['salsaycorazon']), handleSlug(p.name))).toBe('salsa-y-corazon')
    expect(pickHandle(candidates(p), new Set(['salsaycorazon', 'salsa-y-corazon', 'salsa-y-corazon-munich']), handleSlug(p.name))).toBe('salsa-y-corazon-2')
  })
  it('makes names into handles', () => {
    expect(handleSlug('Kulturzentrum Giesinger Bahnhof')).toBe('kulturzentrum-giesinger-bahnhof')
    expect(handleSlug('Arnulfstraße 195')).toBe('arnulfstrasse-195')
    expect(handleSlug('Alösha')).toBe('alosha')
    expect(handleSlug('Niranjan 9876543210')).toBe('niranjan')
    expect(handleSlug('01772359159')).toBe('')
    expect(handleSlug('Zentnerstraße 39, 80798')).toBe('zentnerstrasse-39-80798')
  })
})

// Signup must not die on a best-effort availability check (the username column
// is unique and register retries): one broken source — a column missing on a
// drifted DB, a malformed row — only drops what that source would have added.
describe('freeHandle', () => {
  /** A db stub: each query's SQL text decides its rows, or throws. */
  const stubDb = (answer: (text: string) => string[] | Error) => ({
    execute: async (q: any) => {
      const text = new PgDialect().sqlToQuery(q).sql
      const out = answer(text)
      if (out instanceof Error) throw out
      return { rows: out.map(h => ({ h })) }
    },
  })

  it('skips taken handles from every source', async () => {
    const db = stubDb(t => t.includes('old_usernames') ? ['adam'] : t.includes('oldHandles') ? ['adam-munich'] : t.includes('from profiles') ? ['adam-2'] : [])
    expect(await freeHandle(db, 'Adam', 'Munich')).toBe('adam-3')
  })

  it('still signs up when dancers.old_usernames is missing (the "Failed query" on create account)', async () => {
    const db = stubDb(t => t.includes('old_usernames') ? new Error('column "old_usernames" does not exist') : t.includes('from dancers') ? ['adam'] : [])
    expect(await freeHandle(db, 'Adam')).toBe('adam-2')
  })

  it('falls back to a random suffix only when current handles cannot be read', async () => {
    const db = stubDb(t => t.includes('from dancers where') ? new Error('connection reset') : [])
    expect(await freeHandle(db, 'Adam')).toMatch(/^adam-[0-9a-f]{5}$/)
  })

  it('guards each old-handles list against non-array JSON', async () => {
    const seen: string[] = []
    await freeHandle(stubDb((t) => { seen.push(t); return [] }), 'Adam')
    for (const t of seen.filter(t => t.includes('jsonb_array_elements_text'))) expect(t).toContain("jsonb_typeof")
  })
})
