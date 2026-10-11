<script setup lang="ts">
/**
 * /u/<username> — public dancer profile.
 *
 * Identity (name, avatar, city, styles, role) + bio + social links + the
 * dancer's approved competition videos (their activity). Honors privacy: a
 * private profile 404s for everyone but its owner, who sees a "private" banner.
 * 2026 tropical style.
 */
import { MapPin, Pencil, ArrowLeft, Instagram, Youtube, Globe, Play, EyeOff } from 'lucide-vue-next'

definePageMeta({ layout: false })

const route = useRoute()
const { $trpc } = useNuxtApp()

const username = computed(() => String(route.params.username))

// The tRPC client is client-only (relative URL, no SSR base) — the whole app
// fetches on mount, so we do too rather than via SSR useAsyncData.
type ProfileData = Awaited<ReturnType<typeof $trpc.profile.getByUsername.query>>
const profile = ref<ProfileData | null>(null)
const pending = ref(true)
const failed = ref(false)

async function load() {
  pending.value = true
  failed.value = false
  try {
    profile.value = await $trpc.profile.getByUsername.query({ username: username.value })
  } catch {
    profile.value = null
    failed.value = true
  } finally {
    pending.value = false
  }
}
onMounted(load)

const notFound = computed(() => !pending.value && (failed.value || !profile.value))

const roleLabel: Record<string, string> = {
  lead: 'Leader',
  follow: 'Follower',
  both: 'Lead & Follow',
}

const initials = computed(() => {
  const n = (profile.value?.name || '').trim()
  if (!n) return '?'
  return n.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
})

// Normalize a social value (full URL or bare handle) into a link.
function normalizeUrl(v: string | null | undefined, base: string): string | null {
  if (!v) return null
  const s = v.trim()
  if (!s) return null
  if (/^https?:\/\//i.test(s)) return s
  return base + s.replace(/^@/, '')
}
const igUrl = computed(() => normalizeUrl(profile.value?.instagram, 'https://instagram.com/'))
const ytUrl = computed(() => normalizeUrl(profile.value?.youtube, 'https://youtube.com/@'))
const siteUrl = computed(() => normalizeUrl(profile.value?.website, 'https://'))

useHead(() => ({
  title: profile.value ? `${profile.value.name} — WeDance` : 'WeDance — Dancer',
}))
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <main>

    <!-- Loading -->
    <section v-if="pending" class="max-w-xl mx-auto px-4 py-24 text-center">
      <div class="inline-block w-8 h-8 rounded-full border-2 animate-spin" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); border-top-color:var(--wd-red-600);" />
    </section>

    <!-- Not found -->
    <section v-else-if="notFound" class="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 class="text-4xl text-foreground">No dancer here</h1>
      <p class="mt-4 text-sm text-muted-foreground font-sans">
        We couldn't find a dancer at <span class="font-bold">@{{ username }}</span>.
      </p>
      <NuxtLink to="/cities" class="inline-flex items-center gap-2 mt-6 text-sm font-bold text-primary font-sans">
        <ArrowLeft class="w-4 h-4" /> Browse cities
      </NuxtLink>
    </section>

    <section v-else class="max-w-xl mx-auto px-4 pt-12 pb-16">
      <!-- Owner-only private banner -->
      <div
        v-if="profile && !profile.isPublic && profile.isOwner"
        class="mb-4 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-secondary font-sans"
        style="background:color-mix(in srgb, var(--wd-amber-600) 7.8%, transparent);"
      >
        <EyeOff class="w-4 h-4 shrink-0" />
        <span>Your profile is <b>private</b> — only you can see this. Make it public in <NuxtLink to="/settings" class="underline font-bold">Settings</NuxtLink>.</span>
      </div>

      <div
        class="rounded-2xl overflow-hidden bg-white border"
        style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-red-600) 13.3%, transparent), 0 10px 28px rgba(59,31,18,0.06);"
      >
        <div class="h-2" style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500));" />
        <div class="p-6 sm:p-8">
          <div class="flex items-start gap-5">
            <div class="shrink-0">
              <img
                v-if="profile?.photo"
                :src="profile.photo"
                :alt="profile?.name"
                class="w-20 h-20 rounded-full object-cover"
                style="border:2px solid color-mix(in srgb, var(--wd-red-600) 20%, transparent);"
              >
              <div
                v-else
                class="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500));"
              >{{ initials }}</div>
            </div>

            <div class="min-w-0 flex-1">
              <h1 class="text-3xl leading-tight text-foreground">{{ profile?.name }}</h1>
              <div class="text-sm mt-0.5 text-secondary font-display italic" style="font-size:18px;">@{{ profile?.username }}</div>
              <div v-if="profile?.city" class="flex items-center gap-1 mt-2 text-xs text-muted-foreground font-sans">
                <MapPin class="w-3 h-3 text-secondary" /> {{ profile.city }}
              </div>
              <div v-if="profile?.role" class="mt-1 text-xs text-muted-foreground font-sans">
                {{ roleLabel[profile.role] || profile.role }}
              </div>
            </div>

            <Button v-if="profile?.isOwner" as-child variant="soft" size="pill-sm" class="shrink-0 px-3">
              <NuxtLink to="/settings">
                <Pencil class="size-3" aria-hidden="true" /> Edit
              </NuxtLink>
            </Button>
          </div>

          <!-- Bio -->
          <p v-if="profile?.bio" class="mt-5 text-sm leading-relaxed text-muted-foreground font-sans">{{ profile.bio }}</p>

          <!-- Social links -->
          <div v-if="igUrl || ytUrl || siteUrl" class="mt-4 flex items-center gap-2">
            <a v-if="igUrl" :href="igUrl" target="_blank" rel="noopener" class="inline-flex items-center justify-center w-9 h-9 rounded-full text-primary" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent);" aria-label="Instagram"><Instagram class="w-4 h-4" /></a>
            <a v-if="ytUrl" :href="ytUrl" target="_blank" rel="noopener" class="inline-flex items-center justify-center w-9 h-9 rounded-full text-primary" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent);" aria-label="YouTube"><Youtube class="w-4 h-4" /></a>
            <a v-if="siteUrl" :href="siteUrl" target="_blank" rel="noopener" class="inline-flex items-center justify-center w-9 h-9 rounded-full text-primary" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent);" aria-label="Website"><Globe class="w-4 h-4" /></a>
          </div>

          <!-- Styles -->
          <div v-if="profile?.danceStyles?.length" class="mt-6">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mb-2 text-secondary font-sans">Dances</div>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="s in profile.danceStyles"
                :key="s"
                class="px-2.5 py-1 rounded-full text-meta font-bold uppercase tracking-wider text-primary"
                style="background:color-mix(in srgb, var(--wd-red-600) 9.4%, transparent);"
              >{{ s }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Videos (activity) -->
      <div v-if="profile?.videos?.length" class="mt-6">
        <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mb-3 text-secondary font-sans">Videos</div>
        <div class="grid grid-cols-2 gap-3">
          <a
            v-for="v in profile.videos"
            :key="v.id"
            :href="v.videoUrl"
            target="_blank"
            rel="noopener"
            class="group block rounded-xl overflow-hidden bg-white border"
            style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent);"
          >
            <div class="relative aspect-video bg-black/5">
              <img v-if="v.thumbnailUrl" :src="v.thumbnailUrl" :alt="v.title" class="w-full h-full object-cover">
              <div class="absolute inset-0 flex items-center justify-center">
                <div class="w-9 h-9 rounded-full flex items-center justify-center text-white" style="background:rgba(220,38,38,0.85);"><Play class="w-4 h-4" /></div>
              </div>
            </div>
            <div class="p-2.5">
              <div class="text-xs font-bold truncate text-foreground font-sans">{{ v.title }}</div>
              <div v-if="v.danceStyle" class="text-eyebrow mt-0.5 text-secondary font-sans">{{ v.danceStyle }} · {{ v.citySlug }}</div>
            </div>
          </a>
        </div>
      </div>
    </section>
    </main>

    <SiteFooter />
  </div>
</template>
