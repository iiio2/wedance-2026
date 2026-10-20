<script setup lang="ts">
/**
 * /business/new — create a new artist / venue / organizer profile. The creator owns
 * it straight away and lands in the editor.
 *
 * Start from an Instagram link: it fills in the handle and a name to edit, and
 * stores the link. While typing we look for an existing page (same Instagram
 * account, handle or name) and offer Claim / Join instead of a duplicate.
 */
import { Instagram, ArrowRight } from 'lucide-vue-next'
import { parseInstagramHandle, handleFromInstagram, nameFromInstagram } from '#shared/utils/instagram'

definePageMeta({ layout: 'business' })
useHead({ title: 'Create a profile | WeDance' })

const { $trpc } = useNuxtApp()
const host = useRequestURL().host

const types = [
  { value: 'artist', label: 'Artist', hint: 'Teacher, performer, DJ, musician' },
  { value: 'venue', label: 'Venue', hint: 'Club, bar, studio, outdoor spot' },
  { value: 'organizer', label: 'Organizer', hint: 'Parties, festivals, workshops' },
  { value: 'promoter', label: 'Promoter', hint: 'Shows, management, booking agency' },
] as const
// ?instagram=… (from "Import from Instagram" on Find my profile) and ?type=… pre-fill the form.
// ?next=/business/… returns there once it's made (e.g. back to the new event).
const route = useRoute()
const qType = String(route.query.type ?? '')
const next = typeof route.query.next === 'string' && /^\/business\/[^/]/.test(route.query.next) && !route.query.next.startsWith('//') ? route.query.next : ''
const form = reactive({
  type: (['artist', 'venue', 'organizer', 'promoter'].includes(qType) ? qType : 'artist') as 'artist' | 'venue' | 'organizer' | 'promoter',
  instagram: String(route.query.instagram ?? ''),
  name: '', city: '', handle: '',
})
const nameError = ref<string | undefined>()
const saving = ref(false)
const error = ref<string | null>(null)

const igHandle = computed(() => parseInstagramHandle(form.instagram))
const igError = computed(() => (form.instagram.trim() && !igHandle.value ? 'Paste a link like instagram.com/name, or @name.' : undefined))

// Fill empty fields from the Instagram handle; never overwrite what was typed.
const filledFromIg = reactive({ name: '', handle: '' })
watch(igHandle, (ig) => {
  if (!ig) return
  if (!form.name || form.name === filledFromIg.name) form.name = filledFromIg.name = nameFromInstagram(ig)
  if (!form.handle || form.handle === filledFromIg.handle) form.handle = filledFromIg.handle = handleFromInstagram(ig)
}, { immediate: true })

type Existing = Awaited<ReturnType<typeof $trpc.business.findExisting.query>>
const existing = ref<Existing>([])
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => [igHandle.value, form.name.trim(), form.handle.trim()], () => {
  clearTimeout(timer)
  timer = setTimeout(async () => {
    try {
      existing.value = await $trpc.business.findExisting.query({
        name: form.name.trim() || undefined,
        handle: form.handle.trim() || undefined,
        instagram: igHandle.value || undefined,
      })
    } catch { existing.value = [] }
  }, 350)
}, { immediate: true })

async function submit() {
  nameError.value = form.name.trim() ? undefined : 'Add a name.'
  if (nameError.value || igError.value) return
  saving.value = true
  error.value = null
  try {
    const { username } = await $trpc.business.create.mutate({
      type: form.type,
      name: form.name,
      city: form.city || undefined,
      instagram: igHandle.value || undefined,
      handle: form.handle.trim() || undefined,
    })
    useTrack().track('business_profile_created', { profile: username, profile_type: form.type, from_instagram: !!igHandle.value })
    await navigateTo(next || `/business/network/${username}`)
  } catch (e: any) {
    error.value = e?.message || 'Could not create the profile.'
  } finally {
    saving.value = false
  }
}

const typeLabel: Record<string, string> = { artist: 'Artist', venue: 'Venue', organizer: 'Organizer', promoter: 'Promoter' }
</script>

<template>
  <div>
    <AdminPageHeader eyebrow="Business" title="Create a profile" description="Check “Find my profile” first: your page may already exist." />
    <AdminState v-if="error" kind="error" :message="error" />

    <form class="mt-6 rounded-2xl border bg-card p-5 shadow-wd-card" novalidate @submit.prevent="submit">
      <fieldset>
        <legend class="text-sm font-bold">What is it?</legend>
        <div class="mt-2 grid gap-2 sm:grid-cols-3">
          <label
            v-for="t in types"
            :key="t.value"
            class="cursor-pointer rounded-xl border p-3 transition-colors has-[:focus-visible]:shadow-wd-focus"
            :class="form.type === t.value ? 'border-primary bg-primary/5' : 'hover:bg-accent/40'"
          >
            <input v-model="form.type" type="radio" name="type" :value="t.value" class="sr-only">
            <span class="block text-sm font-bold">{{ t.label }}</span>
            <span class="block text-xs text-muted-foreground">{{ t.hint }}</span>
          </label>
        </div>
      </fieldset>

      <Field id="new-instagram" label="Instagram" optional :error="igError" hint="Paste the Instagram link to fill in the handle and a name. You can change both." class="mt-4">
        <div class="relative">
          <Instagram class="size-4 absolute left-3.5 top-3.5 text-muted-foreground" aria-hidden="true" />
          <Input v-model="form.instagram" placeholder="https://www.instagram.com/…" class="pl-10" autocomplete="off" />
        </div>
      </Field>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <Field id="new-name" label="Name" :error="nameError">
          <Input v-model="form.name" placeholder="e.g. La Clave en Múnich" />
        </Field>
        <Field id="new-city" label="City">
          <CityCombobox v-model="form.city" placeholder="e.g. Munich" />
        </Field>
        <Field
          id="new-handle"
          label="Handle"
          optional
          class="sm:col-span-2"
          :hint="`Your page address: ${host}/@${form.handle || 'your-name'}. We pick one from the name if you leave it empty.`"
        >
          <Input v-model="form.handle" placeholder="laclave" />
        </Field>
      </div>

      <div v-if="existing.length" class="mt-5 rounded-xl border border-warning/40 bg-warning/10 p-4" role="status">
        <p class="text-sm font-bold">Already on WeDance?</p>
        <p class="text-xs text-muted-foreground">If one of these is yours, take it over instead of creating a second page.</p>
        <div class="mt-3 grid grid-cols-[minmax(0,1fr)] gap-2">
          <div v-for="p in existing" :key="p.username" class="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3">
            <img v-if="p.photo" :src="p.photo" alt="" class="size-9 rounded-lg object-cover">
            <span v-else class="size-9 rounded-lg bg-muted" />
            <div class="min-w-[10rem] flex-1">
              <NuxtLink :to="`/@${p.username}`" target="_blank" class="block truncate text-sm font-bold hover:underline">{{ p.name }}</NuxtLink>
              <p class="truncate text-xs text-muted-foreground">{{ typeLabel[p.type] || p.type }} · @{{ p.username }}<template v-if="p.city"> · {{ p.city }}</template></p>
            </div>
            <Button variant="outline-pill" size="pill-sm" as-child>
              <NuxtLink :to="`/business/claim?profile=${p.username}`">{{ p.managed ? 'Join the team' : 'Claim it' }} <ArrowRight /></NuxtLink>
            </Button>
          </div>
        </div>
      </div>

      <div class="mt-5">
        <Button type="submit" variant="pill" :loading="saving">{{ existing.length ? 'No, create a new profile' : 'Create profile' }}</Button>
      </div>
    </form>
  </div>
</template>
