<script setup lang="ts">
import { designNav } from '~/lib/design-nav'

/** Layout for /design — the WeDance design system docs (see DocsShell). */
</script>

<template>
  <DocsShell :nav="designNav" home="/design" label="Design system">
    <slot />
  </DocsShell>
</template>
