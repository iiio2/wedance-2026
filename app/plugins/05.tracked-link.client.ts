/**
 * Promoter tracked links (?via=<code>, server/utils/trackedLinks.ts). Opening
 * one remembers the code for 30 days in the `wd_via` cookie, which the server
 * reads to credit the promoter with a sign-up, a plan add or a ticket, and
 * counts the visit. Last touch wins: a newer link replaces the cookie. The
 * parameter is then dropped from the address bar so a shared URL doesn't carry it.
 */
export default defineNuxtPlugin(() => {
  const router = useRouter()
  const { $trpc } = useNuxtApp()
  const seen = new Set<string>()

  const landingType = (path: string) => path.startsWith('/events/') ? 'event' : path.startsWith('/festivals') ? 'festivals' : path.startsWith('/@') ? 'profile' : path === '/' ? 'home' : 'other'

  const take = (code: unknown) => {
    if (typeof code !== 'string' || !/^[a-z2-9]{8}$/.test(code) || seen.has(code)) return
    seen.add(code)
    document.cookie = `wd_via=${code}; Max-Age=${30 * 24 * 60 * 60}; Path=/; SameSite=Lax`
    $trpc.referral.trackVisit.mutate({ code })
      // tracked_link_visit: the promoter link in PostHog too (the DB counts it
      // once per browser; `counted` says whether this one was new).
      .then(r => useTrack().track('tracked_link_visit', { code_type: 'promoter', referral_code: code, counted: !!r?.counted, landing: landingType(router.currentRoute.value.path) }))
      .catch(() => { /* counting never blocks the page */ })
  }

  const handle = (to: ReturnType<typeof useRoute>) => {
    if (!('via' in to.query)) return
    take(to.query.via)
    const { via: _v, ...query } = to.query
    router.replace({ path: to.path, query, hash: to.hash })
  }
  router.afterEach(to => handle(to as any))
  // The page the visitor landed on.
  router.isReady().then(() => handle(router.currentRoute.value as any))
})
