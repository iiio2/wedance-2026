<script setup lang="ts">
/**
 * An image on a profile's website (RAZ-412): upload one, or paste a link. Paths
 * like /images/x.jpg are the site's own files, previewed from its address.
 */
import { ImagePlus, X } from 'lucide-vue-next'

const props = defineProps<{ label: string; domain?: string }>()
const model = defineModel<string | undefined>()
const uploading = ref(false)
const error = ref<string | null>(null)

const preview = computed(() => !model.value ? '' : model.value.startsWith('/') && props.domain ? `${props.domain.replace(/\/$/, '')}${model.value}` : model.value)

async function upload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  error.value = null
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await $fetch<{ url: string }>('/api/media/image?folder=sites', { method: 'POST', body: form })
    model.value = res.url
  } catch (err: any) { error.value = err?.data?.statusMessage || 'Couldn’t upload it.' } finally { uploading.value = false }
}
</script>

<template>
  <Field :label="label" :error="error ?? undefined">
    <template #default>
      <div class="flex items-start gap-3">
        <img v-if="preview" :src="preview" alt="" class="h-20 w-28 shrink-0 rounded-lg border object-cover">
        <div class="min-w-0 flex-1 space-y-2">
          <Input :model-value="model ?? ''" placeholder="https://… or upload" @update:model-value="(v: string | number) => model = String(v) || undefined" />
          <div class="flex gap-2">
            <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold has-[:focus-visible]:shadow-wd-focus">
              <ImagePlus class="size-3.5" aria-hidden="true" /> {{ uploading ? 'Uploading…' : 'Upload' }}
              <input type="file" accept="image/*" class="sr-only" :disabled="uploading" @change="upload">
            </label>
            <Button v-if="model" type="button" variant="ghost" size="sm" @click="model = undefined"><X /> Remove</Button>
          </div>
        </div>
      </div>
    </template>
  </Field>
</template>
