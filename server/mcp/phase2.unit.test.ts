import { describe, it, expect } from 'vitest'
import { visibleTools, TOOL_BY_NAME } from './tools'
import { PROCEDURE_SCOPES, checkProcedureScope } from '../trpc/scopes'
import { isLinkCode, linkUrl, newLinkCode, qrUrls } from '../utils/trackedLinks'
import { eventLanguage, kitHashtags } from '../utils/promoKit'
import { attendeesCsv } from '../trpc/routers/businessEvents'
import { appRouter } from '../trpc'

const names = (scopes: string[], pages: string[] = []) => visibleTools({ scopes, grantedProfileIds: pages, isAdmin: false }).map(t => t.name)

describe('phase 2 tools in the dynamic list', () => {
  it('dancers: apply_to_gig needs social:write, my_gig_applications me:read; no business tools', () => {
    expect(names(['social:write'])).toContain('apply_to_gig')
    expect(names(['me:read'])).toContain('my_gig_applications')
    const dancer = names(['me:read', 'plan:write', 'social:write'])
    for (const t of ['my_link', 'promo_kit', 'attendees', 'recurring_series']) expect(dancer).not.toContain(t)
  })
  it('promoter reads: link, results, dashboard, kit, attendees; not the writes', () => {
    const read = names(['business:read'], ['p1'])
    expect(read).toEqual(expect.arrayContaining(['my_link', 'my_results', 'promoter_dashboard', 'event_link_results', 'promo_kit', 'attendees', 'gig_applications', 'giveaway_proposals']))
    for (const t of ['recurring_series', 'propose_giveaway', 'publish_series', 'decide_gig_application', 'decide_giveaway_proposal']) expect(read).not.toContain(t)
  })
  it('business:write adds recurring_series and propose_giveaway; publish adds the decisions', () => {
    const write = names(['business:write'], ['p1'])
    expect(write).toEqual(expect.arrayContaining(['recurring_series', 'propose_giveaway']))
    expect(write).not.toContain('publish_series')
    expect(names(['business:publish'], ['p1'])).toEqual(expect.arrayContaining(['publish_series', 'decide_gig_application', 'decide_giveaway_proposal']))
  })
  it('two-step where it goes public or reaches someone', () => {
    for (const t of ['publish_series', 'decide_gig_application', 'decide_giveaway_proposal']) expect(TOOL_BY_NAME.get(t)!.confirm, t).toBe(true)
    expect(typeof TOOL_BY_NAME.get('recurring_series')!.confirm).toBe('function')
  })
})

describe('phase 2 procedures in the scope map', () => {
  const caller = (scopes: string[]) => appRouter.createCaller({ db: null, dancerId: 'd1', isAdmin: false, scopes, grantedProfileIds: [] } as any)
  it('every new procedure is mapped; the visit counter is web-only', () => {
    for (const p of ['businessEvents.createSeries', 'businessEvents.seriesPreview', 'businessEvents.series', 'businessEvents.publishSeries', 'businessEvents.attendees',
      'gigs.applyTo', 'gigs.myApplications', 'gigs.applications', 'gigs.decideApplication',
      'referral.myLink', 'referral.myResults', 'referral.promoterDashboard', 'referral.eventLinkResults', 'referral.promoKit',
      'giveaway.propose', 'giveaway.proposals', 'giveaway.decideProposal']) expect(p in PROCEDURE_SCOPES, p).toBe(true)
    expect('referral.trackVisit' in PROCEDURE_SCOPES).toBe(false)
    expect(() => checkProcedureScope({ scopes: ['business:publish'] }, 'referral.trackVisit')).toThrow(/isn’t available/)
  })
  it('decisions need business:publish inside tRPC', async () => {
    await expect(caller(['business:write']).gigs.decideApplication({ applicationId: '00000000-0000-4000-8000-000000000000', decision: 'accepted' })).rejects.toThrow(/insufficient_scope.*business:publish/)
    await expect(caller(['business:write']).giveaway.decideProposal({ proposalId: '00000000-0000-4000-8000-000000000000', approve: true })).rejects.toThrow(/insufficient_scope.*business:publish/)
    await expect(caller(['business:write']).businessEvents.publishSeries({ seriesId: 'host-x' })).rejects.toThrow(/insufficient_scope.*business:publish/)
    await expect(caller(['business:read']).giveaway.propose({ eventId: '00000000-0000-4000-8000-000000000000', profile: 'x', prize: 'two passes' })).rejects.toThrow(/insufficient_scope.*business:write/)
    await expect(caller(['me:read']).gigs.applyTo({ gigId: '00000000-0000-4000-8000-000000000000', message: 'hello there, I teach' })).rejects.toThrow(/insufficient_scope.*social:write/)
  })
})

describe('tracked link helpers', () => {
  it('codes: 8 characters, no look-alikes, validated strictly', () => {
    const c = newLinkCode()
    expect(isLinkCode(c)).toBe(true)
    expect(c).not.toMatch(/[01ilo]/)
    expect(new Set(Array.from({ length: 200 }, newLinkCode)).size).toBe(200)
    for (const bad of ['', 'abc', 'ABCDEFGH', 'abcdefg1', 'abcdefgh9', "abcd'efg", null, 42]) expect(isLinkCode(bad)).toBe(false)
  })
  it('link and QR URLs live on our origin', () => {
    const ev = { id: '1ed1a238-0000-4000-8000-000000000000', name: 'La Clave Thursday' }
    expect(linkUrl('https://2026.wedance.vip', ev, 'abcdefgh')).toBe('https://2026.wedance.vip/events/la-clave-thursday-1ed1a238?via=abcdefgh')
    expect(qrUrls('https://2026.wedance.vip', 'abcdefgh')).toEqual({ svg: 'https://2026.wedance.vip/api/qr/abcdefgh.svg', png: 'https://2026.wedance.vip/api/qr/abcdefgh.png' })
  })
})

describe('promo kit helpers', () => {
  it('caption language: the host page’s languages, else the country', () => {
    expect(eventLanguage(['es', 'en'], 'Germany')).toBe('en+es')
    expect(eventLanguage([], 'Germany')).toBe('en+de')
    expect(eventLanguage(null, 'Spain')).toBe('en+es')
    expect(eventLanguage(['ru'], null)).toBe('ru')
    expect(eventLanguage([], 'France')).toBe('en')
  })
  it('hashtags: from the caption, styles and city; deduped; #wedance', () => {
    const tags = kitHashtags('Salsa night! #SalsaMunich #salsamunich #Timba', ['Salsa', 'Son Cubano'], 'München')
    expect(tags).toEqual(['#SalsaMunich', '#Timba', '#salsa', '#soncubano', '#munchen', '#wedance'])
    expect(kitHashtags(null, [], null)).toEqual(['#wedance'])
  })
})

describe('attendees CSV', () => {
  it('quotes every cell and defuses spreadsheet formulas', () => {
    const csv = attendeesCsv([{ name: 'Ana "La" García', handle: 'ana', city: 'Munich', status: 'ticket' }, { name: '=HYPERLINK("x")', handle: null, city: null, status: 'going' }])
    expect(csv.split('\n')).toEqual([
      'name,handle,city,status',
      '"Ana ""La"" García","ana","Munich","ticket"',
      '"\'=HYPERLINK(""x"")","","","going"',
    ])
  })
})
