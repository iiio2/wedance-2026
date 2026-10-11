<script setup lang="ts">
/**
 * /admin/videos — moderation queue for city-video competition submissions.
 * Public submissions land as `pending` (cityVideo.submit) and are invisible on
 * the city page until approved here. Approve → shows in the leaderboard + vote;
 * Reject → hidden. Admin-gated the same way as /admin/festivals: a page-scoped
 * admin auth token, restored on leave.
 */
import { ExternalLink, Check, X, RotateCcw } from 'lucide-vue-next'

definePageMeta({ layout: 'admin' })

useHead({ title: 'Admin: Video moderation | WeDance' })

const { $trpc } = useNuxtApp()

type PendingVideo = {
  id: string
  citySlug: string
  title: string
  videoUrl: string
  thumbnailUrl: string | null
  danceStyle: string | null
  submittedByEmail: string
  competitionMonth: string
  status: string
  createdAt: string | Date | null
}

const videos = ref<PendingVideo[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const busyId = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    videos.value = (await $trpc.cityVideo.pendingList.query({})) as PendingVideo[]
  } catch (e: any) {
    error.value = e?.message || 'Failed to load pending videos.'
  } finally {
    loading.value = false
  }
}

async function setStatus(v: PendingVideo, status: 'approved' | 'rejected') {
  busyId.value = v.id
  try {
    await $trpc.cityVideo.setStatus.mutate({ videoId: v.id, status })
    // Drop from the queue — pendingList only holds `pending`.
    videos.value = videos.value.filter(x => x.id !== v.id)
  } catch (e: any) {
    error.value = e?.message || 'Could not update that video.'
  } finally {
    busyId.value = null
  }
}

const cityLabel = (slug: string) =>
  slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

onMounted(load)
</script>

<template>
  <div>
    <AdminPageHeader
      title="Video moderation"
      description="Pending submissions to the city-video competition. Approve to publish to the leaderboard + vote."
    >
      <Button variant="ghost" size="sm" class="text-secondary" :disabled="loading" @click="load">
        <RotateCcw /> Refresh
      </Button>
    </AdminPageHeader>

    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="loading" kind="loading" message="Loading queue…" />
    <AdminState v-else-if="!videos.length" kind="empty" message="No pending videos 🎉" hint="The moderation queue is clear." />

    <div v-else class="mt-6 grid gap-4">
      <div
        v-for="v in videos"
        :key="v.id"
        class="flex flex-col sm:flex-row gap-4 rounded-2xl border bg-card p-4 shadow-wd-card"
      >
        <a
          :href="v.videoUrl"
          target="_blank"
          rel="noopener"
          class="block shrink-0 rounded-xl overflow-hidden bg-black/5 relative w-full sm:w-48 aspect-video"
        >
          <img
            v-if="v.thumbnailUrl"
            :src="v.thumbnailUrl"
            :alt="v.title"
            class="w-full h-full object-cover"
            loading="lazy"
          >
          <div class="absolute inset-0 flex items-center justify-center">
            <ExternalLink class="size-5 text-white drop-shadow" aria-hidden="true" />
          </div>
        </a>

        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <AdminStatus tone="accent">{{ cityLabel(v.citySlug) }}</AdminStatus>
            <AdminStatus v-if="v.danceStyle" tone="warning">{{ v.danceStyle }}</AdminStatus>
            <span class="text-eyebrow uppercase tracking-wider text-secondary">{{ v.competitionMonth }}</span>
          </div>
          <h3 class="mt-1.5 font-display text-base font-bold leading-tight truncate text-foreground">{{ v.title }}</h3>
          <p class="text-xs truncate text-muted-foreground">{{ v.submittedByEmail }}</p>
          <a :href="v.videoUrl" target="_blank" rel="noopener" class="inline-flex items-center gap-1 mt-1 text-xs font-bold text-wd-cyan-700 hover:underline">
            Watch <ExternalLink class="size-3" aria-hidden="true" />
          </a>
        </div>

        <div class="flex sm:flex-col gap-2 sm:justify-center shrink-0">
          <Button variant="pill" size="pill-sm" accent="var(--wd-green-700)" :loading="busyId === v.id" @click="setStatus(v, 'approved')">
            <Check v-if="busyId !== v.id" /> Approve
          </Button>
          <Button variant="outline-pill" size="pill-sm" :disabled="busyId === v.id" @click="setStatus(v, 'rejected')">
            <X /> Reject
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
