<script setup lang="ts">
/**
 * Shared layout for the legal pages (/privacy-policy, /terms). Each section is
 * a heading plus paragraphs and/or bullet items. Content is static, written in
 * the page source — never user input — so it may contain simple inline HTML
 * (<b>, <a>).
 */
import { LEGAL_UPDATED } from '#shared/legal'

export interface LegalSection {
  id: string
  heading: string
  paragraphs?: string[]
  items?: string[]
}

defineProps<{
  title: string
  intro: string
  sections: LegalSection[]
}>()
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>
      <section class="max-w-3xl mx-auto px-4 pt-12 pb-4">
        <div class="text-sm tracking-widest uppercase mb-3 text-secondary">Legal</div>
        <h1 class="text-4xl sm:text-5xl leading-tight text-foreground">{{ title }}</h1>
        <p class="mt-2 text-xs text-muted-foreground font-sans">Last updated: {{ LEGAL_UPDATED }}</p>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <p class="mt-4 text-sm leading-relaxed text-muted-foreground font-sans legal-text" v-html="intro" />

        <nav aria-label="Contents" class="mt-6 rounded-xl border border-border p-4">
          <div class="text-xs font-bold uppercase tracking-wider text-secondary font-sans">Contents</div>
          <ol class="mt-2 grid gap-1 text-sm font-sans sm:grid-cols-2">
            <li v-for="s in sections" :key="s.id">
              <a :href="`#${s.id}`" class="text-foreground hover:underline">{{ s.heading }}</a>
            </li>
          </ol>
        </nav>
      </section>

      <section class="max-w-3xl mx-auto px-4 pb-16">
        <div v-for="s in sections" :id="s.id" :key="s.id" class="mt-8 scroll-mt-24">
          <h2 class="text-lg font-bold text-foreground font-sans">{{ s.heading }}</h2>
          <!-- eslint-disable vue/no-v-html -->
          <p
            v-for="(p, i) in s.paragraphs ?? []"
            :key="`p${i}`"
            class="mt-3 text-sm leading-relaxed text-muted-foreground font-sans legal-text"
            v-html="p"
          />
          <ul v-if="s.items?.length" class="mt-3 space-y-2">
            <li v-for="(item, i) in s.items" :key="`i${i}`" class="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground font-sans">
              <span class="mt-0.5 shrink-0 text-primary">·</span>
              <span class="legal-text" v-html="item" />
            </li>
          </ul>
          <!-- eslint-enable vue/no-v-html -->
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
</template>

<style scoped>
.legal-text :deep(a) {
  font-weight: 700;
  text-decoration: underline;
  color: var(--color-foreground);
}
.legal-text :deep(b) {
  color: var(--color-foreground);
}
</style>
