<script setup lang="ts">
import type { Workshop, PlanEntry, DanceRole, Teacher } from '~/types/festival'
import { Link, UserPlus, Gift, Copy, Check, ExternalLink } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { festivalPath } from '#shared/utils/eventSlug'

const props = defineProps<{
  open: boolean
  workshops: Workshop[]
  teachers: Teacher[]
  plan: Map<string, PlanEntry>
  planIds: Set<string>
  festivalName: string
  festivalSlug: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const copied = ref(false)
const activeTab = ref<'link' | 'preview'>('link')

const { dancerName, dancerId, username, role } = useAuth()
const { buildShareUrl } = useSharePlan()

const shareUrl = computed(() => {
  const name = dancerName.value || 'A dancer'
  const danceRole = (role.value === 'lead' || role.value === 'follow') ? role.value : 'follow'
  return buildShareUrl(props.festivalSlug, name, danceRole as DanceRole, props.plan, dancerId.value)
})

const baseUrl = computed(() => {
  if (import.meta.client) {
    return window.location.origin
  }
  return ''
})

const referralCode = computed(() => username.value || dancerId.value || '')
const referralUrl = computed(() => {
  if (!referralCode.value) return ''
  return `${baseUrl.value}${festivalPath(props.festivalSlug)}?ref=${encodeURIComponent(referralCode.value)}`
})

const planned = computed(() => {
  return props.workshops
    .filter((w) => props.planIds.has(w.id))
    .sort((a, b) => {
      const dayOrder = ['Thursday', 'Friday', 'Saturday', 'Sunday']
      const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
      if (dayDiff !== 0) return dayDiff
      return a.time.localeCompare(b.time)
    })
})

const groupedByDay = computed(() => {
  const map = new Map<string, Workshop[]>()
  for (const w of planned.value) {
    const list = map.get(w.day) || []
    list.push(w)
    map.set(w.day, list)
  }
  return map
})

const lookingCount = computed(() => {
  let count = 0
  for (const entry of props.plan.values()) {
    if (entry.partnerStatus === 'looking') count++
  }
  return count
})

function entryFor(workshopId: string): PlanEntry | undefined {
  return props.plan.get(workshopId)
}

function teacherFor(workshop: Workshop): Teacher | undefined {
  return props.teachers.find((t) => t.id === workshop.teacherId)
}

const roleLabel: Record<DanceRole, string> = { lead: 'Lead', follow: 'Follow' }

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // fallback: select text
  }
}

async function nativeShare() {
  useTrack().track('shared_plan_signup', {
    surface: 'share-modal',
    slug: props.festivalSlug,
    workshopCount: planned.value.length,
    method: navigator.share ? 'native' : 'clipboard',
  })
  if (navigator.share) {
    try {
      await navigator.share({
        title: `My plan for ${props.festivalName}`,
        text: `Check out my ${planned.value.length} workshop plan for ${props.festivalName}!`,
        url: shareUrl.value,
      })
    } catch {
      // user cancelled
    }
  } else {
    copyLink(shareUrl.value)
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Share Your Plan</DialogTitle>
        <DialogDescription>
          Share your {{ planned.length }} workshop plan for {{ festivalName }}.
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
              <p class="text-sm font-medium">Share your plan</p>
              <p class="text-xs text-muted-foreground">Anyone with the link can see your workshops and open partner slots</p>
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
              @click="copyLink(shareUrl)"
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

        <!-- Invite with referral -->
        <div class="rounded-lg border border-dashed p-4 space-y-3">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
              <Gift class="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p class="text-sm font-medium">Invite & save together</p>
              <p class="text-xs text-muted-foreground">Share your referral link. If a friend buys a ticket, you both get a discount.</p>
            </div>
          </div>

          <div class="flex gap-2">
            <div class="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground truncate">
              {{ referralUrl }}
            </div>
            <Button
              size="sm"
              variant="outline"
              class="shrink-0"
              @click="copyLink(referralUrl)"
            >
              <Copy class="w-3.5 h-3.5 mr-1" />
              Copy
            </Button>
          </div>
        </div>

        <!-- Plan preview -->
        <div class="rounded-lg border bg-muted/30 p-4">
          <p class="text-xs font-medium text-muted-foreground mb-2">What they'll see:</p>
          <div class="space-y-3">
            <div v-for="[day, dayWorkshops] in groupedByDay" :key="day">
              <p class="text-eyebrow font-semibold text-muted-foreground uppercase tracking-wider mb-1">{{ day }}</p>
              <div class="space-y-1">
                <div
                  v-for="w in dayWorkshops"
                  :key="w.id"
                  class="flex items-center gap-2 text-xs"
                >
                  <span class="text-muted-foreground w-12 shrink-0">{{ w.time }}</span>
                  <span class="font-medium flex-1 truncate">{{ w.title }}</span>
                  <Badge
                    v-if="entryFor(w.id)?.partnerStatus === 'looking'"
                    variant="outline"
                    class="text-tag px-1 py-0 bg-orange-50 text-orange-600 border-orange-200 shrink-0"
                  >
                    Needs partner
                  </Badge>
                  <Badge
                    v-else-if="entryFor(w.id)?.role"
                    variant="secondary"
                    class="text-tag px-1 py-0 shrink-0"
                  >
                    {{ roleLabel[entryFor(w.id)!.role!] }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <p v-if="lookingCount > 0" class="mt-3 text-eyebrow text-orange-600 font-medium">
            Looking for a partner in {{ lookingCount }} {{ lookingCount === 1 ? 'workshop' : 'workshops' }}
          </p>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
