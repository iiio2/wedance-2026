/**
 * Hosts that must never send analytics: a developer's machine. The Vercel-pulled
 * `.env` contains the production PostHog key, so the client plugin checks the
 * page host instead of trusting the env (see plugins/03.posthog.client.ts).
 */
export function isLocalHost(hostname: string | null | undefined): boolean {
  const h = (hostname || '').toLowerCase().replace(/^\[|\]$/g, '')
  if (!h) return false
  if (h === 'localhost' || h === '::1' || h === '0.0.0.0') return true
  if (/^127(?:\.\d{1,3}){3}$/.test(h)) return true
  return h.endsWith('.localhost') || h.endsWith('.test')
}
