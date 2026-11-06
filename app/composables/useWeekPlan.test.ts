/**
 * RAZ-689 — Going is optimistic: a tap shows "Going!" at once, a failed request
 * rolls it back, and the initial plan load (plugins/04.plan.client.ts) never
 * overwrites a tap made while it was in flight (RAZ-252, RAZ-414).
 *
 * The composables use Nuxt auto-imports; the globals are stubbed with Vue's real
 * reactivity and a fake tRPC client whose requests the test resolves by hand.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, readonly, computed } from 'vue'

type Pending = { resolve: (v?: any) => void; reject: (e: any) => void }
function deferred() {
  let d!: Pending
  const promise = new Promise((resolve, reject) => { d = { resolve, reject } })
  return { promise, ...d }
}

let calls: { op: string; input?: any; d: ReturnType<typeof deferred> }[] = []
const call = (op: string) => (input?: any) => { const d = deferred(); calls.push({ op, input, d }); return d.promise }
const last = (op: string) => [...calls].reverse().find(c => c.op === op)!
const flush = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  calls = []
  vi.resetModules()
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('readonly', readonly)
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('useTrack', () => ({ track: () => {} }))
  vi.stubGlobal('useNuxtApp', () => ({
    $trpc: { plan: { list: { query: call('list') }, add: { mutate: call('add') }, remove: { mutate: call('remove') } } },
  }))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('useWeekPlan — optimistic Going (RAZ-689)', () => {
  const load = async () => (await import('./useWeekPlan')).useWeekPlan()

  it('shows Going at once and keeps it when the add succeeds', async () => {
    const plan = await load()
    plan.toggleEvent('e1')
    expect(plan.weekPlanIds.value.has('e1')).toBe(true)
    expect(last('add').input).toEqual({ itemType: 'event', itemId: 'e1' })
    last('add').d.resolve()
    await flush()
    expect(plan.weekPlanIds.value.has('e1')).toBe(true)
  })

  it('rolls back a failed add', async () => {
    const plan = await load()
    plan.toggleEvent('e1')
    last('add').d.reject(new Error('UNAUTHORIZED'))
    await flush()
    expect(plan.weekPlanIds.value.has('e1')).toBe(false)
    expect(plan.weekCount.value).toBe(0)
  })

  it('rolls back a failed remove (the event stays planned)', async () => {
    const plan = await load()
    plan.toggleEvent('e1'); last('add').d.resolve(); await flush()
    plan.toggleEvent('e1')
    expect(plan.weekPlanIds.value.has('e1')).toBe(false)
    last('remove').d.reject(new Error('network'))
    await flush()
    expect(plan.weekPlanIds.value.has('e1')).toBe(true)
  })

  it('a rollback only touches its own event', async () => {
    const plan = await load()
    plan.toggleEvent('ok'); const okAdd = last('add')
    plan.toggleEvent('bad'); const badAdd = last('add')
    badAdd.d.reject(new Error('500')); okAdd.d.resolve()
    await flush()
    expect([...plan.weekPlanIds.value]).toEqual(['ok'])
  })

  it('the initial load keeps a Going tapped while it was in flight', async () => {
    const plan = await load()
    const loading = plan.loadFromDb()
    plan.toggleEvent('tapped') // user taps before the plan arrives
    last('list').d.resolve([{ itemType: 'event', itemId: 'saved' }, { itemType: 'festival', itemId: 'fest' }])
    await loading
    expect([...plan.weekPlanIds.value].sort()).toEqual(['saved', 'tapped'])
  })

  it('a failed initial load leaves the current selection untouched', async () => {
    const plan = await load()
    plan.toggleEvent('tapped')
    const loading = plan.loadFromDb()
    last('list').d.reject(new Error('offline'))
    await loading
    expect([...plan.weekPlanIds.value]).toEqual(['tapped'])
  })
})

describe('useYearPlan — optimistic festival Going (RAZ-689)', () => {
  const load = async () => (await import('./useYearPlan')).useYearPlan()

  it('rolls back a failed add and a failed remove', async () => {
    const plan = await load()
    plan.toggleFestival('fest-a')
    expect(plan.yearPlanIds.value.has('fest-a')).toBe(true)
    last('add').d.reject(new Error('500')); await flush()
    expect(plan.yearPlanIds.value.has('fest-a')).toBe(false)

    plan.toggleFestival('fest-b'); last('add').d.resolve(); await flush()
    plan.toggleFestival('fest-b')
    last('remove').d.reject(new Error('500')); await flush()
    expect(plan.yearPlanIds.value.has('fest-b')).toBe(true)
  })

  it('the initial load keeps a festival tapped while it was in flight', async () => {
    const plan = await load()
    const loading = plan.loadFromDb()
    plan.toggleFestival('tapped-fest')
    last('list').d.resolve([{ itemType: 'festival', itemId: 'saved-fest' }, { itemType: 'event', itemId: 'e1' }])
    await loading
    expect([...plan.yearPlanIds.value].sort()).toEqual(['saved-fest', 'tapped-fest'])
  })
})
