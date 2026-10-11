/**
 * Server-side ticket price registry.
 *
 * Prices are authoritative here — the client sends only the ticket name,
 * never the amount.  This prevents price-tampering (a malicious client
 * sending €1 for a €210 pass).
 *
 * When tickets move to a database table this file goes away; the server
 * will read prices from the DB instead.
 *
 * Prices are in **euro cents** (Stripe's unit_amount).
 */

interface TicketEntry {
  name: string
  priceCents: number
  soldOut?: boolean
}

/**
 * Per-festival referral discount percentage (0–100). When a dancer buys
 * through a friend's referral link, this percentage is taken off the total.
 * Festivals not listed here have no referral discount available.
 */
const referralDiscountPercent: Record<string, number> = {
  'meneate-viena-2026': 10,
  'cuban-fire-munich-2026': 10,
  'caribbean-urban-fire-munich-2026': 10,
  'agua-pichi-2027': 10,
}

const registry: Record<string, TicketEntry[]> = {
  'meneate-viena-2026': [
    { name: 'Full Pass', priceCents: 21_000, soldOut: true },
    { name: 'Friday Pass', priceCents: 6_000 },
    { name: 'Saturday Pass', priceCents: 12_000 },
    { name: 'Sunday Pass', priceCents: 8_400 },
    { name: 'Party Pass', priceCents: 9_600 },
  ],
  'cuban-fire-munich-2026': [
    { name: 'Full Pass 5H + Party', priceCents: 10_000 },
    { name: 'Full Pass 4H + Party', priceCents: 8_500 },
    { name: '3 Workshops', priceCents: 6_500 },
    { name: '2 Workshops', priceCents: 4_500 },
    { name: '1 Workshop', priceCents: 2_500 },
    { name: 'Party Only', priceCents: 1_000 },
  ],
  'caribbean-urban-fire-munich-2026': [
    { name: 'Full Pass (3 Workshops)', priceCents: 6_000 },
    { name: '2 Workshops', priceCents: 4_500 },
    { name: '1 Workshop', priceCents: 2_500 },
  ],
  'agua-pichi-2027': [
    { name: 'Full Pass', priceCents: 17_000 },
    { name: 'Super-Early-Bird Party Pass', priceCents: 5_000, soldOut: true },
    { name: 'Party Pass', priceCents: 9_000 },
    { name: 'Saturday Pass', priceCents: 8_000 },
    { name: 'Thursday Roots Pass', priceCents: 4_500 },
  ],
}

/**
 * Look up a ticket's price in cents.  Returns `null` when the festival
 * or ticket name is not in the registry (the caller should 404).
 */
export function getTicketPriceCents(
  festivalSlug: string,
  ticketName: string,
): { priceCents: number; soldOut: boolean } | null {
  const tickets = registry[festivalSlug]
  if (!tickets) return null
  const match = tickets.find((t) => t.name === ticketName)
  if (!match) return null
  return { priceCents: match.priceCents, soldOut: !!match.soldOut }
}

/**
 * Return the referral discount percentage for a festival, or 0 if no
 * referral program is configured.
 */
export function getReferralDiscountPercent(festivalSlug: string): number {
  return referralDiscountPercent[festivalSlug] ?? 0
}

/**
 * Per-festival early-bird ticket config. Each entry describes an
 * early-bird offer with a deadline — the date the discounted price
 * expires and goes up to the regular price.
 */
interface EarlyBirdConfig {
  /** Name of the early-bird ticket/offer shown in the alert. */
  offerName: string
  /** ISO date (YYYY-MM-DD) when the early-bird price expires. */
  deadline: string
  /** Early-bird price in euro cents. */
  priceCents: number
  /** Regular price in euro cents (after the deadline). */
  regularPriceCents: number
}

const earlyBirds: Record<string, EarlyBirdConfig> = {
  'agua-pichi-2027': {
    offerName: 'Early Bird Full Pass',
    deadline: '2027-04-01',
    priceCents: 12_000,
    regularPriceCents: 17_000,
  },
}

/**
 * Return the active early-bird info for a festival, or `null` if none
 * exists or the deadline has already passed.
 */
export function getEarlyBirdInfo(festivalSlug: string): {
  offerName: string
  deadline: string
  priceCents: number
  regularPriceCents: number
} | null {
  const config = earlyBirds[festivalSlug]
  if (!config) return null
  if (new Date(config.deadline) <= new Date()) return null
  return config
}
