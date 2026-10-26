/**
 * Keeps the analytics catalogue honest: every client event (`track` /
 * `trackOnce` in app/) and every `server_*` event the code sends must be
 * documented in CLAUDE.md → "Analytics (PostHog)", and renamed events must
 * not come back (tracking plan: server name = `server_` + client name).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = process.cwd()

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    // generated/ and sketches/ are not product surfaces.
    if (name === 'node_modules' || name.startsWith('.') || name === 'generated' || name === 'sketches') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) sourceFiles(p, out)
    else if (/\.(ts|vue)$/.test(name) && !name.endsWith('.test.ts')) out.push(p)
  }
  return out
}

/** Event names passed to trackServer(ctx, 'x') / trackServerEvent(event, 'x', …), incl. ternaries. */
export function serverEventNames(): Map<string, string> {
  const names = new Map<string, string>()
  for (const file of sourceFiles(join(ROOT, 'server'))) {
    const src = readFileSync(file, 'utf8')
    const re = /trackServer(?:Event)?\(\s*[^,]+,\s*([^{]*?)(?:,|\))/g
    for (const m of src.matchAll(re)) {
      for (const lit of m[1]!.matchAll(/'([a-z0-9_]+)'/g)) {
        if (lit[1]!.includes('_')) names.set(lit[1]!, relative(ROOT, file))
      }
    }
  }
  return names
}

/** Event names passed to useTrack().track('x') / trackOnce(key, 'x'), incl. ternaries. */
function clientEventNames(): Map<string, string> {
  const names = new Map<string, string>()
  for (const file of sourceFiles(join(ROOT, 'app'))) {
    const src = readFileSync(file, 'utf8')
    for (const m of src.matchAll(/\b(?:track|trackOnce)\(\s*([^{]*?)(?:,\s*\{|\))/g)) {
      for (const lit of m[1]!.matchAll(/'([a-z0-9_]+)'/g)) {
        if (lit[1]!.includes('_')) names.set(lit[1]!, relative(ROOT, file))
      }
    }
  }
  return names
}

/** Documented as `x` — or covered by a wildcard row such as `whats_new_*_click`. */
function documented(catalogue: string, name: string): boolean {
  if (catalogue.includes(`\`${name}\``)) return true
  return [...catalogue.matchAll(/`([a-z0-9_]*\*[a-z0-9_*]*)`/g)]
    .some(m => new RegExp(`^${m[1]!.replace(/\*/g, '[a-z0-9_]+')}$`).test(name))
}

describe('client analytics catalogue', () => {
  const catalogue = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8')
  const names = clientEventNames()

  it('finds the client events (sanity)', () => {
    expect(names.has('city_viewed')).toBe(true)
    expect(names.has('outbound_click')).toBe(true)
  })

  it('documents every client event in CLAUDE.md', () => {
    const missing = [...names.keys()].filter(n => !documented(catalogue, n))
    expect(missing).toEqual([])
  })
})

describe('server analytics catalogue', () => {
  const catalogue = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8')
  const names = serverEventNames()

  it('finds the server events (sanity)', () => {
    expect(names.has('signup_completed')).toBe(true)
    expect(names.has('ticket_purchased')).toBe(true)
  })

  it('documents every server event in CLAUDE.md', () => {
    const missing = [...names.keys()].filter(n => !catalogue.includes(`\`server_${n}\``))
    expect(missing).toEqual([])
  })

  it('uses the client event name for server copies (renamed events stay gone)', () => {
    expect(names.has('booking_requested')).toBe(false)
    expect(names.has('inquiry_sent')).toBe(false)
    expect(names.has('booking_request_submitted')).toBe(true)
    expect(names.has('booking_inquiry_sent')).toBe(true)
    expect(catalogue).not.toContain('`server_booking_requested`')
    expect(catalogue).not.toContain('`server_inquiry_sent`')
  })
})
