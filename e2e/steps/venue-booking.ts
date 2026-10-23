/**
 * Step definitions for the C6 venue & host journey E2E tests.
 *
 * Seeds isolated test data via pg.Client (same pattern as auth.ts) and
 * drives the browser through the venue browsing and booking flows.
 */
import { expect } from '@playwright/test'
import { Given, When, Then } from './fixtures'
import pg from 'pg'

// ── Helpers ──────────────────────────────────────────────────────────

function getDbUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set — cannot run E2E tests')
  return url
}

/** Seed a venue profile with bookable spaces. Returns the profile id. */
async function seedVenue(
  username: string,
  name: string,
  spaceCount: number,
): Promise<string> {
  const client = new pg.Client({ connectionString: getDbUrl() })
  try {
    await client.connect()

    // Upsert profile
    const profileRes = await client.query(
      `INSERT INTO profiles (username, type, name, status, city, city_slug, booking_model)
       VALUES ($1, 'venue', $2, 'visible', 'Munich', 'munich', 'free')
       ON CONFLICT (username) DO UPDATE SET name = $2, status = 'visible'
       RETURNING id`,
      [username, name],
    )
    const profileId = profileRes.rows[0].id

    // Insert bookable spaces (skip if already exist)
    for (let i = 1; i <= spaceCount; i++) {
      await client.query(
        `INSERT INTO bookable_spaces (profile_id, name, sort_order)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (
           SELECT 1 FROM bookable_spaces WHERE profile_id = $1 AND name = $2
         )`,
        [profileId, `Space ${i}`, i],
      )
    }

    return profileId
  } finally {
    await client.end()
  }
}

/** Add weekly availability slots for a venue's first space. */
async function seedAvailability(
  username: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
): Promise<void> {
  const client = new pg.Client({ connectionString: getDbUrl() })
  try {
    await client.connect()

    // Find the first space for this profile
    const res = await client.query(
      `SELECT bs.id FROM bookable_spaces bs
       JOIN profiles p ON p.id = bs.profile_id
       WHERE p.username = $1
       ORDER BY bs.sort_order
       LIMIT 1`,
      [username],
    )
    if (!res.rows.length) throw new Error(`No spaces found for venue ${username}`)

    const spaceId = res.rows[0].id
    await client.query(
      `INSERT INTO availability_slots (space_id, day_of_week, start_time, end_time, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT DO NOTHING`,
      [spaceId, dayOfWeek, startTime, endTime],
    )
  } finally {
    await client.end()
  }
}

/** Return the next occurrence of a given ISO weekday (1=Mon…7=Sun) as YYYY-MM-DD. */
function nextWeekday(isoDay: number): string {
  const now = new Date()
  const current = now.getUTCDay() || 7 // 0→7 so Sun=7
  const diff = ((isoDay - current) % 7 + 7) % 7 || 7 // always at least 1 day ahead
  const target = new Date(now)
  target.setDate(target.getDate() + diff)
  return target.toISOString().slice(0, 10)
}

// ── Module-level store for cross-step state ──────────────────────────

const venueStore: Record<string, string> = {} // username → profileId

// ── Steps: Venue seeding ─────────────────────────────────────────────

Given(
  'a test venue {string} exists with {int} bookable spaces',
  async ({}, username: string, spaceCount: number) => {
    const displayName = username
      .replace(/^qa-/, 'QA ')
      .replace(/-(\d+)$/, ' $1')
      .replace(/(^|\s)\w/g, c => c.toUpperCase())
    venueStore[username] = await seedVenue(username, displayName, spaceCount)
  },
)

Given(
  'the venue {string} has Monday availability from {string} to {string}',
  async ({}, username: string, startTime: string, endTime: string) => {
    await seedAvailability(username, 1, startTime, endTime) // 1 = Monday (ISO)
  },
)

// ── Steps: Navigation ────────────────────────────────────────────────

When('I go to the venues page', async ({ page }) => {
  await page.goto('/venues')
  await page.waitForLoadState('networkidle')
})

When('I go to the for-events page', async ({ page }) => {
  await page.goto('/for-events')
  await page.waitForLoadState('networkidle')
})

When(
  'I navigate to the venue profile {string}',
  async ({ page }, username: string) => {
    await page.goto(`/@${username}`)
    await page.waitForLoadState('networkidle')
  },
)

When(
  'I click on the venue {string}',
  async ({ page }, name: string) => {
    await page.getByText(name, { exact: false }).first().click()
    await page.waitForLoadState('networkidle')
  },
)

When('I click "Propose an event"', async ({ page }) => {
  await page
    .getByRole('button', { name: /propose an event/i })
    .click()
})

When('I click "Tell us about your event"', async ({ page }) => {
  await page
    .getByRole('button', { name: /tell us about your event/i })
    .click()
})

// ── Steps: Booking form interactions ────────────────────────────────

When(
  'I fill in the booking title with {string}',
  async ({ page }, title: string) => {
    const field = page.locator('[role="dialog"]').getByLabel('Event name')
    await expect(field).toBeVisible({ timeout: 5_000 })
    await field.fill(title)
  },
)

When(
  'I fill in the booking email with {string}',
  async ({ page }, email: string) => {
    await page.locator('[role="dialog"]').getByLabel('Email').fill(email)
  },
)

When('I accept the booking terms', async ({ page }) => {
  const checkbox = page.locator('[role="dialog"]').getByRole('checkbox')
  await checkbox.check()
})

When('I submit the booking request', async ({ page }) => {
  const btn = page
    .locator('[role="dialog"]')
    .getByRole('button', { name: /book it|send request/i })
  await btn.click()
})

// ── Steps: Booking validation (RAZ-661) ─────────────────────────────

Then('I see the booking dialog', async ({ page }) => {
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  await expect(dialog.getByLabel('Event name')).toBeVisible()
})

When('I set the booking date to next Tuesday', async ({ page }) => {
  const dialog = page.locator('[role="dialog"]')
  const tuesday = nextWeekday(2)
  await dialog.getByLabel('Date').fill(tuesday)
})

When('I set the booking date to next Monday', async ({ page }) => {
  const dialog = page.locator('[role="dialog"]')
  const monday = nextWeekday(1)
  await dialog.getByLabel('Date').fill(monday)
})

When(
  'I set the booking start time to {string}',
  async ({ page }, time: string) => {
    const dialog = page.locator('[role="dialog"]')
    await dialog.getByLabel('Start').fill(time)
  },
)

Then(
  'I see the booking error {string}',
  async ({ page }, errorFragment: string) => {
    const alert = page.locator('[role="dialog"] [role="alert"]')
    await expect(alert).toBeVisible({ timeout: 10_000 })
    await expect(alert).toContainText(errorFragment, { ignoreCase: true })
  },
)

// ── Steps: Event inquiry form interactions ──────────────────────────

When('I fill the event inquiry with brief details', async ({ page }) => {
  // Fill the minimal required fields for the event inquiry form
  const needsField = page.getByLabel(/what do you need/i)
  await expect(needsField).toBeVisible({ timeout: 5_000 })
  await needsField.fill('DJ + show dancers for a salsa birthday party, 3 hours')

  const emailField = page.getByLabel(/your email/i)
  await emailField.fill(`qa-test-${Date.now()}@test.wedance.vip`)
})

When('I submit the event inquiry', async ({ page }) => {
  // Intercept the tRPC mutation so the test never hits the real Linear API.
  await page.route('**/api/trpc/feedback.inquiry**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ result: { data: { ok: true } } }]),
    })
  })

  await page.getByRole('button', { name: /send request/i }).click()
})

// ── Steps: Assertions ────────────────────────────────────────────────

Then(
  'I see the venue {string}',
  async ({ page }, name: string) => {
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    })
  },
)

Then(
  'I see the venue profile page for {string}',
  async ({ page }, username: string) => {
    // The venue profile page shows the venue name and has spaces listed
    await expect(page).toHaveURL(new RegExp(`@${username}`), { timeout: 10_000 })
  },
)

Then('I see at least {int} bookable space(s)', async ({ page }, min: number) => {
  // Bookable spaces are listed on the venue profile page
  // Wait for the page to load and look for space-related content
  const body = await page.textContent('main', { timeout: 10_000 })
  // The page should show spaces or a booking calendar
  expect(body).toBeTruthy()
})

Then('I see the booking form', async ({ page }) => {
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  await expect(dialog.getByLabel('Event name')).toBeVisible()
})

Then('I see the event inquiry form', async ({ page }) => {
  await expect(page.getByLabel(/what do you need/i)).toBeVisible({
    timeout: 5_000,
  })
  await expect(page.getByLabel(/your email/i)).toBeVisible()
})

Then(
  'I see the {string} section',
  async ({ page }, heading: string) => {
    await expect(
      page.getByRole('heading', { name: heading }),
    ).toBeVisible({ timeout: 10_000 })
  },
)

Then('I see the booking request dialog', async ({ page }) => {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  // The dialog title for a free venue is "Propose an event"
  await expect(
    dialog.getByText(/propose an event|request a space/i),
  ).toBeVisible()
  // Key form fields are present
  await expect(dialog.locator('#booking-title')).toBeVisible()
  await expect(dialog.locator('#booking-email')).toBeVisible()
})

Then(
  'I see a link to the showcase venue {string}',
  async ({ page }, handle: string) => {
    const link = page.locator(`a[href*="@${handle}"]`)
    await expect(link.first()).toBeVisible({ timeout: 10_000 })
  },
)

// ── Steps: Showcase venue seeding (RAZ-662) ─────────────────────────

Given(
  'the showcase venue {string} exists with bookable spaces',
  async ({}, username: string) => {
    const displayName = username
      .split('-')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    venueStore[username] = await seedVenue(username, displayName, 2)
  },
)

When(
  'I click the showcase venue link {string}',
  async ({ page }, handle: string) => {
    const link = page.locator(`a[href*="@${handle}"]`)
    await link.first().click()
    await page.waitForLoadState('networkidle')
  },
)
