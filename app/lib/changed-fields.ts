/**
 * Which fields an edit actually changed — field NAMES only, for analytics
 * (`profile_updated.fields_changed`). Never the values: a bio or name is free
 * text. Empty/null/undefined count as the same "unset" value; arrays and
 * objects compare by content.
 */
export function changedFields(before: Record<string, unknown>, patch: Record<string, unknown>): string[] {
  const norm = (v: unknown) => (v === '' || v === null || v === undefined ? null : v)
  const same = (a: unknown, b: unknown) => JSON.stringify(norm(a)) === JSON.stringify(norm(b))
  return Object.keys(patch).filter(k => patch[k] !== undefined && !same(before[k], patch[k])).sort()
}
