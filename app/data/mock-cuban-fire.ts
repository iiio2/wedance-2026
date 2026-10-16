import type { Festival, Teacher, Workshop } from '~/types/festival'

export const mockFestival: Festival = {
  name: 'Cuban Fire in Munich',
  slug: 'cuban-fire-munich-2026',
  startDate: '2026-03-14',
  endDate: '2026-03-15',
  description:
    'No Excuses. Just Learn & Dance. Cuban Fire brings Addy Mendoza to Munich for an intensive weekend of Salsa, Timba, Son Cubano, and Rumba workshops, capped off with a sizzling Timba Party on Saturday night.',
  logo: '',
  accentColor: '#d32f2f',
  socialLinks: [],
  venue: {
    name: 'Salsa y Corazon, Munich',
    address: 'Zenettistraße 7, 80337 Munich, Germany',
    coordinates: { lat: 48.1291, lng: 11.5580 },
    practicalInfo: [
      'Venue: Salsa y Corazon, Zenettistraße 7, 80337 Munich',
      'Info & Booking: +39 392 5480888',
      'Saturday party with DJ Alösha',
    ],
  },
  attendeeCount: 60,
  ticketUrl: '',
  tickets: [
    { name: 'Full Pass 5H + Party', price: 100, days: ['Saturday', 'Sunday'], description: 'All 5 workshops + Saturday Timba Party', workshopCount: 5, includesParty: true },
    { name: 'Full Pass 4H + Party', price: 85, days: ['Saturday', 'Sunday'], description: '4 workshops + Saturday Timba Party', workshopCount: 4, includesParty: true },
    { name: '3 Workshops', price: 65, days: [], description: 'Any 3 workshops', workshopCount: 3 },
    { name: '2 Workshops', price: 45, days: [], description: 'Any 2 workshops', workshopCount: 2 },
    { name: '1 Workshop', price: 25, days: [], description: 'Any single workshop', workshopCount: 1 },
    { name: 'Party Only', price: 10, days: ['Saturday'], description: 'Saturday Timba Party', includesParty: true },
  ],
}

export const mockTeachers: Teacher[] = [
  {
    id: 'addy',
    name: 'Addy Mendoza',
    photo: 'https://firebasestorage.googleapis.com/v0/b/wedance-4abe3.appspot.com/o/media%2FtvR012ArEpQhCJdPHh6G7sLuqoO2%2Fe1702cd6-9557-440b-a918-04492645a573?alt=media&token=27938360-8b9f-4bb5-9593-a66df062b29a',
    bio: 'Cuban dancer and instructor bringing explosive Cuban energy to Munich. Addy specializes in Salsa Lady Styling, Timba Suelta, Timba Partnerwork, Son Cubano, and Rumba Guaguancó.',
    styles: ['Salsa', 'Timba', 'Son', 'Rumba'],
    videoUrl: 'https://www.youtube.com/embed/ZzAXWQyK4lE',
    socialLinks: [
      { platform: 'instagram', url: 'https://www.instagram.com/addymendozaoficial/' },
    ],
  },
  {
    id: 'dj-alosha',
    name: 'DJ Alösha',
    photo: 'https://firebasestorage.googleapis.com/v0/b/wedance-4abe3.appspot.com/o/media%2FtvR012ArEpQhCJdPHh6G7sLuqoO2%2Fca9b6bec-d071-447e-8b2f-fe819df0f1fa?alt=media&token=a5502508-b03a-4da9-830a-723bb1f75cfe',
    bio: 'DJ Alösha brings the heat with Cuban Timba, Salsa, and Son sets that keep the dance floor packed all night.',
    styles: ['Timba'],
    socialLinks: [
      { platform: 'instagram', url: 'https://www.instagram.com/alosha_timba_munich/' },
    ],
  },
]

export const mockWorkshops: Workshop[] = [
  // === SATURDAY 14.03 ===
  {
    id: 'sat-1',
    title: 'Salsa Lady Styling',
    time: '10:00',
    duration: 60,
    day: 'Saturday',
    room: 'Main',
    style: 'Salsa',
    level: 'Intermediate',
    teacherId: 'addy',
    goingCount: 20,
  },
  {
    id: 'sat-2',
    title: 'Timba Suelta (Man & Lady)',
    time: '11:05',
    duration: 60,
    day: 'Saturday',
    room: 'Main',
    style: 'Timba',
    level: 'Intermediate',
    teacherId: 'addy',
    goingCount: 25,
  },
  {
    id: 'sat-3',
    title: 'Timba Partnerwork',
    time: '12:10',
    duration: 60,
    day: 'Saturday',
    room: 'Main',
    style: 'Timba',
    level: 'Intermediate',
    teacherId: 'addy',
    goingCount: 28,
  },
  {
    id: 'sat-party',
    title: 'Timba Party by DJ Alösha',
    time: '21:00',
    duration: 300,
    day: 'Saturday',
    room: '',
    style: 'Timba',
    level: 'Beginner',
    teacherId: 'dj-alosha',
    goingCount: 50,
    type: 'party',
    venue: 'Salsa y Corazon, Zenettistraße 7, 80337 Munich',
    description: 'Saturday night Timba party at Salsa y Corazon with DJ Alösha. 21:00 – 02:00.',
  },

  // === SUNDAY 15.03 ===
  {
    id: 'sun-1',
    title: 'Son Cubano',
    time: '11:00',
    duration: 60,
    day: 'Sunday',
    room: 'Main',
    style: 'Son',
    level: 'Intermediate',
    teacherId: 'addy',
    goingCount: 22,
  },
  {
    id: 'sun-2',
    title: 'Rumba Guaguancó',
    time: '12:05',
    duration: 60,
    day: 'Sunday',
    room: 'Main',
    style: 'Rumba',
    level: 'Intermediate',
    teacherId: 'addy',
    goingCount: 18,
  },
]
