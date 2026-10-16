import type { DanceRole, PlanEntry } from '~/types/festival'
import { festivalPath } from '#shared/utils/eventSlug'

/**
 * Compact share payload encoded in the URL. Kept small so the link stays
 * shareable via SMS/WhatsApp without truncation (~2 KB URL ceiling).
 */
export interface SharePayload {
  /** Sharer's display name */
  n: string
  /** Sharer's dance role */
  r: DanceRole
  /** Sharer's dancer id, so a signed-in visitor can add them as a friend.
   *  Optional — links shared before it existed don't carry it. */
  d?: string
  /** Workshop entries: id, role shorthand, partner-status shorthand */
  w: { i: string; r: 'l' | 'f' | ''; p: 'wp' | 'lk' | 's' }[]
}

const ROLE_SHORT: Record<string, 'l' | 'f' | ''> = { lead: 'l', follow: 'f' }
const ROLE_LONG: Record<string, DanceRole> = { l: 'lead', f: 'follow' }
const PS_SHORT: Record<string, 'wp' | 'lk' | 's'> = { 'with-partner': 'wp', looking: 'lk', solo: 's' }
const PS_LONG: Record<string, string> = { wp: 'with-partner', lk: 'looking', s: 'solo' }

export function useSharePlan() {
  /**
   * Encode a plan into a URL-safe base64 string.
   */
  function encode(
    name: string,
    role: DanceRole,
    plan: Map<string, PlanEntry>,
    dancerId?: string | null,
  ): string {
    const payload: SharePayload = {
      n: name,
      r: role,
      ...(dancerId ? { d: dancerId } : {}),
      w: [...plan.values()].map((e) => ({
        i: e.workshopId,
        r: ROLE_SHORT[e.role ?? ''] ?? '',
        p: PS_SHORT[e.partnerStatus] ?? 's',
      })),
    }
    const json = JSON.stringify(payload)
    // btoa is fine for Latin-1; for Unicode names, encode to UTF-8 first.
    const encoded = btoa(unescape(encodeURIComponent(json)))
    // Make URL-safe: replace +/ with -_ and strip trailing =
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  /**
   * Decode a URL-safe base64 string back into structured share data.
   * Returns null if the payload is malformed.
   */
  function decode(encoded: string): {
    name: string
    role: DanceRole
    dancerId: string | null
    plan: { workshopId: string; role: DanceRole | null; partnerStatus: string }[]
  } | null {
    try {
      // Restore standard base64 from URL-safe variant
      let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
      // Restore padding
      while (b64.length % 4 !== 0) b64 += '='
      const json = decodeURIComponent(escape(atob(b64)))
      const payload: SharePayload = JSON.parse(json)

      if (!payload.n || !payload.r || !Array.isArray(payload.w)) return null

      return {
        name: payload.n,
        role: payload.r,
        dancerId: typeof payload.d === 'string' ? payload.d : null,
        plan: payload.w.map((e) => ({
          workshopId: e.i,
          role: ROLE_LONG[e.r] ?? null,
          partnerStatus: PS_LONG[e.p] ?? 'solo',
        })),
      }
    } catch {
      return null
    }
  }

  /**
   * Build the full share URL for a festival plan.
   */
  function buildShareUrl(
    festivalSlug: string,
    name: string,
    role: DanceRole,
    plan: Map<string, PlanEntry>,
    dancerId?: string | null,
  ): string {
    const token = encode(name, role, plan, dancerId)
    const base = import.meta.client ? window.location.origin : ''
    return `${base}${festivalPath(festivalSlug)}?invite=${token}`
  }

  return { encode, decode, buildShareUrl }
}
