<script setup lang="ts">
import { Upload, X, Loader2 } from 'lucide-vue-next'

const model = defineModel<string>({ default: '' })
// Cloudinary sub-folder; the server only accepts known values.
const props = withDefaults(defineProps<{ folder?: 'avatars' | 'profiles' | 'events' }>(), { folder: 'avatars' })

const uploading = ref(false)
const dragOver = ref(false)
const errorMsg = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

async function uploadFile(file: File) {
  if (!file.type.startsWith('image/')) {
    errorMsg.value = 'Please select an image file.'
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    errorMsg.value = 'Image must be under 10 MB.'
    return
  }

  errorMsg.value = ''
  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/media/image?folder=${props.folder}`, { method: 'POST', body: formData })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new Error(body?.statusMessage || 'Upload failed.')
    }
    const { url } = await res.json()
    model.value = url
  } catch (e: unknown) {
    errorMsg.value = (e as Error).message || 'Upload failed.'
  } finally {
    uploading.value = false
  }
}

function onFileInput(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) uploadFile(input.files[0])
  input.value = ''
}

function onDrop(event: DragEvent) {
  dragOver.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) uploadFile(file)
}

function remove() {
  model.value = ''
}
</script>

<template>
  <div class="space-y-2">
    <!-- Preview -->
    <div v-if="model" class="relative inline-block">
      <img
        :src="model"
        alt="Profile photo"
        class="w-28 h-28 rounded-xl object-cover"
      >
      <Button
        type="button"
        variant="pill"
        size="icon-sm"
        class="absolute -top-2 -right-2 size-6 p-0 shadow-none [&_svg]:size-3.5"
        aria-label="Remove photo"
        @click="remove"
      >
        <X aria-hidden="true" />
      </Button>
    </div>

    <!-- Drop zone — a real button so it is reachable by keyboard -->
    <button
      v-if="!model"
      type="button"
      class="relative w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      :class="dragOver ? 'border-primary bg-primary/3' : 'border-input bg-card'"
      :disabled="uploading"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <Loader2 v-if="uploading" class="w-6 h-6 animate-spin text-secondary" aria-hidden="true" />
      <Upload v-else class="w-6 h-6 text-secondary" aria-hidden="true" />
      <span class="text-sm text-muted-foreground">
        {{ uploading ? 'Uploading...' : 'Drop a photo here or click to choose' }}
      </span>
    </button>

    <!-- Upload / replace button when photo exists -->
    <Button
      v-if="model && !uploading"
      variant="link"
      class="h-auto p-0 text-xs font-bold text-primary"
      @click="fileInput?.click()"
    >
      Replace photo
    </Button>

    <!-- One hidden file input for both the drop zone and "Replace photo" -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="hidden"
      tabindex="-1"
      aria-hidden="true"
      @change="onFileInput"
    >

    <p v-if="errorMsg" role="alert" class="text-xs font-bold text-primary">{{ errorMsg }}</p>
  </div>
</template>
