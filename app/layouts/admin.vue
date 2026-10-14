<script setup lang="ts">
/**
 * Admin layout — persistent sidebar + centralized is_admin gate for every
 * /admin/* page. Pages just render their content into the slot; nav, gating,
 * and the sign-in affordance all live here. The server adminProcedure is the
 * real security boundary; this gate is UX.
 */
import {
  LayoutDashboard, Video, Gift, Users, UtensilsCrossed,
  ShieldAlert, ArrowLeft, BadgeCheck, UserRound, Cpu } from 'lucide-vue-next'

const route = useRoute()
const { $trpc } = useNuxtApp()

const state = ref<'checking' | 'ok' | 'denied'>('checking')
const showSignIn = ref(false)
const pendingVideos = ref<number | null>(null)
const pendingClaims = ref<number | null>(null)

async function check() {
  try {
    const me = await $trpc.auth.me.query()
    state.value = me?.isAdmin ? 'ok' : 'denied'
    if (state.value === 'ok') loadBadges()
  } catch {
    state.value = 'denied'
  }
}
async function loadBadges() {
  try {
    const [videos, claims] = await Promise.all([
      $trpc.cityVideo.pendingList.query({}),
      $trpc.business.listClaims.query(),
    ])
    pendingVideos.value = videos.length
    pendingClaims.value = claims.length
  } catch {
    pendingVideos.value = null
    pendingClaims.value = null
  }
}

onMounted(check)
watch(showSignIn, (open) => { if (!open) check() })

const nav = computed(() => [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true, badge: null as number | null },
  { to: '/admin/videos', label: 'Videos', icon: Video, exact: false, badge: pendingVideos.value || null },
  { to: '/admin/claims', label: 'Claims', icon: BadgeCheck, exact: false, badge: pendingClaims.value || null },
  { to: '/admin/users', label: 'Users', icon: UserRound, exact: false, badge: null },
  { to: '/admin/giveaways', label: 'Giveaways', icon: Gift, exact: false, badge: null },
  { to: '/admin/community-groups', label: 'Community', icon: Users, exact: false, badge: null },
  { to: '/admin/festivals', label: 'Festivals', icon: UtensilsCrossed, exact: false, badge: null },
  { to: '/admin/ai-usage', label: 'AI usage', icon: Cpu, exact: false, badge: null },
])

const isActive = (item: { to: string; exact: boolean }) =>
  item.exact ? route.path === item.to : route.path.startsWith(item.to)
</script>

<template>
  <div class="min-h-screen md:flex bg-background text-foreground font-sans">
    <!-- Sidebar (desktop) / top bar (mobile) -->
    <aside class="md:w-60 md:min-h-screen md:border-r border-b md:border-b-0 border-border shrink-0 md:sticky md:top-0 md:h-screen flex md:flex-col bg-card/55">
      <div class="px-4 py-4 md:py-6 flex md:block items-center justify-between w-full">
        <NuxtLink to="/" class="inline-flex items-center gap-2">
          <Brand />
        </NuxtLink>
        <div class="hidden md:block mt-6 text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Admin</div>
      </div>

      <nav class="flex md:flex-col gap-1 px-2 md:px-3 pb-3 md:pb-0 overflow-x-auto md:overflow-visible" aria-label="Admin">
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
          <AdminStatus v-if="item.badge" tone="accent" solid class="ml-auto px-1.5">{{ item.badge }}</AdminStatus>
        </NuxtLink>
      </nav>

      <NuxtLink
        to="/"
        class="hidden md:flex items-center gap-1.5 mt-auto mx-6 mb-4 text-xs text-secondary hover:underline"
      >
        <ArrowLeft class="size-3.5" aria-hidden="true" /> Back to site
      </NuxtLink>
    </aside>

    <!-- Content -->
    <main class="flex-1 min-w-0">
      <div class="max-w-4xl mx-auto px-4 py-8">
        <AdminState v-if="state === 'checking'" kind="loading" message="Checking access…" class="py-24" />

        <div
          v-else-if="state === 'denied'"
          class="max-w-md mx-auto mt-16 rounded-2xl border-2 border-dashed border-input bg-card/60 p-10 text-center"
        >
          <ShieldAlert class="size-7 mx-auto mb-3 text-primary" aria-hidden="true" />
          <p class="font-display text-base font-bold text-foreground">Admin access required</p>
          <p class="mt-1 text-xs text-muted-foreground">
            Sign in with an admin account to view this page.
          </p>
          <Button variant="cta" class="mt-5" @click="showSignIn = true">
            Sign in
          </Button>
          <SignUpModal v-model:open="showSignIn" action="signin" />
        </div>

        <slot v-else />
      </div>
    </main>
  </div>
</template>
