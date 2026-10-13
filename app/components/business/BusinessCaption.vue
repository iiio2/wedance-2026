<script setup lang="ts">
/**
 * The Instagram caption to post with the event's flyer. Written by Gemini from
 * the flyer's lines, tagging only verified accounts; the organizer edits it
 * (saved on blur), copies it, and adapts it for other channels themselves.
 * Says when the details changed since it was written.
 */
import { Copy, Check, Wand2, RotateCcw, AlertTriangle } from 'lucide-vue-next'
import { LANGUAGES } from '#shared/utils/caption'

const props = defineProps({ eventId: { type: String, required: true } })
const { $trpc } = useNuxtApp()

type State = Awaited<ReturnType<typeof $trpc.businessFlyers.caption.query>>
const st = ref<State | null>(null)
const text = ref('')
const language = ref('en+de')
const writing = ref(false)
const error = ref<string | null>(null)
const savedNote = ref<string | null>(null)

async function load() {
  try {
    st.value = await $trpc.businessFlyers.caption.query({ eventId: props.eventId })
    text.value = st.value.saved?.text ?? ''
    if (st.value.saved?.language) language.value = st.value.saved.language
  } catch (e: any) {
    error.value = e?.message || 'Could not load the caption.'
  }
}
onMounted(load)
defineExpose({ reload: load })

async function write() {
  writing.value = true
  error.value = null
  try {
    const c = await $trpc.businessFlyers.writeCaption.mutate({ eventId: props.eventId, language: language.value })
    text.value = c.text
    st.value = { ...st.value!, saved: c, changed: false }
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t write the caption.'
  } finally {
    writing.value = false
  }
}
async function save() {
  if (!st.value?.saved || text.value === st.value.saved.text) return
  try {
    await $trpc.businessFlyers.saveCaption.mutate({ eventId: props.eventId, text: text.value })
    st.value.saved = { ...st.value.saved, text: text.value }
    savedNote.value = 'Saved'
    setTimeout(() => (savedNote.value = null), 2000)
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t save your edit.'
  }
}
const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    error.value = 'Copy didn’t work: select the text and copy it.'
  }
}
</script>

<template>
  <section class="rounded-2xl border bg-card p-4 shadow-wd-card" aria-label="Instagram caption">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-bold uppercase tracking-wider text-secondary">Caption</p>
      <span v-if="savedNote" class="text-xs text-wd-green-700">{{ savedNote }}</span>
    </div>
    <p class="mt-1 text-xs text-muted-foreground">For Instagram, from the details on the flyer. Adapt it for WhatsApp, Telegram or Facebook as you like.</p>

    <template v-if="st">
      <div v-if="st.saved && st.changed" class="mt-3 flex items-start gap-1.5 rounded-xl bg-warning/10 p-2 text-xs">
        <AlertTriangle class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> You changed the details since it was written.
      </div>
      <Textarea
        v-if="st.saved"
        v-model="text"
        :rows="12"
        class="mt-3 text-sm"
        aria-label="Instagram caption"
        @blur="save"
      />
      <div v-if="st.saved" class="mt-2 grid grid-cols-2 gap-2">
        <Button type="button" variant="pill" size="pill-sm" @click="copy"><Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copied' : 'Copy' }}</Button>
        <Button type="button" variant="ghost" size="sm" :loading="writing" @click="write"><RotateCcw /> Rewrite</Button>
      </div>

      <Field id="caption-lang" label="Language" class="mt-3">
        <Select v-model="language" :options="LANGUAGES.map(l => ({ label: l.label, value: l.value }))" size="sm" />
      </Field>
      <Button v-if="!st.saved" type="button" variant="outline-pill" size="pill-sm" class="mt-3 w-full" :loading="writing" @click="write"><Wand2 /> Write the caption</Button>
      <p class="mt-2 text-xs text-muted-foreground">
        {{ st.tags.length ? `Tags only verified accounts: ${st.tags.join(' ')}.` : 'Nobody in the line-up has Instagram on WeDance yet, so names are written without @.' }}
      </p>
    </template>
    <AdminState v-if="error" kind="error" :message="error" class="mt-3" />
  </section>
</template>
