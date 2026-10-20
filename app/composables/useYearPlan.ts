const yearPlanIds = ref(new Set<string>())
const yearDrawerOpen = ref(false)

export function useYearPlan() {
  function loadFromDb() {
    const { $trpc } = useNuxtApp()
    return $trpc.plan.list
      .query()
      .then((rows) => {
        const ids = new Set<string>()
        for (const r of rows) {
          if (r.itemType === 'festival') ids.add(r.itemId)
        }
        // Merge: preserve any optimistic adds that the user triggered
        // while this query was in flight (race between initial load and
        // a fast "Going?" tap).
        for (const id of yearPlanIds.value) ids.add(id)
        yearPlanIds.value = ids
      })
      .catch((err) => {
        console.warn('[useYearPlan] loadFromDb failed:', err)
      })
  }

  function addFestival(slug: string) {
    const next = new Set(yearPlanIds.value)
    next.add(slug)
    yearPlanIds.value = next
    // CUJ: "Plan a festival year" — festival added to the year plan.
    useTrack().track('year_plan_add', {
      festival_slug: slug,
      year_count: next.size,
    })
    const { $trpc } = useNuxtApp()
    $trpc.plan.add
      .mutate({ itemType: 'festival', itemId: slug })
      .catch((err) => {
        console.warn('[useYearPlan] addFestival failed:', err)
        // Rollback: the server rejected the add, so undo the optimistic update.
        const rollback = new Set(yearPlanIds.value)
        rollback.delete(slug)
        yearPlanIds.value = rollback
      })
  }

  function removeFestival(slug: string) {
    const next = new Set(yearPlanIds.value)
    next.delete(slug)
    yearPlanIds.value = next
    useTrack().track('year_plan_remove', { festival_slug: slug, year_count: next.size })
    const { $trpc } = useNuxtApp()
    $trpc.plan.remove
      .mutate({ itemType: 'festival', itemId: slug })
      .catch((err) => {
        console.warn('[useYearPlan] removeFestival failed:', err)
        // Rollback: the server rejected the remove, so undo the optimistic update.
        const rollback = new Set(yearPlanIds.value)
        rollback.add(slug)
        yearPlanIds.value = rollback
      })
  }

  function toggleFestival(slug: string) {
    if (yearPlanIds.value.has(slug)) {
      removeFestival(slug)
    } else {
      addFestival(slug)
    }
  }

  function toggleDrawer() {
    yearDrawerOpen.value = !yearDrawerOpen.value
  }

  function openDrawer() {
    yearDrawerOpen.value = true
  }

  function closeDrawer() {
    yearDrawerOpen.value = false
  }

  return {
    yearPlanIds: readonly(yearPlanIds),
    yearDrawerOpen: readonly(yearDrawerOpen),
    yearCount: computed(() => yearPlanIds.value.size),
    addFestival,
    removeFestival,
    toggleFestival,
    toggleDrawer,
    openDrawer,
    closeDrawer,
    loadFromDb,
  }
}
