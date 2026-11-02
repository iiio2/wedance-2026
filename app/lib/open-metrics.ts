/**
 * /open — "Open metrics": the public PostHog dashboard and what's on it.
 *
 * OPEN_METRICS_DASHBOARD_URL is the PostHog *shared dashboard* link
 * (Dashboard → Share → "Share dashboard publicly"). Kept in code, not env, so
 * the public link is versioned and reviewable. Empty string = not published
 * yet: the page shows "Live dashboard coming shortly" instead of a button.
 */
export const OPEN_METRICS_DASHBOARD_URL = 'https://eu.posthog.com/shared/ONKnioxDNNkpt_9UmV8kCGm2WumY_A'

export const hasOpenMetricsDashboard = (url: string = OPEN_METRICS_DASHBOARD_URL) =>
  /^https:\/\//.test(url.trim())

export interface MetricTile {
  title: string
  body: string
}

/** One entry per tile on the public dashboard, in dashboard order. */
export const OPEN_METRICS_TILES: MetricTile[] = [
  { title: 'Active users', body: 'Distinct people using WeDance per day and per week.' },
  { title: 'New vs returning', body: 'How many visitors are here for the first time, and how many come back.' },
  { title: 'Sign-up funnel', body: 'Visit → sign-up → finished onboarding → first event added to a plan. Where people drop off.' },
  { title: 'Sign-ups & logins', body: 'Counted on the server, so ad blockers don’t hide them.' },
  { title: 'Events by organisers', body: 'Events created and published by organisers on WeDance.' },
  { title: 'Ticket intent', body: 'Clicks on a ticket button, and how many of those start a checkout.' },
  { title: 'Core engagement', body: 'Event views, plan adds, follows, hangout RSVPs and searches.' },
  { title: 'Page speed', body: 'Largest Contentful Paint at the 75th percentile. Good is under 2.5 s.' },
  { title: 'Visitors by section', body: 'Which parts of the site people use: cities, festivals, artists, profiles and more.' },
]
