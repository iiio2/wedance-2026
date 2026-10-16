/**
 * Booking inquiries: what someone can ask to book an artist or venue for.
 * Shared by the form on /@handle and the router that validates it.
 */
import { z } from 'zod'

export const INQUIRY_WHAT: Record<'artist' | 'venue' | 'organizer' | 'promoter', string[]> = {
  artist: ['Workshop or class', 'Show', 'DJ set', 'Festival', 'Party', 'Private event', 'Something else'],
  venue: ['Party', 'Workshop or class', 'Festival', 'Private event', 'Something else'],
  organizer: ['Collaboration', 'Event for us', 'Something else'],
  promoter: ['Book an artist', 'Tour booking', 'Festival slot', 'Collaboration', 'Something else'],
}

export const inquirySchema = z.object({
  handle: z.string().min(1).max(200),
  name: z.string().trim().min(1, 'Your name').max(120),
  email: z.string().trim().toLowerCase().email('An email they can answer'),
  phone: z.string().trim().max(40).regex(/^[+\d][\d\s()./-]{5,}$/, 'A phone number, e.g. +49 170 1234567').optional().or(z.literal('')).default(''),
  organization: z.string().trim().max(160).optional().default(''),
  what: z.string().trim().min(1, 'What it’s for').max(60),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')).default(''),
  city: z.string().trim().max(120).optional().default(''),
  guests: z.number().int().min(1).max(100_000).nullable().optional(),
  budget: z.string().trim().max(80).optional().default(''),
  message: z.string().trim().min(10, 'A few words about it').max(2000),
  /** Send it as a page the (signed-in) asker runs. */
  asProfile: z.string().max(200).optional(),
  // Honeypot: people never see this field; bots fill it in.
  website: z.string().max(0).optional().default(''),
})
export type InquiryInput = z.infer<typeof inquirySchema>
