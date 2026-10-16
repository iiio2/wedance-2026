import { describe, it, expect } from 'vitest'
import { dedupeFestivals, planRef, toFestivalRow, type FestivalEventRow } from './festivalListing'

const row = (over: Partial<FestivalEventRow> = {}): FestivalEventRow => ({
  id: '1ed1a238-0000-4000-8000-000000000000',
  name: 'Kubáname Salsa Festival',
  startDate: new Date('2026-10-22T16:00:00Z'),
  endDate: new Date('2026-10-25T21:59:00Z'),
  timezone: 'Europe/Berlin',
  city: 'Dresden',
  country: 'Germany',
  styles: ['Salsa'],
  ticketUrl: null,
  festival: null,
  ...over,
})
const none = { signupCount: 0, publicGoingCount: 0, goingAvatars: [] }

describe('planRef', () => {
  it('plans a festival with details by its permanent key (year plan)', () => {
    expect(planRef(row({ festival: { key: 'agua-pichi-2027' } }))).toEqual({ planType: 'festival', planId: 'agua-pichi-2027' })
  })

  it('plans any other festival event by its id (week plan), like its event page', () => {
    expect(planRef(row())).toEqual({ planType: 'event', planId: row().id })
  })
})

describe('dedupeFestivals', () => {
  it('keeps one of two wedance.vip copies of the same festival', () => {
    const a = row({ id: 'a' })
    const b = row({ id: 'b', name: ' kubáname salsa festival ' })
    expect(dedupeFestivals([a, b]).map(r => r.id)).toEqual(['a'])
  })

  it('prefers the copy with festival details', () => {
    const plain = row({ id: 'plain' })
    const detailed = row({ id: 'detailed', festival: { key: 'kubaname-2026' } })
    expect(dedupeFestivals([plain, detailed]).map(r => r.id)).toEqual(['detailed'])
  })

  it('keeps festivals with the same name on other days or in other cities', () => {
    const rows = [row({ id: 'a' }), row({ id: 'b', startDate: new Date('2027-10-21T16:00:00Z') }), row({ id: 'c', city: 'Leipzig' })]
    expect(dedupeFestivals(rows).map(r => r.id)).toEqual(['a', 'b', 'c'])
  })

  it('compares first days in the festival\'s own time zone', () => {
    // 23:30 UTC on the 21st is already the 22nd in Berlin.
    const late = row({ id: 'late', startDate: new Date('2026-10-21T23:30:00Z') })
    expect(dedupeFestivals([row({ id: 'a' }), late]).map(r => r.id)).toEqual(['a'])
  })
})

describe('toFestivalRow', () => {
  it('sends local dates and the event URL', () => {
    const r = toFestivalRow(row({ startDate: new Date('2026-10-21T22:30:00Z'), endDate: new Date('2026-10-25T21:59:00Z') }), none)
    expect(r.startDate).toBe('2026-10-22')
    expect(r.endDate).toBe('2026-10-25')
    expect(r.href).toBe('/events/kubaname-salsa-festival-1ed1a238')
  })

  it('takes logo and colour from the festival details', () => {
    const r = toFestivalRow(row({ festival: { key: 'k', logo: 'https://x/logo.png', accentColor: '#c14a1a' } }), none)
    expect(r).toMatchObject({ planType: 'festival', planId: 'k', logo: 'https://x/logo.png', accentColor: '#c14a1a' })
  })

  it('treats a festival without an end as one day', () => {
    expect(toFestivalRow(row({ endDate: null }), none).endDate).toBe('2026-10-22')
  })
})
