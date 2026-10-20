/**
 * Is this magic-link sign-in the end of a magic-link SIGN-UP?
 *
 * requestMagicLink upserts the dancer row, so "no password" alone is not proof
 * the account is new: migrated v4 dancers (source_ref set) and older
 * passwordless accounts would be miscounted. A sign-in counts as a sign-up
 * (analytics: `signup_completed` / `server_signup_completed`) only when ALL hold:
 *   - the row was created recently (default: last 24 h — the magic link itself
 *     expires in 15 min, the slack covers re-requests),
 *   - it did not come from a migration (no `source_ref`),
 *   - it has no password and was never email-verified,
 *   - it never had a session before this one.
 * Migrated v4 dancers never count.
 */
export const MAGIC_LINK_SIGNUP_WINDOW_MS = 24 * 60 * 60 * 1000

export function isMagicLinkSignup(
  d: {
    createdAt: Date | string | null | undefined
    sourceRef: Record<string, unknown> | null | undefined
    hash: string | null | undefined
    emailVerifiedAt: Date | string | null | undefined
    hadSession: boolean
  },
  now: Date = new Date(),
): boolean {
  if (d.sourceRef && Object.keys(d.sourceRef).length > 0) return false
  if (d.hash) return false
  if (d.emailVerifiedAt) return false
  if (d.hadSession) return false
  if (!d.createdAt) return false
  const created = new Date(d.createdAt).getTime()
  if (Number.isNaN(created)) return false
  const age = now.getTime() - created
  return age >= -60_000 && age <= MAGIC_LINK_SIGNUP_WINDOW_MS
}
