<script setup lang="ts">
/**
 * /venues — browse bookable venues (any city). Reached from the "Venue" service
 * on /for-events. Each links to its /@<handle> page to request a space.
 */
import { ArrowLeft } from 'lucide-vue-next'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Venues',
  meta: [{ name: 'description', content: 'Book a space for your social, class, or private event — dance-ready venues across the WeDance network.' }],
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <main>

    <section class="max-w-3xl mx-auto px-4 pt-12 pb-4">
      <NuxtLink to="/for-events" class="inline-flex items-center gap-1 text-xs font-bold mb-4 text-secondary font-sans">
        <ArrowLeft class="w-3 h-3" /> For your event
      </NuxtLink>
      <div class="text-sm tracking-widest uppercase mb-2 text-secondary">Venues</div>
      <h1 class="text-4xl sm:text-5xl leading-[0.98] text-foreground">
        Book a <em class="italic text-primary">space.</em>
      </h1>
      <p class="mt-4 text-base leading-relaxed max-w-xl text-muted-foreground font-sans">
        Organizing a social, class, or private event? Browse dance-ready venues across the network and request a date directly.
      </p>
    </section>

    <ClientOnly>
      <section class="max-w-3xl mx-auto px-4 pb-16">
        <BookableVenuesSection hide-heading />
      </section>
    </ClientOnly>

    </main>


    <SiteFooter />
  </div>
</template>
