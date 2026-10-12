<script setup lang="ts">
/**
 * /business/events/<id> — edit an event, see what it still needs, repeat it weekly,
 * or archive it.
 */
import { Check, ExternalLink, Repeat, Archive } from 'lucide-vue-next'
import type { BusinessEventValues } from '~/components/business/BusinessEventForm.vue'
import { toBusinessEventInput } from '~/lib/businessEvent'
import { eventLocalDate } from '#shared/utils/eventTime'

definePageMeta({ layout: 'business' })

const route = useRoute()
const { $trpc } = useNuxtApp()
const id = computed(() => String(route.params.id))

type Ev = Awaited<ReturnType<typeof $trpc.businessEvents.get.query>>
const ev = ref<Ev | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const notice = ref<string | null>(route.query.created ? 'Event created.' : null)

async function load() {
  error.value = null
  try {
    ev.value = await $trpc.businessEvents.get.query({ id: id.value })
  } catch (e: any) {
    error.value = e?.message || 'Could not load this event.'
  } finally {
    loading.value = false
  }
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
    }
  : {})

const saving = ref(false)
async function save(v: BusinessEventValues) {
  saving.value = true
  error.value = null
  notice.value = null
  try {
    const { hostUsername: _h, ...rest } = toBusinessEventInput(v)
    await $trpc.businessEvents.update.mutate({ id: id.value, ...rest })
    await load()
    notice.value = 'Saved.'
  } catch (e: any) {
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

const formRef = ref<{ dirty: boolean } | null>(null)
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
          <NuxtLink :to="`/events/${ev.id}`" target="_blank"><ExternalLink /> View as dancers see it</NuxtLink>
        </Button>
      </AdminPageHeader>

      <AdminState v-if="error" kind="error" :message="error" />
      <p v-if="notice" role="status" class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-sm font-bold text-wd-green-700">
        <Check class="size-4" aria-hidden="true" /> {{ notice }}
      </p>

      <section class="mt-4 rounded-2xl border bg-card p-4">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Checklist</h2>
        <p v-if="!ev.missing.length && ev.published" class="mt-2 text-sm text-wd-green-700 font-bold">Ready: everything a dancer and a flyer need is here.</p>
        <ul v-else class="mt-2 grid gap-1 text-sm">
          <li v-if="!ev.published">• Publish it so dancers can see it.</li>
          <li v-for="m in ev.missing" :key="m">• Add {{ m }}.</li>
        </ul>
      </section>

      <BusinessEventForm ref="formRef" class="mt-4" :initial="initial" :saving="saving" submit-label="Save changes" @submit="save" />

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
    </template>
  </div>
</template>
