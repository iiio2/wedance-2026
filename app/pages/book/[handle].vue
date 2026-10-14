<script setup lang="ts">
/**
 * /@handle/book — book an artist or venue. Its own page so it can be linked
 * from their website, Instagram bio or email signature. Anyone can send one,
 * no account needed (BookingInquiryForm → inquiries.send).
 */
definePageMeta({ layout: false, path: '/@:handle/book' })

const route = useRoute()
const { $trpc } = useNuxtApp()
const handle = computed(() => String(route.params.handle))
const profile = ref<any>(null)
const spaces = ref<any[]>([])
const pending = ref(true)

onMounted(async () => {
  try {
    const pro = await $trpc.entity.getByHandle.query({ handle: handle.value })
    if (pro) { profile.value = pro.profile; spaces.value = pro.spaces ?? [] }
    else {
      const moved = await $trpc.entity.movedTo.query({ handle: handle.value }).catch(() => null)
      if (moved) return navigateTo(`/@${moved.handle}/book`, { replace: true })
    }
  } catch {}
  pending.value = false
})

// Venues with bookable spaces take requests on their page's calendar.
const bookable = computed(() => !!profile.value && (profile.value.type === 'artist' || (profile.value.type === 'venue' && !spaces.value.length)))
const firstName = computed(() => profile.value?.type === 'artist' ? profile.value.name.split(/\s+/)[0] : profile.value?.name)
useHead(() => ({
  title: profile.value ? `Book ${profile.value.name} | WeDance` : 'Book | WeDance',
  meta: profile.value ? [{ name: 'description', content: `Ask ${profile.value.name} about your event: a workshop, a show, a party. They answer you by email.` }] : [],
}))
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main class="max-w-xl mx-auto px-4 pt-10 pb-16">
      <div v-if="pending" class="py-24 text-center"><div class="inline-block w-8 h-8 rounded-full border-2 animate-spin" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); border-top-color:var(--wd-red-600);" /></div>

      <div v-else-if="!profile" class="py-16 text-center">
        <h1 class="text-3xl">Not on WeDance yet</h1>
        <p class="mt-3 text-sm text-muted-foreground font-sans"><span class="font-bold">@{{ handle }}</span> doesn’t have a page here.</p>
      </div>

      <div v-else-if="!bookable" class="py-16 text-center">
        <h1 class="text-3xl">Book {{ profile.name }}</h1>
        <p class="mt-3 text-sm text-muted-foreground font-sans">Pick a free slot on their calendar.</p>
        <Button variant="cta" class="mt-5" as-child><NuxtLink :to="`/@${profile.username}`">Open the calendar</NuxtLink></Button>
      </div>

      <template v-else>
        <NuxtLink :to="`/@${profile.username}`" class="flex items-center gap-4">
          <img v-if="profile.photo" :src="profile.photo" :alt="profile.name" class="size-16 shrink-0 rounded-full object-cover border">
          <div class="min-w-0">
            <p class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary font-sans">{{ profile.type === 'venue' ? 'Venue' : 'Artist' }}<template v-if="profile.city"> · {{ profile.city }}</template></p>
            <h1 class="text-3xl leading-tight">Book {{ profile.name }}</h1>
            <div v-if="profile.styles?.length" class="mt-1 flex flex-wrap gap-1.5">
              <span v-for="st in profile.styles.slice(0, 5)" :key="st" class="px-2 py-0.5 rounded-full text-eyebrow font-bold uppercase tracking-wider text-primary font-sans" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent);">{{ st }}</span>
            </div>
          </div>
        </NuxtLink>
        <p class="mt-5 text-sm text-muted-foreground font-sans">Tell {{ firstName }} what you have in mind. They get it by email and answer you directly. No account needed.</p>
        <div class="mt-6 rounded-2xl border bg-card p-5 sm:p-6 shadow-wd-card">
          <BookingInquiryForm :profile="profile" />
        </div>
        <p class="mt-4 text-center text-xs text-muted-foreground font-sans">Through <NuxtLink to="/" class="font-bold hover:underline">WeDance</NuxtLink>, where dancers, artists and venues meet.</p>
      </template>
    </main>
    <SiteFooter />
  </div>
</template>
