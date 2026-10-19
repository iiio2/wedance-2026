/**
 * "Signed in?" that is safe to branch on in a server-rendered template.
 *
 * The server never knows the session (useAuth's state stays signed-out there),
 * while plugins/02.auth.client.ts restores it from localStorage BEFORE the app
 * hydrates. A template on raw `isSignedIn` therefore renders "Sign in" on the
 * server and "Post a gig" on the client's first pass, and Vue logs "Hydration
 * completed but contains mismatches".
 *
 * Until hydration is done this answers what the server could see (the session +
 * auth-hint cookies, so a returning dancer gets the signed-in UI in the HTML,
 * without a "Sign in" flash), then the real state. A hinted session that turns
 * out to be expired keeps reading signed-in only while auth.me is in flight.
 */
export function useAppearsSignedIn() {
  const { isSignedIn, isLoading, authHint } = useAuth()
  const sessionCookie = useCookie('wedance-session')
  const hydrated = useHydrated()
  const hinted = computed(() => !!authHint.value && !!sessionCookie.value)
  return computed(() =>
    hydrated.value ? isSignedIn.value || (isLoading.value && hinted.value) : hinted.value,
  )
}
