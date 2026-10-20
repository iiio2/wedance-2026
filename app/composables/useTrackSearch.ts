/**
 * `search_used` for list pages with a search box / filters. Debounced (one event
 * once the visitor stops typing), and privacy-safe: sends the query LENGTH and
 * which filters are set — never the raw query text (it can hold names).
 *
 *   useTrackSearch('festivals', () => ({ query: searchQuery.value }), () => filtered.value.length)
 */
export function useTrackSearch(
  surface: string,
  state: () => { query?: string; filters?: Record<string, unknown> },
  results?: () => number,
  delayMs = 1200,
) {
  if (!import.meta.client) return
  let timer: ReturnType<typeof setTimeout> | undefined
  let last = ''
  watch(state, (s) => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const query = (s.query ?? '').trim()
      const filterKeys = Object.entries(s.filters ?? {}).filter(([, v]) => v !== '' && v != null && v !== false).map(([k]) => k).sort()
      const sig = `${query.length}|${filterKeys.join(',')}|${query}`
      // Nothing set (cleared) or nothing changed → no event.
      if ((!query && !filterKeys.length) || sig === last) return
      last = sig
      useTrack().track('search_used', {
        surface,
        query_length: query.length,
        filter_keys: filterKeys,
        results: results ? results() : undefined,
      })
    }, delayMs)
  }, { deep: true })
  onBeforeUnmount(() => clearTimeout(timer))
}
