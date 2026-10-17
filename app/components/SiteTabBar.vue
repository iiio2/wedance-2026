<script setup lang="ts">
/**
 * SiteTabBar — the phone bottom tab bar plus its "Me" sheet. Used by
 * SiteHeader (dancing: Explore · Cities · My plan · Me) and the Business
 * layout (Home · Events · Network · Me). The Me sheet is identical on both
 * sides except its mode-switch row (see useAccountNav).
 *
 * Sets `html.has-tabbar`, which reserves `--wd-tabbar-h` at the bottom of the
 * page (tailwind.css) so content and fixed buttons stay above the bar.
 */
import { Compass, MapPin, CalendarDays, User, Home, UserSquare, LogOut, Globe, Contact } from 'lucide-vue-next'
import type { NavMode } from '~/composables/useAccountNav'

const props = withDefaults(defineProps<{ mode: NavMode, planCount?: number }>(), { planCount: 0 })

const route = useRoute()
const {
  appearsSignedIn, displayName, displayUsername, initial, photo, profileTo,
  accountLinks, switchLink, adminLink, handleSignOut,
} = useAccountNav(props.mode)
const meOpen = ref(false)
const showSignIn = ref(false)
const showSignOutConfirm = ref(false)

function under(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}
const EXPLORE_ROOTS = ['/festivals', '/artists', '/find-your-dance']
// Business pages with no room in the tab bar: in the Me sheet instead (RAZ-412).
const businessLinks = computed(() => props.mode === 'business'
  ? [{ to: '/business/website', label: 'Website', icon: Globe }, { to: '/business/contacts', label: 'Contacts', icon: Contact }]
  : [])

const tabs = computed(() => props.mode === 'dance'
  ? [
      { to: '/festivals', label: 'Explore', icon: Compass, active: route.path === '/' || EXPLORE_ROOTS.some(under) },
      { to: '/cities', label: 'Cities', icon: MapPin, active: under('/cities') },
      { to: '/my-plan', label: 'My plan', icon: CalendarDays, active: under('/my-plan') || under('/my-year'), badge: props.planCount },
    ]
  : [
      { to: '/business', label: 'Home', icon: Home, active: route.path === '/business' },
      { to: '/business/events', label: 'Events', icon: CalendarDays, active: under('/business/events') },
      { to: '/business/network', label: 'Network', icon: UserSquare, active: ['/business/network', '/business/claim', '/business/new'].some(under) },
    ])

const meActive = computed(() => appearsSignedIn.value && (meOpen.value || (props.mode === 'dance' && (
  under('/settings') || (!!displayUsername.value && under(`/u/${displayUsername.value}`))
))))

watch(() => route.fullPath, () => { meOpen.value = false })
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') meOpen.value = false
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))

useHead({ htmlAttrs: { class: 'has-tabbar' } })

function onMeTab() {
  if (!appearsSignedIn.value) {
    showSignIn.value = true
    return
  }
  meOpen.value = !meOpen.value
}
function askSignOut() {
  meOpen.value = false
  showSignOutConfirm.value = true
}
</script>

<template>
  <Teleport to="body">
    <!-- "Me" sheet -->
    <div
      v-if="meOpen && appearsSignedIn"
      class="sm:hidden fixed inset-0 z-[44] bg-black/30 flex items-end"
      @click.self="meOpen = false"
    >
      <div class="w-full bg-card rounded-t-3xl pt-3 px-5 shadow-2xl pb-[calc(1rem+var(--wd-tabbar-h,0px))]">
        <div class="mx-auto w-10 h-1 rounded-full bg-border mb-4" />
        <NuxtLink :to="profileTo" class="flex items-center gap-3 mb-3">
          <img v-if="photo" :src="photo" alt="" class="w-11 h-11 rounded-full object-cover">
          <span v-else class="w-11 h-11 rounded-full bg-primary/15 text-primary grid place-items-center font-bold">{{ initial }}</span>
          <span>
            <span class="block font-display font-bold text-lg leading-tight">{{ displayName }}</span>
            <span v-if="displayUsername" class="block text-xs text-muted-foreground">@{{ displayUsername }}</span>
          </span>
        </NuxtLink>
        <NuxtLink
          v-for="l in businessLinks"
          :key="l.to"
          :to="l.to"
          class="flex items-center gap-3 py-3 border-b border-border/60"
        ><component :is="l.icon" class="w-5 h-5 text-muted-foreground" />{{ l.label }}</NuxtLink>
        <NuxtLink
          v-for="l in accountLinks"
          :key="l.label"
          :to="l.to"
          class="flex items-center gap-3 py-3 border-b border-border/60"
        ><component :is="l.icon" class="w-5 h-5 text-muted-foreground" />{{ l.label }}</NuxtLink>
        <NuxtLink :to="switchLink.to" class="flex items-center gap-3 py-3 border-b border-border/60">
          <component :is="switchLink.icon" class="w-5 h-5 text-primary" />
          <span>{{ switchLink.label }}<span class="block text-xs text-muted-foreground">{{ switchLink.hint }}</span></span>
        </NuxtLink>
        <NuxtLink v-if="adminLink" :to="adminLink.to" class="flex items-center gap-3 py-3 border-b border-border/60">
          <component :is="adminLink.icon" class="w-5 h-5 text-primary" />
          <span>{{ adminLink.label }}<span class="block text-xs text-muted-foreground">{{ adminLink.hint }}</span></span>
        </NuxtLink>
        <button type="button" class="w-full flex items-center gap-3 py-3 text-muted-foreground text-left" @click="askSignOut">
          <LogOut class="w-5 h-5" />Sign out
        </button>
      </div>
    </div>

    <!-- Bottom tab bar -->
    <nav
      class="sm:hidden fixed bottom-0 inset-x-0 z-[45] border-t border-border bg-card/95 backdrop-blur grid grid-cols-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      aria-label="Tabs"
    >
      <NuxtLink
        v-for="t in tabs"
        :key="t.to"
        :to="t.to"
        class="relative flex flex-col items-center gap-0.5 text-[11px] font-semibold"
        :class="t.active ? 'text-primary' : 'text-muted-foreground'"
      >
        <component :is="t.icon" class="w-6 h-6" :stroke-width="t.active ? 2.4 : 1.8" />{{ t.label }}
        <span
          v-if="'badge' in t && t.badge && appearsSignedIn"
          class="absolute top-0 left-1/2 ml-2 bg-primary text-primary-foreground text-[10px] font-bold min-w-4 h-4 rounded-full grid place-items-center px-1"
        >{{ t.badge }}</span>
      </NuxtLink>
      <button
        type="button"
        class="flex flex-col items-center gap-0.5 text-[11px] font-semibold"
        :class="meActive ? 'text-primary' : 'text-muted-foreground'"
        @click="onMeTab"
      >
        <User class="w-6 h-6" :stroke-width="meActive ? 2.4 : 1.8" />{{ appearsSignedIn ? 'Me' : 'Sign in' }}
      </button>
    </nav>
  </Teleport>

  <SignUpModal v-model:open="showSignIn" action="signin" />
  <SignOutConfirmDialog v-model:open="showSignOutConfirm" @confirm="handleSignOut" />
</template>
