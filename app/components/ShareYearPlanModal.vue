<script setup lang="ts">
import type { YearPlanFestival } from '~/types/festival'
import { Link, Gift, Copy, Check } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { WD } from '~/lib/brand'
import { initialOf } from '#shared/utils/initials'

const props = defineProps<{
  open: boolean
  festivals: YearPlanFestival[]
  sharerName: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const copied = ref(false)

const { dancerId, username } = useAuth()

const baseUrl = computed(() => {
  if (import.meta.client) {
    return window.location.origin
  }
  return ''
})

const referralCode = computed(() => username.value || dancerId.value || '')

const shareUrl = computed(() => {
  const user = username.value || dancerId.value || 'shared'
  const base = `${baseUrl.value}/my-year?user=${encodeURIComponent(user)}`
  if (referralCode.value) {
    return `${base}&ref=${encodeURIComponent(referralCode.value)}`
  }
  return base
})

const totalWorkshops = computed(() => props.festivals.reduce((sum, f) => sum + f.workshopCount, 0))

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sMonth = s.toLocaleString('en', { month: 'short' })
  const eMonth = e.toLocaleString('en', { month: 'short' })
  if (sMonth === eMonth) {
    return `${sMonth} ${s.getDate()}–${e.getDate()}`
  }
  return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`
}

// plan_shared (C4): the share intent; `shared_plan_viewed` is the other end.
const trackShare = (method: 'copy' | 'native') =>
  useTrack().track('plan_shared', { object: 'year', method, festivals: props.festivals.length, surface: 'year-modal' })

async function copyLink(fromNative = false) {
  if (!fromNative) trackShare('copy')
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // fallback
  }
}

async function nativeShare() {
  trackShare(navigator.share ? 'native' : 'copy')
  if (navigator.share) {
    try {
      await navigator.share({
        title: `My 2026 Dance Year`,
        text: `Check out my ${props.festivals.length} festival plan for 2026! ${totalWorkshops.value} workshops across the year.`,
        url: shareUrl.value,
      })
    } catch {
      // user cancelled
    }
  } else {
    copyLink(true)
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Share Your Year Plan</DialogTitle>
        <DialogDescription>
          Share your {{ festivals.length }} festival plan for 2026.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2 overflow-y-auto flex-1 -mx-6 px-6">
        <!-- Share link -->
        <div class="rounded-lg border p-4 space-y-3">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Link class="w-4 h-4 text-primary" />
            </div>
            <div>
              <p class="text-sm font-medium">Share your year plan</p>
              <p class="text-xs text-muted-foreground">Friends can see your festivals, open partner slots, and referral links</p>
            </div>
          </div>

          <div class="flex gap-2">
            <div class="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground truncate">
              {{ shareUrl }}
            </div>
            <Button
              size="sm"
              variant="outline"
              class="shrink-0"
              @click="copyLink()"
            >
              <component :is="copied ? Check : Copy" class="w-3.5 h-3.5 mr-1" />
              {{ copied ? 'Copied!' : 'Copy' }}
            </Button>
          </div>

          <Button
            class="w-full"
            size="sm"
            @click="nativeShare"
          >
            Share via...
          </Button>
        </div>

        <!-- Referral note -->
        <div class="rounded-lg border border-dashed p-4 space-y-2">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Gift class="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p class="text-sm font-medium">Referral links included</p>
              <p class="text-xs text-muted-foreground">For festivals you have tickets to, friends get your referral link — you both save.</p>
            </div>
          </div>
        </div>

        <!-- Preview -->
        <div class="rounded-lg border bg-muted/30 p-4">
          <p class="text-xs font-medium text-muted-foreground mb-2">What they'll see:</p>
          <div class="space-y-2">
            <div
              v-for="f in festivals"
              :key="f.slug"
              class="flex items-center gap-2 text-xs"
            >
              <img v-if="f.logo" :src="f.logo" :alt="f.name" class="w-6 h-6 rounded object-cover shrink-0" />
              <div
                v-else
                class="w-6 h-6 rounded flex items-center justify-center text-eyebrow font-bold text-white shrink-0"
                :style="{ background: f.accentColor || WD.amber600 }"
              >
                {{ initialOf(f.name) }}
              </div>
              <span class="font-medium flex-1 truncate">{{ f.name }}</span>
              <span class="text-muted-foreground shrink-0">{{ formatDateRange(f.startDate, f.endDate) }}</span>
              <Badge
                v-if="f.lookingCount > 0"
                variant="outline"
                class="text-tag px-1 py-0 bg-orange-50 text-orange-600 border-orange-200 shrink-0"
              >
                {{ f.lookingCount }} partner
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
