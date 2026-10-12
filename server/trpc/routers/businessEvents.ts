import { z } from 'zod'
import { eq, and, or, gte, lt, inArray, desc, asc, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { events, profiles, profileMembers, profileClaims, cities } from '../../database/schema'
import { slugify, randomSuffix } from '../../utils/slug'
import { resolveTimezone } from '../../utils/v3EventSync'
import { zonedToUtc, eventLocalDate, eventLocalTime, eventLocalWeekday } from '../../../shared/utils/eventTime'
import { requireMember } from './business'
import { joinRequestsForOwner } from './businessTeam'

/**
 * Business mode — events a profile runs, and the /business home inbox.
 *
 * An event created here gets `host_profile_id`; whoever manages that profile
 * (profile_members) can edit, duplicate and archive it. Synced v3 events have
 * no host profile and stay read-only here. Organizers type local wall-clock
 * times; we store the UTC instant plus the city's IANA timezone, like the sync.
 */

const EVENT_TYPES = ['Party', 'Workshop', 'Course', 'Festival', 'Weekender', 'Congress', 'Concert', 'Show'] as const
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.')
const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'Pick a time.')

const eventInput = z.object({
  name: z.string().trim().min(1, 'Add a name.').max(160),
  type: z.enum(EVENT_TYPES),
  date: ymd,
  startTime: hhmm,
  endTime: hhmm.nullable().optional(),
  // Multi-day events (festivals, weekenders). Defaults to `date`.
  endDate: ymd.nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  venueUsername: z.string().max(200).nullable().optional(),
  venueName: z.string().trim().max(200).nullable().optional(),
  venueAddress: z.string().trim().max(300).nullable().optional(),
  artists: z.array(z.string().min(1).max(200)).max(40).default([]),
  styles: z.array(z.string().min(1).max(40)).max(20).default([]),
  description: z.string().max(8000).default(''),
  cover: z.string().url().nullable().optional(),
  ticketUrl: z.string().url().nullable().optional(),
  price: z.string().max(120).default(''),
  published: z.boolean().default(false),
})
type EventInput = z.infer<typeof eventInput>

async function profilesIManage(ctx: { db: any; dancerId: string }) {
  return ctx.db
    .select({ id: profiles.id, username: profiles.username, name: profiles.name, type: profiles.type })
    .from(profileMembers)
    .innerJoin(profiles, eq(profiles.id, profileMembers.profileId))
    .where(eq(profileMembers.dancerId, ctx.dancerId))
}

// An event is editable by managers of its host profile (admins: any hosted event).
async function requireEventManager(ctx: { db: any; dancerId: string; isAdmin?: boolean }, id: string) {
  const [ev] = await ctx.db.select().from(events).where(eq(events.id, id))
  if (!ev) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found.' })
  if (!ev.hostProfileId) throw new TRPCError({ code: 'FORBIDDEN', message: 'This event isn’t managed on WeDance.' })
  if (ctx.isAdmin) return ev
  const [m] = await ctx.db.select({ id: profileMembers.id }).from(profileMembers)
    .where(and(eq(profileMembers.profileId, ev.hostProfileId), eq(profileMembers.dancerId, ctx.dancerId)))
  if (!m) throw new TRPCError({ code: 'FORBIDDEN', message: 'You don’t manage this event.' })
  return ev
}

// Canonical city → slug, country and timezone (CityCombobox saves the English name).
async function cityInfo(db: any, name: string | null | undefined) {
  if (!name) return { city: null, citySlug: null, country: null, timezone: 'Europe/Berlin' }
  const [c] = await db.select({ name: cities.name, slug: cities.slug, country: cities.country, countryCode: cities.countryCode, lng: cities.lng })
    .from(cities).where(sql`lower(${cities.name}) = lower(${name})`).limit(1)
  return c
    ? { city: c.name, citySlug: c.slug, country: c.country, timezone: resolveTimezone(c.countryCode, c.lng) }
    : { city: name, citySlug: slugify(name), country: null, timezone: 'Europe/Berlin' }
}

// Build the DB row from the form. Times are local to the event's city.
async function toRow(db: any, host: { username: string; type: string }, input: EventInput) {
  let venue: { username: string; name: string; address: string | null; city: string | null } | null = null
  if (input.venueUsername) {
    const [v] = await db.select({ username: profiles.username, name: profiles.name, address: profiles.address, city: profiles.city })
      .from(profiles).where(eq(profiles.username, input.venueUsername))
    if (!v) throw new TRPCError({ code: 'BAD_REQUEST', message: 'That venue isn’t on WeDance.' })
    venue = v
  }
  const loc = await cityInfo(db, input.city || venue?.city)
  const start = zonedToUtc(input.date, input.startTime, loc.timezone)
  let end: Date | null = null
  if (input.endTime || input.endDate) {
    end = zonedToUtc(input.endDate || input.date, input.endTime || input.startTime, loc.timezone)
    // "22:00–03:00" on one date means the party ends the next morning.
    if (end <= start && !input.endDate) end = new Date(end.getTime() + 86400_000)
    if (end <= start) throw new TRPCError({ code: 'BAD_REQUEST', message: 'The end must be after the start.' })
  }
  return {
    name: input.name,
    type: input.type,
    isFestival: ['Festival', 'Weekender', 'Congress'].includes(input.type),
    startDate: start,
    endDate: end ?? new Date(start.getTime() + 3 * 3600_000),
    timezone: loc.timezone,
    city: loc.city,
    citySlug: loc.citySlug,
    country: loc.country,
    venueUsername: venue?.username ?? (host.type === 'venue' && !input.venueName ? host.username : null),
    venueName: venue?.name ?? input.venueName ?? null,
    venueAddress: venue?.address ?? input.venueAddress ?? null,
    organizerUsername: host.type === 'organizer' ? host.username : null,
    artists: input.artists,
    styles: input.styles,
    description: input.description,
    cover: input.cover ?? '',
    ticketUrl: input.ticketUrl ?? null,
    price: input.price,
    published: input.published,
    archived: false,
    updatedAt: new Date(),
  }
}

// What a published event still lacks, in plain words. Shared by the list, the
// editor and the home inbox so they always agree.
async function checklistFor(db: any, evs: any[]) {
  const handles = [...new Set(evs.flatMap(e => (e.artists ?? []) as string[]))]
  const artistRows = handles.length
    ? await db.select({ username: profiles.username, photo: profiles.photo, socials: profiles.socials }).from(profiles).where(inArray(profiles.username, handles))
    : []
  const byHandle = new Map<string, any>(artistRows.map((a: any) => [a.username, a]))
  return new Map(evs.map((e) => {
    const missing: string[] = []
    if (!e.cover) missing.push('cover photo')
    if (!e.ticketUrl && !/free|gratis|frei/i.test(e.price ?? '')) missing.push('ticket link or “free”')
    if (!e.venueUsername && !e.venueName) missing.push('venue')
    if (!(e.artists ?? []).length) missing.push('line-up')
    const noIg = (e.artists ?? []).filter((h: string) => !(byHandle.get(h)?.socials ?? []).some((s: any) => s.platform === 'instagram'))
    if (noIg.length) missing.push(`Instagram for ${noIg.map((h: string) => '@' + h).join(', ')}`)
    const noPhoto = (e.artists ?? []).filter((h: string) => !byHandle.get(h)?.photo)
    if (noPhoto.length) missing.push(`photo for ${noPhoto.map((h: string) => '@' + h).join(', ')}`)
    return [e.id, missing]
  }))
}

const listColumns = {
  id: events.id, name: events.name, type: events.type, startDate: events.startDate, endDate: events.endDate,
  timezone: events.timezone, published: events.published, cover: events.cover, ticketUrl: events.ticketUrl,
  price: events.price, venueUsername: events.venueUsername, venueName: events.venueName, artists: events.artists,
  city: events.city, hostProfileId: events.hostProfileId, seriesId: events.seriesId,
}

export const businessEventsRouter = router({
  // Events of the profiles I manage (optionally one), newest-relevant first.
  list: protectedProcedure
    .input(z.object({ profile: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const mine = await profilesIManage(ctx)
      const scope = input?.profile ? mine.filter((p: any) => p.username === input.profile) : mine
      if (!scope.length) return { upcoming: [], past: [] }
      const byId = new Map(scope.map((p: any) => [p.id, p]))
      const rows = await ctx.db.select(listColumns).from(events)
        .where(and(inArray(events.hostProfileId, scope.map((p: any) => p.id)), eq(events.archived, false)))
        .orderBy(asc(events.startDate)).limit(500)
      const checks = await checklistFor(ctx.db, rows)
      const now = Date.now()
      const shaped = rows.map((e: any) => ({ ...e, host: hostSummary(byId.get(e.hostProfileId)), missing: checks.get(e.id) ?? [] }))
      return {
        upcoming: shaped.filter((e: any) => new Date(e.endDate ?? e.startDate).getTime() >= now),
        past: shaped.filter((e: any) => new Date(e.endDate ?? e.startDate).getTime() < now).reverse().slice(0, 30),
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.id)
      const [host] = await ctx.db.select({ username: profiles.username, name: profiles.name, type: profiles.type }).from(profiles).where(eq(profiles.id, ev.hostProfileId))
      const tz = ev.timezone || 'Europe/Berlin'
      const end = ev.endDate ? new Date(ev.endDate) : null
      const sameDay = !end || eventLocalDate(end, tz) === eventLocalDate(ev.startDate, tz)
        // A night that ends before noon the next day reads as one date with an end time.
        || (end.getTime() - new Date(ev.startDate).getTime() < 18 * 3600_000)
      return {
        id: ev.id,
        host,
        name: ev.name ?? '',
        type: (EVENT_TYPES as readonly string[]).includes(ev.type) ? ev.type : 'Party',
        date: eventLocalDate(ev.startDate, tz),
        startTime: eventLocalTime(ev.startDate, tz),
        endTime: end ? eventLocalTime(end, tz) : null,
        endDate: end && !sameDay ? eventLocalDate(end, tz) : null,
        city: ev.city ?? '',
        venueUsername: ev.venueUsername,
        venueName: ev.venueName ?? '',
        venueAddress: ev.venueAddress ?? '',
        artists: ev.artists ?? [],
        styles: ev.styles ?? [],
        description: ev.description ?? '',
        cover: ev.cover || null,
        ticketUrl: ev.ticketUrl,
        price: ev.price ?? '',
        published: ev.published,
        timezone: tz,
        missing: (await checklistFor(ctx.db, [ev])).get(ev.id) ?? [],
      }
    }),

  create: protectedProcedure
    .input(eventInput.extend({ hostUsername: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const host = await requireMember(ctx, input.hostUsername)
      const row = await toRow(ctx.db, host, input)
      const [ev] = await ctx.db.insert(events)
        .values({ ...row, hostProfileId: host.id, source: 'wedance-business', slug: `${slugify(input.name)}-${randomSuffix(5)}` })
        .returning({ id: events.id })
      return { id: ev!.id }
    }),

  update: protectedProcedure
    .input(eventInput.extend({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.id)
      const [host] = await ctx.db.select({ username: profiles.username, type: profiles.type }).from(profiles).where(eq(profiles.id, ev.hostProfileId))
      const { id: _id, ...fields } = input
      await ctx.db.update(events).set(await toRow(ctx.db, host!, fields)).where(eq(events.id, ev.id))
      return { saved: true }
    }),

  // Repeat an event every week (weekly socials). Copies keep the source's
  // published state and share a seriesId with it.
  duplicate: protectedProcedure
    .input(z.object({ id: z.string().uuid(), weeks: z.number().int().min(1).max(12) }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.id)
      const seriesId = ev.seriesId ?? `host-${ev.id}`
      if (!ev.seriesId) await ctx.db.update(events).set({ seriesId }).where(eq(events.id, ev.id))
      const { id: _i, slug: _s, sourceId: _si, createdAt: _c, syncedAt: _y, ...copy } = ev
      const rows = Array.from({ length: input.weeks }, (_, i) => {
        const shift = (i + 1) * 7 * 86400_000
        return {
          ...copy,
          seriesId,
          slug: `${slugify(ev.name ?? 'event')}-${randomSuffix(5)}`,
          // Same wall-clock time a week later: re-derive in the event's zone so
          // a series crossing the DST switch doesn't drift by an hour.
          startDate: zonedToUtc(eventLocalDate(new Date(new Date(ev.startDate).getTime() + shift), ev.timezone), eventLocalTime(ev.startDate, ev.timezone), ev.timezone),
          endDate: ev.endDate
            ? zonedToUtc(eventLocalDate(new Date(new Date(ev.endDate).getTime() + shift), ev.timezone), eventLocalTime(ev.endDate, ev.timezone), ev.timezone)
            : null,
          updatedAt: new Date(),
        }
      })
      const created = await ctx.db.insert(events).values(rows).returning({ id: events.id, startDate: events.startDate })
      return { created }
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.id)
      await ctx.db.update(events).set({ archived: true, published: false, updatedAt: new Date() }).where(eq(events.id, ev.id))
      return { archived: true }
    }),

  // Profile picker for venue and line-up fields.
  searchProfiles: protectedProcedure
    .input(z.object({ q: z.string().trim().min(2).max(80), type: z.enum(['artist', 'venue', 'organizer']).optional() }))
    .query(async ({ ctx, input }) => {
      const like = `%${input.q.replace(/^@/, '')}%`
      return ctx.db
        .select({ username: profiles.username, name: profiles.name, type: profiles.type, city: profiles.city, photo: profiles.photo })
        .from(profiles)
        .where(and(
          eq(profiles.status, 'visible'),
          input.type ? eq(profiles.type, input.type) : undefined,
          or(sql`${profiles.name} ILIKE ${like}`, sql`${profiles.username} ILIKE ${like}`),
        ))
        .orderBy(asc(profiles.name))
        .limit(10)
    }),

  // "Paste their Instagram" — add an artist or venue who isn't on WeDance yet.
  // Creates an unclaimed profile they can claim later; reuses one that already
  // links the same Instagram account.
  addFromInstagram: protectedProcedure
    .input(z.object({
      instagram: z.string().trim().min(2).max(300),
      type: z.enum(['artist', 'venue', 'organizer']),
      name: z.string().trim().max(120).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const handle = input.instagram
        .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
        .replace(/^@/, '')
        .split(/[/?#]/)[0]!
        .toLowerCase()
      if (!/^[a-z0-9._]{1,30}$/.test(handle)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'That doesn’t look like an Instagram handle.' })
      const url = `https://instagram.com/${handle}`
      const [existing] = await ctx.db.select({ username: profiles.username, name: profiles.name, type: profiles.type, city: profiles.city, photo: profiles.photo })
        .from(profiles)
        // Same Instagram account only (www. / trailing slash / case vary in imports).
        // A matching WeDance handle is not proof it's the same person.
        .where(sql`${profiles.socials}::text ~* ${`instagram\\.com/${handle.replace(/\./g, '\\.')}/?"`}`)
        .limit(1)
      if (existing) return existing
      let username = handle.replace(/[._]+/g, '-').replace(/^-|-$/g, '')
      const [taken] = await ctx.db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, username))
      if (taken) username = `${username}-${randomSuffix(4)}`
      const [p] = await ctx.db.insert(profiles)
        .values({ username, type: input.type, name: input.name || handle, socials: [{ platform: 'instagram', url }], sourceRef: { source: 'wedance-business', addedBy: ctx.dancerId } })
        .returning({ username: profiles.username, name: profiles.name, type: profiles.type, city: profiles.city, photo: profiles.photo })
      return p!
    }),

  // /business home: what needs me + the next 14 days, across every profile I manage.
  inbox: protectedProcedure.query(async ({ ctx }) => {
    const mine = await profilesIManage(ctx)
    const now = new Date()
    const in14 = new Date(now.getTime() + 14 * 86400_000)
    const in60 = new Date(now.getTime() + 60 * 86400_000)
    type Item = { kind: string; tone: 'warning' | 'info' | 'danger' | 'neutral'; title: string; detail?: string; to: string }
    const needs: Item[] = []

    const claims = await ctx.db
      .select({ status: profileClaims.status, name: profiles.name, username: profiles.username })
      .from(profileClaims).innerJoin(profiles, eq(profiles.id, profileClaims.profileId))
      .where(and(eq(profileClaims.dancerId, ctx.dancerId), inArray(profileClaims.status, ['pending', 'rejected'])))
    for (const c of claims) {
      needs.push(c.status === 'pending'
        ? { kind: 'claim', tone: 'neutral', title: `Claim for ${c.name} is waiting for review`, detail: 'We check every claim by hand.', to: '/business/profiles' }
        : { kind: 'claim', tone: 'danger', title: `Claim for ${c.name} wasn’t approved`, detail: 'Send a new request with proof we can check.', to: `/business/claim?profile=${c.username}` })
    }

    for (const j of await joinRequestsForOwner(ctx.db, ctx.dancerId)) {
      needs.push({ kind: 'join', tone: 'info', title: `${j.dancerName} wants to join ${j.profileName}`, detail: `As ${j.requestedRole}${j.title ? ` · ${j.title}` : ''}. Approve or decline.`, to: `/business/profiles/${j.profileUsername}/team` })
    }

    const hosted = mine.length
      ? await ctx.db.select(listColumns).from(events)
        .where(and(inArray(events.hostProfileId, mine.map((p: any) => p.id)), eq(events.archived, false), gte(events.endDate, now), lt(events.startDate, in60)))
        .orderBy(asc(events.startDate))
      : []
    const checks = await checklistFor(ctx.db, hosted)
    const fmtDay = (e: any) => {
      const tz = e.timezone || 'Europe/Berlin'
      const d = eventLocalDate(e.startDate, tz)
      return `${eventLocalWeekday(e.startDate, tz).slice(0, 3)} ${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`
    }
    // One item per weekly series (not one per date), pointing at the next date.
    const groups = new Map<string, { kind: 'draft' | 'missing'; first: any; count: number; missing: Set<string> }>()
    for (const e of hosted) {
      const gaps = checks.get(e.id) ?? []
      const kind = !e.published ? 'draft' : (gaps.length && new Date(e.startDate) < new Date(now.getTime() + 30 * 86400_000) ? 'missing' : null)
      if (!kind) continue
      const key = `${kind}:${e.seriesId ?? e.id}`
      const g = groups.get(key) ?? { kind, first: e, count: 0, missing: new Set<string>() }
      g.count++
      gaps.forEach(m => g.missing.add(m))
      groups.set(key, g)
    }
    for (const g of groups.values()) {
      const more = g.count > 1 ? ` (and ${g.count - 1} more ${g.count === 2 ? 'date' : 'dates'})` : ''
      needs.push(g.kind === 'draft'
        ? { kind: 'draft', tone: 'warning', title: `${g.first.name} is a draft`, detail: `${fmtDay(g.first)}${more} · dancers can’t see it until you publish it.`, to: `/business/events/${g.first.id}` }
        : { kind: 'missing', tone: 'warning', title: `${g.first.name} is missing details`, detail: `${fmtDay(g.first)}${more} · add ${[...g.missing].join(', ')}.`, to: `/business/events/${g.first.id}` })
    }

    // Line-ups I'm in, run by someone else (artist profiles I manage).
    const myArtists = mine.filter((p: any) => p.type === 'artist').map((p: any) => p.username)
    const gigs = myArtists.length
      ? await ctx.db.select({ ...listColumns, organizerName: events.organizerName }).from(events)
        .where(and(
          eq(events.published, true), eq(events.archived, false), gte(events.endDate, now), lt(events.startDate, in60),
          or(...myArtists.map((h: string) => sql`${events.artists} @> ${JSON.stringify([h])}::jsonb`)),
        ))
        .orderBy(asc(events.startDate)).limit(50)
      : []
    const mineIds = new Set(mine.map((p: any) => p.id))
    const othersGigs = gigs.filter((g: any) => !mineIds.has(g.hostProfileId))

    const comingUp = [
      ...hosted.map((e: any) => ({ id: e.id, name: e.name, startDate: e.startDate, timezone: e.timezone, published: e.published, role: 'host' as const, to: `/business/events/${e.id}`, missing: checks.get(e.id) ?? [] })),
      ...othersGigs.map((g: any) => ({ id: g.id, name: g.name, startDate: g.startDate, timezone: g.timezone, published: true, role: 'lineup' as const, to: `/events/${g.id}`, missing: [] as string[] })),
    ]
      .filter(e => new Date(e.startDate) < in14)
      .sort((a, b) => +new Date(a.startDate) - +new Date(b.startDate))

    return { profiles: mine, needs, comingUp, lineupCount: othersGigs.length }
  }),
})

// The host block every list row carries (name for display, handle for links).
function hostSummary(p: any) {
  return p ? { username: p.username, name: p.name, type: p.type } : null
}
