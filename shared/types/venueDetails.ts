/**
 * Venue details (migration 0036): the kinds of venue and amenities WeDance v3
 * offered (same values, so synced data lines up), opening hours and the
 * booking contacts only signed-in organizers see.
 */
export const VENUE_TYPES = [
  { value: 'DanceStudio', label: 'Dance studio' },
  { value: 'Club', label: 'Bar or club' },
  { value: 'Restaurant', label: 'Restaurant' },
  { value: 'Cafe', label: 'Café' },
  { value: 'Hotel', label: 'Hotel' },
  { value: 'Theatre', label: 'Theatre' },
  { value: 'CulturalCenter', label: 'Cultural centre' },
  { value: 'CommunityCenter', label: 'Community centre' },
  { value: 'SportsHall', label: 'Sports hall or gym' },
  { value: 'EventSpace', label: 'Event space' },
  { value: 'OpenAir', label: 'Open air' },
  { value: 'Other', label: 'Other' },
  { value: 'Closed', label: 'Permanently closed' },
] as const

export const VENUE_AMENITIES = [
  { value: 'DanceFloor', label: 'Dance floor' },
  { value: 'SoundSystem', label: 'Sound system' },
  { value: 'Bar', label: 'Bar' },
  { value: 'DJBooth', label: 'DJ booth' },
  { value: 'Stage', label: 'Stage' },
  { value: 'Mirrors', label: 'Mirrors' },
  { value: 'AirConditioning', label: 'Air conditioning' },
  { value: 'Heating', label: 'Heating' },
  { value: 'Restrooms', label: 'Restrooms' },
  { value: 'CoatCheck', label: 'Coat check' },
  { value: 'Lockers', label: 'Lockers' },
  { value: 'Parking', label: 'Parking' },
  { value: 'WheelchairAccessibility', label: 'Wheelchair access' },
  { value: 'Security', label: 'Security' },
  { value: 'WiFi', label: 'Wi-Fi' },
  { value: 'OpenAirAreas', label: 'Open-air areas' },
] as const

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const

/** One line of opening hours: a day and its hours as the venue writes them ("18:00–02:00"). */
export type OpeningHours = { day: (typeof WEEKDAYS)[number]; hours: string }[]

/** Booking contacts: only for signed-in organizers (event editor), never public. */
export type VenueContact = { phone?: string; email?: string; whatsapp?: string; telegram?: string }

export const venueTypeLabel = (v: string | null | undefined) => VENUE_TYPES.find(t => t.value === v)?.label ?? (v || '')
export const amenityLabel = (v: string) => VENUE_AMENITIES.find(a => a.value === v)?.label ?? v
