/**
 * Valibot schemas for every client form. Limits mirror the zod inputs of the
 * matching tRPC procedure (named in each section) so the client catches what
 * the server would reject, with a readable message instead of a zod dump.
 */
import * as v from 'valibot'
import { DANCE_LEVELS } from '../utils/styleLevelMix'
import {
  DANCE_ROLES,
  commaList,
  email,
  isoDate,
  newPassword,
  notCollected,
  optionalEmail,
  optionalIsoDate,
  optionalIsoTime,
  optionalText,
  optionalWebUrl,
  requiredText,
  trimmedText,
  webUrl,
} from './fields'

// ── Auth (auth.login / register / requestMagicLink / resetPassword) ──────────

export const LoginSchema = v.object({
  email: email(),
  password: v.pipe(v.string(), v.nonEmpty('Password is required.')),
})

export const RegisterSchema = v.object({
  name: requiredText('Name is required.'),
  email: email(),
  password: newPassword(),
})

export const RecoverySchema = v.object({
  email: email(),
})

export const ResetPasswordSchema = v.pipe(
  v.object({
    password: newPassword(),
    confirmPassword: v.string(),
  }),
  v.forward(
    v.partialCheck(
      [['password'], ['confirmPassword']],
      ({ password, confirmPassword }) => password === confirmPassword,
      'Passwords do not match.',
    ),
    ['confirmPassword'],
  ),
)

const TICKET_EMAIL_MESSAGE = 'Please enter the email you used to buy your ticket.'
export const ClaimTicketSchema = v.object({
  email: email(TICKET_EMAIL_MESSAGE, TICKET_EMAIL_MESSAGE),
})

// ── Account (auth.completeOnboarding / profile.update / auth.changePassword) ──

/** Only the fields the chosen persona collects are validated; the rest drop out. */
export function onboardingDetailsSchema(collects: { city?: boolean; styles?: boolean; role?: boolean }) {
  return v.object({
    city: collects.city ? requiredText('Please tell us your city.') : notCollected(),
    danceStyles: collects.styles
      ? v.pipe(v.array(v.string()), v.minLength(1, 'Pick at least one dance style.'))
      : notCollected(),
    role: collects.role ? v.pipe(v.string(), v.picklist(DANCE_ROLES, 'Choose lead, follow, or both.')) : notCollected(),
  })
}

const SOCIAL_MAX = 200
export const ProfileSettingsSchema = v.object({
  name: requiredText('Name is required.'),
  // Blank city / bio / socials are sent as '' — that clears them.
  city: trimmedText(),
  danceStyles: v.array(v.string()),
  danceLevels: v.record(v.string(), v.picklist(DANCE_LEVELS)),
  role: v.pipe(v.string(), v.transform(s => s || undefined), v.optional(v.picklist(DANCE_ROLES))),
  // '' clears the photo (sets null in db); a Cloudinary URL is stored as-is.
  photo: optionalWebUrl('Enter a valid image URL.'),
  bio: v.pipe(trimmedText(), v.maxLength(500, 'Keep your bio under 500 characters.')),
  instagram: v.pipe(trimmedText(), v.maxLength(SOCIAL_MAX, 'Instagram handle is too long.')),
  youtube: v.pipe(trimmedText(), v.maxLength(SOCIAL_MAX, 'YouTube handle is too long.')),
  website: v.pipe(trimmedText(), v.maxLength(SOCIAL_MAX, 'Website is too long.')),
  profilePublic: v.boolean(),
})

export const ChangePasswordSchema = v.object({
  current: v.pipe(v.string(), v.nonEmpty('Enter your current password.')),
  next: newPassword('Enter a new password.'),
})

/** Typing your exact name confirms account deletion. */
export function deleteAccountSchema(name: string | null | undefined) {
  return v.object({
    confirmation: v.pipe(v.string(), v.check(s => !!name && s === name, `Please type "${name ?? ''}" to confirm.`)),
  })
}

// ── Plan & goals (client-side state) ─────────────────────────────────────────

export const GoalSchema = v.object({
  title: requiredText('Name your goal.'),
  why: v.optional(trimmedText(), ''),
})

export const PartnerNameSchema = v.object({
  name: requiredText('Add your partner’s name.'),
})

const CONTACT_LINK_RE = /^https?:\/\/(wa\.me|chat\.whatsapp\.com|t\.me|telegram\.me)\//i

export const RidePostSchema = v.object({
  type: v.picklist(['offering', 'looking']),
  originCity: requiredText('Add the city you\u2019re leaving from.'),
  date: isoDate('Pick a date.'),
  seats: v.optional(v.pipe(
    v.number('Enter the number of seats.'),
    v.integer('Seats must be a whole number.'),
    v.minValue(1, 'Offer at least 1 seat.'),
    v.maxValue(6, 'You can offer up to 6 seats.'),
  )),
  contactLink: v.optional(v.pipe(
    v.string(),
    v.trim(),
    v.transform(s => s || undefined),
    v.optional(v.pipe(
      v.string(),
      v.url('Enter a valid link.'),
      v.regex(CONTACT_LINK_RE, 'Use a WhatsApp (wa.me) or Telegram (t.me) link.'),
    )),
  )),
})

// Discover dancers (festival page preview — mock data, no API).
export const DanceCardSchema = v.object({
  role: v.pipe(v.unknown(), v.picklist(['lead', 'follow'], 'Pick lead or follow.')),
  styles: v.pipe(v.array(v.string()), v.minLength(1, 'Pick at least one style.')),
})

export const DiscoverProfileSchema = v.object({
  name: requiredText('Name is required.'),
  city: requiredText('City is required.'),
})

export const DanceFeedbackSchema = v.object({
  text: requiredText('Write a few words first.'),
})

// ── Event inquiry (feedback.inquiry) ────────────────────────────────────────

export const EventInquirySchema = v.object({
  eventType: optionalText(100, 'Keep the event type under 100 characters.'),
  date: optionalText(100, 'Keep the date under 100 characters.'),
  city: optionalText(100, 'Keep the city under 100 characters.'),
  guests: optionalText(100, 'Keep the guest count under 100 characters.'),
  needs: v.pipe(
    requiredText('Tell us what you need for your event.'),
    v.maxLength(3000, 'Please keep it under 3,000 characters.'),
  ),
  name: optionalText(160, 'Keep your name under 160 characters.'),
  email: email('Add your email so we can reply.'),
})

// ── Community (feedback.report / giveaway.enter / cityVideo.submit /
//    askLocals.ask + recommend / review.create / election.nominate) ─────────

export const ReportProblemSchema = v.object({
  description: v.pipe(
    requiredText('Please describe what went wrong.'),
    v.maxLength(5000, 'Please keep it under 5,000 characters.'),
  ),
  email: optionalEmail(),
})

export const GiveawayEntrySchema = v.object({
  email: email('Enter your email to join.'),
})

export const VideoSubmissionSchema = v.object({
  title: v.pipe(
    requiredText('Give your video a title.'),
    v.minLength(2, 'Title must be at least 2 characters.'),
    v.maxLength(120, 'Keep the title under 120 characters.'),
  ),
  videoUrl: webUrl('Paste the link to your video.', 'Paste the full video link, starting with https://'),
  danceStyle: optionalText(60, 'Keep the dance style under 60 characters.'),
  email: email(),
})

export const AskLocalsSchema = v.object({
  question: v.pipe(
    trimmedText(),
    v.minLength(3, 'Ask a real question.'),
    v.maxLength(280, 'Keep your question under 280 characters.'),
  ),
})

export const RecommendPlaceSchema = v.object({
  targetType: v.picklist(['organizer', 'venue']),
  targetName: v.pipe(
    trimmedText(),
    v.minLength(2, 'Name the organizer or venue.'),
    v.maxLength(160, 'Keep the name under 160 characters.'),
  ),
  text: optionalText(1000, 'Keep it under 1,000 characters.'),
})

export const ReviewSchema = v.object({
  rating: v.pipe(
    v.number('Pick a rating.'),
    v.integer('Pick a rating.'),
    v.minValue(1, 'Pick a rating from 1 to 5 stars.'),
    v.maxValue(5, 'Pick a rating from 1 to 5 stars.'),
  ),
  text: optionalText(1000, 'Keep your review under 1,000 characters.'),
})

export const NominationSchema = v.object({
  guidelines: v.pipe(
    trimmedText(),
    v.minLength(20, 'Describe the guidelines you would run on (at least a sentence or two).'),
    v.maxLength(8000, 'Keep your guidelines under 8,000 characters.'),
  ),
  statement: optionalText(600, 'Keep your statement under 600 characters.'),
})

// ── Bookings & gigs (booking.request / gigs.create) ──────────────────────────

export function bookingRequestSchema({ free }: { free: boolean }) {
  return v.object({
    spaceId: requiredText('Pick an area to book.'),
    title: v.pipe(requiredText('Give your event a name.'), v.maxLength(160, 'Keep the event name under 160 characters.')),
    eventType: v.pipe(trimmedText(), v.maxLength(40)),
    styles: v.array(v.string()),
    eventDate: optionalIsoDate(),
    startTime: optionalIsoTime('Pick a valid start time.'),
    endTime: optionalIsoTime('Pick a valid end time.'),
    artists: commaList(),
    organizerHandle: optionalText(160, 'Keep the organiser handle under 160 characters.'),
    message: optionalText(2000, 'Keep your message under 2,000 characters.'),
    name: optionalText(160, 'Keep your name under 160 characters.'),
    headcount: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform(n => (n === '' ? undefined : Number(n))),
      v.optional(v.pipe(
        v.number('Guests must be a number.'),
        v.integer('Guests must be a whole number.'),
        v.minValue(1, 'Guests must be at least 1.'),
        v.maxValue(100000, 'That’s a lot of guests — check the number.'),
      )),
    ),
    email: email('Add an email so the moderator can reply.'),
    terms: v.pipe(v.boolean(), v.literal(true, free ? 'Please agree to the community guidelines.' : 'Please accept the booking terms.')),
  })
}

export const GigSchema = v.object({
  kind: v.picklist(['role', 'offer']),
  category: requiredText('Pick a service category.'),
  title: requiredText('Give your offering a title.'),
  posterName: requiredText('Add your name or artist name.'),
  posterType: requiredText('Pick who is posting.'),
  location: requiredText('Add your location or base.'),
  styles: v.array(v.string()),
  when: requiredText('Say when you’re available.'),
  compensation: requiredText('Add your rate (or “On request”).'),
  deadline: optionalIsoDate('Pick a valid deadline.'),
  contactEmail: email('Add a contact email.'),
  contactUrl: optionalWebUrl(),
  entityUrl: optionalWebUrl(),
})

// ── Organizers (festival.submitDraft wizard steps) ───────────────────────────

export const FestivalBasicsSchema = v.pipe(
  v.object({
    name: requiredText('Festival name is required.'),
    startDate: v.pipe(v.string(), v.nonEmpty('Start date is required.')),
    endDate: v.pipe(v.string(), v.nonEmpty('End date is required.')),
  }),
  v.forward(
    v.partialCheck(
      [['startDate'], ['endDate']],
      ({ startDate, endDate }) => !startDate || !endDate || endDate >= startDate,
      'End date must be on or after start date.',
    ),
    ['endDate'],
  ),
)

export const FestivalVenueSchema = v.object({
  name: requiredText('Venue name is required.'),
  address: requiredText('Venue address is required.'),
})

// Lineup / schedule / ticket rows; the page prefixes "Artist 2: …".
export const FestivalArtistSchema = v.object({ name: requiredText('name is required.') })
export const FestivalWorkshopSchema = v.object({ title: requiredText('title is required.') })
export const FestivalTicketSchema = v.object({ name: requiredText('name is required.') })

// ── Admin (communityGroup.create / giveaway.create) ──────────────────────────

export const CommunityGroupSchema = v.object({
  citySlug: requiredText('Add the city slug.'),
  name: requiredText('Add the group name.'),
  platform: v.picklist(['whatsapp', 'telegram', 'facebook', 'other']),
  inviteUrl: webUrl('Add the invite URL.'),
  styles: commaList(),
  source: optionalText(),
  verified: v.boolean(),
})

export const GiveawaySchema = v.pipe(
  v.object({
    citySlug: requiredText('Add the city slug.'),
    sponsorName: requiredText('Add the sponsor name.'),
    title: requiredText('Add a title.'),
    description: requiredText('Add a short description.'),
    prizeDescription: requiredText('Describe the prize.'),
    ctaUrl: webUrl('Add the CTA URL.'),
    imageUrl: optionalWebUrl(),
    termsUrl: optionalWebUrl(),
    startsAt: isoDate('Pick a start date.'),
    endsAt: isoDate('Pick an end date.'),
    status: v.picklist(['active', 'ended', 'draft']),
  }),
  v.forward(
    v.partialCheck(
      [['startsAt'], ['endsAt']],
      ({ startsAt, endsAt }) => !startsAt || !endsAt || endsAt > startsAt,
      'End date must be after the start date.',
    ),
    ['endsAt'],
  ),
)
