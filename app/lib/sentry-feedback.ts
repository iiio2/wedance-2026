/**
 * "Talk to us" submissions → Sentry User Feedback.
 *
 * The widget (app/components/ReportProblem.vue) keeps its own UI and sends the
 * result with Sentry's `sendFeedback` (a thin wrapper over `captureFeedback`
 * that resolves with the event id only once Sentry's ingest answered 2xx, and
 * rejects on 403 / network failure / 30 s timeout). The replay integration
 * links the current Session Replay to the feedback (contexts.feedback.replay_id)
 * and flushes a buffered replay so it is kept.
 *
 * Bugs vs ideas are filterable in Sentry by the `feedback_type` tag and by the
 * 🐞 / 💡 message prefix.
 */
import type { ReportContext } from '~/composables/useReportContext'

export type FeedbackType = 'bug' | 'idea'

export interface FeedbackSubmission {
  type: FeedbackType
  description: string
  name?: string | null
  email?: string | null
  /** Signed-in dancer, so triage can find the account. */
  dancerId?: string | null
  username?: string | null
  context: ReportContext
  /** JPEG bytes of the screenshot (bug reports only). */
  screenshot?: Uint8Array | null
}

const PREFIX: Record<FeedbackType, string> = { bug: '🐞', idea: '💡' }
const SOURCE: Record<FeedbackType, string> = { bug: 'talk-to-us:bug', idea: 'talk-to-us:idea' }

type SentryModule = typeof import('@sentry/nuxt')

/** The SDK, only if sentry.client.config.ts initialised it (DSN set). */
export function getSentry(): SentryModule | null {
  if (typeof window === 'undefined') return null
  const Sentry = (window as unknown as { Sentry?: SentryModule }).Sentry
  if (!Sentry || typeof Sentry.isInitialized !== 'function' || !Sentry.isInitialized()) return null
  return Sentry
}

/** Pure: the `sendFeedback` params + hint for a submission (unit-tested). */
export function buildFeedback(s: FeedbackSubmission) {
  const c = s.context
  const params = {
    message: `${PREFIX[s.type]} ${s.description.trim()}`,
    name: s.name?.trim() || undefined,
    email: s.email?.trim() || undefined,
    url: c.url,
    source: SOURCE[s.type],
  }

  const tags: Record<string, string> = {
    feedback_type: s.type,
    signed_in: s.dancerId ? 'yes' : 'no',
  }
  if (c.routePath) tags.route = c.routePath.split('?')[0]!.slice(0, 200)

  // Everything useReportContext collected; Sentry already has the replay link.
  const { sentryReplayUrl: _u, sentryReplayId: _r, ...extra } = c

  const hint = {
    includeReplay: true,
    attachments: s.screenshot?.length
      ? [{ filename: 'screenshot.jpg', data: s.screenshot, contentType: 'image/jpeg' }]
      : undefined,
    captureContext: {
      tags,
      extra: extra as Record<string, unknown>,
      user: s.dancerId
        ? { id: s.dancerId, username: s.username || undefined, email: params.email, name: params.name }
        : params.email ? { email: params.email } : undefined,
    },
  }
  return { params, hint }
}

/**
 * Send to Sentry and wait for ingest to accept it. Returns the event id.
 * Throws when Sentry isn't initialised (no DSN, e.g. local dev) or delivery failed.
 */
export async function submitFeedback(s: FeedbackSubmission): Promise<string> {
  const Sentry = getSentry()
  if (!Sentry) throw new Error('Sentry is not initialised')
  const { params, hint } = buildFeedback(s)
  const eventId = await Sentry.sendFeedback(params, hint)
  // The feedback itself is confirmed; give the linked replay segment a moment
  // to go out too. Never blocks success on it.
  await Sentry.flush(2000).catch(() => false)
  return eventId
}
