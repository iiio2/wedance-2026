<script setup lang="ts">
/**
 * /whats-new — "What's new on WeDance": product updates, newest first.
 * Public + indexed. Data: app/lib/whats-new.ts (add an entry there, drop the
 * image in public/updates/). Conventions follow /press: layout:false with
 * SiteHeader/SiteFooter, Playfair headings, white cards on cream.
 */
import { ArrowRight, Bug, Instagram, Sparkles } from 'lucide-vue-next'
import { WHATS_NEW, formatWhatsNewDate, sortedWhatsNew } from '~/lib/whats-new'
import { requestProblemReport } from '~/lib/report-problem'

definePageMeta({ layout: false })

const entries = sortedWhatsNew(WHATS_NEW)
const latest = entries[0]
const origin = useRequestURL().origin

const title = "What's new on WeDance"
const description = latest
  ? `Product updates from WeDance, newest first. Latest: ${latest.title}.`
  : 'Product updates from WeDance, newest first.'
const ogImage = latest?.image ? `${origin}${latest.image.og ?? latest.image.src}` : undefined

useSeoMeta({
  title,
  ogTitle: title,
  description,
  ogDescription: description,
  ogType: 'website',
  ogUrl: `${origin}/whats-new`,
  ogImage,
  ogImageAlt: latest?.image?.alt,
  twitterCard: 'summary_large_image',
  twitterImage: ogImage,
})
useHead({ link: [{ rel: 'canonical', href: `${origin}/whats-new` }] })

const track = (name: string, entry: string) => useTrack().track(name, { surface: 'whats_new', entry })
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>
      <!-- HERO -->
      <section class="max-w-3xl mx-auto px-4 pt-10 sm:pt-14 pb-8">
        <div class="inline-flex items-center gap-1.5 text-sm tracking-widest uppercase mb-3 text-secondary font-sans">
          <Sparkles class="w-4 h-4" aria-hidden="true" /> Product updates
        </div>
        <h1 class="text-5xl sm:text-6xl leading-[0.95] text-foreground">
          What’s new on <em class="italic text-primary">WeDance.</em>
        </h1>
        <p class="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed max-w-xl text-muted-foreground font-sans">
          What we shipped, newest first. Try it, then tell us what breaks — that’s how it gets good.
        </p>
      </section>

      <!-- FEED -->
      <section class="max-w-3xl mx-auto px-4 pb-16" aria-label="Updates">
        <ol class="relative space-y-10 sm:border-l-2 sm:border-dashed sm:border-border sm:pl-8">
          <li v-for="e in entries" :id="e.id" :key="e.id" class="relative scroll-mt-24">
            <!-- timeline dot -->
            <span class="hidden sm:block absolute -left-[41px] top-1.5 size-4 rounded-full border-4 border-background bg-primary" aria-hidden="true" />

            <article class="rounded-2xl border border-border bg-card shadow-wd-card overflow-hidden">
              <header class="px-6 pt-6 pb-5 sm:px-8 sm:pt-8">
                <div class="flex flex-wrap items-center gap-2 font-sans">
                  <time :datetime="e.date" class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">
                    {{ formatWhatsNewDate(e.date) }}
                  </time>
                  <span
                    v-if="e.tag"
                    class="rounded-full bg-primary px-2.5 py-0.5 text-eyebrow font-bold uppercase tracking-widest text-primary-foreground shadow-wd-lip"
                  >{{ e.tag }}</span>
                </div>
                <h2 class="mt-2 text-3xl sm:text-4xl leading-tight text-foreground">
                  <a :href="`#${e.id}`" class="hover:underline decoration-primary/40 underline-offset-4">{{ e.title }}</a>
                </h2>
              </header>

              <a
                v-if="e.image && e.instagram"
                :href="e.instagram"
                target="_blank"
                rel="noopener"
                class="group block border-y border-border bg-wd-cream"
                :aria-label="`${e.title} — view the post on Instagram (opens in a new tab)`"
                @click="track('whats_new_image_click', e.id)"
              >
                <img
                  :src="e.image.src"
                  :alt="e.image.alt"
                  width="1080"
                  height="1080"
                  class="aspect-square w-full object-cover transition-transform duration-wd-standard ease-wd-out group-hover:scale-[1.01]"
                  :loading="e === latest ? 'eager' : 'lazy'"
                >
              </a>
              <img
                v-else-if="e.image"
                :src="e.image.src"
                :alt="e.image.alt"
                width="1080"
                height="1080"
                class="aspect-square w-full object-cover border-y border-border"
                loading="lazy"
              >

              <div class="px-6 pt-5 pb-6 sm:px-8 sm:pb-8">
                <p class="text-base leading-relaxed text-muted-foreground font-sans">{{ e.description }}</p>

                <div v-if="e.cta || e.instagram" class="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                  <Button v-if="e.cta" as-child variant="pill" size="pill-sm" class="font-sans">
                    <NuxtLink :to="e.cta.to" @click="track('whats_new_cta_click', e.id)">
                      {{ e.cta.label }} <ArrowRight aria-hidden="true" />
                    </NuxtLink>
                  </Button>
                  <a
                    v-if="e.instagram"
                    :href="e.instagram"
                    target="_blank"
                    rel="noopener"
                    class="inline-flex items-center gap-1.5 text-sm font-bold text-wd-red-800 hover:underline font-sans"
                    @click="track('whats_new_instagram_click', e.id)"
                  >
                    <Instagram class="w-4 h-4" aria-hidden="true" /> View on Instagram
                    <span class="sr-only">(opens in a new tab)</span>
                  </a>
                </div>
              </div>
            </article>
          </li>
        </ol>

        <div class="mt-12 text-center">
          <p class="text-xl font-hand text-secondary">Found a bug or have an idea? Every update here started that way.</p>
          <Button variant="outline-pill" size="pill-sm" class="mt-3 font-sans" @click="requestProblemReport">
            <Bug aria-hidden="true" /> Tell us
          </Button>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>
</template>
