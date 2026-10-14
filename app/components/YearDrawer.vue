<script setup lang="ts">
import { X, CalendarDays, Save, MapPin, Calendar, Check, ChevronDown, Target, Wallet, Clock, Users, CalendarPlus, ExternalLink, Footprints, GraduationCap, Video } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { GoalSchema, validateForm } from '#shared/validation'
import { festivalPath } from '#shared/utils/eventSlug'

interface FestivalSummary {
  slug: string
  name: string
  startDate: string
  endDate: string
  location: string
  logo: string
  accentColor: string
  styles: string[]
  friendsGoing?: number
  earlyBirdDeadline?: string
}

const props = defineProps<{
  festivals: FestivalSummary[]
  yearPlanIds: Set<string>
}>()

const emit = defineEmits<{
  remove: [slug: string]
  share: []
  'sign-in': []
  close: []
}>()

const picked = computed(() =>
  props.festivals
    .filter((f) => props.yearPlanIds.has(f.slug))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
)

const count = computed(() => props.yearPlanIds.size)

function formatDateRange(start: string, end: string) {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const sameMonth = s.getMonth() === e.getMonth()
  if (sameMonth) {
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${e.getDate()}`
  }
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

// Checklist state
const checklist = ref<Record<string, boolean>>({
  goals: false,
  budget: false,
  timeOff: false,
  shoes: false,
  classes: false,
  reel: false,
})

function toggleCheck(key: string) {
  checklist.value[key] = !checklist.value[key]
}

// Expandable sections
const festivalsExpanded = ref(true)
const goalsExpanded = ref(false)
const budgetExpanded = ref(false)
const earlyBirdsExpanded = ref(false)
const buddiesExpanded = ref(false)
const timeOffExpanded = ref(false)

// Auto-checks
const hasFestivals = computed(() => count.value > 0)

// Early bird deadlines
const earlyBirdFestivals = computed(() => {
  const now = new Date()
  return picked.value
    .filter((f) => f.earlyBirdDeadline && new Date(f.earlyBirdDeadline) > now)
    .sort((a, b) => a.earlyBirdDeadline!.localeCompare(b.earlyBirdDeadline!))
})

function daysUntilDeadline(dateStr: string) {
  const now = new Date()
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const allEarlyBirdsPast = computed(() => {
  if (!picked.value.some((f) => f.earlyBirdDeadline)) return true
  return earlyBirdFestivals.value.length === 0
})

// Friends / travel buddies
const festivalsWithFriends = computed(() =>
  picked.value.filter((f) => f.friendsGoing && f.friendsGoing > 0)
)
const hasBuddies = computed(() => festivalsWithFriends.value.length > 0)

// Dance goals
const danceGoals = ref<string[]>([])
const newGoal = ref('')
const newGoalResult = computed(() => validateForm(GoalSchema, { title: newGoal.value }))

function addGoal() {
  if (!newGoalResult.value.success) return
  danceGoals.value.push(newGoalResult.value.data.title)
  newGoal.value = ''
}

function removeGoal(index: number) {
  danceGoals.value.splice(index, 1)
}

// Budget
const yearBudget = ref<number | null>(null)

// Google Calendar link for all festivals
const calendarUrl = computed(() => {
  if (picked.value.length === 0) return null
  // For multiple events, link to the first one — user can add individually
  // Or use a single "block" covering the whole year range
  const first = picked.value[0]
  const last = picked.value[picked.value.length - 1]
  const title = encodeURIComponent(`Dance Festivals 2026 (${picked.value.length} events)`)
  const start = first.startDate.replace(/-/g, '')
  const endDate = new Date(last.endDate)
  endDate.setDate(endDate.getDate() + 1)
  const end = endDate.toISOString().slice(0, 10).replace(/-/g, '')
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}`
})

function singleCalendarUrl(f: FestivalSummary) {
  const title = encodeURIComponent(f.name)
  const start = f.startDate.replace(/-/g, '')
  const endDate = new Date(f.endDate)
  endDate.setDate(endDate.getDate() + 1)
  const end = endDate.toISOString().slice(0, 10).replace(/-/g, '')
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}`
}

// Completion counter
const completedCount = computed(() => {
  let done = 0
  if (hasFestivals.value) done++
  if (danceGoals.value.length > 0) done++
  if (yearBudget.value && yearBudget.value > 0) done++
  if (allEarlyBirdsPast.value && hasFestivals.value) done++
  if (hasBuddies.value) done++
  for (const key of ['timeOff', 'shoes', 'classes', 'reel']) {
    if (checklist.value[key]) done++
  }
  return done
})

const totalItems = 9

const simpleChecklistItems = [
  { key: 'shoes', icon: Footprints, label: 'Get dance shoes', hint: 'Different styles, different shoes' },
  { key: 'classes', icon: GraduationCap, label: 'Take classes', hint: 'Weekly classes to prep' },
  { key: 'reel', icon: Video, label: 'Build dance reel', hint: 'Record social dances' },
]
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
      <div class="flex items-center gap-2">
        <CalendarDays class="w-4 h-4" />
        <span class="text-sm font-semibold">My Year</span>
        <span v-if="completedCount > 0" class="bg-primary-foreground/20 text-xs font-medium px-1.5 py-0.5 rounded">{{ completedCount }}/{{ totalItems }}</span>
      </div>
      <Button variant="ghost" size="icon-sm" class="lg:hidden hover:bg-primary-foreground/10 hover:text-primary-foreground" aria-label="Close my year" @click="emit('close')">
        <X aria-hidden="true" />
      </Button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <div class="divide-y">

        <!-- 1. Pick festivals (auto-checked, expandable) -->
        <div class="px-4 py-2.5">
          <button
            type="button"
            class="w-full flex items-center gap-3"
            :aria-expanded="festivalsExpanded"
            @click="festivalsExpanded = !festivalsExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="hasFestivals ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
            >
              <Check v-if="hasFestivals" class="w-3 h-3 text-primary-foreground" />
            </div>
            <CalendarDays class="w-4 h-4 shrink-0" :class="hasFestivals ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left">
              Pick festivals
              <span class="text-xs text-muted-foreground font-normal ml-1">{{ count > 0 ? `${count} going` : 'Tap Going? on cards' }}</span>
            </span>
            <ChevronDown
              v-if="count > 0"
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="festivalsExpanded ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="festivalsExpanded && count > 0" class="ml-8 mt-2 space-y-1">
            <div
              v-for="f in picked"
              :key="f.slug"
              class="py-2 flex items-start justify-between gap-2"
            >
              <NuxtLink :to="`${festivalPath(f.slug)}`" class="flex items-start gap-2 min-w-0 hover:text-primary transition-colors">
                <img
                  v-if="f.logo"
                  :src="f.logo"
                  :alt="f.name"
                  class="w-6 h-6 rounded-full shrink-0"
                />
                <div
                  v-else
                  class="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-tag font-bold text-white"
                  :style="{ backgroundColor: f.accentColor }"
                >
                  {{ f.name.charAt(0) }}
                </div>
                <div class="min-w-0">
                  <p class="text-xs font-medium leading-tight">{{ f.name }}</p>
                  <p class="text-meta text-muted-foreground">
                    {{ formatDateRange(f.startDate, f.endDate) }} · {{ f.location }}
                  </p>
                </div>
              </NuxtLink>
              <Button
                variant="ghost"
                size="icon-sm"
                class="shrink-0 size-7 text-muted-foreground hover:text-destructive [&_svg]:size-3"
                :aria-label="`Remove ${f.name}`"
                @click="emit('remove', f.slug)"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        <!-- 2. Set dance goals (expandable) -->
        <div class="px-4 py-2.5">
          <button
            type="button"
            class="w-full flex items-center gap-3"
            :aria-expanded="goalsExpanded"
            @click="goalsExpanded = !goalsExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="danceGoals.length > 0 ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
            >
              <Check v-if="danceGoals.length > 0" class="w-3 h-3 text-primary-foreground" />
            </div>
            <Target class="w-4 h-4 shrink-0" :class="danceGoals.length > 0 ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left">
              Set dance goals
              <span v-if="danceGoals.length > 0" class="text-xs text-muted-foreground font-normal ml-1">{{ danceGoals.length }} goals</span>
              <span v-else class="text-xs text-muted-foreground font-normal ml-1">Styles to learn, levels to reach</span>
            </span>
            <ChevronDown
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="goalsExpanded ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="goalsExpanded" class="ml-8 mt-2 space-y-2">
            <div v-for="(goal, i) in danceGoals" :key="i" class="flex items-center justify-between gap-2">
              <span class="text-xs">{{ goal }}</span>
              <Button variant="ghost" size="icon-sm" class="size-7 text-muted-foreground hover:text-destructive [&_svg]:size-3" :aria-label="`Remove goal: ${goal}`" @click="removeGoal(i)">
                <X aria-hidden="true" />
              </Button>
            </div>
            <form class="flex gap-1.5" novalidate @submit.prevent="addGoal">
              <Field id="year-drawer-new-goal" label="New goal" hide-label class="flex-1">
                <Input v-model="newGoal" size="sm" class="text-xs" placeholder="e.g. Learn Bachata Sensual" />
              </Field>
              <Button type="submit" size="sm" variant="outline" class="text-xs px-2 shrink-0" :disabled="!newGoalResult.success">
                Add
              </Button>
            </form>
          </div>
        </div>

        <!-- 3. Set budget (expandable) -->
        <div class="px-4 py-2.5">
          <button
            type="button"
            class="w-full flex items-center gap-3"
            :aria-expanded="budgetExpanded"
            @click="budgetExpanded = !budgetExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="yearBudget && yearBudget > 0 ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
            >
              <Check v-if="yearBudget && yearBudget > 0" class="w-3 h-3 text-primary-foreground" />
            </div>
            <Wallet class="w-4 h-4 shrink-0" :class="yearBudget && yearBudget > 0 ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left">
              Set budget
              <span v-if="yearBudget && yearBudget > 0" class="text-xs text-muted-foreground font-normal ml-1">€{{ yearBudget }}</span>
              <span v-else class="text-xs text-muted-foreground font-normal ml-1">Travel + tickets</span>
            </span>
            <ChevronDown
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="budgetExpanded ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="budgetExpanded" class="ml-8 mt-2 space-y-2">
            <Field id="year-drawer-budget" label="Year budget (€)">
              <Input v-model.number="yearBudget" type="number" min="0" step="50" inputmode="numeric" size="sm" class="text-xs" placeholder="2000" />
            </Field>
            <p class="text-xs text-muted-foreground">
              {{ count }} festivals picked — budget covers tickets, travel, accommodation, and food for the year.
            </p>
          </div>
        </div>

        <!-- 4. Book early birds (auto-checked, expandable) -->
        <div class="px-4 py-2.5">
          <button
            type="button"
            class="w-full flex items-center gap-3"
            :aria-expanded="earlyBirdsExpanded"
            @click="earlyBirdsExpanded = !earlyBirdsExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="allEarlyBirdsPast && hasFestivals ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
            >
              <Check v-if="allEarlyBirdsPast && hasFestivals" class="w-3 h-3 text-primary-foreground" />
            </div>
            <Clock class="w-4 h-4 shrink-0" :class="earlyBirdFestivals.length > 0 ? 'text-orange-500' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left">
              Book early birds
              <span v-if="earlyBirdFestivals.length > 0" class="text-xs text-orange-600 font-normal ml-1">{{ earlyBirdFestivals.length }} upcoming</span>
              <span v-else class="text-xs text-muted-foreground font-normal ml-1">Don't miss discounts</span>
            </span>
            <ChevronDown
              v-if="earlyBirdFestivals.length > 0"
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="earlyBirdsExpanded ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="earlyBirdsExpanded && earlyBirdFestivals.length > 0" class="ml-8 mt-2 space-y-1.5">
            <div
              v-for="f in earlyBirdFestivals"
              :key="f.slug"
              class="flex items-center justify-between py-1"
            >
              <div class="min-w-0">
                <p class="text-xs font-medium">{{ f.name }}</p>
                <p class="text-meta text-muted-foreground">Deadline: {{ new Date(f.earlyBirdDeadline! + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }}</p>
              </div>
              <span
                class="text-eyebrow font-semibold px-1.5 py-0.5 rounded shrink-0"
                :class="daysUntilDeadline(f.earlyBirdDeadline!) <= 14 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'"
              >
                {{ daysUntilDeadline(f.earlyBirdDeadline!) }}d left
              </span>
            </div>
          </div>
        </div>

        <!-- 5. Find travel buddies (auto-checked, expandable) -->
        <div class="px-4 py-2.5">
          <button
            type="button"
            class="w-full flex items-center gap-3"
            :aria-expanded="buddiesExpanded"
            @click="buddiesExpanded = !buddiesExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="hasBuddies ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
            >
              <Check v-if="hasBuddies" class="w-3 h-3 text-primary-foreground" />
            </div>
            <Users class="w-4 h-4 shrink-0" :class="hasBuddies ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left">
              Find travel buddies
              <span v-if="hasBuddies" class="text-xs text-muted-foreground font-normal ml-1">{{ festivalsWithFriends.length }} festivals with friends</span>
              <span v-else class="text-xs text-muted-foreground font-normal ml-1">Who's going?</span>
            </span>
            <ChevronDown
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="buddiesExpanded ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="buddiesExpanded" class="ml-8 mt-2 space-y-1.5">
            <div v-if="festivalsWithFriends.length > 0">
              <div
                v-for="f in festivalsWithFriends"
                :key="f.slug"
                class="flex items-center justify-between py-1"
              >
                <span class="text-xs font-medium">{{ f.name }}</span>
                <span class="text-eyebrow text-muted-foreground">{{ f.friendsGoing }} friends going</span>
              </div>
            </div>
            <p v-else class="text-xs text-muted-foreground py-1">
              Share your year plan to find friends going to the same festivals.
            </p>
            <Button size="sm" variant="outline" class="w-full text-xs" @click="emit('share')">
              Share your plan
            </Button>
          </div>
        </div>

        <!-- 6. Plan time off (expandable) -->
        <div class="px-4 py-2.5">
          <button
            type="button"
            class="w-full flex items-center gap-3"
            :aria-expanded="timeOffExpanded"
            @click="timeOffExpanded = !timeOffExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="checklist.timeOff ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
              @click.stop="toggleCheck('timeOff')"
            >
              <Check v-if="checklist.timeOff" class="w-3 h-3 text-primary-foreground" />
            </div>
            <CalendarPlus class="w-4 h-4 shrink-0" :class="checklist.timeOff ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left" :class="checklist.timeOff ? 'line-through text-muted-foreground' : ''">
              Plan time off
              <span v-if="!checklist.timeOff" class="text-xs text-muted-foreground font-normal ml-1">Block your calendar</span>
            </span>
            <ChevronDown
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="timeOffExpanded ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="timeOffExpanded" class="ml-8 mt-2 space-y-2">
            <div v-if="picked.length > 0" class="space-y-1.5">
              <div
                v-for="f in picked"
                :key="f.slug"
                class="flex items-center justify-between py-1"
              >
                <div class="min-w-0">
                  <p class="text-xs font-medium">{{ f.name }}</p>
                  <p class="text-meta text-muted-foreground">{{ formatDateRange(f.startDate, f.endDate) }}</p>
                </div>
                <a
                  :href="singleCalendarUrl(f)"
                  target="_blank"
                  class="text-eyebrow text-primary hover:underline flex items-center gap-0.5 shrink-0"
                  @click.stop
                >
                  <CalendarPlus class="w-3 h-3" />
                </a>
              </div>
            </div>
            <p v-else class="text-xs text-muted-foreground py-1">
              Pick festivals first, then add all dates to your calendar.
            </p>
            <Button
              v-if="calendarUrl && picked.length > 0"
              size="sm"
              variant="outline"
              class="w-full text-xs"
              as="a"
              :href="calendarUrl"
              target="_blank"
            >
              <CalendarPlus class="w-3.5 h-3.5 mr-1.5" />
              Add all to Google Calendar
              <ExternalLink class="w-3 h-3 ml-1.5" />
            </Button>
          </div>
        </div>

        <!-- 7-9. Simple checkboxes -->
        <button
          v-for="item in simpleChecklistItems"
          :key="item.key"
          type="button"
          role="checkbox"
          :aria-checked="!!checklist[item.key]"
          class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
          @click="toggleCheck(item.key)"
        >
          <div
            class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
            :class="checklist[item.key] ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
          >
            <Check v-if="checklist[item.key]" class="w-3 h-3 text-primary-foreground" />
          </div>
          <component :is="item.icon" class="w-4 h-4 shrink-0" :class="checklist[item.key] ? 'text-primary' : 'text-muted-foreground'" />
          <div class="min-w-0">
            <span class="text-sm" :class="checklist[item.key] ? 'line-through text-muted-foreground' : ''">{{ item.label }}</span>
            <span v-if="item.hint && !checklist[item.key]" class="text-xs text-muted-foreground ml-1.5">{{ item.hint }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- Save CTA -->
    <div class="border-t px-4 py-3">
      <Button class="w-full" size="sm" @click="emit('sign-in')">
        <Save class="w-3.5 h-3.5 mr-2" />
        Save my plan
      </Button>
    </div>
  </div>
</template>
