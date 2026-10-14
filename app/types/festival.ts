export interface TicketOption {
  name: string
  price: number
  days: string[] // which days this ticket covers, empty = all
  description?: string
  soldOut?: boolean
  workshopCount?: number // max workshops covered, undefined = unlimited
  includesParty?: boolean // whether party access is included
}

export interface Festival {
  name: string
  slug: string
  startDate: string
  endDate: string
  description: string
  logo: string
  /** The event's flyer (its cover), shown in About. */
  flyer?: string
  accentColor: string
  socialLinks: { platform: string; url: string }[]
  venue: Venue
  attendeeCount: number
  ticketUrl?: string
  tickets?: TicketOption[]
}

export interface Venue {
  name: string
  address: string
  coordinates: { lat: number; lng: number }
  practicalInfo: string[]
}

export interface Teacher {
  id: string
  name: string
  photo: string
  bio: string
  styles: string[]
  videoUrl?: string
  socialLinks?: { platform: string; url: string }[]
  /** Hasn't confirmed they're in yet (line-up confirmation): shown as "to be confirmed". */
  tbc?: boolean
}

export interface Workshop {
  id: string
  title: string
  time: string
  duration: number
  day: string
  room: string
  style: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  teacherId: string
  /** Who they teach it with (more line-up ids). */
  withIds?: string[]
  goingCount: number
  type?: 'workshop' | 'party'
  venue?: string
  description?: string
}

export type DanceRole = 'lead' | 'follow'
export type PartnerStatus = 'with-partner' | 'looking' | 'solo'

export interface DancePartner {
  id: string
  name: string
}

export interface PlanEntry {
  workshopId: string
  role: DanceRole | null
  partnerStatus: PartnerStatus
  partnerId?: string
}

export interface FestivalFriend {
  id: string
  name: string
  photo: string
  role: DanceRole
  workshopIds: string[]
}

export interface PartnerMatch {
  id: string
  name: string
  photo: string
  role: DanceRole
  level: string
  styles: string[]
  workshopIds: string[]
  bio: string
}

export interface DancerStyle {
  name: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
}

export interface DiscoverDancer {
  id: string
  name: string
  photo: string
  role: DanceRole
  styles: DancerStyle[]
  workshopIds: string[]
  bio: string
  mutualFriends?: number
  endorsements?: Record<string, number> // style name -> count of mutual endorsements
  serviceType?: 'taxi-dancer' | 'videographer'
  hourlyRate?: number // EUR per hour, for bookable professionals
}

export interface SwipeCardDinner {
  id: string
  cardType: 'dinner'
  day: string
  timeSlot: string
  restaurant?: string
  joined: number
  maxSize: number
  userJoined: boolean
  date?: string
  groupChatLink?: string
  groupMembers?: { name: string; photo: string }[]
}

export interface SwipeCardActivity {
  id: string
  cardType: 'activity'
  title: string
  date: string
  time: string
  participantCount: number
  maxParticipants?: number
  userJoined: boolean
  description?: string
  photo?: string
}

export interface SwipeCardFreespot {
  id: string
  cardType: 'freespot'
  freeSpotsLeft: number
  totalSignups: number
  maxFreeSpots: number
}

export interface SwipeCardOnboardingDanceCard {
  id: string
  cardType: 'onboarding-dancecard'
  availableStyles: string[]
}

export interface SwipeCardOnboardingProfile {
  id: string
  cardType: 'onboarding-profile'
}

export type SwipeCard = (DiscoverDancer & { cardType?: 'dancer' }) | SwipeCardDinner | SwipeCardActivity | SwipeCardFreespot | SwipeCardOnboardingDanceCard | SwipeCardOnboardingProfile

export interface DanceEndorsement {
  style: string       // dance style name endorsed
  mutual: boolean     // true if both confirmed the dance
}

export interface DanceFeedback {
  rating: number      // 1-5 star rating of the dance
  sharedByMe: boolean // I opted to share written feedback
  sharedByThem: boolean // they opted to share written feedback
  myText?: string     // my written feedback
  theirRating?: number // only visible when both shared
  theirText?: string  // only visible when both shared
}

export interface DanceListEntry {
  dancer: DiscoverDancer
  danced: boolean
  endorsements: DanceEndorsement[]
}

export interface YearPlanFestival {
  slug: string
  name: string
  startDate: string
  endDate: string
  location: string
  country?: string
  logo: string
  accentColor: string
  workshopCount: number
  role: DanceRole | null
  lookingCount: number
  ticketStatus: 'purchased' | 'not-purchased' | 'sold-out'
  ticketName?: string
  earlyBirdDeadline?: string
  /** Name of the active early-bird offer (e.g. "Early Bird Full Pass"). */
  earlyBirdOffer?: string
  /** External ticket purchase URL. */
  ticketUrl?: string
  friendsGoing: { name: string; photo: string | null }[]
  styles: string[]
  /** Referral discount percentage for this festival (0 = no referral program). */
  referralDiscountPercent?: number
}

export interface YearStats {
  totalFestivals: number
  totalWorkshops: number
  countries: string[]
  topStyles: { style: string; percent: number }[]
  partnerMatchRate: number
}

export interface RideShare {
  id: string
  dancerName: string
  dancerPhoto: string | null
  type: 'offering' | 'looking'
  originCity: string
  date: string
  seatsAvailable?: number
  contactLink?: string | null
  isOwn?: boolean
}

export interface RoomShare {
  id: string
  dancerName: string
  dancerPhoto: string
  budget?: string
  preferences?: string
}

export interface GroupDinner {
  id: string
  day: string
  timeSlot: string
  restaurant?: string
  restaurantAddress?: string
  joined: number
  maxSize: number
  userJoined: boolean
  date?: string
  groupChatLink?: string
  groupMembers?: { name: string; photo: string }[]
}

export interface ExtraActivity {
  id: string
  title: string
  date: string
  time: string
  participantCount: number
  maxParticipants?: number
  userJoined: boolean
  description?: string
}

export interface FreemiumState {
  totalSignups: number
  maxFreeSpots: number
  userUnlocked: boolean
  verifiedTicketHolder: boolean
  paymentUrl: string
}
