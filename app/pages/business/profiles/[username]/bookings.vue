<script setup lang="ts">
/**
 * /business/profiles/<username>/bookings — people who asked to book this page
 * (inquiries.forProfile), newest first. Answer by email (opens a reply), then
 * mark it answered or declined. Also the booking link to put on your own site.
 */
import { Mail, Copy, Check, CalendarDays, MapPin, Users, Wallet, ExternalLink, Phone } from 'lucide-vue-next'

definePageMeta({ layout: 'business' })
const route = useRoute()
const username = computed(() => String(route.params.username))
useHead({ title: 'Bookings | Business | WeDance' })

const { $trpc } = useNuxtApp()
type Row = Awaited<ReturnType<typeof $trpc.inquiries.forProfile.query>>[number]
const rows = ref<Row[] | null>(null)
const error = ref<string | null>(null)
async function load() {
  try { rows.value = await $trpc.inquiries.forProfile.query({ username: username.value }); error.value = null }
  catch (e: any) { error.value = e?.message || 'Couldn’t load the bookings.' }
}
onMounted(load)

const site = useRequestURL().origin
const link = computed(() => `${site}/@${username.value}/book`)
const copied = ref(false)
async function copy() {
  try { await navigator.clipboard.writeText(link.value); copied.value = true; setTimeout(() => (copied.value = false), 2000) } catch {}
}

async function setStatus(r: Row, status: 'new' | 'answered' | 'declined') {
  const before = r.status
  r.status = status
  try { await $trpc.inquiries.setStatus.mutate({ username: username.value, id: r.id, status }) } catch { r.status = before }
}
const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const when = (d: string | Date) => new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const reply = (r: Row) => `mailto:${r.email}?subject=${encodeURIComponent(`Re: booking${r.what ? ` · ${r.what}` : ''}${r.eventDate ? ` · ${day(r.eventDate)}` : ''}`)}`
const open = computed(() => (rows.value ?? []).filter(r => r.status === 'new'))
const closed = computed(() => (rows.value ?? []).filter(r => r.status !== 'new'))
</script>

<template>
  <div>
    <AdminPageHeader eyebrow="Business" title="Bookings" :description="`People who asked to book @${username}.`" :back="{ to: `/business/profiles/${username}`, label: 'Profile' }" />

    <!-- The booking link -->
    <section class="mt-6 rounded-2xl border bg-card p-5 shadow-wd-card">
      <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Your booking link</h2>
      <p class="mt-1 text-sm text-muted-foreground">Put it on your website, your Instagram bio or your email signature. It opens a booking page with your photo and a short form. No account needed to send one.</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <code class="min-w-0 flex-1 truncate rounded-lg border bg-background px-3 py-2 text-sm">{{ link }}</code>
        <Button type="button" variant="pill" size="pill-sm" @click="copy"><component :is="copied ? Check : Copy" /> {{ copied ? 'Copied' : 'Copy' }}</Button>
        <Button variant="outline-pill" size="pill-sm" as-child><a :href="link" target="_blank" rel="noopener"><ExternalLink /> Try it</a></Button>
      </div>
    </section>

    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-else-if="!rows" kind="loading" />
    <template v-else>
      <p v-if="!rows.length" class="mt-6 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">No requests yet. Share your booking link and they land here, and in your email.</p>
      <section v-for="group in [{ title: 'Waiting for you', list: open }, { title: 'Done', list: closed }]" v-show="group.list.length" :key="group.title" class="mt-6">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">{{ group.title }}</h2>
        <ul class="mt-3 grid gap-3">
          <li v-for="r in group.list" :key="r.id" class="rounded-2xl border bg-card p-4" :class="r.status !== 'new' ? 'opacity-70' : ''">
            <div class="flex flex-wrap items-baseline justify-between gap-2">
              <p class="font-bold">{{ r.what }} <span class="font-normal text-muted-foreground">· {{ r.name }}<template v-if="r.organization">, {{ r.organization }}</template></span></p>
              <span class="text-xs text-muted-foreground">{{ when(r.createdAt) }}</span>
            </div>
            <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span v-if="r.eventDate" class="inline-flex items-center gap-1"><CalendarDays class="size-3.5" aria-hidden="true" /> {{ day(r.eventDate) }}</span>
              <span v-if="r.city" class="inline-flex items-center gap-1"><MapPin class="size-3.5" aria-hidden="true" /> {{ r.city }}</span>
              <span v-if="r.guests" class="inline-flex items-center gap-1"><Users class="size-3.5" aria-hidden="true" /> {{ r.guests }} people</span>
              <span v-if="r.budget" class="inline-flex items-center gap-1"><Wallet class="size-3.5" aria-hidden="true" /> {{ r.budget }}</span>
            </div>
            <p class="mt-3 whitespace-pre-line text-sm">{{ r.message }}</p>
            <div class="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="pill" size="pill-sm" as-child><a :href="reply(r)"><Mail /> Reply to {{ r.email }}</a></Button>
              <Button v-if="r.phone" variant="outline-pill" size="pill-sm" as-child><a :href="`https://wa.me/${r.phone.replace(/[^\d+]/g, '').replace(/^00/, '+').replace(/^\+/, '')}`" target="_blank" rel="noopener"><Phone /> WhatsApp</a></Button>
              <Button v-if="r.phone" variant="ghost" size="sm" as-child><a :href="`tel:${r.phone.replace(/[^\d+]/g, '')}`">Call {{ r.phone }}</a></Button>
              <template v-if="r.status === 'new'">
                <Button type="button" variant="outline-pill" size="pill-sm" @click="setStatus(r, 'answered')"><Check /> Answered</Button>
                <Button type="button" variant="ghost" size="sm" @click="setStatus(r, 'declined')">Decline</Button>
              </template>
              <template v-else>
                <AdminStatus :tone="r.status === 'answered' ? 'success' : 'neutral'">{{ r.status === 'answered' ? 'Answered' : 'Declined' }}</AdminStatus>
                <Button type="button" variant="ghost" size="sm" @click="setStatus(r, 'new')">Move back</Button>
              </template>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
