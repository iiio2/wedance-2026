/**
 * Champion selection for the city-vs-city battle.
 *
 * A city's champion is its highest-ELO approved video. The current month's
 * submissions win when at least two cities have one; otherwise we fall back to
 * each city's best approved video from any month, so the battle never goes
 * dark between submission waves (all-July seed data hid it from Aug 1 —
 * RAZ-307). Pure and unit-tested (`battleChampions.test.ts`).
 */

export interface ChampionCandidate {
  citySlug: string
  competitionMonth: string
  eloScore: number
}

export const MIN_BATTLE_CITIES = 2

/** Highest-ELO entry per city, best city first. */
function bestPerCity<T extends ChampionCandidate>(vids: T[]): T[] {
  const champ = new Map<string, T>()
  for (const v of [...vids].sort((a, b) => b.eloScore - a.eloScore))
    if (!champ.has(v.citySlug)) champ.set(v.citySlug, v)
  return [...champ.values()]
}

/**
 * Pick one champion per city. `vids` = approved videos across all months.
 * `fallback` is true when the current month had too few cities and the
 * all-time pool was used instead.
 */
export function pickChampions<T extends ChampionCandidate>(
  vids: T[],
  month: string,
): { champions: T[]; fallback: boolean } {
  const thisMonth = bestPerCity(vids.filter(v => v.competitionMonth === month))
  if (thisMonth.length >= MIN_BATTLE_CITIES) return { champions: thisMonth, fallback: false }
  return { champions: bestPerCity(vids), fallback: true }
}
