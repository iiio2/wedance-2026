/**
 * Move the hardcoded festivals (app/data/mock-*.ts) into the database as
 * events (ADR-006): the festival becomes an event with `festival` details
 * (logo, colour, links, practical info, passes, programme, videos), its
 * teachers become artist profiles in the line-up, and its organizer (from the
 * festival's Instagram) its host. After this the festival page reads only the
 * database and the editor can change everything.
 *
 * Keeps what dancers' data hangs on: the festival key (its old slug) and every
 * workshop id (picks are stored as `<key>:<workshop id>`).
 *
 * Safe to re-run: a festival already imported (same key) is left alone — its
 * organizers may have edited it since — unless --refresh is passed, which
 * overwrites it from the files again. An
 * existing artist profile is reused (same Instagram, else same name) and only
 * its empty fields are filled. A synced event for the same festival (same
 * first day, same first word) is adopted rather than duplicated.
 *
 *   DATABASE_URL=… [NEON_FETCH_ENDPOINT=…] bun scripts/import-festivals.ts [--write]
 *
 * Rollback: delete events where source = 'wedance-festival' (adopted synced
 * events: set festival = null), and profiles where source_ref->>'source' = 'festival-import'.
 */
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq, sql } from 'drizzle-orm'
import * as schema from '../server/database/schema'
import { events, profiles } from '../server/database/schema'
import { zonedToUtc, eventLocalDate } from '../shared/utils/eventTime'
import { parseInstagramHandle, handleFromInstagram, nameFromInstagram, instagramUrl } from '../shared/utils/instagram'
import type { FestivalDetails, FestivalSession } from '../shared/types/festivalDetails'
import * as salsaOpen from '../app/data/mock-festival'
import * as meneate from '../app/data/mock-meneate'
import * as cubanFire from '../app/data/mock-cuban-fire'
import * as caribbeanUrbanFire from '../app/data/mock-caribbean-urban-fire'
import * as aguaPichi from '../app/data/mock-agua-pichi'
import { liteFestivals } from '../app/data/mock-festivals-lite'

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL.')
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT
const db = drizzle(neon(process.env.DATABASE_URL), { schema })
const write = process.argv.includes('--write')
const refresh = process.argv.includes('--refresh')

type Mock = { mockFestival: any; mockWorkshops: any[]; mockTeachers: any[] }
const FESTIVALS: { key: string; festival: any; workshops: any[]; teachers: any[] }[] = [
  ...([['salsa-open-berlin-2026', salsaOpen], ['meneate-viena-2026', meneate], ['cuban-fire-munich-2026', cubanFire],
    ['caribbean-urban-fire-munich-2026', caribbeanUrbanFire], ['agua-pichi-2027', aguaPichi]] as [string, Mock][])
    .map(([key, m]) => ({ key, festival: m.mockFestival, workshops: m.mockWorkshops, teachers: m.mockTeachers })),
  ...Object.entries(liteFestivals).map(([key, v]) => ({ key, ...v })),
  // Charanga Habanera had its own hand-built page (app/pages/festivals/charanga-habanera-munich-2026.vue).
  {
    key: 'charanga-habanera-munich-2026',
    festival: {
      name: 'David Calzado & Charanga Habanera in Munich',
      startDate: '2026-05-23',
      endDate: '2026-05-23',
      description: 'Una sola noche. La banda de timba más viva de Cuba — en directo.\n\nDavid Calzado y La Charanga Habanera — one of the defining bands of contemporary Cuban timba — is bringing the floor to La Rumba Latin Club for a single Munich date. Expect the original lineup, the original sound, and a room built for dancing.\n\nDoors at 19:00. Show starts shortly after. La Rumba is a 450-capacity dance club — once tickets sell out, the door is closed.',
      logo: '',
      accentColor: '',
      socialLinks: [],
      venue: { name: 'La Rumba Latin Club', address: 'Munich', coordinates: { lat: 0, lng: 0 }, practicalInfo: ['Doors at 19:00, show starts shortly after', 'Capacity 450 · dance floor venue', 'Live pricing on TicketTailor: the tiers move as the date approaches', 'Already bought? Claim your spot at /charanga/claim'] },
      ticketUrl: 'https://www.tickettailor.com/checkout/view-event/id/8158745/chk/f2b9/',
      tickets: [
        { name: 'Super Early Bird', price: 55, days: [], soldOut: true },
        { name: 'Early Bird', price: 60, days: [], soldOut: true },
        { name: 'Late Bird', price: 65, days: [] },
        { name: 'Regular', price: 70, days: [] },
        { name: 'Group of 5', price: 219, days: [], description: '€43.80 per person' },
      ],
    },
    teachers: [{ id: 'charanga', name: 'David Calzado y La Charanga Habanera', photo: '', bio: 'One of the defining bands of contemporary Cuban timba.', styles: ['Timba'], socialLinks: [] }],
    workshops: [{ id: 'concert', title: 'David Calzado y La Charanga Habanera — Live Concert', time: '19:00', duration: 240, day: 'Saturday', room: '', style: 'Timba', level: 'Beginner', teacherId: 'charanga', type: 'party' }],
  },
]

// Demo content, not real festivals (placeholder photos, invented teachers and
// numbers): imported so their cards still open, but no artist or organizer
// profiles are created for people who don't exist.
const DEMO = new Set(['salsa-open-berlin-2026', ...Object.keys(liteFestivals)])
// An Instagram in the files that belongs to an existing profile under another
// handle (DJ Alösha's Threads handle → his teacher profile).
const IG_ALIAS: Record<string, { ig: string; name: string }> = { alosha_timba_munich: { ig: 'alosha_corazon_cubano', name: 'Alösha' } }

const ZONES: [RegExp, string, string][] = [
  [/la rumba latin club/i, 'Europe/Berlin', 'Munich'],
  [/vien|wien/i, 'Europe/Vienna', 'Vienna'], [/barcelona/i, 'Europe/Madrid', 'Barcelona'], [/london/i, 'Europe/London', 'London'],
  [/prague|praha/i, 'Europe/Prague', 'Prague'], [/berlin/i, 'Europe/Berlin', 'Berlin'], [/munich|münchen/i, 'Europe/Berlin', 'Munich'],
]
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const igOf = (links: { platform: string; url: string }[] = []) => {
  const url = links.find(l => l.platform === 'instagram')?.url
  return url ? parseInstagramHandle(url) : null
}
const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
const log = (...a: unknown[]) => console.log(...a)

async function freeUsername(base: string) {
  let u = base || 'artist'
  for (let n = 2; ; n++) {
    const [taken] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, u))
    if (!taken) return u
    u = `${base}-${n}`
  }
}

/** An artist or organizer profile: same Instagram, else same name and type; else a new unclaimed one. */
async function profileFor(p: { type: 'artist' | 'organizer'; name: string; ig: string | null; sharedIg?: boolean; photo?: string; bio?: string; styles?: string[]; socials?: { platform: string; url: string }[]; key: string }) {
  if (p.ig && IG_ALIAS[p.ig]) p = { ...p, ...IG_ALIAS[p.ig] }
  // A couple's shared account ("alexei.emilia") isn't one person: match those by name.
  const byIg = p.ig && !p.sharedIg
    ? (await db.select().from(profiles).where(sql`${profiles.socials}::text ~* ${`instagram\\.com/${p.ig.replace(/\./g, '\\.')}/?"`}`).limit(1))[0]
    : undefined
  const existing = byIg ?? (await db.select().from(profiles)
    .where(and(eq(profiles.type, p.type), sql`lower(${profiles.name}) = lower(${p.name})`)).limit(1))[0]
  if (existing) {
    // Fill only what's empty, and never touch a claimed profile.
    const fill: Record<string, unknown> = {}
    if (!existing.claimed) {
      // A profile made from an Instagram link is named after the handle
      // ("barbara_jimenez_official"): the festival knows the real name.
      const handleish = (n: string) => n.trim().replace(/^@/, '').toLowerCase()
      if (p.ig && [p.ig, handleFromInstagram(p.ig)].includes(handleish(existing.name)) && !/\(/.test(p.name)) fill.name = p.name
      if (!existing.photo && p.photo) fill.photo = p.photo
      if (!existing.bio && p.bio) fill.bio = p.bio
      if (!(existing.styles ?? []).length && p.styles?.length) fill.styles = p.styles
      if (!(existing.socials ?? []).length && p.socials?.length) fill.socials = p.socials
    }
    if (Object.keys(fill).length && write) await db.update(profiles).set(fill).where(eq(profiles.id, existing.id))
    return { username: existing.username, created: false, filled: Object.keys(fill) }
  }
  const username = await freeUsername(p.ig && !p.sharedIg ? handleFromInstagram(p.ig) : slugify(p.name.replace(/\(.*?\)/g, '')))
  // "Maykel Fonts (target)": a hoped-for booking, not a confirmed artist — kept
  // on the festival's line-up as before, but out of search and the directory.
  const tentative = /\((target|emerging|tbc|tba)\)/i.test(p.name)
  if (write) {
    await db.insert(profiles).values({
      username, type: p.type, name: p.name, photo: p.photo || null, bio: p.bio || null, styles: p.styles ?? [],
      socials: p.socials?.length ? p.socials : (p.ig ? [{ platform: 'instagram', url: instagramUrl(p.ig) }] : []),
      sourceRef: { source: 'festival-import', festival: p.key },
      status: tentative ? 'hidden' : 'visible',
    })
  }
  return { username, created: true, filled: [] as string[] }
}

for (const f of FESTIVALS) {
  const fest = f.festival
  const place = `${fest.venue?.name ?? ''} ${fest.venue?.address ?? ''}`
  const [, tz, city] = ZONES.find(([re]) => re.test(place)) ?? [null, 'Europe/Berlin', null]
  log(`\n▸ ${fest.name} (${f.key}) · ${fest.startDate}–${fest.endDate} · ${city ?? '?'}`)

  // Teachers → artist profiles in the line-up.
  const handleOf = new Map<string, string>()
  const videos: Record<string, string> = {}
  const demo = DEMO.has(f.key)
  const igCount = new Map<string, number>()
  for (const t of f.teachers) { const ig = igOf(t.socialLinks); if (ig) igCount.set(ig, (igCount.get(ig) ?? 0) + 1) }
  for (const t of demo ? [] : f.teachers) {
    const ig = igOf(t.socialLinks)
    const r = await profileFor({ type: 'artist', name: t.name, ig, sharedIg: !!ig && (igCount.get(ig) ?? 0) > 1, photo: t.photo, bio: t.bio, styles: t.styles, socials: t.socialLinks, key: f.key })
    handleOf.set(t.id, r.username)
    if (t.videoUrl) videos[r.username] = t.videoUrl
    log(`  artist ${t.name} → @${r.username}${r.created ? ' (new)' : r.filled.length ? ` (filled ${r.filled.join(', ')})` : ''}`)
  }

  // Organizer → host, from the festival's Instagram.
  const orgIg = igOf(fest.socialLinks)
  if (demo) log('  demo content: no artist or organizer profiles')
  const host = orgIg && !demo ? await profileFor({ type: 'organizer', name: nameFromInstagram(orgIg), ig: orgIg, key: f.key }) : null
  if (host) log(`  organizer → @${host.username}${host.created ? ' (new)' : ''}`)

  // Workshops and parties → the programme, each on its date (weekday within the festival).
  const days: string[] = []
  for (let d = new Date(`${fest.startDate}T12:00:00Z`); d <= new Date(`${fest.endDate}T12:00:00Z`); d = new Date(d.getTime() + 86400_000)) days.push(d.toISOString().slice(0, 10))
  const dateOf = (weekday: string) => days.find(d => WEEKDAYS[new Date(`${d}T12:00:00Z`).getUTCDay()] === weekday) ?? days[0]!
  // A couple sharing one Instagram account teaches together: a session of one lists the other.
  const partnersOf = (teacherId: string) => {
    const t = f.teachers.find((x: any) => x.id === teacherId)
    const ig = t ? igOf(t.socialLinks) : null
    if (!ig || (igCount.get(ig) ?? 0) < 2) return []
    return f.teachers.filter((x: any) => x.id !== teacherId && igOf(x.socialLinks) === ig).map((x: any) => handleOf.get(x.id)).filter(Boolean) as string[]
  }
  const sessions: FestivalSession[] = f.workshops.map((w: any) => ({
    id: w.id, date: dateOf(w.day), time: w.time, duration: w.duration ?? 60, type: w.type === 'party' ? 'party' : 'workshop',
    title: w.title, artist: handleOf.get(w.teacherId) ?? '', style: w.style ?? '', level: w.level ?? 'Beginner',
    ...(partnersOf(w.teacherId).length ? { with: partnersOf(w.teacherId) } : {}),
    ...(w.room ? { room: w.room } : {}), ...(w.venue ? { venue: w.venue } : {}), ...(w.description ? { description: w.description } : {}),
  }))
  const firstTime = sessions.filter(s => s.date === days[0]).map(s => s.time).sort()[0] ?? '12:00'

  const details: FestivalDetails = {
    key: f.key,
    logo: fest.logo || undefined,
    accentColor: fest.accentColor || undefined,
    socialLinks: fest.socialLinks ?? [],
    practicalInfo: fest.venue?.practicalInfo ?? [],
    passes: fest.tickets ?? [],
    sessions,
    videos,
  }
  const coords = fest.venue?.coordinates
  const row = {
    name: fest.name,
    type: 'Festival',
    isFestival: true,
    description: fest.description ?? '',
    cover: fest.logo && !/ui-avatars/.test(fest.logo) ? fest.logo : '',
    startDate: zonedToUtc(fest.startDate, firstTime, tz),
    endDate: zonedToUtc(fest.endDate, '23:59', tz),
    timezone: tz,
    city,
    citySlug: city ? slugify(city) : null,
    venueName: fest.venue?.name ?? null,
    venueAddress: fest.venue?.address ?? null,
    venueLat: coords?.lat || null,
    venueLng: coords?.lng || null,
    ticketUrl: fest.ticketUrl ?? null,
    styles: [...new Set(f.teachers.flatMap((t: any) => t.styles ?? []))].slice(0, 12) as string[],
    artists: [...new Set(handleOf.values())],
    organizerUsername: host?.username ?? null,
    published: true,
    archived: false,
    festival: details,
    editedAt: new Date(),
    updatedAt: new Date(),
  }

  // Already imported? Else a synced event for the same festival (same first day, same first word)?
  const [mine] = await db.select({ id: events.id }).from(events).where(sql`${events.festival}->>'key' = ${f.key}`)
  if (mine && !refresh) { log('  already imported: left as it is (--refresh overwrites it)'); continue }
  const word = slugify(fest.name).split('-')[0]
  const adopt = mine ? null : (await db.select({ id: events.id, name: events.name, startDate: events.startDate, timezone: events.timezone }).from(events)
    .where(and(eq(events.isFestival, true), sql`${events.festival} is null`))).find(e => e.startDate && eventLocalDate(e.startDate, e.timezone || tz) === fest.startDate && slugify(e.name ?? '').split('-')[0] === word)
  const hostId = host ? (await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, host.username)))[0]?.id ?? null : null

  log(`  ${sessions.length} sessions · ${details.passes?.length ?? 0} passes · ${mine ? 'update the imported event' : adopt ? `adopt synced event "${adopt.name}"` : 'new event'}`)
  if (!write) continue
  if (mine || adopt) {
    await db.update(events).set({ ...row, hostProfileId: hostId ?? undefined }).where(eq(events.id, (mine ?? adopt)!.id))
  } else {
    await db.insert(events).values({ ...row, hostProfileId: hostId, source: 'wedance-festival', sourceId: f.key, slug: f.key })
  }
}
log(write ? '\nDone.' : '\nDry run. Re-run with --write to save.')
