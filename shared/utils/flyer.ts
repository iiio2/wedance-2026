/**
 * Event flyers: the exact words a flyer carries, the Gemini prompts, and the
 * check that Gemini's read-back of the finished poster matches the event.
 *
 * Gemini paints the whole poster — people, scene and text (recipe:
 * ~/Orgs/LaClave/assets/flyer-style.md). Text is the risk ("MÜNEHEN"), so every
 * line is spelled out in the prompt and verified on the result. The same lines,
 * stored with the kept flyer, tell the editor when the event has changed since.
 */
import { eventLocalDate, eventLocalTime, eventLocalWeekday } from './eventTime'

export type FlyerLook = { name?: string; description: string; palette?: { name: string; hex: string }[] }

export type FlyerSource = {
  name: string
  startDate: string | Date
  endDate?: string | Date | null
  timezone?: string | null
  venueName?: string | null
  venueAddress?: string | null
  agenda?: { time: string; what: string }[]
  showAgenda?: boolean
  artists: { name: string }[]
  styles?: string[]
  /** One price per line ("Free until 21:00\nFrom 21:00 · 10€"). */
  price?: string | null
}

export type FlyerLine = { label: 'title' | 'date' | 'time' | 'agenda' | 'line-up' | 'music' | 'entry' | 'venue'; text: string }

const clean = (s: string) => s.trim().replace(/\s+/g, ' ')
const up = (s: string) => clean(s).toUpperCase()

/** Price lines as typed, one per line. */
export const priceLines = (price?: string | null) => (price ?? '').split('\n').map(clean).filter(Boolean)

/** The lines the poster shows, in order. Poster style: uppercase headings, 24h times. */
export function flyerLines(e: FlyerSource): FlyerLine[] {
  const tz = e.timezone || 'Europe/Berlin'
  const d = eventLocalDate(e.startDate, tz)
  const month = new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
  const start = eventLocalTime(e.startDate, tz)
  const end = e.endDate ? eventLocalTime(e.endDate, tz) : null
  const names = e.artists.map(a => clean(a.name)).filter(Boolean)
  // "Neuhauser Str. 47, München" → "LUMA · NEUHAUSER STR. 47 · MÜNCHEN"
  const venue = e.venueName ? up([e.venueName, ...(e.venueAddress ? e.venueAddress.split(/\s*,\s*/) : [])].filter(Boolean).join(' · ')) : null
  const out: FlyerLine[] = [
    { label: 'title', text: up(e.name) },
    { label: 'date', text: up(`${eventLocalWeekday(e.startDate, tz)} ${Number(d.slice(8))} ${month}`) },
    { label: 'time', text: end && end !== start ? `${start} – ${end}` : start },
  ]
  if (e.showAgenda !== false) {
    for (const a of e.agenda ?? []) if (clean(a.what)) out.push({ label: 'agenda', text: clean(`${a.time} ${a.what}`) })
  }
  if (names.length) out.push({ label: 'line-up', text: up(names.join(' · ')) })
  if (e.styles?.length) out.push({ label: 'music', text: up(e.styles.join(' × ')) })
  const prices = priceLines(e.price)
  if (prices.length) out.push({ label: 'entry', text: prices.join(' · ') })
  if (venue) out.push({ label: 'venue', text: venue })
  return out
}

/** What a kept flyer differs from the event now: old → new pairs, then photo changes. */
export function flyerChanges(was: { lines: string[]; pictured: string[] }, now: { lines: string[]; pictured: string[] }) {
  const added = now.lines.filter(t => !was.lines.includes(t))
  const removed = was.lines.filter(t => !now.lines.includes(t))
  const out = Array.from({ length: Math.max(added.length, removed.length) }, (_, i) => ({ was: removed[i] ?? null, now: added[i] ?? null }))
  const newFaces = now.pictured.filter(p => !was.pictured.includes(p))
  const goneFaces = was.pictured.filter(p => !now.pictured.includes(p))
  if (newFaces.length || goneFaces.length) {
    out.push({ was: goneFaces.length ? `Photo: ${goneFaces.join(', ')}` : null, now: newFaces.length ? `Photo: ${newFaces.join(', ')}` : null })
  }
  return out
}

function textBlock(lines: FlyerLine[]) {
  const by = (l: FlyerLine['label']) => lines.filter(x => x.label === l).map(x => x.text)
  const [title] = by('title'); const [date] = by('date'); const [time] = by('time')
  const agenda = by('agenda'); const [names] = by('line-up'); const [music] = by('music')
  const [entry] = by('entry'); const [venue] = by('venue')
  return [
    `"${date}" at the top.`,
    `Huge title "${title}".`,
    // Worded so Gemini doesn't paint a literal "LINE-UP" label.
    names ? `Under the title, the artists' names "${names}".` : null,
    music ? `Genre line "${music}".` : null,
    `Big time badge "${time}".`,
    agenda.length ? `A small programme list, one line each: ${agenda.map(a => `"${a}"`).join(', ')}.` : null,
    entry ? `Entry line "${entry}".` : null,
    venue ? `Bottom bar with a location pin: "${venue}".` : null,
  ].filter(Boolean).join(' ')
}

// The reader marks covered letters; this keeps the painter from covering them.
const CLEAR_TEXT = 'Keep every letter fully visible: no person, hand, hat or object may cover or cut off any part of the text.'

/** A full painting: the look, the people (as photos), every line spelled out. */
export function paintPrompt(lines: FlyerLine[], look: FlyerLook, opts: { people: number; notes?: string | null; inspiration?: boolean } = { people: 0 }) {
  const who = opts.people === 1
    ? ' featuring the person from the first photo as the artist, big in the centre, keeping their real face'
    : opts.people > 1 ? ` featuring the ${opts.people} people from the first ${opts.people} photos as the artists, big, keeping their real faces` : ''
  const palette = look.palette?.length ? `Colours: ${look.palette.map(p => `${p.name} ${p.hex}`).join(', ')}.` : null
  return [
    `Tall vertical 9:16 Instagram story poster for a dance event${who}.`,
    clean(look.description),
    palette,
    opts.inspiration ? 'The last image is a flyer the organizer likes: borrow its mood only. Do not copy its text, people or layout.' : null,
    opts.notes?.trim() ? `Also: ${clean(opts.notes)}` : null,
    `Exact text on the poster, spelled exactly, nothing else: ${textBlock(lines)}`,
    CLEAR_TEXT,
  ].filter(Boolean).join('\n')
}

/** Edit the given poster: keep it, change only what's asked. Keeps the picture. */
export function fixPrompt(lines: FlyerLine[], notes: string) {
  return [
    'Edit this poster. Keep the same scene, people, style, colours and layout.',
    `Change only this: ${clean(notes)}`,
    `All text must stay exactly as it is now, spelled exactly: ${textBlock(lines)}`,
    CLEAR_TEXT,
  ].join('\n')
}

/** New details on the same poster: replace the words, keep the picture. */
export function refreshPrompt(lines: FlyerLine[]) {
  return [
    'Update this poster for new event details. Keep the same scene, people, style, colours and layout.',
    `Replace the text so the poster shows exactly this and nothing else, spelled exactly: ${textBlock(lines)}`,
    CLEAR_TEXT,
  ].join('\n')
}

/** Read a look off flyers the organizer made before (Gemini text model, JSON out). */
export const LOOK_PROMPT = [
  'These are dance-event flyers by one organizer. Describe their shared visual style so a new flyer can be painted in the same style.',
  'In 3–4 sentences cover: the scene and background, the colours, the lettering (shape, weight, colour of the title and of the times), how people are shown, and the layout.',
  'Do not mention any dates, names, places, prices or other words printed on them.',
  'Also give the 3–5 main colours with a short name and a hex value, and a 1–3 word name for the style.',
  'Reply as JSON: {"name": "...", "description": "...", "palette": [{"name": "...", "hex": "#rrggbb"}]}',
].join('\n')

/** Starting points when an organizer has no flyers yet: four different directions. */
export const DIRECTIONS: (FlyerLook & { hint: string })[] = [
  { name: 'Neon street', hint: 'Red neon, night, gold title', description: 'Red-neon Havana street at night: old colonial balconies, red and gold neon light along the facades, red palm leaves in the corners, a golden spotlight on the street. Tall condensed uppercase lettering, gold headline, white times.' },
  { name: 'Revolution poster', hint: 'Bold flag shapes, halftone, cream paper', description: 'Bold propaganda-poster style on cream paper: big red and blue flag-like shapes with a white star, halftone print texture, the person in high-contrast duotone. Heavy blocky uppercase lettering in red and navy.' },
  { name: 'Tropical', hint: 'Palms, warm sunset, vintage', description: 'Warm vintage tropical poster: sunset orange and pink sky, palm silhouettes, soft film grain, dancers silhouetted in the back. Elegant retro script for the title, cream condensed uppercase for the details.' },
  { name: 'Afro club', hint: 'Purple and gold, stage lights', description: 'Luxury club poster: deep purple and magenta, stage lasers and haze, a blurred dancing crowd, gold geometric borders and confetti. 3D metallic gold title, white details.' },
]

// Read-back comparison: case, spacing, dash and bullet variants don't count as
// errors; letters (umlauts and accents included) do.
function norm(s: string) {
  return s.toUpperCase()
    .replace(/[–—−]/g, '-')
    .replace(/[•·∙|]/g, '·')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*·\s*/g, ' · ')
    .replace(/\s*×\s*/g, ' × ')
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export type FlyerCheck = { ok: boolean; missing: string[]; extra: string[]; seen: string[] }

/**
 * Does the text read off the poster contain every line? Lines joined with "·"
 * may be split across the poster, so each part on its own also counts.
 * The music line is asked for but optional.
 */
export function checkFlyerText(lines: FlyerLine[], seenLines: string[]): FlyerCheck {
  const seen = norm(seenLines.join(' '))
  const present = (t: string) => seen.includes(norm(t)) || (/[·×]/.test(t) && t.split(/[·×]/).every(p => !p.trim() || seen.includes(norm(p))))
  const required = lines.filter(l => l.label !== 'music')
  const missing = required.filter(l => !present(l.text)).map(l => l.text)
  // Words Gemini added that aren't from the event (a neon "CUBA" sign): shown, not an error.
  const wanted = lines.map(l => norm(l.text))
  const extra = seenLines.filter((line) => {
    const n = norm(line)
    return n.length > 1 && !wanted.some(w => w.includes(n) || n.includes(w))
  })
  // A line painted twice ("AFROBEATS × KIZOMBA" top and bottom) reads fine but looks wrong.
  const counts = new Map<string, number>()
  for (const line of seenLines) counts.set(norm(line), (counts.get(norm(line)) ?? 0) + 1)
  for (const [n, c] of counts) if (c > 1 && wanted.includes(n)) extra.push(`${seenLines.find(l => norm(l) === n)} (twice)`)
  return { ok: missing.length === 0, missing, extra, seen: seenLines }
}
