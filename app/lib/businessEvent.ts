import type { BusinessEventValues } from '~/components/business/BusinessEventForm.vue'

/** /business event form values → businessEvents.create / update input (empty strings become null). */
export function toBusinessEventInput(v: BusinessEventValues) {
  return {
    hostUsername: v.hostUsername,
    name: v.name,
    type: v.type as 'Party' | 'Workshop' | 'Course' | 'Festival' | 'Weekender' | 'Congress' | 'Concert' | 'Show',
    date: v.date,
    startTime: v.startTime,
    endTime: v.endTime || null,
    endDate: v.endDate || null,
    city: v.city || null,
    venueUsername: v.venueUsername || null,
    venueName: v.venueName || null,
    venueAddress: v.venueAddress || null,
    artists: v.artists,
    styles: v.styles,
    description: v.description,
    cover: v.cover || null,
    ticketUrl: v.ticketUrl || null,
    price: v.price,
    published: v.published,
    agenda: v.agenda,
    // Only the line-up's photo choices; a removed artist's choice is dropped.
    flyerOptions: {
      showAgenda: v.showAgenda,
      photos: Object.fromEntries(Object.entries(v.photos).filter(([h]) => v.artists.includes(h))),
    },
  }
}
