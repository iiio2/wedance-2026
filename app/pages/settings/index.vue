<script setup lang="ts">
/**
 * /settings — the signed-in dancer manages their profile + account.
 *   - Profile: name, city, role, styles, bio, socials, photo URL, privacy.
 *   - Account: change password, delete account.
 *   - Connected apps: link to /settings/connections (assistants connected via MCP).
 * Protected: signed-out users are sent home. 2026 tropical style.
 */
import { Check, ExternalLink, AlertTriangle, ChevronRight, Plug } from 'lucide-vue-next'
import { ChangePasswordSchema, ProfileSettingsSchema, deleteAccountSchema, validateForm } from '#shared/validation'
import { DANCE_LEVELS, type DanceLevel } from '#shared/utils/styleLevelMix'
import { chilis } from '~/lib/levels'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Settings',
})

const {
  isSignedIn, isLoading, username,
  dancerName, city: meCity, danceStyles: meStyles, danceLevels: meLevels, role: meRole,
  bio: meBio, photo: mePhoto, instagram: meIg, youtube: meYt, website: meSite, profilePublic: mePublic,
  updateProfile, changePassword, deleteAccount,
} = useAuth()


const form = reactive({
  name: '', city: '', photo: '', bio: '',
  instagram: '', youtube: '', website: '',
  danceStyles: [] as string[],
  danceLevels: {} as Record<string, DanceLevel>,
  role: '' as '' | 'lead' | 'follow' | 'both',
  profilePublic: true,
})

const loading = ref(false)
const error = ref('')
const saved = ref(false)
const profileForm = reactive(useFormValidation(ProfileSettingsSchema, form))

// Change-password sub-form.
const pw = reactive({ current: '', next: '' })
const pwLoading = ref(false)
const pwError = ref('')
const pwSaved = ref(false)
const passwordForm = reactive(useFormValidation(ChangePasswordSchema, pw))

// Account deletion confirmation.
const showDeleteConfirm = ref(false)
const deleteLoading = ref(false)
const deleteError = ref('')
const deleteConfirmInput = ref('')

watch([isLoading, isSignedIn], ([loadingNow, signedIn]) => {
  if (!loadingNow && !signedIn) navigateTo('/')
}, { immediate: true })

function hydrate() {
  form.name = dancerName.value ?? ''
  form.city = meCity.value ?? ''
  form.photo = mePhoto.value ?? ''
  form.bio = meBio.value ?? ''
  form.instagram = meIg.value ?? ''
  form.youtube = meYt.value ?? ''
  form.website = meSite.value ?? ''
  form.danceStyles = meStyles.value ? [...meStyles.value] : []
  form.danceLevels = { ...(meLevels.value as Record<string, DanceLevel>) }
  const r = meRole.value
  form.role = (r === 'lead' || r === 'follow' || r === 'both') ? r : ''
  form.profilePublic = mePublic.value !== false
}
onMounted(hydrate)
watch([dancerName, meCity, meStyles, meLevels, meRole, meBio, mePhoto, meIg, meYt, meSite, mePublic], hydrate)

// Removing a style in the picker drops its level too.
watch(() => [...form.danceStyles], (styles) => {
  for (const s of Object.keys(form.danceLevels)) if (!styles.includes(s)) delete form.danceLevels[s]
})

// Tapping the active level clears it — a level is optional.
function setLevel(style: string, level: DanceLevel) {
  if (form.danceLevels[style] === level) delete form.danceLevels[style]
  else form.danceLevels[style] = level
}

async function save() {
  error.value = ''
  saved.value = false
  const result = profileForm.validate()
  if (!result.success) return
  loading.value = true
  try {
    await updateProfile(result.data)
    saved.value = true
  } catch (e: unknown) {
    error.value = (e as { message?: string })?.message || 'Could not save. Please try again.'
  } finally {
    loading.value = false
  }
}

async function submitPassword() {
  pwError.value = ''
  pwSaved.value = false
  const result = passwordForm.validate()
  if (!result.success) return
  pwLoading.value = true
  try {
    await changePassword({ currentPassword: result.data.current, newPassword: result.data.next })
    pwSaved.value = true
    pw.current = ''
    pw.next = ''
  } catch (e: unknown) {
    pwError.value = (e as { message?: string })?.message || 'Could not change password.'
  } finally {
    pwLoading.value = false
  }
}

async function submitDelete() {
  deleteError.value = ''
  const result = validateForm(deleteAccountSchema(dancerName.value), { confirmation: deleteConfirmInput.value })
  if (!result.success) {
    deleteError.value = result.error
    return
  }
  deleteLoading.value = true
  try {
    await deleteAccount()
    // On success, deleteAccount() calls signOut() which redirects to home via auth guard
    await navigateTo('/')
  } catch (e: unknown) {
    deleteError.value = (e as { message?: string })?.message || 'Could not delete account. Please try again or contact support.'
    deleteLoading.value = false
  }
}

</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <main class="max-w-lg mx-auto px-4 pt-12 pb-16 font-sans">
      <div class="flex items-baseline justify-between">
        <h1 class="text-4xl text-foreground font-display">Settings</h1>
        <NuxtLink
          v-if="username"
          :to="`/u/${username}`"
          class="inline-flex items-center gap-1 text-xs font-bold text-primary"
        >View public <ExternalLink class="w-3 h-3" aria-hidden="true" /></NuxtLink>
      </div>

      <!-- PROFILE -->
      <h2 class="mt-8 text-lg font-bold text-foreground font-display">Profile</h2>
      <form class="mt-4 space-y-6" novalidate @submit.prevent="save">
        <Field id="settings-name" label="Name" :error="profileForm.errors.name">
          <Input v-model="form.name" autocomplete="name" v-bind="profileForm.fieldAttrs('name', 'settings-name-error')" />
        </Field>

        <Field id="settings-city" label="City" optional>
          <CityCombobox v-model="form.city" placeholder="e.g. Munich" />
        </Field>

        <Field id="settings-bio" label="Bio" optional :error="profileForm.errors.bio">
          <Textarea v-model="form.bio" :rows="3" maxlength="500" :resize="false" placeholder="A line or two about you and your dancing." v-bind="profileForm.fieldAttrs('bio', 'settings-bio-error')" />
        </Field>

        <div class="flex flex-col gap-1.5">
          <span id="settings-role-label" class="text-sm font-bold text-foreground leading-snug">Role <span class="font-normal text-muted-foreground">(optional)</span></span>
          <div role="group" aria-labelledby="settings-role-label" class="flex gap-2">
            <ToggleChip
              v-for="opt in [{v:'lead',l:'Leader'},{v:'follow',l:'Follower'},{v:'both',l:'Both'}]"
              :key="opt.v"
              :pressed="form.role === opt.v"
              class="flex-1 h-11 text-sm"
              @click="form.role = (form.role === opt.v ? '' : (opt.v as any))"
            >{{ opt.l }}</ToggleChip>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="settings-dances" class="text-sm font-bold text-foreground leading-snug">Dances <span class="font-normal text-muted-foreground">(optional)</span></label>
          <DanceStylePicker id="settings-dances" v-model="form.danceStyles" label="Dances" />
          <div v-if="form.danceStyles.length" class="mt-3 grid gap-2">
            <p class="text-xs text-muted-foreground font-sans">
              Your level in each — organizers see it only as an anonymous mix of who's coming.
            </p>
            <div
              v-for="s in form.danceStyles"
              :key="s"
              role="group"
              :aria-label="`${s} level`"
              class="flex flex-wrap items-center gap-1.5"
            >
              <span class="w-24 text-xs font-bold uppercase tracking-wider text-foreground">{{ s }}</span>
              <ToggleChip
                v-for="lvl in DANCE_LEVELS"
                :key="lvl"
                variant="ink"
                :pressed="form.danceLevels[s] === lvl"
                class="px-2.5 py-1 text-xs"
                @click="setLevel(s, lvl)"
              >{{ chilis(lvl) }} {{ lvl }}</ToggleChip>
            </div>
          </div>
        </div>

        <!-- Socials -->
        <div class="grid gap-3">
          <Field id="settings-instagram" label="Instagram" optional hint="Your handle or a link." :error="profileForm.errors.instagram">
            <Input v-model="form.instagram" placeholder="@yourhandle" v-bind="profileForm.fieldAttrs('instagram', 'settings-instagram-error')" />
          </Field>
          <Field id="settings-youtube" label="YouTube" optional hint="Your handle or a link." :error="profileForm.errors.youtube">
            <Input v-model="form.youtube" placeholder="@yourchannel" v-bind="profileForm.fieldAttrs('youtube', 'settings-youtube-error')" />
          </Field>
          <Field id="settings-website" label="Website" optional :error="profileForm.errors.website">
            <Input v-model="form.website" type="url" inputmode="url" autocomplete="url" placeholder="yoursite.com" v-bind="profileForm.fieldAttrs('website', 'settings-website-error')" />
          </Field>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-sm font-bold text-foreground leading-snug">Photo <span class="font-normal text-muted-foreground">(optional)</span></span>
          <ImageUpload v-model="form.photo" />
        </div>

        <!-- Privacy -->
        <Checkbox v-model="form.profilePublic" class="items-start">
          <span class="text-muted-foreground">
            <span class="font-bold text-foreground">Public profile</span><br>
            When off, your <span class="italic">/u/{{ username }}</span> page is hidden from everyone but you.
          </span>
        </Checkbox>

        <p v-if="error" role="alert" class="text-sm font-bold text-primary">{{ error }}</p>
        <p v-if="saved" role="status" class="inline-flex items-center gap-1.5 text-sm font-bold text-wd-green-600"><Check class="w-4 h-4" aria-hidden="true" /> Saved</p>

        <Button type="submit" variant="cta" size="lg" class="w-full h-12" :loading="loading">
          {{ loading ? 'Saving…' : 'Save changes' }}
        </Button>
      </form>

      <!-- CONNECTED APPS -->
      <h2 class="mt-12 text-lg font-bold text-foreground font-display">Connected apps</h2>
      <NuxtLink
        to="/settings/connections"
        class="mt-4 flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-wd-card hover:border-primary/40 transition-colors duration-wd-quick"
      >
        <Plug class="w-5 h-5 shrink-0 text-secondary" aria-hidden="true" />
        <span class="flex-1 text-sm">
          <span class="block font-bold text-foreground">Claude, ChatGPT and other assistants</span>
          <span class="block text-xs text-muted-foreground">See what they may do for you and disconnect them.</span>
        </span>
        <ChevronRight class="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </NuxtLink>

      <!-- ACCOUNT -->
      <h2 class="mt-12 text-lg font-bold text-foreground font-display">Change password</h2>
      <form class="mt-4 space-y-4" novalidate @submit.prevent="submitPassword">
        <Field id="settings-pw-current" label="Current password" :error="passwordForm.errors.current">
          <Input v-model="pw.current" type="password" autocomplete="current-password" v-bind="passwordForm.fieldAttrs('current', 'settings-pw-current-error')" />
        </Field>
        <Field id="settings-pw-next" label="New password" :error="passwordForm.errors.next">
          <Input v-model="pw.next" type="password" autocomplete="new-password" placeholder="At least 8 characters" v-bind="passwordForm.fieldAttrs('next', 'settings-pw-next-error')" />
        </Field>
        <p v-if="pwError" role="alert" class="text-sm font-bold text-primary">{{ pwError }}</p>
        <p v-if="pwSaved" role="status" class="inline-flex items-center gap-1.5 text-sm font-bold text-wd-green-600"><Check class="w-4 h-4" aria-hidden="true" /> Password changed</p>
        <Button
          type="submit"
          variant="outline-pill"
          size="lg"
          class="w-full"
          :loading="pwLoading"
          :disabled="!pw.current || !pw.next"
        >{{ pwLoading ? 'Changing…' : 'Change password' }}</Button>
      </form>

      <!-- DANGER ZONE -->
      <h2 class="mt-12 text-lg font-bold text-primary font-display">Danger Zone</h2>
      <div class="mt-4 p-4 rounded-xl bg-wd-red-50 border border-destructive/40">
        <div class="flex gap-3">
          <AlertTriangle class="w-5 h-5 shrink-0 mt-0.5 text-primary" aria-hidden="true" />
          <div class="flex-1 min-w-0">
            <h3 class="font-bold text-sm mb-2 text-primary">Permanently delete your account</h3>
            <p class="text-xs mb-4 text-wd-red-900">
              This action cannot be undone. Your profile will be removed, your account deleted, and you will be signed out immediately.
              <br><br>
              <strong>What happens to your data:</strong>
              <br>• Your profile (name, email, photo, bio) is permanently deleted
              <br>• Election votes are permanently deleted
              <br>• Other voting records (video/city battles) are anonymized (votes kept, voter identity removed)
              <br>• Festival signups are anonymized (kept for attendance, emails cleared)
              <br>• Your submitted videos are anonymized (emails cleared)
              <br>• Your reviews and recommendations are permanently deleted
              <br>• Hangouts you created and RSVPs are permanently deleted
              <br>• Gigs you posted are anonymized (record kept, your identity removed)
            </p>

            <Button
              v-if="!showDeleteConfirm"
              variant="destructive"
              size="lg"
              class="w-full px-4 sm:px-8 rounded-full font-bold uppercase tracking-wider"
              @click="showDeleteConfirm = true"
            >Delete my account</Button>

            <form v-else class="space-y-4" novalidate @submit.prevent="submitDelete">
              <Field id="settings-delete-confirm" label="Confirm by typing your name" :error="deleteError || undefined">
                <Input v-model="deleteConfirmInput" :placeholder="`Type: ${dancerName}`" autocomplete="off" />
              </Field>
              <div class="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="outline-pill"
                  size="lg"
                  class="px-4 sm:px-8 sm:flex-1"
                  :disabled="deleteLoading"
                  @click="showDeleteConfirm = false; deleteConfirmInput = ''; deleteError = ''"
                >Cancel</Button>
                <Button
                  type="submit"
                  variant="destructive"
                  size="lg"
                  class="px-4 sm:px-8 sm:flex-1 rounded-full font-bold uppercase tracking-wider"
                  :loading="deleteLoading"
                  :disabled="deleteConfirmInput !== dancerName"
                >{{ deleteLoading ? 'Deleting…' : 'Permanently delete' }}</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>
