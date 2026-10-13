<script setup lang="ts">
/**
 * /admin — the admin hub. Wrapped by the `admin` layout (sidebar + is_admin
 * gate). Cards link to each area; the video card shows the live pending count.
 */
import { Video, UtensilsCrossed, Gift, Users, ArrowRight, BadgeCheck, UserRound } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

definePageMeta({ layout: 'admin' })
useHead({ title: 'Admin | WeDance' })

const { $trpc } = useNuxtApp()

const pendingVideos = ref<number | null>(null)
onMounted(async () => {
  try {
    const rows = await $trpc.cityVideo.pendingList.query({})
    pendingVideos.value = rows.length
  } catch {
    pendingVideos.value = null
  }
})

const sections = computed(() => [
  { to: '/admin/videos', icon: Video, title: 'Video moderation', blurb: 'Approve or reject city-competition submissions.', badge: pendingVideos.value ? `${pendingVideos.value} pending` : null, accent: WD.red600 },
  { to: '/admin/claims', icon: BadgeCheck, title: 'Profile claims', blurb: 'Approve people who manage artist, venue and organizer pages.', badge: null, accent: WD.amber600 },
  { to: '/admin/users', icon: UserRound, title: 'Users', blurb: 'Everyone on WeDance. Click a name to see their Business as they see it.', badge: null, accent: WD.blue600 },
  { to: '/admin/giveaways', icon: Gift, title: 'Giveaways', blurb: 'Create and manage sponsor giveaways per city.', badge: null, accent: WD.purple500 },
  { to: '/admin/community-groups', icon: Users, title: 'Community groups', blurb: 'WhatsApp / Telegram groups shown on city pages.', badge: null, accent: WD.cyan600 },
  { to: '/admin/festivals', icon: UtensilsCrossed, title: 'Festival dinners', blurb: 'Assign dinner groups and reveal restaurants.', badge: null, accent: WD.green600 },
])
</script>

<template>
  <div>
    <AdminPageHeader title="Control room" description="Moderate content and manage what dancers see on city and festival pages." />

    <div class="mt-8 grid gap-4 sm:grid-cols-2">
      <NuxtLink
        v-for="s in sections"
        :key="s.to"
        :to="s.to"
        class="group block rounded-2xl border bg-card p-5 transition-all duration-wd-standard hover:-translate-y-1"
        :style="{ borderColor: s.accent + '33', boxShadow: '0 1px 0 ' + s.accent + '14' }"
      >
        <div class="flex items-start gap-4">
          <div class="size-11 rounded-xl shrink-0 flex items-center justify-center" :style="{ background: s.accent + '18', color: s.accent }">
            <component :is="s.icon" class="size-5" aria-hidden="true" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-display text-lg font-bold leading-tight text-foreground">{{ s.title }}</h2>
              <AdminStatus v-if="s.badge" tone="accent" solid>{{ s.badge }}</AdminStatus>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">{{ s.blurb }}</p>
          </div>
          <ArrowRight class="size-4 mt-1 shrink-0 transition-transform group-hover:translate-x-1" :style="{ color: s.accent }" aria-hidden="true" />
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
