<script setup lang="ts">
/**
 * /privacy-policy — GDPR privacy policy. PLACEHOLDER.
 * Needs real content + legal review before launch (covers Stripe,
 * analytics, cookies, hosting, user rights, data retention).
 */
definePageMeta({ layout: false })
useHead({
  title: 'WeDance — Privacy Policy',
  meta: [{ name: 'robots', content: 'noindex' }],
})

const willCover = [
  'Who the controller is (see Imprint) and how to reach them.',
  'What data we collect (account, tickets, payments, plan) and why.',
  'Payment processing via Stripe (data shared, their role).',
  'Hosting (Vercel) and any analytics — with cookie/consent basis.',
  'Legal bases (GDPR Art. 6), retention periods, and third parties.',
  'Your rights: access, rectification, erasure, portability, complaint.',
]
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>
    <section class="max-w-3xl mx-auto px-4 py-12">
      <div class="text-sm tracking-widest uppercase mb-3 text-secondary">Legal</div>
      <h1 class="text-4xl sm:text-5xl leading-tight text-foreground">Privacy Policy</h1>

      <div class="mt-6 rounded-xl p-4 text-sm text-muted-foreground font-sans" style="background:color-mix(in srgb, var(--wd-red-600) 6.3%, transparent); border:1px solid color-mix(in srgb, var(--wd-red-600) 20%, transparent);">
        ⚠️ Draft. The full privacy policy is pending real legal content + legal review. Required under GDPR before collecting any personal data or selling tickets.
      </div>

      <p class="mt-6 text-sm text-muted-foreground font-sans">The published policy will cover:</p>
      <ul class="mt-3 grid gap-2 text-sm text-foreground font-sans">
        <li v-for="item in willCover" :key="item" class="flex items-start gap-2">
          <span class="text-primary">·</span> {{ item }}
        </li>
      </ul>

      <h2 class="mt-10 text-2xl leading-tight text-foreground">Analytics in use today</h2>
      <p class="mt-3 text-sm leading-relaxed text-muted-foreground font-sans">
        We use PostHog, hosted in the EU, for product analytics and session replay (form inputs are masked).
        Analytics receives an anonymous account id and non-identifying properties such as your city — never
        your name or email. For searches we record only the length of the query, not the text. Sign-ups,
        logins and similar conversions are also counted on our server. Our aggregate numbers are public on
        <NuxtLink to="/open" class="font-bold text-wd-red-800 hover:underline">Open metrics</NuxtLink>.
      </p>
    </section>
    </main>

    <SiteFooter />
  </div>
</template>
