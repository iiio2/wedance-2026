import { useDb } from '../utils/db'
import { listFestivals, type FestivalRow } from '../utils/festivalListing'

export type { FestivalRow, GoingAvatar } from '../utils/festivalListing'
/**
 * SSR-friendly festivals directory for /festivals (useFetch during SSR, no
 * spinner on mount).
 *
 * Festivals are events (ADR-006): published festival, congress and weekender
 * events that haven't ended, soonest first — the wedance.vip mirror plus
 * festivals listed on WeDance. It used to read the legacy `festivals` table,
 * whose rows had their dates moved months ahead to fill the page (fbcce08), so
 * it showed festivals on days they never ran.
 *
 * signupCount = dancers who clicked "Going" (plan_items, by the row's planType/planId).
 * publicGoingCount = verified ticket holders with public profiles (RAZ-314).
 * goingAvatars = first 5 verified ticket holders (RAZ-314, "no fake friends").
 */
export default defineEventHandler((): Promise<FestivalRow[]> => listFestivals(useDb()))
