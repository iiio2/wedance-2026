import type { GroupDinner } from '~/types/festival'

export function useDinners(festivalSlug: string) {
  const { $trpc } = useNuxtApp()
  const dinners = ref<GroupDinner[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadDinners() {
    loading.value = true
    error.value = null
    try {
      const result = await $trpc.dinner.list.query({ festivalSlug })
      dinners.value = result.map((d: any) => ({
        id: d.id,
        day: d.day,
        date: d.date ?? undefined,
        timeSlot: d.timeSlot,
        restaurant: d.restaurant ?? undefined,
        restaurantAddress: d.restaurantAddress ?? undefined,
        joined: d.joined,
        maxSize: d.maxSize,
        userJoined: d.userJoined,
        groupChatLink: d.groupChatLink ?? undefined,
        groupMembers: d.groupMembers,
      }))
    } catch (e: any) {
      error.value = e.message || 'Failed to load dinners'
      console.warn('Failed to load dinners:', e)
    } finally {
      loading.value = false
    }
  }

  async function joinDinner(id: string) {
    const d = dinners.value.find(x => x.id === id)
    if (!d || d.userJoined || d.joined >= d.maxSize) return

    // Optimistic update
    d.userJoined = true
    d.joined++

    try {
      await $trpc.dinner.join.mutate({ dinnerId: id })
      useTrack().track('dinner_joined', { dinner_id: id })
    } catch (e: any) {
      // Rollback on failure
      d.userJoined = false
      d.joined--
      console.warn('Could not join dinner:', e.message)
      throw e
    }
  }

  async function leaveDinner(id: string) {
    const d = dinners.value.find(x => x.id === id)
    if (!d || !d.userJoined) return

    // Optimistic update
    d.userJoined = false
    d.joined--
    const prevGroupChatLink = d.groupChatLink
    const prevGroupMembers = d.groupMembers
    d.groupChatLink = undefined
    d.groupMembers = undefined

    try {
      await $trpc.dinner.leave.mutate({ dinnerId: id })
    } catch (e: any) {
      // Rollback on failure
      d.userJoined = true
      d.joined++
      d.groupChatLink = prevGroupChatLink
      d.groupMembers = prevGroupMembers
      console.warn('Could not leave dinner:', e.message)
      throw e
    }
  }

  return {
    dinners,
    loading,
    error,
    loadDinners,
    joinDinner,
    leaveDinner,
  }
}
