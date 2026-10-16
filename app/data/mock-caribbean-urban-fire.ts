import type { Festival, Teacher, Workshop } from '~/types/festival'

export const mockFestival: Festival = {
  name: 'Caribbean Urban Fire',
  slug: 'caribbean-urban-fire-munich-2026',
  startDate: '2026-03-21',
  endDate: '2026-03-22',
  description:
    'Caribbean Urban Fire brings Amado Art and Dance Gods Company to Munich for a weekend of Salsa, Reparto, Hip Hop fusion, and Bachata Caribeña workshops.',
  logo: '',
  accentColor: '#e53e3e',
  socialLinks: [],
  venue: {
    name: 'KULT TANZSCHULE in ADTV',
    address: 'Neuhauser Str. 15A, 80331 München, Germany',
    coordinates: { lat: 48.1291, lng: 11.5580 },
    practicalInfo: [
      'Venue: Salsa y Corazon, Zenettistraße 7, 80337 Munich',
      'Organized by Dance Gods Company',
    ],
  },
  attendeeCount: 35,
  ticketUrl: '',
  tickets: [
    { name: 'Full Pass (3 Workshops)', price: 60, days: ['Saturday', 'Sunday'], description: 'All 3 workshops', workshopCount: 3, includesParty: false },
    { name: '2 Workshops', price: 45, days: [], description: 'Any 2 workshops', workshopCount: 2, includesParty: false },
    { name: '1 Workshop', price: 25, days: [], description: 'Any single workshop', workshopCount: 1, includesParty: false },
  ],
}

export const mockTeachers: Teacher[] = [
  {
    id: 'amado-art',
    name: 'Amado Art',
    photo: 'https://storage.googleapis.com/download/storage/v1/b/wedance-4abe3.appspot.com/o/share%2Famado.art.official.png?generation=1655385406881655&alt=media',
    bio: 'Licensed Dance Artist. First-level dancer. Folklore specialist. Neo-Afro movement pioneer. Bringing Caribbean energy and urban flair to Salsa, Reparto, Hip Hop fusion, and Bachata Caribeña.',
    styles: ['Salsa', 'Bachata', 'Hip Hop'],
    videoUrl: 'https://www.youtube.com/watch?v=OlxTVQoFOTo',
    socialLinks: [{ platform: 'instagram', url: 'https://www.instagram.com/amado.art.official' }],
  },
]

export const mockWorkshops: Workshop[] = [
  // === SATURDAY 21.03 ===
  {
    id: 'sat-1',
    title: 'Salsa & Reparto',
    time: '13:00',
    duration: 80,
    day: 'Saturday',
    room: 'Main',
    style: 'Salsa',
    level: 'Advanced',
    teacherId: 'amado-art',
    goingCount: 15,
  },
  {
    id: 'sat-2',
    title: 'Salsa with Hip Hop',
    time: '14:30',
    duration: 80,
    day: 'Saturday',
    room: 'Main',
    style: 'Salsa',
    level: 'Intermediate',
    teacherId: 'amado-art',
    goingCount: 18,
  },

  // === SUNDAY 22.03 ===
  {
    id: 'sun-1',
    title: 'Bachata Caribeña',
    time: '13:00',
    duration: 90,
    day: 'Sunday',
    room: 'Main',
    style: 'Bachata',
    level: 'Intermediate',
    teacherId: 'amado-art',
    goingCount: 20,
  },
]
