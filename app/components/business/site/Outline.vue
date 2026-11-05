<script setup lang="ts">
/**
 * The website's sections as an outline (RAZ-412): pick one to edit, drag (or
 * Alt+↑/↓) to reorder, hide from the site, add a new one after any section.
 */
import { GripVertical, EyeOff, Plus, ArrowUp, ArrowDown } from 'lucide-vue-next'
import { SECTION_INFO, missingTexts, pick, type SiteSection } from '#shared/types/profileSite'
import { KIND_ICONS } from '~/lib/site-kinds'

const props = defineProps<{ sections: SiteSection[]; selected: string | null; lang: string; main: string; locales: string[] }>()
const emit = defineEmits<{ select: [id: string]; move: [from: number, to: number]; add: [at: number] }>()

const heading = (s: SiteSection) => [pick(s.title, props.lang, props.main), pick(s.titleAccent, props.lang, props.main)].filter(Boolean).join(' ')
  || pick(s.eyebrow, props.lang, props.main) || pick(s.navLabel, props.lang, props.main) || ''
const missing = (s: SiteSection) => props.lang === props.main ? 0 : missingTexts({ locales: props.locales, sections: [s] }, props.lang)

// Drag and drop (pointer), Alt+↑/↓ (keyboard).
const dragging = ref<number | null>(null)
const over = ref<number | null>(null)
function drop(to: number) {
  if (dragging.value !== null && dragging.value !== to) emit('move', dragging.value, to)
  dragging.value = null
  over.value = null
}
function key(e: KeyboardEvent, i: number) {
  if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
  e.preventDefault()
  const to = i + (e.key === 'ArrowUp' ? -1 : 1)
  if (to >= 0 && to < props.sections.length) {
    emit('move', i, to)
    nextTick(() => (document.querySelector(`[data-outline-id="${props.sections[to]!.id}"]`) as HTMLElement | null)?.focus())
  }
}
</script>

<template>
  <nav aria-label="Sections of the page">
    <ol class="grid grid-cols-[minmax(0,1fr)] gap-1">
      <li
        v-for="(s, i) in sections"
        :key="s.id"
        class="group relative min-w-0"
        :class="over === i && dragging !== null && dragging !== i ? (dragging < i ? 'after:absolute after:inset-x-2 after:-bottom-0.5 after:h-0.5 after:rounded after:bg-primary' : 'before:absolute before:inset-x-2 before:-top-0.5 before:h-0.5 before:rounded before:bg-primary') : ''"
        draggable="true"
        @dragstart="dragging = i"
        @dragover.prevent="over = i"
        @dragleave="over === i && (over = null)"
        @drop.prevent="drop(i)"
        @dragend="dragging = null; over = null"
      >
        <div
          class="flex items-center gap-1 rounded-xl border px-1.5 py-1.5 transition-colors"
          :class="[selected === s.id ? 'border-primary/50 bg-primary/5 shadow-wd-card' : 'border-transparent hover:bg-muted/60', dragging === i ? 'opacity-40' : '']"
        >
          <GripVertical class="size-4 shrink-0 cursor-grab text-muted-foreground/60" aria-hidden="true" />
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left focus-visible:shadow-wd-focus focus-visible:outline-none"
            :data-outline-id="s.id"
            :aria-current="selected === s.id ? 'true' : undefined"
            :aria-label="`${SECTION_INFO[s.kind].label}: ${heading(s) || 'no title'}${s.hidden ? ', hidden' : ''}. Alt+arrow keys to move.`"
            @click="emit('select', s.id)"
            @keydown="key($event, i)"
          >
            <component :is="KIND_ICONS[s.kind]" class="size-4 shrink-0" :class="selected === s.id ? 'text-primary' : 'text-secondary'" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{{ SECTION_INFO[s.kind].label }}</span>
              <span class="block truncate text-sm font-bold" :class="s.hidden ? 'text-muted-foreground line-through decoration-muted-foreground/50' : ''">{{ heading(s) || 'No title yet' }}</span>
            </span>
            <EyeOff v-if="s.hidden" class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span v-if="missing(s)" class="shrink-0 rounded-full bg-wd-amber-500/20 px-1.5 text-[10px] font-bold text-wd-amber-800" :title="`${missing(s)} texts not in ${lang.toUpperCase()} yet`">{{ missing(s) }}</span>
          </button>
          <span class="hidden shrink-0 group-hover:flex group-focus-within:flex">
            <Button type="button" variant="ghost" size="icon" class="size-7" :disabled="i === 0" aria-label="Move up" @click="emit('move', i, i - 1)"><ArrowUp class="size-3.5" /></Button>
            <Button type="button" variant="ghost" size="icon" class="size-7" :disabled="i === sections.length - 1" aria-label="Move down" @click="emit('move', i, i + 1)"><ArrowDown class="size-3.5" /></Button>
          </span>
        </div>
        <button
          type="button"
          class="absolute -bottom-2 left-1/2 z-10 hidden -translate-x-1/2 items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-[10px] font-bold text-secondary shadow-wd-card hover:text-primary group-hover:inline-flex focus-visible:inline-flex"
          :aria-label="`Add a section after ${heading(s) || SECTION_INFO[s.kind].label}`"
          @click="emit('add', i + 1)"
        ><Plus class="size-3" aria-hidden="true" /> Add here</button>
      </li>
    </ol>
    <Button type="button" variant="outline" size="sm" class="mt-3 w-full border-dashed" @click="emit('add', sections.length)"><Plus /> Add a section</Button>
  </nav>
</template>
