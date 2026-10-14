<script setup lang="ts">
/**
 * Where to send a link: the profile's ways to be reached (shared/utils/contacts),
 * each opening in a new tab — copy the message first, then paste it there.
 *
 *   <BusinessContactLinks :contacts="link.contacts" :managed="link.managed" />
 */
import type { PropType } from 'vue'
import { Instagram, Facebook, Send, MessageCircle, Globe, MapPin, Search, ExternalLink, Mail, Check } from 'lucide-vue-next'
import type { Contact } from '#shared/utils/contacts'

const props = defineProps({
  /** For "Email them": the event and the page's handle. */
  eventId: { type: String, default: undefined },
  handle: { type: String, default: undefined },
  /** When their team was last emailed about this link. */
  notifiedAt: { type: [String, Date] as PropType<string | Date | null>, default: null },
  contacts: { type: Array as PropType<Contact[]>, required: true },
  /** Someone runs the page here: unanswered, it also waits on their Business home. */
  managed: { type: Boolean, default: false },
  /** They've answered already. */
  answered: { type: Boolean, default: false },
})
const { $trpc } = useNuxtApp()
const sentAt = ref<Date | null>(props.notifiedAt ? new Date(props.notifiedAt) : null)
const sentTo = ref<number | null>(null)
const sending = ref(false)
const sendError = ref<string | null>(null)
const recent = computed(() => !!sentAt.value && Date.now() - +sentAt.value < 24 * 3600_000)
async function emailThem() {
  if (!props.eventId || !props.handle) return
  sending.value = true
  sendError.value = null
  try {
    const r = await $trpc.artistInvites.notify.mutate({ eventId: props.eventId, handle: props.handle })
    sentAt.value = new Date(r.notifiedAt)
    sentTo.value = r.sent
  } catch (e: any) {
    sendError.value = e?.message || 'Couldn’t send the email.'
  } finally {
    sending.value = false
  }
}
const fmtSent = (d: Date) => d.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const ICON = { instagram: Instagram, facebook: Facebook, telegram: Send, whatsapp: MessageCircle, website: Globe, maps: MapPin, search: Search } as const
</script>

<template>
  <div>
    <p class="text-sm font-bold">How to reach them</p>
    <p class="text-xs text-muted-foreground">
      <template v-if="contacts[0]?.kind === 'search'">We don’t have their contact yet: find them, then paste the message.</template>
      <template v-else>Copy the message, then paste it there.</template>
      <template v-if="managed && answered"> They’ve answered already: send the link again only if something changed.</template>
      <template v-else-if="managed"> They run their page on WeDance: it also waits for them under “Needs you” on their Business home.</template>
    </p>
    <!-- WeDance emails the people who run the page (their addresses stay private). -->
    <div v-if="managed && eventId && handle" class="mt-2 flex flex-wrap items-center gap-2">
      <Button type="button" size="sm" variant="outline" :loading="sending" :disabled="recent" @click="emailThem"><Check v-if="recent" /><Mail v-else /> {{ recent ? 'Emailed' : 'Email them from WeDance' }}</Button>
      <span v-if="sentAt" class="text-xs text-muted-foreground">{{ sentTo ? `Sent to ${sentTo === 1 ? 'the person who runs' : `the ${sentTo} people who run`} their page · ` : 'Last emailed ' }}{{ fmtSent(sentAt) }}</span>
      <span v-else class="text-xs text-muted-foreground">With the link, to the people who run their page.</span>
      <p v-if="sendError" class="w-full text-xs text-destructive" role="alert">{{ sendError }}</p>
    </div>
    <ul class="mt-2 grid gap-1.5">
      <li v-for="c in contacts" :key="c.url">
        <a :href="c.url" target="_blank" rel="noopener" class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted">
          <component :is="ICON[c.kind]" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ c.label }}</span>
          <ExternalLink class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </a>
      </li>
    </ul>
  </div>
</template>
