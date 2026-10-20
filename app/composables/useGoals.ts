export interface Goal {
  id: string
  title: string
  why: string
  progress: number
  style: string
}

const goals = ref<Goal[]>([])
const loaded = ref(false)

export function useGoals() {
  async function loadFromDb() {
    const { $trpc } = useNuxtApp()
    try {
      const rows = await $trpc.plan.listDetailed.query()
      const dbGoals: Goal[] = []
      for (const r of rows) {
        if (r.itemType === 'goal' && r.metadata) {
          const m = r.metadata as Record<string, string>
          dbGoals.push({
            id: r.itemId,
            title: m.title || '',
            why: m.why || '',
            progress: Number(m.progress) || 0,
            style: m.style || '',
          })
        }
      }
      goals.value = dbGoals
    } catch (err) {
      console.error('[useGoals] loadFromDb failed:', err)
    } finally {
      loaded.value = true
    }
  }

  function hasGoal(title: string): boolean {
    const t = title.trim().toLowerCase()
    return goals.value.some(g => g.title.trim().toLowerCase() === t)
  }

  async function addGoal(title: string, why: string, style: string) {
    const id = `goal-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const goal: Goal = { id, title, why, progress: 0, style }
    goals.value.push(goal)

    try {
      const { $trpc } = useNuxtApp()
      await $trpc.plan.add.mutate({
        itemType: 'goal',
        itemId: id,
        metadata: { title, why, progress: '0', style },
      })
      useTrack().track('goal_added', { style: style || null })
    } catch (err) {
      console.error('[useGoals] addGoal failed — rolling back:', err)
      goals.value = goals.value.filter(g => g.id !== id)
    }
  }

  async function updateGoal(id: string, updates: Partial<Pick<Goal, 'progress' | 'style'>>) {
    const goal = goals.value.find(g => g.id === id)
    if (!goal) return

    const prev = { progress: goal.progress, style: goal.style }
    if (updates.progress !== undefined) goal.progress = updates.progress
    if (updates.style !== undefined) goal.style = updates.style

    try {
      const { $trpc } = useNuxtApp()
      await $trpc.plan.updateMetadata.mutate({
        itemType: 'goal',
        itemId: id,
        metadata: {
          title: goal.title,
          why: goal.why,
          progress: String(goal.progress),
          style: goal.style,
        },
      })
    } catch (err) {
      console.error('[useGoals] updateGoal failed — rolling back:', err)
      goal.progress = prev.progress
      goal.style = prev.style
    }
  }

  async function removeGoal(id: string) {
    const removed = goals.value.find(g => g.id === id)
    goals.value = goals.value.filter(g => g.id !== id)

    try {
      const { $trpc } = useNuxtApp()
      await $trpc.plan.remove.mutate({ itemType: 'goal', itemId: id })
    } catch (err) {
      console.error('[useGoals] removeGoal failed — restoring:', err)
      if (removed) goals.value.push(removed)
    }
  }

  return {
    goals: readonly(goals),
    goalsLoaded: readonly(loaded),
    loadFromDb,
    hasGoal,
    addGoal,
    updateGoal,
    removeGoal,
  }
}
