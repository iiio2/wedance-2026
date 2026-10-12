<script setup lang="ts">
/**
 * Alias of the `docs` layout, kept so pages (and stacked branches) that still
 * say `definePageMeta({ layout: 'design' })` render inside the shared /docs shell.
 * New pages use `layout: 'docs'`.
 */
</script>

<template>
  <DocsShell>
    <slot />
  </DocsShell>
</template>
