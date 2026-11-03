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

/**
 * What a programme item is. 'workshop' (a taught class) and 'party' are the
 * original two; the rest came with parties, shows and concerts using the
 * programme (#455). Old data holds only the first two, so it stays valid.
 */
export const SESSION_TYPES = ['workshop', 'party', 'show', 'concert', 'doors', 'other'] as const
export type SessionType = (typeof SESSION_TYPES)[number]
export type SessionLevel = 'Beginner' | 'Intermediate' | 'Advanced'

export type FestivalSession = {
  /** Stable: dancers' picks are stored as `<key>:<id>`. */
  id: string
  /** Local date, yyyy-mm-dd. */
  date: string
  time: string
  /** Minutes; 0 = a moment, no end (doors open). */
  duration: number
  type: SessionType
  title: string
  /** Artist profile handle (in the line-up), or '' for none. */
  artist: string
  /** Who they teach it with (couples, a band): more line-up handles. */
  with?: string[]
  style: string
  /** Workshops only. Older data may carry one on a party: ignored there. */
  level?: SessionLevel
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
