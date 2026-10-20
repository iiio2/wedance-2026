export interface RoommateEntry {
  name: string
  photo: string | null
  city: string | null
  username: string | null
}

export function useRoommates(festivalSlug: string) {
  const { $trpc } = useNuxtApp()
  const lookingForRoommate = ref(false)
  const roommateOthers = ref<RoommateEntry[]>([])
  // Shown under the toggle: a failed toggle must not silently flip back (RAZ-438).
  const roommateError = ref('')

  async function loadRoommateStatus() {
    try {
      const result = await $trpc.roommate.list.query({ festivalSlug })
      lookingForRoommate.value = result.looking
      roommateOthers.value = result.others
    } catch (e) {
      console.warn('Failed to load roommate status:', e)
    }
  }

  async function toggleRoommate() {
    const prev = lookingForRoommate.value
    lookingForRoommate.value = !prev
    roommateError.value = ''
    try {
      const result = await $trpc.roommate.toggle.mutate({ festivalSlug })
      lookingForRoommate.value = result.looking
      useTrack().track('roommate_search_toggled', { festival: festivalSlug, looking: result.looking })
      if (result.looking) {
        await loadRoommateStatus()
      }
    } catch (e) {
      lookingForRoommate.value = prev
      console.warn('Failed to toggle roommate:', e)
      roommateError.value = 'Could not save that. Please try again.'
    }
  }

  return { lookingForRoommate, roommateOthers, roommateError, loadRoommateStatus, toggleRoommate }
}
