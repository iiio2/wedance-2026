import { CalendarDays, User, Settings, Briefcase, Music } from 'lucide-vue-next'

export type NavMode = 'dance' | 'business'

/**
 * Account navigation shared by the dancing header (SiteHeader) and the
 * Business layout, so both sides offer the same menu in the same place.
 * The one slot that differs is the mode switch: "Business" on the dancing
 * side, "Dancing" on the business side — you leave a side the way you came in.
 */
export function useAccountNav(mode: NavMode) {
  const { isSignedIn, isLoading, authHint, dancerName, username, photo, signOut } = useAuth()
  const sessionCookie = useCookie('wedance-session')

  // Show signed-in UI during SSR/loading when both session + hint cookies exist,
  // so the header doesn't blink "Sign in" on page refresh.
  const appearsSignedIn = computed(() =>
    isSignedIn.value || (isLoading.value && !!authHint.value && !!sessionCookie.value),
  )
  const displayName = computed(() => dancerName.value || authHint.value?.name || 'Profile')
  const displayUsername = computed(() => username.value || authHint.value?.username || null)
  const initial = computed(() => displayName.value.trim().charAt(0).toUpperCase() || '?')
  const profileTo = computed(() => displayUsername.value ? `/u/${displayUsername.value}` : '/settings')

  const accountLinks = computed(() => [
    { to: profileTo.value, label: 'My profile', icon: User },
    { to: '/my-year', label: 'My year', icon: CalendarDays },
    { to: '/settings', label: 'Settings', icon: Settings },
  ])

  const switchLink = mode === 'dance'
    ? { to: '/business', label: 'Business', hint: 'Your events, venues & profiles', icon: Briefcase }
    : { to: '/my-plan', label: 'Dancing', hint: 'Festivals, cities & your plan', icon: Music }

  function handleSignOut() {
    signOut()
    navigateTo('/')
  }

  return {
    appearsSignedIn,
    displayName,
    displayUsername,
    initial,
    photo,
    profileTo,
    accountLinks,
    switchLink,
    handleSignOut,
  }
}
