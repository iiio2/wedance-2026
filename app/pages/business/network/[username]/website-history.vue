<script setup lang="ts">
/**
 * /business/network/<handle>/website-history — every saved version of the
 * profile's own website (0062): when, who, from where (the WeDance editor or
 * an AI app over MCP) and what changed. Restore puts an earlier version live
 * again as a new version, so a restore can be undone the same way.
 */
import { Globe, History, RotateCcw, Bot, PencilLine, Eye, Check } from 'lucide-vue-next'
import type { ProfileSite } from '#shared/types/profileSite'
import { siteChangeSummary } from '#shared/utils/siteDiff'

definePageMeta({ layout: 'business' })
const route = useRoute()
const { $trpc } = useNuxtApp()
const username = computed(() => String(route.params.username))

type Version = Awaited<ReturnType<typeof $trpc.businessSite.history.query>>['versions'][number]
const versions = ref<Version[] | null>(null)
const name = ref('')
const current = ref<ProfileSite | null>(null)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
async function load() {
  try {
    const [h, site] = await Promise.all([
      $trpc.businessSite.history.query({ username: username.value, limit: 100 }),
      $trpc.businessSite.get.query({ username: username.value }),
    ])
    versions.value = h.versions
    name.value = h.profile.name
    current.value = site.site as ProfileSite
    error.value = null
  } catch (e: any) { error.value = e?.message || 'Couldn’t load the history.' }
}
onMounted(load)
useHead(() => ({ title: `Website history · ${name.value} | Business | WeDance` }))

const APPS: Record<string, string> = { chatgpt: 'ChatGPT', claude: 'Claude', cursor: 'Cursor', gemini: 'Gemini' }
const source = (v: Version) => v.via === 'mcp' ? `via ${APPS[v.clientApp ?? ''] ?? v.clientApp ?? 'an AI app'}` : v.via === 'web' ? 'in the WeDance editor' : 'before history started'
const when = (d: string | Date) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const restoredDate = (v: Version) => {
  const from = v.restoredFrom && versions.value?.find(x => x.id === v.restoredFrom)
  return from ? when(from.savedAt) : null
}

// "Restore" first shows what would change on the live site.
const open = ref<string | null>(null)
const restoreLines = ref<string[] | null>(null)
async function look(v: Version) {
  if (open.value === v.id) { open.value = null; return }
  open.value = v.id
  restoreLines.value = null
  try {
    const r = await $trpc.businessSite.version.query({ username: username.value, id: v.id })
    restoreLines.value = current.value ? siteChangeSummary(current.value, r.site as ProfileSite) : []
  } catch (e: any) { error.value = e?.message || 'Couldn’t load that version.' }
}
const restoring = ref(false)
async function restore(v: Version) {
  restoring.value = true
  error.value = null
  try {
    const r = await $trpc.businessSite.restore.mutate({ username: username.value, id: v.id })
    notice.value = r.unchanged ? 'That version is what the site shows already.' : `Restored the version from ${when(v.savedAt)}. Your website shows it within a minute.`
    open.value = null
    await load()
  } catch (e: any) { error.value = e?.message || 'Couldn’t restore it.' } finally { restoring.value = false }
}
</script>

<template>
  <div>
    <AdminState v-if="!versions && !error" kind="loading" />
    <AdminState v-else-if="!versions" kind="error" :message="error!" />
    <template v-else>
      <AdminPageHeader
        eyebrow="Website history"
        :title="name"
        description="Every saved version of your website: when, who and from where (here or an AI app), and what changed. Restore puts an earlier version back; that is saved as a new version, so you can undo it too."
        :back="{ to: `/business/network/${username}/website`, label: 'Website' }"
      >
        <Button variant="outline-pill" size="pill-sm" as-child>
          <NuxtLink :to="`/business/network/${username}/website`"><Globe /> Edit website</NuxtLink>
        </Button>
      </AdminPageHeader>
      <AdminState v-if="error" kind="error" :message="error" />
      <p v-if="notice" role="status" class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-sm font-bold text-wd-green-700"><Check class="size-4" aria-hidden="true" /> {{ notice }}</p>

      <AdminState v-if="!versions.length" kind="empty" message="No saved versions yet. Each time the website is saved, here or by an AI app, it shows up here." class="mt-6" />

      <ol v-else class="mt-6 divide-y rounded-2xl border bg-card shadow-wd-card">
        <li v-for="v in versions" :key="v.id" class="grid gap-2 p-4 sm:grid-cols-[1fr_auto]" :data-version="v.id">
          <div class="min-w-0">
            <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span class="font-bold">{{ when(v.savedAt) }}</span>
              <span v-if="v.current" class="rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-wd-green-700">Live now</span>
              <span class="inline-flex items-center gap-1 text-muted-foreground">
                <Bot v-if="v.via === 'mcp'" class="size-3.5" aria-hidden="true" />
                <PencilLine v-else-if="v.via === 'web'" class="size-3.5" aria-hidden="true" />
                <History v-else class="size-3.5" aria-hidden="true" />
                {{ v.by?.name ?? 'Someone' }} {{ source(v) }}
              </span>
            </p>
            <ul class="mt-1 list-disc pl-5 text-sm">
              <li v-for="(line, i) in v.summary" :key="i">{{ line === 'Restored an earlier version' && restoredDate(v) ? `Restored the version from ${restoredDate(v)}` : line }}</li>
              <li v-if="!v.summary.length" class="text-muted-foreground">No visible change</li>
            </ul>
            <div v-if="open === v.id" class="mt-3 rounded-xl border bg-muted/40 p-3 text-sm">
              <p class="font-bold">Differences from the live site:</p>
              <p v-if="!restoreLines" class="mt-1 text-muted-foreground">Comparing with the live site…</p>
              <p v-else-if="!restoreLines.length" class="mt-1 text-muted-foreground">Change nothing: the live site is the same.</p>
              <ul v-else class="mt-1 list-disc pl-5"><li v-for="(line, i) in restoreLines" :key="i">{{ line }}</li></ul>
              <div class="mt-3 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="cta" :loading="restoring" :disabled="!restoreLines?.length" @click="restore(v)"><RotateCcw /> Restore this version</Button>
                <Button type="button" size="sm" variant="ghost" @click="open = null">Cancel</Button>
              </div>
            </div>
          </div>
          <div v-if="!v.current" class="flex items-start">
            <Button type="button" size="sm" variant="ghost" :aria-expanded="open === v.id" @click="look(v)"><Eye /> Restore…</Button>
          </div>
        </li>
      </ol>
    </template>
  </div>
</template>
