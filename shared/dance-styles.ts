/**
 * Dance-style taxonomy — the single source of truth for every style 2026 knows.
 *
 * Ported 2026-10-12 from wedance-v3 `content/styles/*.yml` (171 entries; v4 imported
 * the same files into Postgres). Research + decisions: docs/research/2026-10-12-dance-styles.md.
 *
 * - `name` is the value 2026 STORES (dancers.dance_styles, events.styles, …). It is
 *   the Title-Case label the app already used (`Salsa`, `Urban Kiz`, `Rueda`), so
 *   existing rows stay valid. Never rename a `name` without migrating the data.
 * - `label` is an optional nicer display name when `name` is ambiguous (Afro → Afro-Cuban).
 * - `aliases` are matched case-, accent- and punctuation-insensitively: v3 names and
 *   PascalCase ids, synonyms, and the v3 sync keys (`salsaon1`, `urbankizz`).
 * - `family` groups styles in pickers; `parent` is the style it is a variant of.
 * - `rank` orders "popular first" (lower = more popular). Seeded from real 2026
 *   event counts (2026-10-12) blended with v3's `popularity`; unranked styles
 *   follow alphabetically.
 * - `topic: true` = a workshop topic stored in `styles` (Ladies, Theory) — recognised
 *   and coloured, but not offered as a dance in pickers.
 *
 * Dropped on purpose: historical court dances from v3 (Allemande, Chaconne,
 * Cotillion, Galliard, Lancer, Minuet, Pavane, Quadrille, Sarabande, Volta) and
 * moves listed as styles (Moonwalk, Robot, Worm — kept as aliases).
 */
import { WD } from '../app/lib/brand'

export type WdToken = keyof typeof WD

export type DanceFamilyId =
  | 'salsa' | 'cuban' | 'bachata' | 'kizomba' | 'brazilian' | 'caribbean' | 'african'
  | 'swing' | 'tango' | 'ballroom' | 'street' | 'stage' | 'folk' | 'indian' | 'topics'

export interface DanceFamily {
  id: DanceFamilyId
  name: string
  /** WD token for the family dot / chip tint. */
  token: WdToken
}

export interface DanceStyleDef {
  /** kebab-case, stable, URL-safe. */
  id: string
  /** Stored value. */
  name: string
  label?: string
  family: DanceFamilyId
  /** id of the style this is a variant of. */
  parent?: string
  aliases?: string[]
  rank?: number
  topic?: boolean
  /** Override the family colour. */
  token?: WdToken
}

export interface DanceStyle extends DanceStyleDef {
  aliases: string[]
  /** Display name: label ?? name. */
  display: string
}

/** Family order = picker order: WeDance's core scenes first. */
const FAMILY_DEFS: DanceFamily[] = [
  { id: 'salsa', name: 'Salsa', token: 'rose600' },
  { id: 'cuban', name: 'Cuban', token: 'amber600' },
  { id: 'bachata', name: 'Bachata', token: 'violet600' },
  { id: 'kizomba', name: 'Kizomba & Semba', token: 'pink500' },
  { id: 'brazilian', name: 'Brazilian', token: 'cyan600' },
  { id: 'caribbean', name: 'Caribbean & Latin party', token: 'orange500' },
  { id: 'african', name: 'African', token: 'green600' },
  { id: 'swing', name: 'Swing', token: 'sky500' },
  { id: 'tango', name: 'Tango', token: 'red800' },
  { id: 'ballroom', name: 'Ballroom', token: 'purple500' },
  { id: 'street', name: 'Street & urban', token: 'blue600' },
  { id: 'stage', name: 'Stage & studio', token: 'brown500' },
  { id: 'folk', name: 'Folk & world', token: 'green700' },
  { id: 'indian', name: 'Indian', token: 'amber500' },
  { id: 'topics', name: 'Workshop topics', token: 'gray500' },
]

const s = (id: string, name: string, family: DanceFamilyId, extra: Partial<DanceStyleDef> = {}): DanceStyleDef =>
  ({ id, name, family, ...extra })

const STYLE_DEFS: DanceStyleDef[] = [
  // Salsa
  s('salsa', 'Salsa', 'salsa', { rank: 1, aliases: ['Salsa dance'] }),
  s('salsa-la', 'Salsa LA', 'salsa', { parent: 'salsa', rank: 22, aliases: ['Salsa On1', 'On1', 'LA style', 'Salsa Los Angeles', 'Salsa linear', 'salsala', 'salsaon1'] }),
  s('salsa-ny', 'Salsa NY', 'salsa', { parent: 'salsa', rank: 24, aliases: ['Salsa On2', 'On2', 'NY style', 'Salsa New York', 'Modern Mambo', 'salsanewyork', 'salsaon2'] }),
  s('salsa-colombian', 'Salsa Colombian', 'salsa', { parent: 'salsa', rank: 30, aliases: ['Salsa Caleña', 'Cali style', 'Salsa Calena', 'Salsa caleña'] }),
  s('mambo', 'Mambo', 'salsa', { parent: 'salsa' }),
  s('pachanga', 'Pachanga', 'salsa', { parent: 'salsa' }),
  s('salsaton', 'Salsaton', 'salsa', { parent: 'salsa' }),
  s('latin-fusion', 'Latin Fusion', 'salsa'),

  // Cuban
  s('casino', 'Casino', 'cuban', { parent: 'salsa', rank: 4, aliases: ['Salsa Cubana', 'Cuban Salsa', 'Cuban', 'Salsa Cuban', 'salsacubana'] }),
  s('rueda', 'Rueda', 'cuban', { parent: 'casino', rank: 8, aliases: ['Rueda de Casino', 'Rueda de casino', 'ruedadecasino'] }),
  s('timba', 'Timba', 'cuban', { rank: 6 }),
  s('son', 'Son', 'cuban', { rank: 12, label: 'Son Cubano', aliases: ['Son Cubano', 'Cuban Son', 'cubanson'] }),
  s('rumba', 'Rumba', 'cuban', { rank: 10, aliases: ['Cuban Rumba', 'Rumba Cubana', 'Rumba Guaguancó', 'Rumba Guaguanco', 'Guaguancó', 'Guaguanco', 'rumbaguaguanco'] }),
  s('rumba-columbia', 'Rumba Columbia', 'cuban', { parent: 'rumba', aliases: ['Columbia'] }),
  s('rumba-yambu', 'Rumba Yambu', 'cuban', { parent: 'rumba', aliases: ['Rumba Yambú', 'Yambú', 'Yambu'] }),
  s('afro', 'Afro', 'cuban', { rank: 11, label: 'Afro-Cuban', aliases: ['Afro-Cuban', 'Afro Cubano', 'Afrocubano', 'Orishas', 'Orichas', 'Yoruba', 'Santeria', 'Arara', 'Palo', 'Afro-Salsa', 'afrocuban'] }),
  s('reparto', 'Reparto', 'cuban', { rank: 20, aliases: ['Cubaton', 'Cubatón', 'Repartero'] }),
  s('cha-cha-cha', 'Cha-Cha-Cha', 'cuban', { rank: 26, aliases: ['Cha-cha-chá', 'Cha Cha Cha', 'Cha-Cha', 'Cha Cha', 'Chachacha', 'chacha'] }),
  s('danzon', 'Danzón', 'cuban', { aliases: ['Danzon'] }),
  s('bolero', 'Bolero', 'cuban', { aliases: ['Cuban Bolero'] }),
  s('contradanza', 'Contradanza', 'cuban', { aliases: ['Contredanse', 'Contradanza criolla', 'Danza criolla', 'Habanera'] }),

  // Bachata
  s('bachata', 'Bachata', 'bachata', { rank: 2 }),
  s('bachata-sensual', 'Bachata Sensual', 'bachata', { parent: 'bachata', rank: 14, aliases: ['Sensual Bachata', 'sensualbachata'] }),
  s('bachata-dominicana', 'Bachata Dominicana', 'bachata', { parent: 'bachata', rank: 21, aliases: ['Dominican Bachata', 'dominicanbachata'] }),
  s('bachata-moderna', 'Bachata Moderna', 'bachata', { parent: 'bachata', aliases: ['Modern Bachata'] }),
  s('bachatango', 'Bachatango', 'bachata', { parent: 'bachata' }),

  // Kizomba & Semba
  s('kizomba', 'Kizomba', 'kizomba', { rank: 3, aliases: ['Kiz', 'Kizomba dance'] }),
  s('urban-kiz', 'Urban Kiz', 'kizomba', { parent: 'kizomba', rank: 7, aliases: ['Urban Kizz', 'UrbanKizz', 'Urbankiz', 'French Kiz'] }),
  s('semba', 'Semba', 'kizomba', { rank: 19 }),
  s('tarraxo', 'Tarraxo', 'kizomba', { parent: 'kizomba', rank: 9, aliases: ['Tarraxa', 'Tarraxinha', 'Tarraxa dance'] }),
  s('urban-tarraxa', 'Urban Tarraxa', 'kizomba', { parent: 'tarraxo' }),
  s('douceur', 'Douceur', 'kizomba', { parent: 'kizomba' }),
  s('kuduro', 'Kuduro', 'kizomba', { aliases: ['Kuduru'] }),

  // Brazilian
  s('zouk', 'Zouk', 'brazilian', { rank: 5, aliases: ['Brazilian Zouk', 'brazilianzouk'] }),
  s('lambada', 'Lambada', 'brazilian', { rank: 15 }),
  s('forro', 'Forró', 'brazilian', { rank: 29, aliases: ['Forro', 'Forró Love', 'ForroLove'] }),
  s('samba', 'Samba', 'brazilian', { rank: 25, aliases: ['Samba no pé', 'Samba de Gafieira'] }),
  s('maxixe', 'Maxixe', 'brazilian', { aliases: ['Brazilian tango'] }),
  s('funk-carioca', 'Funk Carioca', 'brazilian', { aliases: ['Baile funk', 'Favela funk'] }),
  s('capoeira', 'Capoeira', 'brazilian'),

  // Caribbean & Latin party
  s('reggaeton', 'Reggaeton', 'caribbean', { rank: 13, aliases: ['Reggaetón', 'Raggaeton'] }),
  s('merengue', 'Merengue', 'caribbean', { rank: 17 }),
  s('dancehall', 'Dancehall', 'caribbean', { rank: 18 }),
  s('cumbia', 'Cumbia', 'caribbean', { rank: 27 }),
  s('dembow', 'Dembow', 'caribbean', { parent: 'reggaeton' }),
  s('perreo', 'Perreo', 'caribbean', { parent: 'reggaeton', aliases: ['Sandungueo'] }),
  s('bump', 'Bump', 'caribbean', { parent: 'reggaeton' }),
  s('grinding', 'Grinding', 'caribbean', { parent: 'reggaeton' }),
  s('compas', 'Kompa', 'caribbean', { aliases: ['Compas', 'Konpa', 'Konpa Dirèk', 'Konpa Direk', 'Compas Direct'] }),
  s('zouk-love', 'Zouk Love', 'caribbean', { aliases: ['Caribbean Zouk', 'Antillean Zouk'] }),
  s('champeta', 'Champeta', 'caribbean', { aliases: ['Terapia'] }),
  s('vallenato', 'Vallenato', 'caribbean', { aliases: ['Ballenato'] }),

  // African
  s('afrobeats', 'Afrobeats', 'african', { rank: 16, aliases: ['Afro-pop', 'Afropop', 'Afro-fusion', 'Afrofusion', 'Afro dance'] }),
  s('afro-house', 'Afro House', 'african', { rank: 23 }),
  s('amapiano', 'Amapiano', 'african', { rank: 28 }),

  // Swing
  s('lindy-hop', 'Lindy Hop', 'swing', { rank: 31, aliases: ['Lindy', 'lindyhop'] }),
  s('west-coast-swing', 'West Coast Swing', 'swing', { rank: 32, aliases: ['WCS', 'westcoastswing'] }),
  s('swing', 'Swing', 'swing'),
  s('east-coast-swing', 'East Coast Swing', 'swing', { parent: 'swing', aliases: ['ECS'] }),
  s('balboa', 'Balboa', 'swing', { parent: 'swing' }),
  s('charleston', 'Charleston', 'swing', { parent: 'swing' }),
  s('collegiate-shag', 'Collegiate Shag', 'swing', { parent: 'swing', aliases: ['Shag'] }),
  s('boogie-woogie', 'Boogie-Woogie', 'swing', { parent: 'swing', aliases: ['Boogie Woogie'] }),
  s('rock-and-roll', 'Rock and Roll', 'swing', { aliases: ["Rock 'n' Roll", 'Rock n Roll', 'Rock’n’Roll'] }),
  s('modern-jive', 'Modern Jive', 'swing', { aliases: ['Ceroc', 'French Jive', "C'est le roc"] }),
  s('hand-dancing', 'Hand Dancing', 'swing'),
  s('shimmy', 'Shimmy', 'swing'),

  // Tango
  s('tango', 'Tango', 'tango', { rank: 33, aliases: ['Tango Argentino', 'Argentine Tango', 'Argentinian Tango', 'tangoargentino'] }),
  s('tango-nuevo', 'Tango Nuevo', 'tango', { parent: 'tango', aliases: ['New Tango'] }),
  s('milonga', 'Milonga', 'tango', { parent: 'tango', aliases: ['Tango Milonguero', 'Tango apilado'] }),
  s('tango-vals', 'Tango Vals', 'tango', { parent: 'tango', aliases: ['Vals'] }),
  s('tango-salon', 'Tango Salon', 'tango', { parent: 'tango', aliases: ['Tango Salón'] }),
  s('tango-canyengue', 'Tango Canyengue', 'tango', { parent: 'tango', aliases: ['Canyengue'] }),
  s('tango-orillero', 'Tango Orillero', 'tango', { parent: 'tango' }),
  s('tango-liso', 'Tango Liso', 'tango', { parent: 'tango' }),
  s('show-tango', 'Show Tango', 'tango', { parent: 'tango', aliases: ['Tango fantasía', 'Tango fantasia', 'Stage tango'] }),
  s('contact-tango', 'Contact Tango', 'tango', { parent: 'tango' }),
  s('finnish-tango', 'Finnish Tango', 'tango', { parent: 'tango' }),
  s('tango-oriental', 'Tango Oriental Uruguayan', 'tango', { parent: 'tango', aliases: ['Uruguayan Tango'] }),
  s('tango-valparaisino', 'Tango Valparaísino', 'tango', { parent: 'tango' }),
  s('tango-camacupense', 'Tango Camacupense', 'tango', { parent: 'tango' }),

  // Ballroom (Standard + Latin)
  s('ballroom', 'Ballroom', 'ballroom', { rank: 34, aliases: ['Ballroom Standard', 'Standard', 'Smooth', 'Standard dances'] }),
  s('waltz', 'Waltz', 'ballroom', { parent: 'ballroom', aliases: ['Slow Waltz', 'English Waltz'] }),
  s('viennese-waltz', 'Viennese Waltz', 'ballroom', { parent: 'ballroom', aliases: ['Wiener Walzer'] }),
  s('foxtrot', 'Foxtrot', 'ballroom', { parent: 'ballroom', aliases: ['Slow Fox', 'Slowfox'] }),
  s('quickstep', 'Quickstep', 'ballroom', { parent: 'ballroom' }),
  s('ballroom-tango', 'Ballroom Tango', 'ballroom', { parent: 'ballroom', aliases: ['Tango (ballroom)', 'Standard Tango'] }),
  s('ballroom-latin', 'Ballroom Latin', 'ballroom', { aliases: ['Latin', 'International Latin', 'Latin American', 'Rhythm'] }),
  s('ballroom-cha-cha', 'Ballroom Cha-Cha', 'ballroom', { parent: 'ballroom-latin', aliases: ['Cha-cha-cha (ballroom)'] }),
  s('rhumba', 'Rhumba', 'ballroom', { parent: 'ballroom-latin', aliases: ['Ballroom Rumba', 'Rumba (ballroom)'] }),
  s('ballroom-samba', 'Ballroom Samba', 'ballroom', { parent: 'ballroom-latin' }),
  s('paso-doble', 'Paso Doble', 'ballroom', { parent: 'ballroom-latin', aliases: ['Pasodoble'] }),
  s('jive', 'Jive', 'ballroom', { parent: 'ballroom-latin' }),
  s('discofox', 'Discofox', 'ballroom', { aliases: ['Disco Fox', 'Disco-Fox'] }),

  // Street & urban
  s('hip-hop', 'Hip Hop', 'street', { rank: 35, aliases: ['Hip-Hop', 'HipHop'] }),
  s('breaking', 'Breaking', 'street', { aliases: ['Breakdance', 'Break Dance', 'B-boying', 'B-girling', 'Toprock', 'Downrock', 'Worm'] }),
  s('house', 'House', 'street', { aliases: ['House dance'] }),
  s('popping', 'Popping', 'street', { aliases: ['Moonwalk', 'Robot'] }),
  s('locking', 'Locking', 'street'),
  s('electric-boogaloo', 'Electric Boogaloo', 'street', { aliases: ['Boogaloo'] }),
  s('krump', 'Krump', 'street', { aliases: ['Krumping'] }),
  s('vogue', 'Vogue', 'street', { aliases: ['Voguing', 'Waacking'] }),
  s('street-dance', 'Street Dance', 'street', { aliases: ['Streetdance'] }),
  s('commercial', 'Commercial', 'street', { aliases: ['Commercial dance'] }),
  s('high-heels', 'High Heels', 'street', { aliases: ['Heels'] }),
  s('k-pop', 'K-Pop', 'street', { aliases: ['Kpop', 'Korean dance'] }),
  s('twerk', 'Twerk', 'street', { aliases: ['Twerking'] }),

  // Stage & studio
  s('ballet', 'Ballet', 'stage', { aliases: ['Classical ballet', 'Classical dance'] }),
  s('contemporary', 'Contemporary', 'stage', { aliases: ['Contemporary dance'] }),
  s('modern', 'Modern', 'stage', { aliases: ['Modern dance'] }),
  s('jazz', 'Jazz', 'stage', { aliases: ['Jazz dance'] }),
  s('flamenco', 'Flamenco', 'stage'),
  s('belly-dance', 'Belly Dance', 'stage', { aliases: ['Bellydance', 'Oriental dance', 'Arabic dance'] }),
  s('burlesque', 'Burlesque', 'stage'),
  s('pole-dance', 'Pole Dance', 'stage', { aliases: ['Pole Dancing', 'Pole'] }),
  s('zumba', 'Zumba', 'stage'),

  // Folk & world
  s('sevillanas', 'Sevillanas', 'folk'),
  s('spanish-bolero', 'Spanish Bolero', 'folk'),
  s('bavarian-folk', 'Bavarian Folk', 'folk', { aliases: ['Bayerischer Volkstanz', 'Bayerisches Volkstanz', 'Volkstanz', 'Schuhplattler'] }),
  s('country-dance', 'Country Dance', 'folk', { aliases: ['English country dance'] }),
  s('ceili', 'Ceili', 'folk', { aliases: ['Céilí', 'Irish folk dance'] }),
  s('ceilidh', 'Ceilidh', 'folk', { aliases: ['Scottish folk dance'] }),
  s('jig', 'Jig', 'folk'),
  s('polka', 'Polka', 'folk'),
  s('schottische', 'Schottische', 'folk'),
  s('halay', 'Halay', 'folk'),
  s('horon', 'Horon', 'folk'),
  s('zeybek', 'Zeybek', 'folk'),
  s('hora', 'Hora', 'folk'),
  s('bar', 'Bar', 'folk'),
  s('kolbasti', 'Kolbaştı', 'folk', { aliases: ['Kolbash', 'Kolbasti'] }),
  s('kasik-oyunu', 'Kaşık Oyunu', 'folk', { aliases: ['Kasik Oyunyu', 'Kasik Oyunu', 'Spoon dance'] }),
  s('semah', 'Semah', 'folk', { aliases: ['Samah'] }),
  s('shiksaray', 'Şıksaray', 'folk', { aliases: ['Shiksaray', 'Siksaray'] }),
  s('adiyaman', 'Adıyaman', 'folk', { aliases: ['Adiyaman'] }),
  s('van', 'Van', 'folk'),

  // Indian
  s('bollywood', 'Bollywood', 'indian'),
  s('bhangra', 'Bhangra', 'indian'),
  s('bharatanatyam', 'Bharatanatyam', 'indian'),
  s('kathak', 'Kathak', 'indian'),
  s('kathakali', 'Kathakali', 'indian'),
  s('kuchipudi', 'Kuchipudi', 'indian'),
  s('odissi', 'Odissi', 'indian'),
  s('manipuri', 'Manipuri', 'indian'),
  s('mohiniyattam', 'Mohiniyattam', 'indian'),
  s('sattriya', 'Sattriya', 'indian'),
  s('garba', 'Garba', 'indian'),
  s('ghoomar', 'Ghoomar', 'indian'),
  s('lavani', 'Lavani', 'indian'),
  s('rasleela', 'Rasleela', 'indian', { aliases: ['Raas Leela'] }),

  // Workshop topics (stored in styles, not dances)
  s('ladies', 'Ladies', 'topics', { topic: true, label: 'Ladies Styling', aliases: ['Ladies Styling', 'Lady Style', 'Lady Styling', 'Ladies Style'] }),
  s('theory', 'Theory', 'topics', { topic: true, aliases: ['Musicality'] }),
]

/** Case-, accent- and punctuation-insensitive key: 'Salsa On1' → 'salsaon1', 'Danzón' → 'danzon'. */
export function danceStyleKey(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

const byRank = (a: DanceStyleDef, b: DanceStyleDef) =>
  (a.rank ?? Number.POSITIVE_INFINITY) - (b.rank ?? Number.POSITIVE_INFINITY) || a.name.localeCompare(b.name)

export const DANCE_FAMILIES: (DanceFamily & { accent: string })[] = FAMILY_DEFS.map(f => ({ ...f, accent: WD[f.token] }))

/** Every style, popularity order. Includes workshop topics (filter with `!s.topic`). */
export const ALL_DANCE_STYLES: DanceStyle[] = [...STYLE_DEFS]
  .sort(byRank)
  .map(d => ({ ...d, aliases: d.aliases ?? [], display: d.label ?? d.name }))

/** Dances a person can pick — popularity order, topics excluded. */
export const DANCE_STYLES: DanceStyle[] = ALL_DANCE_STYLES.filter(st => !st.topic)

const INDEX = new Map<string, DanceStyle>()
for (const st of ALL_DANCE_STYLES) {
  for (const k of [st.name, st.id, st.label, ...st.aliases]) {
    if (!k) continue
    const key = danceStyleKey(k)
    if (key && !INDEX.has(key)) INDEX.set(key, st)
  }
}

/** Resolve any stored value / alias / id to its taxonomy entry. */
export function findDanceStyle(value: string | null | undefined): DanceStyle | undefined {
  if (!value) return undefined
  return INDEX.get(danceStyleKey(value))
}

/** The canonical stored name for a value; unknown values are returned trimmed, unchanged. */
export function canonicalDanceStyle(value: string): string {
  return findDanceStyle(value)?.name ?? String(value).trim()
}

/** How to show a stored value: taxonomy display name, or the raw value. */
export function displayDanceStyle(value: string): string {
  return findDanceStyle(value)?.display ?? String(value).trim()
}

/** De-duplicate (by taxonomy entry) and sort by popularity; unknown values go last, in input order. */
export function sortDanceStyles(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const known: { v: string, st: DanceStyle }[] = []
  const unknown: string[] = []
  for (const v of values) {
    if (!v) continue
    const st = findDanceStyle(v)
    const key = st ? st.id : `raw:${danceStyleKey(v)}`
    if (seen.has(key)) continue
    seen.add(key)
    if (st) known.push({ v, st })
    else unknown.push(v)
  }
  const order = new Map(ALL_DANCE_STYLES.map((st, i) => [st.id, i]))
  known.sort((a, b) => order.get(a.st.id)! - order.get(b.st.id)!)
  return [...known.map(k => k.v), ...unknown]
}

/** True when two stored values mean the same style ('Rueda' ~ 'Rueda de Casino'). */
export function sameDanceStyle(a: string, b: string): boolean {
  const sa = findDanceStyle(a)
  const sb = findDanceStyle(b)
  if (sa && sb) return sa.id === sb.id
  return danceStyleKey(a) === danceStyleKey(b)
}

/** Search: name, label, aliases and family name, accent-insensitive substring. */
export function matchesDanceStyleQuery(style: DanceStyle, query: string): boolean {
  const q = danceStyleKey(query)
  if (!q) return true
  const family = FAMILY_DEFS.find(f => f.id === style.family)?.name ?? ''
  return [style.name, style.label, family, ...style.aliases].some(t => t && danceStyleKey(t).includes(q))
}

export function danceFamily(id: DanceFamilyId) {
  return DANCE_FAMILIES.find(f => f.id === id)!
}

/** Brand colour (hex from WD) for a stored value: style override → family → amber. */
export function danceStyleAccent(value: string): string {
  const st = findDanceStyle(value)
  if (!st) return WD.amber600
  return WD[st.token ?? danceFamily(st.family).token]
}

/** Direct sub-styles of a style. */
export function danceStyleChildren(id: string): DanceStyle[] {
  return ALL_DANCE_STYLES.filter(st => st.parent === id)
}

/**
 * Best-guess style mentioned in free text ("Nail my salsa on2 turns" → 'Salsa NY').
 * Whole-word match on names/aliases of the ranked (common) styles only, so words
 * like "bar", "van" or "son" never tag a goal (terms under 4 letters are skipped). Longest match wins.
 */
export function detectDanceStyle(text: string): DanceStyle | undefined {
  const norm = (v: string) => ` ${String(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `
  const hay = norm(text)
  let best: { st: DanceStyle, len: number } | undefined
  for (const st of DANCE_STYLES) {
    if (st.rank == null) continue
    for (const term of [st.name, st.label, ...st.aliases]) {
      if (!term) continue
      const needle = norm(term)
      if (needle.trim().length < 4 || !hay.includes(needle)) continue
      if (!best || needle.length > best.len) best = { st, len: needle.length }
    }
  }
  return best?.st
}

/** True when a and b are the same style or one is a variant (any depth) of the other: 'Rueda' ~ 'Casino' ~ 'Salsa'. */
export function relatedDanceStyles(a: string, b: string): boolean {
  if (sameDanceStyle(a, b)) return true
  const sa = findDanceStyle(a)
  const sb = findDanceStyle(b)
  if (!sa || !sb) return false
  const ancestors = (st: DanceStyle) => {
    const out = new Set<string>()
    for (let p = st.parent; p && !out.has(p); p = ALL_DANCE_STYLES.find(x => x.id === p)?.parent) out.add(p)
    return out
  }
  return ancestors(sa).has(sb.id) || ancestors(sb).has(sa.id)
}
