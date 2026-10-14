/**
 * Event flyers, server side: what an event's flyer says and shows right now,
 * and painting one flyer row in the background.
 *
 * paint / direction: a new poster from the look, the artists' photos and every
 * line. fix / refresh: an edit of an existing poster (keeps the picture, changes
 * what was asked or the words). Painted once per click and read back; the check
 * is shown to the organizer, who decides whether to paint again. Recipe and lessons:
 * ~/Orgs/LaClave/assets/flyer-style.md (story first, one photo per person, retries).
 */
import cloudinary from 'cloudinary'
import { eq, and, inArray, isNotNull, desc } from 'drizzle-orm'
import { events, profiles, eventFlyers, eventPosts, brandLooks } from '../../database/schema'
import { postLines, flyerChanges, paintPrompt, fixPrompt, refreshPrompt, recomposePrompt, checkFlyerText, type FlyerLine, type FlyerCheck } from '../../../shared/utils/flyer'
import sharp from 'sharp'
import type { PostKind } from '../../../shared/utils/posts'
import { paintWithRetries, readText, fetchImage, IMAGE_MODEL, type InlineImage } from './gemini'
import { faceGrid } from './grid'
import { withAi } from '../aiUsage'

/**
 * Up to four people go in as their own photos, numbered and named (the
 * image-from-gemini skill's way). More — a festival's line-up — go in as one
 * grid of photos, and every artist is painted as a portrait
 * (server/utils/flyer/grid.ts). 16 at most.
 */
export const MAX_FACES = 4
export const MAX_GRID = 16

type Post = { kind: PostKind; subject?: string | null } | null

/** The event's announcement post (its main flyer): made when first needed. */
export async function announcementPost(db: any, eventId: string): Promise<string> {
  const [p] = await db.select({ id: eventPosts.id }).from(eventPosts).where(and(eq(eventPosts.eventId, eventId), eq(eventPosts.kind, 'announcement'))).limit(1)
  if (p) return p.id
  const [n] = await db.insert(eventPosts).values({ eventId, kind: 'announcement', format: 'story' }).returning({ id: eventPosts.id })
  return n!.id
}

// Who a post pictures: the artist post its artist; flyer, line-up and countdown
// the line-up; the rest (passes, programme, last tickets, thanks) nobody.
const PICTURES: Record<PostKind, 'all' | 'subject' | 'none'> = { announcement: 'all', artist: 'subject', lineup: 'all', countdown: 'all', programme: 'none', passes: 'none', 'last-call': 'none', thanks: 'none' }
const short = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })

/**
 * A flyer as of now — the event's, or a content-plan post's: its lines, who is
 * pictured and with which photo.
 */
export async function flyerSource(db: any, ev: any, post: Post = null) {
  const kind: PostKind = post?.kind ?? 'announcement'
  const handles: string[] = ev.artists ?? []
  const rows = handles.length
    ? await db.select({ username: profiles.username, name: profiles.name, photo: profiles.photo, styles: profiles.styles }).from(profiles).where(inArray(profiles.username, handles))
    : []
  const byHandle = new Map<string, any>(rows.map((r: any) => [r.username, r]))
  const chosen = (ev.flyerOptions?.photos ?? {}) as Record<string, string | null>
  const people = handles.map((h) => {
    const p = byHandle.get(h)
    // Unset = their main photo; null = name only; a URL = the photo picked for this event.
    const photo = h in chosen ? chosen[h] : (p?.photo || null)
    return { username: h, name: ev.flyerOptions?.names?.[h] || (p?.name as string) || h, photo: photo || null }
  })
  // The venue as it is now: a venue on WeDance may have been renamed or got its
  // address after the event copied them.
  const [venue] = ev.venueUsername
    ? await db.select({ name: profiles.name, address: profiles.address }).from(profiles).where(eq(profiles.username, ev.venueUsername))
    : [null]
  const nameOf = (h: string) => people.find(x => x.username === h)?.name ?? h
  const sessions = ((ev.festival?.sessions ?? []) as any[]).slice().sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  const subject = kind === 'artist' && post?.subject ? people.find(x => x.username === post.subject) ?? null : null
  const artist = subject
    ? {
        name: subject.name,
        styles: (byHandle.get(subject.username)?.styles ?? []) as string[],
        sessions: sessions.filter(x => x.artist === subject.username || (x.with ?? []).includes(subject.username))
          .map(x => `${short(x.date)} ${x.time} ${x.title}`),
      }
    : null
  const lines = postLines({
    kind,
    artist,
    passes: ((ev.festival?.passes ?? []) as any[]).filter(x => x.name).map(x => `${x.name} · ${x.price} €`),
    programme: sessions.filter(x => x.type !== 'party').slice(0, 6).map(x => [`${short(x.date)} ${x.time}`, x.title, [x.artist, ...(x.with ?? [])].filter(Boolean).map(nameOf).join(' & ')].filter(Boolean).join(' · ')),
    name: ev.name ?? '',
    startDate: ev.startDate,
    endDate: ev.endDate,
    timezone: ev.timezone,
    venueName: venue?.name || ev.venueName,
    venueAddress: venue?.address || ev.venueAddress,
    agenda: ev.agenda ?? [],
    showAgenda: ev.flyerOptions?.showAgenda !== false,
    artists: people,
    styles: ev.styles ?? [],
    price: ev.price,
  })
  const shown = PICTURES[kind] === 'all' ? people : PICTURES[kind] === 'subject' ? (subject ? [subject] : []) : []
  const faces = shown.filter(p => p.photo)
  return { lines, people, pictured: faces.map(p => p.name), photos: faces.map(p => p.photo as string) }
}

export const texts = (lines: { text: string }[]) => lines.map(l => l.text)

/** Kept flyer + whether it still matches each event. Used by the editor and the home inbox. */
export async function flyerStatusFor(db: any, evs: any[]) {
  const ids = evs.map(e => e.id)
  // The event's flyer = the announcement post's kept version.
  const kept = ids.length
    ? (await db.select({ f: eventFlyers }).from(eventFlyers).innerJoin(eventPosts, eq(eventPosts.id, eventFlyers.postId))
      .where(and(inArray(eventFlyers.eventId, ids), isNotNull(eventFlyers.keptAt), eq(eventPosts.kind, 'announcement')))).map((r: any) => r.f)
    : []
  const byEvent = new Map<string, any>(kept.map((k: any) => [k.eventId, k]))
  const out = new Map<string, { kept: any | null; changes: { was: string | null; now: string | null }[]; source: Awaited<ReturnType<typeof flyerSource>> }>()
  for (const e of evs) {
    const source = await flyerSource(db, e)
    const k = byEvent.get(e.id) ?? null
    const changes = k ? flyerChanges({ lines: texts(k.lines), pictured: k.pictured }, { lines: texts(source.lines), pictured: source.pictured }) : []
    out.set(e.id, { kept: k, changes, source })
  }
  return out
}

/** A post's shape: feed post (4:5) or story (9:16, the event flyer's default). */
async function formatOf(db: any, postId: string | null): Promise<'post' | 'story'> {
  if (!postId) return 'story'
  const [p] = await db.select({ format: eventPosts.format }).from(eventPosts).where(eq(eventPosts.id, postId))
  return p?.format === 'post' ? 'post' : 'story'
}

// Instagram's exact sizes: Gemini returns near-sizes (768×1376, 928×1152).
const SIZE = { '9:16': { width: 1080, height: 1920 }, '4:5': { width: 1080, height: 1350 } } as const

async function upload(img: InlineImage, folder: string, aspect: '9:16' | '4:5') {
  const config = useRuntimeConfig()
  cloudinary.v2.config({ cloud_name: config.public.cloudinaryCloudName, api_key: config.cloudinaryApiKey, api_secret: config.cloudinaryApiSecret })
  const fitted = await sharp(Buffer.from(img.data, 'base64')).resize({ ...SIZE[aspect], fit: 'cover', position: 'centre' }).png().toBuffer()
  // Data URI, not a file path: Bun's file uploads to Cloudinary fail.
  const res = await cloudinary.v2.uploader.upload(`data:image/png;base64,${fitted.toString('base64')}`, { folder: `wedance-2026/flyers/${folder}` })
  return { url: res.secure_url as string, width: res.width as number, height: res.height as number }
}

/**
 * The style's reference flyer (image 1 of a painting): a flyer painted and
 * kept in that look, else one it was read from. Directions and fresh ideas
 * have none.
 */
async function styleReference(db: any, f: any): Promise<string | null> {
  const look = f.look as { references?: string[] }
  if (look?.references?.[0]) return look.references[0]
  if (!f.lookId) return null
  const [kept] = await db.select({ url: eventFlyers.url }).from(eventFlyers)
    .where(and(eq(eventFlyers.lookId, f.lookId), isNotNull(eventFlyers.keptAt), isNotNull(eventFlyers.url))).orderBy(desc(eventFlyers.keptAt)).limit(1)
  if (kept?.url) return kept.url
  const [l] = await db.select({ references: brandLooks.references }).from(brandLooks).where(eq(brandLooks.id, f.lookId))
  return (l?.references as { url: string }[] | undefined)?.[0]?.url ?? null
}

/** Paint one flyer row (status 'painting') and store the best round. Never throws. */
export async function runFlyer(db: any, flyerId: string) {
  const [f] = await db.select().from(eventFlyers).where(eq(eventFlyers.id, flyerId))
  if (!f) return
  // The AI usage log: this flyer, its event, who asked, and what kind of painting.
  return withAi({ eventId: f.eventId, flyerId, dancerId: f.createdBy, label: f.mode }, () => paintRow(db, f, flyerId))
}

async function paintRow(db: any, f: any, flyerId: string) {
  const set = (v: Record<string, unknown>) => db.update(eventFlyers).set({ ...v, updatedAt: new Date() }).where(eq(eventFlyers.id, flyerId))
  // Stopped by the organizer meanwhile: spend nothing more on it.
  const stopped = async () => (await db.select({ status: eventFlyers.status }).from(eventFlyers).where(eq(eventFlyers.id, flyerId)))[0]?.status === 'stopped'
  try {
    const [ev] = await db.select().from(events).where(eq(events.id, f.eventId))
    const [host] = ev?.hostProfileId ? await db.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, ev.hostProfileId)) : [null]
    const lines = f.lines as FlyerLine[]
    const look = f.look as { description: string; palette?: any[]; inspiration?: string | null }

    let prompt: string
    let images: InlineImage[]
    // A new painting is always a 9:16 story; the 4:5 post is recomposed from it.
    let aspect: '9:16' | '4:5' = '9:16'
    if (f.mode === 'fix' || f.mode === 'refresh' || f.mode === 'recompose') {
      const [base] = await db.select({ url: eventFlyers.url, width: eventFlyers.width, height: eventFlyers.height }).from(eventFlyers).where(eq(eventFlyers.id, f.baseFlyerId))
      const img = base?.url ? await fetchImage(base.url) : null
      if (!img) throw new Error('The flyer to change is gone. Make a new one instead.')
      prompt = f.mode === 'fix' ? fixPrompt(lines, f.notes ?? '') : f.mode === 'refresh' ? refreshPrompt(lines) : recomposePrompt(lines)
      images = [img]
      // An edit keeps its shape; a recompose makes the feed post.
      aspect = f.mode === 'recompose' || (base.width && base.height && base.height / base.width < 1.5) ? '4:5' : '9:16'
    } else {
      const [post] = f.postId ? await db.select({ kind: eventPosts.kind, subject: eventPosts.subject }).from(eventPosts).where(eq(eventPosts.id, f.postId)) : [null]
      const src = await flyerSource(db, ev, post)
      const many = src.photos.length > MAX_FACES
      // A couple on one photo is one tile with both names.
      const tiles: { url: string; name: string }[] = []
      src.photos.forEach((url, i) => {
        const t = tiles.find(x => x.url === url)
        if (t) t.name = `${t.name} & ${src.pictured[i]}`
        else tiles.push({ url, name: src.pictured[i]! })
      })
      const loaded = await Promise.all(tiles.slice(0, many ? MAX_GRID : MAX_FACES).map(t => fetchImage(t.url)))
      const ok = loaded.map((img, i) => ({ img, name: tiles[i]!.name })).filter(x => x.img) as { img: InlineImage; name: string }[]
      const grid = many && ok.length > MAX_FACES ? await faceGrid(ok.map(x => x.img)) : null
      const faces = grid ? [grid] : ok.map(x => x.img)
      const refUrl = await styleReference(db, f)
      const ref = refUrl ? await fetchImage(refUrl) : null
      const inspiration = look.inspiration ? await fetchImage(look.inspiration) : null
      prompt = paintPrompt(lines, look, { people: grid ? [] : ok.map(x => x.name), grid: grid ? ok.map(x => x.name) : undefined, styleRef: !!ref, notes: f.notes, inspiration: !!inspiration })
      images = [...(ref ? [ref] : []), ...faces, ...(inspiration ? [inspiration] : [])]
    }

    // One painting per click (plus the post's recompose below). No automatic
    // repaints: each costs money, so the organizer sees the result and decides.
    const img = await paintWithRetries(prompt, images, aspect)
    if (await stopped()) return
    const up = await upload(img, host?.username ?? 'unknown', aspect)
    // The picture shows now; the words are read back while the organizer looks at it.
    await set({ status: 'checking', url: up.url, width: up.width, height: up.height, prompt, model: IMAGE_MODEL, error: null })
    const check: FlyerCheck = checkFlyerText(lines, await readText(img))
    await set({ status: 'ready', check })
    // A feed post (4:5): recompose the story into it, the house way.
    if (f.mode === 'paint' && (await formatOf(db, f.postId)) === 'post') {
      const [n] = await db.insert(eventFlyers).values({
        eventId: f.eventId, postId: f.postId, batchId: f.batchId, lookId: f.lookId, look: f.look, mode: 'recompose', baseFlyerId: f.id,
        lines: f.lines, pictured: f.pictured, createdBy: f.createdBy,
      }).returning({ id: eventFlyers.id })
      await runFlyer(db, n!.id)
    }
  } catch (e: any) {
    if (await stopped()) return
    // Painted but the read-back failed: keep the picture, just unchecked.
    const [row] = await db.select({ url: eventFlyers.url }).from(eventFlyers).where(eq(eventFlyers.id, flyerId))
    await set(row?.url ? { status: 'ready', check: null } : { status: 'failed', error: e?.message || 'Something went wrong while painting.' })
  }
}
