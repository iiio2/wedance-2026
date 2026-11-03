<script setup lang="ts">
import { AvatarImage } from "reka-ui"
import { sizedImage, IMG } from "#shared/utils/image"

// Avatars are small: ask Cloudinary for a thumbnail, never the original upload.
const props = defineProps<{ src: string }>()
</script>

<template>
  <AvatarImage :src="sizedImage(props.src, IMG.avatar)" class="h-full w-full object-cover">
    <slot />
  </AvatarImage>
</template>
