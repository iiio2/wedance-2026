<script setup lang="ts">
/**
 * /business/events/<id> — two tabs. Details: edit the event, see what it still
 * needs, its flyer (the panel beside the cards), repeat it weekly, archive it.
 * Content plan (?tab=plan): every post it's promoted with, each made with the
 * flyer pipeline. Both stay mounted, so switching keeps unsaved edits.
 */
import { Check, ExternalLink, Repeat, Archive, Sparkles, FileText, Copy } from 'lucide-vue-next'
import type { BusinessEventValues } from '~/components/business/BusinessEventForm.vue'
import { toBusinessEventInput } from '~/lib/businessEvent'
import { eventLocalDate } from '#shared/utils/eventTime'
import { eventPath } from '#shared/utils/eventSlug'

definePageMeta({ layout: 'business' })

const route = useRoute()
const { $trpc } = useNuxtApp()
const id = computed(() => String(route.params.id))

type Ev = Awaited<ReturnType<typeof $trpc.businessEvents.get.query>>
const ev = ref<Ev | null>(null)
const hosts = ref<{ username: string; name: string }[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const notice = ref<string | null>(route.query.created ? 'Event created.' : route.query.added ? `@${route.query.added} is in the line-up. Send them their link below so they can confirm.` : null)
const tab = ref<'details' | 'plan'>(route.query.tab === 'plan' ? 'plan' : 'details')
watch(tab, t => navigateTo({ query: { ...route.query, tab: t === 'plan' ? 'plan' : undefined } }, { replace: true }))

async function load() {
  error.value = null
  try {
    const [evData, profileData] = await Promise.all([
      $trpc.businessEvents.get.query({ id: id.value }),
      $trpc.business.myProfiles.query(),
    ])
    ev.value = evData
    hosts.value = profileData.managed.map((p: any) => ({ username: p.username, name: p.name }))
  } catch (e: any) {
    error.value = e?.message || 'Could not load this event.'
  } finally {
    loading.value = false
  }
  // #lineup (from an artist's booking page): the editor renders after the load.
  if (route.hash) nextTick(() => document.querySelector(route.hash)?.scrollIntoView({ block: 'start' }))
}
onMounted(load)
useHead(() => ({ title: `${ev.value?.name || 'Event'} | Business | WeDance` }))

const initial = computed<Partial<BusinessEventValues>>(() => ev.value
  ? {
      hostUsername: ev.value.host?.username ?? '',
      name: ev.value.name, type: ev.value.type, date: ev.value.date, startTime: ev.value.startTime,
      endTime: ev.value.endTime ?? '', endDate: ev.value.endDate ?? '', city: ev.value.city,
      venueUsername: ev.value.venueUsername, venueName: ev.value.venueUsername ? '' : ev.value.venueName,
      venueAddress: ev.value.venueUsername ? '' : ev.value.venueAddress,
      artists: ev.value.artists, styles: ev.value.styles, description: ev.value.description,
      cover: ev.value.cover ?? '', ticketUrl: ev.value.ticketUrl ?? '', price: ev.value.price, published: ev.value.published,
      agenda: ev.value.agenda, showAgenda: ev.value.flyerOptions.showAgenda !== false, photos: ev.value.flyerOptions.photos ?? {}, names: ev.value.flyerOptions.names ?? {},
      // The key isn't editable: dancers' plans and picks hang on it.
      festival: ev.value.festival ? (({ key: _k, ...rest }) => rest)(ev.value.festival) : null,
    }
  : {})

const saving = ref(false)
// After switching organizer, offer to copy flyer styles from the old profile.
const copyLooksOffer = ref<{ from: string; to: string; fromName: string } | null>(null)
const copyingLooks = ref(false)
async function copyLooks() {
  if (!copyLooksOffer.value) return
  copyingLooks.value = true
  try {
    const { copied } = await $trpc.businessFlyers.copyLooks.mutate(copyLooksOffer.value)
    notice.value = copied ? `Copied ${copied} flyer ${copied === 1 ? 'style' : 'styles'}.` : 'No new styles to copy.'
    copyLooksOffer.value = null
    panelRef.value?.reload()
  } catch (e: any) {
    error.value = e?.message || 'Could not copy styles.'
  } finally {
    copyingLooks.value = false
  }
}

async function save(v: BusinessEventValues) {
  saving.value = true
  error.value = null
  notice.value = null
  copyLooksOffer.value = null
  try {
    const input = toBusinessEventInput(v)
    const oldHost = ev.value?.host?.username
    const hostChanged = input.hostUsername !== oldHost
    await $trpc.businessEvents.update.mutate({
      id: id.value,
      ...(hostChanged ? input : (() => { const { hostUsername: _h, ...rest } = input; return rest })()),
    })
    await load()
    panelRef.value?.reload()
    captionRef.value?.reload()
    planRef.value?.reload()
    teaserRef.value?.reload()
    notice.value = 'Saved.'
    if (hostChanged && oldHost && input.hostUsername) {
      const oldName = hosts.value.find(h => h.username === oldHost)?.name ?? oldHost
      copyLooksOffer.value = { from: oldHost, to: input.hostUsername, fromName: oldName }
    }
    if (pending.value) { const t = pending.value; pending.value = null; await toFlyer(t) }
    if (pendingPost.value) { const t = pendingPost.value; pendingPost.value = null; await toPost(t) }
  } catch (e: any) {
    pending.value = null
    error.value = e?.message || 'Could not save.'
  } finally {
    saving.value = false
  }
}

const weeks = ref('4')
const repeating = ref(false)
async function repeat() {
  repeating.value = true
  error.value = null
  try {
    const { created } = await $trpc.businessEvents.duplicate.mutate({ id: id.value, weeks: Number(weeks.value) })
    const tz = ev.value?.timezone || 'Europe/Berlin'
    const last = created[created.length - 1]
    notice.value = `Added ${created.length} more ${created.length === 1 ? 'date' : 'dates'}, until ${last ? eventLocalDate(last.startDate, tz).split('-').reverse().join('.') : ''}.`
  } catch (e: any) {
    error.value = e?.message || 'Could not repeat the event.'
  } finally {
    repeating.value = false
  }
}

const formRef = ref<{ dirty: boolean; submit: () => boolean } | null>(null)
const planRef = ref<{ reload: () => Promise<void> } | null>(null)
const teaserRef = ref<{ reload: () => Promise<void> } | null>(null)
// Line-up names for "Add a post · artist".
const lineup = computed(() => (ev.value?.artists ?? []).map((h: string) => ({ username: h, name: ev.value?.flyerOptions?.names?.[h] || h })))

// A content-plan post: like the flyer, made from saved details.
type PostTarget = { postId: string; action: 'make' | 'open' | 'refresh'; batchId?: string }
const pendingPost = ref<PostTarget | null>(null)
async function onPost(t: PostTarget) {
  if (t.action !== 'open' && formRef.value?.dirty) {
    pendingPost.value = t
    if (!formRef.value.submit()) { pendingPost.value = null; tab.value = 'details'; error.value = 'Fix the details first: the posts are made from them.' }
    return
  }
  await toPost(t)
}
async function toPost(t: PostTarget) {
  const base = `/business/events/${id.value}/flyer`
  if (t.action === 'open') return navigateTo({ path: base, query: { post: t.postId, ...(t.batchId ? { batch: t.batchId } : {}) } })
  if (t.action === 'make') return navigateTo({ path: base, query: { post: t.postId } })
  try {
    const { batchId } = await $trpc.businessFlyers.refresh.mutate({ eventId: id.value, postId: t.postId })
    await navigateTo({ path: base, query: { post: t.postId, batch: batchId, refresh: '1' } })
  } catch (e: any) {
    error.value = e?.message || 'Could not refresh the post.'
  }
}
const panelRef = ref<{ reload: () => Promise<void> } | null>(null)
const captionRef = ref<{ reload: () => Promise<void> } | null>(null)

// Flyer actions start from saved details: save first if anything changed.
type FlyerTarget = { action: 'make' | 'refresh' | 'open'; batchId?: string; flyerId?: string }
const pending = ref<FlyerTarget | null>(null)
async function onFlyer(t: FlyerTarget) {
  if (t.action !== 'open' && formRef.value?.dirty) {
    pending.value = t
    if (!formRef.value.submit()) { pending.value = null; error.value = 'Fix the details first: the flyer is made from them.' }
    return
  }
  await toFlyer(t)
}
async function toFlyer(t: FlyerTarget) {
  const base = `/business/events/${id.value}/flyer`
  if (t.action === 'open') return navigateTo({ path: base, query: { batch: t.batchId, flyer: t.flyerId } })
  if (t.action === 'make') return navigateTo(base)
  try {
    const { batchId } = await $trpc.businessFlyers.refresh.mutate({ eventId: id.value })
    await navigateTo({ path: base, query: { batch: batchId, refresh: '1' } })
  } catch (e: any) {
    error.value = e?.message || 'Could not refresh the flyer.'
  }
}
const confirmArchive = ref(false)
const archiving = ref(false)
async function archive() {
  archiving.value = true
  try {
    await $trpc.businessEvents.archive.mutate({ id: id.value })
    await navigateTo('/business/events')
  } catch (e: any) {
    error.value = e?.message || 'Could not archive the event.'
    archiving.value = false
  }
}
</script>

<template>
  <div>
    <AdminState v-if="loading" kind="loading" />
    <AdminState v-else-if="!ev" kind="error" :message="error || 'Event not found.'" />

    <template v-else>
      <AdminPageHeader
        :eyebrow="ev.host?.name || 'Event'"
        :title="ev.name"
        :back="{ to: '/business/events', label: 'Events' }"
      >
        <Button v-if="ev.published" variant="outline-pill" size="pill-sm" as-child>
          <NuxtLink :to="eventPath({ id: ev.id, name: ev.name })" target="_blank"><ExternalLink /> View as dancers see it</NuxtLink>
        </Button>
      </AdminPageHeader>

      <AdminState v-if="error" kind="error" :message="error" />
      <p v-if="notice" role="status" class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-sm font-bold text-wd-green-700">
        <Check class="size-4" aria-hidden="true" /> {{ notice }}
      </p>
      <div v-if="copyLooksOffer" class="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-secondary/10 p-4 text-sm">
        <p>Copy flyer styles from <span class="font-bold">{{ copyLooksOffer.fromName }}</span> to the new organizer?</p>
        <Button type="button" variant="outline-pill" size="pill-sm" :loading="copyingLooks" @click="copyLooks"><Copy /> Copy styles</Button>
        <Button type="button" variant="ghost" size="sm" @click="copyLooksOffer = null">Skip</Button>
      </div>

      <!-- Tabs: both panels stay mounted (v-show), so unsaved details survive a switch. -->
      <Tabs v-if="!ev.synced" v-model="tab" class="mt-4">
        <TabsList>
          <TabsTrigger value="details"><span class="inline-flex items-center gap-1.5"><FileText class="size-4" aria-hidden="true" /> Details</span></TabsTrigger>
          <TabsTrigger value="plan"><span class="inline-flex items-center gap-1.5"><Sparkles class="size-4 text-primary" aria-hidden="true" /> Content plan</span></TabsTrigger>
        </TabsList>
      </Tabs>

      <div v-show="tab === 'details' || ev.synced">
      <p v-if="ev.synced" class="mt-4 rounded-2xl bg-secondary/10 p-4 text-sm" role="status">
        <span class="font-bold">This event comes from wedance.vip.</span>
        <span class="text-muted-foreground"> Check the details and save: it shows as “Checked” to dancers, the daily sync stops overwriting it{{ ev.host ? `, and it moves to ${ev.host.name}’s events` : '' }}. Then you can make its flyer.</span>
      </p>

      <p v-if="route.query.flyer && !route.query.created" class="mt-4 rounded-2xl bg-secondary/10 p-4 text-sm" role="status">
        <span class="font-bold">Check the details, then make the flyer.</span>
        <span class="text-muted-foreground"> What’s here goes on it word for word. The panel shows exactly which words.</span>
      </p>

      <section class="mt-4 rounded-2xl border bg-card p-4">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Checklist</h2>
        <p v-if="!ev.missing.length && ev.published" class="mt-2 text-sm text-wd-green-700 font-bold">Ready: everything a dancer and a flyer need is here.</p>
        <ul v-else class="mt-2 grid gap-1 text-sm">
          <li v-if="!ev.published">• Publish it so dancers can see it.</li>
          <li v-for="m in ev.missing" :key="m">• Add {{ m }}.</li>
        </ul>
      </section>

      <div class="mt-4 grid gap-5" :class="ev.synced ? '' : 'lg:grid-cols-[minmax(0,1fr)_19rem]'">
        <BusinessEventForm
          ref="formRef"
          :event-id="ev.id"
          :initial="initial"
          :hosts="hosts"
          :labels="{ venue: ev.venueName, host: ev.host?.name }"
          :saving="saving"
          submit-label="Save changes"
          @submit="save"
        />
        <div v-if="!ev.synced" class="order-first grid content-start gap-4 lg:order-none">
          <BusinessPlanTeaser ref="teaserRef" :event-id="ev.id" @open="tab = 'plan'" />
          <BusinessFlyerPanel ref="panelRef" :event-id="ev.id" :highlight="!!route.query.flyer" @go="onFlyer" />
          <BusinessCaption ref="captionRef" :event-id="ev.id" />
        </div>
      </div>

      <section class="mt-8 grid gap-4 sm:grid-cols-2">
        <div class="rounded-2xl border bg-card p-4">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Repeat weekly</h2>
          <p class="mt-1 text-sm text-muted-foreground">Copies this event to the same weekday and time, with everything filled in. Save your changes first.</p>
          <div class="mt-3 flex items-end gap-2">
            <Field id="repeat-weeks" label="For the next" class="w-36">
              <Select v-model="weeks" :options="Array.from({ length: 12 }, (_, i) => ({ label: `${i + 1} ${i ? 'weeks' : 'week'}`, value: String(i + 1) }))" size="sm" />
            </Field>
            <Button type="button" variant="outline-pill" size="pill-sm" :loading="repeating" :disabled="formRef?.dirty" @click="repeat"><Repeat /> Repeat</Button>
          </div>
        </div>
        <div class="rounded-2xl border bg-card p-4">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Archive</h2>
          <p class="mt-1 text-sm text-muted-foreground">Cancelled or a mistake? Archiving takes it off WeDance.</p>
          <Button v-if="!confirmArchive" type="button" variant="destructive" size="sm" class="mt-3" @click="confirmArchive = true"><Archive /> Archive event</Button>
          <div v-else class="mt-3 flex flex-wrap items-center gap-2">
            <span class="text-sm font-bold">Archive “{{ ev.name }}”?</span>
            <Button type="button" variant="destructive" size="sm" :loading="archiving" @click="archive">Yes, archive</Button>
            <Button type="button" variant="ghost" size="sm" @click="confirmArchive = false">Keep it</Button>
          </div>
        </div>
      </section>
      </div>

      <div v-if="!ev.synced" v-show="tab === 'plan'" class="mt-4">
        <BusinessContentPlan ref="planRef" :event-id="ev.id" :lineup="lineup" @go="onPost" @changed="teaserRef?.reload()" />
      </div>
    </template>
  </div>
</template>
