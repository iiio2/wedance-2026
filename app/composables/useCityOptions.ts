import type { CityOption } from '#shared/utils/citySearch'

/**
 * The known-city list for <CityCombobox> (canonical `cities` rows, or the
 * pre-migration catalogue until the table exists), fetched once per page session
 * and shared by every combobox on the page. Lazy: nothing is requested until a
 * field calls load() (on focus), so pages with a city field pay nothing up front.
 */
const options = ref<CityOption[]>([])
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
let inflight: Promise<void> | null = null

export function useCityOptions() {
  function load() {
    if (import.meta.server || status.value === 'ready') return Promise.resolve()
    if (inflight) return inflight
    status.value = 'loading'
    inflight = $fetch<CityOption[]>('/api/city-options')
      .then((rows) => { options.value = rows; status.value = 'ready' })
      .catch(() => { status.value = 'error' })
      .finally(() => { inflight = null })
    return inflight
  }
  /** Add a just-resolved city so the next search finds it locally. */
  function remember(city: CityOption) {
    if (!city.slug || options.value.some(o => (city.id && o.id === city.id) || o.slug === city.slug)) return
    options.value = [...options.value, city]
  }
  return { options: readonly(options), status: readonly(status), load, remember }
}

/**
 * Server-side city search + resolve for <CityCombobox>. `search` is only called
 * when the known-city list has too few matches (the server then asks Google
 * Places); `resolve` turns a picked Google suggestion into the canonical city.
 * One Places session token per typing session: autocomplete requests and the
 * closing Details call are billed together.
 */
export function useCityLookup() {
  let token: string | null = null
  const session = () => (token ??= (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`))
  return {
    session,
    endSession() { token = null },
    search(q: string, limit = 8) {
      return $fetch<{ results: CityOption[], google: boolean, canonical: boolean }>('/api/city-search', { query: { q, session: session(), limit } })
    },
    resolve(placeId: string, query?: string) {
      return $fetch<{ city: CityOption, persisted: boolean, created: boolean }>('/api/city-resolve', {
        method: 'POST',
        body: { placeId, session: session(), query },
      })
    },
  }
}
