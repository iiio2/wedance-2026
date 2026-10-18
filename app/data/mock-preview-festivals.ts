import { WD } from '../lib/brand'

/**
 * Demo festivals for /my-plan?preview=1 only — they are not in the festivals
 * table. Kept in a mock-*.ts file so scripts/cleanup-mock-plan-items.ts finds
 * their slugs: onboarding auto-fill used to write them into real plans.
 */
export const previewOnlyFestivals = [
  {
    slug: 'bachata-stars-barcelona-2026',
    name: 'Bachata Stars Barcelona',
    startDate: '2026-07-03',
    endDate: '2026-07-06',
    location: 'Barcelona, Spain',
    venue: 'Sala Apolo',
    logo: 'https://ui-avatars.com/api/?name=BSB&size=80&background=7c3aed&color=fff&bold=true&rounded=true',
    accentColor: WD.violet600,
    workshopCount: 24,
    ticketUrl: 'https://bachatastarsbarcelona.com/tickets',
    ticketFromPrice: 145,
    // Set close to "today" so the urgent-deadline UI has something to
    // fire on in the preview demo. When real data lands this becomes
    // whatever the organizer sets.
    earlyBirdDeadline: '2026-07-06',
    styles: ['Bachata'] as string[],
  },
  {
    slug: 'timba-fest-london-2026',
    name: 'Timba Fest London',
    startDate: '2026-09-18',
    endDate: '2026-09-21',
    location: 'London, UK',
    venue: 'Village Underground',
    logo: 'https://ui-avatars.com/api/?name=TFL&size=80&background=0ea5e9&color=fff&bold=true&rounded=true',
    accentColor: WD.sky500,
    workshopCount: 18,
    ticketUrl: 'https://timbafestlondon.co.uk/tickets',
    ticketFromPrice: 95,
    earlyBirdDeadline: undefined as string | undefined,
    styles: ['Timba', 'Salsa'] as string[],
  },
  {
    slug: 'kizomba-prague-2026',
    name: 'Kizomba & Urban Kiz Prague',
    startDate: '2026-10-10',
    endDate: '2026-10-12',
    location: 'Prague, Czech Republic',
    venue: 'La Loca Prague',
    logo: 'https://ui-avatars.com/api/?name=KPR&size=80&background=ec4899&color=fff&bold=true&rounded=true',
    accentColor: WD.pink500,
    workshopCount: 16,
    ticketUrl: 'https://kizombaprague.com/tickets',
    ticketFromPrice: 110,
    earlyBirdDeadline: undefined as string | undefined,
    styles: ['Kizomba', 'Semba'] as string[],
  },
]
