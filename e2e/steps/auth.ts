import { expect } from '@playwright/test'
import { Given, When, Then } from './fixtures'
import pg from 'pg'
import { FirebaseScrypt } from 'firebase-scrypt'

// ── Helpers ─────────────────────────────────────────────────────────

function getDbUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set — cannot run E2E tests')
  return url
}

function getScrypt(): FirebaseScrypt {
  return new FirebaseScrypt({
    memCost: 14,
    rounds: 8,
    saltSeparator: String(process.env.FIREBASE_SALT_SEPARATOR),
    signerKey: String(process.env.FIREBASE_SIGNER_KEY),
  })
}

/** Query the dancers table for the magic reset token of a given email. */
async function getMagicToken(email: string): Promise<string> {
  const client = new pg.Client({ connectionString: getDbUrl() })
  try {
    await client.connect()
    const res = await client.query(
      `SELECT magic_token FROM dancers
       WHERE email = $1
         AND magic_token IS NOT NULL
         AND magic_token_expires_at > NOW()
       LIMIT 1`,
      [email],
    )
    if (!res.rows.length || !res.rows[0].magic_token) {
      throw new Error(`No valid magic token found for ${email}`)
    }
    return res.rows[0].magic_token as string
  } finally {
    await client.end()
  }
}

/** Register a user directly via SQL with FirebaseScrypt hashing. */
async function seedTestUser(email: string, password: string): Promise<void> {
  const salt = Buffer.from(String(Math.random()).slice(7)).toString('base64')
  const scrypt = getScrypt()
  const hash = await scrypt.hash(password, salt)
  const username = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  const client = new pg.Client({ connectionString: getDbUrl() })
  try {
    await client.connect()
    await client.query(
      `INSERT INTO dancers (name, email, username, salt, hash)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET salt = $4, hash = $5`,
      ['Reset Tester', email, username, salt, hash],
    )
  } finally {
    await client.end()
  }
}

// ── Fixture guard ───────────────────────────────────────────────────

Given('the test environment is safe to write', async () => {
  const baseUrl = (process.env.BASE_URL || 'http://localhost:3000').replace(
    /\/$/,
    '',
  )
  const url = new URL(baseUrl)
  const isLocal =
    url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (!isLocal) {
    throw new Error(
      `Refusing to run write-tests against non-localhost URL: ${baseUrl}. ` +
        'Vercel previews share the production database.',
    )
  }
})

// ── Background: test user for password-reset scenario ───────────────

Given('a test user exists with a known password', async ({ testEmail }) => {
  // Reuse the unique testEmail but with a "reset-" prefix so it doesn't
  // collide with the signup scenario's email.
  const email = testEmail.replace('smoke-', 'reset-')
  const password = 'OldPass123!'

  await seedTestUser(email, password)

  // Stash credentials into the test context via the BDD world.
  // Playwright-bdd fixtures don't allow writing back, so we use a module-
  // level store keyed by the test email (only one scenario runs at a time).
  resetUserStore.email = email
  resetUserStore.password = password
})

// Module-level store for cross-step state within a single scenario.
const resetUserStore: { email: string; password: string } = {
  email: '',
  password: '',
}

// ── Navigation ──────────────────────────────────────────────────────

Given('I am on the home page', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
})

Given('I am not signed in', async ({ page }) => {
  // Navigate first so localStorage is accessible (about:blank throws SecurityError).
  await page.goto('/')
  await page.context().clearCookies()
  await page.evaluate(() => localStorage.clear())
})

Given('I am on an event page', async ({ page }) => {
  // Seed a test event so the page has a "Going?" button.
  // Use a fixed UUID so we can navigate directly to /events/<uuid>.
  const testEventId = '00000000-0000-4000-a000-000000000001'
  const client = new pg.Client({ connectionString: getDbUrl() })
  try {
    await client.connect()
    await client.query(
      `INSERT INTO events (id, slug, name, type, city, start_date, end_date, archived, published)
       VALUES ($1, $2, $3, $4, $5, NOW() + interval '1 day', NOW() + interval '1 day 3 hours', false, true)
       ON CONFLICT (id) DO NOTHING`,
      [testEventId, 'smoke-test-event', 'Smoke Test Salsa Night', 'Party', 'Munich'],
    )
  } finally {
    await client.end()
  }

  await page.goto(`/events/${testEventId}`)
  await page.waitForLoadState('networkidle')
})

// ── Header interactions ─────────────────────────────────────────────

When('I click "Sign in" in the header', async ({ page }) => {
  await page.locator('header').getByRole('button', { name: 'Sign in' }).click()
  // Wait for the modal to appear.
  await expect(page.locator('[role="dialog"]')).toBeVisible()
})

When('I click "Sign out" in the header', async ({ page }) => {
  // Sign out lives in the account menu (desktop header).
  await page.locator('header').getByRole('button', { name: 'Account menu' }).click()
  await page.locator('header').getByRole('menuitem', { name: 'Sign out' }).click()
  // Wait for the sign-out confirmation dialog.
  await expect(page.locator('[role="dialog"]')).toBeVisible()
})

When('I confirm sign out', async ({ page }) => {
  // The dialog has a "Sign out" button inside the footer.
  await page
    .locator('[role="dialog"]')
    .getByRole('button', { name: 'Sign out' })
    .click()
  // Wait for the dialog to close.
  await expect(page.locator('[role="dialog"]')).not.toBeVisible()
})

// ── Modal interactions ──────────────────────────────────────────────

When(
  'I click "Create an account" in the modal',
  async ({ page }) => {
    await page
      .locator('[role="dialog"]')
      .getByRole('button', { name: 'Create an account' })
      .click()
  },
)

When(
  'I click "Sign in" in the modal',
  async ({ page }) => {
    // The "Sign in" submit button (inside the form, not the mode toggle).
    await page
      .locator('[role="dialog"] form')
      .getByRole('button', { name: /^Sign in$/ })
      .click()
  },
)

// ── Form interactions ───────────────────────────────────────────────

When(
  'I fill in "Name" with {string}',
  async ({ page }, value) => {
    await page.getByLabel('Name').fill(value)
  },
)

When('I fill in "Email" with a unique test email', async ({ page, testEmail }) => {
  await page.getByLabel('Email').fill(testEmail)
})

When(
  'I fill in "Email" with the same test email',
  async ({ page, testEmail }) => {
    await page.getByLabel('Email').fill(testEmail)
  },
)

When(
  'I fill in "Email" with the test user email',
  async ({ page }) => {
    await page.getByLabel('Email').fill(resetUserStore.email)
  },
)

When('I fill in "Password" with {string}', async ({ page }, value) => {
  // On the reset page labels are "New password" / "Confirm password".
  // Inside a dialog/form, the label is just "Password".
  const label = page.getByLabel('Password', { exact: true })
  if (await label.isVisible()) {
    await label.fill(value)
  } else {
    // Fallback: try input by placeholder.
    await page.locator('input[type="password"]').first().fill(value)
  }
})

When('I fill in "New password" with {string}', async ({ page }, value) => {
  await page.getByLabel('New password').fill(value)
})

When('I fill in "Confirm password" with {string}', async ({ page }, value) => {
  await page.getByLabel('Confirm password').fill(value)
})

When('I click "Create account"', async ({ page }) => {
  await page
    .locator('[role="dialog"] form')
    .getByRole('button', { name: 'Create account' })
    .click()
})

When('I click "Forgot password?"', async ({ page }) => {
  await page
    .locator('[role="dialog"]')
    .getByRole('button', { name: 'Forgot password?' })
    .click()
})

When(
  'I fill in the recovery email with the test user email',
  async ({ page }) => {
    await page.getByLabel('Email').fill(resetUserStore.email)
  },
)

When('I click "Send me a reset link"', async ({ page }) => {
  await page
    .locator('[role="dialog"] form')
    .getByRole('button', { name: 'Send me a reset link' })
    .click()
})

When('I click "Save new password"', async ({ page }) => {
  await page
    .getByRole('button', { name: 'Save new password' })
    .click()
})

// ── Password reset: visit the link from the DB ──────────────────────

When(
  'I visit the password reset link from the database',
  async ({ page }) => {
    // Read the magic token that requestMagicLink wrote to the DB.
    const token = await getMagicToken(resetUserStore.email)
    await page.goto(`/auth/verify?token=${token}&mode=reset`)
    await page.waitForLoadState('networkidle')
    // The reset form should be visible.
    await expect(page.getByText('Set a new password')).toBeVisible()
  },
)

// ── "Going?" gate ───────────────────────────────────────────────────

When('I click the "Going?" button', async ({ page }) => {
  const goingBtn = page.getByRole('button', { name: 'Going?' })
  await expect(goingBtn).toBeVisible({ timeout: 10_000 })
  await goingBtn.click()
})

// ── Assertions ──────────────────────────────────────────────────────

Then('I should be signed in', async ({ page }) => {
  // The header shows the account menu when signed in.
  await expect(
    page.locator('header').getByRole('button', { name: 'Account menu' }),
  ).toBeVisible({ timeout: 15_000 })
})

Then('I should be signed out', async ({ page }) => {
  // The header shows "Sign in" when signed out.
  await expect(
    page.locator('header').getByRole('button', { name: 'Sign in' }),
  ).toBeVisible({ timeout: 10_000 })
})

Then('I see {string}', async ({ page }, text) => {
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({
    timeout: 10_000,
  })
})

Then('the sign-up modal is visible', async ({ page }) => {
  const dialog = page.locator('[role="dialog"]')
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  // The modal for a signed-out "Going" click shows the register view.
  await expect(
    dialog.getByRole('heading', { name: 'Join WeDance' }),
  ).toBeVisible()
})

Then('no event is saved to my week plan', async ({ page }) => {
  // The sign-up modal is still open, so "Going?" may be behind it.
  // The real assertion: "Going!" (saved state) must NOT exist anywhere.
  const goingDone = page.getByRole('button', { name: 'Going!' })
  await expect(goingDone).not.toBeVisible()
})
