<script setup lang="ts">
/**
 * /settings — the signed-in dancer manages their profile + account.
 *   - Profile: name, city, role, styles, bio, socials, photo URL, privacy.
 *   - Account: change password, delete account.
 * Protected: signed-out users are sent home. 2026 tropical style.
 */
import { Check, ExternalLink, AlertTriangle } from 'lucide-vue-next'
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

const DANCE_STYLES = ['Salsa', 'Bachata', 'Kizomba', 'Zouk', 'Timba', 'Semba', 'Afro-Cuban', 'Reggaeton', 'Cha-Cha']

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

function toggleStyle(style: string) {
  const i = form.danceStyles.indexOf(style)
  if (i >= 0) {
    form.danceStyles.splice(i, 1)
    delete form.danceLevels[style]
  } else form.danceStyles.push(style)
}

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

const inputStyle = 'background:white; border:1px solid #3b1f0d33; color:#3b1f0d;'
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <section class="max-w-lg mx-auto px-4 pt-12 pb-16 font-sans">
      <div class="flex items-baseline justify-between">
        <h1 class="text-4xl text-foreground font-display">Settings</h1>
        <NuxtLink
          v-if="username"
          :to="`/u/${username}`"
          class="inline-flex items-center gap-1 text-xs font-bold text-primary"
        >View public <ExternalLink class="w-3 h-3" /></NuxtLink>
      </div>

      <!-- PROFILE -->
      <h2 class="mt-8 text-lg font-bold text-foreground font-display">Profile</h2>
      <div class="mt-4 space-y-6">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-secondary">Name</label>
          <input v-model="form.name" type="text" class="w-full h-11 rounded-xl px-3.5 text-sm outline-none" :style="inputStyle" v-bind="profileForm.fieldAttrs('name', 'settings-name-error')">
          <FieldError id="settings-name-error" :message="profileForm.errors.name" />
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-secondary">City</label>
          <input v-model="form.city" type="text" placeholder="e.g. Munich" class="w-full h-11 rounded-xl px-3.5 text-sm outline-none" :style="inputStyle">
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-secondary">Bio</label>
          <textarea v-model="form.bio" rows="3" maxlength="500" placeholder="A line or two about you and your dancing." class="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none" :style="inputStyle" v-bind="profileForm.fieldAttrs('bio', 'settings-bio-error')" />
          <FieldError id="settings-bio-error" :message="profileForm.errors.bio" />
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-secondary">Role</label>
          <div class="flex gap-2">
            <button
              v-for="opt in [{v:'lead',l:'Leader'},{v:'follow',l:'Follower'},{v:'both',l:'Both'}]"
              :key="opt.v"
              type="button"
              class="flex-1 h-11 rounded-xl text-sm font-bold transition-all"
              :style="form.role === opt.v ? 'background:var(--wd-red-600); color:white; box-shadow:0 3px 0 -1px var(--wd-red-800);' : 'background:white; color:var(--wd-brown-700); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);'"
              @click="form.role = (form.role === opt.v ? '' : (opt.v as any))"
            >{{ opt.l }}</button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-secondary">Dances</label>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="s in DANCE_STYLES"
              :key="s"
              type="button"
              class="px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
              :style="form.danceStyles.includes(s) ? 'background:var(--wd-red-600); color:white;' : 'background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent); color:var(--wd-red-600);'"
              @click="toggleStyle(s)"
            >{{ s }}</button>
          </div>
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
              <button
                v-for="lvl in DANCE_LEVELS"
                :key="lvl"
                type="button"
                :aria-pressed="form.danceLevels[s] === lvl"
                class="px-2.5 py-1 rounded-full text-xs font-bold transition-all"
                :style="form.danceLevels[s] === lvl ? 'background:var(--wd-brown-900); color:white;' : 'background:white; color:var(--wd-brown-700); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);'"
                @click="setLevel(s, lvl)"
              >{{ chilis(lvl) }} {{ lvl }}</button>
            </div>
          </div>
        </div>

        <!-- Socials -->
        <div class="grid gap-3">
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-secondary">Instagram <span class="normal-case font-normal">(handle or URL)</span></label>
            <input v-model="form.instagram" type="text" placeholder="@yourhandle" class="w-full h-11 rounded-xl px-3.5 text-sm outline-none" :style="inputStyle" v-bind="profileForm.fieldAttrs('instagram', 'settings-instagram-error')">
            <FieldError id="settings-instagram-error" :message="profileForm.errors.instagram" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-secondary">YouTube <span class="normal-case font-normal">(handle or URL)</span></label>
            <input v-model="form.youtube" type="text" placeholder="@yourchannel" class="w-full h-11 rounded-xl px-3.5 text-sm outline-none" :style="inputStyle" v-bind="profileForm.fieldAttrs('youtube', 'settings-youtube-error')">
            <FieldError id="settings-youtube-error" :message="profileForm.errors.youtube" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-secondary">Website</label>
            <input v-model="form.website" type="text" placeholder="yoursite.com" class="w-full h-11 rounded-xl px-3.5 text-sm outline-none" :style="inputStyle" v-bind="profileForm.fieldAttrs('website', 'settings-website-error')">
            <FieldError id="settings-website-error" :message="profileForm.errors.website" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-secondary">Photo <span class="normal-case font-normal">(optional)</span></label>
          <ImageUpload v-model="form.photo" />
        </div>

        <!-- Privacy -->
        <label class="flex items-start gap-3 cursor-pointer select-none">
          <input v-model="form.profilePublic" type="checkbox" class="mt-1 w-4 h-4 accent-wd-red-600">
          <span class="text-sm text-muted-foreground">
            <span class="font-bold text-foreground">Public profile</span><br>
            When off, your <span class="italic">/u/{{ username }}</span> page is hidden from everyone but you.
          </span>
        </label>

        <p v-if="error" class="text-sm font-bold text-primary">{{ error }}</p>
        <p v-if="saved" class="inline-flex items-center gap-1.5 text-sm font-bold text-wd-green-600"><Check class="w-4 h-4" /> Saved</p>

        <button
          type="button" :disabled="loading"
          class="w-full h-12 rounded-full text-white text-sm font-bold uppercase tracking-wider disabled:opacity-60"
          style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500)); box-shadow:0 3px 0 -1px var(--wd-red-800);"
          @click="save"
        >{{ loading ? 'Saving…' : 'Save changes' }}</button>
      </div>

      <!-- ACCOUNT -->
      <h2 class="mt-12 text-lg font-bold text-foreground font-display">Change password</h2>
      <div class="mt-4 space-y-4">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-secondary">Current password</label>
          <input v-model="pw.current" type="password" autocomplete="current-password" class="w-full h-11 rounded-xl px-3.5 text-sm outline-none" :style="inputStyle" v-bind="passwordForm.fieldAttrs('current', 'settings-pw-current-error')">
          <FieldError id="settings-pw-current-error" :message="passwordForm.errors.current" />
        </div>
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-secondary">New password</label>
          <input v-model="pw.next" type="password" autocomplete="new-password" placeholder="At least 8 characters" class="w-full h-11 rounded-xl px-3.5 text-sm outline-none" :style="inputStyle" v-bind="passwordForm.fieldAttrs('next', 'settings-pw-next-error')">
          <FieldError id="settings-pw-next-error" :message="passwordForm.errors.next" />
        </div>
        <p v-if="pwError" class="text-sm font-bold text-primary">{{ pwError }}</p>
        <p v-if="pwSaved" class="inline-flex items-center gap-1.5 text-sm font-bold text-wd-green-600"><Check class="w-4 h-4" /> Password changed</p>
        <button
          type="button" :disabled="pwLoading || !pw.current || !pw.next"
          class="w-full h-11 rounded-full text-sm font-bold uppercase tracking-wider disabled:opacity-50 text-primary"
          style="background:white; border:1px solid color-mix(in srgb, var(--wd-red-600) 33.3%, transparent);"
          @click="submitPassword"
        >{{ pwLoading ? 'Changing…' : 'Change password' }}</button>
      </div>

      <!-- DANGER ZONE -->
      <h2 class="mt-12 text-lg font-bold text-primary font-display">Danger Zone</h2>
      <div class="mt-4 p-4 rounded-xl" style="background:#fecaca33; border:1px solid color-mix(in srgb, var(--wd-red-600) 40%, transparent);">
        <div class="flex gap-3">
          <AlertTriangle class="w-5 h-5 flex-shrink-0 mt-0.5 text-primary" />
          <div class="flex-1">
            <h3 class="font-bold text-sm mb-2 text-primary">Permanently delete your account</h3>
            <p class="text-xs mb-4" style="color:#7f1d1d;">
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

            <button
              v-if="!showDeleteConfirm"
              type="button"
              class="w-full h-11 rounded-full text-sm font-bold uppercase tracking-wider bg-wd-red-600"
              style="color:white; box-shadow:0 3px 0 -1px var(--wd-red-800);"
              @click="showDeleteConfirm = true"
            >Delete my account</button>

            <div v-else class="space-y-4">
              <div>
                <label class="block text-xs font-bold uppercase tracking-wider mb-1.5 text-primary">Confirm by typing your name</label>
                <input
                  v-model="deleteConfirmInput"
                  type="text"
                  :placeholder="`Type: ${dancerName}`"
                  class="w-full h-11 rounded-xl px-3.5 text-sm outline-none"
                  :style="inputStyle"
                >
              </div>
              <p v-if="deleteError" class="text-sm font-bold text-primary">{{ deleteError }}</p>
              <div class="flex gap-2">
                <button
                  type="button"
                  :disabled="deleteLoading"
                  class="flex-1 h-11 rounded-full text-sm font-bold uppercase tracking-wider disabled:opacity-50 text-primary"
                  style="background:white; border:1px solid color-mix(in srgb, var(--wd-red-600) 33.3%, transparent);"
                  @click="showDeleteConfirm = false; deleteConfirmInput = ''; deleteError = ''"
                >Cancel</button>
                <button
                  type="button"
                  :disabled="deleteLoading || deleteConfirmInput !== dancerName"
                  class="flex-1 h-11 rounded-full text-sm font-bold uppercase tracking-wider disabled:opacity-50 bg-wd-red-600"
                  style="color:white; box-shadow:0 3px 0 -1px var(--wd-red-800);"
                  @click="submitDelete"
                >{{ deleteLoading ? 'Deleting…' : 'Permanently delete' }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <SiteFooter />
  </div>
</template>
