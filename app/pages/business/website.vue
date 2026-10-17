<script setup lang="ts">
/** /business/website — the sidebar's Website: opens the chosen profile's site editor. */
definePageMeta({ layout: 'business' })
useHead({ title: 'Website | Business | WeDance' })
</script>

<template>
  <BusinessProfileChooser section="website" eyebrow="Website" title="Which website?" description="Your own website, run from WeDance: its words, sections and languages. Pick the profile it belongs to." />
</template>
