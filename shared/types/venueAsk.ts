/**
 * Asking a venue through WeDance (profile_invites kind 'venue', migration 0035):
 * what the organizer asks for, and the venue's terms in its answer.
 */
export const VENUE_NEEDS = ['Sound system', 'DJ booth', 'Bar', 'Wooden floor', 'Stage', 'Second room', 'Cloakroom', 'Projector'] as const
export const VENUE_INCLUDES = ['Sound system', 'Bar staff', 'Security', 'Cleaning', 'Door staff', 'Technician'] as const

export type VenueRequest = {
  /** Dancers expected. */
  guests?: number | null
  needs?: string[]
  note?: string
}

export type VenueTerms = {
  /** Free text, so venues can say it their way ("€300", "free from €1,500 bar"). */
  rent?: string
  minSpend?: string
  doorSplit?: string
  deposit?: string
  includes?: string[]
  capacity?: number | null
  notes?: string
}

/** The venue's answer, as the organizer reads it. */
export type VenueAnswer = 'invited' | 'confirmed' | 'proposed' | 'declined'
export const VENUE_ANSWER_LABEL: Record<VenueAnswer, string> = {
  invited: 'Asked · waiting for their answer',
  confirmed: 'Can host it',
  proposed: 'Suggests another date',
  declined: 'Can’t host it',
}
