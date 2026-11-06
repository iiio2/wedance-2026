<script setup lang="ts">
/**
 * /imprint — legal notice under §5 DDG and §18 (2) MStV.
 * Operator details come from shared/legal.ts (update there when the UG exists).
 */
import { OPERATOR } from '#shared/legal'

definePageMeta({ layout: false })
useHead({
  title: 'WeDance — Imprint',
  meta: [{ name: 'description', content: 'Legal notice (Impressum) for WeDance.' }],
})

const rows: [string, string][] = [
  ['Operator', `${OPERATOR.name}, trading as ${OPERATOR.tradeName}`],
  ['Legal form', `${OPERATOR.legalForm}. Small business under §19 UStG — no VAT is charged or shown.`],
  ['Address', `${OPERATOR.street}\n${OPERATOR.postalCode} ${OPERATOR.city}\n${OPERATOR.country}`],
  ['Responsible for content (§18 (2) MStV)', `${OPERATOR.name}, address as above`],
]
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>
      <section class="max-w-3xl mx-auto px-4 py-12">
        <div class="text-sm tracking-widest uppercase mb-3 text-secondary">Legal</div>
        <h1 class="text-4xl sm:text-5xl leading-tight text-foreground">Imprint</h1>
        <p class="mt-2 text-sm text-muted-foreground font-sans">Impressum — information under §5 DDG</p>

        <dl class="mt-8 grid sm:grid-cols-[220px_1fr] gap-x-6 gap-y-4 text-sm text-foreground font-sans">
          <template v-for="[k, v] in rows" :key="k">
            <dt class="font-bold text-secondary">{{ k }}</dt>
            <dd class="whitespace-pre-line">{{ v }}</dd>
          </template>
          <dt class="font-bold text-secondary">Email</dt>
          <dd><a :href="`mailto:${OPERATOR.email}`" class="font-bold hover:underline">{{ OPERATOR.email }}</a></dd>
          <dt class="font-bold text-secondary">Other contact</dt>
          <dd>
            The "Report a problem" button on every page reaches us directly. We answer within two working days.
          </dd>
        </dl>

        <h2 class="mt-12 text-lg font-bold text-foreground font-sans">Consumer dispute resolution</h2>
        <p class="mt-3 text-sm leading-relaxed text-muted-foreground font-sans">
          We are not obliged and not willing to take part in dispute resolution proceedings before a consumer
          arbitration board (§36 VSBG). If something went wrong, write to us — we'd rather fix it directly.
        </p>

        <h2 class="mt-8 text-lg font-bold text-foreground font-sans">Content by users and organisers</h2>
        <p class="mt-3 text-sm leading-relaxed text-muted-foreground font-sans">
          Events, pages, photos and reviews on WeDance are published by organisers, venues, artists and dancers,
          or taken from their public announcements. Each is responsible for their own content. If something is
          wrong or unlawful, tell us at <a :href="`mailto:${OPERATOR.email}`" class="font-bold hover:underline">{{ OPERATOR.email }}</a>
          and we will remove or correct it promptly. External links are checked when added; we have no control
          over the sites they lead to.
        </p>

        <p class="mt-8 text-sm text-muted-foreground font-sans">
          See also our <NuxtLink to="/privacy-policy" class="font-bold hover:underline">Privacy Policy</NuxtLink>
          and <NuxtLink to="/terms" class="font-bold hover:underline">Terms</NuxtLink>.
        </p>
      </section>
    </main>
    <SiteFooter />
  </div>
</template>
