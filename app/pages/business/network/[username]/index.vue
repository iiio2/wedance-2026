<script setup lang="ts">
/**
 * /business/network/<handle> — edit a profile you manage: details, photos (one is the main
 * photo used on cards and flyers), links, and venue details for venues.
 */
import { ExternalLink, Star, Trash2, Check, Users, Palette, Inbox } from 'lucide-vue-next'
import type { VenueDetailsValue } from '~/components/business/BusinessVenueDetails.vue'
import type { Room } from '~/components/business/BusinessVenueRooms.vue'

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
  photo: null as string | null,
  photos: [] as { url: string }[],
})
// Venues: their details and rooms.
const venue = reactive<VenueDetailsValue>({ address: '', venueType: '', floorType: '', capacity: null, amenities: [], openingHours: [], floorPlan: null, contact: {} })
const rooms = ref<Room[]>([])
const keptRooms = ref<string[]>([])
const newPhoto = ref('')
// Last loaded/saved state — drives the honest Saved / Unsaved label.
const snapshot = ref('')
const state = () => JSON.stringify([form, venue, rooms.value])
const dirty = computed(() => !!snapshot.value && state() !== snapshot.value)

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
      photo: p.photo,
      // Older profiles only have the single photo — show it in the gallery.
      photos: p.photos.length ? [...p.photos] : (p.photo ? [{ url: p.photo }] : []),
    })
    Object.assign(venue, {
      address: p.address, venueType: p.venueType, floorType: p.floorType, capacity: p.capacity,
      amenities: [...p.amenities], openingHours: p.openingHours.map(h => ({ ...h })), floorPlan: p.floorPlan, contact: { ...p.contact },
    })
    rooms.value = p.type === 'venue'
      ? (await $trpc.business.spaces.query({ username: username.value })).map((r: any) => ({ id: r.id, name: r.name, capacity: r.capacity, floorType: r.floorType ?? '', priceInfo: r.priceInfo ?? '', description: r.description ?? '', imageUrl: r.imageUrl }))
      : []
    snapshot.value = state()
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
      ...(p.type === 'venue' ? {
        address: venue.address, floorType: venue.floorType, venueType: venue.venueType,
        capacity: venue.capacity || null, amenities: venue.amenities, openingHours: venue.openingHours.filter(h => h.hours.trim()),
        floorPlan: venue.floorPlan || null,
        contact: Object.fromEntries(Object.entries(venue.contact).map(([k, v]) => [k, String(v ?? '').trim()]).filter(([, v]) => v)),
      } : {}),
    })
    if (p.type === 'venue') {
      const r = await $trpc.business.saveSpaces.mutate({
        username: username.value,
        // Rooms without a name aren't saved.
        spaces: rooms.value.filter(x => x.name.trim()).map(x => ({ ...x, capacity: x.capacity || null })),
      })
      keptRooms.value = r.kept
    }
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
        :back="{ to: '/business/network', label: 'Network' }"
      >
        <Button v-if="loaded.type !== 'organizer'" variant="outline-pill" size="pill-sm" as-child>
          <NuxtLink :to="`/business/network/${loaded.username}/bookings`"><Inbox /> Bookings</NuxtLink>
        </Button>
        <Button variant="outline-pill" size="pill-sm" as-child>
          <NuxtLink :to="`/business/network/${loaded.username}/team`"><Users /> Team</NuxtLink>
        </Button>
        <Button variant="outline-pill" size="pill-sm" as-child>
          <NuxtLink :to="`/business/network/${loaded.username}/styles`"><Palette /> Flyer styles</NuxtLink>
        </Button>
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

        <template v-if="loaded.type === 'venue'">
          <BusinessVenueDetails v-model="venue" class="mt-4" />
          <BusinessVenueRooms v-model="rooms" class="mt-4" />
          <p v-if="keptRooms.length" class="mt-2 text-sm text-muted-foreground">Kept {{ keptRooms.join(', ') }}: someone already asked to book {{ keptRooms.length === 1 ? 'it' : 'them' }}.</p>
        </template>

        <div class="mt-6 flex items-center gap-3">
          <Button type="submit" variant="pill" :loading="saving">Save changes</Button>
          <span v-if="dirty && !saving" class="text-sm text-muted-foreground">Unsaved changes</span>
          <span v-else-if="savedAt && !saving" class="inline-flex items-center gap-1 text-sm text-wd-green-700"><Check class="size-4" aria-hidden="true" /> Saved</span>
        </div>
      </form>
    </template>
  </div>
</template>
