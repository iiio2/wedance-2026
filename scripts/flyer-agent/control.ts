/** Spike control: the app's own paintPrompt on the same brief (bun control.ts <runDir>). */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { flyerLines, paintPrompt, programmeLines } from '../../shared/utils/flyer'

const run = process.argv[2]!
const b = JSON.parse(readFileSync(resolve(run, 'brief.json'), 'utf8'))
const ev = JSON.parse(readFileSync(resolve(run, 'control/event.json'), 'utf8'))
const lines = flyerLines({
  name: ev.name, startDate: ev.start_date + 'Z', endDate: ev.end_date + 'Z', timezone: ev.timezone,
  venueName: b.venue.name, venueAddress: b.venue.address,
  agenda: programmeLines(ev.festival.sessions), artists: b.artists, styles: ev.styles,
  passes: ev.festival.passes.map((p: any) => p.name), price: ev.price,
})
const people = b.artists.filter((a: any) => a.photo)
writeFileSync(resolve(run, 'control/prompt.txt'), paintPrompt(lines, b.style, { people: people.map((p: any) => p.name), styleRef: true }))
console.log([b.style.reference, ...people.map((p: any) => p.photo)].map(p => `--image ${p}`).join(' '))
