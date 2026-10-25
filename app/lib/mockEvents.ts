/**
 * Lookup for the mock city weekly events (mock-city-*.ts) so they can open an
 * event page at /events/<id> just like real booked events. Maps a CityEvent into
 * the same shape booking.getEvent returns, so /events/<id> renders either.
 * Transitional until city events are real DB rows.
 */
import * as munich from '~/data/mock-city-munich'
import * as berlin from '~/data/mock-city-berlin'
import * as fSalsaOpen from '~/data/mock-festival'
import * as fMeneate from '~/data/mock-meneate'
import * as fCubanFire from '~/data/mock-cuban-fire'
import * as fCaribbean from '~/data/mock-caribbean-urban-fire'
import * as fAguaPichi from '~/data/mock-agua-pichi'
import type { CityEvent } from '~/types/city'

const CITIES = [
  { data: munich, cityName: munich.city.name },
  { data: berlin, cityName: berlin.city.name },
]

const FESTIVALS = [fSalsaOpen, fMeneate, fCubanFire, fCaribbean, fAguaPichi].map((m: any) => ({
  festival: m.mockFestival,
  workshops: m.mockWorkshops || [],
  teachers: m.mockTeachers || [],
}))

// The festival date that falls on a given weekday (workshops carry a weekday).
function festivalDateFor(fest: any, dayName: string): string {
  const start = new Date(fest.festival.startDate)
  const end = new Date(fest.festival.endDate)
  for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.toLocaleDateString('en-US', { weekday: 'long' }) === dayName) return d.toISOString().slice(0, 10)
  }
  return String(fest.festival.startDate)
}

function mapWorkshop(w: any, fest: any) {
  const teacher = (fest.teachers as any[]).find(t => t.id === w.teacherId)
  return {
    id: `f~${fest.festival.slug}~${w.id}`,
    title: w.title,
    eventType: w.type === 'party' ? 'Party' : 'Workshop',
    styles: w.style ? [w.style] : [],
    artists: teacher ? [teacher.name] : [],
    eventDate: festivalDateFor(fest, w.day),
    startTime: w.time || null,
    endTime: null,
    headcount: w.goingCount || null,
    message: null as string | null,
    // Parent festival so the event page can link back to it prominently.
    parentFestival: { name: fest.festival.name, slug: fest.festival.slug },
    requesterName: (fest.teachers as any[]).find(t => t.id === w.teacherId)?.name || null,
    status: 'accepted',
    ticketUrl: fest.festival.ticketUrl || null,
    spaceName: w.room || null,
    venueName: fest.festival.venue?.name || fest.festival.name,
    venueHandle: null as string | null,
    venueAddress: null as string | null,
    venueCity: null as string | null,
  }
}

// This week's date (YYYY-MM-DD) for a weekday name — recurring socials happen
// "this" week.
function thisWeekDateFor(dayName: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const target = days.indexOf(dayName)
  if (target < 0) return ''
  const now = new Date()
  const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  const fromMon = (target + 6) % 7 // Mon→0 … Sun→6
  const d = new Date(mon); d.setDate(mon.getDate() + fromMon)
  return d.toISOString().slice(0, 10)
}

function mapEvent(e: CityEvent, cityName: string) {
  return {
    id: e.id,
    title: e.name,
    eventType: e.type ? e.type.charAt(0).toUpperCase() + e.type.slice(1) : null,
    styles: e.style ? [e.style] : [],
    artists: [] as string[],
    eventDate: e.date || thisWeekDateFor(e.day),
    startTime: e.time || null,
    endTime: null,
    headcount: e.attendeeCount || null,
    message: e.description || null,
    requesterName: e.organizer || null,
    status: 'accepted',
    ticketUrl: null,
    spaceName: null as string | null,
    venueName: e.venue || null,
    venueHandle: null as string | null,
    venueAddress: e.address || null,
    venueCity: cityName,
  }
}

/** One programme item of a real (DB) festival, in the same shape — festivalView + a workshop id. */
export function festivalSessionEvent(view: { festival: any; workshops: any[]; teachers: any[] }, wid: string) {
  const w = view.workshops.find(x => x.id === wid)
  return w ? mapWorkshop(w, view) : null
}

export function findMockEvent(id: string) {
  // Festival schedule item: f~<festivalSlug>~<workshopId>.
  if (id.startsWith('f~')) {
    const parts = id.split('~')
    const slug = parts[1]; const wid = parts.slice(2).join('~')
    const fest = FESTIVALS.find(f => f.festival?.slug === slug)
    const w = fest?.workshops.find((x: any) => x.id === wid)
    return fest && w ? mapWorkshop(w, fest) : null
  }
  for (const { data, cityName } of CITIES) {
    const e = (data.events as CityEvent[]).find(ev => ev.id === id)
    if (e) return mapEvent(e, cityName)
  }
  return null
}
