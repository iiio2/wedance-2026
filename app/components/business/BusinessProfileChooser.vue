<script setup lang="ts">
/**
 * Entry to a per-profile Business page (Website, Contacts) from the sidebar:
 * the profile the switcher is set to, or the only one I manage, opens right
 * away; otherwise pick one.
 */
import { ChevronRight } from 'lucide-vue-next'

const props = defineProps<{ section: 'website' | 'contacts'; eyebrow: string; title: string; description: string }>()
const { $trpc } = useNuxtApp()
const chosen = useBusinessProfile()
type Managed = Awaited<ReturnType<typeof $trpc.business.myProfiles.query>>['managed']
const profiles = ref<Managed | null>(null)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const list = (await $trpc.business.myProfiles.query()).managed
    const pick = list.find((p: any) => p.username === chosen.value) ?? (list.length === 1 ? list[0] : null)
    if (pick) return navigateTo(`/business/network/${pick.username}/${props.section}`, { replace: true })
    profiles.value = list
  } catch (e: any) { error.value = e?.message || 'Couldn’t load your profiles.' }
})
</script>

<template>
  <div>
    <AdminState v-if="!profiles && !error" kind="loading" />
    <AdminState v-else-if="error" kind="error" :message="error" />
    <template v-else-if="profiles">
      <AdminPageHeader :eyebrow="eyebrow" :title="title" :description="description" />
      <AdminState v-if="!profiles.length" kind="empty" message="You don’t run a profile on WeDance yet." hint="Add or claim one under Network." class="mt-6" />
      <ul v-else class="mt-6 divide-y rounded-2xl border bg-card shadow-wd-card">
        <li v-for="p in profiles" :key="p.username">
          <NuxtLink :to="`/business/network/${p.username}/${section}`" class="flex items-center gap-3 p-4 hover:bg-accent">
            <img v-if="p.photo" :src="p.photo" alt="" class="size-10 rounded-full object-cover">
            <span v-else class="grid size-10 place-items-center rounded-full bg-primary/15 font-bold text-primary">{{ p.name.slice(0, 1) }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-bold">{{ p.name }}</span>
              <span class="block text-xs text-muted-foreground">@{{ p.username }}<template v-if="p.city"> · {{ p.city }}</template></span>
            </span>
            <ChevronRight class="size-4 text-muted-foreground" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
    </template>
  </div>
</template>
