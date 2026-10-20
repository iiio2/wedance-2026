export type EventType = 'class' | 'social' | 'practica' | 'workshop'

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday'

export interface CityEvent {
  id: string
  name: string
  type: EventType
  /** Chip label when it differs from the type bucket (a synced Concert/Show groups as social). */
  typeLabel?: string
  style: string
  day: DayOfWeek
  time: string
  duration: number
  venue: string
  address: string
  organizer: string
  teacherId?: string
  djId?: string
  organizerId?: string
  level?: 'Beginner' | 'Intermediate' | 'Advanced' | 'All levels'
  description?: string
  accentColor: string
  attendeeCount: number
  recurring: boolean
  date?: string
  venueHandle?: string
}

export interface City {
  slug: string
  name: string
  country: string
  dancerCount: number
  styles: string[]
  eventCount: number
}
