<script setup lang="ts">
/**
 * Beside the event's details: the way into its content plan — WeDance's
 * selling point, so it leads. No plan yet → the pitch; a plan → how far along
 * it is and the next post.
 *
 *   <BusinessPlanTeaser :event-id="ev.id" @open="tab = 'plan'" />
 */
import { Sparkles, ArrowRight } from 'lucide-vue-next'

const props = defineProps({ eventId: { type: String, required: true } })
const emit = defineEmits<{ open: [] }>()
const { $trpc } = useNuxtApp()
type Post = Awaited<ReturnType<typeof $trpc.businessPosts.list.query>>[number]
const posts = ref<Post[] | null>(null)
async function load() { try { posts.value = await $trpc.businessPosts.list.query({ eventId: props.eventId }) } catch { posts.value = null } }
onMounted(load)
defineExpose({ reload: load })
const live = computed(() => (posts.value ?? []).filter(p => p.status !== 'dropped'))
const planned = computed(() => live.value.length > 1 || !!live.value[0]?.dueOn)
const ready = computed(() => live.value.filter(p => p.flyer && !p.flyer.stale).length)
const next = computed(() => live.value.find(p => p.status === 'planned'))
const fmtDay = (d: string | null) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : ''
</script>

<template>
  <button type="button" class="group w-full overflow-hidden rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-4 text-left shadow-wd-card transition hover:border-primary/60 focus-visible:shadow-wd-focus" @click="emit('open')">
    <p class="flex items-center gap-1.5 text-eyebrow font-bold uppercase tracking-[0.3em] text-primary"><Sparkles class="size-4" aria-hidden="true" /> Content plan</p>
    <template v-if="!planned">
      <p class="mt-1 font-display text-lg font-bold leading-tight">Every post for this event, made for you</p>
      <p class="mt-1 text-xs text-muted-foreground">The flyer, one post per artist, the line-up, countdown: painted in your look, every word checked.</p>
    </template>
    <template v-else>
      <p class="mt-1 font-display text-lg font-bold leading-tight">{{ ready }} of {{ live.length }} posts ready</p>
      <p v-if="next" class="mt-1 text-xs text-muted-foreground">Next: {{ next.kind === 'artist' ? next.subjectName : next.kind === 'announcement' ? 'the flyer' : next.label.toLowerCase() }}{{ next.dueOn ? ` · ${fmtDay(next.dueOn)}` : '' }}</p>
    </template>
    <span class="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:underline">{{ planned ? 'Open the content plan' : 'Draft my content plan' }} <ArrowRight class="size-4" aria-hidden="true" /></span>
  </button>
</template>
