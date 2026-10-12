<script setup lang="ts">
/**
 * /business/new — create a new artist / venue / organizer profile. The creator owns
 * it straight away and lands in the editor.
 */
definePageMeta({ layout: 'business' })
useHead({ title: 'Create a profile | WeDance' })

const { $trpc } = useNuxtApp()
const host = useRequestURL().host

const types = [
  { value: 'artist', label: 'Artist', hint: 'Teacher, performer, DJ, musician' },
  { value: 'venue', label: 'Venue', hint: 'Club, bar, studio, outdoor spot' },
  { value: 'organizer', label: 'Organizer', hint: 'Parties, festivals, workshops' },
] as const
const form = reactive({ type: 'artist' as 'artist' | 'venue' | 'organizer', name: '', city: '', handle: '' })
const nameError = ref<string | undefined>()
const saving = ref(false)
const error = ref<string | null>(null)

async function submit() {
  nameError.value = form.name.trim() ? undefined : 'Add a name.'
  if (nameError.value) return
  saving.value = true
  error.value = null
  try {
    const { username } = await $trpc.business.create.mutate({
      type: form.type,
      name: form.name,
      city: form.city || undefined,
      handle: form.handle.trim() || undefined,
    })
    await navigateTo(`/business/profiles/${username}`)
  } catch (e: any) {
    error.value = e?.message || 'Could not create the profile.'
  } finally {
    saving.value = false
  }
}
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

      <div class="mt-5">
        <Button type="submit" variant="pill" :loading="saving">Create profile</Button>
      </div>
    </form>
  </div>
</template>
