/**
 * Finding plan items that point at mock data (app/data/mock-*.ts) — written
 * into real plans by the old onboarding auto-fill (mock city classes like
 * `muc-3`, preview-only festivals like `timba-fest-london-2026`). Pure, so the
 * selection is unit-tested; scripts/cleanup-mock-plan-items.ts does the I/O.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Every `id` / `slug` string anywhere in the mock modules' exports. UUIDs are
 * left out: a real event id must never be mistaken for a mock one.
 */
export function collectMockIds(modules: unknown[]): Set<string> {
  const out = new Set<string>()
  const seen = new Set<unknown>()
  const walk = (v: unknown) => {
    if (!v || typeof v !== 'object' || seen.has(v)) return
    seen.add(v)
    if (Array.isArray(v)) { v.forEach(walk); return }
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if ((k === 'id' || k === 'slug') && typeof val === 'string' && val && !UUID_RE.test(val)) out.add(val)
      else walk(val)
    }
  }
  modules.forEach(walk)
  return out
}

export type MockPlanItemRow = { id: string; dancerId: string; itemType: string; itemId: string }

/**
 * The plan items to delete: events and festivals whose item id is a mock id
 * and NOT also a real row (a festival slug, an event slug / festival key).
 * Several mock festival slugs (meneate-viena-2026, …) are real festivals too —
 * plans for those are real choices and stay. Workshops and goals are never touched.
 */
export function selectMockPlanItems(rows: MockPlanItemRow[], mockIds: Set<string>, realIds: Set<string>): MockPlanItemRow[] {
  return rows.filter(r =>
    (r.itemType === 'event' || r.itemType === 'festival')
    && mockIds.has(r.itemId)
    && !realIds.has(r.itemId)
    && !UUID_RE.test(r.itemId),
  )
}

/** Count per key, biggest first. */
export function countMockBy<T>(rows: T[], key: (r: T) => string): Array<[string, number]> {
  const m = new Map<string, number>()
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}
