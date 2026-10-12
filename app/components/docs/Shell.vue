<script setup lang="ts">
import { Menu, X, ArrowUpRight, Github } from 'lucide-vue-next'
import type { DocSection } from '~/lib/design-nav'
import { docsSectionFor, docsTabs, isExternal, REPO_URL, SITE_URL } from '~/lib/docs-nav'

/**
 * Shared shell for the whole /docs tree (hub, /docs/design, /docs/architecture):
 * a top bar with one tab per docs section, the current section's sidebar (sheet
 * on mobile) and an "On this page" list built from the page's h2[id] headings
 * (DesignSection renders those). The docs are public and indexed; the shell
 * sets the canonical URL on the production origin. A page that must stay out
 * of search (the admin API catalog) sets its own robots meta.
 */
const props = defineProps<{
  /** Override the sidebar; by default it comes from the route (docsSectionFor). */
  nav?: DocSection[]
  /** Override the section home. */
  home?: string
  /** Override the section name shown above the mobile nav. */
  label?: string
}>()

const route = useRoute()
const section = computed(() => docsSectionFor(route.path))
const nav = computed(() => props.nav ?? section.value.nav)
const home = computed(() => props.home ?? section.value.home)
const label = computed(() => props.label ?? section.value.label)

const canonical = computed(() => `${SITE_URL}${route.path === '/' ? '' : route.path.replace(/\/$/, '')}`)
useHead(() => ({ link: [{ rel: 'canonical', href: canonical.value }] }))
useSeoMeta({ ogUrl: () => canonical.value, ogSiteName: 'WeDance Docs', ogType: 'website' })

// Longest tab prefix wins, so /docs/design/… selects "Design", not "Overview".
const activeTab = computed(() => docsTabs
  .filter(t => route.path === t.to || route.path.startsWith(`${t.to}/`))
  .sort((a, b) => b.to.length - a.to.length)[0]?.to)

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
// /docs/architecture/data/events) highlights its closest parent item instead.
const navPaths = computed(() => nav.value.flatMap(s => s.items.map(i => i.to)).filter(to => !isExternal(to)))
const activeTo = computed(() => {
  if (navPaths.value.includes(route.path)) return route.path
  return navPaths.value
    .filter(to => to !== home.value && route.path.startsWith(`${to}/`))
    .sort((a, b) => b.length - a.length)[0] ?? null
})
const isActive = (to: string) => activeTo.value === to
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-sans">
    <a href="#design-main" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>

    <!-- Top bar: brand, section tabs, GitHub, back to the app -->
    <header class="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div class="h-16 max-w-[1400px] mx-auto px-4 flex items-center gap-3 sm:gap-4">
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
        <Brand to="/docs" />
        <span class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">Docs</span>
        <nav aria-label="Docs sections" class="hidden md:flex items-center gap-1 ml-4">
          <NuxtLink
            v-for="t in docsTabs"
            :key="t.to"
            :to="t.to"
            class="rounded-full px-3 py-1.5 text-sm font-bold transition-colors"
            :class="activeTab === t.to ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'"
            :aria-current="activeTab === t.to ? 'page' : undefined"
          >
            {{ t.label }}
          </NuxtLink>
        </nav>
        <a
          :href="REPO_URL"
          class="ml-auto inline-flex items-center gap-1.5 rounded-full p-2 sm:px-3 sm:py-1.5 text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-accent"
          aria-label="WeDance on GitHub"
        >
          <Github class="w-4 h-4" /><span class="hidden sm:inline">GitHub</span>
        </a>
        <NuxtLink to="/" class="hidden sm:inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
          Back to site <ArrowUpRight class="w-4 h-4" />
        </NuxtLink>
      </div>
      <!-- Section tabs on small screens -->
      <nav aria-label="Docs sections" class="md:hidden border-t border-border">
        <div class="max-w-[1400px] mx-auto px-2 flex">
          <NuxtLink
            v-for="t in docsTabs"
            :key="t.to"
            :to="t.to"
            class="flex-1 text-center border-b-2 px-2 py-2 text-sm font-bold transition-colors"
            :class="activeTab === t.to ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground'"
            :aria-current="activeTab === t.to ? 'page' : undefined"
          >
            {{ t.label }}
          </NuxtLink>
        </div>
      </nav>
    </header>

    <div class="max-w-[1400px] mx-auto px-4 flex gap-10">
      <!-- Mobile backdrop -->
      <div v-if="menuOpen" class="fixed inset-0 z-40 bg-wd-brown-950/40 lg:hidden" @click="menuOpen = false" />

      <!-- Sidebar -->
      <nav
        id="design-nav"
        :aria-label="label"
        class="fixed inset-y-0 left-0 z-50 w-72 bg-background border-r border-border p-5 overflow-y-auto transition-transform lg:sticky lg:top-16 lg:z-auto lg:h-[calc(100vh-4rem)] lg:w-60 lg:shrink-0 lg:translate-x-0 lg:border-r-0 lg:px-0 lg:py-8"
        :class="menuOpen ? 'translate-x-0' : '-translate-x-full'"
      >
        <div class="flex items-center justify-between mb-4 lg:hidden">
          <span class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">{{ label }}</span>
          <button type="button" class="p-2 rounded-md hover:bg-accent" aria-label="Close navigation" @click="menuOpen = false">
            <X class="w-5 h-5" />
          </button>
        </div>
        <div v-for="group in nav" :key="group.title" class="mb-6">
          <div class="px-3 mb-1.5 text-[11px] uppercase tracking-wider font-bold text-muted-foreground">{{ group.title }}</div>
          <ul>
            <li v-for="item in group.items" :key="item.to">
              <NuxtLink
                v-if="item.status !== 'planned'"
                :to="item.to"
                :external="isExternal(item.to)"
                class="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-colors"
                :class="isActive(item.to) ? 'bg-accent text-foreground font-bold' : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'"
                :aria-current="isActive(item.to) ? 'page' : undefined"
              >
                {{ item.title }}
                <ArrowUpRight v-if="isExternal(item.to)" class="w-3.5 h-3.5" aria-hidden="true" />
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
        <NuxtLink to="/" class="lg:hidden inline-flex items-center gap-1 px-3 text-sm font-bold text-muted-foreground hover:text-foreground">
          Back to site <ArrowUpRight class="w-4 h-4" />
        </NuxtLink>
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
