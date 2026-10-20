// Auth composable — email + password + session-based authentication.
// Magic-link methods (requestMagicLink/verifyMagicLink) are retained but
// dormant: the primary sign-in UX is email+password, but the pages
// app/pages/auth/verify.vue and app/pages/charanga/claim.vue still call them.
const _isSignedIn = ref(false)
const _dancerId = ref<string | null>(null)
const _dancerName = ref<string | null>(null)
const _isAdmin = ref(false)
const _isLoading = ref(true)
// Profile fields used for personalization + the onboarding guard. Populated by
// init()'s me query; null/[] until then. `justRegistered` marks a brand-new
// signup this session so my-plan can show the first-run hint after onboarding.
const _username = ref<string | null>(null)
const _bio = ref<string | null>(null)
const _photo = ref<string | null>(null)
const _instagram = ref<string | null>(null)
const _youtube = ref<string | null>(null)
const _website = ref<string | null>(null)
const _profilePublic = ref(true)
const _city = ref<string | null>(null)
const _danceStyles = ref<string[]>([])
const _danceLevels = ref<Record<string, string>>({})
const _role = ref<string | null>(null)
const _intent = ref<string | null>(null)
const _onboardedAt = ref<string | null>(null)
const _justRegistered = ref(false)

// --- localStorage auth cache ---
// Caches essential auth state so page refreshes show the signed-in UI
// instantly instead of blinking while the auth.me network call resolves.
const AUTH_CACHE_KEY = 'wedance-auth'

interface AuthCache {
  dancerId: string
  dancerName: string
  isAdmin: boolean
  username: string | null
  photo: string | null
  city: string | null
  danceStyles: string[]
  onboardedAt: string | null
}

function _saveAuthCache(): void {
  if (!import.meta.client) return
  try {
    const data: AuthCache = {
      dancerId: _dancerId.value!,
      dancerName: _dancerName.value!,
      isAdmin: _isAdmin.value,
      username: _username.value,
      photo: _photo.value,
      city: _city.value,
      danceStyles: [..._danceStyles.value],
      onboardedAt: _onboardedAt.value,
    }
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(data))
  } catch {
    // localStorage unavailable (private browsing, quota exceeded) — silent
  }
}

function _loadAuthCache(): AuthCache | null {
  if (!import.meta.client) return null
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthCache
  } catch {
    return null
  }
}

function _clearAuthCache(): void {
  if (!import.meta.client) return
  try {
    localStorage.removeItem(AUTH_CACHE_KEY)
  } catch {
    // silent
  }
}

interface AuthHint {
  name: string
  username: string | null
  // Lets SSR render the avatar too; older cookies lack it.
  photo?: string | null
}

export function useAuth() {
  const { $trpc, $setAuthToken } = useNuxtApp()

  // SSR-readable auth hint cookie — lets the server render signed-in UI
  // immediately so the header doesn't blink "Sign in" on page refresh.
  // Written on login/register, cleared on sign-out.
  const _authHint = useCookie<AuthHint | null>('wedance-auth-hint', {
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
    sameSite: 'lax' as const,
    default: () => null,
  })

  function _syncAuthHint(): void {
    if (_isSignedIn.value && _dancerName.value) {
      _authHint.value = {
        name: _dancerName.value,
        username: _username.value,
        // Only short hosted URLs — a data: URL would overflow the 4 KB cookie.
        photo: _photo.value?.startsWith('http') && _photo.value.length <= 500 ? _photo.value : null,
      }
    } else {
      _authHint.value = null
    }
  }

  // Populate all auth state refs from a server `me` response and update cache.
  function _applyMe(me: {
    id: string
    name: string
    isAdmin: boolean
    username?: string | null
    city?: string | null
    danceStyles?: string[] | null
    danceLevels?: Record<string, string> | null
    role?: string | null
    intent?: string | null
    onboardedAt?: string | null
    bio?: string | null
    photo?: string | null
    instagram?: string | null
    youtube?: string | null
    website?: string | null
    profilePublic?: boolean | null
  }): void {
    _isSignedIn.value = true
    _dancerId.value = me.id
    _dancerName.value = me.name
    _username.value = me.username ?? null
    _isAdmin.value = me.isAdmin
    _city.value = me.city ?? null
    _danceStyles.value = me.danceStyles ?? []
    _danceLevels.value = me.danceLevels ?? {}
    _role.value = me.role ?? null
    _intent.value = me.intent ?? null
    _onboardedAt.value = me.onboardedAt ?? null
    _bio.value = me.bio ?? null
    _photo.value = me.photo ?? null
    _instagram.value = me.instagram ?? null
    _youtube.value = me.youtube ?? null
    _website.value = me.website ?? null
    _profilePublic.value = me.profilePublic ?? true
    _saveAuthCache()
    _syncAuthHint()
    // Identify on every auth.me (sign-in AND session restore from cookie/cache),
    // so dancers who never re-log in still get attributed. Idempotent in
    // useTrack. Non-PII person properties only — never name/email.
    useTrack().identify(me.id, {
      city: me.city ?? null,
      is_admin: me.isAdmin,
      role: me.role ?? null,
      intent: me.intent ?? null,
      onboarded: !!me.onboardedAt,
      dance_styles_count: me.danceStyles?.length ?? 0,
      has_username: !!me.username,
    })
  }

  // Server round-trip to validate the session and refresh auth state.
  async function _validateSession(): Promise<void> {
    try {
      const me = await $trpc.auth.me.query()
      if (me) {
        _applyMe(me)
      } else {
        // Server explicitly says session is invalid/expired — clear it.
        signOut()
      }
    } catch {
      // Network error, timeout, or server 500 — do NOT destroy the
      // cookie.  The session may still be valid; nuking it forces a
      // needless re-login.  Leave existing state (cached or default)
      // and keep the cookie so the next refresh can try again.
    } finally {
      _isLoading.value = false
    }
  }

  async function init() {
    const sessionCookie = useCookie('wedance-session')
    if (!sessionCookie.value) {
      _clearAuthCache()
      _authHint.value = null
      _isLoading.value = false
      return
    }

    // Ensure the TRPC auth header ref carries the cookie's token.
    // After SSR hydration the plugin's ref may be stale (SSR reads the
    // raw header, client reads useCookie — different refs). Force-sync
    // so the auth.me query always includes the correct Bearer token.
    $setAuthToken(sessionCookie.value)

    // Restore cached auth state immediately so the page renders the
    // signed-in UI without waiting for the network.
    const cached = _loadAuthCache()
    if (cached) {
      _isSignedIn.value = true
      _dancerId.value = cached.dancerId
      _dancerName.value = cached.dancerName
      _isAdmin.value = cached.isAdmin
      _username.value = cached.username
      // Older caches predate `photo` — fall back to null until auth.me lands.
      _photo.value = cached.photo ?? null
      _city.value = cached.city
      _danceStyles.value = cached.danceStyles
      _onboardedAt.value = cached.onboardedAt
      _isLoading.value = false
      // Validate in background — updates stale fields or signs out if expired.
      _validateSession()
      return
    }

    // No cache (first login on this browser) — await the full round-trip.
    await _validateSession()
  }

  async function requestMagicLink(data: {
    name?: string
    email: string
    danceStyles?: string[]
    role?: 'lead' | 'follow' | 'both'
    city?: string
    purpose?: 'login' | 'recovery'
  }) {
    return await $trpc.auth.requestMagicLink.mutate({
      name: data.name,
      email: data.email,
      danceStyles: data.danceStyles ?? [],
      role: data.role,
      city: data.city,
      purpose: data.purpose,
    })
  }

  async function verifyMagicLink(token: string) {
    const result = await $trpc.auth.verifyMagicLink.mutate({ token })
    setSession(result)
    // The server says whether this first verified link created the account.
    useTrack().track(result.isNew ? 'signup_completed' : 'login_completed', { method: 'magic_link' })
    return result
  }

  async function resetPassword(token: string, newPassword: string) {
    const result = await $trpc.auth.resetPassword.mutate({ token, newPassword })
    setSession(result)
    return result
  }

  async function login(data: { email: string; password: string }) {
    const result = await $trpc.auth.login.mutate({
      email: data.email,
      password: data.password,
    })
    setSession(result)
    useTrack().track('login_completed', { method: 'password' })
    return result
  }

  async function register(data: {
    name: string
    email: string
    password: string
    danceStyles?: string[]
    role?: 'lead' | 'follow' | 'both'
    city?: string
  }) {
    const result = await $trpc.auth.register.mutate({
      name: data.name,
      email: data.email,
      password: data.password,
      danceStyles: data.danceStyles ?? [],
      role: data.role,
      city: data.city,
    })
    setSession(result)
    // Mark this session as a fresh signup so the caller can route to
    // /onboarding and my-plan can show the first-run hint.
    _justRegistered.value = true
    // CUJ: "Sign up & onboard" — account created.
    useTrack().track('signup_completed', { method: 'password' })
    return result
  }

  // Re-pull the profile after a mutation that changes it (e.g. onboarding,
  // profile edit). Also refreshes name + username so the header reflects edits.
  async function refreshMe() {
    try {
      const me = await $trpc.auth.me.query()
      if (me) {
        _applyMe(me)
      }
    } catch {
      // best-effort refresh; leave existing state on failure
    }
  }

  async function completeOnboarding(data: {
    intent: string
    city?: string
    danceStyles?: string[]
    role?: 'lead' | 'follow' | 'both'
  }) {
    await $trpc.auth.completeOnboarding.mutate({
      intent: data.intent,
      city: data.city,
      danceStyles: data.danceStyles,
      role: data.role,
    })
    await refreshMe()
    // CUJ: "Sign up & onboard" — onboarding finished (intent chosen).
    useTrack().track('onboarding_completed', { intent: data.intent })
  }

  // Edit the signed-in dancer's own profile, then refresh local state so the
  // header + personalization update immediately.
  async function updateProfile(data: {
    name?: string
    city?: string
    danceStyles?: string[]
    danceLevels?: Record<string, 'Beginner' | 'Intermediate' | 'Advanced'>
    role?: 'lead' | 'follow' | 'both'
    photo?: string
    bio?: string
    instagram?: string
    youtube?: string
    website?: string
    profilePublic?: boolean
  }) {
    await $trpc.profile.update.mutate(data)
    await refreshMe()
    // CUJ: "Manage profile" — profile edited/saved.
    useTrack().track('profile_updated')
  }

  async function changePassword(data: { currentPassword: string; newPassword: string }) {
    await $trpc.auth.changePassword.mutate(data)
  }

  async function deleteAccount() {
    await $trpc.auth.deleteAccount.mutate()
    // Immediately clear the session since the account is deleted.
    signOut()
  }

  function setSession(data: {
    sessionToken: string
    dancerId: string
    name: string
    isAdmin: boolean
  }) {
    $setAuthToken(data.sessionToken)
    _isSignedIn.value = true
    _dancerId.value = data.dancerId
    _dancerName.value = data.name
    _isAdmin.value = data.isAdmin
    _saveAuthCache()
    _syncAuthHint()
    // Tie analytics events to this dancer (login / register / magic-link).
    // No person properties here (the name is PII); _applyMe adds the non-PII
    // ones once auth.me resolves.
    useTrack().identify(data.dancerId)
  }

  function signOut() {
    $setAuthToken(null)
    _clearAuthCache()
    _authHint.value = null
    _isSignedIn.value = false
    _dancerId.value = null
    _dancerName.value = null
    _username.value = null
    _bio.value = null
    _photo.value = null
    _instagram.value = null
    _youtube.value = null
    _website.value = null
    _profilePublic.value = true
    _isAdmin.value = false
    _city.value = null
    _danceStyles.value = []
    _danceLevels.value = {}
    _role.value = null
    _intent.value = null
    _onboardedAt.value = null
    _justRegistered.value = false
    // Stop attributing events to this dancer after sign-out.
    useTrack().reset()
  }

  return {
    isSignedIn: readonly(_isSignedIn),
    authHint: readonly(_authHint),
    dancerId: readonly(_dancerId),
    dancerName: readonly(_dancerName),
    username: readonly(_username),
    bio: readonly(_bio),
    photo: readonly(_photo),
    instagram: readonly(_instagram),
    youtube: readonly(_youtube),
    website: readonly(_website),
    profilePublic: readonly(_profilePublic),
    isAdmin: readonly(_isAdmin),
    isLoading: readonly(_isLoading),
    city: readonly(_city),
    danceStyles: readonly(_danceStyles),
    danceLevels: readonly(_danceLevels),
    role: readonly(_role),
    intent: readonly(_intent),
    onboardedAt: readonly(_onboardedAt),
    justRegistered: readonly(_justRegistered),
    init,
    login,
    register,
    completeOnboarding,
    updateProfile,
    changePassword,
    deleteAccount,
    refreshMe,
    requestMagicLink,
    verifyMagicLink,
    resetPassword,
    signOut,
  }
}
