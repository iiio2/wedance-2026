<script setup lang="ts">
import type { Workshop, Teacher, PlanEntry, DanceRole } from '~/types/festival'
import { UserPlus, Check, Heart, Calendar, ArrowRight } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

const props = defineProps<{
  festivalName: string
  workshops: Workshop[]
  teachers: Teacher[]
  sharer: { name: string; photo: string; role: DanceRole }
  sharerPlan: { workshopId: string; role: DanceRole | null; partnerStatus: string }[]
  hasReferral: boolean
  referralInfo?: { referrerName: string; discountPercent: number } | null
  /** Hide the button when there is nobody to add (own plan, or a signed-in
   *  visitor on an old link that doesn't carry the sharer's id). */
  canAddFriend?: boolean
  friendAdded?: boolean
  friendPending?: boolean
}>()

const emit = defineEmits<{
  'add-friend': []
  'be-partner': [workshopId: string]
  'create-plan': []
  'sign-in': []
}>()

function addFriend() {
  // Don't claim success locally — the parent owns the real action (sign up,
  // then follow). The friendAdded prop flips only once that completes.
  emit('add-friend')
}

const planned = computed(() => {
  const planMap = new Map(props.sharerPlan.map((e) => [e.workshopId, e]))
  return props.workshops
    .filter((w) => planMap.has(w.id))
    .sort((a, b) => {
      const dayOrder = ['Thursday', 'Friday', 'Saturday', 'Sunday']
      const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
      if (dayDiff !== 0) return dayDiff
      return a.time.localeCompare(b.time)
    })
    .map((w) => ({ workshop: w, entry: planMap.get(w.id)! }))
})

const groupedByDay = computed(() => {
  const map = new Map<string, typeof planned.value>()
  for (const item of planned.value) {
    const list = map.get(item.workshop.day) || []
    list.push(item)
    map.set(item.workshop.day, list)
  }
  return map
})

const lookingCount = computed(() =>
  props.sharerPlan.filter((e) => e.partnerStatus === 'looking').length,
)

function teacherFor(workshop: Workshop): Teacher | undefined {
  return props.teachers.find((t) => t.id === workshop.teacherId)
}

const roleLabel: Record<DanceRole, string> = { lead: 'Lead', follow: 'Follow' }
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
    <!-- Sharer profile card -->
    <div class="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-6 text-center space-y-4">
      <img
        :src="sharer.photo"
        :alt="sharer.name"
        class="w-16 h-16 rounded-full object-cover mx-auto border-2 border-primary/20"
      />
      <div>
        <h2 class="text-lg font-semibold">{{ sharer.name }}'s Plan</h2>
        <p class="text-sm text-muted-foreground">{{ festivalName }}</p>
        <div class="flex items-center justify-center gap-2 mt-2">
          <Badge variant="secondary">{{ sharer.role === 'lead' ? 'Lead' : 'Follow' }}</Badge>
          <Badge variant="outline">{{ planned.length }} workshops</Badge>
          <Badge v-if="lookingCount > 0" variant="outline" class="bg-orange-50 text-orange-600 border-orange-200">
            {{ lookingCount }} needs partner
          </Badge>
        </div>
      </div>

      <!-- Add friend button -->
      <Button
        v-if="canAddFriend !== false && !friendAdded"
        variant="outline"
        class="mx-auto"
        :disabled="friendPending"
        @click="addFriend"
      >
        <UserPlus class="w-4 h-4 mr-2" />
        Add {{ sharer.name }} as friend
      </Button>
      <div v-else-if="friendAdded" class="space-y-1">
        <Button variant="outline" class="mx-auto" disabled>
          <Check class="w-4 h-4 mr-2" />
          Following {{ sharer.name }}
        </Button>
        <p class="text-xs text-muted-foreground">You're friends once {{ sharer.name }} adds you back.</p>
      </div>
    </div>

    <!-- Referral discount -->
    <div v-if="hasReferral" class="rounded-lg border bg-green-50 border-green-200 p-4 flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
        <span class="text-green-600 text-sm font-bold">%</span>
      </div>
      <div>
        <p class="text-sm font-medium text-green-800">
          {{ referralInfo?.referrerName || sharer.name }} shared a referral link
        </p>
        <p class="text-xs text-green-700">
          Buy your ticket here and you both get {{ referralInfo?.discountPercent || 10 }}% off.
        </p>
      </div>
    </div>

    <!-- Plan workshops -->
    <div class="space-y-4">
      <h3 class="text-base font-semibold">Their Plan</h3>

      <div v-for="[day, items] in groupedByDay" :key="day">
        <p class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{{ day }}</p>
        <div class="space-y-1">
          <div
            v-for="{ workshop: w, entry } in items"
            :key="w.id"
            class="rounded-lg border p-3"
            :class="entry.partnerStatus === 'looking' ? 'border-orange-200 bg-orange-50/50' : ''"
          >
            <div class="flex items-center justify-between">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium leading-tight">{{ w.title }}</p>
                <p v-if="w.type === 'party'" class="text-xs text-muted-foreground">
                  {{ w.time }}<span v-if="w.venue"> · {{ w.venue }}</span>
                </p>
                <p v-else class="text-xs text-muted-foreground">
                  {{ w.time }} · {{ w.room }}<span v-if="teacherFor(w)"> · {{ teacherFor(w)!.name }}</span>
                </p>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <Badge v-if="entry.role" variant="secondary" class="text-eyebrow px-1.5 py-0">
                  {{ roleLabel[entry.role] }}
                </Badge>
                <Badge
                  v-if="entry.partnerStatus === 'looking'"
                  variant="outline"
                  class="text-eyebrow px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200"
                >
                  Needs partner
                </Badge>
              </div>
            </div>

            <!-- Be their partner CTA -->
            <Button
              v-if="entry.partnerStatus === 'looking'"
              size="sm"
              variant="outline"
              class="mt-2 text-xs border-orange-300 text-orange-700 hover:bg-orange-50"
              @click="emit('be-partner', w.id)"
            >
              <Heart class="w-3 h-3 mr-1" />
              Be their partner for this workshop
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA: Create your own plan -->
    <div class="rounded-xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-6 text-center space-y-3">
      <Calendar class="w-8 h-8 text-primary mx-auto" />
      <h3 class="text-base font-semibold">Plan your own festival</h3>
      <p class="text-sm text-muted-foreground">
        Browse the schedule, pick workshops, and share your plan with friends.
      </p>
      <Button @click="emit('create-plan')">
        Create my plan
        <ArrowRight class="w-4 h-4 ml-1.5" />
      </Button>
    </div>
  </div>
</template>
