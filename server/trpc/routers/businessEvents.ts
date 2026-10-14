import { z } from 'zod'
import { eq, and, or, gte, lt, inArray, desc, asc, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, publicProcedure } from '../trpc'
import { events, profiles, profileMembers, profileClaims, cities, profileSuggestions, bookingInquiries } from '../../database/schema'
import { slugify, randomSuffix } from '../../utils/slug'
import { resolveTimezone } from '../../utils/v3EventSync'
import { zonedToUtc, eventLocalDate, eventLocalTime, eventLocalWeekday } from '../../../shared/utils/eventTime'
import { requireMember, linksInstagram } from './business'
import { parseInstagramHandle, handleFromInstagram, instagramUrl } from '../../../shared/utils/instagram'
import { joinRequestsForOwner } from './businessTeam'
import { eventPath } from '../../../shared/utils/eventSlug'
import { flyerStatusFor } from '../../utils/flyer/paint'
import { asksWaitingFor } from './venueAsks'

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

const ymdStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const text = (max: number) => z.string().trim().max(max)
const festivalInput = z.object({
  logo: z.string().url().or(z.literal('')).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).or(z.literal('')).optional(),
  socialLinks: z.array(z.object({ platform: text(20), url: z.string().url() })).max(10).default([]),
  practicalInfo: z.array(text(300)).max(30).default([]),
  passes: z.array(z.object({
    name: text(80).min(1, 'Name every pass.'),
    price: z.number().min(0).max(100000),
    days: z.array(text(12)).max(14).default([]),
    description: text(300).optional(),
    soldOut: z.boolean().optional(),
    workshopCount: z.number().int().min(0).max(100).optional(),
    includesParty: z.boolean().optional(),
  })).max(30).default([]),
  sessions: z.array(z.object({
    id: z.string().trim().min(1).max(60),
    date: ymdStr,
    time: z.string().regex(/^\d{2}:\d{2}$/, 'Give every session a time.'),
    duration: z.number().int().min(5).max(1440),
    type: z.enum(['workshop', 'party']),
    title: text(160).min(1, 'Give every session a title.'),
    artist: text(200).default(''),
    with: z.array(text(200)).max(6).optional(),
    style: text(40).default(''),
    level: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Beginner'),
    room: text(60).optional(),
    venue: text(200).optional(),
    description: text(1000).optional(),
  })).max(300).default([]),
  videos: z.record(z.string(), z.string().url()).default({}),
})
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
  // One price per line ("Workshops free\nFrom 21:00 · 10€").
  price: z.string().max(400).default(''),
  published: z.boolean().default(false),
  agenda: z.array(z.object({ time: z.string().trim().max(20), what: z.string().trim().max(160) })).max(20).default([]),
  // Which photo of each artist the flyer uses: a URL, or null for name only.
  flyerOptions: z.object({
    showAgenda: z.boolean().optional(),
    photos: z.record(z.string(), z.string().url().nullable()).optional(),
    // How this event names an artist (suggested to their profile until they approve).
    names: z.record(z.string(), z.string().trim().min(1).max(120)).optional(),
  }).default({}),
  // A festival's page (logo, links, passes, programme…); null for an ordinary
  // event. Its permanent key is set by the server, never by the form.
  festival: festivalInput.nullable().optional(),
})
type EventInput = z.infer<typeof eventInput>

async function profilesIManage(ctx: { db: any; dancerId: string }) {
  return ctx.db
    .select({ id: profiles.id, username: profiles.username, name: profiles.name, type: profiles.type })
    .from(profileMembers)
    .innerJoin(profiles, eq(profiles.id, profileMembers.profileId))
    .where(eq(profileMembers.dancerId, ctx.dancerId))
}

// The profile that runs an event: its host; for a synced event (no host yet),
// its organizer's profile on WeDance, else its venue's.
export async function eventHostProfile(db: any, ev: any): Promise<{ id: string; username: string; type: string; name: string } | null> {
  const cols = { id: profiles.id, username: profiles.username, type: profiles.type, name: profiles.name }
  if (ev.hostProfileId) {
    const [h] = await db.select(cols).from(profiles).where(eq(profiles.id, ev.hostProfileId))
    return h ?? null
  }
  const handles = [ev.organizerUsername, ev.venueUsername].filter(Boolean) as string[]
  if (!handles.length) return null
  const rows = await db.select(cols).from(profiles).where(inArray(profiles.username, handles))
  return rows.find((r: any) => r.username === ev.organizerUsername) ?? rows.find((r: any) => r.username === ev.venueUsername) ?? null
}

// Every event is editable. A hosted event: by its host's managers. A synced
// event: by the managers of its organizer's or venue's profile. Admins: any.
export async function requireEventManager(ctx: { db: any; dancerId: string; isAdmin?: boolean }, id: string) {
  const [ev] = await ctx.db.select().from(events).where(eq(events.id, id))
  if (!ev) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found.' })
  if (ctx.isAdmin) return ev
  const handles = [ev.organizerUsername, ev.venueUsername].filter(Boolean) as string[]
  const candidates: string[] = ev.hostProfileId
    ? [ev.hostProfileId]
    : handles.length
      ? (await ctx.db.select({ id: profiles.id }).from(profiles).where(inArray(profiles.username, handles))).map((p: any) => p.id)
      : []
  const [m] = candidates.length
    ? await ctx.db.select({ id: profileMembers.id }).from(profileMembers)
      .where(and(inArray(profileMembers.profileId, candidates), eq(profileMembers.dancerId, ctx.dancerId)))
    : []
  if (!m) throw new TRPCError({ code: 'FORBIDDEN', message: 'You don’t manage this event. Its organizer or venue can edit it, or a WeDance admin.' })
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
async function toRow(db: any, host: { username: string; type: string } | null, input: EventInput, existing?: any) {
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
    venueUsername: venue?.username ?? (host?.type === 'venue' && !input.venueName ? host.username : null),
    venueName: venue?.name ?? input.venueName ?? null,
    venueAddress: venue?.address ?? input.venueAddress ?? null,
    // A synced event keeps its organizer when the editor isn't it (an admin, the venue).
    organizerUsername: host?.type === 'organizer' ? host.username : (existing?.organizerUsername ?? null),
    artists: input.artists,
    styles: input.styles,
    description: input.description,
    cover: input.cover ?? '',
    ticketUrl: input.ticketUrl ?? null,
    price: input.price,
    published: input.published,
    agenda: input.agenda.filter(a => a.what),
    flyerOptions: input.flyerOptions,
    // The event's details (programme by day, passes, practical info; for
    // festivals also logo, colour, links), for every type: the key stays
    // (dancers' plans and picks hang on it).
    ...(input.festival !== undefined
      ? { festival: input.festival ? { ...input.festival, key: existing?.festival?.key ?? existing?.slug ?? null } : (existing?.festival ?? null) }
      : {}),
    // A hosted event keeps its archive state on save (Restore brings it back);
    // a new or synced event is live.
    archived: existing?.hostProfileId ? !!existing.archived : false,
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
  // What a flyer is made from (flyerStatusFor).
  venueAddress: events.venueAddress, styles: events.styles, agenda: events.agenda, flyerOptions: events.flyerOptions,
}

export const businessEventsRouter = router({
  // Events of the profiles I manage (optionally one), newest-relevant first.
  list: protectedProcedure
    .input(z.object({ profile: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const mine = await profilesIManage(ctx)
      const scope = input?.profile ? mine.filter((p: any) => p.username === input.profile) : mine
      if (!scope.length) return { upcoming: [], drafts: [], past: [], archived: [] }
      const byId = new Map(scope.map((p: any) => [p.id, p]))
      const ids = scope.map((p: any) => p.id)
      const rows = await ctx.db.select(listColumns).from(events)
        .where(and(inArray(events.hostProfileId, ids), eq(events.archived, false)))
        .orderBy(asc(events.startDate)).limit(500)
      // Archived: the latest 50, newest first; Restore brings one back as a draft.
      const gone = await ctx.db.select(listColumns).from(events)
        .where(and(inArray(events.hostProfileId, ids), eq(events.archived, true)))
        .orderBy(desc(events.updatedAt)).limit(50)
      const checks = await checklistFor(ctx.db, rows)
      const now = Date.now()
      const shape = (e: any) => ({ ...e, host: hostSummary(byId.get(e.hostProfileId)), missing: checks.get(e.id) ?? [] })
      const shaped = rows.map(shape)
      const ahead = (e: any) => new Date(e.endDate ?? e.startDate).getTime() >= now
      return {
        // Upcoming and past: published. Drafts: not published yet, any date.
        upcoming: shaped.filter((e: any) => e.published && ahead(e)),
        drafts: shaped.filter((e: any) => !e.published),
        past: shaped.filter((e: any) => e.published && !ahead(e)).reverse().slice(0, 30),
        archived: gone.map((e: any) => ({ ...e, host: hostSummary(byId.get(e.hostProfileId)), missing: [] })),
      }
    }),

  // For the public event page: may the viewer edit this event? Same rule as
  // requireEventManager (hosted events only; host's managers or an admin).
  canEdit: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      if (!ctx.dancerId) return { canEdit: false }
      try {
        await requireEventManager({ ...ctx, dancerId: ctx.dancerId }, input.id)
        return { canEdit: true }
      } catch {
        return { canEdit: false }
      }
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.id)
      const host = await eventHostProfile(ctx.db, ev)
      const [venue] = ev.venueUsername
        ? await ctx.db.select({ name: profiles.name, address: profiles.address }).from(profiles).where(eq(profiles.username, ev.venueUsername))
        : [null]
      const tz = ev.timezone || 'Europe/Berlin'
      const end = ev.endDate ? new Date(ev.endDate) : null
      const sameDay = !end || eventLocalDate(end, tz) === eventLocalDate(ev.startDate, tz)
        // A night that ends before noon the next day reads as one date with an end time.
        || (end.getTime() - new Date(ev.startDate).getTime() < 18 * 3600_000)
      return {
        id: ev.id,
        host: host ? { username: host.username, name: host.name, type: host.type } : null,
        // Synced from wedance.vip and not saved here yet: the first save takes it over.
        synced: !ev.hostProfileId,
        archived: !!ev.archived,
        editedAt: ev.editedAt as Date | null,
        name: ev.name ?? '',
        type: (EVENT_TYPES as readonly string[]).includes(ev.type) ? ev.type : 'Party',
        date: eventLocalDate(ev.startDate, tz),
        startTime: eventLocalTime(ev.startDate, tz),
        endTime: end ? eventLocalTime(end, tz) : null,
        endDate: end && !sameDay ? eventLocalDate(end, tz) : null,
        city: ev.city ?? '',
        venueUsername: ev.venueUsername,
        // A venue on WeDance: its current name and address, not the copy made at save.
        venueName: venue?.name || ev.venueName || '',
        venueAddress: venue?.address || ev.venueAddress || '',
        artists: ev.artists ?? [],
        styles: ev.styles ?? [],
        description: ev.description ?? '',
        cover: ev.cover || null,
        ticketUrl: ev.ticketUrl,
        price: ev.price ?? '',
        published: ev.published,
        agenda: (ev.agenda ?? []) as { time: string; what: string }[],
        flyerOptions: (ev.flyerOptions ?? {}) as { showAgenda?: boolean; photos?: Record<string, string | null>; names?: Record<string, string> },
        festival: (ev.festival ?? null) as import('../../../shared/types/festivalDetails').FestivalDetails | null,
        timezone: tz,
        missing: (await checklistFor(ctx.db, [ev])).get(ev.id) ?? [],
      }
    }),

  create: protectedProcedure
    .input(eventInput.extend({ hostUsername: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const host = await requireMember(ctx, input.hostUsername)
      const row = await toRow(ctx.db, host, input)
      const slug = `${slugify(input.name)}-${randomSuffix(5)}`
      const [ev] = await ctx.db.insert(events)
        // A new festival's permanent key is its first slug.
        .values({ ...row, hostProfileId: host.id, source: 'wedance-business', slug, ...(input.festival ? { festival: { ...input.festival, key: slug } } : {}) })
        .returning({ id: events.id })
      return { id: ev!.id }
    }),

  update: protectedProcedure
    .input(eventInput.extend({ id: z.string().uuid(), hostUsername: z.string().min(1).optional() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.id)
      let host: { id: string; username: string; type: string; name: string } | null
      let hostProfileId: string | null
      if (input.hostUsername) {
        // Switching host: the caller must manage the target profile too.
        const newHost = await requireMember(ctx, input.hostUsername)
        host = { id: newHost.id, username: newHost.username, type: newHost.type, name: newHost.name }
        hostProfileId = newHost.id
      } else {
        host = await eventHostProfile(ctx.db, ev)
        hostProfileId = ev.hostProfileId ?? host?.id ?? null
      }
      const { id: _id, hostUsername: _hu, ...fields } = input
      await ctx.db.update(events).set({
        ...(await toRow(ctx.db, host, fields, ev)),
        editedAt: new Date(),
        editedBy: ctx.dancerId,
        hostProfileId,
      }).where(eq(events.id, ev.id))
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
          // A caption is written for one date; each copy writes its own.
          caption: null,
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

  // Back from the archive, as a draft: publish it again when it's ready.
  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.id)
      if (!ev.hostProfileId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only events run on WeDance can be restored here.' })
      await ctx.db.update(events).set({ archived: false, published: false, updatedAt: new Date() }).where(eq(events.id, ev.id))
      return { restored: true }
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.id)
      await ctx.db.update(events).set({ archived: true, published: false, updatedAt: new Date() }).where(eq(events.id, ev.id))
      return { archived: true }
    }),

  // The line-up's names and photos, for picking each artist's flyer photo.
  lineupPhotos: protectedProcedure
    .input(z.object({ handles: z.array(z.string().min(1).max(200)).max(40) }))
    .query(async ({ ctx, input }) => {
      if (!input.handles.length) return []
      const rows = await ctx.db.select({ username: profiles.username, name: profiles.name, photo: profiles.photo, photos: profiles.photos, styles: profiles.styles })
        .from(profiles).where(inArray(profiles.username, input.handles))
      return rows.map((r: any) => ({
        username: r.username,
        name: r.name,
        styles: (r.styles ?? []) as string[],
        // Main photo first, then the gallery, no duplicates.
        photos: [...new Set([r.photo, ...((r.photos ?? []) as { url: string }[]).map(p => p.url)].filter(Boolean))] as string[],
      }))
    }),

  // Profile picker for venue and line-up fields.
  // Venues to consider for a date, from what WeDance knows: who hosts nights
  // (and which music) in the city over the past year, whether they're free those
  // days, if they host on that weekday, if someone runs their page here, and
  // their bookable spaces. Busy venues stay listed, marked, after the free ones.
  venueIdeas: protectedProcedure
    .input(z.object({
      city: text(120).min(1),
      from: ymdStr,
      to: ymdStr.optional(),
      styles: z.array(text(60)).max(20).default([]),
      exceptId: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(40).default(8),
    }))
    .query(async ({ ctx, input }) => {
      const loc = await cityInfo(ctx.db, input.city)
      const last = input.to && input.to >= input.from ? input.to : input.from
      const tz = loc.timezone
      // Local days → weekday names (Thursday…), for "hosts on Thursdays".
      const weekdays: string[] = []
      for (let d = new Date(`${input.from}T12:00:00Z`); d <= new Date(`${last}T12:00:00Z`) && weekdays.length < 7; d = new Date(d.getTime() + 86400_000))
        weekdays.push(d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }))
      const styles = JSON.stringify(input.styles)
      const res: any = await ctx.db.execute(sql`
        with ev as (
          select e.id, e.name, e.type, e.styles, e.start_date, coalesce(e.end_date, e.start_date) as end_date, e.venue_username,
                 -- Stored as UTC without a zone: read it as UTC, then the city's wall clock.
                 trim(to_char(e.start_date at time zone 'UTC' at time zone ${tz}, 'Day')) as weekday,
                 (e.start_date at time zone 'UTC' at time zone ${tz})::date as day,
                 e.type in ('Course', 'Workshop') as is_class
          from events e
          where e.city_slug = ${loc.citySlug} and e.venue_username is not null and e.published and not e.archived
            and e.start_date > now() - interval '12 months' and e.start_date < now() + interval '9 months'
            ${input.exceptId ? sql`and e.id <> ${input.exceptId}` : sql``}
        ),
        stats as (
          select venue_username,
            count(*) filter (where type not in ('Course', 'Workshop')) as nights,
            count(*) filter (where type in ('Course', 'Workshop')) as classes,
            count(*) filter (where type not in ('Course', 'Workshop') and styles::jsonb ?| array(select jsonb_array_elements_text(${styles}::jsonb))) as style_nights,
            count(*) filter (where type not in ('Course', 'Workshop') and weekday in (select jsonb_array_elements_text(${JSON.stringify(weekdays)}::jsonb))) as weekday_nights,
            (select jsonb_agg(x) from (select distinct jsonb_array_elements_text(s2.styles::jsonb) x from ev s2 where s2.venue_username = ev.venue_username and s2.type not in ('Course', 'Workshop')) t) as night_styles,
            -- Taken: a night there on those days. Classes don't take the evening, they're counted.
            jsonb_agg(jsonb_build_object('name', name, 'type', type, 'start', to_char(start_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')) order by start_date)
              filter (where not is_class and day between ${input.from}::date and ${last}::date) as busy,
            count(*) filter (where is_class and day between ${input.from}::date and ${last}::date) as classes_then
          from ev group by venue_username
        )
        select p.username, p.name, p.photo, p.address, p.floor_type as "floorType", p.claimed, p.booking_model as "bookingModel",
          p.capacity, p.venue_type as "venueType", p.amenities,
          coalesce(st.nights, 0)::int as nights, coalesce(st.classes, 0)::int as classes,
          coalesce(st.style_nights, 0)::int as "styleNights", coalesce(st.weekday_nights, 0)::int as "weekdayNights",
          coalesce(st.night_styles, '[]'::jsonb) as "nightStyles", coalesce(st.busy, '[]'::jsonb) as busy,
          coalesce(st.classes_then, 0)::int as "classesThen",
          exists (select 1 from profile_members m where m.profile_id = p.id) as managed,
          (select jsonb_agg(jsonb_build_object('name', b.name, 'capacity', b.capacity, 'priceInfo', b.price_info) order by b.sort_order) from bookable_spaces b where b.profile_id = p.id) as spaces
        from profiles p
        left join stats st on st.venue_username = p.username
        -- In the city by its page or by its events (many synced pages have no city).
        where p.type = 'venue' and p.status = 'visible' and p.venue_type is distinct from 'Closed'
          and (st.venue_username is not null or (p.city_slug = ${loc.citySlug} and ( exists (select 1 from profile_members m where m.profile_id = p.id) or exists (select 1 from bookable_spaces b where b.profile_id = p.id))))
      `)
      const rows: any[] = res.rows ?? res
      const score = (v: any) => (v.busy.length ? -1000 : 0) + v.styleNights * 3 + v.weekdayNights * 2 + v.nights + (v.managed ? 8 : 0) + (v.spaces?.length ? 8 : 0) + Math.min(v.classes, 10) * 0.2
      rows.sort((a, b) => score(b) - score(a) || a.name.localeCompare(b.name))
      return {
        city: loc.city,
        weekdays: [...new Set(weekdays)],
        total: rows.length,
        venues: rows.slice(0, input.limit).map(v => ({
          ...v,
          busy: (v.busy as any[]).map(b => ({ name: b.name, type: b.type, time: eventLocalTime(new Date(b.start), tz), day: eventLocalDate(new Date(b.start), tz) })),
          nightStyles: (v.nightStyles as string[]).slice(0, 6),
          spaces: v.spaces ?? [],
        })),
      }
    }),

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
      const handle = parseInstagramHandle(input.instagram)
      if (!handle) throw new TRPCError({ code: 'BAD_REQUEST', message: 'That doesn’t look like an Instagram handle.' })
      const url = instagramUrl(handle)
      // Same Instagram account only — a matching WeDance handle is not proof it's the same person.
      const [existing] = await ctx.db.select({ username: profiles.username, name: profiles.name, type: profiles.type, city: profiles.city, photo: profiles.photo })
        .from(profiles)
        .where(linksInstagram(handle))
        .limit(1)
      if (existing) return existing
      let username = handleFromInstagram(handle)
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

    // Organizers' suggestions waiting on an artist page I manage.
    if (mine.length) {
      const sugg = await ctx.db.select({ username: profiles.username, name: profiles.name, n: sql<number>`count(*)::int` })
        .from(profileSuggestions).innerJoin(profiles, eq(profiles.id, profileSuggestions.profileId))
        .leftJoin(events, eq(events.id, profileSuggestions.eventId))
        .where(and(inArray(profileSuggestions.profileId, mine.map((p: any) => p.id)), eq(profileSuggestions.status, 'pending'), sql`${events.archived} is not true`))
        .groupBy(profiles.username, profiles.name)
      for (const g of sugg) {
        needs.push({ kind: 'suggestions', tone: 'info', title: `${g.n} ${g.n === 1 ? 'change' : 'changes'} suggested for ${g.name}`, detail: 'An organizer added photos, a video or your name for their event. Approve or turn them down.', to: `/confirm/@${g.username}` })
      }
    }

    // People asking to book a page I manage (from its page or its /book link).
    if (mine.length) {
      const asks = await ctx.db.select({ username: profiles.username, name: profiles.name, n: sql<number>`count(*)::int`, first: sql<string>`min(${bookingInquiries.name})` })
        .from(bookingInquiries).innerJoin(profiles, eq(profiles.id, bookingInquiries.profileId))
        .where(and(inArray(bookingInquiries.profileId, mine.map((p: any) => p.id)), eq(bookingInquiries.status, 'new')))
        .groupBy(profiles.username, profiles.name)
      for (const g of asks) {
        needs.push({ kind: 'booking', tone: 'info', title: g.n === 1 ? `${g.first} wants to book ${g.name}` : `${g.n} people want to book ${g.name}`, detail: 'Answer them by email, then mark it answered.', to: `/business/profiles/${g.username}/bookings` })
      }
    }

    // Organizers waiting on a page I manage: a venue asked to host their event,
    // an artist asked to confirm they're in the line-up.
    for (const a of await asksWaitingFor(ctx.db, mine.map((p: any) => p.id))) {
      const tz = a.timezone || 'Europe/Berlin'
      const when = a.startDate ? `${eventLocalWeekday(a.startDate, tz).slice(0, 3)} ${eventLocalDate(a.startDate, tz)} · ` : ''
      needs.push(a.kind === 'venue'
        ? { kind: 'venue-ask', tone: 'info', title: `${a.eventName}: can ${a.profileName} host it?`, detail: `${when}say yes, suggest another date, or no, with your terms.`, to: `/confirm/${a.token}` }
        : { kind: 'lineup-ask', tone: 'info', title: `${a.eventName}: is ${a.profileName} in?`, detail: `${when}you’re in their line-up. Confirm, check your programme and the posts about you.`, to: `/confirm/${a.token}` })
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

    // Flyers: published events in the next 14 days without one, or whose flyer
    // no longer matches the details. One per series, like the items above.
    const soon = hosted.filter((e: any) => e.published && new Date(e.startDate) < in14)
    const flyers = await flyerStatusFor(ctx.db, soon)
    const seenSeries = new Set<string>()
    for (const e of soon) {
      const st = flyers.get(e.id)!
      const key = e.seriesId ?? e.id
      if (seenSeries.has(key)) continue
      if (!st.kept) { seenSeries.add(key); needs.push({ kind: 'flyer', tone: 'info', title: `${e.name} has no flyer yet`, detail: `${fmtDay(e)} · check the details, then make it in about a minute.`, to: `/business/events/${e.id}?flyer=1` }) }
      else if (st.changes.length) { seenSeries.add(key); needs.push({ kind: 'flyer', tone: 'warning', title: `${e.name}: the flyer is out of date`, detail: `${fmtDay(e)} · you changed the details after it was made.`, to: `/business/events/${e.id}` }) }
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
      ...othersGigs.map((g: any) => ({ id: g.id, name: g.name, startDate: g.startDate, timezone: g.timezone, published: true, role: 'lineup' as const, to: eventPath(g), missing: [] as string[] })),
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
