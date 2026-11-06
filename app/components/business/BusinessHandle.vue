<script setup lang="ts">
/**
 * Change a page's handle (/@handle), e.g. to match its Instagram. Owners only
 * (business.renameHandle); the old handle keeps redirecting to the new one.
 */
import { AtSign } from 'lucide-vue-next'
import { handleFromInstagram, parseInstagramHandle } from '#shared/utils/instagram'
import { isValidHandle } from '#shared/utils/handle'
import { RenameHandleSchema } from '#shared/validation'

const props = defineProps({
  username: { type: String, required: true },
  /** The page's Instagram link or handle, to offer the same handle. */
  instagram: { type: String, default: '' },
})
const emit = defineEmits<{ renamed: [username: string] }>()

const { $trpc } = useNuxtApp()
const host = useRequestURL().host
const form = reactive({ handle: props.username })
watch(() => props.username, (u) => { form.handle = u })
const { errors, validate, fieldAttrs } = useFormValidation(RenameHandleSchema, form)
const saving = ref(false)
const error = ref<string | null>(null)

// The Instagram handle, when it's a valid handle and not the current one.
const fromInstagram = computed(() => {
  const ig = parseInstagramHandle(props.instagram)
  const h = ig ? handleFromInstagram(ig) : null
  return h && h !== props.username && isValidHandle(h) ? h : null
})
const wanted = computed(() => form.handle.trim().replace(/^@/, '').toLowerCase())

async function submit() {
  const result = validate()
  if (!result.success) return
  if (result.data.handle === props.username) return
  saving.value = true
  error.value = null
  try {
    const r = await $trpc.business.renameHandle.mutate({ username: props.username, handle: result.data.handle })
    emit('renamed', r.username)
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t change the handle.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
    <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Handle</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      Your page address. Keep it the same as your Instagram so people find you. Links to the old one keep working.
    </p>
    <AdminState v-if="error" kind="error" :message="error" class="mt-3" />
    <form class="mt-4 flex flex-wrap items-start gap-2" novalidate @submit.prevent="submit">
      <Field id="edit-handle" label="Handle" :error="errors.handle" :hint="`${host}/@${wanted || '…'}`" class="min-w-[12rem] flex-1 max-w-sm">
        <div class="relative">
          <AtSign class="size-4 absolute left-3.5 top-3.5 text-muted-foreground" aria-hidden="true" />
          <Input v-model="form.handle" class="pl-10" autocapitalize="off" autocomplete="off" spellcheck="false" v-bind="fieldAttrs('handle', 'edit-handle-error')" />
        </div>
      </Field>
      <Button type="submit" variant="outline-pill" size="pill-sm" class="mt-7" :loading="saving" :disabled="wanted === username">Change handle</Button>
    </form>
    <p v-if="fromInstagram && wanted !== fromInstagram" class="mt-2 text-sm">
      <Button type="button" variant="link" class="h-auto p-0" @click="form.handle = fromInstagram">Use @{{ fromInstagram }}</Button>
      <span class="text-muted-foreground"> — same as your Instagram</span>
    </p>
  </section>
</template>
