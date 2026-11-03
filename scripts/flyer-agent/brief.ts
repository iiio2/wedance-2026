/**
 * Spike: an event's brief for the flyer agent — the facts as data, not as a
 * finished text block, plus every photo and the style reference on disk.
 * The agent decides what goes on the poster and how.
 *
 *   bun brief.ts <eventId> <runDir>
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import sharp from 'sharp'

// timestamp columns hold UTC (the app reads them so).
pg.types.setTypeParser(1114, (s: string) => new Date(`${s.replace(' ', 'T')}Z`))

const [eventId, runDir] = process.argv.slice(2)
if (!eventId || !runDir) throw new Error('Usage: bun brief.ts <eventId> <runDir>')
mkdirSync(resolve(runDir, 'inputs'), { recursive: true })

const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const { rows: [ev] } = await db.query('select * from events where id = $1', [eventId])
if (!ev) throw new Error(`No event ${eventId}`)
const handles: string[] = ev.artists ?? []
const { rows: people } = await db.query('select username, name, photo, styles from profiles where username = any($1)', [handles])
const { rows: [venue] } = ev.venue_username ? await db.query('select name, address from profiles where username = $1', [ev.venue_username]) : { rows: [] }
const { rows: [flyer] } = await db.query(`select look_id, look from event_flyers where event_id = $1 and look_id is not null order by created_at desc limit 1`, [eventId])
const { rows: [look] } = flyer?.look_id ? await db.query('select name, "references" from brand_looks where id = $1', [flyer.look_id]) : { rows: [] }
await db.end()

async function save(url: string | null | undefined, name: string) {
  if (!url) return null
  const res = await fetch(url).catch(() => null)
  if (!res?.ok) return null
  const buf = Buffer.from(await res.arrayBuffer())
  // An extension, so the agent's image viewer opens it.
  const { format } = await sharp(buf).metadata()
  const path = resolve(runDir, 'inputs', `${name}.${format === 'jpeg' ? 'jpg' : format ?? 'png'}`)
  writeFileSync(path, buf)
  return path
}

const tz = ev.timezone || 'Europe/Berlin'
const local = (d: Date) => new Date(d).toLocaleString('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const chosen = (ev.flyer_options?.photos ?? {}) as Record<string, string | null>
const artists = await Promise.all(handles.map(async (h) => {
  const p = people.find(x => x.username === h)
  const sessions = (ev.festival?.sessions ?? []).filter((s: any) => s.artist === h || (s.with ?? []).includes(h))
  const photo = h in chosen ? chosen[h] : p?.photo
  return {
    name: p?.name ?? h, instagram: h, styles: p?.styles ?? [],
    doing: sessions.map((s: any) => `${s.time} ${s.title} (${s.type}, ${s.duration} min)`),
    photo: await save(photo, `photo-${h.replace(/[^a-z0-9]/gi, '-')}`),
  }
}))
const style = look ? { name: look.name, description: flyer.look?.description, palette: flyer.look?.palette, reference: await save(look.references?.[0]?.url, 'style-reference') } : null

const brief = {
  event: {
    name: ev.name, starts: local(ev.start_date), ends: ev.end_date ? local(ev.end_date) : null, timezone: tz,
    description: ev.description, music: ev.styles, price: ev.price || null,
    passes: (ev.festival?.passes ?? []).map((p: any) => `${p.name}${p.price ? ` ${p.price} €` : ''}`),
    programme: (ev.festival?.sessions ?? []).slice().sort((a: any, b: any) => a.time.localeCompare(b.time))
      .map((s: any) => ({ time: s.time, title: s.title, type: s.type, style: s.style, level: s.level, by: people.find(x => x.username === s.artist)?.name ?? s.artist })),
  },
  venue: { name: venue?.name || ev.venue_name, address: venue?.address || ev.venue_address },
  artists, style,
}
writeFileSync(resolve(runDir, 'brief.json'), JSON.stringify(brief, null, 2))
console.log(JSON.stringify(brief, null, 2))
