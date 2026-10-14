/**
 * The content plan: the posts an event is promoted with (event_posts), what
 * each kind is, and the plan WeDance proposes. Every post is painted with the
 * flyer pipeline in the event's look, with its own words (postLines in
 * shared/utils/flyer.ts). Nothing paints until the organizer clicks.
 */
export const POST_KINDS = {
  announcement: { label: 'Announcement', hint: 'The event’s flyer: everything in one poster.' },
  artist: { label: 'Artist announcement', hint: 'One artist: their photo, name and what they teach or play.' },
  lineup: { label: 'Line-up', hint: 'Everyone together.' },
  programme: { label: 'Programme', hint: 'The highlights of the schedule.' },
  passes: { label: 'Passes', hint: 'What to buy, and for how much.' },
  countdown: { label: 'Countdown', hint: 'A week to go: date and place.' },
  'last-call': { label: 'Last tickets', hint: 'The last push, a few days before.' },
  thanks: { label: 'Thank you', hint: 'After: thanks, see you next time.' },
} as const
export type PostKind = keyof typeof POST_KINDS

export type PlanEvent = {
  startDay: string // yyyy-mm-dd, local
  endDay?: string | null
  /** Festivals, weekenders, congresses: a campaign. Others: a flyer and a reminder. */
  festival: boolean
  artists: string[]
  hasPasses: boolean
  hasProgramme: boolean
}
export type PlannedPost = { kind: PostKind; subject?: string | null; dueOn: string; format: 'post' | 'story' }

const addDays = (day: string, n: number) => new Date(new Date(`${day}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10)
const maxDay = (a: string, b: string) => (a > b ? a : b)

/**
 * The plan WeDance proposes. A night out: the flyer a week before (or today),
 * then a story on the day. A festival: the launch, one post per artist spread
 * until three weeks before, the line-up poster, passes and programme if there
 * are any, the countdown, last tickets, and the thank-you. Dates never before today.
 */
export function proposePlan(e: PlanEvent, today: string): PlannedPost[] {
  const start = e.startDay
  const at = (n: number) => maxDay(today, addDays(start, n))
  if (!e.festival) {
    return [
      { kind: 'announcement', dueOn: at(-7), format: 'story' },
      { kind: 'countdown', dueOn: maxDay(today, start), format: 'story' },
    ]
  }
  const launch = at(-56)
  const lineupDay = at(-21)
  const plan: PlannedPost[] = [{ kind: 'announcement', dueOn: launch, format: 'post' }]
  // Artist posts between the launch and the line-up poster, evenly.
  const span = Math.max(1, Math.round((new Date(lineupDay).getTime() - new Date(launch).getTime()) / 86400_000))
  e.artists.forEach((h, i) => {
    plan.push({ kind: 'artist', subject: h, dueOn: addDays(launch, Math.round(((i + 1) * span) / (e.artists.length + 1))), format: 'post' })
  })
  if (e.artists.length) plan.push({ kind: 'lineup', dueOn: lineupDay, format: 'post' })
  if (e.hasPasses) plan.push({ kind: 'passes', dueOn: at(-14), format: 'post' })
  if (e.hasProgramme) plan.push({ kind: 'programme', dueOn: at(-10), format: 'post' })
  plan.push({ kind: 'countdown', dueOn: at(-7), format: 'story' })
  if (e.hasPasses) plan.push({ kind: 'last-call', dueOn: at(-3), format: 'story' })
  plan.push({ kind: 'thanks', dueOn: maxDay(today, addDays(e.endDay || start, 1)), format: 'post' })
  return plan
}
