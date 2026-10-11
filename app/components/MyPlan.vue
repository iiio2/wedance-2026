<script setup lang="ts">
import type { Workshop, Teacher, PlanEntry, DanceRole, PartnerStatus, TicketOption, DancePartner } from '~/types/festival'
import { Share2, ChevronDown, ChevronUp, Save, ArrowUp, CalendarDays } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

const props = defineProps<{
  workshops: Workshop[]
  teachers: Teacher[]
  planIds: Set<string>
  plan: Map<string, PlanEntry>
  partners: DancePartner[]
  tickets?: TicketOption[]
  ticketUrl?: string
  isSignedIn?: boolean
  organizerName?: string
}>()

const emit = defineEmits<{
  remove: [id: string]
  save: []
  share: []
  'sign-in': []
  'scroll-schedule': []
  subscribe: []
}>()

const open = ref(true)

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

function teacherFor(workshop: Workshop): Teacher {
  return props.teachers.find((t) => t.id === workshop.teacherId)!
}

const count = computed(() => props.planIds.size)

function entryFor(workshopId: string): PlanEntry | undefined {
  return props.plan.get(workshopId)
}

const roleLabel: Record<DanceRole, string> = { lead: 'Lead', follow: 'Follow' }

function partnerName(entry: PlanEntry): string {
  if (entry.partnerStatus === 'looking') return 'Looking for partner'
  if (entry.partnerStatus === 'with-partner' && entry.partnerId) {
    const p = props.partners.find((pt) => pt.id === entry.partnerId)
    return p ? `with ${p.name}` : 'Have partner'
  }
  if (entry.partnerStatus === 'with-partner') return 'Have partner'
  return ''
}

</script>

<template>
  <div class="fixed bottom-0 left-0 right-0 z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
    <!-- Header bar -->
    <div
      class="bg-primary text-primary-foreground cursor-pointer"
      @click="open = !open"
    >
      <div class="max-w-3xl mx-auto flex items-center justify-between px-4 py-3">
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">My Plan</span>
          <span v-if="count > 0" class="bg-primary-foreground/20 text-primary-foreground text-xs font-medium px-1.5 py-0.5 rounded">{{ count }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Button v-if="count > 0" size="sm" variant="ghost" class="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10" @click.stop="emit('share')">
            <Share2 class="w-3.5 h-3.5 mr-1.5" />
            Share
          </Button>
          <Button v-if="count > 0" size="sm" variant="secondary" @click.stop="emit('save')">
            <Save class="w-3.5 h-3.5 mr-1.5" />
            Save
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            class="text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            :aria-expanded="open"
            aria-controls="my-plan-panel"
            :aria-label="open ? 'Collapse my plan' : 'Expand my plan'"
            @click.stop="open = !open"
          >
            <component :is="open ? ChevronDown : ChevronUp" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Expanded content -->
    <div
      v-if="open"
      id="my-plan-panel"
      class="bg-background border-t overflow-y-auto"
      :class="count > 0 ? 'max-h-[40vh]' : ''"
    >
      <div class="max-w-3xl mx-auto px-4 py-4">
        <div v-if="count > 0" class="space-y-4">
          <div v-for="[day, workshops] in groupedByDay" :key="day">
            <h4 class="text-sm font-medium text-muted-foreground mb-2">{{ day }}</h4>
            <div class="space-y-1">
              <div
                v-for="w in workshops"
                :key="w.id"
                class="py-2 border-b last:border-0"
              >
                <div class="flex items-center justify-between">
                  <div class="min-w-0">
                    <p class="text-sm font-medium leading-tight">{{ w.title }}</p>
                    <p v-if="w.type === 'party'" class="text-xs text-muted-foreground">{{ w.time }}<span v-if="w.venue"> · {{ w.venue }}</span></p>
                    <p v-else class="text-xs text-muted-foreground">{{ w.time }} · {{ w.room }} · {{ teacherFor(w)?.name }}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    class="shrink-0 text-xs text-muted-foreground hover:text-destructive"
                    @click="emit('remove', w.id)"
                  >
                    Remove
                  </Button>
                </div>
                <div v-if="entryFor(w.id)?.role" class="mt-1.5 flex items-center gap-1.5">
                  <Badge variant="secondary" class="text-eyebrow px-1.5 py-0">
                    {{ roleLabel[entryFor(w.id)!.role!] }}
                  </Badge>
                  <Badge
                    v-if="entryFor(w.id)!.partnerStatus !== 'solo'"
                    :variant="entryFor(w.id)!.partnerStatus === 'looking' ? 'outline' : 'secondary'"
                    :class="entryFor(w.id)!.partnerStatus === 'looking' ? 'bg-orange-100 text-orange-700 border-orange-200' : ''"
                    class="text-eyebrow px-1.5 py-0"
                  >
                    {{ partnerName(entryFor(w.id)!) }}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="count === 0" class="text-center py-6 px-4 rounded-2xl border-2 border-dashed border-input bg-white/50">
          <CalendarDays class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
          <p class="text-sm font-bold font-display text-foreground">Build your festival plan</p>
          <p class="text-xs text-muted-foreground mt-1 font-sans">
            Tap the workshops you want to take — they land here, sorted by day.
            Planned before? <Button variant="link" class="h-auto p-0 text-xs font-bold underline text-primary" @click.stop="emit('sign-in')">Sign in</Button> to restore it.
          </p>
          <Button variant="soft" size="pill-sm" class="mt-3" @click.stop="emit('scroll-schedule')">
            <ArrowUp aria-hidden="true" />
            Browse schedule
          </Button>
        </div>

        <!-- Ticket recommendation -->
        <TicketRecommendation
          v-if="tickets?.length"
          :tickets="tickets"
          :workshops="workshops"
          :plan-ids="planIds"
          :ticket-url="ticketUrl"
          :is-signed-in="isSignedIn"
          :organizer-name="organizerName"
          :class="count === 0 ? 'mt-3' : 'mt-4'"
          @join-waitlist="emit('save')"
          @offer-ticket="emit('save')"
          @sign-in="emit('sign-in')"
          @subscribe="emit('subscribe')"
        />
      </div>
    </div>
  </div>
</template>
