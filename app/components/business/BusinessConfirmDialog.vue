<script setup lang="ts">
/**
 * "Confirm" for an artist in the line-up: how the confirmation works, their
 * personal link, and a message to paste into WhatsApp or Instagram.
 */
import { Copy, Check, Loader2, Link2, MessageCircle } from 'lucide-vue-next'

const open = defineModel<boolean>('open', { default: false })
const props = defineProps({
  eventId: { type: String, required: true },
  handle: { type: String, required: true },
  name: { type: String, required: true },
})

const { $trpc } = useNuxtApp()
type L = Awaited<ReturnType<typeof $trpc.artistInvites.link.mutate>>
const link = ref<L | null>(null)
const error = ref<string | null>(null)
watch(open, async (v) => {
  if (!v || link.value) return
  error.value = null
  try { link.value = await $trpc.artistInvites.link.mutate({ eventId: props.eventId, handle: props.handle }) } catch (e: any) { error.value = e?.message || 'Couldn’t make the link.' }
}, { immediate: true })

const first = computed(() => props.name.split(/\s+/)[0] || props.name)
const message = computed(() => link.value
  ? `Hi ${first.value}! You're in the line-up of ${link.value.eventName} on WeDance 🎉 Could you check your name, photos and info for the flyer? Approve or change anything here: ${link.value.url}`
  : '')
const copied = ref<'link' | 'message' | null>(null)
async function copy(what: 'link' | 'message') {
  try {
    await navigator.clipboard.writeText(what === 'link' ? link.value!.url : message.value)
    copied.value = what
    setTimeout(() => (copied.value = null), 2000)
  } catch {
    error.value = 'Copy didn’t work: select the text and copy it.'
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Ask {{ name }} to confirm</DialogTitle>
        <DialogDescription>Send them their personal link. It takes them a minute, and you get the right photo and spelling for the flyer.</DialogDescription>
      </DialogHeader>

      <ol class="grid gap-2 text-sm">
        <li class="flex gap-2"><span class="font-bold text-secondary">1.</span> They see what you need for {{ link?.eventName || 'your event' }}: name, photos, video, about, links.</li>
        <li class="flex gap-2"><span class="font-bold text-secondary">2.</span> They approve your changes, fix what’s wrong, or add more photos.</li>
        <li class="flex gap-2"><span class="font-bold text-secondary">3.</span>
          <span v-if="link?.managed">Their page has an owner: they answer signed in. Until they do, it waits under “Needs you” on their Business home.</span>
          <span v-else>No one manages their page yet: they can create an account with email and password and make it theirs.</span>
        </li>
      </ol>

      <AdminState v-if="error" kind="error" :message="error" />
      <div v-else-if="!link" class="flex justify-center py-4"><Loader2 class="size-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
      <template v-else>
        <Field :id="`confirm-link-${handle}`" label="Their link">
          <div class="flex gap-2">
            <Input :model-value="link.url" readonly class="min-w-0 flex-1 font-mono text-xs" @focus="(e: FocusEvent) => (e.target as HTMLInputElement).select()" />
            <Button type="button" variant="outline-pill" size="pill-sm" @click="copy('link')"><Check v-if="copied === 'link'" /><Link2 v-else /> {{ copied === 'link' ? 'Copied' : 'Copy link' }}</Button>
          </div>
        </Field>
        <Field :id="`confirm-msg-${handle}`" label="A message to send">
          <Textarea :model-value="message" readonly :rows="4" class="text-sm" />
        </Field>
        <div>
          <Button type="button" variant="pill" @click="copy('message')"><Check v-if="copied === 'message'" /><MessageCircle v-else /> {{ copied === 'message' ? 'Copied' : 'Copy message' }}</Button>
        </div>
        <BusinessContactLinks :contacts="link.contacts" :managed="link.managed" :answered="link.answered" :event-id="eventId" :handle="handle" :notified-at="link.notifiedAt" />
      </template>
    </DialogContent>
  </Dialog>
</template>
