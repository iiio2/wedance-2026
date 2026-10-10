<script setup lang="ts">
import { Upload, X, Loader2 } from 'lucide-vue-next'

const model = defineModel<string>({ default: '' })

const uploading = ref(false)
const dragOver = ref(false)
const errorMsg = ref('')

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
    const res = await fetch('/api/media/image', { method: 'POST', body: formData })
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
      <button
        type="button"
        class="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center bg-wd-red-600"
        style="color:white;"
        @click="remove"
      >
        <X class="w-3.5 h-3.5" />
      </button>
    </div>

    <!-- Drop zone -->
    <div
      v-if="!model"
      class="relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 cursor-pointer transition-colors"
      :style="dragOver
        ? 'border-color:var(--wd-red-600); background:color-mix(in srgb, var(--wd-red-600) 3.1%, transparent);'
        : 'border-color:color-mix(in srgb, var(--wd-brown-900) 20%, transparent); background:white;'"
      @dragover.prevent="dragOver = true"
      @dragleave="dragOver = false"
      @drop.prevent="onDrop"
      @click="($refs.fileInput as HTMLInputElement).click()"
    >
      <Loader2 v-if="uploading" class="w-6 h-6 animate-spin text-secondary" />
      <Upload v-else class="w-6 h-6 text-secondary" />
      <span class="text-sm text-muted-foreground">
        {{ uploading ? 'Uploading...' : 'Drop a photo here or click to choose' }}
      </span>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onFileInput"
      >
    </div>

    <!-- Upload / replace button when photo exists -->
    <button
      v-if="model && !uploading"
      type="button"
      class="text-xs font-bold text-primary"
      @click="($refs.fileInput2 as HTMLInputElement).click()"
    >
      Replace photo
      <input
        ref="fileInput2"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onFileInput"
      >
    </button>

    <p v-if="errorMsg" class="text-xs font-bold text-primary">{{ errorMsg }}</p>
  </div>
</template>
