import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { WHATS_NEW, formatWhatsNewDate, sortedWhatsNew } from './whats-new'

const root = resolve(__dirname, '../..')
const pageExists = (to: string) => {
  const base = resolve(root, 'app/pages', to.replace(/^\//, '').split(/[?#]/)[0]!)
  return existsSync(`${base}.vue`) || existsSync(resolve(base, 'index.vue'))
}

describe("what's new feed", () => {
  it('has unique ids and valid ISO dates', () => {
    const ids = WHATS_NEW.map(e => e.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const e of WHATS_NEW) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(Number.isNaN(Date.parse(e.date))).toBe(false)
      expect(e.id.startsWith(e.date)).toBe(true)
    }
  })

  it('keeps descriptions short (1–3 sentences)', () => {
    for (const e of WHATS_NEW) {
      const sentences = e.description.split(/(?<=[.!?])\s+/).filter(Boolean)
      expect(sentences.length, e.id).toBeLessThanOrEqual(3)
    }
  })

  it('ships every image (with alt text, under 250 KB) and og twin', () => {
    for (const e of WHATS_NEW.filter(e => e.image)) {
      for (const src of [e.image!.src, e.image!.og].filter(Boolean) as string[]) {
        const file = resolve(root, 'public', src.replace(/^\//, ''))
        expect(existsSync(file), src).toBe(true)
        expect(statSync(file).size, src).toBeLessThan(250 * 1024)
      }
      expect(e.image!.alt.length, e.id).toBeGreaterThan(20)
    }
  })

  it('points CTAs at routes that exist and Instagram links at posts', () => {
    for (const e of WHATS_NEW) {
      if (e.cta) expect(pageExists(e.cta.to), e.cta.to).toBe(true)
      if (e.instagram) expect(e.instagram).toMatch(/^https:\/\/www\.instagram\.com\/(p|reel)\/[\w-]+\/?$/)
    }
  })

  it('sorts newest first and formats dates', () => {
    const sorted = sortedWhatsNew([
      { id: '2026-01-01-a', date: '2026-01-01', title: 'a', description: 'a.' },
      { id: '2026-03-01-b', date: '2026-03-01', title: 'b', description: 'b.' },
    ])
    expect(sorted.map(e => e.id)).toEqual(['2026-03-01-b', '2026-01-01-a'])
    expect(formatWhatsNewDate('2026-10-16')).toBe('16 October 2026')
  })
})

describe("what's new route", () => {
  it('has no public/ folder shadowing the /whats-new page', () => {
    // A public/whats-new/ dir makes the static server 301 /whats-new → /whats-new/.
    expect(existsSync(resolve(root, 'public/whats-new'))).toBe(false)
  })
})
