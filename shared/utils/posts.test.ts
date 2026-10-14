import { describe, expect, it } from 'vitest'
import { proposePlan } from './posts'
import { postLines } from './flyer'

describe('proposePlan', () => {
  it('a night out: the flyer a week before, a story on the day', () => {
    expect(proposePlan({ startDay: '2026-10-22', festival: false, artists: ['a'], hasPasses: false, hasProgramme: false }, '2026-10-14'))
      .toEqual([{ kind: 'announcement', dueOn: '2026-10-15', format: 'story' }, { kind: 'countdown', dueOn: '2026-10-22', format: 'story' }])
  })
  it('a festival: launch, one per artist, line-up, passes, programme, countdown, last tickets, thanks', () => {
    const plan = proposePlan({ startDay: '2026-11-26', endDay: '2026-11-29', festival: true, artists: ['a', 'b'], hasPasses: true, hasProgramme: true }, '2026-09-01')
    expect(plan.map(p => p.kind)).toEqual(['announcement', 'artist', 'artist', 'lineup', 'passes', 'programme', 'countdown', 'last-call', 'thanks'])
    expect(plan[0]!.dueOn).toBe('2026-10-01')
    expect(plan.find(p => p.kind === 'thanks')!.dueOn).toBe('2026-11-30')
    // Artist posts fall between the launch and the line-up poster.
    const lineup = plan.find(p => p.kind === 'lineup')!.dueOn
    for (const a of plan.filter(p => p.kind === 'artist')) expect(a.dueOn > plan[0]!.dueOn && a.dueOn < lineup).toBe(true)
  })
  it('never dates a post before today', () => {
    const plan = proposePlan({ startDay: '2026-10-20', festival: true, artists: ['a'], hasPasses: false, hasProgramme: false }, '2026-10-14')
    expect(plan.every(p => p.dueOn >= '2026-10-14')).toBe(true)
  })
})

describe('postLines', () => {
  const ev = { name: '¡Menéate Viena! 2026', startDate: '2026-11-26T17:00:00Z', endDate: '2026-11-29T22:00:00Z', timezone: 'Europe/Vienna', venueName: 'wolke19', venueAddress: 'Donau-City-Straße 11, Vienna', artists: [{ name: 'Barbara Jimenez' }, { name: 'Silvio Leroy' }], styles: ['Timba'] }
  it('an artist post leads with the artist', () => {
    const l = postLines({ ...ev, kind: 'artist', artist: { name: 'Barbara Jimenez', styles: ['Timba', 'Ladies'], sessions: ['Sat 11:00 Timba con Reggaeton'] } })
    expect(l.map(x => x.label)).toEqual(['kicker', 'title', 'subtitle', 'date', 'detail', 'music', 'venue'])
    expect(l[1]!.text).toBe('BARBARA JIMENEZ')
    expect(l[2]!.text).toBe('¡MENÉATE VIENA! 2026')
  })
  it('the announcement is the event’s flyer', () => {
    expect(postLines({ ...ev, kind: 'announcement' })[0]).toEqual({ label: 'title', text: '¡MENÉATE VIENA! 2026' })
  })
  it('passes list each pass', () => {
    const l = postLines({ ...ev, kind: 'passes', passes: ['Full Pass · 210 €', 'Party Pass · 96 €'] })
    expect(l.filter(x => x.label === 'detail').map(x => x.text)).toEqual(['FULL PASS · 210 €', 'PARTY PASS · 96 €'])
  })
})

import { paintPrompt } from './flyer'
describe('paintPrompt with a line-up grid', () => {
  it('asks for every artist as a portrait, in order', () => {
    const p = paintPrompt([{ label: 'title', text: 'X' }], { description: 'Neon.' }, { grid: ['Barbara Jimenez', 'Emilia Pedra & Alexei Ramos', 'Silvio Leroy'] })
    expect(p).toContain('featuring all 3 artists as a line-up of portraits')
    expect(p).toContain('in this order: Barbara Jimenez, Emilia Pedra & Alexei Ramos, Silvio Leroy')
  })
})
