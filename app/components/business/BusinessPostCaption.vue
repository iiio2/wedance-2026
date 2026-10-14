<script setup lang="ts">
/**
 * One content-plan post's Instagram caption, under the post: write it (for
 * what the post is for), edit it (saved on blur), copy it; says when the
 * details changed since it was written.
 *
 *   <BusinessPostCaption :post-id="p.id" :caption="p.caption" :language="language" @changed="reload" />
 */
import type { PropType } from 'vue'
import { Copy, Check, Wand2, RotateCcw, AlertTriangle, MessageSquareText, ChevronDown, ChevronUp } from 'lucide-vue-next'

const props = defineProps({
  postId: { type: String, required: true },
  caption: { type: Object as PropType<{ text: string; language: string; changed: boolean } | null>, default: null },
  language: { type: String, default: 'en+de' },
})
const emit = defineEmits<{ changed: [] }>()
const { $trpc } = useNuxtApp()

const open = ref(false)
const text = ref(props.caption?.text ?? '')
watch(() => props.caption?.text, t => { text.value = t ?? '' })
const writing = ref(false)
const error = ref<string | null>(null)
const note = ref<string | null>(null)

async function write() {
  writing.value = true
  error.value = null
  try {
    const c = await $trpc.businessPosts.writeCaption.mutate({ id: props.postId, language: props.language })
    text.value = c.text
    open.value = true
    emit('changed')
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t write the caption.'
  } finally {
    writing.value = false
  }
}
async function save() {
  if (!props.caption || text.value === props.caption.text) return
  try {
    await $trpc.businessPosts.saveCaption.mutate({ id: props.postId, text: text.value })
    note.value = 'Saved'
    setTimeout(() => (note.value = null), 2000)
    emit('changed')
  } catch (e: any) { error.value = e?.message || 'Couldn’t save your edit.' }
}
const copied = ref(false)
async function copy() {
  try {
    await navigator.clipboard.writeText(text.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch { error.value = 'Copy didn’t work: select the text and copy it.' }
}
</script>

<template>
  <div class="mt-2 border-t pt-2">
    <div class="flex flex-wrap items-center gap-2 text-xs">
      <template v-if="caption">
        <button type="button" class="inline-flex items-center gap-1 font-bold text-secondary hover:underline" :aria-expanded="open" @click="open = !open">
          <MessageSquareText class="size-3.5" aria-hidden="true" /> Caption <ChevronUp v-if="open" class="size-3.5" aria-hidden="true" /><ChevronDown v-else class="size-3.5" aria-hidden="true" />
        </button>
        <span v-if="!open" class="min-w-0 flex-1 truncate text-muted-foreground">{{ caption.text.split('\n')[0] }}</span>
        <span v-if="caption.changed" class="inline-flex items-center gap-1 font-bold text-wd-amber-600"><AlertTriangle class="size-3.5" aria-hidden="true" /> Details changed</span>
        <Button type="button" variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="copy"><Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copied' : 'Copy' }}</Button>
      </template>
      <Button v-else type="button" variant="ghost" size="sm" class="h-7 px-2 text-xs" :loading="writing" @click="write"><Wand2 /> Write the caption</Button>
      <span v-if="note" class="text-wd-green-700">{{ note }}</span>
    </div>
    <div v-if="caption && open" class="mt-2 grid gap-2">
      <Textarea v-model="text" :rows="8" class="text-sm" :aria-label="'Caption'" @blur="save" />
      <div class="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" @click="copy"><Check v-if="copied" /><Copy v-else /> {{ copied ? 'Copied' : 'Copy caption' }}</Button>
        <Button type="button" variant="ghost" size="sm" :loading="writing" @click="write"><RotateCcw /> Write it again</Button>
      </div>
    </div>
    <p v-if="error" class="mt-1 text-xs text-destructive" role="alert">{{ error }}</p>
  </div>
</template>
