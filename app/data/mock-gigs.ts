/**
 * Mock gigs — the dance scene's opportunity board.
 * Two post kinds:
 *   'role'  — an organizer / client posts an open role they need filled.
 *   'offer' — an artist posts a service they offer.
 * Demo content: open roles use real festival contexts (Agua Pichi is
 * genuinely recruiting emerging Cuban teachers per its strategy); offers
 * link to real artist profiles where possible. Replace with real posts
 * when the board is live.
 */
export type GigKind = 'role' | 'offer'
export type GigCategory = 'Teacher' | 'DJ' | 'MC' | 'Performer' | 'Show' | 'Photographer' | 'Organizer'

export interface Gig {
  id: string
  kind: GigKind
  category: GigCategory
  title: string
  posterName: string
  posterType: 'Festival' | 'Organizer' | 'Private event' | 'School' | 'Artist'
  location: string
  styles: string[]
  when: string
  compensation: string
  deadline?: string
  href?: string
  accent: string
}

export const mockGigs: Gig[] = [
  // ── Open roles (organizers / clients looking for talent) ──────────────
  {
    id: 'g1',
    kind: 'role',
    category: 'Teacher',
    title: 'Emerging Cuban teacher wanted',
    posterName: 'Agua Pichi 2027',
    posterType: 'Festival',
    location: 'Munich, Germany',
    styles: ['Timba', 'Casino'],
    when: '1–4 July 2027',
    compensation: 'Fee + travel + accommodation',
    deadline: '2026-12-01',
    href: '/events/agua-pichi-2027',
    accent: '#dc2626',
  },
  {
    id: 'g2',
    kind: 'role',
    category: 'DJ',
    title: 'DJ for the Saturday timba floor',
    posterName: 'Cuban Fire Munich',
    posterType: 'Festival',
    location: 'Munich, Germany',
    styles: ['Timba', 'Son', 'Rumba'],
    when: 'Saturday night',
    compensation: 'Paid · €300–450',
    deadline: '2026-08-15',
    href: '/events/cuban-fire-munich-2026',
    accent: '#0891b2',
  },
  {
    id: 'g3',
    kind: 'role',
    category: 'Show',
    title: 'Cuban show duo for a wedding',
    posterName: 'Private client',
    posterType: 'Private event',
    location: 'Starnberg, Germany',
    styles: ['Salsa', 'Rumba'],
    when: '16 August 2026',
    compensation: 'On request',
    deadline: '2026-07-20',
    href: '/for-events',
    accent: '#a855f7',
  },
  {
    id: 'g4',
    kind: 'role',
    category: 'MC',
    title: 'Bilingual MC / host',
    posterName: 'Menéate Viena',
    posterType: 'Festival',
    location: 'Vienna, Austria',
    styles: ['All'],
    when: 'Mar 2027 edition',
    compensation: 'Fee + pass',
    deadline: '2026-11-30',
    href: '/events/meneate-viena-2026',
    accent: '#f59e0b',
  },
  {
    id: 'g5',
    kind: 'role',
    category: 'Teacher',
    title: 'Weekly bachata teacher',
    posterName: 'Bailala Munich',
    posterType: 'School',
    location: 'Munich, Germany',
    styles: ['Bachata', 'Bachata Dominicana'],
    when: 'Ongoing · Thursdays',
    compensation: 'Per class',
    deadline: '2026-08-01',
    accent: '#16a34a',
  },

  // ── Service offers (artists offering their service) ───────────────────
  {
    id: 'g6',
    kind: 'offer',
    category: 'Teacher',
    title: 'Timba + Ladies workshops across Europe',
    posterName: 'Barbara Jimenez',
    posterType: 'Artist',
    location: 'Based in Italy · travels',
    styles: ['Timba', 'Ladies', 'Afro'],
    when: 'Booking 2026–27',
    compensation: 'On request',
    href: '/artists/barbara',
    accent: '#dc2626',
  },
  {
    id: 'g7',
    kind: 'offer',
    category: 'DJ',
    title: 'Cuban nights for hire',
    posterName: 'Silvio Leroy',
    posterType: 'Artist',
    location: 'Based in Spain · travels',
    styles: ['Rumba', 'Son', 'Timba'],
    when: 'Weekends',
    compensation: 'From €250',
    href: '/artists/silvio',
    accent: '#0891b2',
  },
  {
    id: 'g8',
    kind: 'offer',
    category: 'Show',
    title: 'Show couple for events & galas',
    posterName: 'Ivan & Ivana Jovanovic',
    posterType: 'Artist',
    location: 'Based in Montenegro · travels',
    styles: ['Casino', 'Rueda'],
    when: 'Booking now',
    compensation: 'On request',
    href: '/artists/ivan',
    accent: '#a855f7',
  },
  {
    id: 'g9',
    kind: 'offer',
    category: 'Photographer',
    title: 'Festival & social photography',
    posterName: 'Lens on the Floor',
    posterType: 'Artist',
    location: 'Based in Munich · travels',
    styles: ['All'],
    when: 'Weekends',
    compensation: 'From €400 / event',
    accent: '#ec4899',
  },
]
