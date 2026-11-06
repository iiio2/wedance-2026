export type Social = { platform: string; url: string }

/**
 * Merge social links by platform: a given link replaces that platform's,
 * an empty one removes it, platforms not given stay as they are.
 */
export function mergeSocials(current: Social[] | null | undefined, given: Social[]): Social[] {
  const next = new Map(given.map(s => [s.platform.trim().toLowerCase(), s.url.trim()]))
  const kept = (current ?? []).filter(s => !next.has(s.platform.toLowerCase()))
  return [...kept, ...[...next].filter(([, url]) => url).map(([platform, url]) => ({ platform, url }))]
}
