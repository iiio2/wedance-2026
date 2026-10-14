/**
 * A festival's details on its event (events.festival, migration 0032): what a
 * festival page shows beyond an ordinary event. Edited in the Business event
 * editor; rendered by FestivalView via events.festival.
 */
export type FestivalPass = {
  name: string
  price: number
  /** Weekday names this pass covers ("Friday"); empty = every day. */
  days: string[]
  description?: string
  soldOut?: boolean
  workshopCount?: number
  includesParty?: boolean
}

export type FestivalSession = {
  /** Stable: dancers' picks are stored as `<key>:<id>`. */
  id: string
  /** Local date, yyyy-mm-dd. */
  date: string
  time: string
  /** Minutes. */
  duration: number
  type: 'workshop' | 'party'
  title: string
  /** Artist profile handle (in the line-up), or '' for none. */
  artist: string
  /** Who they teach it with (couples, a band): more line-up handles. */
  with?: string[]
  style: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  room?: string
  /** Another place than the main venue ("Danzón, Johannesgasse 3"). */
  venue?: string
  description?: string
}

export type FestivalDetails = {
  /** The festival's permanent key (its old slug). Set once, never edited. */
  key: string
  logo?: string
  accentColor?: string
  socialLinks?: { platform: string; url: string }[]
  practicalInfo?: string[]
  passes?: FestivalPass[]
  sessions?: FestivalSession[]
  /** Teacher videos: artist handle → YouTube embed URL. */
  videos?: Record<string, string>
}
