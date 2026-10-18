import { z } from 'zod'
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js'
import { appRouter } from '../trpc'
import type { Context } from '../trpc/context'
import { hasScope, type Scope } from '../oauth/config'
import { eventPath } from '../../shared/utils/eventSlug'
import { eventLocalDate, eventLocalTime, eventLocalWeekday } from '../../shared/utils/eventTime'
import { LANGUAGES } from '../../shared/utils/caption'

/**
 * The WeDance MCP tools. A thin adapter: every tool calls the tRPC router
 * (appRouter.createCaller) with the token's context, so validation,
 * permissions, profile grants and scope checks live in one place, the same
 * code the web app runs. Tools only reshape arguments for an LLM caller and
 * trim results.
 *
 * `scopes` decide whether a tool is listed (all must be held); `business`
 * tools also need at least one business profile in the grant. `confirm`
 * tools are business:publish: preview first, commit with confirm_token.
 */

export type Caller = ReturnType<typeof appRouter.createCaller>
export interface ToolCtx { caller: Caller; ctx: Context; origin: string }

export interface ToolDef {
  name: string
  title: string
  description: string
  scopes: Scope[]
  /** Needs a business profile in the grant (or the admin app). */
  business?: boolean
  annotations: ToolAnnotations
  input: z.ZodRawShape
  run: (t: ToolCtx, args: any) => Promise<unknown>
  /** Two-step tool: always (true) or only when this says the call goes public. */
  confirm?: true | ((t: ToolCtx, args: any) => Promise<boolean>)
  /** What the user is asked to approve. Required for confirm tools. */
  preview?: (t: ToolCtx, args: any) => Promise<unknown>
}

// --- annotation presets -----------------------------------------------------
const READ: ToolAnnotations = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const WRITE: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
const IDEMPOTENT: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
const DESTRUCTIVE: ToolAnnotations = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
/** Goes public or reaches another person (email, a post others see). */
const OUTWARD: ToolAnnotations = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }

// --- shared argument shapes ---------------------------------------------------
const citySlug = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const city = z.string().min(1).max(120).describe('City in English or its WeDance slug, e.g. "Munich", "berlin", "new-york".')
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Date as YYYY-MM-DD.')
const hhmm = z.string().regex(/^\d{2}:\d{2}$/).describe('Local wall-clock time as HH:MM (24 h), in the event’s city.')
const eventId = z.string().uuid().describe('Event id (a UUID, from find_events, my_events or get_event).')
const handle = z.string().min(1).max(200).transform(h => h.replace(/^@/, '')).describe('WeDance handle, with or without @ (the part after wedance.vip/@).')
const profile = z.string().min(1).max(200).transform(h => h.replace(/^@/, '')).describe('Handle of one of your business profiles (see my_profiles).')
const festival = z.string().min(1).max(120).describe('Festival key/slug (planId of a festival from find_festivals, e.g. "meneate-viena-2026").')
const confirmToken = z.string().max(4096).optional().describe('Leave out on the first call: you get a preview and a confirm_token. Show the preview to the user; only after they agree, call again with the same arguments plus this token.')
const language = z.enum(LANGUAGES.map(l => l.value) as [string, ...string[]]).default('en+de').describe('Caption language(s).')

// --- result shaping -----------------------------------------------------------
function when(e: { startDate?: any; endDate?: any; timezone?: string | null }) {
  if (!e.startDate) return null
  const tz = e.timezone || 'Europe/Berlin'
  return {
    local: `${eventLocalWeekday(e.startDate, tz)} ${eventLocalDate(e.startDate, tz)} ${eventLocalTime(e.startDate, tz)}${e.endDate ? `–${eventLocalTime(e.endDate, tz)}` : ''}`,
    timezone: tz,
  }
}
const url = (t: ToolCtx, path: string) => `${t.origin}${path}`
function card(t: ToolCtx, e: any) {
  return {
    id: e.id, name: e.name, type: e.type, styles: e.styles ?? [], when: when(e), start: e.startDate, end: e.endDate,
    city: e.city, venue: e.venueName ?? null, venueHandle: e.venueUsername ?? null, organizer: e.organizerName ?? null,
    organizerHandle: e.organizerUsername ?? null, price: e.price || null, isFestival: !!e.isFestival, url: url(t, eventPath(e)),
  }
}
const localDay = (e: any) => eventLocalDate(e.startDate, e.timezone || 'Europe/Berlin')

async function profileId(t: ToolCtx, h: string): Promise<string> {
  const p: any = await t.caller.entity.getByHandle({ handle: h })
  const id = p?.profile?.id ?? p?.id
  if (!id) throw new Error(`No WeDance profile @${h}.`)
  return id
}

const PATCH_FIELDS = {
  name: z.string().trim().min(1).max(160).optional(),
  type: z.enum(['Party', 'Workshop', 'Course', 'Festival', 'Weekender', 'Congress', 'Concert', 'Show']).optional().describe('Kind of event.'),
  date: ymd.optional(),
  start_time: hhmm.optional(),
  end_time: hhmm.nullable().optional(),
  end_date: ymd.nullable().optional().describe('Last day for multi-day events (festivals).'),
  city: z.string().max(120).nullable().optional().describe('City name in English, e.g. "Munich".'),
  venue_handle: z.string().max(200).nullable().optional().describe('Handle of a venue on WeDance (find one with find_lineup type=venue or suggest_venues).'),
  venue_name: z.string().max(200).nullable().optional().describe('Venue name when it isn’t on WeDance.'),
  venue_address: z.string().max(300).nullable().optional(),
  artists: z.array(z.string().min(1).max(200)).max(40).optional().describe('Line-up as WeDance handles (find_lineup, add_profile_from_instagram).'),
  styles: z.array(z.string().min(1).max(40)).max(20).optional().describe('Dance styles, e.g. ["Salsa", "Bachata"].'),
  description: z.string().max(8000).optional(),
  cover: z.string().url().nullable().optional().describe('Cover image URL.'),
  ticket_url: z.string().url().nullable().optional(),
  price: z.string().max(400).optional().describe('One price per line, e.g. "Workshops free\\nParty 10€".'),
  agenda: z.array(z.object({ time: z.string().max(20), what: z.string().max(160) })).max(20).optional().describe('Programme lines, e.g. [{time:"19:00", what:"Beginner class"}].'),
}
type Patch = { [K in keyof typeof PATCH_FIELDS]?: any }
function patchToInput(p: Patch) {
  const map: Record<string, string> = { start_time: 'startTime', end_time: 'endTime', end_date: 'endDate', venue_handle: 'venueUsername', venue_name: 'venueName', venue_address: 'venueAddress', ticket_url: 'ticketUrl' }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(p)) if (v !== undefined && k in PATCH_FIELDS) out[map[k] ?? k] = v
  return out
}
/** The editor's full input for an event, with a patch on top (update replaces every field). */
async function mergedEvent(t: ToolCtx, id: string, patch: Patch, extra: Record<string, unknown> = {}) {
  const cur: any = await t.caller.businessEvents.get({ id })
  const { id: _id, host: _h, synced: _s, recurring: _r, archived: _a, editedAt: _e, timezone: _tz, missing: _m, ...form } = cur
  return { cur, input: { ...form, ...patchToInput(patch), ...extra, id } as any }
}

// A recurring series: the template's fields (no festival end date) and the rule.
const { end_date: _ed, ...SERIES_BASE } = PATCH_FIELDS
const SERIES_FIELDS = {
  ...SERIES_BASE,
  name: z.string().trim().min(1).max(160),
  type: PATCH_FIELDS.type.unwrap(),
  date: ymd.describe('The first date (YYYY-MM-DD); its weekday is the series’ weekday.'),
  start_time: hhmm,
}
function seriesInput(a: any) {
  const { profile: host, every, until, count, skip, month_week, published, confirm_token: _c, ...fields } = a
  return { ...patchToInput(fields), hostUsername: host, every, until: until ?? null, count: count ?? null, skip: skip ?? [], monthWeek: month_week ?? null, published: !!published } as any
}

// --- the tools ------------------------------------------------------------------
export const TOOLS: ToolDef[] = [
  // ── Everyone ───────────────────────────────────────────────────────────────
  {
    name: 'find_events', title: 'Find dance events in a city', scopes: [], annotations: READ,
    description: 'Upcoming and ongoing dance events (parties, classes, workshops, festivals) in a city, soonest first. Filter by date range, styles or type. Times come with the local wall-clock time.',
    input: {
      city,
      from: ymd.optional().describe('First day (YYYY-MM-DD), default today.'),
      to: ymd.optional().describe('Last day (YYYY-MM-DD), default 30 days ahead.'),
      styles: z.array(z.string().max(40)).max(10).optional().describe('Only events with any of these styles, e.g. ["Salsa"]. Case-insensitive.'),
      type: z.string().max(40).optional().describe('Only this type, e.g. "Party", "Workshop", "Course", "Festival".'),
      limit: z.number().int().min(1).max(100).default(40),
    },
    run: async (t, a) => {
      const to = a.to ? new Date(`${a.to}T23:59:59Z`) : new Date(Date.now() + 30 * 86400_000)
      const days = Math.min(366, Math.max(1, Math.ceil((to.getTime() - Date.now()) / 86400_000) + 1))
      const rows: any[] = await t.caller.events.byCity({ citySlug: citySlug(a.city), days })
      const styles = (a.styles ?? []).map((s: string) => s.toLowerCase())
      const list = rows.filter(e => (!a.from || localDay(e) >= a.from) && (!a.to || localDay(e) <= a.to)
        && (!styles.length || (e.styles ?? []).some((s: string) => styles.includes(s.toLowerCase())))
        && (!a.type || (e.type ?? '').toLowerCase() === a.type.toLowerCase()))
      return { city: a.city, total: list.length, events: list.slice(0, a.limit).map(e => card(t, e)) }
    },
  },
  {
    name: 'get_event', title: 'Event details', scopes: [], annotations: READ,
    description: 'Everything about one event: description, line-up, venue, prices, ticket link, programme. Accepts the id or the slug from its URL.',
    input: { event: z.string().min(1).max(200).describe('Event id, or the last part of its /events/… URL.') },
    run: async (t, a) => {
      const e: any = await t.caller.events.get({ id: a.event })
      return { ...card(t, e), description: e.description, artists: e.artists ?? [], ticketUrl: e.ticketUrl, link: e.link, country: e.country, address: e.venueAddress, agenda: e.agenda ?? [], checkedBy: e.checkedBy, festival: e.festival ? { key: e.festival.key, passes: e.festival.passes, practicalInfo: e.festival.practicalInfo } : null }
    },
  },
  {
    name: 'find_festivals', title: 'Find dance festivals', scopes: [], annotations: READ,
    description: 'Upcoming dance festivals, congresses and weekenders worldwide, soonest first, with how many dancers plan to go. Use planType + planId with add_to_plan.',
    input: {
      country: z.string().max(80).optional().describe('Only this country (English name, e.g. "Germany").'),
      style: z.string().max(40).optional().describe('Only festivals with this style.'),
      from: ymd.optional(), to: ymd.optional(),
      limit: z.number().int().min(1).max(100).default(30),
    },
    run: async (t, a) => {
      const rows: any[] = await t.caller.events.festivals()
      const list = rows.filter(f => (!a.country || (f.country ?? '').toLowerCase() === a.country.toLowerCase())
        && (!a.style || (f.styles ?? []).some((s: string) => s.toLowerCase() === a.style.toLowerCase()))
        && (!a.from || (f.endDate ?? f.startDate ?? '') >= a.from) && (!a.to || (f.startDate ?? '') <= a.to))
      return { total: list.length, festivals: list.slice(0, a.limit).map(f => ({ name: f.name, startDate: f.startDate, endDate: f.endDate, city: f.city, country: f.country, styles: f.styles, ticketUrl: f.ticketUrl, going: f.signupCount, planType: f.planType, planId: f.planId, url: url(t, f.href) })) }
    },
  },
  {
    name: 'get_festival', title: 'Festival programme', scopes: [], annotations: READ,
    description: 'A festival’s full page: passes, programme by day (workshops and parties), teachers. Takes the festival’s event id.',
    input: { event_id: eventId },
    run: (t, a) => t.caller.events.festival({ id: a.event_id }),
  },
  {
    name: 'get_profile', title: 'WeDance profile', scopes: [], annotations: READ,
    description: 'A public WeDance page by handle: an artist, venue, organizer or promoter (bio, styles, city, socials, rooms), or a dancer.',
    input: { handle },
    run: async (t, a) => {
      const p: any = await t.caller.entity.getByHandle({ handle: a.handle }).catch(() => null)
      if (p) return { kind: 'profile', ...p, url: url(t, `/@${a.handle}`) }
      const d: any = await t.caller.profile.getByUsername({ username: a.handle }).catch(() => null)
      if (d) return { kind: 'dancer', ...d, url: url(t, `/@${a.handle}`) }
      throw new Error(`Nobody on WeDance has the handle @${a.handle}.`)
    },
  },
  {
    name: 'list_venues', title: 'Venues in a city', scopes: [], annotations: READ,
    description: 'Dance venues listed in a city, with their handles.',
    input: { city },
    run: async (t, a) => {
      const d: any = await t.caller.entity.cityDirectory({ citySlug: citySlug(a.city) })
      return { city: d.city, venues: d.venues }
    },
  },
  {
    name: 'list_artists', title: 'Artists in a city', scopes: [], annotations: READ,
    description: 'Dance teachers, performers and DJs listed in a city, with their styles and handles.',
    input: { city },
    run: async (t, a) => {
      const d: any = await t.caller.entity.cityDirectory({ citySlug: citySlug(a.city) })
      return { city: d.city, artists: d.artists, organizers: d.organizers }
    },
  },
  {
    name: 'whos_going', title: 'Who’s going', scopes: [], annotations: READ,
    description: 'Dancers who said they’re going to an event (if they made it public), or verified ticket holders of a festival.',
    input: { event_id: eventId.optional(), festival: festival.optional() },
    run: (t, a) => {
      if (!a.event_id && !a.festival) throw new Error('Give event_id or festival.')
      return t.caller.plan.goingList(a.festival ? { itemType: 'festival', itemId: a.festival } : { itemType: 'event', itemId: a.event_id })
    },
  },
  {
    name: 'ask_locals_feed', title: 'Ask-the-locals board', scopes: [], annotations: READ,
    description: 'Questions dancers asked about a city’s scene, with the locals’ recommendations.',
    input: { city },
    run: (t, a) => t.caller.askLocals.listByCity({ citySlug: citySlug(a.city) }),
  },
  {
    name: 'festival_roster', title: 'Festival roster', scopes: [], annotations: READ,
    description: 'Public roster of a festival’s verified ticket holders (only those who chose to be listed).',
    input: { festival },
    run: (t, a) => t.caller.festivalSignup.publicRoster({ festivalSlug: a.festival }),
  },
  {
    name: 'city_battle_status', title: 'City battle leaderboard', scopes: [], annotations: READ,
    description: 'The city-vs-city dance video battle: current leaderboard.',
    input: { limit: z.number().int().min(1).max(50).default(10) },
    run: (t, a) => t.caller.cityVideo.cityLeaderboard({ limit: a.limit }),
  },
  {
    name: 'find_gigs', title: 'Find gigs', scopes: [], annotations: READ,
    description: 'Open gigs on WeDance: roles organizers want filled (teacher, DJ, photographer…) and offers from artists.',
    input: { kind: z.enum(['role', 'offer']).optional().describe('"role" = someone is hiring, "offer" = someone offers a service.'), category: z.string().max(60).optional() },
    run: (t, a) => t.caller.gigs.list({ kind: a.kind, category: a.category }),
  },

  // ── Dancers ─────────────────────────────────────────────────────────────────
  {
    name: 'me', title: 'My WeDance account', scopes: ['me:read'], annotations: READ,
    description: 'The signed-in dancer: name, handle, city, styles and levels, role.',
    input: {},
    run: async (t) => {
      const me: any = await t.caller.auth.me()
      if (!me) throw new Error('Not signed in.')
      const { email: _e, ...rest } = me
      return { ...rest, profileUrl: me.username ? url(t, `/@${me.username}`) : null }
    },
  },
  {
    name: 'my_plan', title: 'My plan', scopes: ['me:read'], annotations: READ,
    description: 'The dancer’s plan: dated events they’re going to (soonest first) and festivals in their year plan, with ticket status.',
    input: {},
    run: async (t) => {
      const items: any[] = await t.caller.plan.list()
      const ids = items.filter(i => i.itemType === 'event').map(i => i.itemId).slice(0, 60)
      const events = (await Promise.all(ids.map(id => t.caller.events.get({ id }).catch(() => null)))).filter(Boolean) as any[]
      const now = Date.now()
      return {
        events: events.filter(e => new Date(e.endDate ?? e.startDate).getTime() >= now).sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate)).map(e => card(t, e)),
        festivals: await t.caller.plan.myPlan(),
        goals: items.filter(i => i.itemType === 'goal').length,
      }
    },
  },
  {
    name: 'my_tickets', title: 'My tickets', scopes: ['me:read'], annotations: READ,
    description: 'Festival tickets and passes the dancer holds.',
    input: {},
    run: t => t.caller.festivalSignup.myTickets(),
  },
  {
    name: 'my_follows', title: 'Who I follow', scopes: ['me:read'], annotations: READ,
    description: 'Artists, venues, organizers and dancers the dancer follows.',
    input: {},
    run: t => t.caller.follow.myFollows(),
  },
  {
    name: 'my_referrals', title: 'My referrals', scopes: ['me:read'], annotations: READ,
    description: 'People who bought festival tickets with the dancer’s (or promoter’s) referral code, and the credit earned.',
    input: { festival: festival.optional() },
    run: (t, a) => t.caller.referral.myReferrals(a.festival ? { festivalSlug: a.festival } : undefined),
  },
  {
    name: 'view_shared_plan', title: 'A dancer’s shared plan', scopes: ['me:read'], annotations: READ,
    description: 'The plan another dancer shared publicly (by their handle).',
    input: { handle },
    run: (t, a) => t.caller.plan.sharedPlan({ username: a.handle }),
  },
  {
    name: 'add_to_plan', title: 'Add to my plan', scopes: ['plan:write'], annotations: IDEMPOTENT,
    description: 'Mark that the dancer is going: an event (by id) or a festival (planId from find_festivals). Private unless share_my_plan makes it visible.',
    input: { kind: z.enum(['event', 'festival']).describe('"event" for a dated event id, "festival" for a festival planId.'), id: z.string().min(1).max(200) },
    run: async (t, a) => {
      let id = a.id
      if (a.kind === 'event') id = ((await t.caller.events.get({ id: a.id })) as any).id
      await t.caller.plan.add({ itemType: a.kind, itemId: id })
      return { added: true, kind: a.kind, id }
    },
  },
  {
    name: 'remove_from_plan', title: 'Remove from my plan', scopes: ['plan:write'], annotations: DESTRUCTIVE,
    description: 'Take an event or festival out of the dancer’s plan (tickets stay).',
    input: { kind: z.enum(['event', 'festival']), id: z.string().min(1).max(200) },
    run: async (t, a) => {
      await t.caller.plan.remove({ itemType: a.kind, itemId: a.id })
      return { removed: true }
    },
  },
  {
    name: 'share_my_plan', title: 'Show or hide that I’m going', scopes: ['plan:write'], annotations: IDEMPOTENT,
    description: 'Make the dancer visible (or hidden) in an event’s or festival’s “who’s going” list.',
    input: { kind: z.enum(['event', 'festival']), id: z.string().min(1).max(120), share: z.boolean() },
    run: (t, a) => t.caller.plan.setShareGoing({ itemType: a.kind, itemId: a.id, share: a.share }),
  },
  {
    name: 'festival_join', title: 'Join a festival', scopes: ['plan:write'], annotations: IDEMPOTENT,
    description: 'Sign the dancer up for a festival on WeDance (free signup, separate from buying a ticket).',
    input: { festival },
    run: (t, a) => t.caller.festivalSignup.join({ festivalSlug: a.festival }),
  },
  {
    name: 'buy_ticket', title: 'Get a ticket checkout link', scopes: ['plan:write'], annotations: OUTWARD,
    description: 'Start a festival ticket purchase. Returns a Stripe checkout link the user opens and pays themselves. Nothing is charged by this tool.',
    input: { festival, tickets: z.array(z.string().min(1).max(200)).min(1).max(10).describe('Ticket/pass names exactly as the festival lists them.'), referral_code: z.string().min(1).max(100).optional() },
    run: async (t, a) => {
      const r: any = await t.caller.festivalSignup.ticketCheckout({ festivalSlug: a.festival, ticketNames: a.tickets, referralCode: a.referral_code })
      return { checkoutUrl: r.checkoutUrl ?? r.url ?? null, note: 'Give this link to the user to pay on Stripe. The purchase only happens when they complete it.' }
    },
  },
  {
    name: 'list_rides', title: 'Rides to a festival', scopes: ['plan:write'], annotations: READ,
    description: 'Ride shares offered or wanted for a festival.',
    input: { festival },
    run: (t, a) => t.caller.rideShare.list({ festivalSlug: a.festival }),
  },
  {
    name: 'offer_ride', title: 'Offer or look for a ride', scopes: ['plan:write'], annotations: OUTWARD,
    description: 'Post a ride share for a festival, visible to other attendees: offering seats or looking for one.',
    input: {
      festival, type: z.enum(['offering', 'looking']), origin_city: z.string().min(1).max(120), date: ymd,
      seats: z.number().int().min(1).max(8).optional(), contact_link: z.string().max(300).optional().describe('How people reach the dancer, e.g. a Telegram or WhatsApp link.'),
    },
    run: (t, a) => t.caller.rideShare.create({ festivalSlug: a.festival, type: a.type, originCity: a.origin_city, date: a.date, seatsAvailable: a.seats, contactLink: a.contact_link }),
  },
  {
    name: 'list_roommates', title: 'Roommate search', scopes: ['plan:write'], annotations: READ,
    description: 'Dancers looking for a roommate at a festival, and whether the dancer is looking.',
    input: { festival },
    run: (t, a) => t.caller.roommate.list({ festivalSlug: a.festival }),
  },
  {
    name: 'toggle_roommate_search', title: 'Look (or stop looking) for a roommate', scopes: ['plan:write'], annotations: OUTWARD,
    description: 'Toggle whether the dancer is listed as looking for a roommate at a festival. Check list_roommates first: this flips the current state.',
    input: { festival },
    run: (t, a) => t.caller.roommate.toggle({ festivalSlug: a.festival }),
  },
  {
    name: 'hangouts_tonight', title: 'Hangouts tonight', scopes: ['social:write'], annotations: READ,
    description: 'Hangouts dancers set up in a city tonight (pre-party dinners, coffee, going together).',
    input: { city },
    run: (t, a) => t.caller.hangouts.listTonight({ citySlug: citySlug(a.city) }),
  },
  {
    name: 'rsvp_hangout', title: 'Join or leave a hangout', scopes: ['social:write'], annotations: OUTWARD,
    description: 'Toggle the dancer’s RSVP to a hangout (others see who’s coming).',
    input: { hangout_id: z.string().uuid() },
    run: (t, a) => t.caller.hangouts.toggleRsvp({ hangoutId: a.hangout_id }),
  },
  {
    name: 'list_dinners', title: 'Festival dinners', scopes: ['social:write'], annotations: READ,
    description: 'Group dinners at a festival the dancer can join.',
    input: { festival },
    run: (t, a) => t.caller.dinner.list({ festivalSlug: a.festival }),
  },
  {
    name: 'join_dinner', title: 'Join a dinner', scopes: ['social:write'], annotations: OUTWARD,
    description: 'Join a group dinner at a festival.',
    input: { dinner_id: z.string().uuid() },
    run: (t, a) => t.caller.dinner.join({ dinnerId: a.dinner_id }),
  },
  {
    name: 'ask_locals', title: 'Ask the locals', scopes: ['social:write'], annotations: OUTWARD,
    description: 'Post a public question to a city’s dancers, e.g. “Where’s the best Thursday salsa?”.',
    input: { city, question: z.string().min(3).max(280) },
    run: (t, a) => t.caller.askLocals.ask({ citySlug: citySlug(a.city), question: a.question }),
  },
  {
    name: 'recommend', title: 'Recommend a place or organizer', scopes: ['social:write'], annotations: OUTWARD,
    description: 'Publicly recommend a venue or organizer in a city.',
    input: { city, target_type: z.enum(['organizer', 'venue']), target_name: z.string().min(2).max(160), text: z.string().max(1000).optional() },
    run: (t, a) => t.caller.askLocals.recommend({ citySlug: citySlug(a.city), targetType: a.target_type, targetName: a.target_name, text: a.text }),
  },
  {
    name: 'follow', title: 'Follow or unfollow a page', scopes: ['social:write'], annotations: IDEMPOTENT,
    description: 'Follow (or unfollow) an artist, venue, organizer or promoter to see their events.',
    input: { handle, follow: z.boolean().default(true).describe('false to unfollow.') },
    run: async (t, a) => {
      const id = await profileId(t, a.handle)
      const now = await t.caller.follow.isFollowing({ profileId: id })
      if (now !== a.follow) await t.caller.follow.toggle({ profileId: id })
      return { handle: a.handle, following: a.follow }
    },
  },
  {
    name: 'write_review', title: 'Review a venue, festival, artist or event', scopes: ['social:write'], annotations: OUTWARD,
    description: 'Publish a 1–5 star review with optional text.',
    input: {
      target_type: z.enum(['festival', 'venue', 'artist', 'organizer', 'event']), target: z.string().min(1).max(200).describe('Handle (venue/artist/organizer), festival key or event id.'),
      rating: z.number().int().min(1).max(5), text: z.string().max(1000).optional(), city: city.optional(),
    },
    run: (t, a) => t.caller.review.create({ targetType: a.target_type, targetSlug: a.target.replace(/^@/, ''), rating: a.rating, text: a.text, citySlug: a.city ? citySlug(a.city) : undefined }),
  },
  {
    name: 'request_private_class', title: 'Send a booking request', scopes: ['social:write', 'me:read'], annotations: OUTWARD,
    description: 'Ask an artist or venue for a private class, workshop, show or event. Their team gets an email with the dancer’s name and email to reply to.',
    input: {
      handle, what: z.string().min(1).max(60).default('Workshop or class').describe('e.g. "Workshop or class", "Show", "DJ set", "Private event".'),
      message: z.string().min(10).max(2000), date: ymd.optional(), city: z.string().max(120).optional(), guests: z.number().int().min(1).max(100000).optional(), budget: z.string().max(80).optional(),
    },
    run: async (t, a) => {
      const me: any = await t.caller.auth.me()
      const { email } = await t.caller.auth.myEmail()
      return t.caller.inquiries.send({ handle: a.handle, name: me.name, email, what: a.what, message: a.message, eventDate: a.date ?? '', city: a.city ?? '', guests: a.guests ?? null, budget: a.budget ?? '', phone: '', organization: '', website: '' })
    },
  },
  {
    name: 'list_giveaways', title: 'Giveaways', scopes: ['social:write'], annotations: READ,
    description: 'Active giveaways in a city (tickets, passes) the dancer can enter.',
    input: { city },
    run: (t, a) => t.caller.giveaway.listActive({ citySlug: citySlug(a.city) }),
  },
  {
    name: 'enter_giveaway', title: 'Enter a giveaway', scopes: ['social:write', 'me:read'], annotations: OUTWARD,
    description: 'Enter the dancer into a giveaway with their account email.',
    input: { giveaway_id: z.string().uuid() },
    run: async (t, a) => {
      const { email } = await t.caller.auth.myEmail()
      return t.caller.giveaway.enter({ giveawayId: a.giveaway_id, email })
    },
  },
  {
    name: 'city_video_pair', title: 'Two city videos to vote on', scopes: ['social:write'], annotations: READ,
    description: 'The next pair of a city’s dance videos for the monthly vote.',
    input: { city },
    run: (t, a) => t.caller.cityVideo.getPair({ citySlug: citySlug(a.city) }),
  },
  {
    name: 'vote_city_video', title: 'Vote on a city video', scopes: ['social:write'], annotations: OUTWARD,
    description: 'Vote for the better of two videos from city_video_pair.',
    input: { city, winner_video_id: z.string().uuid(), loser_video_id: z.string().uuid() },
    run: (t, a) => t.caller.cityVideo.vote({ citySlug: citySlug(a.city), winnerVideoId: a.winner_video_id, loserVideoId: a.loser_video_id }),
  },
  {
    name: 'update_my_profile', title: 'Edit my dancer profile', scopes: ['social:write'], annotations: IDEMPOTENT,
    description: 'Change the dancer’s own public profile (not a business page): name, city, styles, role, bio, socials, visibility.',
    input: {
      name: z.string().min(1).max(120).optional(), city: z.string().max(120).optional(), styles: z.array(z.string()).max(20).optional(),
      role: z.enum(['lead', 'follow', 'both']).optional(), bio: z.string().max(500).optional(), instagram: z.string().max(300).optional(),
      website: z.string().max(300).optional(), profile_public: z.boolean().optional(),
    },
    run: async (t, a) => {
      await t.caller.profile.update({ name: a.name, city: a.city, danceStyles: a.styles, role: a.role, bio: a.bio, instagram: a.instagram, website: a.website, profilePublic: a.profile_public })
      return { saved: true }
    },
  },

  {
    name: 'apply_to_gig', title: 'Apply to a gig', scopes: ['social:write'], annotations: OUTWARD,
    description: 'Apply to a gig role (find_gigs, kind "role"): a short message about yourself, optionally as one of your artist pages. The poster gets an email with the message and your account email to reply to.',
    input: {
      gig_id: z.string().uuid().describe('Gig id from find_gigs.'),
      message: z.string().min(10).max(2000).describe('Why you: experience, styles, links.'),
      profile: z.string().min(1).max(200).transform(h => h.replace(/^@/, '')).optional().describe('Apply as this artist page of yours (needs it ticked for this app).'),
    },
    run: (t, a) => t.caller.gigs.applyTo({ gigId: a.gig_id, message: a.message, profile: a.profile }),
  },
  {
    name: 'my_gig_applications', title: 'My gig applications', scopes: ['me:read'], annotations: READ,
    description: 'Gigs the dancer applied to and whether each is pending, accepted or declined.',
    input: {},
    run: t => t.caller.gigs.myApplications(),
  },

  // ── Organizers, artists, promoters (business) ────────────────────────────────
  {
    name: 'my_profiles', title: 'My business pages', scopes: ['business:read'], business: true, annotations: READ,
    description: 'The business pages (organizer, venue, artist, promoter) this app may act for, with the dancer’s role on each.',
    input: {},
    run: async (t) => ((await t.caller.business.myProfiles()) as any).managed,
  },
  {
    name: 'my_events', title: 'My events', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Events of my pages: upcoming, drafts, past and archived, each with what it still lacks.',
    input: { profile: profile.optional() },
    run: async (t, a) => {
      const r: any = await t.caller.businessEvents.list(a.profile ? { profile: a.profile } : undefined)
      const slim = (e: any) => ({ ...card(t, e), published: e.published, role: e.role, canEdit: e.canEdit, host: e.host?.username ?? null, missing: e.missing, seriesId: e.seriesId ?? null })
      return { upcoming: r.upcoming.map(slim), drafts: r.drafts.map(slim), past: r.past.slice(0, 10).map(slim), archivedCount: r.archived.length }
    },
  },
  {
    name: 'get_my_event', title: 'Event as its editor sees it', scopes: ['business:read'], business: true, annotations: READ,
    description: 'An event of my pages in editable form (local date and times, line-up handles, prices, agenda, published state, missing details).',
    input: { event_id: eventId },
    run: (t, a) => t.caller.businessEvents.get({ id: a.event_id }),
  },
  {
    name: 'inbox', title: 'Business inbox', scopes: ['business:read'], business: true, annotations: READ,
    description: 'What needs me across my pages (drafts, missing details, flyers, booking requests, invites, join requests) and the next 14 days.',
    input: {},
    run: t => t.caller.businessEvents.inbox(),
  },
  {
    name: 'create_event', title: 'Create a draft event', scopes: ['business:write'], business: true, annotations: WRITE,
    description: 'Create an event for one of my pages as a DRAFT (not public). Times are local to the city. Publish it later with publish_event.',
    input: { profile: profile.describe('Handle of the page that runs the event (see my_profiles).'), ...PATCH_FIELDS, name: z.string().trim().min(1).max(160), type: PATCH_FIELDS.type.unwrap(), date: ymd, start_time: hhmm },
    run: async (t, a) => {
      const { profile: host, ...fields } = a
      const r: any = await t.caller.businessEvents.create({ ...patchToInput(fields), hostUsername: host, published: false } as any)
      return { id: r.id, published: false, editor: url(t, `/business/events/${r.id}`), next: 'It is a draft. Check it with get_my_event, then publish_event when the user wants it public.' }
    },
  },
  {
    name: 'update_event', title: 'Edit an event', scopes: ['business:write'], business: true, annotations: WRITE,
    description: 'Change fields of an event of my pages; fields left out stay as they are. Editing a live (published) event changes a public page, so it needs business:publish and runs as preview → confirm.',
    input: { event_id: eventId, ...PATCH_FIELDS, confirm_token: confirmToken },
    confirm: async (t, a) => !!((await t.caller.businessEvents.get({ id: a.event_id })) as any).published,
    preview: async (t, a) => {
      const { cur, input } = await mergedEvent(t, a.event_id, a)
      const changed = Object.fromEntries(Object.entries(patchToInput(a)).filter(([k, v]) => JSON.stringify(cur[k]) !== JSON.stringify(v)).map(([k, v]) => [k, { from: cur[k], to: v }]))
      return { event: cur.name, live: true, changes: changed, result: { name: input.name, date: input.date, startTime: input.startTime } }
    },
    run: async (t, a) => {
      const { input } = await mergedEvent(t, a.event_id, a)
      await t.caller.businessEvents.update(input)
      return { saved: true, id: a.event_id }
    },
  },
  {
    name: 'publish_event', title: 'Publish or unpublish an event', scopes: ['business:publish'], business: true, annotations: OUTWARD, confirm: true,
    description: 'Make a draft event public on WeDance (or take it back to draft). Runs as preview → confirm: show the preview, then call again with confirm_token.',
    input: { event_id: eventId, published: z.boolean().default(true), confirm_token: confirmToken },
    preview: async (t, a) => {
      const e: any = await t.caller.businessEvents.get({ id: a.event_id })
      return { action: a.published ? 'publish' : 'unpublish', event: e.name, date: e.date, startTime: e.startTime, city: e.city, venue: e.venueName, lineup: e.artists, price: e.price, stillMissing: e.missing, currentlyPublished: e.published }
    },
    run: async (t, a) => {
      const { input } = await mergedEvent(t, a.event_id, {}, { published: a.published })
      await t.caller.businessEvents.update(input)
      return { published: a.published, url: url(t, `/events/${a.event_id}`) }
    },
  },
  {
    name: 'duplicate_event', title: 'Repeat an event weekly', scopes: ['business:write'], business: true, annotations: WRITE,
    description: 'Copy an event to the next 1–12 weeks at the same local time (weekly classes, parties). Copies keep its published state, so repeating a live event publishes the copies (preview → confirm).',
    input: { event_id: eventId, weeks: z.number().int().min(1).max(12), confirm_token: confirmToken },
    confirm: async (t, a) => !!((await t.caller.businessEvents.get({ id: a.event_id })) as any).published,
    preview: async (t, a) => {
      const e: any = await t.caller.businessEvents.get({ id: a.event_id })
      return { event: e.name, from: e.date, weeks: a.weeks, copiesWillBePublic: e.published }
    },
    run: (t, a) => t.caller.businessEvents.duplicate({ id: a.event_id, weeks: a.weeks }),
  },
  {
    name: 'archive_event', title: 'Archive an event', scopes: ['business:write'], business: true, annotations: DESTRUCTIVE,
    description: 'Take an event off WeDance (it can be restored as a draft from the web app). For a synced weekly event, whole_series also archives the dates to come.',
    input: { event_id: eventId, whole_series: z.boolean().optional() },
    run: (t, a) => t.caller.businessEvents.archive({ id: a.event_id, series: a.whole_series }),
  },
  {
    name: 'add_profile_from_instagram', title: 'Add an artist or venue from Instagram', scopes: ['business:write'], business: true, annotations: WRITE,
    description: 'Someone for a line-up or venue who isn’t on WeDance yet: creates an unclaimed page from their Instagram handle (or returns the page that already links it).',
    input: { instagram: z.string().min(2).max(300).describe('Instagram handle or URL.'), type: z.enum(['artist', 'venue', 'organizer']), name: z.string().max(120).optional() },
    run: (t, a) => t.caller.businessEvents.addFromInstagram({ instagram: a.instagram, type: a.type, name: a.name }),
  },
  {
    name: 'suggest_venues', title: 'Venue ideas for a date', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Venues in a city that fit a date: who hosts which music on that weekday, whether they’re free, rooms and capacity.',
    input: { city, from: ymd, to: ymd.optional(), styles: z.array(z.string().max(60)).max(20).default([]), limit: z.number().int().min(1).max(40).default(8) },
    run: (t, a) => t.caller.businessEvents.venueIdeas({ city: a.city, from: a.from, to: a.to, styles: a.styles, limit: a.limit }),
  },
  {
    name: 'find_lineup', title: 'Find artists or venues', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Search WeDance pages by name or handle for a line-up or venue.',
    input: { query: z.string().min(2).max(80), type: z.enum(['artist', 'venue', 'organizer']).optional() },
    run: (t, a) => t.caller.businessEvents.searchProfiles({ q: a.query, type: a.type }),
  },
  {
    name: 'invite_artist', title: 'Invite an artist to an event', scopes: ['business:publish'], business: true, annotations: OUTWARD, confirm: true,
    description: 'Put an artist in an event’s line-up and invite them to confirm: if someone runs their page they get an email, otherwise you get a link to send them. Preview → confirm.',
    input: { event_id: eventId, handle, confirm_token: confirmToken },
    preview: async (t, a) => {
      const e: any = await t.caller.businessEvents.get({ id: a.event_id })
      const p: any = await t.caller.entity.getByHandle({ handle: a.handle })
      if (!p) throw new Error(`No WeDance page @${a.handle}.`)
      return { event: e.name, date: e.date, artist: p.profile?.name ?? p.name, artistHandle: a.handle, alreadyInLineup: (e.artists ?? []).includes(a.handle), effect: 'Adds them to the line-up and emails their team if their page has one; otherwise returns a link for you to send.' }
    },
    run: async (t, a) => {
      await t.caller.inquiries.addToEvent({ eventId: a.event_id, handle: a.handle })
      const link: any = await t.caller.artistInvites.link({ eventId: a.event_id, handle: a.handle })
      let emailed = 0
      if (link.managed && !link.answered) {
        try { emailed = ((await t.caller.artistInvites.notify({ eventId: a.event_id, handle: a.handle })) as any).sent } catch (e: any) { if (!/last day/.test(e?.message ?? '')) throw e }
      }
      return { inviteUrl: link.url, emailedTeamMembers: emailed, alreadyAnswered: link.answered, note: emailed ? 'Their team was emailed.' : 'Send them the inviteUrl yourself (nobody runs their page on WeDance yet, or they were emailed recently).' }
    },
  },
  {
    name: 'flyer_options', title: 'Flyer looks and status', scopes: ['business:read'], business: true, annotations: READ,
    description: 'For an event’s flyer: the lines that go on it, saved looks (styles) of the page, the kept flyer and what changed since.',
    input: { event_id: eventId, post_id: z.string().uuid().optional().describe('A post from plan_posts; default the event’s announcement.') },
    run: (t, a) => t.caller.businessFlyers.state({ eventId: a.event_id, postId: a.post_id }),
  },
  {
    name: 'make_flyer', title: 'Paint a flyer', scopes: ['business:write'], business: true, annotations: WRITE,
    description: 'Start painting a flyer for an event in a saved look (look_id from flyer_options) or a described one. Takes about a minute: poll flyer_status with the batch_id.',
    input: {
      event_id: eventId, look_id: z.string().uuid().optional(),
      look_description: z.string().min(10).max(2000).optional().describe('Describe the look when there is no saved one: setting, palette, typography.'),
      post_id: z.string().uuid().optional(),
    },
    run: async (t, a) => {
      if (!a.look_id && !a.look_description) throw new Error('Give look_id (see flyer_options) or look_description, or use flyer_variants for four directions.')
      const r: any = await t.caller.businessFlyers.make({ eventId: a.event_id, postId: a.post_id, lookId: a.look_id ?? null, look: a.look_id ? undefined : { description: a.look_description } })
      return { flyerId: r.id, batchId: r.batchId, status: 'painting', next: 'Call flyer_status with batch_id in about 60 seconds.' }
    },
  },
  {
    name: 'flyer_variants', title: 'Four flyer directions', scopes: ['business:write'], business: true, annotations: WRITE,
    description: 'Paint four different flyer directions for an event from 1–3 feelings (e.g. "elegant", "wild"). Poll flyer_status with the batch_id.',
    input: { event_id: eventId, feelings: z.array(z.string().max(30)).min(1).max(3), post_id: z.string().uuid().optional() },
    run: async (t, a) => {
      const r: any = await t.caller.businessFlyers.directions({ eventId: a.event_id, postId: a.post_id, feelings: a.feelings })
      return { batchId: r.batchId, flyerIds: r.ids, status: 'painting', next: 'Call flyer_status with batch_id in about 60 seconds.' }
    },
  },
  {
    name: 'fix_flyer', title: 'Change a flyer', scopes: ['business:write'], business: true, annotations: WRITE,
    description: 'Repaint a finished flyer with a change, e.g. “bigger date, less red”. Poll flyer_status with the batch_id.',
    input: { flyer_id: z.string().uuid(), notes: z.string().min(2).max(500) },
    run: async (t, a) => {
      const r: any = await t.caller.businessFlyers.fix({ flyerId: a.flyer_id, notes: a.notes })
      return { flyerId: r.id, batchId: r.batchId, status: 'painting' }
    },
  },
  {
    name: 'flyer_status', title: 'Flyer painting status', scopes: ['business:read'], business: true, annotations: READ,
    description: 'The flyers of a painting batch: painting, ready (with image URL), failed. Poll every 20–30 s until none is painting.',
    input: { batch_id: z.string().uuid() },
    run: async (t, a) => {
      const rows: any[] = await t.caller.businessFlyers.batch({ batchId: a.batch_id })
      return { done: rows.every(r => r.status !== 'painting'), flyers: rows }
    },
  },
  {
    name: 'write_captions', title: 'Write Instagram captions', scopes: ['business:write'], business: true, annotations: WRITE,
    description: 'Write captions for every post of an event’s content plan that has none yet, then return the plan with captions.',
    input: { event_id: eventId, language },
    run: async (t, a) => {
      const r: any = await t.caller.businessPosts.writeCaptions({ eventId: a.event_id, language: a.language })
      return { ...r, posts: await t.caller.businessPosts.list({ eventId: a.event_id }) }
    },
  },
  {
    name: 'plan_posts', title: 'Plan an event’s posts', scopes: ['business:write'], business: true, annotations: IDEMPOTENT,
    description: 'Add WeDance’s suggested content plan for an event (announcement, line-up posts, reminders with dates), then return the plan.',
    input: { event_id: eventId },
    run: async (t, a) => {
      const r: any = await t.caller.businessPosts.propose({ eventId: a.event_id })
      return { ...r, posts: await t.caller.businessPosts.list({ eventId: a.event_id }) }
    },
  },
  {
    name: 'inquiries', title: 'Booking requests', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Booking requests people sent to one of my pages (newest first), with their contact details.',
    input: { profile },
    run: (t, a) => t.caller.inquiries.forProfile({ username: a.profile }),
  },
  {
    name: 'mark_inquiry', title: 'Mark a booking request', scopes: ['business:write'], business: true, annotations: IDEMPOTENT,
    description: 'Record that a booking request was answered or declined (the answer itself goes by email to the person).',
    input: { profile, inquiry_id: z.string().uuid(), status: z.enum(['new', 'answered', 'declined']) },
    run: (t, a) => t.caller.inquiries.setStatus({ username: a.profile, id: a.inquiry_id, status: a.status }),
  },
  {
    name: 'team', title: 'Team of a page', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Who runs one of my pages and their roles; owners also see pending join requests.',
    input: { profile },
    run: (t, a) => t.caller.businessTeam.team({ username: a.profile }),
  },
  {
    name: 'decide_join_request', title: 'Approve or decline a join request', scopes: ['business:publish'], business: true, annotations: OUTWARD, confirm: true,
    description: 'Let someone join one of my pages’ team (or decline). Owners only. Preview → confirm.',
    input: { profile, request_id: z.string().uuid(), approve: z.boolean(), role: z.enum(['owner', 'editor']).optional(), confirm_token: confirmToken },
    preview: async (t, a) => {
      const team: any = await t.caller.businessTeam.team({ username: a.profile })
      const r = team.requests.find((x: any) => x.id === a.request_id)
      if (!r) throw new Error('No such pending join request on this page.')
      return { page: team.profile.name, person: r.name, asked: r.requestedRole, decision: a.approve ? `approve as ${a.role ?? r.requestedRole}` : 'decline', message: r.message }
    },
    run: (t, a) => t.caller.businessTeam.decideJoin({ requestId: a.request_id, approve: a.approve, role: a.role }),
  },
  {
    name: 'set_member_role', title: 'Change a team member’s role', scopes: ['business:publish'], business: true, annotations: OUTWARD, confirm: true,
    description: 'Make a team member owner or editor of one of my pages. Owners only. Preview → confirm.',
    input: { profile, dancer_id: z.string().uuid(), role: z.enum(['owner', 'editor']), title: z.string().max(60).nullable().optional(), confirm_token: confirmToken },
    preview: async (t, a) => {
      const team: any = await t.caller.businessTeam.team({ username: a.profile })
      const m = team.members.find((x: any) => x.dancerId === a.dancer_id)
      if (!m) throw new Error('That person isn’t on this page’s team.')
      return { page: team.profile.name, person: m.name, from: m.role, to: a.role }
    },
    run: (t, a) => t.caller.businessTeam.setRole({ username: a.profile, dancerId: a.dancer_id, role: a.role, title: a.title }),
  },
  {
    name: 'my_festivals', title: 'Festivals I organize', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Festivals the dancer organizes on WeDance (for event_insights).',
    input: {},
    run: t => t.caller.festivalInsights.myFestivals(),
  },
  {
    name: 'event_insights', title: 'Festival insights', scopes: ['business:read'], business: true, annotations: READ,
    description: 'The style and level mix of a festival’s attendees (aggregates only).',
    input: { festival },
    run: (t, a) => t.caller.festivalInsights.styleLevelMix({ festivalSlug: a.festival }),
  },
  {
    name: 'update_business_profile', title: 'Edit a business page', scopes: ['business:publish'], business: true, annotations: OUTWARD, confirm: true,
    description: 'Change one of my public pages (artist, venue, organizer, promoter): name, bio, city, styles, photo, address, and for a promoter page the influencer flag. Preview → confirm.',
    input: {
      profile, name: z.string().trim().min(1).max(120).optional(), bio: z.string().max(4000).optional(), city: z.string().max(120).optional(),
      styles: z.array(z.string().trim().min(1).max(40)).max(20).optional(), photo: z.string().url().nullable().optional(), address: z.string().max(300).optional(),
      influencer: z.boolean().optional().describe('Promoter pages only: true = this promoter is an influencer (their deliverable is content; promo_kit is made for them).'),
      confirm_token: confirmToken,
    },
    preview: async (t, a) => {
      const cur: any = await t.caller.business.get({ username: a.profile })
      const fields = ['name', 'bio', 'city', 'styles', 'photo', 'address', 'influencer'].filter(k => a[k] !== undefined)
      return { page: cur.name, changes: Object.fromEntries(fields.map(k => [k, { from: cur[k], to: a[k] }])) }
    },
    run: async (t, a) => {
      const { profile: username, confirm_token: _c, ...fields } = a
      return t.caller.business.update({ username, ...fields })
    },
  },
  {
    name: 'list_spaces', title: 'Rooms of a venue', scopes: ['business:read'], business: true, annotations: READ,
    description: 'The bookable rooms of one of my venue pages (ids for set_availability).',
    input: { profile },
    run: (t, a) => t.caller.business.spaces({ username: a.profile }),
  },
  {
    name: 'set_availability', title: 'Set a room’s weekly availability', scopes: ['business:write'], business: true, annotations: IDEMPOTENT,
    description: 'Replace the weekly time slots when a venue room can be booked. Note: availability exists for venue rooms (list_spaces), not for artists.',
    input: { space_id: z.string().uuid(), slots: z.array(z.object({ day_of_week: z.number().int().min(1).max(7).describe('1 = Monday … 7 = Sunday'), start: hhmm, end: hhmm })).max(50) },
    run: (t, a) => t.caller.booking.setAvailability({ spaceId: a.space_id, slots: a.slots.map((s: any) => ({ dayOfWeek: s.day_of_week, startTime: s.start, endTime: s.end })) }),
  },
  {
    name: 'my_invites', title: 'Invites and suggestions for my page', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Changes organizers suggested for one of my pages (photos, videos, names) waiting for approval. Line-up invites for my pages are in inbox (each with an invite_token).',
    input: { profile },
    run: (t, a) => t.caller.artistInvites.get({ username: a.profile }),
  },
  {
    name: 'respond_invite', title: 'Answer an invite', scopes: ['business:publish'], business: true, annotations: OUTWARD, confirm: true,
    description: 'Approve or turn down suggested changes for my page, and confirm or decline a line-up invite (invite_token from inbox). Preview → confirm.',
    input: {
      profile: profile.optional(), invite_token: z.string().min(10).max(80).optional().describe('The token at the end of an invite link (/confirm/<token>).'),
      decisions: z.array(z.object({ id: z.string().uuid(), approve: z.boolean() })).max(100).default([]).describe('Suggestion ids from my_invites.'),
      participation: z.enum(['confirmed', 'declined']).optional().describe('Line-up answer (needs invite_token).'),
      message: z.string().max(2000).optional().describe('A note to the organizer.'),
      confirm_token: confirmToken,
    },
    preview: async (t, a) => {
      if (!a.profile && !a.invite_token) throw new Error('Give profile or invite_token.')
      const g: any = await t.caller.artistInvites.get(a.invite_token ? { token: a.invite_token } : { username: a.profile })
      const pending = new Map((g.pending ?? []).map((p: any) => [p.id, p]))
      return { page: g.profile?.name, event: g.event?.name ?? null, participation: a.participation ?? null, decisions: a.decisions.map((d: any) => ({ ...(pending.get(d.id) as any ?? { id: d.id }), approve: d.approve })), message: a.message ?? null }
    },
    run: (t, a) => t.caller.artistInvites.respond({ token: a.invite_token, username: a.invite_token ? undefined : a.profile, decisions: a.decisions, participation: a.participation, message: a.message }),
  },
  {
    name: 'claim_profile', title: 'Take over a page from an invite', scopes: ['business:publish'], annotations: OUTWARD, confirm: true,
    description: 'Become the owner of a page nobody runs yet, using the invite link an organizer sent (invite_token = end of /confirm/<token>). Preview → confirm.',
    input: { invite_token: z.string().min(10).max(80), confirm_token: confirmToken },
    preview: async (t, a) => {
      const g: any = await t.caller.artistInvites.get({ token: a.invite_token })
      return { page: g.profile?.name, handle: g.profile?.username, alreadyManaged: g.managed, effect: g.managed ? 'Someone already runs this page; claiming will fail.' : 'You become the owner of this page.' }
    },
    run: (t, a) => t.caller.artistInvites.claim({ token: a.invite_token }),
  },
  {
    name: 'profile_schedule', title: 'A page’s upcoming events', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Upcoming events a venue hosts, an organizer runs or an artist plays (artists: "my gigs").',
    input: { handle, days: z.number().int().min(1).max(366).default(120) },
    run: async (t, a) => ((await t.caller.events.byProfile({ username: a.handle, days: a.days })) as any[]).map(e => card(t, e)),
  },
  {
    name: 'post_gig_offer', title: 'Post a gig', scopes: ['business:publish', 'me:read'], business: true, annotations: OUTWARD, confirm: true,
    description: 'Publish a gig on WeDance: a role you want filled (kind "role") or a service you offer (kind "offer"). Contact goes to the dancer’s account email. Preview → confirm.',
    input: {
      kind: z.enum(['role', 'offer']), category: z.string().min(1).max(60).describe('e.g. "Teacher", "DJ", "Photographer".'), title: z.string().min(1).max(160),
      poster_name: z.string().min(1).max(120).describe('Who posts it (a page name).'), poster_type: z.string().min(1).max(40).describe('e.g. "organizer", "artist".'),
      location: z.string().min(1).max(120), styles: z.array(z.string().max(40)).max(10).default([]), when: z.string().min(1).max(120), compensation: z.string().min(1).max(120),
      deadline: z.string().max(40).optional(), contact_url: z.string().url().optional(), confirm_token: confirmToken,
    },
    preview: async (_t, a) => ({ kind: a.kind, title: a.title, by: a.poster_name, where: a.location, when: a.when, pay: a.compensation, effect: 'Publicly listed on /gigs with your account email as contact.' }),
    run: async (t, a) => {
      const { email } = await t.caller.auth.myEmail()
      return t.caller.gigs.create({ kind: a.kind, category: a.category, title: a.title, posterName: a.poster_name, posterType: a.poster_type, location: a.location, styles: a.styles, when: a.when, compensation: a.compensation, deadline: a.deadline, contactEmail: email, contactUrl: a.contact_url })
    },
  },
  {
    name: 'promoter_roster', title: 'A promoter’s artist roster', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Artists a promoter page represents.',
    input: { handle },
    run: async (t, a) => t.caller.entity.promoterRoster({ profileId: await profileId(t, a.handle) }),
  },

  // ── Phase 2: series, attendees, gig applications ─────────────────────────────
  {
    name: 'recurring_series', title: 'Create a recurring series', scopes: ['business:write'], business: true, annotations: WRITE,
    description: 'Create every date of a recurring event in one call: weekly classes, a party every second week, a social on the nth weekday of the month. Give the first date, the rule and an end (until or count); skip holidays with skip. Each date becomes its own event in one series (fix one date later with update_event). Drafts by default; published: true needs business:publish and runs as preview (the list of dates) → confirm.',
    input: {
      profile: profile.describe('Handle of the page that runs the series (see my_profiles).'),
      ...SERIES_FIELDS,
      every: z.enum(['week', '2weeks', 'month']).describe('"week", "2weeks", or "month" (the same nth weekday as the first date, e.g. the 3rd Sunday).'),
      until: ymd.optional().describe('Last possible date (inclusive).'),
      count: z.number().int().min(1).max(52).optional().describe('How many dates (skipped ones don’t count). Max 52.'),
      skip: z.array(ymd).max(52).default([]).describe('Dates to leave out (holidays).'),
      month_week: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]).optional().describe('every=month only: 1–4 or -1 for the last; default the first date’s.'),
      published: z.boolean().default(false).describe('true = public right away (preview → confirm).'),
      confirm_token: confirmToken,
    },
    confirm: async (_t, a) => !!a.published,
    preview: async (t, a) => {
      const p: any = await t.caller.businessEvents.seriesPreview(seriesInput(a))
      return { ...p, effect: `Creates ${p.dates.length} public events.` }
    },
    run: async (t, a) => {
      const r: any = await t.caller.businessEvents.createSeries(seriesInput(a))
      return { ...r, next: r.published ? 'Live. Change one date with update_event.' : 'Drafts. Check them with my_events, then publish_series with the seriesId.' }
    },
  },
  {
    name: 'publish_series', title: 'Publish a series', scopes: ['business:publish'], business: true, annotations: OUTWARD, confirm: true,
    description: 'Publish (or take back to draft) every date still to come of a series (seriesId from recurring_series or my_events). Preview (the dates) → confirm.',
    input: { series_id: z.string().min(1).max(80), published: z.boolean().default(true), confirm_token: confirmToken },
    preview: async (t, a) => {
      const s: any = await t.caller.businessEvents.series({ seriesId: a.series_id })
      return { action: a.published ? 'publish' : 'unpublish', series: s.name, dates: s.dates.map((d: any) => `${d.weekday} ${d.date} ${d.startTime}${d.published === a.published ? ' (already)' : ''}`) }
    },
    run: (t, a) => t.caller.businessEvents.publishSeries({ seriesId: a.series_id, published: a.published }),
  },
  {
    name: 'attendees', title: 'Who’s coming to my event', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Who added an event of my pages to their plan, signed up or bought a ticket. Counts always include everyone; names only for dancers who made their going public. csv: true adds a CSV of the named list.',
    input: { event_id: eventId, csv: z.boolean().default(false) },
    run: (t, a) => t.caller.businessEvents.attendees({ id: a.event_id, csv: a.csv }),
  },
  {
    name: 'gig_applications', title: 'Applications to my gigs', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Gigs I (or my pages) posted, each with the artists who applied: message, page, email, status.',
    input: { gig_id: z.string().uuid().optional() },
    run: (t, a) => t.caller.gigs.applications(a.gig_id ? { gigId: a.gig_id } : undefined),
  },
  {
    name: 'decide_gig_application', title: 'Accept or decline a gig application', scopes: ['business:publish'], business: true, annotations: OUTWARD, confirm: true,
    description: 'Accept or decline an artist’s application to my gig; they get an email. Preview → confirm.',
    input: { application_id: z.string().uuid(), decision: z.enum(['accepted', 'declined']), confirm_token: confirmToken },
    preview: async (t, a) => {
      const gigs: any[] = await t.caller.gigs.applications()
      for (const g of gigs) {
        const app = g.applications.find((x: any) => x.id === a.application_id)
        if (app) return { gig: g.title, applicant: app.applicant.name, page: app.page?.name ?? null, current: app.status, decision: a.decision, effect: `${app.applicant.name} gets an email.` }
      }
      throw new Error('No such application on your gigs.')
    },
    run: (t, a) => t.caller.gigs.decideApplication({ applicationId: a.application_id, decision: a.decision }),
  },

  // ── Phase 2: promoters and influencers ───────────────────────────────────────
  {
    name: 'my_link', title: 'My tracked link for an event', scopes: ['business:read'], business: true, annotations: IDEMPOTENT,
    description: 'My personal link to a published event for one of my promoter pages, with a QR code (SVG and PNG URLs). Visits, sign-ups, plan adds and tickets through it count in my_results. The same link every time.',
    input: { event_id: eventId, profile: profile.describe('Your promoter page (see my_profiles).') },
    run: (t, a) => t.caller.referral.myLink({ eventId: a.event_id, profile: a.profile }),
  },
  {
    name: 'my_results', title: 'What my links brought', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Per tracked link (promoter page + event): visits, sign-ups, plan adds and tickets, plus totals. Optionally one page or one event.',
    input: { profile: profile.optional(), event_id: eventId.optional() },
    run: (t, a) => t.caller.referral.myResults({ profile: a.profile, eventId: a.event_id }),
  },
  {
    name: 'promoter_dashboard', title: 'Promoter dashboard', scopes: ['business:read'], business: true, annotations: READ,
    description: 'One promoter page at a glance: totals, the events it promotes (upcoming and past, each with results), roster size, its giveaway proposals, and whether it is an influencer.',
    input: { profile: profile.describe('Your promoter page.') },
    run: (t, a) => t.caller.referral.promoterDashboard({ profile: a.profile }),
  },
  {
    name: 'event_link_results', title: 'Promoter results for my event', scopes: ['business:read'], business: true, annotations: READ,
    description: 'For an event of my pages: every promoter’s tracked link and what it brought (visits, sign-ups, plan adds, tickets).',
    input: { event_id: eventId },
    run: (t, a) => t.caller.referral.eventLinkResults({ eventId: a.event_id }),
  },
  {
    name: 'promo_kit', title: 'Promo kit for an event', scopes: ['business:read'], business: true,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: 'Everything to promote a published event: the flyer (story 9:16 and feed 4:5 URLs), a caption in the event’s languages, hashtags, and for a promoter page its tracked link and QR code. If the event has no flyer at all, one is painted (about a minute; poll flyer_status or call again). The event’s own team can use any of their pages (no tracked link then).',
    input: {
      event_id: eventId, profile: profile.describe('Your promoter page, or a page of the event’s team.'),
      language: language.optional().describe('Caption language(s); default the event’s.'),
      paint_if_missing: z.boolean().default(true).describe('false = never start painting a flyer.'),
    },
    run: (t, a) => t.caller.referral.promoKit({ eventId: a.event_id, profile: a.profile, language: a.language, paintIfMissing: a.paint_if_missing }),
  },
  {
    name: 'propose_giveaway', title: 'Propose a giveaway', scopes: ['business:write'], business: true, annotations: WRITE,
    description: 'Propose a giveaway for a published event (e.g. "2 full passes") from one of my pages. Nothing goes public: the event’s organizer approves it, then it runs on WeDance in the event’s city and points at the event through my tracked link.',
    input: {
      event_id: eventId, profile: profile.describe('Your promoter/influencer page.'),
      prize: z.string().min(3).max(200).describe('What people can win, e.g. "2 full passes".'),
      description: z.string().max(1000).optional(), sponsor_name: z.string().max(120).optional().describe('Who gives the prize (default: your page).'),
      ends_on: ymd.optional().describe('Last day to enter (default: the event’s start).'),
    },
    run: (t, a) => t.caller.giveaway.propose({ eventId: a.event_id, profile: a.profile, prize: a.prize, description: a.description ?? '', sponsorName: a.sponsor_name, endsOn: a.ends_on }),
  },
  {
    name: 'giveaway_proposals', title: 'Giveaway proposals for my events', scopes: ['business:read'], business: true, annotations: READ,
    description: 'Giveaways promoters and influencers proposed for events of my pages (all, or one event), with their status.',
    input: { event_id: eventId.optional(), status: z.enum(['pending', 'approved', 'declined']).optional() },
    run: (t, a) => t.caller.giveaway.proposals({ eventId: a.event_id, status: a.status }),
  },
  {
    name: 'decide_giveaway_proposal', title: 'Approve or decline a giveaway', scopes: ['business:publish'], business: true, annotations: OUTWARD, confirm: true,
    description: 'Approve a proposed giveaway for my event (it goes live on WeDance in the event’s city until ends_on or the event’s start) or decline it. Preview → confirm.',
    input: { proposal_id: z.string().uuid(), approve: z.boolean(), ends_on: ymd.optional(), note: z.string().max(500).optional(), confirm_token: confirmToken },
    preview: async (t, a) => {
      const all: any[] = await t.caller.giveaway.proposals()
      const p = all.find(x => x.id === a.proposal_id)
      if (!p) throw new Error('No such proposal for your events.')
      return { event: p.event.name, prize: p.prize, by: p.page.name, status: p.status, decision: a.approve ? 'approve: a public giveaway goes live' : 'decline', endsOn: a.ends_on ?? null }
    },
    run: (t, a) => t.caller.giveaway.decideProposal({ proposalId: a.proposal_id, approve: a.approve, endsOn: a.ends_on, note: a.note }),
  },

  // ── Admin (WeDance admins on an allowlisted app only) ─────────────────────────
  {
    name: 'admin_pending_claims', title: 'Admin: page claims to review', scopes: ['admin'], annotations: READ,
    description: 'Claims and reclaims of pages waiting for an admin decision.',
    input: {},
    run: t => t.caller.business.listClaims(),
  },
  {
    name: 'admin_pending_videos', title: 'Admin: city videos to review', scopes: ['admin'], annotations: READ,
    description: 'Submitted city videos waiting for moderation.',
    input: { city: city.optional() },
    run: (t, a) => t.caller.cityVideo.pendingList(a.city ? { citySlug: citySlug(a.city) } : undefined),
  },
]

export const TOOL_BY_NAME = new Map(TOOLS.map(t => [t.name, t]))

/** Who's calling, as far as tool listing cares. */
export interface ListingCtx { scopes: readonly string[]; grantedProfileIds: readonly string[]; isAdmin: boolean }

/** The tools this caller may see: every scope held; business tools need a granted profile (or admin). */
export function visibleTools(c: ListingCtx): ToolDef[] {
  return TOOLS.filter((tool) => {
    if (!tool.scopes.every(s => s === 'admin' ? c.isAdmin : hasScope(c.scopes, s))) return false
    if (tool.business && !c.isAdmin && !c.grantedProfileIds.length) return false
    return true
  })
}
