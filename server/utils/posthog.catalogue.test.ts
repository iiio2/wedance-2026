/**
 * Keeps the analytics catalogue honest: every `server_*` event the code sends
 * must be documented in CLAUDE.md → "Analytics (PostHog)", and renamed events
 * must not come back (tracking plan: server name = `server_` + client name).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, it, expect } from 'vitest'

const ROOT = process.cwd()

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) sourceFiles(p, out)
    else if (/\.(ts|vue)$/.test(name) && !/\.test\.ts$/.test(name)) out.push(p)
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
