<script setup lang="ts">
/**
 * /imprint — legally required imprint (§5 DDG). PLACEHOLDER.
 * The fields below must be filled with the real operator details before
 * launch. Do not ship ticket sales without a complete, accurate imprint.
 */
definePageMeta({ layout: false })
useHead({
  title: 'WeDance — Imprint',
  meta: [{ name: 'robots', content: 'noindex' }],
})

// TODO: replace every [placeholder] with the real operating entity.
const rows = [
  ['Operator', '[Legal name / company]'],
  ['Legal form', '[e.g. Einzelunternehmen (Kleinunternehmer §19 UStG) / GmbH / e.V.]'],
  ['Address', '[Street, postal code, city, Germany]'],
  ['Email', '[contact email]'],
  ['Phone', '[phone number]'],
  ['Represented by', '[responsible person]'],
  ['Register', '[Handelsregister / Vereinsregister no., if applicable]'],
  ['VAT ID', '[USt-IdNr, if applicable]'],
  ['Responsible for content (§18 MStV)', '[name + address]'],
]
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>
    <section class="max-w-3xl mx-auto px-4 py-12">
      <div class="text-sm tracking-widest uppercase mb-3 text-secondary">Legal</div>
      <h1 class="text-4xl sm:text-5xl leading-tight text-foreground">Imprint</h1>

      <div class="mt-6 rounded-xl p-4 text-sm text-muted-foreground font-sans" style="background:color-mix(in srgb, var(--wd-red-600) 6.3%, transparent); border:1px solid color-mix(in srgb, var(--wd-red-600) 20%, transparent);">
        ⚠️ Draft. Replace the placeholders below with the real operator details before launch — an incomplete imprint is an Abmahnung risk under §5 DDG.
      </div>

      <dl class="mt-6 grid sm:grid-cols-[200px_1fr] gap-x-6 gap-y-3 text-sm text-foreground font-sans">
        <template v-for="[k, v] in rows" :key="k">
          <dt class="font-bold text-secondary">{{ k }}</dt>
          <dd>{{ v }}</dd>
        </template>
      </dl>
    </section>
    </main>

    <SiteFooter />
  </div>
</template>
