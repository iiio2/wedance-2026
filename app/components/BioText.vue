<script setup lang="ts">
/**
 * BioText — renders a bio string preserving newlines and converting
 * @mentions into clickable Instagram links. XSS-safe: text segments use
 * Vue's auto-escaping {{ }}, hrefs are built from a strict handle regex.
 */
const props = defineProps<{ text: string }>()

type Segment = { type: 'text'; value: string } | { type: 'mention'; handle: string }

const segments = computed<Segment[]>(() => {
  const parts: Segment[] = []
  // Instagram handles: 1–30 chars of letters, digits, dots, underscores
  const regex = /@([a-zA-Z0-9._]{1,30})/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(props.text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: props.text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'mention', handle: match[1] })
    lastIndex = regex.lastIndex
  }
  if (lastIndex < props.text.length) {
    parts.push({ type: 'text', value: props.text.slice(lastIndex) })
  }
  return parts
})
</script>

<template>
  <p style="white-space:pre-line;">
    <template v-for="(seg, i) in segments" :key="i">
      <span v-if="seg.type === 'text'">{{ seg.value }}</span>
      <a
        v-else
        :href="`https://instagram.com/${seg.handle}`"
        target="_blank"
        rel="noopener"
        class="font-bold text-primary hover:underline"
      >@{{ seg.handle }}</a>
    </template>
  </p>
</template>
