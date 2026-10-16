import type { RideShare } from '~/types/festival'

export function useRideShares(festivalSlug: string) {
  const { $trpc } = useNuxtApp()
  const rideShares = ref<RideShare[]>([])
  // Shown under the ride form: a failed post must never look like success (RAZ-437).
  const rideError = ref('')

  async function loadRideShares() {
    try {
      const rows = await $trpc.rideShare.list.query({ festivalSlug })
      rideShares.value = rows.map((r: any) => ({
        id: r.id,
        dancerName: r.isOwn ? 'You' : r.dancerName,
        dancerPhoto: r.dancerPhoto,
        type: r.type as 'offering' | 'looking',
        originCity: r.originCity,
        date: r.date,
        seatsAvailable: r.seatsAvailable ?? undefined,
        contactLink: r.contactLink ?? undefined,
        isOwn: r.isOwn,
      }))
    } catch (e) {
      console.warn('Failed to load ride shares:', e)
    }
  }

  async function postRide(ride: { type: 'offering' | 'looking'; originCity: string; date: string; seats?: number; contactLink?: string }) {
    rideError.value = ''
    try {
      await $trpc.rideShare.create.mutate({
        festivalSlug,
        type: ride.type,
        originCity: ride.originCity,
        date: ride.date,
        seatsAvailable: ride.seats,
        contactLink: ride.contactLink,
      })
      await loadRideShares()
    } catch (e: any) {
      console.warn('Failed to post ride:', e)
      rideError.value = e?.message && e?.data?.code === 'BAD_REQUEST' ? e.message : 'Could not post your ride. Please try again.'
    }
  }

  async function deleteRide() {
    const prev = [...rideShares.value]
    rideShares.value = rideShares.value.filter((r) => !r.isOwn)
    try {
      await $trpc.rideShare.delete.mutate({ festivalSlug })
    } catch (e) {
      rideShares.value = prev
      throw e
    }
  }

  return { rideShares, rideError, loadRideShares, postRide, deleteRide }
}
