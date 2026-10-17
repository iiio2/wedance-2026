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
    photo,
    profileTo,
    accountLinks,
    switchLinks,
    handleSignOut,
  }
}
