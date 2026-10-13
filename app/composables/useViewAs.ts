/**
 * Admin "view as": which user's Business an admin is looking at, if any. Kept
 * in a session cookie so a reload stays in the same view; the tRPC client sends
 * it on /business pages and the server acts as that user (admin rights kept).
 */
export type ViewAs = { id: string; name: string }

export function useViewAs() {
  return useCookie<ViewAs | null>('wd-view-as', { default: () => null, path: '/', sameSite: 'lax' })
}
