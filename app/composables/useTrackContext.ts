/**
 * The object a page is about (an event, a profile, a city), for events the
 * page doesn't fire itself — today `outbound_click` from the delegated
 * listener (plugins/06.outbound-click.client.ts). A link inside a card can
 * still name its own object with `data-object-type` / `data-object-id`.
 *
 *   useTrackContext(() => ev.value && { object_type: 'event', object_id: ev.value.id, city: ev.value.citySlug })
 *
 * Never put a person's name or handle here: object_id is an event id, a
 * business profile handle or a city slug.
 */
export interface TrackContext {
  object_type: string
  object_id?: string | null
  city?: string | null
}

// Last writer wins; each page only clears its own context, because the next
// page's setup can run before the previous page unmounts.
let current: { owner: symbol; ctx: TrackContext | null } | null = null

export function currentTrackContext(): TrackContext | null {
  return current?.ctx ?? null
}

export function useTrackContext(source: () => TrackContext | null | undefined | false) {
  if (!import.meta.client) return
  const owner = Symbol('track-context')
  const stop = watchEffect(() => { current = { owner, ctx: source() || null } })
  onBeforeUnmount(() => {
    stop()
    if (current?.owner === owner) current = null
  })
}
