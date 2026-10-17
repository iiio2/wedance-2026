<script setup lang="ts">
/**
 * AccountMenu — the desktop name button + dropdown (profile, year, settings,
 * mode switch, sign out). Same component on the dancing and business side;
 * only the switch slot changes (see useAccountNav).
 */
import { ChevronDown, LogOut } from 'lucide-vue-next'
import type { NavMode } from '~/composables/useAccountNav'

const props = defineProps<{ mode: NavMode }>()

const route = useRoute()
const { displayName, initial, photo, accountLinks, switchLink, adminLink, handleSignOut } = useAccountNav(props.mode)
const open = ref(false)
const showSignOutConfirm = ref(false)
const root = ref<HTMLElement | null>(null)

watch(() => route.fullPath, () => { open.value = false })
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}
function onDocClick(e: MouseEvent) {
  if (open.value && root.value && !root.value.contains(e.target as Node)) open.value = false
}
onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('click', onDocClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', onDocClick)
})

function askSignOut() {
  open.value = false
  showSignOutConfirm.value = true
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-full border border-border pl-1 pr-2 h-9 hover:bg-muted transition-colors"
      aria-label="Account menu"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <img v-if="photo" :src="photo" alt="" class="w-7 h-7 rounded-full object-cover">
      <span v-else class="w-7 h-7 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-bold">{{ initial }}</span>
      <span class="text-sm font-semibold max-w-[10rem] truncate">{{ displayName }}</span>
      <ChevronDown class="w-4 h-4 text-muted-foreground" />
    </button>
    <div
      v-if="open"
      role="menu"
      class="absolute right-0 mt-2 w-60 rounded-xl border border-border bg-card shadow-lg py-1.5 text-sm z-50"
    >
      <NuxtLink
        v-for="l in accountLinks"
        :key="l.label"
        :to="l.to"
        role="menuitem"
        class="flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted"
      >
        <component :is="l.icon" class="w-4 h-4 text-muted-foreground" />{{ l.label }}
      </NuxtLink>
      <div class="my-1 border-t border-border" />
      <NuxtLink :to="switchLink.to" role="menuitem" class="flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted">
        <component :is="switchLink.icon" class="w-4 h-4 text-primary" />
        <span>{{ switchLink.label }}<span class="block text-[11px] text-muted-foreground">{{ switchLink.hint }}</span></span>
      </NuxtLink>
      <NuxtLink v-if="adminLink" :to="adminLink.to" role="menuitem" class="flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted">
        <component :is="adminLink.icon" class="w-4 h-4 text-primary" />
        <span>{{ adminLink.label }}<span class="block text-[11px] text-muted-foreground">{{ adminLink.hint }}</span></span>
      </NuxtLink>
      <div class="my-1 border-t border-border" />
      <button
        type="button"
        role="menuitem"
        class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted text-left text-muted-foreground"
        @click="askSignOut"
      >
        <LogOut class="w-4 h-4" />Sign out
      </button>
    </div>

    <SignOutConfirmDialog v-model:open="showSignOutConfirm" @confirm="handleSignOut" />
  </div>
</template>
