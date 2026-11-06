<script setup lang="ts">
/**
 * Where the website lives and whether people can see it (hosted websites v1):
 * draft or live, its address on sites.wedance.vip, a preview link that shows
 * the last saved version even while it's a draft, and Publish / Unpublish.
 */
import { Globe, Eye, Rocket, EyeOff, ExternalLink, Copy, Check } from 'lucide-vue-next'

const props = defineProps<{ username: string; url: string; published: boolean; hasSections: boolean; dirty: boolean; saving: boolean }>()
const emit = defineEmits<{ publish: []; unpublish: [] }>()
const { $trpc } = useNuxtApp()

const previewUrl = ref<string | null>(null)
async function openPreview() {
  // Fetched when needed: the link is signed for 7 days.
  if (!previewUrl.value) previewUrl.value = (await $trpc.businessSite.previewLink.query({ username: props.username })).previewUrl
  window.open(previewUrl.value, '_blank', 'noopener')
}
const copied = ref(false)
async function copy() {
  await navigator.clipboard?.writeText(props.url)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
const confirmUnpublish = ref(false)
const shortUrl = computed(() => props.url.replace(/^https?:\/\//, ''))
</script>

<template>
  <section class="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4 shadow-wd-card" :class="published ? 'border-wd-green-700/30' : 'border-wd-amber-500/40'" aria-label="Where your website lives">
    <span class="hidden size-10 shrink-0 place-items-center rounded-xl sm:grid" :class="published ? 'bg-success/10 text-wd-green-700' : 'bg-wd-amber-500/15 text-wd-amber-800'">
      <Globe class="size-5" aria-hidden="true" />
    </span>
    <div class="min-w-[min(100%,14rem)] flex-1">
      <p class="flex flex-wrap items-center gap-2 text-sm font-bold">
        <span class="rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wider" :class="published ? 'bg-success/10 text-wd-green-700' : 'bg-wd-amber-500/20 text-wd-amber-800'">{{ published ? 'Live' : 'Draft' }}</span>
        <a v-if="published" :href="url" target="_blank" rel="noopener" class="break-all underline-offset-2 hover:underline">{{ shortUrl }}</a>
        <span v-else class="break-all text-muted-foreground">{{ shortUrl }}</span>
        <button type="button" class="text-muted-foreground hover:text-foreground" :aria-label="copied ? 'Address copied' : 'Copy the address'" @click="copy">
          <component :is="copied ? Check : Copy" class="size-3.5" aria-hidden="true" />
        </button>
      </p>
      <p class="mt-0.5 text-xs text-muted-foreground">
        <template v-if="published">Anyone can open it. Saved changes show within a minute.</template>
        <template v-else-if="!hasSections">Add a few sections first, then preview and publish.</template>
        <template v-else>Only you see it, through Preview. Publish when it's ready.</template>
      </p>
    </div>
    <div class="flex basis-full flex-wrap items-center gap-2 sm:basis-auto">
      <Button type="button" variant="outline" size="sm" :disabled="!hasSections" :title="dirty ? 'Shows the last saved version' : undefined" @click="openPreview">
        <Eye /> Preview<span v-if="dirty" class="text-[10px] font-normal text-muted-foreground">(saved version)</span>
      </Button>
      <Button v-if="published" type="button" variant="outline" size="sm" as-child>
        <a :href="url" target="_blank" rel="noopener"><ExternalLink /> Open</a>
      </Button>
      <template v-if="published">
        <Button v-if="!confirmUnpublish" type="button" variant="ghost" size="sm" @click="confirmUnpublish = true"><EyeOff /> Unpublish</Button>
        <template v-else>
          <span class="text-xs">Take it offline?</span>
          <Button type="button" variant="destructive" size="sm" :loading="saving" @click="confirmUnpublish = false; emit('unpublish')">Unpublish</Button>
          <Button type="button" variant="ghost" size="sm" @click="confirmUnpublish = false">Keep it live</Button>
        </template>
      </template>
      <Button v-else type="button" variant="cta" size="sm" :disabled="!hasSections" :loading="saving" @click="emit('publish')">
        <Rocket /> {{ dirty ? 'Save and publish' : 'Publish' }}
      </Button>
    </div>
  </section>
</template>
