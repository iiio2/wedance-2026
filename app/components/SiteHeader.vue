<script setup lang="ts">
/**
 * SiteHeader — the shared V3 top bar (brand + nav + auth) used on every
 * page. One place to change the nav or the sign-in affordance.
 */
const { isSignedIn, isLoading, authHint, dancerName, username, signOut } = useAuth()
const sessionCookie = useCookie('wedance-session')
const showSignIn = ref(false)
const showSignOutConfirm = ref(false)

// Show signed-in UI during SSR/loading when both session + hint cookies exist,
// so the header doesn't blink "Sign in" on page refresh.
const appearsSignedIn = computed(() =>
  isSignedIn.value || (isLoading.value && !!authHint.value && !!sessionCookie.value),
)
const displayName = computed(() =>
  dancerName.value || authHint.value?.name || 'Profile',
)
const displayUsername = computed(() =>
  username.value || authHint.value?.username || null,
)

function handleSignOut() {
  signOut()
  navigateTo('/')
}

const links = [
  { to: '/festivals', label: 'Festivals', always: true },
  { to: '/cities', label: 'Cities', always: true },
]
</script>

<template>
  <header class="border-b border-border">
    <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
      <Brand />
      <nav class="flex items-center gap-4 text-sm">
        <NuxtLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="italic hover:underline"
          :class="l.always ? '' : 'hidden sm:inline'"
        >{{ l.label }}</NuxtLink>

        <!-- Auth -->
        <template v-if="appearsSignedIn">
          <NuxtLink
            to="/my-plan"
            class="hidden sm:inline italic hover:underline"
          >My plan</NuxtLink>
          <NuxtLink
            :to="displayUsername ? `/u/${displayUsername}` : '/my-plan'"
            class="hidden sm:inline font-bold hover:underline text-foreground font-display"
          >{{ displayName }}</NuxtLink>
          <NuxtLink
            to="/business"
            class="hidden sm:inline italic hover:underline"
          >Business</NuxtLink>
          <NuxtLink
            to="/settings"
            class="hidden sm:inline italic hover:underline text-secondary"
          >Settings</NuxtLink>
          <Button
            type="button"
            variant="link"
            class="h-auto p-0 font-normal italic text-secondary"
            @click="showSignOutConfirm = true"
          >Sign out</Button>
        </template>
        <Button
          v-else
          type="button"
          variant="pill"
          size="pill-sm"
          class="h-7 shrink-0"
          @click="showSignIn = true"
        >Sign in</Button>
      </nav>
    </div>

    <SignUpModal v-model:open="showSignIn" action="signin" />
    <SignOutConfirmDialog v-model:open="showSignOutConfirm" @confirm="handleSignOut" />
  </header>
</template>
