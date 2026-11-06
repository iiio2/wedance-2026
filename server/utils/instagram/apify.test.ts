import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fixture from './__fixtures__/profile-scraper.json'
import { runActor, fetchInstagramProfiles, normalizeInstagramProfile, clearInstagramCache, ApifyError, PROFILE_SCRAPER } from './apify'

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('runActor', () => {
  it('POSTs the input to run-sync-get-dataset-items with the token as a bearer header', async () => {
    const f = vi.fn(async () => ok([{ a: 1 }]))
    const items = await runActor('apify~instagram-profile-scraper', { usernames: ['x'] }, { token: 't0k', fetch: f as any, timeoutSecs: 60 })
    expect(items).toEqual([{ a: 1 }])
    const [url, init] = f.mock.calls[0] as any
    expect(url).toBe('https://api.apify.com/v2/acts/apify~instagram-profile-scraper/run-sync-get-dataset-items?format=json&clean=true&timeout=60')
    expect(url).not.toContain('t0k')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer t0k')
    expect(JSON.parse(init.body)).toEqual({ usernames: ['x'] })
  })

  it('is a no-op without a token', async () => {
    const f = vi.fn()
    expect(await runActor('a~b', {}, { token: null, fetch: f as any })).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })

  it('throws ApifyError on an error status and on a timeout', async () => {
    await expect(runActor('a~b', {}, { token: 't', fetch: (async () => new Response('quota', { status: 402 })) as any })).rejects.toBeInstanceOf(ApifyError)
    const hang = ((_: string, init: any) => new Promise((_r, reject) => init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))) as any
    await expect(runActor('a~b', {}, { token: 't', fetch: hang, abortMs: 10 })).rejects.toThrow(/timed out/)
  })
})

describe('normalizeInstagramProfile', () => {
  it('reads the profile scraper output, HD picture first', () => {
    const p = normalizeInstagramProfile(fixture[0])!
    expect(p).toMatchObject({
      handle: 'dj_salsero_test', fullName: 'DJ Salsero 🎧', biography: 'Salsa & timba DJ from Munich.\nBookings via DM.',
      photoUrl: 'https://scontent.cdninstagram.com/v/t51/hd.jpg', externalUrl: 'https://linktr.ee/djsalsero',
      isBusiness: false, isPrivate: false, address: null,
    })
  })

  it('reads a business address in any shape', () => {
    expect(normalizeInstagramProfile(fixture[1])!.address).toEqual({ street: 'Musterstraße 5', zip: '80331', city: 'Munich, Germany' })
    const asString = { username: 'v', businessAddress: JSON.stringify({ city_name: 'Berlin', street_address: 'A 1' }) }
    expect(normalizeInstagramProfile(asString)!.address).toEqual({ street: 'A 1', zip: null, city: 'Berlin' })
    expect(normalizeInstagramProfile({ username: 'v', cityName: 'Wien' })!.address).toEqual({ street: null, zip: null, city: 'Wien' })
  })

  it('tolerates missing fields and skips error rows', () => {
    expect(normalizeInstagramProfile({ username: 'Bare' })).toEqual({
      handle: 'bare', fullName: null, biography: null, photoUrl: null, externalUrl: null, isBusiness: false, isPrivate: false, category: null, address: null,
    })
    expect(normalizeInstagramProfile(fixture[2])).toBeNull()
    expect(normalizeInstagramProfile(null)).toBeNull()
    expect(normalizeInstagramProfile({ username: '  ' })).toBeNull()
  })
})

describe('fetchInstagramProfiles', () => {
  beforeEach(() => clearInstagramCache())
  afterEach(() => clearInstagramCache())

  it('asks for every handle in one run, maps not-found to null, caches per handle', async () => {
    const f = vi.fn(async () => ok(fixture))
    const m = await fetchInstagramProfiles(['@DJ_Salsero_Test', 'galerie_test_venue', 'no_such_account_test'], { token: 't', fetch: f as any, now: 1000 })
    expect(f).toHaveBeenCalledTimes(1)
    const [url, init] = f.mock.calls[0] as any
    expect(url).toContain(PROFILE_SCRAPER)
    expect(JSON.parse(init.body)).toEqual({ usernames: ['dj_salsero_test', 'galerie_test_venue', 'no_such_account_test'] })
    expect(m.get('dj_salsero_test')?.fullName).toBe('DJ Salsero 🎧')
    expect(m.get('galerie_test_venue')?.isBusiness).toBe(true)
    expect(m.has('no_such_account_test')).toBe(true)
    expect(m.get('no_such_account_test')).toBeNull()

    // Cached: a second ask within the hour doesn't call Apify.
    const again = await fetchInstagramProfiles(['dj_salsero_test'], { token: 't', fetch: f as any, now: 1000 + 3600_000 })
    expect(f).toHaveBeenCalledTimes(1)
    expect(again.get('dj_salsero_test')?.handle).toBe('dj_salsero_test')
    // A miss is retried sooner than a hit.
    await fetchInstagramProfiles(['no_such_account_test', 'dj_salsero_test'], { token: 't', fetch: f as any, now: 1000 + 3600_000 })
    expect(f).toHaveBeenCalledTimes(2)
    expect(JSON.parse((f.mock.calls[1] as any)[1].body)).toEqual({ usernames: ['no_such_account_test'] })
  })

  it('caches nothing when the run fails', async () => {
    const bad = vi.fn(async () => new Response('down', { status: 500 }))
    await expect(fetchInstagramProfiles(['a_b'], { token: 't', fetch: bad as any })).rejects.toBeInstanceOf(ApifyError)
    const good = vi.fn(async () => ok([{ username: 'a_b', fullName: 'A B' }]))
    expect((await fetchInstagramProfiles(['a_b'], { token: 't', fetch: good as any })).get('a_b')?.fullName).toBe('A B')
  })

  it('returns an empty map without a token', async () => {
    const f = vi.fn()
    expect((await fetchInstagramProfiles(['x'], { token: null, fetch: f as any })).size).toBe(0)
    expect(f).not.toHaveBeenCalled()
  })
})
