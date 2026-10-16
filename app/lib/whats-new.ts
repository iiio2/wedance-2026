/**
 * What's new on WeDance — product updates shown on /whats-new.
 *
 * Add new entries at the TOP (newest first); the page sorts by date anyway.
 * Images live in public/updates/<date>-<slug>.webp (square, ≤250 KB) with a
 * .jpg twin for og:image (social scrapers still prefer JPEG).
 */
export interface WhatsNewEntry {
  /** Stable id, also the #anchor on the page: `<date>-<slug>`. */
  id: string
  /** ISO date (YYYY-MM-DD) the update went live. */
  date: string
  title: string
  /** 1–3 sentences, plain text. */
  description: string
  /** Short label shown as a pill, e.g. "Beta". */
  tag?: string
  image?: {
    /** Path under public/, e.g. /updates/2026-10-16-flyers-beta.webp */
    src: string
    /** JPEG twin used for og:image when this is the newest entry. */
    og?: string
    alt: string
  }
  /** Where to try the feature. Must be a real route in the app. */
  cta?: { label: string; to: string }
  /** The Instagram post announcing it; the image links there. */
  instagram?: string
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: '2026-10-16-event-flyers-beta',
    date: '2026-10-16',
    title: 'Event flyers (beta)',
    tag: 'Beta',
    description:
      'Organizers can now make an event flyer in about a minute: add your event, add the DJ or teacher photo, tap Flyer. We’re looking for beta testers — try it and tell us what breaks.',
    image: {
      src: '/updates/2026-10-16-flyers-beta.webp',
      og: '/updates/2026-10-16-flyers-beta.jpg',
      alt: 'WeDance announcement: two phones showing event flyers made on WeDance — La Clave in München with DJ Hamza and DJ Ellis Prince White at Luma — with a red Beta sticker and the headline “Your event flyer in 1 minute. Beta testers wanted, for dance event organizers.”',
    },
    cta: { label: 'Make your flyer', to: '/business/events/new' },
    instagram: 'https://www.instagram.com/p/DekJru-sF60/',
  },
]

/** Entries newest first. */
export function sortedWhatsNew(entries: WhatsNewEntry[] = WHATS_NEW): WhatsNewEntry[] {
  return [...entries].sort((a, b) => b.date.localeCompare(a.date))
}

/** "16 October 2026" — fixed locale + UTC so SSR and the browser agree. */
export function formatWhatsNewDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}
