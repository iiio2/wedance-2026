import { describe, expect, it } from 'vitest'
import { OPEN_METRICS_DASHBOARD_URL, OPEN_METRICS_TILES, hasOpenMetricsDashboard } from './open-metrics'

describe('open metrics', () => {
  it('treats an empty or non-https URL as "not published yet"', () => {
    expect(hasOpenMetricsDashboard('')).toBe(false)
    expect(hasOpenMetricsDashboard('   ')).toBe(false)
    expect(hasOpenMetricsDashboard('http://example.com')).toBe(false)
    expect(hasOpenMetricsDashboard('https://eu.posthog.com/shared/abc')).toBe(true)
  })

  it('ships either no link or an https link', () => {
    expect(OPEN_METRICS_DASHBOARD_URL === '' || hasOpenMetricsDashboard()).toBe(true)
  })

  it('has unique, non-empty tiles', () => {
    const titles = OPEN_METRICS_TILES.map(t => t.title)
    expect(new Set(titles).size).toBe(titles.length)
    for (const t of OPEN_METRICS_TILES) expect(t.body.length).toBeGreaterThan(0)
  })
})
