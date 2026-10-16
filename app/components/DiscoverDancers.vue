<script setup lang="ts">
import type { DiscoverDancer, DanceListEntry, DanceEndorsement, Workshop, SwipeCard, SwipeCardDinner, SwipeCardActivity, SwipeCardOnboardingDanceCard, SwipeCardOnboardingProfile, DanceRole } from '~/types/festival'
import { Heart, X, Sparkles, Check, ChevronDown, ChevronUp, RotateCcw, Star, MessageCircle, UtensilsCrossed, Compass, Camera, Users, Share2 } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { chilis } from '~/lib/levels'
import { DanceCardSchema, DanceFeedbackSchema, DiscoverProfileSchema, validateForm } from '#shared/validation'

const props = withDefaults(defineProps<{
  /** The festival slug, or the event id when itemType is 'event'. */
  festivalSlug: string
  /** Whose "going" list feeds the deck: a festival's or a plain event's. */
  itemType?: 'festival' | 'event'
  /** Extra non-dancer cards (dinners, activities, onboarding) interleaved into the deck */
  extraCards?: SwipeCard[]
  workshops: Workshop[]
  planIds: Set<string>
  isSignedIn: boolean
  /** "festival", "weekender", "event"… — the wording of the empty state. */
  entityLabel?: string
}>(), { itemType: 'festival', entityLabel: 'event' })

const emit = defineEmits<{
  'sign-in': [action?: string]
  'join-dinner': [id: string]
  'join-activity': [id: string]
  'onboarding-complete': [role: DanceRole, styles: string[], name: string, city: string]
}>()

const { $trpc } = useNuxtApp()

// --- Real data from tRPC ---

// Discover pool: attendees we haven't swiped yet
const poolDancers = ref<DiscoverDancer[]>([])
// Mutual matches (festival friends)
const matchedFriends = ref<DiscoverDancer[]>([])
// How many people liked us that we haven't seen
const pendingLikesCount = ref(0)
const poolLoading = ref(true)

async function loadPool() {
  if (!props.isSignedIn || !props.festivalSlug) {
    poolLoading.value = false
    return
  }
  poolLoading.value = true
  try {
    const [pool, friends, incoming] = await Promise.all([
      $trpc.wave.discoverPool.query({ festivalSlug: props.festivalSlug, itemType: props.itemType }),
      $trpc.wave.friends.query({ festivalSlug: props.festivalSlug }),
      $trpc.wave.incomingCount.query({ festivalSlug: props.festivalSlug }),
    ])
    poolDancers.value = pool.map(d => ({
      id: d.id,
      name: d.name,
      photo: d.photo ?? '',
      role: d.role ?? 'follow',
      styles: d.styles,
      workshopIds: [],
      bio: d.bio ?? '',
    }))
    checkPhotos(poolDancers.value)
    matchedFriends.value = friends.map(d => ({
      id: d.dancerId,
      name: d.name,
      photo: d.photo ?? '',
      role: (d.role as DanceRole) ?? 'follow',
      styles: ((d.danceStyles as string[]) ?? []).map(s => ({ name: s, level: 'Beginner' as const })),
      workshopIds: [],
      bio: '',
    }))
    pendingLikesCount.value = incoming
  } catch {
    // non-critical — fall back to empty
  } finally {
    poolLoading.value = false
  }
}

onMounted(loadPool)

// --- Empty deck (RAZ-440) ---
// The deck only holds dancers who are going AND chose to be seen (plan_items
// share_going, off by default), with a public profile and a photo. Until
// someone does that the deck is empty, which used to render nothing at all.
// The empty state says why and lets the dancer be the first one in it.
const { yearPlanIds, loadFromDb: reloadYearPlan } = useYearPlan()
const { weekPlanIds, loadFromDb: reloadWeekPlan } = useWeekPlan()
const isGoing = computed(() => props.itemType === 'festival'
  ? yearPlanIds.value.has(props.festivalSlug)
  : weekPlanIds.value.has(props.festivalSlug))
const visible = ref(false)
const joining = ref(false)
const joinError = ref('')
const linkCopied = ref(false)

const deckEmpty = computed(() => !poolLoading.value
  && poolDancers.value.length === 0 && !(props.extraCards?.length))

async function loadVisible() {
  if (!props.isSignedIn || !props.festivalSlug || !isGoing.value) { visible.value = false; return }
  try {
    visible.value = (await $trpc.plan.getShareGoing.query({ itemType: props.itemType, itemId: props.festivalSlug })).share
  } catch { /* stays off */ }
}
watch([deckEmpty, isGoing], ([empty]) => { if (empty) loadVisible() }, { immediate: true })

/** Mark going (if not yet) and switch on "show me", so others find you here. */
async function joinDeck() {
  if (joining.value) return
  joining.value = true
  joinError.value = ''
  try {
    if (!isGoing.value) {
      await $trpc.plan.add.mutate({ itemType: props.itemType, itemId: props.festivalSlug })
      await (props.itemType === 'festival' ? reloadYearPlan() : reloadWeekPlan())
    }
    await $trpc.plan.setShareGoing.mutate({ itemType: props.itemType, itemId: props.festivalSlug, share: true })
    visible.value = true
  } catch {
    joinError.value = 'Could not save that. Please try again.'
  } finally {
    joining.value = false
  }
}

async function inviteFriends() {
  const url = window.location.href.split('#')[0]
  try {
    if (navigator.share) await navigator.share({ url, title: document.title })
    else {
      await navigator.clipboard.writeText(url)
      linkCopied.value = true
      setTimeout(() => { linkCopied.value = false }, 2500)
    }
  } catch { /* share sheet dismissed */ }
}
watch(() => props.festivalSlug, loadPool)
watch(() => props.isSignedIn, loadPool)

// Swipe state — tracks IDs swiped during this session (pool already excludes
// previously swiped dancers, so these only track the current session)
const liked = ref(new Set<string>())
const passed = ref(new Set<string>())

// A card is a photo: one that fails to load (404, not an image) drops out
// of the deck. Preloaded so a broken card is gone before it's shown; the
// card's own @error catches anything the preload missed.
const brokenPhotos = ref(new Set<string>())
function markBroken(id: string) {
  if (!brokenPhotos.value.has(id)) brokenPhotos.value = new Set([...brokenPhotos.value, id])
}
function checkPhotos(list: DiscoverDancer[]) {
  if (!import.meta.client) return
  for (const d of list) {
    if (!d.photo) { markBroken(d.id); continue }
    const img = new Image()
    img.onerror = () => markBroken(d.id)
    img.src = d.photo
  }
}

// Merged deck: dancer cards from the pool + extra cards (dinners, activities, onboarding)
const allCards = computed<SwipeCard[]>(() => {
  const dancers: SwipeCard[] = poolDancers.value
    .filter(d => !liked.value.has(d.id) && !passed.value.has(d.id) && !brokenPhotos.value.has(d.id))
    .map(d => ({ ...d, cardType: 'dancer' as const }))
  const extras = props.extraCards ?? []

  // Interleave: after every 3 dancers, insert an extra card
  const result: SwipeCard[] = []
  let extraIdx = 0
  for (let i = 0; i < dancers.length; i++) {
    result.push(dancers[i])
    if ((i + 1) % 3 === 0 && extraIdx < extras.length) {
      result.push(extras[extraIdx++])
    }
  }
  // Append remaining extras
  while (extraIdx < extras.length) {
    result.push(extras[extraIdx++])
  }
  return result
})

const currentCard = computed<SwipeCard | null>(() => {
  for (const c of allCards.value) {
    if (!liked.value.has(c.id) && !passed.value.has(c.id)) return c
  }
  return null
})

const nextCard = computed<SwipeCard | null>(() => {
  let found = false
  for (const c of allCards.value) {
    if (!liked.value.has(c.id) && !passed.value.has(c.id)) {
      if (found) return c
      found = true
    }
  }
  return null
})

// Only dancers (not dinner/activity/onboarding cards)
const currentDancer = computed<DiscoverDancer | null>(() => {
  const c = currentCard.value
  if (!c || c.cardType === 'dinner' || c.cardType === 'activity' || c.cardType === 'onboarding-dancecard' || c.cardType === 'onboarding-profile') return null
  return c as DiscoverDancer
})

const isDinnerCard = computed(() => currentCard.value?.cardType === 'dinner')

function isRevealDay(date?: string): boolean {
  if (!date) return false
  const today = new Date().toISOString().slice(0, 10)
  return today >= date
}
const isActivityCard = computed(() => currentCard.value?.cardType === 'activity')
const isDanceCard = computed(() => currentCard.value?.cardType === 'onboarding-dancecard')
const isProfileCard = computed(() => currentCard.value?.cardType === 'onboarding-profile')
const currentDinnerCard = computed(() => isDinnerCard.value ? currentCard.value as SwipeCardDinner : null)

const dinnerSpotsLeft = computed(() => {
  const dinner = currentDinnerCard.value
  if (!dinner) return 0
  return dinner.maxSize - dinner.joined
})

const currentActivityCard = computed(() => isActivityCard.value ? currentCard.value as SwipeCardActivity : null)
const currentDanceCard = computed(() => isDanceCard.value ? currentCard.value as SwipeCardOnboardingDanceCard : null)

// Onboarding state
const selectedRole = ref<DanceRole | null>(null)
const selectedStyles = ref<Map<string, 'Beginner' | 'Intermediate' | 'Advanced'>>(new Map())

function toggleStyleLevel(style: string, level: 'Beginner' | 'Intermediate' | 'Advanced') {
  const next = new Map(selectedStyles.value)
  if (next.get(style) === level) {
    next.delete(style)
  } else {
    next.set(style, level)
  }
  selectedStyles.value = next
}

const canSubmitDanceCard = computed(() =>
  validateForm(DanceCardSchema, { role: selectedRole.value, styles: [...selectedStyles.value.keys()] }).success,
)

function submitDanceCard() {
  if (!canSubmitDanceCard.value) return
  if (currentCard.value) {
    liked.value = new Set([...liked.value, currentCard.value.id])
  }
}

// Profile form state
const profileName = ref('')
const profileCity = ref('')
const profileBio = ref('')
const profilePhotoUrl = ref('')

function onPhotoChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    profilePhotoUrl.value = URL.createObjectURL(file)
  }
}

const profile = computed(() => validateForm(DiscoverProfileSchema, { name: profileName.value, city: profileCity.value }))
const canSubmitProfile = computed(() => profile.value.success)

function submitProfile() {
  if (!profile.value.success) return
  if (currentCard.value) {
    liked.value = new Set([...liked.value, currentCard.value.id])
  }
  const { name, city } = profile.value.data
  emit('onboarding-complete', selectedRole.value!, [...selectedStyles.value.keys()], name, city)
  emit('sign-in', 'onboarding')
}

const remainingCount = computed(() => {
  return allCards.value.filter((c) => !liked.value.has(c.id) && !passed.value.has(c.id)).length
})

// Mutual workshops between current dancer and user's plan
function mutualWorkshops(dancer: DiscoverDancer) {
  return props.workshops.filter(
    (w) => props.planIds.has(w.id) && dancer.workshopIds.includes(w.id),
  )
}

// Swipe animation
const swipeDirection = ref<'left' | 'right' | null>(null)
const isAnimating = ref(false)

// Drag state
const dragStartX = ref(0)
const dragCurrentX = ref(0)
const isDragging = ref(false)
const SWIPE_THRESHOLD = 80

const dragOffset = computed(() => isDragging.value ? dragCurrentX.value - dragStartX.value : 0)
const dragRotation = computed(() => dragOffset.value * 0.1)
const dragOpacity = computed(() => Math.max(0.5, 1 - Math.abs(dragOffset.value) / 300))

function onDragStart(e: MouseEvent | TouchEvent) {
  if (isAnimating.value || !currentCard.value) return
  isDragging.value = true
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  dragStartX.value = clientX
  dragCurrentX.value = clientX
}

function onDragMove(e: MouseEvent | TouchEvent) {
  if (!isDragging.value) return
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  dragCurrentX.value = clientX
}

function onDragEnd() {
  if (!isDragging.value) return
  // Capture offset before resetting state (dragOffset depends on isDragging)
  const offset = dragCurrentX.value - dragStartX.value
  isDragging.value = false
  dragStartX.value = 0
  dragCurrentX.value = 0
  if (Math.abs(offset) > SWIPE_THRESHOLD) {
    swipe(offset > 0 ? 'right' : 'left')
  }
}

// Attach global listeners during drag
watch(isDragging, (dragging) => {
  if (dragging) {
    window.addEventListener('mousemove', onDragMove)
    window.addEventListener('mouseup', onDragEnd)
    window.addEventListener('touchmove', onDragMove, { passive: true })
    window.addEventListener('touchend', onDragEnd)
  } else {
    window.removeEventListener('mousemove', onDragMove)
    window.removeEventListener('mouseup', onDragEnd)
    window.removeEventListener('touchmove', onDragMove)
    window.removeEventListener('touchend', onDragEnd)
  }
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
  window.removeEventListener('touchmove', onDragMove)
  window.removeEventListener('touchend', onDragEnd)
})

function swipe(direction: 'left' | 'right') {
  if (!currentCard.value || isAnimating.value) return

  const cardType = currentCard.value.cardType

  // Dance card & Profile card: not swipeable — have their own buttons
  if (cardType === 'onboarding-dancecard' || cardType === 'onboarding-profile') {
    return
  }
  // Allow right-swipe if next card is onboarding (first dancer → dance card)
  // Otherwise gate sign-in
  else if (direction === 'right' && !props.isSignedIn) {
    const next = nextCard.value
    if (!next || (next.cardType !== 'onboarding-dancecard' && next.cardType !== 'onboarding-profile')) {
      emit('sign-in')
      return
    }
  }

  const card = currentCard.value
  const id = card.id
  swipeDirection.value = direction
  isAnimating.value = true

  setTimeout(async () => {
    if (direction === 'right') {
      liked.value = new Set([...liked.value, id])
      // Emit join for activity cards
      if (card.cardType === 'dinner') emit('join-dinner', id)
      else if (card.cardType === 'activity') emit('join-activity', id)
      else if (!card.cardType || card.cardType === 'dancer') {
        // Send wave (fire-and-forget, already idempotent)
        $trpc.wave.send.mutate({
          festivalSlug: props.festivalSlug,
          targetDancerId: id,
        }).then(() => {
          // Refresh friends list to pick up any new mutual match
          $trpc.wave.friends.query({ festivalSlug: props.festivalSlug }).then(f => {
            matchedFriends.value = f.map(d => ({
              id: d.dancerId,
              name: d.name,
              photo: d.photo ?? '',
              role: (d.role as DanceRole) ?? 'follow',
              styles: ((d.danceStyles as string[]) ?? []).map(s => ({ name: s, level: 'Beginner' as const })),
              workshopIds: [],
              bio: '',
            }))
          }).catch(() => {})
        }).catch(() => {})
      }
    } else {
      passed.value = new Set([...passed.value, id])
    }
    swipeDirection.value = null
    isAnimating.value = false
  }, 300)
}

// Track who you've danced with
const dancedWith = ref(new Set<string>())

// Endorsements: dancerId -> set of style names
const myEndorsements = ref(new Map<string, Set<string>>())

// Rating: dancerId -> star rating (1-5)
const myRatings = ref(new Map<string, number>())

// Feedback: dancerId -> { text, sent }
const myFeedbackDraft = ref(new Map<string, string>())
const myFeedbackSent = ref(new Map<string, string>())

// Expanded dancer in dance list (for endorsement/feedback UI)
const expandedDancerId = ref<string | null>(null)

function toggleDanced(id: string) {
  const next = new Set(dancedWith.value)
  if (next.has(id)) {
    next.delete(id)
    // Clean up endorsements, ratings and feedback when un-marking
    myEndorsements.value.delete(id)
    myRatings.value.delete(id)
    myFeedbackDraft.value.delete(id)
    myFeedbackSent.value.delete(id)
  } else {
    next.add(id)
    expandedDancerId.value = id
  }
  dancedWith.value = next
}

function toggleEndorsement(dancerId: string, styleName: string) {
  const current = myEndorsements.value.get(dancerId) || new Set()
  const next = new Set(current)
  if (next.has(styleName)) next.delete(styleName)
  else next.add(styleName)
  myEndorsements.value.set(dancerId, next)
  myEndorsements.value = new Map(myEndorsements.value)
}

function hasEndorsement(dancerId: string, styleName: string): boolean {
  return myEndorsements.value.get(dancerId)?.has(styleName) || false
}

function isEndorsementMutual(_dancerId: string): boolean {
  // Endorsement mutuality will be tracked in a future DB table;
  // for now, all mutual matches implicitly confirm the dance intent.
  return true
}

function setRating(dancerId: string, rating: number) {
  myRatings.value.set(dancerId, rating)
  myRatings.value = new Map(myRatings.value)
}

function updateFeedbackDraft(dancerId: string, text: string) {
  myFeedbackDraft.value.set(dancerId, text)
  myFeedbackDraft.value = new Map(myFeedbackDraft.value)
}

function sendFeedback(dancerId: string) {
  const result = validateForm(DanceFeedbackSchema, { text: myFeedbackDraft.value.get(dancerId) ?? '' })
  if (!result.success) return
  myFeedbackSent.value.set(dancerId, result.data.text)
  myFeedbackSent.value = new Map(myFeedbackSent.value)
}

function isFeedbackSent(dancerId: string): boolean {
  return myFeedbackSent.value.has(dancerId)
}

function isFeedbackRevealed(_dancerId: string): boolean {
  // Feedback reveal requires both parties to have sent — future DB feature
  return false
}

// Dance list = mutual matches from the DB (both waved at each other)
const danceList = computed<DanceListEntry[]>(() => {
  return matchedFriends.value.map((d) => {
    const endorsedStyles = myEndorsements.value.get(d.id) || new Set()
    const endorsements: DanceEndorsement[] = [...endorsedStyles].map((style) => ({
      style,
      mutual: isEndorsementMutual(d.id),
    }))
    return {
      dancer: d,
      danced: dancedWith.value.has(d.id),
      endorsements,
    }
  })
})

// Pending likes = people who liked us that we haven't swiped on yet
const pendingLikes = computed(() => pendingLikesCount.value)

// Show/hide dance list
const showDanceList = ref(true)

// Undo last pass (left-swipe only — passes don't create waves, so no retract needed)
function undoLastPass() {
  const passedArr = [...passed.value]
  if (passedArr.length === 0) return
  const lastId = passedArr[passedArr.length - 1]
  const next = new Set(passed.value)
  next.delete(lastId)
  passed.value = next
}

function endorsementCount(dancer: DiscoverDancer, styleName: string): number {
  return dancer.endorsements?.[styleName] || 0
}
</script>

<template>
  <div class="space-y-4">
    <template v-if="poolDancers.length > 0 || (extraCards && extraCards.length > 0)">
      <!-- Pending likes teaser -->
      <div v-if="isSignedIn && pendingLikes > 0" class="rounded-lg bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 p-3 flex items-center gap-3">
        <div class="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center shrink-0">
          <Heart class="w-4 h-4 text-pink-500 fill-pink-500" />
        </div>
        <p class="text-sm">
          <span class="font-medium text-pink-700">{{ pendingLikes }} {{ pendingLikes === 1 ? 'dancer' : 'dancers' }}</span>
          <span class="text-pink-600"> already want to dance with you!</span>
        </p>
      </div>

      <!-- Card stack -->
      <div v-if="currentCard" data-testid="swipe-deck" class="relative max-w-[340px] mx-auto">
        <!-- Card -->
        <div
          class="rounded-xl border-2 overflow-hidden bg-background select-none cursor-grab active:cursor-grabbing"
          :class="{
            'transition-all duration-300 translate-x-[120%] rotate-12 opacity-0': swipeDirection === 'right',
            'transition-all duration-300 -translate-x-[120%] -rotate-12 opacity-0': swipeDirection === 'left',
            'transition-all duration-300 border-border': !swipeDirection && !isDragging,
            'border-green-400': isDragging && dragOffset > SWIPE_THRESHOLD,
            'border-red-400': isDragging && dragOffset < -SWIPE_THRESHOLD,
            'border-border': isDragging && Math.abs(dragOffset) <= SWIPE_THRESHOLD,
          }"
          :style="isDragging ? { transform: `translateX(${dragOffset}px) rotate(${dragRotation}deg)`, opacity: dragOpacity } : undefined"
          @mousedown.prevent="onDragStart"
          @touchstart="onDragStart"
        >
          <!-- ONBOARDING: DANCE CARD (role + styles combined) -->
          <div v-if="currentDanceCard" class="bg-gradient-to-br from-violet-50 to-sky-100 p-5 space-y-4">
            <h4 class="text-base font-semibold text-foreground text-center">Your dance card</h4>
            <p class="text-xs text-muted-foreground text-center">What do you want to dance here?</p>

            <!-- Role -->
            <div class="flex gap-2 justify-center" @mousedown.stop @touchstart.stop>
              <button
                class="flex-1 max-w-[120px] py-2 rounded-full text-sm font-medium border-2 transition-all"
                type="button"
                :aria-pressed="selectedRole === 'lead'"
                :class="selectedRole === 'lead' ? 'border-violet-500 bg-violet-500 text-white' : 'border-violet-200 bg-white hover:border-violet-300'"
                @click.stop="selectedRole = selectedRole === 'lead' ? null : 'lead'"
              >
                Lead
              </button>
              <button
                class="flex-1 max-w-[120px] py-2 rounded-full text-sm font-medium border-2 transition-all"
                type="button"
                :aria-pressed="selectedRole === 'follow'"
                :class="selectedRole === 'follow' ? 'border-violet-500 bg-violet-500 text-white' : 'border-violet-200 bg-white hover:border-violet-300'"
                @click.stop="selectedRole = selectedRole === 'follow' ? null : 'follow'"
              >
                Follow
              </button>
            </div>

            <!-- Level legend -->
            <div class="flex items-center justify-center gap-3 text-eyebrow text-muted-foreground">
              <span>🌶️ Beginner</span>
              <span>🌶️🌶️ Intermediate</span>
              <span>🌶️🌶️🌶️ Advanced</span>
            </div>

            <!-- Styles grid -->
            <div class="space-y-1.5" @mousedown.stop @touchstart.stop>
              <div
                v-for="style in currentDanceCard.availableStyles"
                :key="style"
                class="flex items-center gap-2 rounded-lg border bg-background p-2"
              >
                <span class="text-sm font-medium flex-1 min-w-0 truncate">{{ style }}</span>
                <div class="flex gap-1 shrink-0">
                  <button
                    v-for="level in (['Beginner', 'Intermediate', 'Advanced'] as const)"
                    :key="level"
                    type="button"
                    :aria-pressed="selectedStyles.get(style) === level"
                    :aria-label="`${style}: ${level}`"
                    class="px-2 py-1 rounded-full text-eyebrow border transition-all whitespace-nowrap"
                    :class="selectedStyles.get(style) === level ? 'border-sky-500 bg-sky-500 text-white' : 'border-muted-foreground/20 hover:border-sky-300'"
                    @click.stop="toggleStyleLevel(style, level)"
                  >
                    {{ chilis(level) }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Continue -->
            <Button
              class="w-full"
              size="sm"
              :disabled="!canSubmitDanceCard"
              @click.stop="submitDanceCard"
            >
              Continue · {{ selectedRole ? (selectedRole === 'lead' ? 'Lead' : 'Follow') : '...' }} · {{ selectedStyles.size }} {{ selectedStyles.size === 1 ? 'style' : 'styles' }}
            </Button>
          </div>

          <!-- ONBOARDING: PROFILE CARD (live preview — same size as dancer cards) -->
          <div v-else-if="isProfileCard" class="relative aspect-square bg-muted">
            <img
              v-if="profilePhotoUrl"
              :src="profilePhotoUrl"
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full bg-gradient-to-br from-rose-100 to-pink-200 flex items-center justify-center">
              <Camera class="w-16 h-16 text-pink-300" />
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div class="absolute bottom-0 left-0 right-0 p-3 text-white space-y-2">
              <div>
                <div class="flex items-center gap-1.5">
                  <h4 class="text-base font-semibold">{{ profileName || 'Your name' }}</h4>
                  <Badge v-if="selectedRole" class="bg-white/20 text-white border-white/30 text-eyebrow px-1.5 py-0">
                    {{ selectedRole === 'lead' ? 'Lead' : 'Follow' }}
                  </Badge>
                </div>
                <p v-if="profileCity || profileBio" class="text-xs text-white/80 mt-0.5">
                  <span v-if="profileCity">{{ profileCity }}</span>
                  <span v-if="profileCity && profileBio"> · </span>
                  <span v-if="profileBio">{{ profileBio }}</span>
                </p>
                <p v-else class="text-xs text-white/50 mt-0.5">Your city · Your bio</p>
              </div>
              <div v-if="selectedStyles.size > 0" class="flex flex-wrap gap-1.5">
                <Badge v-for="[s, l] in selectedStyles" :key="s" class="bg-white/20 text-white border-white/30 text-xs">{{ s }} {{ chilis(l) }}</Badge>
              </div>
            </div>
          </div>

          <!-- DANCER CARD -->
          <div v-else-if="currentDancer" class="relative aspect-square bg-muted">
            <img
              :src="currentDancer.photo"
              :alt="currentDancer.name"
              class="w-full h-full object-cover"
              @error="markBroken(currentDancer.id)"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div class="absolute bottom-0 left-0 right-0 p-3 text-white space-y-2">
              <div>
                <div class="flex items-center gap-1.5">
                  <h4 class="text-base font-semibold">{{ currentDancer.name }}</h4>
                  <Badge v-if="currentDancer.serviceType === 'taxi-dancer'" class="bg-amber-500/90 text-white border-amber-400 text-eyebrow px-1.5 py-0">
                    Bookable · &euro;{{ currentDancer.hourlyRate }}/h
                  </Badge>
                  <Badge v-else-if="currentDancer.serviceType === 'videographer'" class="bg-violet-500/90 text-white border-violet-400 text-eyebrow px-1.5 py-0">
                    📹 Videographer · &euro;{{ currentDancer.hourlyRate }}/h
                  </Badge>
                </div>
                <p class="text-xs text-white/80 mt-0.5">{{ currentDancer.bio }}</p>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Badge
                  v-for="style in currentDancer.styles"
                  :key="style.name"
                  class="bg-white/20 text-white border-white/30 text-xs"
                >
                  {{ style.name }} {{ chilis(style.level) }}
                  <span v-if="endorsementCount(currentDancer, style.name) > 0" class="ml-1 inline-flex items-center gap-0.5">
                    <Heart class="w-2.5 h-2.5 fill-pink-400 text-pink-400" />
                    <span class="text-eyebrow">{{ endorsementCount(currentDancer, style.name) }}</span>
                  </span>
                </Badge>
              </div>
              <div v-if="mutualWorkshops(currentDancer).length > 0">
                <p class="text-eyebrow font-medium text-white/70 mb-1">
                  {{ mutualWorkshops(currentDancer).length }} workshops in common:
                </p>
                <div class="flex flex-wrap gap-1">
                  <Badge
                    v-for="w in mutualWorkshops(currentDancer)"
                    :key="w.id"
                    class="bg-white/15 text-white border-white/20 text-eyebrow px-1.5 py-0.5"
                  >
                    {{ w.day.slice(0, 3) }} {{ w.time }} · {{ w.title }}
                  </Badge>
                </div>
              </div>
              <p v-if="currentDancer.mutualFriends" class="text-eyebrow text-white/70">
                {{ currentDancer.mutualFriends }} mutual {{ currentDancer.mutualFriends === 1 ? 'friend' : 'friends' }}
              </p>
            </div>
          </div>

          <!-- DINNER CARD -->
          <div v-else-if="currentDinnerCard" class="aspect-square bg-gradient-to-br from-orange-50 to-amber-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div class="w-16 h-16 rounded-full bg-orange-100 border-2 border-orange-200 flex items-center justify-center">
              <UtensilsCrossed class="w-8 h-8 text-orange-500" />
            </div>
            <div class="space-y-1">
              <h4 class="text-lg font-semibold text-foreground">{{ currentDinnerCard.day }} dinner</h4>
              <p class="text-sm text-muted-foreground">{{ currentDinnerCard.timeSlot }}</p>
              <p v-if="currentDinnerCard.restaurant" class="text-sm font-medium text-foreground">{{ currentDinnerCard.restaurant }}</p>
              <p v-else-if="currentDinnerCard.date" class="text-xs text-muted-foreground italic">Restaurant will be revealed on {{ currentDinnerCard.day }}</p>
            </div>
            <p class="text-xs text-muted-foreground max-w-[240px]">Meet new friends over a meal. Limited spots per table.</p>
            <div class="space-y-2 w-full max-w-[200px]">
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted-foreground">{{ currentDinnerCard.joined }}/{{ currentDinnerCard.maxSize }} joined</span>
                <Badge
                  v-if="dinnerSpotsLeft > 0"
                  :class="[
                    'text-eyebrow px-1.5 py-0 font-semibold',
                    dinnerSpotsLeft <= 3
                      ? 'bg-orange-100 text-orange-700 border-orange-200'
                      : 'bg-green-100 text-green-700 border-green-200',
                  ]"
                  variant="outline"
                >
                  {{ dinnerSpotsLeft }} spots left
                </Badge>
                <Badge v-else variant="secondary" class="text-eyebrow px-1.5 py-0">Full</Badge>
              </div>
              <div class="w-full bg-orange-200/50 rounded-full h-2">
                <div class="bg-orange-400 rounded-full h-2 transition-all" :style="{ width: `${(currentDinnerCard.joined / currentDinnerCard.maxSize) * 100}%` }" />
              </div>
            </div>
            <p v-if="currentDinnerCard.userJoined" class="text-sm text-primary font-medium">You're in!</p>
            <Badge class="bg-orange-500 text-white border-orange-400 text-xs px-3 py-1">Swipe right to join</Badge>
          </div>

          <!-- ACTIVITY CARD -->
          <div v-else-if="currentActivityCard" class="aspect-square bg-gradient-to-br from-emerald-50 to-teal-100 flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div class="w-16 h-16 rounded-full bg-emerald-100 border-2 border-emerald-200 flex items-center justify-center">
              <Compass class="w-8 h-8 text-emerald-500" />
            </div>
            <div class="space-y-1">
              <h4 class="text-lg font-semibold text-foreground">{{ currentActivityCard.title }}</h4>
              <p class="text-sm text-muted-foreground">{{ currentActivityCard.date }} · {{ currentActivityCard.time }}</p>
            </div>
            <p v-if="currentActivityCard.description" class="text-xs text-muted-foreground max-w-[240px]">{{ currentActivityCard.description }}</p>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-medium text-emerald-600">
                {{ currentActivityCard.participantCount }}<span v-if="currentActivityCard.maxParticipants">/{{ currentActivityCard.maxParticipants }}</span> joined
              </span>
            </div>
            <p v-if="currentActivityCard.userJoined" class="text-sm text-primary font-medium">You're in!</p>
            <Badge class="bg-emerald-500 text-white border-emerald-400 text-xs px-3 py-1">Swipe right to join</Badge>
          </div>
        </div>

        <!-- Swipe buttons (hidden for form cards) -->
        <div v-if="!isDanceCard && !isProfileCard" class="flex items-center justify-center gap-6 mt-4">
          <button
            class="w-14 h-14 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center hover:border-red-300 hover:bg-red-50 transition-colors"
            type="button"
            aria-label="Pass"
            :disabled="isAnimating"
            @click="swipe('left')"
          >
            <X class="w-6 h-6 text-muted-foreground" />
          </button>
          <button
            v-if="passed.size > 0"
            class="w-10 h-10 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center hover:border-amber-300 hover:bg-amber-50 transition-colors"
            type="button"
            aria-label="Undo last pass"
            :disabled="isAnimating"
            @click="undoLastPass"
          >
            <RotateCcw class="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            class="w-14 h-14 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center hover:border-green-300 hover:bg-green-50 transition-colors"
            type="button"
            aria-label="Like"
            :disabled="isAnimating"
            @click="swipe('right')"
          >
            <Heart class="w-6 h-6 text-muted-foreground" />
          </button>
        </div>

        <!-- Counter (hidden for form cards) -->
        <p v-if="!isDanceCard && !isProfileCard" class="text-center text-xs text-muted-foreground mt-2">
          {{ remainingCount }} more to discover
        </p>
      </div>

      <!-- Profile form (below card, only when profile card is showing) -->
      <div v-if="isProfileCard" class="max-w-[340px] mx-auto mt-4 rounded-xl border bg-background p-4 space-y-3">
        <!-- Photo upload -->
        <div class="flex items-center gap-3">
          <label class="relative w-10 h-10 rounded-full bg-pink-100 border-2 border-dashed border-pink-300 flex items-center justify-center cursor-pointer hover:border-pink-400 transition-colors overflow-hidden shrink-0">
            <img v-if="profilePhotoUrl" :src="profilePhotoUrl" class="w-full h-full object-cover" />
            <Camera v-else class="w-4 h-4 text-pink-400" />
            <input type="file" accept="image/*" class="hidden" @change="onPhotoChange" />
          </label>
          <span class="text-xs text-muted-foreground">{{ profilePhotoUrl ? 'Change photo' : 'Add a photo' }}</span>
        </div>

        <!-- Name + City row -->
        <div class="grid grid-cols-2 gap-2">
          <Field id="discover-profile-name" label="Name">
            <Input v-model="profileName" size="sm" autocomplete="name" />
          </Field>
          <Field id="discover-profile-city" label="City">
            <CityCombobox v-model="profileCity" size="sm" placeholder="e.g. Munich" />
          </Field>
        </div>

        <!-- Bio -->
        <Field id="discover-profile-bio" label="Short bio" optional>
          <Textarea v-model="profileBio" :rows="2" :resize="false" class="min-h-16" />
        </Field>

        <!-- Continue button -->
        <Button
          class="w-full"
          size="sm"
          :disabled="!canSubmitProfile"
          @click="submitProfile"
        >
          Save profile
        </Button>
      </div>

      <!-- All swiped -->
      <div v-if="!currentCard" class="rounded-lg border border-dashed p-6 text-center space-y-2">
        <Sparkles class="w-8 h-8 text-muted-foreground mx-auto" />
        <p class="text-sm text-muted-foreground">You've seen everyone! Check back later for new dancers.</p>
      </div>

      <!-- Dance List (mutual matches) -->
      <div v-if="props.isSignedIn && danceList.length > 0" class="mt-4">
        <button
          type="button"
          class="w-full flex items-center justify-between mb-2"
          :aria-expanded="showDanceList"
          @click="showDanceList = !showDanceList"
        >
          <h4 class="text-sm font-semibold flex items-center gap-2">
            My Dance List
            <Badge variant="secondary" class="text-eyebrow px-1.5 py-0">
              {{ danceList.filter((e) => e.danced).length }}/{{ danceList.length }}
            </Badge>
          </h4>
          <component :is="showDanceList ? ChevronUp : ChevronDown" class="w-4 h-4 text-muted-foreground" />
        </button>

        <div v-if="showDanceList" class="space-y-1">
          <div
            v-for="entry in danceList"
            :key="entry.dancer.id"
            class="rounded-lg border transition-colors"
            :class="entry.danced ? 'bg-green-50 border-green-200' : 'hover:bg-muted/50'"
          >
            <!-- Main row -->
            <div
              class="flex items-center gap-3 p-2.5 cursor-pointer"
              @click="toggleDanced(entry.dancer.id)"
            >
              <img
                :src="entry.dancer.photo"
                :alt="entry.dancer.name"
                class="w-8 h-8 rounded-full object-cover shrink-0"
                :class="entry.danced ? 'opacity-60' : ''"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="text-sm font-medium"
                    :class="entry.danced ? 'line-through text-muted-foreground' : ''"
                  >
                    {{ entry.dancer.name }}
                  </span>
                  <Badge variant="secondary" class="text-eyebrow px-1.5 py-0">
                    {{ entry.dancer.role === 'lead' ? 'Lead' : 'Follow' }}
                  </Badge>
                  <Badge v-if="entry.dancer.serviceType === 'taxi-dancer'" class="bg-amber-100 text-amber-700 border-amber-200 text-eyebrow px-1.5 py-0">
                    Bookable
                  </Badge>
                  <Badge v-else-if="entry.dancer.serviceType === 'videographer'" class="bg-violet-100 text-violet-700 border-violet-200 text-eyebrow px-1.5 py-0">
                    📹 Videographer
                  </Badge>
                </div>
                <p class="text-eyebrow text-muted-foreground">
                  {{ entry.dancer.styles.map(s => `${s.name} ${chilis(s.level)}`).join(', ') }}
                </p>
              </div>
              <div
                class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                :class="entry.danced ? 'bg-green-500 border-green-500' : 'border-muted-foreground/30'"
              >
                <Check v-if="entry.danced" class="w-3.5 h-3.5 text-white" />
              </div>
            </div>

            <!-- Endorsement + Feedback panel (shown after marking danced) -->
            <div
              v-if="entry.danced && expandedDancerId === entry.dancer.id"
              class="border-t border-green-200 p-3 space-y-3"
            >
              <!-- Endorsement: heart a dance style -->
              <div>
                <p class="text-xs font-medium text-muted-foreground mb-1.5">
                  Endorse a dance style:
                </p>
                <div class="flex flex-wrap gap-1.5">
                  <button
                    v-for="style in entry.dancer.styles"
                    :key="style.name"
                    type="button"
                    :aria-pressed="hasEndorsement(entry.dancer.id, style.name)"
                    class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors"
                    :class="hasEndorsement(entry.dancer.id, style.name)
                      ? 'bg-pink-50 border-pink-300 text-pink-700'
                      : 'border-muted-foreground/20 text-muted-foreground hover:border-pink-300 hover:text-pink-600'"
                    @click="toggleEndorsement(entry.dancer.id, style.name)"
                  >
                    <Heart
                      class="w-3 h-3"
                      :class="hasEndorsement(entry.dancer.id, style.name) ? 'fill-pink-500 text-pink-500' : ''"
                    />
                    {{ style.name }}
                  </button>
                </div>
                <p v-if="!isEndorsementMutual(entry.dancer.id)" class="text-eyebrow text-muted-foreground mt-1">
                  Endorsement will be public once {{ entry.dancer.name }} also confirms the dance.
                </p>
                <p v-else class="text-eyebrow text-green-600 mt-1">
                  Both confirmed! Endorsements are public.
                </p>
              </div>

              <!-- Rating: how was the dance? -->
              <div>
                <p class="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Star class="w-3 h-3" />
                  Rate the dance:
                </p>
                <div class="flex items-center gap-1">
                  <button
                    v-for="n in 5"
                    :key="n"
                    type="button"
                    class="transition-colors"
                    :aria-label="`Rate ${n} of 5`"
                    :aria-pressed="(myRatings.get(entry.dancer.id) || 0) === n"
                    @click="setRating(entry.dancer.id, n)"
                  >
                    <Star
                      class="w-5 h-5"
                      :class="(myRatings.get(entry.dancer.id) || 0) >= n
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-muted-foreground/30'"
                    />
                  </button>
                </div>
              </div>

              <!-- Written feedback (separate from rating) -->
              <div>
                <p class="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <MessageCircle class="w-3 h-3" />
                  Written feedback:
                </p>

                <!-- Feedback sent, waiting for theirs -->
                <div v-if="isFeedbackSent(entry.dancer.id)" class="space-y-1.5">
                  <div class="p-2 rounded bg-muted/50 border">
                    <p class="text-eyebrow font-medium text-muted-foreground mb-0.5">You wrote:</p>
                    <p class="text-xs italic">"{{ myFeedbackSent.get(entry.dancer.id) }}"</p>
                  </div>
                  <p class="text-eyebrow text-muted-foreground">
                    Feedback sent! Will be revealed once {{ entry.dancer.name }} also sends theirs.
                  </p>
                </div>

                <!-- Draft: write and send -->
                <template v-else>
                  <Field :id="`discover-feedback-${entry.dancer.id}`" label="Feedback" hide-label>
                    <Textarea
                      :model-value="myFeedbackDraft.get(entry.dancer.id) || ''"
                      :rows="2"
                      :resize="false"
                      class="min-h-16 text-xs"
                      placeholder="What did you enjoy about dancing together?"
                      @update:model-value="updateFeedbackDraft(entry.dancer.id, $event ?? '')"
                    />
                  </Field>
                  <Button
                    v-if="myFeedbackDraft.get(entry.dancer.id)?.trim()"
                    size="sm"
                    variant="outline"
                    class="mt-1.5 text-xs h-7"
                    @click="sendFeedback(entry.dancer.id)"
                  >
                    Send Feedback
                  </Button>
                </template>
              </div>

              <!-- Close -->
              <Button variant="link" class="h-auto p-0 text-meta font-normal text-muted-foreground hover:text-foreground" @click="expandedDancerId = null">
                Done
              </Button>
            </div>

            <!-- Compact endorsement summary (when collapsed) -->
            <div
              v-else-if="entry.danced && entry.endorsements.length > 0"
              class="border-t border-green-200 px-2.5 py-1.5 flex items-center gap-1 cursor-pointer"
              @click="expandedDancerId = entry.dancer.id"
            >
              <Heart class="w-3 h-3 fill-pink-500 text-pink-500 shrink-0" />
              <span class="text-eyebrow text-muted-foreground">
                {{ entry.endorsements.map(e => e.style).join(', ') }}
              </span>
              <span v-if="!isEndorsementMutual(entry.dancer.id)" class="text-eyebrow text-amber-500 ml-auto">
                pending
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Loading: pool fetch in progress (signed-in, no extra cards to show meanwhile) -->
    <div v-else-if="poolLoading" class="flex justify-center py-8">
      <div class="w-7 h-7 rounded-full border-2 animate-spin border-muted-foreground/20 border-t-muted-foreground" role="status" aria-label="Loading dancers" />
    </div>

    <!-- Empty deck: nobody going has chosen to be seen yet (RAZ-440) -->
    <div v-else-if="deckEmpty" data-testid="discover-empty" class="rounded-2xl border border-dashed border-border p-6 text-center space-y-3 font-sans">
      <Users class="w-8 h-8 text-muted-foreground mx-auto" aria-hidden="true" />
      <template v-if="isGoing && visible">
        <p class="text-base font-bold text-foreground">You're in the deck</p>
        <p class="text-sm text-muted-foreground max-w-sm mx-auto">Nobody else going has joined it yet. Dancers who do will show up here, and they'll see you too.</p>
      </template>
      <template v-else>
        <p class="text-base font-bold text-foreground">No dancers in the deck yet</p>
        <p class="text-sm text-muted-foreground max-w-sm mx-auto">The deck shows dancers who are going to this {{ entityLabel }} and chose to be seen. Be the first, and others will find you here.</p>
      </template>
      <div class="flex flex-wrap items-center justify-center gap-2 pt-1">
        <Button v-if="!isSignedIn" type="button" variant="pill" size="pill-sm" @click="emit('sign-in', 'plan')">
          <Check aria-hidden="true" /> Sign up to join
        </Button>
        <Button v-else-if="!(isGoing && visible)" type="button" variant="pill" size="pill-sm" :disabled="joining" @click="joinDeck">
          <Check aria-hidden="true" /> {{ isGoing ? 'Show me in the deck' : "I'm going, show me" }}
        </Button>
        <Button type="button" variant="outline-pill" size="pill-sm" @click="inviteFriends">
          <Share2 aria-hidden="true" /> {{ linkCopied ? 'Link copied' : 'Invite friends' }}
        </Button>
      </div>
      <p v-if="joinError" role="alert" class="text-xs text-destructive">{{ joinError }}</p>
    </div>
  </div>
</template>
