/**
 * Prototype-only state for /sketches/first-flyer: one event, its line-up and its
 * flyer, shared by Home, the event editor and the flyer flow so an edit in one
 * shows in the others. Lives in memory (useState); nothing reaches the server.
 */
const CDN = 'https://res.cloudinary.com/djumxevsm/image/upload'
export const sketchImg = (path: string, w = 700) => `${CDN}/c_limit,w_${w},f_auto,q_auto/${path}`

// Artists on WeDance with their page photos. Yunior has none yet — the realistic case.
export const SKETCH_ARTISTS = [
  { username: 'hmez2050', name: 'DJ Hamza', role: 'DJ', photos: [
    'v1791828033/wedance-2026/brand-import/laclave/2026-10-08-luma/hamza-1_yvgoyq.jpg',
    'v1791828198/wedance-2026/brand-import/laclave/2026-10-08-luma/hamza-2-x6dgz.jpg',
  ] },
  { username: 'yuniorflowcubano', name: 'Yunior', role: 'Teacher', photos: [] },
  { username: 'alosha_corazon_cubano', name: 'Alösha', role: 'Teacher', photos: [
    'v1791828170/wedance-2026/brand-import/montuno/frida-mondays-2026-05-11-bachata-dominicana/alosha-zwiuq.png',
  ] },
  { username: 'ellisprincewhite34', name: 'Ellis Prince White', role: 'DJ', photos: [
    'v1791828115/wedance-2026/brand-import/laclave/2026-10-08-luma-afro/ellis-1-yth3x.jpg',
    'v1791828112/wedance-2026/brand-import/laclave/2026-10-08-luma-afro/ellis-2-en9jt.jpg',
  ] },
  { username: 'felito6665', name: 'Felix Hernandez', role: 'Musician', photos: [
    'v1791828173/wedance-2026/brand-import/montuno/frida-mondays-2026-05-18-felix-rumba/felix-maracas-wrbth.jpg',
  ] },
]

export type SketchLineupEntry = { username: string; name: string; role: string; photo: number | null; own: string | null }

function initialEvent() {
  return {
    host: 'La Clave en Múnich',
    name: 'La Clave Thursday',
    type: 'Party',
    repeats: 'Every Thursday',
    date: 'Thursday 15 October',
    start: '19:00',
    end: '23:00',
    venue: 'Luma',
    address: 'Neuhauser Str. 47 · München',
    agenda: [
      { time: '19:00', what: 'Reparto workshop · Yunior' },
      { time: '20:00', what: 'Bachata workshop · Alösha' },
      { time: '21:00', what: 'Party · DJ Hamza until 23:00' },
    ],
    showAgenda: true,
    entry: ['Workshops free', 'Free entry until 21:00', 'From 21:00 · 10€'],
    ticketUrl: '',
    styles: ['Timba', 'Bachata', 'Reparto'],
    lineup: [
      { username: 'hmez2050', name: 'DJ Hamza', role: 'DJ', photo: 0, own: null },
      { username: 'yuniorflowcubano', name: 'Yunior', role: 'Teacher', photo: null, own: null },
      { username: 'alosha_corazon_cubano', name: 'Alösha', role: 'Teacher', photo: null, own: null },
    ] as SketchLineupEntry[],
    description: 'Every Thursday in the heart of Munich: free workshops, then Cuban music until late.',
  }
}

// What "Make it" returns: version 1, then a repaint after a fix or a refresh.
export const SKETCH_VERSIONS = [
  'v1791829046/wedance-2026/flyers/laclave/zth58j5wi3g8jzk82ple.jpg',
  'v1791828917/wedance-2026/flyers/laclave/dx1bn7v6sut99ufui8xu.jpg',
]

export function useSketchEvent() {
  const ev = useState('sketch-event', initialEvent)
  // The kept flyer, plus the words and faces it was painted from (to spot changes).
  const flyer = useState('sketch-flyer', () => ({ story: null as string | null, text: [] as string[], pictured: [] as string[], look: null as string | null }))

  const flyerText = computed(() => {
    const e = ev.value
    return [
      e.host.toUpperCase(),
      e.date.toUpperCase(),
      `${e.start} – ${e.end}`,
      ...(e.showAgenda ? e.agenda.filter(a => a.what.trim()).map(a => `${a.time} ${a.what}`) : []),
      e.lineup.map(l => l.name).join(' · ').toUpperCase(),
      e.styles.join(' × ').toUpperCase(),
      e.entry.filter(Boolean).join(' · '),
      `${e.venue} · ${e.address}`.toUpperCase(),
    ].filter(Boolean)
  })
  const pictured = computed(() => ev.value.lineup.filter(l => l.photo !== null).map(l => l.name))

  // What changed since the flyer was painted, as old → new pairs the organizer recognises.
  const changes = computed(() => {
    const f = flyer.value
    if (!f.story) return [] as { was: string | null; now: string | null }[]
    const now = flyerText.value.filter(t => !f.text.includes(t))
    const was = f.text.filter(t => !flyerText.value.includes(t))
    const out = Array.from({ length: Math.max(now.length, was.length) }, (_, i) => ({ was: was[i] ?? null, now: now[i] ?? null }))
    const added = pictured.value.filter(p => !f.pictured.includes(p))
    const gone = f.pictured.filter(p => !pictured.value.includes(p))
    if (added.length || gone.length) out.push({ was: gone.length ? `Photo: ${gone.join(', ')}` : null, now: added.length ? `Photo: ${added.join(', ')}` : null })
    return out
  })

  function keepFlyer(story: string, look: string) {
    flyer.value = { story, text: [...flyerText.value], pictured: [...pictured.value], look }
  }
  function reset() {
    ev.value = initialEvent()
    flyer.value = { story: null, text: [], pictured: [], look: null }
  }
  return { ev, flyer, flyerText, pictured, changes, keepFlyer, reset }
}
