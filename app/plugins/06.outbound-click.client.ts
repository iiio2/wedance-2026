import { classifyOutbound } from '~/lib/outbound'

/**
 * `outbound_click` — one delegated listener instead of a handler on every
 * external link: did the page send the visitor somewhere (a ticket shop, a
 * venue's site, Instagram, a map, a WhatsApp/Telegram group)?
 *
 * Props: `kind` (ticket / website / instagram / map / whatsapp / community_group
 * / …; a link can say what it is with `data-outbound-kind`), `platform` (from the
 * host), `host` (never the path or query), `object_type` / `object_id` (the
 * closest `data-object-type`/`data-object-id`, else the page's useTrackContext),
 * `city`, `surface` (the route name). Middle-click and ⌘-click count too.
 * A no-op when PostHog isn't loaded (useTrack guards).
 */
export default defineNuxtPlugin(() => {
  const router = useRouter()

  const onClick = (e: MouseEvent) => {
    if (e.type === 'auxclick' && e.button !== 1) return
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
    if (!a) return
    const kindEl = a.closest('[data-outbound-kind]') as HTMLElement | null
    const link = classifyOutbound(a.getAttribute('href'), window.location.hostname, kindEl?.dataset.outboundKind)
    if (!link) return
    const objEl = a.closest('[data-object-type]') as HTMLElement | null
    const ctx = currentTrackContext()
    useTrack().track('outbound_click', {
      kind: link.kind,
      platform: link.platform,
      host: link.host,
      object_type: objEl?.dataset.objectType ?? ctx?.object_type ?? null,
      object_id: objEl ? (objEl.dataset.objectId ?? null) : (ctx?.object_id ?? null),
      city: objEl?.dataset.city ?? ctx?.city ?? null,
      surface: String(router.currentRoute.value.name ?? ''),
    })
  }

  document.addEventListener('click', onClick, { capture: true })
  document.addEventListener('auxclick', onClick, { capture: true })
})
