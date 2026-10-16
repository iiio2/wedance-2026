import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { eq } from 'drizzle-orm'

// When running against a local Postgres via the neon-http-proxy (CI / local Docker),
// redirect the Neon HTTP driver to the proxy endpoint.
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) throw new Error('DATABASE_URL is required')

const sql = neon(DATABASE_URL)
const db = drizzle(sql, { schema })

const festivalData = [
  { slug: 'salsa-open-berlin-2026', name: 'Salsa Open Berlin 2026', startDate: '2026-06-11', endDate: '2026-06-14', maxFreeSpots: 10, stripePaymentLink: 'https://buy.stripe.com/test_placeholder', ticketUrl: null as string | null, city: 'Berlin', country: 'Germany', description: 'Berlin\'s flagship Salsa weekend — workshops, social dancing & live music at the Alte Münze.', styles: ['Salsa', 'Bachata'] as string[], logo: 'https://ui-avatars.com/api/?name=SOB&size=80&background=e11d48&color=fff&bold=true&rounded=true', accentColor: '#e11d48' },
  { slug: 'meneate-viena-2026', name: '¡Menéate Viena! 2026', startDate: '2026-03-26', endDate: '2026-03-29', maxFreeSpots: 10, stripePaymentLink: 'https://buy.stripe.com/test_placeholder', ticketUrl: null, city: 'Vienna', country: 'Austria', description: 'Cuban dance and music at the top of Vienna — workshops, parties, Maykel Blanco concert.', styles: ['Timba', 'Salsa', 'Son', 'Rumba'], logo: 'https://firebasestorage.googleapis.com/v0/b/wedance-4abe3.appspot.com/o/media%2FtvR012ArEpQhCJdPHh6G7sLuqoO2%2F39830bdd-95dd-48e8-9495-15000390c615?alt=media&token=65affea4-baea-4c3f-a373-6ed40b1ff099', accentColor: '#e65100' },
  { slug: 'cuban-fire-munich-2026', name: 'Cuban Fire in Munich', startDate: '2026-03-14', endDate: '2026-03-15', maxFreeSpots: 10, stripePaymentLink: 'https://buy.stripe.com/test_placeholder', ticketUrl: null, city: 'Munich', country: 'Germany', description: 'A weekend of Cuban music and dance at Salsa y Corazon.', styles: ['Timba', 'Salsa', 'Son', 'Rumba'], logo: null as string | null, accentColor: '#d32f2f' },
  { slug: 'caribbean-urban-fire-munich-2026', name: 'Caribbean Urban Fire', startDate: '2026-03-21', endDate: '2026-03-22', maxFreeSpots: 10, stripePaymentLink: 'https://buy.stripe.com/test_placeholder', ticketUrl: null, city: 'Munich', country: 'Germany', description: 'Salsa, Bachata & Hip Hop fusion workshops and parties.', styles: ['Salsa', 'Bachata', 'Hip Hop'], logo: null as string | null, accentColor: '#e53e3e' },
  // O-008 PR 1: Charanga Habanera Munich (single-night concert at La Rumba).
  // TicketTailor event ev_8158745 — buyers verified via /api/webhooks/tickettailor.
  // Concert shape: maxFreeSpots stays 0 (no free roster), tickets handled by TicketTailor (no Stripe link).
  { slug: 'charanga-habanera-munich-2026', name: 'David Calzado & Charanga Habanera in Munich', startDate: '2026-05-23', endDate: '2026-05-23', maxFreeSpots: 0, stripePaymentLink: null, ticketUrl: 'https://www.tickettailor.com/events/montunoclub/2183096', city: 'Munich', country: 'Germany', description: 'Live concert with David Calzado & La Charanga Habanera at La Rumba.', styles: ['Timba', 'Cuban'], logo: null as string | null, accentColor: '#c14a1a' },
  // Agua Pichi 2027.
  { slug: 'agua-pichi-2027', name: 'Agua Pichi 2027', startDate: '2027-07-01', endDate: '2027-07-04', maxFreeSpots: 10, stripePaymentLink: null, ticketUrl: null, city: 'Munich', country: 'Germany', description: 'Munich\'s Cuban festival. Roots & revolution. Every July. Los Van Van headlines.', styles: ['Timba', 'Casino', 'Rumba', 'Son', 'Afro'], logo: 'https://ui-avatars.com/api/?name=AP&size=80&background=c14a1a&color=f5ede0&bold=true&rounded=true', accentColor: '#c14a1a' },
]

async function seed() {
  console.log('Seeding database...')
  const { eq } = require('drizzle-orm')

  // Create all festivals and their dinners
  for (const f of festivalData) {
    const [festival] = await db.insert(schema.festivals).values(f).onConflictDoUpdate({
      target: schema.festivals.slug,
      set: {
        name: f.name,
        startDate: f.startDate,
        endDate: f.endDate,
        maxFreeSpots: f.maxFreeSpots,
        stripePaymentLink: f.stripePaymentLink,
        ticketUrl: f.ticketUrl,
        city: f.city,
        country: f.country,
        description: f.description,
        styles: f.styles,
        logo: f.logo,
        accentColor: f.accentColor,
      },
    }).returning()
    const festivalId = festival?.id || (await db.select().from(schema.festivals).where(eq(schema.festivals.slug, f.slug)))[0]?.id
    if (!festivalId) { console.warn(`Skipping festival ${f.slug}`); continue }
    console.log(`Festival ${f.slug}: ${festivalId}`)
    // Concert-shaped events (maxFreeSpots === 0) get no dinners.
    if (f.maxFreeSpots > 0) {
      await seedDinners(festivalId, f.startDate, f.endDate)
    }
  }

  await seedDancers()

  await seedCityVideos()
  await seedGiveaways()
  await seedCommunityGroups()
  await seedProfiles()

  // Seed signups for salsa-open-berlin only (demo data)
  const { eq: eq2 } = require('drizzle-orm')
  const [salsaOpen] = await db.select().from(schema.festivals).where(eq2(schema.festivals.slug, 'salsa-open-berlin-2026'))
  if (salsaOpen) {
    await seedSignups(salsaOpen.id)
    await seedFestivalSignups(salsaOpen.id)
  }
}

async function seedDinners(festivalId: string, startDate: string, endDate: string) {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const start = new Date(startDate)
  const end = new Date(endDate)
  let count = 0

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().slice(0, 10)
    const day = dayNames[d.getDay()]
    await db.insert(schema.dinners).values({
      festivalId,
      day,
      date: dateStr,
      timeSlot: '19:30 – 21:30',
      restaurant: null,
      restaurantAddress: null,
      revealDate: null,
      maxSize: 6,
    }).onConflictDoNothing()
    count++
  }
  console.log(`Seeded ${count} dinners for festival ${festivalId}`)
}

async function seedDancers() {
  const dancers = [
    { email: 'ana@example.com', name: 'Ana Rodriguez' },
    { email: 'carlos@example.com', name: 'Carlos Rivera' },
    { email: 'maria@example.com', name: 'Maria Gonzalez' },
    { email: 'kenji@example.com', name: 'Kenji Yamamoto' },
    { email: 'nadia@example.com', name: 'Nadia Popov' },
    { email: 'sofia@example.com', name: 'Sofia Chen' },
    { email: 'rafael@example.com', name: 'Rafael Santos' },
    { email: 'camila@example.com', name: 'Camila Vega' },
    { email: 'admin@wedance.vip', name: 'Admin', isAdmin: true },
  ]

  for (const d of dancers) {
    await db.insert(schema.dancers).values(d).onConflictDoNothing()
  }
  console.log(`Seeded ${dancers.length} dancers`)
}

async function seedSignups(festivalId: string) {
  const { eq } = require('drizzle-orm')
  const allDinners = await db.select().from(schema.dinners).where(eq(schema.dinners.festivalId, festivalId)).orderBy(schema.dinners.day, schema.dinners.timeSlot)
  const allDancers = await db.select().from(schema.dancers).where(eq(schema.dancers.isAdmin, false)).orderBy(schema.dancers.email)

  if (!allDinners.length || !allDancers.length) return

  // Sign up 5 dancers for the first dinner, 4 for the second
  for (let i = 0; i < Math.min(5, allDancers.length); i++) {
    await db.insert(schema.dinnerSignups).values({
      dinnerId: allDinners[0].id,
      dancerId: allDancers[i].id,
    }).onConflictDoNothing()
  }
  for (let i = 0; i < Math.min(4, allDancers.length); i++) {
    await db.insert(schema.dinnerSignups).values({
      dinnerId: allDinners[1].id,
      dancerId: allDancers[i].id,
    }).onConflictDoNothing()
  }
  console.log('Seeded dinner signups')
}

async function seedFestivalSignups(festivalId: string) {
  const { eq } = require('drizzle-orm')
  const allDancers = await db.select().from(schema.dancers).where(eq(schema.dancers.isAdmin, false)).orderBy(schema.dancers.email)

  if (!allDancers.length) return

  // Sign up 7 dancers for the festival (to demo 3 free spots left)
  for (let i = 0; i < Math.min(7, allDancers.length); i++) {
    await db.insert(schema.festivalSignups).values({
      festivalId,
      dancerId: allDancers[i].id,
      paidAmount: 0,
    }).onConflictDoNothing()
  }
  console.log('Seeded festival signups (7 dancers)')
}

// --- O-009: city video voting + giveaways seed --------------------------

/** Current competition month key, e.g. '2026-07' (UTC). Mirrors cityVideo router. */
function currentMonth(now = new Date()): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** YouTube hqdefault thumbnail from a watch/youtu.be URL (seed helper). */
function ytThumb(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/)
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null
}

async function seedCityVideos() {
  const month = currentMonth()
  // Real, public YouTube dance videos. Seeded as `approved` so the demo pool
  // is votable out of the box. Clearly seed data — swap for real submissions.
  const videos: Array<{ citySlug: string; title: string; videoUrl: string; danceStyle: string }> = [
    { citySlug: 'munich', title: 'Salsa social night — Munich floor', videoUrl: 'https://www.youtube.com/watch?v=Xa2sWK8w1kU', danceStyle: 'Salsa' },
    { citySlug: 'munich', title: 'Bachata sensual demo', videoUrl: 'https://www.youtube.com/watch?v=7oEWEMDo0DA', danceStyle: 'Bachata' },
    { citySlug: 'munich', title: 'Cuban salsa rueda', videoUrl: 'https://www.youtube.com/watch?v=kz1eSPMYUCM', danceStyle: 'Cuban Salsa' },
    { citySlug: 'berlin', title: 'Berlin bachata jam', videoUrl: 'https://www.youtube.com/watch?v=6Mgqbai3fKo', danceStyle: 'Bachata' },
    { citySlug: 'berlin', title: 'Salsa on2 performance', videoUrl: 'https://www.youtube.com/watch?v=Q0oIoR9mLwc', danceStyle: 'Salsa' },
  ]

  for (const v of videos) {
    await db.insert(schema.cityVideos).values({
      citySlug: v.citySlug,
      submittedByEmail: 'seed@wedance.vip',
      title: v.title,
      videoUrl: v.videoUrl,
      thumbnailUrl: ytThumb(v.videoUrl),
      danceStyle: v.danceStyle,
      competitionMonth: month,
      status: 'approved',
      eloScore: 1500,
    }).onConflictDoNothing()
  }
  console.log(`Seeded ${videos.length} approved city videos for ${month}`)
}

async function seedGiveaways() {
  const now = new Date()
  const endsAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // +30 days
  await db.insert(schema.giveaways).values({
    citySlug: 'munich',
    sponsorName: 'Cuban Fire in Munich',
    title: '2 free festival passes',
    description: 'Enter to win a pair of full-weekend passes to Cuban Fire in Munich. Free entry, no purchase necessary.',
    prizeDescription: '2× full-weekend festival passes',
    ctaUrl: '/festivals/cuban-fire-munich-2026',
    imageUrl: null,
    termsUrl: '/terms',
    startsAt: now,
    endsAt,
    status: 'active',
  }).onConflictDoNothing()
  console.log('Seeded 1 active Munich giveaway')
}

// Community groups directory. This is where the Commander's existing WhatsApp/
// Telegram list gets imported — add rows here (or bulk-insert a CSV) keyed by
// citySlug. The two below are illustrative examples for the demo.
const communityGroupData = [
  { citySlug: 'berlin', name: 'Berlin Salsa & Bachata', platform: 'whatsapp' as const, inviteUrl: 'https://chat.whatsapp.com/example-berlin', styles: ['Salsa', 'Bachata'], source: 'seed-example', verified: false },
  { citySlug: 'munich', name: 'Munich Timba Crew', platform: 'whatsapp' as const, inviteUrl: 'https://chat.whatsapp.com/example-munich', styles: ['Timba', 'Salsa'], source: 'seed-example', verified: true },
]

async function seedCommunityGroups() {
  for (const g of communityGroupData) {
    await db.insert(schema.communityGroups).values(g).onConflictDoNothing()
  }
  console.log(`Seeded ${communityGroupData.length} community groups`)
}

// Pinakothek der Moderne (Open Air) — the real community dance commons: a free,
// self-organised open-air spot under the roof by the museum's exit doors (NOT
// run by the museum). Six community-mapped areas, moderator-managed, guidelines
// from the community. Data sourced from the WeDance v3 database.
async function seedProfiles() {
  const handle = 'pinakothek-der-moderne'
  const existing = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, handle))
  if (existing.length) { console.log('Pinakothek profile already seeded'); return }
  const guidelines = `We're at Pina since 2017. We keep this spot by following a few rules that everyone must respect:

1. No music before 7pm.
2. Keep the music volume very low after 10pm — the city can fine us up to €5000. Remind DJs and others if they forget.
3. Don't damage Pina property; park your bike outside the dancing area.
4. Don't block the exit doors with your bags.
5. Keep it clean and take your trash with you.`
  const [p] = await db.insert(schema.profiles).values({
    username: handle, type: 'venue', name: 'Pinakothek der Moderne (Open Air)',
    city: 'Munich', citySlug: 'munich', venueType: 'OpenAir', bookingModel: 'free',
    bio: 'A free open-air dance commons at the Pinakothek der Moderne — under the roof by the exit doors. Self-organised by the community since 2017, not run by the museum. Six mapped areas; keep to the guidelines and it stays ours.',
    guidelines,
    mapUrl: 'https://firebasestorage.googleapis.com/v0/b/wedance-4abe3.appspot.com/o/media%2FtvR012ArEpQhCJdPHh6G7sLuqoO2%2F45ad2564-fa2b-4169-9f22-0527d8d95e0c?alt=media&token=cf147971-f33a-40b1-84d0-bee0a0cea51d',
    photo: 'https://firebasestorage.googleapis.com/v0/b/wedance-4abe3.appspot.com/o/media%2FtvR012ArEpQhCJdPHh6G7sLuqoO2%2Fdc862207-95df-4573-9e92-6884ce0e7b83?alt=media&token=eb5bb326-9da4-4e2b-8428-c07afe0a707d',
    address: 'By the exit doors, Pinakothek der Moderne · Barer Str. 40, 80333 München',
    floorType: 'stone / open-air',
    moderatorName: 'Community-elected moderator', moderatorSince: 2024,
    socials: [
      { platform: 'instagram', url: 'https://instagram.com/pinakothekdermoderne' },
      { platform: 'website', url: 'https://www.pinakothek-der-moderne.de/' },
    ],
  }).returning({ id: schema.profiles.id })
  for (let i = 1; i <= 6; i++) {
    await db.insert(schema.bookableSpaces).values({ profileId: p!.id, name: `Area ${i}`, priceInfo: 'Free', description: 'One of the six community-mapped dance areas.', sortOrder: i })
  }
  console.log('Seeded Pinakothek Open Air commons + 6 areas')
}

seed()
  .then(() => { console.log('Done!'); process.exit(0) })
  .catch((e) => { console.error(e); process.exit(1) })
