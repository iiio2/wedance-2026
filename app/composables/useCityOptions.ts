import type { CityOption } from '#shared/utils/citySearch'

/**
 * The city suggestion list for <CityCombobox>, fetched once per page session
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
  return { options: readonly(options), status: readonly(status), load }
}
