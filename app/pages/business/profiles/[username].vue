<script setup lang="ts">
/**
 * /business/profiles/<handle> — edit a profile you manage: details, photos (one is the main
 * photo used on cards and flyers), links, and venue details for venues.
 */
import { ExternalLink, Star, Trash2, Check } from 'lucide-vue-next'

definePageMeta({ layout: 'business' })

const route = useRoute()
const { $trpc } = useNuxtApp()
const username = computed(() => String(route.params.username))

type Profile = Awaited<ReturnType<typeof $trpc.business.get.query>>
const loaded = ref<Profile | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

const form = reactive({
  name: '', city: '', bio: '', styles: [] as string[],
  instagram: '', website: '', facebook: '',
  address: '', floorType: '', venueType: '',
  photo: null as string | null,
  photos: [] as { url: string }[],
})
const newPhoto = ref('')
// Last loaded/saved state — drives the honest Saved / Unsaved label.
const snapshot = ref('')
const dirty = computed(() => !!snapshot.value && JSON.stringify(form) !== snapshot.value)

const SOCIALS = ['instagram', 'website', 'facebook'] as const
function socialOf(p: Profile, platform: string) {
  return p.socials.find(s => s.platform.toLowerCase() === platform)?.url ?? ''
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const p = await $trpc.business.get.query({ username: username.value })
    loaded.value = p
    Object.assign(form, {
      name: p.name, city: p.city, bio: p.bio, styles: [...p.styles],
      instagram: socialOf(p, 'instagram'), website: socialOf(p, 'website'), facebook: socialOf(p, 'facebook'),
      address: p.address, floorType: p.floorType, venueType: p.venueType,
      photo: p.photo,
      // Older profiles only have the single photo — show it in the gallery.
      photos: p.photos.length ? [...p.photos] : (p.photo ? [{ url: p.photo }] : []),
    })
    snapshot.value = JSON.stringify(form)
  } catch (e: any) {
    error.value = e?.message || 'Could not load this profile.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
useHead(() => ({ title: `${loaded.value?.name ?? 'Profile'} | Business | WeDance` }))

// Each upload lands in newPhoto; move it into the gallery.
watch(newPhoto, (url) => {
  if (!url) return
  form.photos.push({ url })
  if (!form.photo) form.photo = url
  newPhoto.value = ''
})
function removePhoto(url: string) {
  form.photos = form.photos.filter(p => p.url !== url)
  if (form.photo === url) form.photo = form.photos[0]?.url ?? null
}

const nameError = ref<string | undefined>()
const saving = ref(false)
const savedAt = ref<number | null>(null)
async function save() {
  nameError.value = form.name.trim() ? undefined : 'The name can’t be empty.'
  if (nameError.value) return
  saving.value = true
  error.value = null
  try {
    const p = loaded.value!
    // Keep socials we don't edit here (e.g. YouTube) untouched.
    const others = p.socials.filter(s => !SOCIALS.includes(s.platform.toLowerCase() as any))
    const socials = [
      ...others,
      ...SOCIALS.filter(k => form[k].trim()).map(k => ({ platform: k, url: form[k].trim() })),
    ]
    await $trpc.business.update.mutate({
      username: username.value,
      name: form.name,
      city: form.city,
      bio: form.bio,
      styles: form.styles,
      socials,
      photo: form.photo,
      photos: form.photos,
      ...(p.type === 'venue' ? { address: form.address, floorType: form.floorType, venueType: form.venueType } : {}),
    })
    savedAt.value = Date.now()
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Could not save.'
  } finally {
    saving.value = false
  }
}

const typeLabel: Record<string, string> = { artist: 'Artist', venue: 'Venue', organizer: 'Organizer' }
const photoHint = computed(() => loaded.value?.type === 'artist'
  ? 'Organizers can use your main photo on line-ups and event flyers. Upload a sharp, well-lit photo.'
  : 'The main photo appears on your page and in listings.')
</script>

<template>
  <div>
    <AdminState v-if="loading" kind="loading" />
    <AdminState v-else-if="!loaded" kind="error" :message="error || 'Profile not found.'" />

    <template v-else>
      <AdminPageHeader
        :eyebrow="typeLabel[loaded.type] || 'Profile'"
        :title="loaded.name"
        :description="`@${loaded.username}`"
        :back="{ to: '/business/profiles', label: 'My profiles' }"
      >
        <Button variant="outline-pill" size="pill-sm" as-child>
          <NuxtLink :to="`/@${loaded.username}`" target="_blank"><ExternalLink /> View page</NuxtLink>
        </Button>
      </AdminPageHeader>

      <AdminState v-if="error" kind="error" :message="error" />

      <form novalidate @submit.prevent="save">
        <section class="mt-6 rounded-2xl border bg-card p-5 shadow-wd-card">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Details</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <Field id="edit-name" label="Name" :error="nameError">
              <Input v-model="form.name" />
            </Field>
            <Field id="edit-city" label="City">
              <CityCombobox v-model="form.city" placeholder="e.g. Munich" />
            </Field>
            <Field id="edit-bio" label="About" class="sm:col-span-2">
              <Textarea v-model="form.bio" placeholder="A few lines dancers will read on your page." />
            </Field>
            <Field label="Dance styles" class="sm:col-span-2">
              <DanceStylePicker v-model="form.styles" />
            </Field>
          </div>
        </section>

        <section class="mt-4 rounded-2xl border bg-card p-5 shadow-wd-card">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Photos</h2>
          <p class="mt-1 text-sm text-muted-foreground">{{ photoHint }}</p>
          <div v-if="form.photos.length" class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div v-for="ph in form.photos" :key="ph.url" class="rounded-xl border overflow-hidden bg-muted">
              <img :src="ph.url" alt="" class="aspect-square w-full object-cover">
              <div class="flex items-center justify-between gap-1 p-1.5 bg-card">
                <AdminStatus v-if="form.photo === ph.url" tone="success"><Star class="size-3" aria-hidden="true" /> Main</AdminStatus>
                <Button v-else type="button" size="sm" variant="ghost" class="h-7 px-2 text-xs" @click="form.photo = ph.url">Make main</Button>
                <Button type="button" size="icon-sm" variant="ghost" class="size-7" aria-label="Remove photo" @click="removePhoto(ph.url)"><Trash2 /></Button>
              </div>
            </div>
          </div>
          <div class="mt-4 max-w-xs">
            <ImageUpload v-model="newPhoto" folder="profiles" />
          </div>
        </section>

        <section class="mt-4 rounded-2xl border bg-card p-5 shadow-wd-card">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Links</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            <Field id="edit-instagram" label="Instagram" optional>
              <Input v-model="form.instagram" placeholder="@handle or link" />
            </Field>
            <Field id="edit-website" label="Website" optional>
              <Input v-model="form.website" type="url" placeholder="https://…" />
            </Field>
            <Field id="edit-facebook" label="Facebook" optional>
              <Input v-model="form.facebook" placeholder="Link" />
            </Field>
          </div>
        </section>

        <section v-if="loaded.type === 'venue'" class="mt-4 rounded-2xl border bg-card p-5 shadow-wd-card">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Venue</h2>
          <div class="mt-4 grid gap-4 sm:grid-cols-3">
            <Field id="edit-address" label="Address" class="sm:col-span-3">
              <Input v-model="form.address" />
            </Field>
            <Field id="edit-floor" label="Floor" optional>
              <Input v-model="form.floorType" placeholder="Parquet, tiles…" />
            </Field>
            <Field id="edit-venue-type" label="Type" optional>
              <Input v-model="form.venueType" placeholder="Club, studio, outdoor…" />
            </Field>
          </div>
        </section>

        <div class="mt-6 flex items-center gap-3">
          <Button type="submit" variant="pill" :loading="saving">Save changes</Button>
          <span v-if="dirty && !saving" class="text-sm text-muted-foreground">Unsaved changes</span>
          <span v-else-if="savedAt && !saving" class="inline-flex items-center gap-1 text-sm text-wd-green-700"><Check class="size-4" aria-hidden="true" /> Saved</span>
        </div>
      </form>
    </template>
  </div>
</template>
