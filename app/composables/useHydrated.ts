/**
 * `true` once the initial hydration is done (always `false` during SSR).
 *
 * Gate client-only state (localStorage, the dancer's session data) behind it:
 * rendering that state on the first client pass makes it differ from the
 * server HTML and Vue logs "Hydration completed but contains mismatches".
 * Same hook as plugins/04.plan.client.ts.
 */
export function useHydrated() {
  const hydrated = useState('hydrated', () => false)
  if (import.meta.client && !hydrated.value) {
    const nuxtApp = useNuxtApp()
    if (nuxtApp.isHydrating) nuxtApp.hooks.hookOnce('app:suspense:resolve', () => { hydrated.value = true })
    else hydrated.value = true
  }
  return hydrated
}
