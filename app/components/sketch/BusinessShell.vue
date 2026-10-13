<script setup lang="ts">
/**
 * Prototype shell for /sketches/first-flyer: looks like the real /business
 * layout (sidebar, main column) but calls no server. Nothing is saved.
 */
import { Home, CalendarDays, UserSquare, FlaskConical } from 'lucide-vue-next'

defineProps<{ active?: 'home' | 'events' | 'profiles' }>()
const nav = [
  { key: 'home', to: '/sketches/first-flyer', label: 'Home', icon: Home },
  { key: 'events', to: '/sketches/first-flyer/event', label: 'Events', icon: CalendarDays },
  { key: 'profiles', to: '/sketches/first-flyer', label: 'Profiles', icon: UserSquare },
] as const
</script>

<template>
  <div class="min-h-screen md:flex bg-background text-foreground font-sans">
    <aside class="md:w-60 md:min-h-screen md:border-r border-b md:border-b-0 border-border shrink-0 md:sticky md:top-0 md:h-screen flex flex-col bg-card/55">
      <div class="px-4 py-4 md:py-6">
        <Brand />
        <div class="hidden md:block mt-6 text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Business</div>
      </div>
      <nav class="flex md:flex-col gap-1 px-2 md:px-3 pb-3 md:pb-0 overflow-x-auto" aria-label="Business">
        <NuxtLink
          v-for="item in nav"
          :key="item.key"
          :to="item.to"
          :aria-current="active === item.key ? 'page' : undefined"
          class="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors"
          :class="active === item.key ? 'bg-primary/10 text-wd-red-800 font-bold' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'"
        >
          <component :is="item.icon" class="size-4 shrink-0" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </NuxtLink>
      </nav>
    </aside>
    <main class="flex-1 min-w-0">
      <div class="mx-auto max-w-4xl px-4 py-6 md:py-8">
        <p class="mb-5 inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs text-wd-amber-800">
          <FlaskConical class="size-3.5" aria-hidden="true" /> Prototype · nothing is saved · the flyers are examples from earlier work
        </p>
        <slot />
      </div>
    </main>
  </div>
</template>
