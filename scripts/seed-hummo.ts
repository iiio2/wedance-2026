#!/usr/bin/env bun
/**
 * Fill the Hummo Productions promoter page (/@hummoproductions, RAZ-436) with its
 * real roster and upcoming concerts, so it can replace linktr.ee/hummopro.
 *
 * Sources (read 2026-10-17):
 *   - https://linktr.ee/hummopro                       the roster + which shows exist
 *   - https://site.fourvenues.com/es/hummo-productions  Kelvis Ochoa tour: JSON-LD of each
 *                                                       event page (times, venue, geo, image, offers)
 *   - https://jamboreejazz.com/evento/…                 Jamboree shows: dates, times, prices, photos
 *
 * Writes (all tagged so they can be found and rolled back):
 *   - 5 artist profiles, source_ref {source:'hummo'}, + their handles
 *   - network_links hummoproductions → each artist (the promoter roster)
 *   - events with source='hummo', source_id=<slug>, host_profile_id = Hummo
 *   - the Hummo profile itself: bio, styles, languages, socials
 *   - images re-hosted on Cloudinary (wedance-2026/profiles|events/hummo-*)
 * Idempotent: profiles and links are only created when missing; events upsert on
 * (source, source_id) but skip rows someone has since edited on WeDance (edited_at).
 *
 * Rollback:
 *   DELETE FROM events WHERE source = 'hummo';
 *   DELETE FROM network_links WHERE profile_id = (SELECT id FROM profiles WHERE username = 'hummoproductions');
 *   DELETE FROM handles WHERE profile_id IN (SELECT id FROM profiles WHERE source_ref->>'source' = 'hummo');
 *   DELETE FROM profiles WHERE source_ref->>'source' = 'hummo' AND coalesce(claimed, false) = false;
 *
 * Usage:
 *   bun --env-file=.env scripts/seed-hummo.ts            # dry-run
 *   bun --env-file=.env scripts/seed-hummo.ts --write    # apply (check DATABASE_URL first!)
 */
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq, sql } from 'drizzle-orm'
import cloudinary from 'cloudinary'
import * as schema from '../server/database/schema'

const { profiles, events, networkLinks, handles } = schema
const WRITE = process.argv.includes('--write')
const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.error('DATABASE_URL not set'); process.exit(1) }
const db = drizzle(neon(dbUrl), { schema })
console.error(`seed-hummo · ${WRITE ? 'WRITE' : 'dry-run'} · ${new URL(dbUrl).host}`)

const PROMOTER = 'hummoproductions'
const FV = 'https://fourvenues.com/cdn-cgi/imagedelivery/kWuoTchaMsk7Xnc_FNem7A'
const FV_EVENT = 'https://site.fourvenues.com/es/hummo-productions/events'
const JAMBOREE = { name: 'Jamboree Jazz Club', address: 'Plaça Reial, 17, 08002 Barcelona', lat: 41.3800, lng: 2.1752 }

// ── The promoter ────────────────────────────────────────────────────────────
const HUMMO = {
  bio: 'Barcelona promoter. 20 years of cultural promotion: shows, management and booking for Cuban artists across Spain.',
  styles: ['Son'],
  languages: ['es'],
  socials: [
    { platform: 'instagram', url: 'https://instagram.com/hummoproductions' },
    { platform: 'facebook', url: 'https://www.facebook.com/Hummofilms' },
    { platform: 'website', url: 'https://site.fourvenues.com/es/hummo-productions' },
  ],
}

// ── Roster ──────────────────────────────────────────────────────────────────
interface Artist { username: string, name: string, bio: string, styles: string[], photo: string, photoId: string }
const ARTISTS: Artist[] = [
  {
    username: 'kelvisochoa',
    name: 'Kelvis Ochoa',
    bio: 'Cuban singer-songwriter and guitarist, founding member of Habana Abierta. Goya winner for Best Original Music (Habana Blues). His own style, sucu sucu, mixes son with pop, funk and Cuban rock. Spain tour, November 2026.',
    styles: ['Son'],
    photo: `${FV}/917c7efc-a33e-4064-809d-e712cf575400/w=1350`,
    photoId: 'hummo-kelvis-ochoa',
  },
  {
    username: 'duojoma',
    name: 'Dúo JOMA',
    bio: 'Cuban duo: Magela (vocals) and José Manuel (guitar, vocals). After playing in China and the Maldives they are starting a new chapter in Spain with the single "Soy De Volar".',
    styles: [],
    photo: 'https://jamboreejazz.com/wp-content/uploads/2026/08/Duo-joma-2.png',
    photoId: 'hummo-duo-joma',
  },
  {
    username: 'gastonjoya',
    name: 'Gastón Joya & The New Cuban Trio',
    bio: 'Cuban double bassist Gastón Joya has worked with Chucho Valdés, Paquito D\'Rivera, Joe Lovano, Sting and Buena Vista Social Club. Contemporary Afro-Cuban jazz with Miguel "Wiwi" García (piano) and Frank Durán (drums).',
    styles: [],
    photo: 'https://jamboreejazz.com/wp-content/uploads/2026/09/Diseno-sin-titulo-2026-09-09T092300.991.jpg',
    photoId: 'hummo-gaston-joya',
  },
  {
    username: 'habanaabierta',
    name: 'Habana Abierta',
    bio: 'The Havana collective formed in the late 1990s, blending son with rock and trova with guaracha. Back together on stage: Alejandro Gutiérrez, Vanito Brown, José Luis Medina "La Liebre", Roberto Carcasés, José Atero.',
    styles: ['Son'],
    photo: 'https://jamboreejazz.com/wp-content/uploads/2026/09/Diseno-sin-titulo-2026-09-21T121536.416.jpg',
    photoId: 'hummo-habana-abierta',
  },
  {
    username: 'carlossarduy',
    name: 'Carlos Sarduy Trio',
    bio: 'Havana-born trumpeter, percussionist, pianist and composer, on the European scene since 2008 with more than 50 albums. Has played with Chucho and Bebo Valdés, Steve Coleman, Esperanza Spalding and Ojos de Brujo.',
    styles: [],
    photo: 'https://jamboreejazz.com/wp-content/uploads/2026/09/Diseno-sin-titulo-2026-09-21T133942.735.jpg',
    photoId: 'hummo-carlos-sarduy',
  },
]

// ── Concerts ────────────────────────────────────────────────────────────────
interface Show {
  sourceId: string, name: string, artist: string, start: string, end: string, timezone: string,
  city: string, citySlug: string | null, venueName: string, venueAddress: string, lat: number | null, lng: number | null,
  price: string, ticketUrl: string, link: string, cover: string, coverId: string,
  description: string, agenda?: { time: string, what: string }[]
}
const KELVIS_CORE = 'Kelvis Ochoa: Cuban singer-songwriter, founding member of Habana Abierta and one of the voices of the Habana Blues soundtrack. Sucu sucu, son, trova and pop, with guitar, band and a crowd that ends up dancing.'
const SHOWS: Show[] = [
  {
    sourceId: 'kelvis-ochoa-javea-2026-11-07', name: 'Kelvis Ochoa – Concierto exclusivo en Jávea', artist: 'kelvisochoa',
    start: '2026-11-07T19:00:00+01:00', end: '2026-11-08T00:00:00+01:00', timezone: 'Europe/Madrid',
    city: 'Jávea', citySlug: null, venueName: 'Restaurante Club de Tenis de Jávea', venueAddress: "Av. de la Fontana, 66, 03730 Platja de l'Arenal, Alicante", lat: null, lng: null,
    price: '25 € / 30 € / tables 160–200 €',
    ticketUrl: `${FV_EVENT}/kelvis-ochoa---concierto-exclusivo-en-javea-unico-concierto-en-la-comunidad-valenciana-07-11-2026-2P8C`,
    link: `${FV_EVENT}/kelvis-ochoa---concierto-exclusivo-en-javea-unico-concierto-en-la-comunidad-valenciana-07-11-2026-2P8C`,
    cover: `${FV}/59662258-0844-4218-8cdd-17e31df11f00/w=1350`, coverId: 'hummo-kelvis-javea',
    description: `The only Kelvis Ochoa concert in the Valencia region this tour, in an intimate setting at the Club de Tenis de Jávea. Limited capacity. After buying a table ticket, call 687 313 982 to reserve your table.\n\n${KELVIS_CORE}`,
  },
  {
    sourceId: 'kelvis-ochoa-madrid-2026-11-08', name: 'Kelvis Ochoa – Concierto en Madrid', artist: 'kelvisochoa',
    start: '2026-11-08T20:30:00+01:00', end: '2026-11-08T23:00:00+01:00', timezone: 'Europe/Madrid',
    city: 'Madrid', citySlug: 'madrid', venueName: 'Shoko Madrid', venueAddress: 'C. de Toledo, 86, Centro, 28005 Madrid', lat: 40.4087463, lng: -3.7106359,
    price: '30 € / VIP 50 €',
    ticketUrl: `${FV_EVENT}/kelvis-ochoa---concierto-en-madrid-08-11-2026-ZN41`,
    link: `${FV_EVENT}/kelvis-ochoa---concierto-en-madrid-08-11-2026-ZN41`,
    cover: `${FV}/917c7efc-a33e-4064-809d-e712cf575400/w=1350`, coverId: 'hummo-kelvis-madrid',
    description: `Back at Shoko Madrid after last year's show: guitar, band and voice in an intimate format.\n\n${KELVIS_CORE}`,
  },
  {
    sourceId: 'kelvis-ochoa-barcelona-2026-11-13', name: 'Kelvis Ochoa – Concierto exclusivo en Barcelona', artist: 'kelvisochoa',
    start: '2026-11-13T21:00:00+01:00', end: '2026-11-14T07:30:00+01:00', timezone: 'Europe/Madrid',
    city: 'Barcelona', citySlug: 'barcelona', venueName: 'Sala Salamandra', venueAddress: "Av. del Carrilet, 235, 08907 L'Hospitalet de Llobregat, Barcelona", lat: 41.3601493, lng: 2.1093739,
    price: '30 € (first 100 tickets)',
    ticketUrl: `${FV_EVENT}/kelvis-ochoa---concierto-exclusivo-en-barcelona-13-11-2026-GN11`,
    link: `${FV_EVENT}/kelvis-ochoa---concierto-exclusivo-en-barcelona-13-11-2026-GN11`,
    cover: `${FV}/a9f83217-f2da-46c3-9bc2-c1bb81328900/w=1350`, coverId: 'hummo-kelvis-barcelona',
    description: `Kelvis Ochoa at Salamandra: a close, conversational live show.\n\n${KELVIS_CORE}`,
  },
  {
    sourceId: 'kelvis-ochoa-gran-canaria-2026-11-14', name: 'Kelvis Ochoa – Concierto exclusivo en Gran Canaria', artist: 'kelvisochoa',
    start: '2026-11-14T21:30:00+01:00', end: '2026-11-15T06:00:00+01:00', timezone: 'Atlantic/Canary',
    city: 'Gran Canaria', citySlug: 'las-palmas-de-gran-canaria', venueName: 'Sala Garbos', venueAddress: 'Av. de Wind Surfing, 6, 35100 Tarajalillo, San Bartolomé de Tirajana, Las Palmas', lat: 27.7831266, lng: -15.5188815,
    price: '30 € / VIP 35 € / Gold 40 € / table 200 €',
    ticketUrl: `${FV_EVENT}/kelvis-ochoa---concierto-exclusivo-en-gran-canaria-14-11-2026-WJ6L`,
    link: `${FV_EVENT}/kelvis-ochoa---concierto-exclusivo-en-gran-canaria-14-11-2026-WJ6L`,
    cover: `${FV}/7824620c-9053-4475-eb80-a78ff38c6b00/w=1350`, coverId: 'hummo-kelvis-gran-canaria',
    description: `Kelvis Ochoa's first time at Sala Garbos: guitar and voice, up close.\n\n${KELVIS_CORE}`,
  },
  {
    sourceId: 'kelvis-ochoa-tenerife-2026-11-15', name: 'Kelvis Ochoa – Concierto en Tenerife', artist: 'kelvisochoa',
    start: '2026-11-15T21:30:00+01:00', end: '2026-11-16T00:00:00+01:00', timezone: 'Atlantic/Canary',
    city: 'Tenerife', citySlug: 'san-cristobal-de-la-laguna', venueName: 'Sala El Búho', venueAddress: 'Calle Catedral, 3, 38205 La Laguna, Santa Cruz de Tenerife', lat: 28.4843906, lng: -16.3146509,
    price: '30 €',
    ticketUrl: `${FV_EVENT}/kelvis-ochoa---concierto-en-tenerife-15-11-2026-6VJR`,
    link: `${FV_EVENT}/kelvis-ochoa---concierto-en-tenerife-15-11-2026-6VJR`,
    cover: `${FV}/348ab8df-6697-4af0-a585-bef31a5d0200/w=1350`, coverId: 'hummo-kelvis-tenerife',
    description: `Closing the Canary Islands leg of the tour at El Búho. Limited capacity.\n\n${KELVIS_CORE}`,
  },
  {
    sourceId: 'kelvis-ochoa-malaga-2026-11-20', name: 'Kelvis Ochoa – Concierto en Málaga', artist: 'kelvisochoa',
    start: '2026-11-20T20:30:00+01:00', end: '2026-11-21T05:00:00+01:00', timezone: 'Europe/Madrid',
    city: 'Málaga', citySlug: null, venueName: 'Sala La Farándula', venueAddress: 'Av. de José Ortega y Gasset, 132, Cruz de Humilladero, 29006 Málaga', lat: 36.7075967, lng: -4.4678031,
    price: '30 € (first 100 tickets) / tables 200–300 €',
    ticketUrl: `${FV_EVENT}/kelvis-ochoa---concierto-en-malaga-20-11-2026-RW54`,
    link: `${FV_EVENT}/kelvis-ochoa---concierto-en-malaga-20-11-2026-RW54`,
    cover: `${FV}/23ca5d1d-0867-4c38-c96c-045c30580000/w=1350`, coverId: 'hummo-kelvis-malaga',
    description: `Kelvis Ochoa's first time at La Farándula, a few metres from the stage.\n\n${KELVIS_CORE}`,
  },
  {
    sourceId: 'duo-joma-jamboree-2026-10-24', name: 'Dúo JOMA – Canciones para quedarnos', artist: 'duojoma',
    start: '2026-10-24T20:00:00+02:00', end: '2026-10-24T21:00:00+02:00', timezone: 'Europe/Madrid',
    city: 'Barcelona', citySlug: 'barcelona', venueName: JAMBOREE.name, venueAddress: JAMBOREE.address, lat: JAMBOREE.lat, lng: JAMBOREE.lng,
    price: '20 €',
    ticketUrl: 'https://tickets.oneboxtds.com/jamboree/events/59653',
    link: 'https://jamboreejazz.com/es/evento/duo-joma/',
    cover: 'https://jamboreejazz.com/wp-content/uploads/2026/08/Duo-joma-2.png', coverId: 'hummo-duo-joma-jamboree',
    description: 'An intimate acoustic concert by the Cuban duo JOMA: their best-known songs, unreleased songs from the next album, and covers. Jamboree, Sala 1.',
  },
  {
    sourceId: 'gaston-joya-jamboree-2026-11-14', name: 'Gastón Joya & The New Cuban Trio', artist: 'gastonjoya',
    start: '2026-11-14T19:00:00+01:00', end: '2026-11-14T22:00:00+01:00', timezone: 'Europe/Madrid',
    city: 'Barcelona', citySlug: 'barcelona', venueName: JAMBOREE.name, venueAddress: JAMBOREE.address, lat: JAMBOREE.lat, lng: JAMBOREE.lng,
    price: '25 € (20 € in advance)',
    ticketUrl: 'https://jamboreejazz.com/evento/the-new-cuban-trio',
    link: 'https://jamboreejazz.com/evento/the-new-cuban-trio',
    cover: 'https://jamboreejazz.com/wp-content/uploads/2026/09/Diseno-sin-titulo-2026-09-09T092300.991.jpg', coverId: 'hummo-gaston-joya-jamboree',
    description: 'Contemporary Afro-Cuban jazz: Gastón Joya\'s own compositions next to Mario Bauzá, Chico O\'Farrill and Charles Mingus, and new takes on boleros, danzones, filin and son. Two shows: 19:00 and 20:30. Jamboree, Sala 1.',
    agenda: [{ time: '19:00', what: 'First show' }, { time: '20:30', what: 'Second show' }],
  },
  {
    sourceId: 'carlos-sarduy-jamboree-2026-11-28', name: 'Carlos Sarduy Trio', artist: 'carlossarduy',
    start: '2026-11-28T19:00:00+01:00', end: '2026-11-28T22:00:00+01:00', timezone: 'Europe/Madrid',
    city: 'Barcelona', citySlug: 'barcelona', venueName: JAMBOREE.name, venueAddress: JAMBOREE.address, lat: JAMBOREE.lat, lng: JAMBOREE.lng,
    price: '25 € (20 € in advance)',
    ticketUrl: 'https://jamboreejazz.com/evento/carlos-sarduy-trio-2',
    link: 'https://jamboreejazz.com/evento/carlos-sarduy-trio-2',
    cover: 'https://jamboreejazz.com/wp-content/uploads/2026/09/Diseno-sin-titulo-2026-09-21T133942.735.jpg', coverId: 'hummo-carlos-sarduy-jamboree',
    description: 'Cuban and Latin jazz with trumpeter Carlos Sarduy (trumpet, congas, keys, vocals) and Frank Durand (drums). Two shows: 19:00 and 20:30. Jamboree, Sala 1.',
    agenda: [{ time: '19:00', what: 'First show' }, { time: '20:30', what: 'Second show' }],
  },
  {
    sourceId: 'habana-abierta-jamboree-2026-12-12', name: 'Habana Abierta', artist: 'habanaabierta',
    start: '2026-12-12T23:00:00+01:00', end: '2026-12-13T00:30:00+01:00', timezone: 'Europe/Madrid',
    city: 'Barcelona', citySlug: 'barcelona', venueName: JAMBOREE.name, venueAddress: JAMBOREE.address, lat: JAMBOREE.lat, lng: JAMBOREE.lng,
    price: '30 €',
    ticketUrl: 'https://tickets.oneboxtds.com/jamboree/events/60323',
    link: 'https://jamboreejazz.com/evento/habana-abierta',
    cover: 'https://jamboreejazz.com/wp-content/uploads/2026/09/Diseno-sin-titulo-2026-09-21T121536.416.jpg', coverId: 'hummo-habana-abierta-jamboree',
    description: 'Habana Abierta back together on one stage: son with rock, trova with guaracha. With Frank Durand (drums) and Marlon (congas). Standing concert, 18+, doors 22:30. Jamboree, Sala 2.',
    agenda: [{ time: '22:30', what: 'Doors' }, { time: '23:00', what: 'Concert' }],
  },
]

// ── Images → Cloudinary (deterministic public ids, so re-runs overwrite) ────
cloudinary.v2.config({
  cloud_name: process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NUXT_CLOUDINARY_API_KEY,
  api_secret: process.env.NUXT_CLOUDINARY_API_SECRET,
})
async function rehost(url: string, folder: 'profiles' | 'events', id: string): Promise<string> {
  if (!WRITE) return url
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } })
  if (!res.ok) throw new Error(`image ${res.status}: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  // upload_stream fails under Bun ("Invalid request parameters"); a data URI works.
  const type = res.headers.get('content-type') || 'image/jpeg'
  const out = await cloudinary.v2.uploader.upload(`data:${type};base64,${buf.toString('base64')}`, {
    folder: `wedance-2026/${folder}`, public_id: id, overwrite: true,
  })
  return out.secure_url
}

// ── Apply ───────────────────────────────────────────────────────────────────
const [hummo] = await db.select().from(profiles).where(eq(profiles.username, PROMOTER))
if (!hummo) { console.error(`@${PROMOTER} not found`); process.exit(1) }
console.error(`  promoter @${PROMOTER} (${hummo.id}) type=${hummo.type}`)

if (WRITE) {
  await db.update(profiles).set({ bio: HUMMO.bio, styles: HUMMO.styles, languages: HUMMO.languages, socials: HUMMO.socials }).where(eq(profiles.id, hummo.id))
}
console.error(`  promoter: bio, styles, languages, ${HUMMO.socials.length} socials`)

const artistIds: Record<string, string> = {}
for (const a of ARTISTS) {
  const [existing] = await db.select().from(profiles).where(eq(profiles.username, a.username))
  if (existing) {
    artistIds[a.username] = existing.id
    console.error(`  artist @${a.username}: exists (${existing.claimed ? 'claimed, untouched' : 'kept'})`)
  } else if (WRITE) {
    const photo = await rehost(a.photo, 'profiles', a.photoId)
    const [row] = await db.insert(profiles).values({
      username: a.username, type: 'artist', name: a.name, bio: a.bio, styles: a.styles,
      photo, photos: [{ url: photo }], status: 'visible', claimed: false,
      sourceRef: { source: 'hummo', promoter: PROMOTER, importedAt: new Date().toISOString() },
    }).returning({ id: profiles.id })
    artistIds[a.username] = row.id
    console.error(`  artist @${a.username}: created`)
  } else {
    console.error(`  artist @${a.username}: would create`)
  }
  const id = artistIds[a.username]
  if (WRITE && id) {
    const [h] = await db.select().from(handles).where(sql`lower(${handles.handle}) = ${a.username}`)
    if (!h) await db.insert(handles).values({ handle: a.username, profileId: id, dancerId: null })
    const [link] = await db.select().from(networkLinks).where(and(eq(networkLinks.profileId, hummo.id), eq(networkLinks.otherProfileId, id)))
    if (!link) await db.insert(networkLinks).values({ profileId: hummo.id, otherProfileId: id, status: 'added' })
  }
}

let created = 0, updated = 0, skipped = 0
for (const s of SHOWS) {
  const [existing] = await db.select({ id: events.id, editedAt: events.editedAt }).from(events)
    .where(and(eq(events.source, 'hummo'), eq(events.sourceId, s.sourceId)))
  if (existing?.editedAt) { skipped++; console.error(`  event ${s.sourceId}: edited on WeDance, skipped`); continue }
  if (!WRITE) { console.error(`  event ${s.sourceId}: would ${existing ? 'update' : 'create'}`); continue }
  const cover = await rehost(s.cover, 'events', s.coverId)
  const values = {
    name: s.name, type: 'Concert', description: s.description, cover,
    startDate: new Date(s.start), endDate: new Date(s.end), timezone: s.timezone,
    ticketUrl: s.ticketUrl, link: s.link, price: s.price,
    city: s.city, citySlug: s.citySlug, country: 'Spain',
    venueName: s.venueName, venueAddress: s.venueAddress, venueLat: s.lat, venueLng: s.lng,
    organizerUsername: PROMOTER, organizerName: 'Hummo Productions', hostProfileId: hummo.id,
    artists: [s.artist], styles: ARTISTS.find(a => a.username === s.artist)!.styles,
    agenda: s.agenda ?? [], archived: false, published: true,
    source: 'hummo', sourceId: s.sourceId, sourceRef: { source: 'hummo', url: s.link },
    syncedAt: new Date(), updatedAt: new Date(),
  }
  if (existing) { await db.update(events).set(values).where(eq(events.id, existing.id)); updated++ }
  else { await db.insert(events).values(values); created++ }
  console.error(`  event ${s.sourceId}: ${existing ? 'updated' : 'created'}`)
}
console.error(`done · events created ${created}, updated ${updated}, skipped ${skipped}`)
