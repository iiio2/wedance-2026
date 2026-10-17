import { CalendarDays, User, Settings, Briefcase, Music, ShieldCheck } from 'lucide-vue-next'

export type NavMode = 'dance' | 'business' | 'admin'

/**
 * Account navigation shared by the dancing header (SiteHeader), the Business
 * layout and the Admin layout, so every side offers the same menu in the same
 * place. The one slot that differs is the mode switch: it lists the other
 * sides — Dancing, Business, and Admin for admins — never the current one.
 */
export function useAccountNav(mode: NavMode) {
  const { isSignedIn, isLoading, authHint, dancerName, username, photo, isAdmin, signOut } = useAuth()
  const sessionCookie = useCookie('wedance-session')

  // Show signed-in UI during SSR/loading when both session + hint cookies exist,
  // so the header doesn't blink "Sign in" on page refresh.
  // Until hydration is done, render only what the server saw (the cookies): the
  // auth plugin restores name/photo/session from localStorage before mount, and
  // showing those on the first client pass mismatched the SSR header.
  const hydrated = useHydrated()
  const hinted = computed(() => !!authHint.value && !!sessionCookie.value)
  const appearsSignedIn = computed(() =>
    hydrated.value ? isSignedIn.value || (isLoading.value && hinted.value) : hinted.value,
  )
  const displayName = computed(() => (hydrated.value && dancerName.value) || authHint.value?.name || 'Profile')
  const displayUsername = computed(() => (hydrated.value && username.value) || authHint.value?.username || null)
  const avatar = computed(() => (hydrated.value && photo.value) || authHint.value?.photo || null)
  const initial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || '?')
  const profileTo = computed(() => displayUsername.value ? `/u/${displayUsername.value}` : '/settings')

  const accountLinks = computed(() => [
    { to: profileTo.value, label: 'My profile', icon: User },
    { to: '/my-year', label: 'My year', icon: CalendarDays },
    { to: '/settings', label: 'Settings', icon: Settings },
  ])

  const sides = computed(() => [
    { mode: 'dance' as const, to: '/my-plan', label: 'Dancing', hint: 'Festivals, cities & your plan', icon: Music },
    { mode: 'business' as const, to: '/business', label: 'Business', hint: 'Your events, venues & profiles', icon: Briefcase },
    ...(isAdmin.value
      ? [{ mode: 'admin' as const, to: '/admin', label: 'Admin', hint: 'Users, claims, festivals & moderation', icon: ShieldCheck }]
      : []),
  ])
  const switchLinks = computed(() => sides.value.filter(s => s.mode !== mode))

  function handleSignOut() {
    signOut()
    navigateTo('/')
  }

  return {
    appearsSignedIn,
    displayName,
    displayUsername,
    initial,
    photo: avatar,
    profileTo,
    accountLinks,
    switchLinks,
    handleSignOut,
  }
}
