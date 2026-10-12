<script setup lang="ts">
import { Menu, X, ArrowUpRight } from 'lucide-vue-next'
import type { DocSection } from '~/lib/design-nav'

/**
 * Shared shell for the internal docs sections (/design, /architecture): sticky
 * sidebar from `nav` (sheet on mobile) and an "On this page" list built from
 * the page's h2[id] headings (DesignSection renders those). Both sections are
 * internal docs, so the shell marks every page noindex.
 */
const props = defineProps<{
  nav: DocSection[]
  /** Section home, the brand link target. */
  home: string
  /** Section name shown next to the brand and above the mobile nav. */
  label: string
  /** Optional link to a sibling docs section, shown in the top bar. */
  crossLink?: { to: string, label: string }
}>()

useHead({
  meta: [{ name: 'robots', content: 'noindex' }],
})

const route = useRoute()
const menuOpen = ref(false)
watch(() => route.path, () => (menuOpen.value = false))

const toc = ref<{ id: string, text: string }[]>([])
const activeId = ref('')
let observer: IntersectionObserver | undefined

function buildToc() {
  observer?.disconnect()
  const heads = [...document.querySelectorAll<HTMLElement>('#design-main h2[id]')]
  toc.value = heads.map(h => ({ id: h.id, text: h.textContent?.replace('#', '').trim() ?? '' }))
  activeId.value = toc.value[0]?.id ?? ''
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible[0]) activeId.value = visible[0].target.id
    },
    { rootMargin: '-80px 0px -70% 0px' },
  )
  heads.forEach(h => observer!.observe(h))
}

onMounted(() => nextTick(buildToc))
watch(() => route.path, () => nextTick(() => setTimeout(buildToc, 50)))
onBeforeUnmount(() => observer?.disconnect())

// Exact match first. A detail page with no nav item of its own (e.g.
// /architecture/data/events) highlights its closest parent item instead.
const navPaths = computed(() => props.nav.flatMap(s => s.items.map(i => i.to)))
const activeTo = computed(() => {
  if (navPaths.value.includes(route.path)) return route.path
  return navPaths.value
    .filter(to => to !== props.home && route.path.startsWith(`${to}/`))
    .sort((a, b) => b.length - a.length)[0] ?? null
})
const isActive = (to: string) => activeTo.value === to
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-sans">
    <a href="#design-main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>

    <!-- Top bar -->
    <header class="sticky top-0 z-40 h-16 border-b border-border bg-background/90 backdrop-blur">
      <div class="h-full max-w-[1400px] mx-auto px-4 flex items-center gap-4">
        <button
          type="button"
          class="lg:hidden -ml-1 p-2 rounded-md hover:bg-accent"
          :aria-expanded="menuOpen"
          aria-controls="design-nav"
          aria-label="Open navigation"
          @click="menuOpen = true"
        >
          <Menu class="w-5 h-5" />
        </button>
        <Brand :to="props.home" />
        <span class="hidden sm:inline text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">{{ props.label }}</span>
        <NuxtLink
          v-if="props.crossLink"
          :to="props.crossLink.to"
          class="ml-auto hidden sm:inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"
        >
          {{ props.crossLink.label }}
        </NuxtLink>
        <NuxtLink to="/" class="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground" :class="props.crossLink ? 'sm:ml-0 ml-auto' : 'ml-auto'">
          Back to site <ArrowUpRight class="w-4 h-4" />
        </NuxtLink>
      </div>
    </header>

    <div class="max-w-[1400px] mx-auto px-4 flex gap-10">
      <!-- Mobile backdrop -->
      <div v-if="menuOpen" class="fixed inset-0 z-40 bg-wd-brown-950/40 lg:hidden" @click="menuOpen = false" />

      <!-- Sidebar -->
      <nav
        id="design-nav"
        :aria-label="props.label"
        class="fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border p-5 overflow-y-auto transition-transform lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100vh-4rem)] lg:w-60 lg:shrink-0 lg:translate-x-0 lg:border-r-0 lg:px-0 lg:py-8"
        :class="menuOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <div class="flex items-center justify-between mb-4 lg:hidden">
          <span class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">{{ props.label }}</span>
          <button type="button" class="p-2 rounded-md hover:bg-accent" aria-label="Close navigation" @click="menuOpen = false">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div v-for="section in props.nav" :key="section.title" class="mb-6">
          <div class="px-3 mb-1.5 text-[11px] uppercase tracking-wider font-bold text-muted-foreground">{{ section.title }}</div>
          <ul>
            <li v-for="item in section.items" :key="item.to">
              <NuxtLink
                v-if="item.status !== 'planned'"
                :to="item.to"
                class="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors"
                :class="isActive(item.to) ? 'bg-accent text-foreground font-bold' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'"
                :aria-current="isActive(item.to) ? 'page' : undefined"
              >
                {{ item.title }}
                <span v-if="item.status === 'beta'" class="text-[9px] uppercase tracking-wider font-bold text-wd-amber-700">beta</span>
              </NuxtLink>
              <span
                v-else
                class="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm text-muted-foreground/60 cursor-default"
                :title="`${item.title} — planned`"
              >
                {{ item.title }}
                <span class="text-[9px] uppercase tracking-wider font-bold">soon</span>
              </span>
            </li>
          </ul>
        </div>
      </nav>

      <!-- Content -->
      <main id="design-main" class="min-w-0 flex-1 py-10 lg:py-12">
        <slot />
      </main>

      <!-- On this page -->
      <aside class="hidden xl:block w-52 shrink-0">
        <div v-if="toc.length > 1" class="sticky top-16 py-12">
          <div class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">On this page</div>
          <ul class="border-l border-border">
            <li v-for="t in toc" :key="t.id">
              <a
                :href="`#${t.id}`"
                class="block -ml-px border-l-2 pl-3 py-1 text-sm transition-colors"
                :class="activeId === t.id ? 'border-primary text-foreground font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'"
              >{{ t.text }}</a>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>
