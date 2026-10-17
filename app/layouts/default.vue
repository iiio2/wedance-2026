<script setup lang="ts">
import { CalendarDays, ClipboardList } from 'lucide-vue-next'

const route = useRoute()
const { cartCount, cartOpen, toggleCart } = useCart()
const { yearCount, yearDrawerOpen, toggleDrawer: toggleYearDrawer } = useYearPlan()
const { weekCount, weekDrawerOpen, toggleDrawer: toggleWeekDrawer } = useWeekPlan()

const { signOut } = useAuth()
// Hydration-safe signed-in state + name (shared with SiteHeader).
const { appearsSignedIn, displayName } = useAccountNav('dance')
const showSignUp = ref(false)
const showSignOutConfirm = ref(false)

// First-visit tooltip for sidebar icon on mobile
const showSidebarHint = ref(false)
const hintDismissed = ref(false)

const hintKey = computed(() =>
  isFestivalDetailPage.value ? 'wedance-hint-festival-plan' : 'wedance-hint-year-plan'
)

function checkHint() {
  if (typeof localStorage === 'undefined' || !hasSidebar.value) return
  if (!localStorage.getItem(hintKey.value)) {
    showSidebarHint.value = false
    setTimeout(() => {
      showSidebarHint.value = true
    }, 1500)
  } else {
    showSidebarHint.value = false
  }
}

onMounted(checkHint)
watch(() => route.path, checkHint)

function dismissHint() {
  showSidebarHint.value = false
  hintDismissed.value = true
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(hintKey.value, '1')
  }
}

const isFestivalDetailPage = computed(() => /^\/festivals\/[^/]+/.test(route.path))
const isFestivalsListPage = computed(() => route.path === '/festivals')
const isCityDetailPage = computed(() => /^\/cities\/[^/]+/.test(route.path))
const hasSidebar = computed(() => isFestivalDetailPage.value || isFestivalsListPage.value || isCityDetailPage.value)
const sidebarCount = computed(() => {
  if (isFestivalDetailPage.value) return cartCount.value
  if (isCityDetailPage.value) return weekCount.value
  return yearCount.value
})
const sidebarOpen = computed(() => {
  if (isFestivalDetailPage.value) return cartOpen.value
  if (isCityDetailPage.value) return weekDrawerOpen.value
  return yearDrawerOpen.value
})

function toggleSidebar() {
  if (isFestivalDetailPage.value) {
    toggleCart()
  } else if (isCityDetailPage.value) {
    toggleWeekDrawer()
  } else {
    toggleYearDrawer()
  }
}

function onSignIn() {
  showSignUp.value = true
}
</script>

<template>
  <div class="min-h-screen bg-background flex flex-col">
    <!-- Top navbar -->
    <header class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="px-4 h-12 flex items-center justify-between">
        <!-- Brand + Nav -->
        <div class="flex items-center gap-4">
          <NuxtLink to="/" class="flex items-center gap-1.5 shrink-0">
            <span class="text-base font-bold tracking-tight">
              <span class="text-primary">We</span>Dance
            </span>
          </NuxtLink>
          <nav class="hidden sm:flex items-center gap-3">
            <NuxtLink to="/festivals" class="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Festivals</NuxtLink>
            <NuxtLink to="/cities" class="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Cities</NuxtLink>
          </nav>
        </div>

        <div class="flex items-center gap-1">
          <!-- Sidebar toggle (festival pages + homepage) -->
          <div v-if="hasSidebar" class="relative lg:hidden">
            <button
              class="relative flex items-center gap-1.5 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-medium"
              :class="showSidebarHint ? 'animate-pulse text-primary' : ''"
              @click="toggleSidebar(); dismissHint()"
            >
              <ClipboardList v-if="isFestivalDetailPage" class="w-5 h-5" />
              <CalendarDays v-else class="w-5 h-5" />
              My Plan
              <span
                v-if="sidebarCount > 0"
                class="bg-primary text-primary-foreground text-[10px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1"
              >
                {{ sidebarCount }}
              </span>
            </button>
            <!-- First-visit tooltip -->
            <Transition
              enter-active-class="transition duration-200 ease-out"
              enter-from-class="opacity-0 translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-150 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 translate-y-1"
            >
              <button
                v-if="showSidebarHint"
                class="absolute right-0 top-full mt-2 whitespace-nowrap bg-foreground text-background text-xs font-medium px-3 py-1.5 rounded-lg shadow-lg z-50"
                @click="toggleSidebar(); dismissHint()"
              >
                {{ isFestivalDetailPage ? 'Your festival plan' : isCityDetailPage ? 'Your week plan' : 'Your year plan' }} →
                <span class="absolute -top-1 right-3 w-2 h-2 bg-foreground rotate-45" />
              </button>
            </Transition>
          </div>

          <!-- Auth -->
          <template v-if="appearsSignedIn">
            <span class="text-xs font-medium text-foreground">{{ displayName }}</span>
            <button
              class="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              @click="showSignOutConfirm = true"
            >
              Sign out
            </button>
          </template>
          <button
            v-else
            class="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            @click="onSignIn"
          >
            Sign in
          </button>
        </div>
      </div>
    </header>

    <!-- Page content -->
    <main class="flex-1">
      <slot />
    </main>

    <SignUpModal v-model:open="showSignUp" action="signin" />
    <SignOutConfirmDialog v-model:open="showSignOutConfirm" @confirm="signOut" />
  </div>
</template>
