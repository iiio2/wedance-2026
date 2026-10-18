import { and, desc, eq, gt, inArray } from 'drizzle-orm'
import { brandLooks, eventFlyers, events, profiles, trackedLinks } from '../database/schema'
import { announcementPost, flyerSource, runFlyer } from './flyer/paint'
import { captionContext, writeCaption } from './flyer/caption'
import { DIRECTIONS } from '../../shared/utils/flyer'
import { LANGUAGES } from '../../shared/utils/caption'

/**
 * A promo kit for an event (MCP `promo_kit`): the flyer (story 9:16 + feed 4:5),
 * a caption in the event's languages, hashtags, and — for a promoter page — its
 * tracked link and QR code. Built from what the organizer already made: flyers
 * are only painted when the event has none at all, captions only written when
 * none fits, using the same flyer and caption code as the event editor.
 */

type Db = any
type Caption = { language: string; text: string; lines: string[]; writtenAt: string }

const PAINTING_FRESH_MS = 4 * 60_000
const LANGUAGE_VALUES = LANGUAGES.map(l => l.value) as string[]

/** The caption language(s) for an event: its host page's languages, else its country's. */
export function eventLanguage(hostLanguages: string[] | null | undefined, country: string | null | undefined): string {
  const ls = new Set((hostLanguages ?? []).map(l => l.toLowerCase()))
  const local = ['de', 'es', 'ru'].find(l => ls.has(l))
  if (local === 'de' || (!local && /germany|austria|switzerland|deutschland/i.test(country ?? ''))) return 'en+de'
  if (local === 'es' || (!local && /spain|españa|mexico|cuba|colombia|argentina/i.test(country ?? ''))) return 'en+es'
  if (local === 'ru') return ls.has('en') ? 'en' : 'ru'
  return 'en'
}

/** Hashtags in a caption, plus the event's styles and city and #wedance; deduped, at most 20. */
export function kitHashtags(caption: string | null | undefined, styles: string[], city: string | null | undefined): string[] {
  const tag = (s: string) => `#${s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase()}`
  const found = (caption ?? '').match(/#[\p{L}\p{N}_]+/gu) ?? []
  const all = [...found, ...styles.map(tag), ...(city ? [tag(city)] : []), '#wedance']
  const seen = new Set<string>()
  return all.filter((t) => {
    const k = t.toLowerCase()
    if (t.length < 3 || seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 20)
}

const isStory = (f: { width?: number | null; height?: number | null }) => !f.width || !f.height || f.height / f.width >= 1.5

/** The flyers to share: the kept one first, else the newest finished; one story and one feed post. */
export async function kitFlyers(db: Db, eventId: string) {
  const rows = await db.select().from(eventFlyers)
    .where(and(eq(eventFlyers.eventId, eventId), inArray(eventFlyers.status, ['ready', 'checking'])))
    .orderBy(desc(eventFlyers.keptAt), desc(eventFlyers.createdAt)).limit(40)
  const done = rows.filter((f: any) => f.url)
  const pick = (story: boolean) => {
    const f = done.find((x: any) => isStory(x) === story)
    return f ? { flyerId: f.id, url: f.url, width: f.width, height: f.height, kept: !!f.keptAt } : null
  }
  // A painting started in the last few minutes (still going, or just failed):
  // report it instead of starting another one.
  const [recent] = await db.select({ batchId: eventFlyers.batchId, status: eventFlyers.status, error: eventFlyers.error }).from(eventFlyers)
    .where(and(eq(eventFlyers.eventId, eventId), gt(eventFlyers.createdAt, new Date(Date.now() - PAINTING_FRESH_MS))))
    .orderBy(desc(eventFlyers.createdAt)).limit(1)
  return {
    story: pick(true), feed: pick(false),
    paintingBatchId: recent?.status === 'painting' ? recent.batchId as string : null,
    recentFailure: recent && ['failed', 'stopped'].includes(recent.status) ? (recent.error as string | null) ?? 'The painting stopped.' : null,
  }
}

/**
 * No flyer at all and none painting: paint the announcement in the host's
 * newest look (or the first house direction), in the background like
 * businessFlyers.make. Returns the batch to poll.
 */
export async function startKitFlyer(db: Db, ev: any, dancerId: string | null, waitUntil?: (p: Promise<unknown>) => void) {
  const postId = await announcementPost(db, ev.id)
  const [l] = ev.hostProfileId
    ? await db.select().from(brandLooks).where(eq(brandLooks.profileId, ev.hostProfileId)).orderBy(desc(brandLooks.updatedAt)).limit(1)
    : [null]
  const d = DIRECTIONS[0]!
  const look = l ? { name: l.name, description: l.description, palette: l.palette } : { name: d.name, description: d.description }
  const src = await flyerSource(db, ev, { kind: 'announcement' })
  const batchId = crypto.randomUUID()
  const [f] = await db.insert(eventFlyers).values({
    eventId: ev.id, postId, batchId, lookId: l?.id ?? null, look: { ...look, references: [] } as any,
    mode: 'paint', lines: src.lines, pictured: src.pictured, createdBy: dancerId,
  }).returning({ id: eventFlyers.id })
  const job = runFlyer(db, f!.id)
  if (waitUntil) waitUntil(job)
  return { flyerId: f!.id as string, batchId }
}

/**
 * The caption for the kit. Reuse, in order: this promoter's cached one, the
 * organizer's saved one; else write one (Gemini) and cache it on the link (a
 * promoter) or the event (its team). Out of date (the details changed) =
 * written again. Never throws: no caption is better than no kit.
 */
export async function kitCaption(db: Db, ev: any, opts: { language: string; linkId?: string | null; linkCaption?: Caption | null; manager: boolean }): Promise<{ caption: Caption | null; source: string; error?: string }> {
  let lines: string[] = []
  try {
    lines = (await captionContext(db, ev)).lines
  } catch { /* fall through with no staleness check */ }
  const fresh = (c: Caption | null | undefined) => !!c && (!lines.length || (c.lines.length === lines.length && c.lines.every(l => lines.includes(l))))
  if (opts.linkCaption && fresh(opts.linkCaption) && opts.linkCaption.language === opts.language) return { caption: opts.linkCaption, source: 'your kit' }
  if (ev.caption && fresh(ev.caption)) return { caption: ev.caption, source: 'the organizer' }
  if (!LANGUAGE_VALUES.includes(opts.language)) return { caption: null, source: 'none', error: `Unknown language ${opts.language}.` }
  try {
    const c = await writeCaption(db, ev, null, opts.language)
    if (opts.linkId) await db.update(trackedLinks).set({ caption: c }).where(eq(trackedLinks.id, opts.linkId))
    else if (opts.manager) await db.update(events).set({ caption: c, updatedAt: new Date() }).where(eq(events.id, ev.id))
    return { caption: c, source: 'written now' }
  } catch (e) {
    console.error('[promo-kit] caption failed', (e as Error).message)
    return { caption: null, source: 'none', error: 'Couldn’t write a caption right now. Try again later, or use the organizer’s once they write one.' }
  }
}

/** The host page's languages, for eventLanguage. */
export async function hostLanguages(db: Db, hostProfileId: string | null | undefined): Promise<string[]> {
  if (!hostProfileId) return []
  const [p] = await db.select({ languages: profiles.languages }).from(profiles).where(eq(profiles.id, hostProfileId))
  return (p?.languages ?? []) as string[]
}
