<script setup lang="ts">
/**
 * Business layout — the "business" side of WeDance (artists, venues, organizers
 * managing their profiles). Mirrors the admin layout. Gate is signed-in only;
 * every page and procedure checks profile membership itself.
 */
import { Home, CalendarDays, UserSquare, LogIn, Eye, X } from 'lucide-vue-next'

const route = useRoute()
const { $trpc } = useNuxtApp()

const state = ref<'checking' | 'ok' | 'signed-out'>('checking')
const showSignIn = ref(false)

// Profiles I manage, for the switcher. Shown only with 2+ profiles.
const managed = ref<{ username: string; name: string }[]>([])
const businessProfile = useBusinessProfile()

async function check() {
  try {
    const me = await $trpc.auth.me.query()
    state.value = me ? 'ok' : 'signed-out'
    if (me) {
      managed.value = (await $trpc.business.myProfiles.query()).managed
      // A switcher value for a profile I no longer manage falls back to "all".
      if (businessProfile.value && !managed.value.some(p => p.username === businessProfile.value)) businessProfile.value = ''
    }
  } catch {
    state.value = 'signed-out'
  }
}
onMounted(check)
// Admin acting as someone in Business (/admin/users → their name).
const viewAs = useViewAs()
watch(() => viewAs.value?.id, () => check())
function stopViewing() {
  viewAs.value = null
  navigateTo('/admin/users')
}
watch(showSignIn, (open) => { if (!open) check() })
// Re-read after creating/claiming a profile (the editor route changes).
watch(() => route.path, (p, old) => { if (state.value === 'ok' && old?.startsWith('/business/new')) check() })

const switcherOptions = computed(() => [
  { label: 'All my profiles', value: '' },
  ...managed.value.map(p => ({ label: p.name, value: p.username })),
])

const nav = [
  { to: '/business', label: 'Home', icon: Home, match: (p: string) => p === '/business' },
  { to: '/business/events', label: 'Events', icon: CalendarDays, match: (p: string) => p.startsWith('/business/events') },
  { to: '/business/network', label: 'Network', icon: UserSquare, match: (p: string) => ['/business/network', '/business/claim', '/business/new'].some(x => p.startsWith(x)) },
]
const isActive = (item: { match: (p: string) => boolean }) => item.match(route.path)
</script>

<template>
  <div class="min-h-screen md:flex bg-background text-foreground font-sans">
    <!-- Phones: logo and profile switcher share the first row, the menu is the second. -->
    <aside class="md:w-60 md:min-h-screen md:border-r border-b md:border-b-0 border-border shrink-0 md:sticky md:top-0 md:h-screen grid grid-cols-[auto_minmax(0,1fr)] items-center md:flex md:flex-col md:items-stretch bg-card/55">
      <div class="px-4 py-3 md:py-6 flex md:block items-center justify-between md:w-full">
        <NuxtLink to="/" class="inline-flex items-center gap-2">
          <Brand />
        </NuxtLink>
        <div class="hidden md:block mt-6 text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Business</div>
      </div>

      <div v-if="managed.length > 1" class="pr-3 py-2 md:px-3 md:py-0 md:pb-3">
        <Field label="Profile" hide-label>
          <Select v-model="businessProfile" :options="switcherOptions" size="sm" />
        </Field>
      </div>

      <!-- Phones get these as the bottom tab bar (SiteTabBar) instead. -->
      <nav class="hidden sm:flex col-span-2 md:flex-col gap-1 px-2 md:px-3 pb-2 md:pb-0 overflow-x-auto md:overflow-visible" aria-label="Business">
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :aria-current="isActive(item) ? 'page' : undefined"
          class="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors duration-wd-quick"
          :class="isActive(item)
            ? 'bg-primary/10 text-wd-red-800 font-bold'
            : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
        >
          <component :is="item.icon" class="size-4 shrink-0" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
    </aside>

    <main class="flex-1 min-w-0">
      <!-- Same account menu, same place as on the dancing side; its switch row reads "Dancing" here. -->
      <div v-if="state === 'ok'" class="hidden sm:flex justify-end px-4 md:px-8 pt-4">
        <AccountMenu mode="business" />
      </div>
      <div class="max-w-4xl mx-auto px-4 py-5 md:py-8">
        <AdminState v-if="state === 'checking'" kind="loading" class="py-24" />

        <div
          v-else-if="state === 'signed-out'"
          class="max-w-md mx-auto mt-16 rounded-2xl border-2 border-dashed border-input bg-card/60 p-10 text-center"
        >
          <LogIn class="size-7 mx-auto mb-3 text-primary" aria-hidden="true" />
          <p class="font-display text-base font-bold text-foreground">Sign in to manage your profile</p>
          <p class="mt-1 text-xs text-muted-foreground">Artists, venues and organizers keep their WeDance page up to date here.</p>
          <Button variant="cta" class="mt-5" @click="showSignIn = true">Sign in</Button>
          <SignUpModal v-model:open="showSignIn" action="signin" />
        </div>

        <template v-else>
          <div v-if="viewAs" class="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-secondary/40 bg-secondary/10 px-4 py-3" role="status">
            <Eye class="size-4 shrink-0 text-secondary" aria-hidden="true" />
            <p class="min-w-0 flex-1 text-sm">
              <span class="font-bold">Viewing as {{ viewAs.name }}</span>
              <span class="text-muted-foreground"> · you’re acting as them in Business: changes are saved as theirs.</span>
            </p>
            <Button variant="outline-pill" size="pill-sm" @click="stopViewing"><X /> Stop viewing</Button>
          </div>
          <slot />
        </template>
      </div>
    </main>

    <SiteTabBar mode="business" />
  </div>
</template>
