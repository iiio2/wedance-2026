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
  /** Festival passes as display strings, e.g. ["Full Pass · 210 €"]. Shown on the announcement flyer when price is empty. */
  passes?: string[]
}

export type FlyerLine = { label: 'kicker' | 'title' | 'subtitle' | 'date' | 'time' | 'agenda' | 'detail' | 'line-up' | 'music' | 'entry' | 'venue'; text: string }

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
  // Several days (a festival): the dates, no time. One night: weekday, date and time.
  const lastDay = e.endDate ? eventLocalDate(e.endDate, tz) : d
  const multiDay = lastDay > d && (new Date(e.endDate!).getTime() - new Date(e.startDate).getTime()) > 24 * 3600_000
  const monthOf = (x: string) => new Date(`${x}T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
  const out: FlyerLine[] = multiDay
    ? [
        { label: 'title', text: up(e.name) },
        { label: 'date', text: up(monthOf(lastDay) === month ? `${Number(d.slice(8))} – ${Number(lastDay.slice(8))} ${month}` : `${Number(d.slice(8))} ${month} – ${Number(lastDay.slice(8))} ${monthOf(lastDay)}`) },
      ]
    : [
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
  else if (e.passes?.length) out.push({ label: 'entry', text: e.passes.slice(0, 3).join(' · ') })
  if (venue) out.push({ label: 'venue', text: venue })
  return out
}

/** A content-plan post's words (shared/utils/posts.ts): its own lines, from the event's. */
export type PostSource = FlyerSource & {
  kind: import('./posts').PostKind
  /** Artist post: who it's about, and what they do at the event. */
  artist?: { name: string; styles?: string[]; sessions?: string[] } | null
  /** Festival passes, "FULL PASS · 210 €". */
  passes?: string[]
  /** Programme highlights, "SAT 11:00 · TIMBA · BARBARA JIMENEZ". */
  programme?: string[]
}

/** The lines of a post. The announcement is the event's flyer; the others reuse its date and venue lines. */
export function postLines(p: PostSource): FlyerLine[] {
  const base = flyerLines(p)
  if (p.kind === 'announcement') return base
  const pick = (...labels: FlyerLine['label'][]) => base.filter(l => labels.includes(l.label))
  const title = up(p.name)
  const when = pick('date', 'time')
  const where = pick('venue')
  const kicker = (t: string): FlyerLine => ({ label: 'kicker', text: t })
  switch (p.kind) {
    case 'artist': {
      const a = p.artist
      if (!a) return base
      return [
        kicker('IN THE LINE-UP'),
        { label: 'title', text: up(a.name) },
        { label: 'subtitle', text: title },
        ...pick('date'),
        ...(a.sessions ?? []).slice(0, 3).map(t => ({ label: 'detail' as const, text: up(t) })),
        ...(a.styles?.length ? [{ label: 'music' as const, text: up(a.styles.slice(0, 3).join(' × ')) }] : []),
        ...where,
      ]
    }
    case 'lineup': return [kicker('LINE-UP'), { label: 'title', text: title }, ...pick('date'), ...pick('line-up'), ...where]
    case 'programme': {
      const items = (p.programme?.length ? p.programme : (p.agenda ?? []).map(a => `${a.time} ${a.what}`)).slice(0, 6)
      return [kicker('PROGRAMME'), { label: 'title', text: title }, ...pick('date'), ...items.map(t => ({ label: 'detail' as const, text: up(t) })), ...where]
    }
    case 'passes': {
      const items = (p.passes?.length ? p.passes : priceLines(p.price)).slice(0, 5)
      return [kicker('PASSES'), { label: 'title', text: title }, ...pick('date'), ...items.map(t => ({ label: 'detail' as const, text: up(t) })), ...where]
    }
    case 'countdown': return [kicker('ONE WEEK TO GO'), { label: 'title', text: title }, ...when, ...where]
    case 'last-call': return [kicker('LAST TICKETS'), { label: 'title', text: title }, ...when, ...pick('entry'), ...where]
    case 'thanks': return [kicker('THANK YOU'), { label: 'title', text: title }, { label: 'subtitle', text: 'SEE YOU NEXT TIME' }]
  }
  return base
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
  const [title] = by('title'); const [date] = by('date'); const [time] = by('time') as (string | undefined)[]
  const agenda = by('agenda'); const [names] = by('line-up'); const [music] = by('music')
  const [entry] = by('entry'); const [venue] = by('venue')
  const [kicker] = by('kicker'); const [subtitle] = by('subtitle'); const details = by('detail')
  return [
    kicker ? `Small label "${kicker}" at the very top.` : null,
    date ? `"${date}" ${kicker ? 'under it' : 'at the top'}.` : null,
    `Huge title "${title}".`,
    subtitle ? `Under the title, smaller: "${subtitle}".` : null,
    details.length ? `A short list, one line each: ${details.map(d => `"${d}"`).join(', ')}.` : null,
    // Worded so Gemini doesn't paint a literal "LINE-UP" label.
    names ? `Under the title, the artists' names "${names}".` : null,
    music ? `Genre line "${music}".` : null,
    time ? `Big time badge "${time}".` : null,
    agenda.length ? `A small programme list, one line each: ${agenda.map(a => `"${a}"`).join(', ')}.` : null,
    entry ? `Entry line "${entry}".` : null,
    venue ? `Bottom bar with a location pin: "${venue}".` : null,
  ].filter(Boolean).join(' ')
}

// The reader marks covered letters; this keeps the painter from covering them.
const CLEAR_TEXT = 'Keep every letter fully visible: no person, hand, hat or object may cover or cut off any part of the text.'

/**
 * A full painting, the way the house process does it (~/Orgs/LaClave/assets/
 * flyer-style.md, the image-from-gemini skill): the style reference flyer as
 * image 1, then each artist's photo, numbered and named; the look; a strict
 * layout in percentages (else heads cover the title); every word spelled out.
 * Always a 9:16 story: the 4:5 feed post is recomposed from it (painting the
 * feed straight from photos was refused far more often). Short on purpose:
 * shorter prompts pass more often.
 */
export function paintPrompt(lines: FlyerLine[], look: FlyerLook, opts: { people?: string[]; grid?: string[]; styleRef?: boolean; notes?: string | null; inspiration?: boolean } = {}) {
  let n = 0
  const style = opts.styleRef ? ++n : 0
  const people = opts.people ?? []
  const first = n + 1
  n += opts.grid?.length ? 1 : people.length
  const who = opts.grid?.length
    ? `, featuring all ${opts.grid.length} artists as a line-up of portraits, all the same size, each with their name just under it. Image ${first} is a grid of their photos, in this order: ${opts.grid.join(', ')}. Keep their real faces`
    : people.length === 1
      ? `, featuring the person from image ${first} as the artist, big in the centre`
      : people.length > 1 ? `, featuring the ${people.length} artists from the photos, big` : ''
  const palette = look.palette?.length ? `Colours: ${look.palette.map(p => `${p.name} ${p.hex}`).join(', ')}.` : null
  const hasPeople = people.length > 0 || !!opts.grid?.length
  return [
    `Tall vertical 9:16 Instagram story poster for a dance event${who}.`,
    style ? `Image ${style} is the STYLE and LAYOUT reference: match its scene, colours, lettering and layout closely. Do not copy its words, people or dates.` : null,
    people.length > 1 ? people.map((name, i) => `Image ${first + i}: ${name}.`).join(' ') : null,
    clean(look.description),
    palette,
    hasPeople
      ? 'Layout: the date and the title in the top 38%; the artists from 40% to 85% of the height, below the title, never covering any text; the details in the bottom 15%.'
      : 'Layout: the date and the title in the top third; the details below, with room to breathe.',
    opts.inspiration ? 'The last image is a flyer the organizer likes: borrow its mood only. Do not copy its text, people or layout.' : null,
    opts.notes?.trim() ? `Also: ${clean(opts.notes)}` : null,
    `Exact text on the poster, spelled exactly, nothing else: ${textBlock(lines)}`,
    CLEAR_TEXT,
  ].filter(Boolean).join('\n')
}

/** The 4:5 feed post from a finished story: the same poster, recomposed (the house way). */
export function recomposePrompt(lines: FlyerLine[]) {
  return [
    'Recompose this exact poster into a vertical 4:5 Instagram feed format. Keep the same scene, people, style, colours and all the text; move things so everything fits, nothing cropped.',
    `The text stays exactly, spelled exactly: ${textBlock(lines)}`,
    CLEAR_TEXT,
  ].join('\n')
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

/**
 * Read a look off flyers the organizer made before (Gemini text model, JSON
 * out) — written the way the proven styles are (~/Orgs/LaClave/assets/
 * flyer-style.md): the scene, then the lettering of each kind of text, so the
 * next flyer matches element by element. The flyers are kept as the style's
 * reference images (image 1 of every painting in it).
 */
export const LOOK_PROMPT = [
  'These are dance-event flyers by one organizer. Describe their shared visual style so a new flyer can be painted in exactly the same style.',
  'Write it as one paragraph of 4–6 sentences, like a brief to a poster designer: the scene and background (setting, light, objects, textures); the lettering of each kind of text — the main title, the date, the genre or music line, the times, any box or badge (e.g. for workshops or entry), and the footer location line (font shape, weight, colour, effects like glow or gradient); how the people are shown; the layout from top to bottom.',
  'Do not mention any dates, names, places, prices or other words printed on them.',
  'Also give the 3–5 main colours with a short name and a hex value, and a 1–3 word name for the style.',
  'Reply as JSON: {"name": "...", "description": "...", "palette": [{"name": "...", "hex": "#rrggbb"}]}',
].join('\n')

/**
 * More style ideas for a profile (Gemini text model, JSON out): new visual
 * directions that fit its music and city and differ from the ones it has.
 * Painted only when the organizer picks them.
 */
export function styleIdeasPrompt(c: { name: string; styles: string[]; city?: string | null; feelings?: string[]; existing: string[]; count: number }) {
  return [
    `Suggest ${c.count} distinct visual styles for dance-event flyers by ${c.name}${c.city ? ` in ${c.city}` : ''}. The music: ${c.styles.join(', ') || 'social dance'}.`,
    c.feelings?.length ? `The feeling they want: ${c.feelings.join(', ').toLowerCase()}.` : null,
    c.existing.length ? `Different from the styles they already have: ${c.existing.join('; ')}.` : null,
    'Make them clearly different from each other: setting, era, colours, lettering. Each must work as a poster with a photo of the artists and clear, readable text.',
    'For each: "name" (1–3 words), "hint" (up to 8 words), "description" (3–4 sentences: the scene and background, the colours, the lettering — shape, weight and colour of the title and of the times —, how people are shown, the layout; no dates, names, places, prices or other words to print), and "palette" (3–5 colours, each {"name", "hex": "#rrggbb"}).',
    'Reply as JSON: {"styles": [{"name": "...", "hint": "...", "description": "...", "palette": [{"name": "...", "hex": "#rrggbb"}]}]}',
  ].filter(Boolean).join('\n')
}

/**
 * Starting points when an organizer has no flyers yet: the house's proven
 * styles (~/Orgs/LaClave/assets/flyer-style.md Styles A and B,
 * ~/Orgs/ikigai/ops/design/flyer-styles.md Styles B and D), lettering included.
 */
export const DIRECTIONS: (FlyerLook & { hint: string })[] = [
  { name: 'Neon street', hint: 'Red neon Havana, gold title', description: 'Red-neon Havana street at night: crumbling colonial balconies, red and gold neon light streaks along the facades, red palm leaves framing the corners, a golden spotlight cone on the empty street. Tall condensed uppercase lettering: gold-gradient headline and date, red and gold genre words, white times. A red-glow rounded box for workshops or entry. Footer: a thin gold rule and a gold location pin with the place.' },
  { name: 'Cuban vintage', hint: '1950s Havana poster, cream paper', description: 'Vintage 1950s Cuban propaganda and Havana cabaret poster: aged cream paper texture with fold creases, screen-print look, red, navy and mustard palette, halftone sun rays behind the headline, old Havana facades and a classic car silhouette at the edges, distressed ink. Red script headline with a gold outline, navy condensed sans for the info lines, a red ticket-style box with a gold border, the location bar at the bottom.' },
  { name: 'Afro club', hint: 'Purple and gold, stage lights', description: 'Luxury Afro-fusion club poster: purple and magenta with gold, stage lasers and haze, a blurred dancing crowd, kente-cloth strips, gold geometric African-pattern borders, gold palm and monstera leaves, gold confetti. 3D metallic gold title, a gold ribbon subtitle, a colourful genre line, a round gold time medallion, white details.' },
  { name: 'Afro-tropical', hint: 'Bold street party, deep purple', description: 'Bold Afro-Caribbean street party poster on a deep purple background: vibrant orange, green, yellow and magenta, flat graphic African-print patterns and tropical leaves as borders, spiral sunburst shapes, a calm dark spotlight behind the people. Chunky playful display type with drop shadows: orange headline with a magenta shadow, yellow and green info lines, a patterned-border box for workshops or entry.' },
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

/**
 * The programme (events.festival.sessions) as one-line agenda items for the
 * flyer and captions: "21:00 Rumba workshop". With several days, the weekday
 * comes first ("Sat 21:00 …"). Every event type plans its programme by day.
 */
export function programmeLines(sessions: { date: string; time: string; title: string }[] | null | undefined): { time: string; what: string }[] {
  const s = (sessions ?? []).filter(x => x.title?.trim()).slice().sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  const multi = new Set(s.map(x => x.date)).size > 1
  const wd = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
  return s.map(x => ({ time: multi ? `${wd(x.date)} ${x.time}` : x.time, what: x.title.trim() }))
}
