<script setup lang="ts">
/**
 * Pick WeDance profiles for an event: the venue (single) or the line-up
 * (multiple). Search by name or @handle; if someone isn't on WeDance yet,
 * paste their Instagram and they're added as an unclaimed profile they can
 * claim later (v3's "Import @x" idea).
 *
 *   <BusinessProfilePicker v-model="form.artists" type="artist" multiple />
 *   <BusinessProfilePicker v-model="form.venueUsername" type="venue" />
 *
 * v-model is a handle (single) or string[] of handles (multiple).
 */
import type { PropType } from 'vue'
import { X, Instagram, Loader2 } from 'lucide-vue-next'

const props = defineProps({
  type: { type: String as PropType<'artist' | 'venue' | 'organizer'>, required: true },
  multiple: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Search by name or @handle' },
})
const model = defineModel<string[] | string | null>({ default: null })

const { $trpc } = useNuxtApp()
type P = { username: string; name: string; type: string; city: string | null; photo: string | null }

// Names/photos for the chips; seeded lazily for handles we haven't looked up.
const known = ref(new Map<string, P>())
const selected = computed<string[]>(() =>
  props.multiple ? ((model.value as string[] | null) ?? []) : (model.value ? [model.value as string] : []))

async function hydrate(handles: string[]) {
  for (const h of handles.filter(h => !known.value.has(h))) {
    try {
      const rows = await $trpc.businessEvents.searchProfiles.query({ q: h, type: props.type })
      const hit = rows.find(r => r.username === h)
      if (hit) known.value = new Map(known.value).set(h, hit)
    } catch { /* chip falls back to @handle */ }
  }
}
watch(selected, (h) => hydrate(h), { immediate: true })

const q = ref('')
const results = ref<P[]>([])
const open = ref(false)
const busy = ref(false)
const error = ref<string | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

const looksLikeInstagram = computed(() => /instagram\.com\/|^@[a-z0-9._]{2,30}$/i.test(q.value.trim()))

watch(q, () => {
  clearTimeout(timer)
  error.value = null
  const term = q.value.trim()
  if (term.length < 2 || /instagram\.com\//i.test(term)) { results.value = []; return }
  timer = setTimeout(async () => {
    busy.value = true
    try {
      results.value = (await $trpc.businessEvents.searchProfiles.query({ q: term, type: props.type }))
        .filter(r => !selected.value.includes(r.username))
      open.value = true
    } catch (e: any) {
      error.value = e?.message || 'Search failed.'
    } finally {
      busy.value = false
    }
  }, 250)
})

function pick(p: P) {
  known.value = new Map(known.value).set(p.username, p)
  model.value = props.multiple ? [...selected.value, p.username] : p.username
  q.value = ''
  results.value = []
  open.value = false
}
function remove(handle: string) {
  model.value = props.multiple ? selected.value.filter(h => h !== handle) : null
}

async function addFromInstagram() {
  busy.value = true
  error.value = null
  try {
    pick(await $trpc.businessEvents.addFromInstagram.mutate({ instagram: q.value.trim(), type: props.type }))
  } catch (e: any) {
    error.value = e?.message || 'Could not add them.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <div v-if="selected.length" class="mb-2 flex flex-wrap gap-2">
      <span
        v-for="h in selected"
        :key="h"
        class="inline-flex items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-2 text-sm"
      >
        <img v-if="known.get(h)?.photo" :src="known.get(h)!.photo!" alt="" class="size-6 rounded-full object-cover">
        <span v-else class="size-6 rounded-full bg-muted" />
        <span class="font-bold">{{ known.get(h)?.name || '@' + h }}</span>
        <button type="button" class="text-muted-foreground hover:text-foreground" :aria-label="`Remove ${known.get(h)?.name || h}`" @click="remove(h)">
          <X class="size-3.5" />
        </button>
      </span>
    </div>

    <div v-if="multiple || !selected.length" class="relative">
      <Input v-model="q" :placeholder="placeholder" autocomplete="off" @focus="open = !!results.length" @keydown.esc="open = false" />
      <Loader2 v-if="busy" class="absolute right-3.5 top-3.5 size-4 animate-spin text-muted-foreground" aria-hidden="true" />

      <div
        v-if="open && (results.length || q.trim().length >= 2)"
        class="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-card shadow-wd-card"
      >
        <button
          v-for="r in results"
          :key="r.username"
          type="button"
          class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/50"
          @click="pick(r)"
        >
          <img v-if="r.photo" :src="r.photo" alt="" class="size-8 rounded-lg object-cover">
          <span v-else class="size-8 rounded-lg bg-muted" />
          <span class="min-w-0">
            <span class="block truncate text-sm font-bold">{{ r.name }}</span>
            <span class="block truncate text-xs text-muted-foreground">@{{ r.username }}<template v-if="r.city"> · {{ r.city }}</template></span>
          </span>
        </button>
        <p v-if="!results.length && !looksLikeInstagram && !busy" class="px-3 py-2 text-xs text-muted-foreground">
          Not on WeDance? Paste their Instagram link or @handle.
        </p>
      </div>
    </div>

    <Button v-if="looksLikeInstagram" type="button" variant="soft" size="sm" class="mt-2" :loading="busy" @click="addFromInstagram">
      <Instagram /> Add {{ q.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '@').replace(/\/.*$/, '') }} from Instagram
    </Button>
    <p v-if="error" class="mt-1 text-xs font-bold text-destructive">{{ error }}</p>
  </div>
</template>
