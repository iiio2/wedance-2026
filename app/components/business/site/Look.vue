<script setup lang="ts">
/**
 * The look of a WeDance-hosted website (hosted websites v1): a style
 * (shared/utils/siteThemes.ts presets, shown in their own colours and font),
 * optionally one accent colour and a heading font, a logo and a favicon. A
 * sample shows the result as the site will draw it.
 */
import { Check, RotateCcw } from 'lucide-vue-next'
import type { SiteThemeSettings } from '#shared/types/profileSite'
import { DEFAULT_THEME, SITE_FONTS, SITE_THEMES, resolveTheme } from '#shared/utils/siteThemes'

defineProps<{ domain?: string; name: string }>()
const theme = defineModel<SiteThemeSettings | undefined>()

function set(patch: Partial<SiteThemeSettings>) {
  const next: SiteThemeSettings = { ...theme.value, ...patch }
  for (const k of Object.keys(next) as (keyof SiteThemeSettings)[]) if (!next[k]) delete next[k]
  theme.value = next
}
const preset = computed(() => theme.value?.preset && SITE_THEMES[theme.value.preset] ? theme.value.preset : DEFAULT_THEME)
const resolved = computed(() => resolveTheme(theme.value ?? {})!)
const c = (role: string, vars = resolved.value.vars) => `rgb(${(vars as Record<string, string>)[role]})`
const presetVars = (id: string) => resolveTheme({ preset: id })!.vars
const presetFont = (id: string) => SITE_FONTS[SITE_THEMES[id]!.font]!.family

// The fonts the swatches and the sample use, loaded only here.
useHead({
  link: [{
    rel: 'stylesheet',
    href: `https://fonts.googleapis.com/css2?${Object.values(SITE_FONTS).filter(f => f.google).map(f => `family=${f.google}`).join('&')}&display=swap`,
  }],
})
const fontOptions = computed(() => [
  { label: `The style’s font (${SITE_FONTS[SITE_THEMES[preset.value]!.font]!.label})`, value: '' },
  ...Object.entries(SITE_FONTS).map(([value, f]) => ({ label: f.label, value })),
])
const accentHex = computed(() => theme.value?.accent ?? '')
</script>

<template>
  <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
    <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Look</h2>
    <p class="mt-1 text-sm text-muted-foreground">How your site looks on sites.wedance.vip. Pick a style; change its accent colour or font if you like.</p>

    <div class="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Style">
      <button
        v-for="(t, id) in SITE_THEMES"
        :key="id"
        type="button"
        role="radio"
        :aria-checked="preset === id"
        class="relative overflow-hidden rounded-xl border-2 text-left transition-shadow focus-visible:shadow-wd-focus focus-visible:outline-none"
        :class="preset === id ? 'border-primary shadow-wd-card' : 'border-transparent hover:border-primary/40'"
        :style="{ background: c('bg', presetVars(id)) }"
        :data-preset="id"
        @click="set({ preset: id })"
      >
        <div class="p-3">
          <p class="text-lg leading-tight" :style="{ color: c('heading', presetVars(id)), fontFamily: presetFont(id) }">Salsa <span :style="{ color: c('highlight', presetVars(id)) }">night</span></p>
          <p class="mt-1 text-[11px]" :style="{ color: c('muted', presetVars(id)) }">Every Friday · 21:00</p>
          <span class="mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold" :style="{ background: c('accent', presetVars(id)), color: c('on-accent', presetVars(id)) }">Join</span>
        </div>
        <p class="px-3 pb-2 text-[11px] font-bold" :style="{ color: c('subtle', presetVars(id)) }">{{ t.label }}</p>
        <Check v-if="preset === id" class="absolute right-2 top-2 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" aria-hidden="true" />
      </button>
    </div>

    <div class="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label="Accent colour" hint="Buttons, small headings and highlights." optional>
        <div class="flex items-center gap-2">
          <input type="color" :value="accentHex || '#' + resolved.vars.accent!.split(' ').map(n => Number(n).toString(16).padStart(2, '0')).join('')" class="h-9 w-12 cursor-pointer rounded border bg-transparent" aria-label="Pick the accent colour" @input="set({ accent: ($event.target as HTMLInputElement).value })">
          <Input :model-value="accentHex" placeholder="The style’s colour" class="w-36" aria-label="Accent colour as #rrggbb" @update:model-value="v => /^#[0-9a-fA-F]{6}$/.test(String(v)) || !v ? set({ accent: String(v) }) : null" />
          <Button v-if="accentHex" type="button" variant="ghost" size="sm" @click="set({ accent: undefined })"><RotateCcw /> Reset</Button>
        </div>
      </Field>
      <Field label="Heading font" optional>
        <Select :model-value="theme?.font ?? ''" :options="fontOptions" size="sm" @update:model-value="v => set({ font: String(v) || undefined })" />
      </Field>
      <BusinessSiteImage :model-value="theme?.logo" label="Logo (instead of the name in the top bar)" :domain="domain" @update:model-value="v => set({ logo: v })" />
      <BusinessSiteImage :model-value="theme?.favicon" label="Favicon (the browser-tab icon)" :domain="domain" @update:model-value="v => set({ favicon: v })" />
    </div>

    <!-- Sample, as the site draws it -->
    <div class="mt-5 overflow-hidden rounded-xl border" :style="{ background: c('bg') }" aria-label="Sample of your site">
      <div class="flex items-center justify-between border-b px-4 py-2" :style="{ borderColor: c('border') }">
        <img v-if="theme?.logo" :src="theme.logo" alt="" class="h-6 w-auto max-w-[8rem] object-contain">
        <span v-else class="text-sm" :style="{ color: c('heading'), fontFamily: resolved.fontDisplay }">{{ name }}</span>
        <span class="text-[11px]" :style="{ color: c('muted') }">About · Classes · FAQ</span>
      </div>
      <div class="px-4 py-6 text-center">
        <p class="text-[10px] font-bold uppercase tracking-[0.25em]" :style="{ color: c('accent') }">Classes &amp; parties</p>
        <p class="mt-1 text-3xl leading-tight" :style="{ color: c('heading'), fontFamily: resolved.fontDisplay }">Dance <span :style="{ color: c('highlight') }">with us</span></p>
        <p class="mx-auto mt-2 max-w-sm text-sm" :style="{ color: c('text') }">Weekly classes for every level. No partner needed.</p>
        <span class="mt-3 inline-block rounded-full px-4 py-1.5 text-sm font-bold" :style="{ background: c('accent'), color: c('on-accent') }">Join free</span>
      </div>
      <div class="px-4 py-3" :style="{ background: c('surface') }">
        <p class="text-xs" :style="{ color: c('subtle') }">A tinted section, like your schedule or questions.</p>
      </div>
    </div>
  </section>
</template>
