/**
 * Step definitions for the C3 "Regular — find your floor" E2E scenarios
 * (RAZ-682: e2e/features/c3-*.feature and the signed-out Going gate).
 *
 * Fixtures are synthetic rows written straight into the local test database
 * (pg, like auth.ts), suffixed with a per-scenario run id and removed again by
 * the `c3` fixture's cleanups. Write scenarios start with "the test environment
 * is safe to write", which refuses any non-localhost BASE_URL — Vercel previews
 * share the production database.
 *
 * Time: fixtures sit on a Wednesday 20:00 Munich time at least two days ahead
 * (S). "the browser clock is the day before them" pins the browser's Date to
 * S − 1 day, so the city page's Monday–Sunday "this week" always contains S.
 */
import { expect, type Page, type Locator } from '@playwright/test'
import pg from 'pg'
import { randomUUID } from 'node:crypto'
import { Given, When, Then, type C3World } from './fixtures'
import { eventLocalDate, eventLocalTime, eventLocalWeekday, zonedToUtc } from '../../shared/utils/eventTime'

const DAY = 86400_000
const TZ = 'Europe/Berlin'
const baseUrl = () => (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '')

async function sql<T = any>(text: string, params: unknown[] = []): Promise<T[]> {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set — cannot seed C3 fixtures')
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try { return (await client.query(text, params)).rows as T[] }
  finally { await client.end() }
}

/** Wednesday 20:00 in Munich, at least two days from now. */
function fixtureStart(): Date {
  for (let d = 2; d < 10; d++) {
    const day = new Date(Date.now() + d * DAY)
    if (eventLocalWeekday(day, TZ).startsWith('Wed')) return zonedToUtc(eventLocalDate(day, TZ), '20:00', TZ)
  }
  throw new Error('no Wednesday found')
}

async function insertEvent(c3: C3World, key: string, start: Date, values: Record<string, unknown>) {
  const v = { type: 'Party', city: 'Munich', city_slug: 'munich', timezone: TZ, styles: JSON.stringify(['Salsa']), ...values }
  const cols = Object.keys(v)
  const [row] = await sql<{ id: string }>(
    `INSERT INTO events (${cols.join(', ')}, start_date, end_date, published, archived)
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, $${cols.length + 1}, $${cols.length + 2}, true, false) RETURNING id`,
    // UTC ISO strings: a JS Date would be sent in the machine's local offset, which a
    // timestamp-without-time-zone column silently keeps as wall-clock UTC.
    [...Object.values(v), start.toISOString(), new Date(start.getTime() + 3 * 3600_000).toISOString()],
  )
  c3.ids[key] = row!.id
  return row!.id
}

function trackEventsCleanup(c3: C3World) {
  if (c3.data.eventsCleanup) return
  c3.data.eventsCleanup = true
  c3.cleanup.push(async () => {
    await sql(`DELETE FROM plan_items WHERE item_id = ANY($1::text[])`, [Object.values(c3.ids)])
    await sql(`DELETE FROM events WHERE name LIKE $1`, [`% ${c3.run}`])
  })
}

/** The nearest element around `text` that also holds a button with `button` in its label. */
const cardButton = (page: Page, text: string, button: string): Locator =>
  page.locator(`xpath=//*[contains(normalize-space(.), "${text}") and not(*[contains(normalize-space(.), "${text}")])]/ancestor::*[.//button[contains(normalize-space(.), "${button}")]][1]//button[contains(normalize-space(.), "${button}")]`).first()

const discover = (page: Page) => page.locator('section#discover')

// ── Fixtures ────────────────────────────────────────────────────────

Given('Munich has a weekly practica and a one-off social this week', async ({ c3 }) => {
  const S = fixtureStart()
  c3.data.S = S
  c3.data.weekly = `C3 Weekly Practica ${c3.run}`
  c3.data.oneOff = `C3 One-off Social ${c3.run}`
  trackEventsCleanup(c3)
  for (let i = 0; i < 3; i++) {
    await insertEvent(c3, `weekly${i + 1}`, new Date(S.getTime() + i * 7 * DAY), { name: c3.data.weekly, type: 'Practica', series_id: `c3-e2e-${c3.run}` })
  }
  await insertEvent(c3, 'oneOff', new Date(S.getTime() + DAY), { name: c3.data.oneOff })
})

Given('a C3 city with an active and an idle profile per role, and a smaller city', async ({ c3 }) => {
  const S = fixtureStart()
  c3.data.S = S
  const slug = `c3e2e-${c3.run}`
  const small = `c3e2e2-${c3.run}`
  c3.data.city = { slug, name: `C3 Town ${c3.run}`, small, smallName: `C3 Village ${c3.run}` }
  const people: Record<string, { handle: string; name: string; type: string }> = {}
  for (const [role, type] of [['venues', 'venue'], ['organisers', 'organizer'], ['artists', 'artist']] as const) {
    for (const state of ['active', 'idle'] as const) {
      const handle = `c3-${type}-${state}-${c3.run}`
      const name = `C3 ${type} ${state} ${c3.run}`
      people[`${role}:${state}`] = { handle, name, type }
      await sql(`INSERT INTO profiles (username, type, name, city, city_slug, status, styles) VALUES ($1, $2, $3, $4, $5, 'visible', '["Salsa"]')`, [handle, type, name, c3.data.city.name, slug])
    }
  }
  await sql(`INSERT INTO profiles (username, type, name, city, city_slug, status, styles) VALUES ($1, 'artist', $2, $3, $4, 'visible', '["Salsa"]')`, [`c3-small-${c3.run}`, `C3 Small Artist ${c3.run}`, c3.data.city.smallName, small])
  c3.data.people = people
  c3.data.floorNight = `C3 Floor Night ${c3.run}`
  trackEventsCleanup(c3)
  await insertEvent(c3, 'floorNight', S, {
    name: c3.data.floorNight, city: c3.data.city.name, city_slug: slug,
    venue_username: people['venues:active']!.handle, venue_name: people['venues:active']!.name,
    organizer_username: people['organisers:active']!.handle, organizer_name: people['organisers:active']!.name,
    artists: JSON.stringify([people['artists:active']!.handle]),
  })
  c3.cleanup.push(async () => { await sql(`DELETE FROM profiles WHERE username LIKE $1`, [`c3-%-${c3.run}`]) })
})

async function addDancer(c3: C3World, who: string, photo: string | null) {
  const email = `${who.toLowerCase()}-${c3.run}@test.wedance.vip`
  const [row] = await sql<{ id: string }>(
    `INSERT INTO dancers (name, email, username, city, profile_public, photo, onboarded_at)
     VALUES ($1, $2, $3, 'Munich', true, $4, NOW()) RETURNING id`,
    [`${who} ${c3.run}`, email, `c3-${who.toLowerCase()}-${c3.run}`, photo],
  )
  c3.ids[`dancer:${who}`] = row!.id
  if (!c3.data.dancerCleanup) {
    c3.data.dancerCleanup = true
    c3.cleanup.push(async () => {
      const ids = Object.entries(c3.ids).filter(([k]) => k.startsWith('dancer:')).map(([, v]) => v)
      for (const t of ['sessions', 'plan_items', 'attendances', 'festival_waves', 'discover_swipes']) {
        await sql(`DELETE FROM ${t} WHERE dancer_id = ANY($1::uuid[])`, [ids]).catch(() => {})
      }
      await sql(`DELETE FROM dancers WHERE id = ANY($1::uuid[])`, [ids])
    })
  }
  return row!.id
}

const DANCER_PHOTO = () => `${baseUrl()}/alosha-dj.jpg`

async function ensureDancer(c3: C3World, who: string) {
  return c3.ids[`dancer:${who}`] ?? addDancer(c3, who, DANCER_PHOTO())
}

async function signInAs(page: Page, c3: C3World, who: string) {
  const id = await ensureDancer(c3, who)
  const token = `c3-${c3.run}-${randomUUID()}`
  await sql(`INSERT INTO sessions (dancer_id, token, expires_at) VALUES ($1, $2, NOW() + interval '1 day')`, [id, token])
  c3.data[`token:${who}`] = token
  await page.context().clearCookies()
  if (page.url().startsWith(baseUrl())) await page.evaluate(() => localStorage.clear())
  // What a real sign-in leaves behind (useAuth): the session token, and the hint
  // the server reads to render the signed-in header (without it, SSR and the
  // client disagree and Vue logs hydration mismatches).
  const hint = encodeURIComponent(JSON.stringify({ name: `${who} ${c3.run}`, username: `c3-${who.toLowerCase()}-${c3.run}`, photo: DANCER_PHOTO() }))
  await page.context().addCookies([
    { name: 'wedance-session', value: token, url: baseUrl() },
    { name: 'wedance-auth-hint', value: hint, url: baseUrl() },
  ])
}

Given('synthetic dancers {string} and {string} with public profiles and photos', async ({ c3 }, a: string, b: string) => {
  await ensureDancer(c3, a)
  await ensureDancer(c3, b)
})

Given('an ordinary event with a website but no ticket link', async ({ c3 }) => {
  c3.data.event = `C3 Ordinary Night ${c3.run}`
  c3.data.website = `https://club.example/c3-${c3.run}`
  trackEventsCleanup(c3)
  await insertEvent(c3, 'event', fixtureStart(), { name: c3.data.event, link: c3.data.website })
})

Given('an ordinary event with a ticket link and a website', async ({ c3 }) => {
  c3.data.event = `C3 Ordinary Night ${c3.run}`
  c3.data.website = `https://club.example/c3-${c3.run}`
  c3.data.ticketUrl = `https://tickets.example/c3-${c3.run}`
  trackEventsCleanup(c3)
  await insertEvent(c3, 'event', fixtureStart(), { name: c3.data.event, link: c3.data.website, ticket_url: c3.data.ticketUrl })
})

Given('an ordinary event with no attendees', async ({ c3 }) => {
  c3.data.event = `C3 Ordinary Night ${c3.run}`
  trackEventsCleanup(c3)
  await insertEvent(c3, 'event', fixtureStart(), { name: c3.data.event })
})

Given('an ordinary event with an eligible attendee and one whose photo is broken', async ({ c3 }) => {
  c3.data.event = `C3 Ordinary Night ${c3.run}`
  trackEventsCleanup(c3)
  const eventId = await insertEvent(c3, 'event', fixtureStart(), { name: c3.data.event })
  const ok = await addDancer(c3, 'Eligible', `${baseUrl()}/alosha-charanga.jpg`)
  const broken = await addDancer(c3, 'Broken', `${baseUrl()}/c3-missing-photo-${c3.run}.jpg`)
  for (const id of [ok, broken]) {
    await sql(`INSERT INTO plan_items (dancer_id, item_type, item_id, share_going) VALUES ($1, 'event', $2, true)`, [id, eventId])
  }
})

Given('the browser clock is the day before them', async ({ page, c3 }) => {
  await page.clock.setFixedTime(new Date(c3.data.S.getTime() - DAY))
})

Given('I am signed in as {string}', async ({ page, c3 }, who: string) => {
  await signInAs(page, c3, who)
})

Given('I watch the console for hydration warnings', async ({ page, c3 }) => {
  c3.data.hydration = [] as string[]
  page.on('console', (m) => { if (/hydrat/i.test(m.text())) c3.data.hydration.push(m.text()) })
})

Given('the discovery request is slow', async ({ page }) => {
  await page.route('**/api/trpc/**', async (route) => {
    if (route.request().url().includes('wave.discoverPool')) await new Promise(r => setTimeout(r, 3000))
    await route.continue()
  })
})

Given('the discovery request fails', async ({ page }) => {
  await page.route('**/api/trpc/**', async (route) => {
    if (route.request().url().includes('wave.discoverPool')) return route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"simulated"}' })
    await route.continue()
  })
})

// ── Navigation ──────────────────────────────────────────────────────

When('I open the home page', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
})

When('I follow the {string} stage', async ({ page }, title: string) => {
  await page.getByRole('link', { name: new RegExp(title) }).first().click()
})

When('I open the {string} city page', async ({ page }, slug: string) => {
  await page.goto(`/cities/${slug}`)
  await page.waitForLoadState('networkidle')
})

When('I open the cities directory', async ({ page }) => {
  await page.goto('/cities')
  await page.waitForLoadState('networkidle')
})

When('I open the C3 city', async ({ page, c3 }) => {
  await page.locator(`a[href^="/cities/${c3.data.city.slug}"]`).first().click()
  await expect(page).toHaveURL(new RegExp(`/cities/${c3.data.city.slug}`))
  // The week's events load after mount — once they show, the tabs are interactive.
  await expect(page.getByRole('link', { name: c3.data.floorNight }).first()).toBeVisible()
})

When('I open the {string} tab', async ({ page }, tab: string) => {
  await page.getByRole('button', { name: tab, exact: true }).click()
})

When('I follow the {string} link for {word}', async ({ page }, _all: string, role: string) => {
  await page.getByRole('link', { name: new RegExp(`^All .* ${role} →$`) }).click()
})

When('I open the active {word} profile', async ({ page, c3 }, role: string) => {
  const p = c3.data.people[`${role}:active`]
  await page.getByRole('link', { name: new RegExp(p.name) }).first().click()
  await expect(page).toHaveURL(new RegExp(`/@${p.handle}`))
})

When('I open the weekly practica', async ({ page, c3 }) => {
  await page.getByRole('link', { name: c3.data.weekly }).first().click()
  await expect(page).toHaveURL(new RegExp(`/events/[^/]*${c3.ids.weekly1!.slice(0, 8)}`))
})

When('I open the one-off social', async ({ page, c3 }) => {
  await page.getByRole('link', { name: c3.data.oneOff }).first().click()
  await expect(page).toHaveURL(new RegExp(`/events/[^/]*${c3.ids.oneOff!.slice(0, 8)}`))
  await expect(page.getByRole('heading', { level: 1, name: c3.data.oneOff })).toBeVisible()
})

When('I open that event', async ({ page, c3 }) => {
  await page.goto(`/events/${c3.ids.event}`)
  await expect(discover(page)).toBeVisible()
})

When('I tap {string} on the one-off social', async ({ page, c3 }, label: string) => {
  const button = cardButton(page, c3.data.oneOff, label.replace(/[?!]$/, ''))
  await expect(button).toHaveText(new RegExp(label.replace('?', '\\?')))
  const signedIn = Object.keys(c3.data).some(k => k.startsWith('token:'))
  const saved = signedIn ? page.waitForResponse(r => r.url().includes('plan.add')) : null
  await button.click()
  if (saved) expect((await saved).ok()).toBe(true)
})

When('I scroll through the page and reload it', async ({ page }) => {
  await page.mouse.wheel(0, 4000)
  await page.mouse.wheel(0, -4000)
  await page.reload()
})

When('I tap {string} to undo', async ({ page }, label: string) => {
  const removed = page.waitForResponse(r => r.url().includes('plan.remove'))
  await page.getByRole('button', { name: label, exact: true }).first().click()
  expect((await removed).ok()).toBe(true)
})

When('I reload the page', async ({ page }) => {
  await page.reload()
})

When('{string} marks Going on the event', async ({ page, c3 }, who: string) => {
  await signInAs(page, c3, who)
  await page.goto(`/events/${c3.ids.event}`)
  await page.waitForLoadState('networkidle')
  const saved = page.waitForResponse(r => r.url().includes('plan.add'))
  await page.getByRole('button', { name: 'Going?', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Going!', exact: true }).first()).toBeVisible()
  expect((await saved).ok()).toBe(true)
})

When('{string} chooses {string} in the event\'s deck', async ({ page, c3 }, who: string, cta: string) => {
  await signInAs(page, c3, who)
  await page.goto(`/events/${c3.ids.event}`)
  await page.waitForLoadState('networkidle')
  const shared = page.waitForResponse(r => r.url().includes('plan.setShareGoing'))
  await discover(page).getByRole('button', { name: cta }).click()
  expect((await shared).ok()).toBe(true)
  await expect(discover(page).getByText('You\'re in the deck')).toBeVisible()
})

// No page offers "hide me" any more: GoingSection (the only toggle) is not
// mounted since #327 (follow-up RAZ-721). The opt-out is the same public API
// the toggle called.
When('{string} opts out of the going list through the API', async ({ request, c3 }, who: string) => {
  const res = await request.post('/api/trpc/plan.setShareGoing?batch=1', {
    headers: { authorization: `Bearer ${c3.data[`token:${who}`]}`, 'content-type': 'application/json' },
    data: { 0: { itemType: 'event', itemId: c3.ids.event, share: false } },
  })
  expect(res.ok()).toBe(true)
})

// ── Assertions ──────────────────────────────────────────────────────

Then('the journey stage {string} promises {string} with weekly socials, practicas and friends', async ({ page }, label: string, title: string) => {
  const stage = page.getByRole('link', { name: new RegExp(title) }).first()
  await expect(stage).toContainText(label)
  await expect(stage).toContainText(/Weekly socials and practicas/i)
  await expect(stage).toContainText(/friends/i)
})

Then('I am on the {string} city page', async ({ page }, slug: string) => {
  await expect(page).toHaveURL(new RegExp(`/cities/${slug}(\\?|$)`))
})

Then('this week lists the weekly practica and the one-off social', async ({ page, c3 }) => {
  const week = page.locator('section', { has: page.getByText('This week', { exact: true }) }).first()
  await expect(week.getByRole('link', { name: c3.data.weekly })).toHaveCount(1)
  await expect(week.getByRole('link', { name: c3.data.oneOff })).toHaveCount(1)
})

Then('{string} lists the next two dates of the weekly practica', async ({ page, c3 }, heading: string) => {
  const later = page.locator('section', { has: page.getByText(heading, { exact: true }) }).last()
  await expect(later.getByRole('link', { name: c3.data.weekly })).toHaveCount(2)
})

Then('the event page shows its start time in Munich time, not the browser\'s', async ({ page, c3 }) => {
  const munich = eventLocalTime(c3.data.S, TZ)
  const viewer = eventLocalTime(c3.data.S, 'America/New_York')
  expect(munich).toBe('20:00')
  await expect(page.getByText(new RegExp(`· ${munich}`)).first()).toBeVisible()
  await expect(page.getByText(new RegExp(`· ${viewer}`))).toHaveCount(0)
})

Then('both C3 cities show their real community counts, the bigger one first', async ({ page, c3 }) => {
  const big = page.locator(`a[href^="/cities/${c3.data.city.slug}"]`).first()
  const small = page.locator(`a[href^="/cities/${c3.data.city.small}"]`).first()
  await expect(big).toContainText('6 in the community')
  await expect(small).toContainText('1 in the community')
  const order = await page.evaluate(([a, b]) => {
    const x = document.querySelector(`a[href^="/cities/${a}"]`)!; const y = document.querySelector(`a[href^="/cities/${b}"]`)!
    return x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING ? 'big-first' : 'small-first'
  }, [c3.data.city.slug, c3.data.city.small])
  expect(order).toBe('big-first')
})

Then('the {string} tab is selected', async ({ page }, tab: string) => {
  await expect(page.getByRole('button', { name: tab, exact: true })).toHaveAttribute('aria-pressed', 'true')
})

Then('the tab lists the active {word} only', async ({ page, c3 }, role: string) => {
  await expect(page.getByText('1 with events this week')).toBeVisible()
  await expect(page.getByText(c3.data.people[`${role}:active`].name).first()).toBeVisible()
  await expect(page.getByText(c3.data.people[`${role}:idle`].name)).toHaveCount(0)
})

Then('I am on the full {word} directory, listing the active and the idle {word}', async ({ page, c3 }, role: string) => {
  await expect(page).toHaveURL(new RegExp(`/cities/${c3.data.city.slug}/${role}$`))
  await expect(page.getByText(c3.data.people[`${role}:active`].name).first()).toBeVisible()
  await expect(page.getByText(c3.data.people[`${role}:idle`].name).first()).toBeVisible()
})

Then('its schedule shows this week\'s event', async ({ page, c3 }) => {
  await expect(page.getByText(c3.data.floorNight).first()).toBeVisible()
})

When('I fetch the server-rendered {string} directory of the C3 city', async ({ request, c3 }, role: string) => {
  const res = await request.get(`/cities/${c3.data.city.slug}/${role}`)
  expect(res.status()).toBe(200)
  c3.data.html = await res.text()
})

Then('the HTML lists the active and the idle {word} without running JavaScript', async ({ c3 }, role: string) => {
  expect(c3.data.html).toContain(c3.data.people[`${role}:active`].name)
  expect(c3.data.html).toContain(c3.data.people[`${role}:idle`].name)
})

Then('the HTML has the title {string} and a canonical URL for {string}', async ({ c3 }, title: string, role: string) => {
  const expected = title.replace('{city}', c3.data.city.name)
  const html = c3.data.html.replace(/&amp;/g, '&')
  expect(html).toContain(`<title>${expected}</title>`)
  expect(c3.data.html).toMatch(new RegExp(`<link[^>]+rel="canonical"[^>]+href="[^"]*/cities/${c3.data.city.slug}/${role}"`))
})

Then('the HTML carries BreadcrumbList and ItemList structured data for {string}', async ({ c3 }, role: string) => {
  const blocks = [...c3.data.html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].map((m: RegExpMatchArray) => JSON.parse(m[1]!))
  const all = blocks.flat()
  const crumbs = all.find((b: any) => b['@type'] === 'BreadcrumbList')
  const list = all.find((b: any) => b['@type'] === 'ItemList')
  expect(crumbs.itemListElement.at(-1).item).toMatch(new RegExp(`/cities/${c3.data.city.slug}/${role}$`))
  expect(list.numberOfItems).toBe(2)
  expect(list.itemListElement.map((i: any) => i.name).sort()).toEqual([c3.data.people[`${role}:active`].name, c3.data.people[`${role}:idle`].name].sort())
})

Then('the event page shows {string} and {int} going', async ({ page }, label: string, n: number) => {
  await expect(page.getByRole('button', { name: label, exact: true }).first()).toBeVisible()
  await expect(page.getByText(`${n} planning`).first()).toBeVisible()
})

Then('the one-off social shows {string}', async ({ page, c3 }, label: string) => {
  await expect(cardButton(page, c3.data.oneOff, 'Going')).toHaveText(new RegExp(label.replace(/[?!]/, '\\$&')))
})

Then('the database has one Going for {string} on the one-off social', async ({ c3 }, who: string) => {
  const rows = await sql(`SELECT share_going FROM plan_items WHERE dancer_id = $1 AND item_type = 'event' AND item_id = $2`, [c3.ids[`dancer:${who}`], c3.ids.oneOff])
  expect(rows).toEqual([{ share_going: false }])
  const att = await sql(`SELECT status, visibility FROM attendances WHERE dancer_id = $1 AND event_id = $2`, [c3.ids[`dancer:${who}`], c3.ids.oneOff])
  expect(att).toEqual([{ status: 'going', visibility: 'hidden' }])
})

Then('the database has no Going for {string} on the one-off social', async ({ c3 }, who: string) => {
  expect(await sql(`SELECT 1 FROM plan_items WHERE dancer_id = $1 AND item_id = $2`, [c3.ids[`dancer:${who}`], c3.ids.oneOff])).toHaveLength(0)
  expect(await sql(`SELECT 1 FROM attendances WHERE dancer_id = $1 AND event_id = $2`, [c3.ids[`dancer:${who}`], c3.ids.oneOff])).toHaveLength(0)
})

Then('there were no hydration warnings', async ({ c3 }) => {
  expect(c3.data.hydration).toEqual([])
})

Then('no Going is saved in the database for the one-off social', async ({ c3 }) => {
  expect(await sql(`SELECT 1 FROM plan_items WHERE item_id = $1`, [c3.ids.oneOff])).toHaveLength(0)
  expect(await sql(`SELECT 1 FROM attendances WHERE event_id = $1`, [c3.ids.oneOff])).toHaveLength(0)
})

Then('no Going is saved in the database for that event', async () => {
  // The existing smoke event (auth.ts "I am on an event page").
  const id = '00000000-0000-4000-a000-000000000001'
  expect(await sql(`SELECT 1 FROM plan_items WHERE item_id = $1`, [id])).toHaveLength(0)
  expect(await sql(`SELECT 1 FROM attendances WHERE event_id = $1`, [id])).toHaveLength(0)
})

Then('the database shows {string} Going on the event, hidden', async ({ c3 }, who: string) => {
  expect(await sql(`SELECT share_going FROM plan_items WHERE dancer_id = $1 AND item_id = $2`, [c3.ids[`dancer:${who}`], c3.ids.event])).toEqual([{ share_going: false }])
  expect(await sql(`SELECT visibility FROM attendances WHERE dancer_id = $1 AND event_id = $2`, [c3.ids[`dancer:${who}`], c3.ids.event])).toEqual([{ visibility: 'hidden' }])
})

Then('{string} does not see {string} in the event\'s deck', async ({ page, c3 }, viewer: string, who: string) => {
  await signInAs(page, c3, viewer)
  await page.goto(`/events/${c3.ids.event}`)
  await expect(discover(page).getByTestId('discover-empty')).toBeVisible()
  await expect(discover(page).getByText(`${who} ${c3.run}`)).toHaveCount(0)
})

Then('{string} sees {string} in the event\'s deck', async ({ page, c3 }, viewer: string, who: string) => {
  await signInAs(page, c3, viewer)
  await page.goto(`/events/${c3.ids.event}`)
  await expect(discover(page).getByText(`${who} ${c3.run}`).first()).toBeVisible()
})

Then('the "Shall we dance?" section shows only the eligible attendee\'s card', async ({ page, c3 }) => {
  await expect(discover(page).getByText(`Eligible ${c3.run}`).first()).toBeVisible()
  // Give the broken photo's preload time to fail, then make sure its card never shows.
  await page.waitForLoadState('networkidle')
  await expect(discover(page).getByText(`Broken ${c3.run}`)).toHaveCount(0)
  await expect(discover(page).locator('img[src*="c3-missing-photo"]')).toHaveCount(0)
})

Then('the "Shall we dance?" section shows the {string} call to action', async ({ page }, cta: string) => {
  await expect(discover(page).getByTestId('discover-empty')).toBeVisible()
  await expect(discover(page).getByRole('button', { name: cta })).toBeVisible()
})

Then('the "Shall we dance?" section shows the sign-up dance card and no attendee faces', async ({ page, c3 }) => {
  await expect(discover(page).getByText('Your dance card')).toBeVisible()
  await expect(discover(page).getByText(new RegExp(`(Eligible|Broken) ${c3.run}`))).toHaveCount(0)
})

Then('the "Shall we dance?" section offers no paid or free-spot social pass', async ({ page }) => {
  await expect(discover(page)).toBeVisible()
  await expect(discover(page)).not.toContainText(/€|free spot|social pass|unlock/i)
})

Then('the "Shall we dance?" section shows a loading indicator', async ({ page }) => {
  await expect(discover(page).getByRole('status', { name: 'Loading dancers' })).toBeVisible()
})

Then('then the "Shall we dance?" section shows the {string} call to action', async ({ page }, cta: string) => {
  await expect(discover(page).getByRole('button', { name: cta })).toBeVisible({ timeout: 15_000 })
})

Then('the "Shall we dance?" section does not say there are no dancers', async ({ page }) => {
  await page.waitForLoadState('networkidle')
  await expect(discover(page).getByText('No dancers in the deck yet')).toHaveCount(0)
})

Then('it offers to try loading the dancers again', async ({ page }) => {
  await expect(discover(page).getByRole('button', { name: /try again|retry/i })).toBeVisible()
})

// ── RAZ-687 — tickets vs Going ───────────────────────────────────────

When('I tap {string} in the event hero', async ({ page }, label: string) => {
  const saved = page.waitForResponse(r => r.url().includes('plan.add'))
  await page.getByRole('button', { name: label, exact: true }).first().click()
  expect((await saved).ok()).toBe(true)
})

Then('the event hero shows {string}', async ({ page }, label: string) => {
  await expect(page.getByRole('button', { name: label, exact: true }).first()).toBeVisible()
})

Then('the event hero offers no ticket button and links the website as {string}', async ({ page, c3 }, label: string) => {
  await expect(page.getByRole('link', { name: /Get tickets/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: label })).toHaveAttribute('href', c3.data.website)
})

Then('the event hero offers {string} linking to the ticket page', async ({ page, c3 }, label: string) => {
  await expect(page.getByRole('link', { name: new RegExp(label) }).first()).toHaveAttribute('href', c3.data.ticketUrl)
})

Then('the event page never promises free entry', async ({ page }) => {
  await expect(page.locator('main')).not.toContainText(/free (entry|admission)|free spot|enter for free|no ticket needed/i)
})

Then('the database shows {string} Going on that event, not as a ticket holder', async ({ c3 }, who: string) => {
  const rows = await sql(`SELECT status, source, verified_at FROM attendances WHERE dancer_id = $1 AND event_id = $2`, [c3.ids[`dancer:${who}`], c3.ids.event])
  expect(rows).toEqual([{ status: 'going', source: 'click', verified_at: null }])
})
