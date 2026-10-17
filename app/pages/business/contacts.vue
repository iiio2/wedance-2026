<script setup lang="ts">
/** /business/contacts — the sidebar's Contacts: opens the chosen profile's contacts. */
definePageMeta({ layout: 'business' })
useHead({ title: 'Contacts | Business | WeDance' })
</script>

<template>
  <BusinessProfileChooser section="contacts" eyebrow="Contacts" title="Whose contacts?" description="People who signed up on your website. Pick the profile." />
</template>
