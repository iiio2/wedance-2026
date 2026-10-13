<script setup lang="ts">
/**
 * The flyer, beside the event editor. None yet → make it; made → up to date,
 * or out of date with what changed since and a one-click refresh in the same
 * look. Lists the exact lines that go on the flyer. Making or refreshing asks
 * the page to save first (`go`), since the flyer is painted from saved details.
 */
import { Sparkles, Wand2, Download, AlertTriangle, Loader2 } from 'lucide-vue-next'

const props = defineProps({
  eventId: { type: String, required: true },
  /** Highlight the panel (arrived from "make its flyer"). */
  highlight: { type: Boolean, default: false },
})
const emit = defineEmits<{ go: [target: { action: 'make' | 'refresh' | 'open'; batchId?: string; flyerId?: string }] }>()

const { $trpc } = useNuxtApp()
type State = Awaited<ReturnType<typeof $trpc.businessFlyers.state.query>>
const st = ref<State | null>(null)
const error = ref<string | null>(null)
async function load() {
  try {
    st.value = await $trpc.businessFlyers.state.query({ eventId: props.eventId })
    error.value = null
  } catch (e: any) {
    error.value = e?.message || 'Could not load the flyer.'
  }
}
onMounted(load)
defineExpose({ reload: load })

const status = computed(() => !st.value?.kept ? 'none' : st.value.changes.length ? 'stale' : 'fresh')
// A sitting that is still painting (left the page, came back).
const painting = computed(() => st.value?.latestBatch?.status === 'painting' ? st.value.latestBatch : null)
const download = (url: string) => url.replace('/upload/', '/upload/fl_attachment/')
</script>

<template>
  <aside class="lg:sticky lg:top-6 lg:self-start" aria-label="Flyer">
    <div class="rounded-2xl border bg-card p-4 shadow-wd-card" :class="highlight && status === 'none' ? 'border-2 border-primary/40' : ''">
      <div class="flex items-center justify-between">
        <p class="text-xs font-bold uppercase tracking-wider text-secondary">Flyer</p>
        <AdminStatus v-if="status === 'fresh'" tone="success">Up to date</AdminStatus>
        <AdminStatus v-else-if="status === 'stale'" tone="warning">Out of date</AdminStatus>
        <AdminStatus v-else tone="neutral">None yet</AdminStatus>
      </div>
      <AdminState v-if="error" kind="error" :message="error" class="mt-3" />
      <div v-else-if="!st" class="mt-6 flex justify-center"><Loader2 class="size-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>

      <template v-else>
        <button
          v-if="painting"
          type="button"
          class="mt-3 flex w-full items-center gap-2 rounded-xl bg-secondary/10 p-3 text-left text-xs font-bold"
          @click="emit('go', { action: 'open', batchId: painting.batchId })"
        >
          <Loader2 class="size-4 shrink-0 animate-spin" aria-hidden="true" /> A flyer is being painted. Open it
        </button>

        <!-- None yet -->
        <template v-if="status === 'none'">
          <div class="mx-auto mt-3 flex aspect-[9/16] w-32 items-center justify-center rounded-xl border-2 border-dashed border-input text-center text-xs text-muted-foreground">Instagram story<br>1080×1920</div>
          <Button type="button" variant="cta" class="mt-4 w-full" @click="emit('go', { action: 'make' })"><Sparkles /> Make the flyer</Button>
          <p class="mt-1.5 text-center text-xs text-muted-foreground">
            {{ st.looks.length ? `In your “${st.looks[0]!.name}” look. About a minute.` : 'About a minute. Uses the details on this page.' }}
          </p>
        </template>

        <!-- Made -->
        <template v-else>
          <img :src="st.kept!.url!" alt="The event’s flyer" class="mx-auto mt-3 w-40 rounded-xl border" :class="status === 'stale' ? 'opacity-60' : ''">
          <p v-if="st.kept!.lookName" class="mt-1.5 text-center text-xs text-muted-foreground">{{ st.kept!.lookName }} look</p>
          <p v-if="status === 'fresh' && st.kept!.check && !st.kept!.check.ok" class="mt-2 rounded-xl bg-warning/10 p-2 text-xs">
            We couldn’t read: {{ st.kept!.check.missing.join(' · ') }}. Check the flyer before posting.
          </p>
          <div v-if="status === 'stale'" class="mt-3 rounded-xl bg-warning/10 p-3 text-xs">
            <p class="flex items-center gap-1.5 font-bold"><AlertTriangle class="size-3.5" aria-hidden="true" /> You changed the details since</p>
            <ul class="mt-2 grid gap-1.5">
              <li v-for="(c, i) in st.changes" :key="i" class="leading-snug">
                <span v-if="c.was" class="block text-muted-foreground line-through">{{ c.was }}</span>
                <span v-if="c.now" class="block font-bold">{{ c.now }}</span>
              </li>
            </ul>
          </div>
          <Button v-if="status === 'stale'" type="button" variant="cta" class="mt-3 w-full" @click="emit('go', { action: 'refresh' })"><Wand2 /> Refresh the flyer</Button>
          <div class="mt-3 grid grid-cols-2 gap-2">
            <Button variant="outline-pill" size="pill-sm" as-child><a :href="download(st.kept!.url!)" download><Download /> Download</a></Button>
            <Button type="button" variant="ghost" size="sm" @click="emit('go', { action: 'open', batchId: st.kept!.batchId, flyerId: st.kept!.id })">Change it</Button>
          </div>
        </template>

        <details class="mt-4 border-t pt-3" :open="status !== 'fresh'">
          <summary class="cursor-pointer text-xs font-bold">On the flyer</summary>
          <ul class="mt-2 grid gap-1 text-xs">
            <li v-for="t in st.lines" :key="t" class="leading-snug">{{ t }}</li>
          </ul>
          <p class="mt-2 text-xs text-muted-foreground">Pictured: {{ st.pictured.length ? st.pictured.join(', ') : 'nobody (names only)' }}</p>
          <p v-if="st.pictured.length > 2" class="mt-1 text-xs font-bold text-wd-red-800">{{ st.pictured.length }} faces is a lot for a story: the first two are used. Set the others to “Name only”.</p>
          <p class="mt-2 text-xs text-muted-foreground">Saved details only. Every word is read back off the finished flyer and checked against this list.</p>
        </details>
      </template>
    </div>
  </aside>
</template>
