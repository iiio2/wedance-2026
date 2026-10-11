<script setup lang="ts">
/**
 * /terms — terms of sale for ticketing. PLACEHOLDER.
 * Needs real content + legal review before ticket sales go live
 * (parties: WeDance vs organizer, payment, delivery, cancellation,
 * withdrawal-right exemption for dated events §312g BGB).
 */
definePageMeta({ layout: false })
useHead({
  title: 'WeDance — Terms',
  meta: [{ name: 'robots', content: 'noindex' }],
})

const willCover = [
  'Who the contract is between (WeDance as platform vs. the organizer).',
  'Ticket purchase, pricing incl. VAT, and payment terms.',
  'Delivery of tickets and proof of purchase.',
  'Cancellation, refunds, and event changes.',
  'Withdrawal right — and the §312g BGB exemption for dated events.',
  'Liability, house rules, and applicable law.',
]
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>
    <section class="max-w-3xl mx-auto px-4 py-12">
      <div class="text-sm tracking-widest uppercase mb-3 text-secondary">Legal</div>
      <h1 class="text-4xl sm:text-5xl leading-tight text-foreground">Terms</h1>

      <div class="mt-6 rounded-xl p-4 text-sm text-muted-foreground font-sans" style="background:color-mix(in srgb, var(--wd-red-600) 6.3%, transparent); border:1px solid color-mix(in srgb, var(--wd-red-600) 20%, transparent);">
        ⚠️ Draft. Terms of sale are pending real content + legal review. Required before ticket sales go live — including consumer info and the withdrawal-right exemption for dated events.
      </div>

      <p class="mt-6 text-sm text-muted-foreground font-sans">The published terms will cover:</p>
      <ul class="mt-3 grid gap-2 text-sm text-foreground font-sans">
        <li v-for="item in willCover" :key="item" class="flex items-start gap-2">
          <span class="text-primary">·</span> {{ item }}
        </li>
      </ul>
    </section>
    </main>

    <SiteFooter />
  </div>
</template>
