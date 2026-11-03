<script setup lang="ts">
import { sizedImage, IMG } from '#shared/utils/image'
/**
 * "Possible duplicates" of a page I run (#458): pages with the same Instagram
 * account, a similar name in the same city or the same address. Merge one into
 * this page (owners of both, or admins), or merge any other page I own by its
 * handle. Below: the merges into this page, each with Undo.
 */
import { Merge, Undo2, ExternalLink } from 'lucide-vue-next'

const props = defineProps({
  username: { type: String, required: true },
  name: { type: String, required: true },
})
const emit = defineEmits<{ merged: [] }>()

const { $trpc } = useNuxtApp()
type Dupe = Awaited<ReturnType<typeof $trpc.business.duplicates.query>>[number]
type MergeRow = Awaited<ReturnType<typeof $trpc.business.merges.query>>[number]
const dupes = ref<Dupe[]>([])
const history = ref<MergeRow[]>([])
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

async function load() {
  try {
    const [d, h] = await Promise.all([
      $trpc.business.duplicates.query({ username: props.username }),
      $trpc.business.merges.query({ username: props.username }),
    ])
    dupes.value = d
    history.value = h
  } catch (e: any) { error.value = e?.message || 'Couldn’t check for duplicates.' }
}
onMounted(load)
watch(() => props.username, load)

const typeLabel: Record<string, string> = { artist: 'Artist', venue: 'Venue', organizer: 'Organizer', promoter: 'Promoter' }
const reasonLabel: Record<string, string> = { instagram: 'same Instagram', handle: 'same handle', name: 'similar name', address: 'same address', nearby: 'next door' }

// Merge confirmation: the duplicate picked from the list or typed by handle.
const confirming = ref<{ username: string; name: string } | null>(null)
const open = computed({ get: () => !!confirming.value, set: (v) => { if (!v) confirming.value = null } })
const byHandle = ref('')
const merging = ref(false)
function ask(d: { username: string; name: string }) {
  error.value = null
  notice.value = null
  confirming.value = d
}
function askByHandle() {
  const h = byHandle.value.trim().replace(/^.*\/@/, '').replace(/^@/, '')
  if (h) ask({ username: h, name: `@${h}` })
}
async function merge() {
  if (!confirming.value) return
  merging.value = true
  error.value = null
  try {
    const from = confirming.value.username
    const r = await $trpc.business.merge.mutate({ from, into: props.username })
    const moved = Object.values(r.moved).reduce((n, v) => n + v, 0)
    useTrack().track('profile_merged', { profile: props.username, merged_profile: from, moved })
    notice.value = `Merged @${from} into this page (${moved} ${moved === 1 ? 'thing' : 'things'} moved). /@${from} now opens this page.`
    confirming.value = null
    byHandle.value = ''
    await load()
    emit('merged')
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t merge.'
    confirming.value = null
  } finally { merging.value = false }
}

const undoing = ref<string | null>(null)
async function undo(m: MergeRow) {
  undoing.value = m.id
  error.value = null
  try {
    const r = await $trpc.business.undoMerge.mutate({ mergeId: m.id })
    notice.value = `@${r.restored} is its own page again.`
    await load()
    emit('merged')
  } catch (e: any) { error.value = e?.message || 'Couldn’t undo.' } finally { undoing.value = null }
}
const fmt = (d: string | Date | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '')
</script>

<template>
  <section class="rounded-2xl border bg-card p-5 shadow-wd-card" aria-labelledby="dupes-title">
    <h2 id="dupes-title" class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Duplicates</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      Two pages for the same business? Merge the other one into this page: its events, followers, team, reviews and Instagram move here, and its old link opens this page.
    </p>

    <AdminState v-if="error" kind="error" :message="error" class="mt-3" />
    <p v-if="notice" class="mt-3 rounded-xl bg-wd-green-50 p-3 text-sm text-wd-green-700" role="status">{{ notice }}</p>

    <div v-if="dupes.length" class="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2">
      <p class="text-sm font-bold">Possible duplicates</p>
      <div v-for="d in dupes" :key="d.username" class="flex flex-wrap items-center gap-3 rounded-xl border p-3">
        <img v-if="d.photo" :src="sizedImage(d.photo, IMG.avatar)" alt="" class="size-9 rounded-lg object-cover">
        <span v-else class="size-9 rounded-lg bg-muted" />
        <div class="min-w-[10rem] flex-1">
          <NuxtLink :to="`/@${d.username}`" target="_blank" class="inline-flex max-w-full items-center gap-1 truncate text-sm font-bold hover:underline">{{ d.name }} <ExternalLink class="size-3 shrink-0" aria-hidden="true" /></NuxtLink>
          <p class="truncate text-xs text-muted-foreground">{{ typeLabel[d.type] || d.type }} · @{{ d.username }}<template v-if="d.city"> · {{ d.city }}</template></p>
          <p class="truncate text-xs text-muted-foreground">{{ d.reasons.map(r => reasonLabel[r] || r).join(' · ') }}</p>
        </div>
        <Button v-if="d.canMerge" type="button" variant="outline-pill" size="pill-sm" @click="ask(d)"><Merge /> Merge into this page</Button>
        <span v-else class="text-xs text-muted-foreground max-w-[14rem]">{{ d.managed ? 'Run by someone else — ask them, or us, to merge.' : 'Claim it first, then merge it here.' }}</span>
      </div>
    </div>
    <p v-else class="mt-4 text-sm text-muted-foreground">No likely duplicates found.</p>

    <form class="mt-4 flex flex-wrap items-end gap-2" novalidate @submit.prevent="askByHandle">
      <Field id="merge-handle" label="Merge another page you own" optional hint="Its handle, e.g. @bar-buena-vista" class="min-w-[14rem] flex-1">
        <Input v-model="byHandle" placeholder="@handle" autocomplete="off" />
      </Field>
      <Button type="submit" variant="outline-pill" size="pill-sm" :disabled="!byHandle.trim()"><Merge /> Merge</Button>
    </form>

    <div v-if="history.length" class="mt-5">
      <p class="text-sm font-bold">Merged into this page</p>
      <ul class="mt-2 grid gap-1 text-sm">
        <li v-for="m in history" :key="m.id" class="flex flex-wrap items-center gap-2 text-muted-foreground">
          <span class="text-foreground">@{{ m.fromUsername }}</span>
          <span>· {{ fmt(m.mergedAt) }}<template v-if="m.by"> by {{ m.by }}</template></span>
          <AdminStatus v-if="m.undoneAt" tone="neutral">Undone {{ fmt(m.undoneAt) }}</AdminStatus>
          <Button v-else type="button" size="sm" variant="ghost" class="h-7 px-2 text-xs" :loading="undoing === m.id" @click="undo(m)"><Undo2 /> Undo</Button>
        </li>
      </ul>
    </div>

    <Dialog v-model:open="open">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Merge {{ confirming?.name }} into {{ name }}?</DialogTitle>
          <DialogDescription>
            Everything on @{{ confirming?.username }} — events, followers, team, reviews, rooms, bookings — moves to @{{ username }}. Its Instagram is kept as another account of this page,
            and wedance.vip/@{{ confirming?.username }} will open this page. You can undo it here.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline-pill" @click="confirming = null">Cancel</Button>
          <Button type="button" variant="pill" :loading="merging" @click="merge">Merge</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
