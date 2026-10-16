const weekPlanIds = ref(new Set<string>())
const weekDrawerOpen = ref(false)

export function useWeekPlan() {
  function loadFromDb() {
    const { $trpc } = useNuxtApp()
    return $trpc.plan.list
      .query()
      .then((rows) => {
        const ids = new Set<string>()
        for (const r of rows) {
          if (r.itemType === 'event') ids.add(r.itemId)
        }
        // Merge: preserve any optimistic adds that the user triggered
        // while this query was in flight (race between initial load and
        // a fast "Going?" tap).
        for (const id of weekPlanIds.value) ids.add(id)
        weekPlanIds.value = ids
      })
      .catch((err) => {
        console.warn('[useWeekPlan] loadFromDb failed:', err)
      })
  }

  function addEvent(id: string) {
    const next = new Set(weekPlanIds.value)
    next.add(id)
    weekPlanIds.value = next
    // CUJ: "Find a class" — Going! on a class/social (fires from any surface).
    useTrack().track('week_plan_add', { event_id: id, week_count: next.size })
    const { $trpc } = useNuxtApp()
    $trpc.plan.add.mutate({ itemType: 'event', itemId: id }).catch((err) => {
      console.warn('[useWeekPlan] addEvent failed:', err)
      // Rollback: the server rejected the add, so undo the optimistic update.
      const rollback = new Set(weekPlanIds.value)
      rollback.delete(id)
      weekPlanIds.value = rollback
    })
  }

  function removeEvent(id: string) {
    const next = new Set(weekPlanIds.value)
    next.delete(id)
    weekPlanIds.value = next
    const { $trpc } = useNuxtApp()
    $trpc.plan.remove
      .mutate({ itemType: 'event', itemId: id })
      .catch((err) => {
        console.warn('[useWeekPlan] removeEvent failed:', err)
        // Rollback: the server rejected the remove, so undo the optimistic update.
        const rollback = new Set(weekPlanIds.value)
        rollback.add(id)
        weekPlanIds.value = rollback
      })
  }

  function toggleEvent(id: string) {
    if (weekPlanIds.value.has(id)) {
      removeEvent(id)
    } else {
      addEvent(id)
    }
  }

  function toggleDrawer() {
    weekDrawerOpen.value = !weekDrawerOpen.value
  }

  function openDrawer() {
    weekDrawerOpen.value = true
  }

  function closeDrawer() {
    weekDrawerOpen.value = false
  }

  return {
    weekPlanIds: readonly(weekPlanIds),
    weekDrawerOpen: readonly(weekDrawerOpen),
    weekCount: computed(() => weekPlanIds.value.size),
    addEvent,
    removeEvent,
    toggleEvent,
    toggleDrawer,
    openDrawer,
    closeDrawer,
    loadFromDb,
  }
}
