<script setup lang="ts">
import { architectureNav } from '~/lib/architecture-nav'

/**
 * Layout for /architecture — generated architecture docs. Same shell (and the
 * same noindex treatment) as /design; see DocsShell.
 */
</script>

<template>
  <DocsShell
    :nav="architectureNav"
    home="/architecture"
    label="Architecture"
    :cross-link="{ to: '/design', label: 'Design system' }"
  >
    <slot />
  </DocsShell>
</template>
