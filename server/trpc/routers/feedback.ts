import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { dancers } from '../../database/schema'
import { trackServer } from '../../utils/posthog'

/**
 * Feedback router.
 *
 * - `inquiry` — the "Tell us about your event" form on /for-events → a Linear
 *   issue in team WED (`user-report` label, triage state). Requires
 *   LINEAR_API_KEY (Personal API key, same one wedance-org uses); unset → the
 *   mutation throws a clean error.
 * - `reporter` — the signed-in dancer's own name + email, read from the
 *   server-trusted session, so the "Talk to us" widget can attach a reply-to
 *   address to its Sentry feedback.
 *
 * The "Talk to us" widget itself (bug reports + ideas, app/components/
 * ReportProblem.vue) no longer goes through the server: it submits straight
 * to Sentry User Feedback (app/lib/sentry-feedback.ts), with the screenshot as
 * an attachment and the Session Replay linked.
 */

// Wedance (WED) team — same id wedance-org/api/comment.js files objections into.
const TEAM_ID = '9fc5052b-a799-4b60-99b5-300512ddd275'
const LABEL_NAME = 'user-report'
const LABEL_COLOR = '#eb5757'

async function linear<T = any>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = process.env.LINEAR_API_KEY
  if (!key) throw new Error('LINEAR_API_KEY not configured')
  const r = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: key },
    body: JSON.stringify({ query, variables }),
  })
  const text = await r.text()
  let j: any
  try {
    j = JSON.parse(text)
  } catch {
    throw new Error(`Linear API ${r.status}: ${text.slice(0, 300)}`)
  }
  if (j.errors) {
    // Keep Linear's full error (extensions carry the real reason) in the server log.
    console.error('[linear] GraphQL error', r.status, JSON.stringify(j.errors).slice(0, 2000))
    throw new Error(j.errors[0]?.message || 'Linear API error')
  }
  return j.data as T
}

// Find (or create) a label on the team, return its id.
async function ensureLabelId(name: string = LABEL_NAME, color: string = LABEL_COLOR): Promise<string | null> {
  try {
    const q = `query($t:String!){ team(id:$t){ labels(filter:{name:{eq:"${name}"}}){ nodes{ id } } } }`
    const d = await linear<{ team: { labels: { nodes: { id: string }[] } } }>(q, { t: TEAM_ID })
    const existing = d.team.labels.nodes[0]
    if (existing) return existing.id
    const m = `mutation($t:String!){ issueLabelCreate(input:{name:"${name}",color:"${color}",teamId:$t}){ issueLabel{ id } } }`
    const c = await linear<{ issueLabelCreate: { issueLabel: { id: string } } }>(m, { t: TEAM_ID })
    return c.issueLabelCreate.issueLabel.id
  } catch {
    return null
  }
}

// Prefer the team's triage state so reports land in the triage inbox.
async function triageStateId(): Promise<string | null> {
  try {
    const q = `query($t:String!){ team(id:$t){ states{ nodes{ id type } } } }`
    const d = await linear<{ team: { states: { nodes: { id: string; type: string }[] } } }>(q, { t: TEAM_ID })
    return d.team.states.nodes.find((x) => x.type === 'triage')?.id ?? null
  } catch {
    return null
  }
}

export const feedbackRouter = router({
  inquiry: publicProcedure
    .input(
      z.object({
        eventType: z.string().max(100).optional(),
        date: z.string().max(100).optional(),
        city: z.string().max(100).optional(),
        guests: z.string().max(100).optional(),
        needs: z.string().min(1, 'Tell us what you need').max(3000),
        name: z.string().max(160).optional(),
        email: z.string().email(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const title = `🎉 Event inquiry${input.name ? ` from ${input.name}` : ''}`
      const lines: string[] = []
      if (input.eventType) lines.push(`**Event type:** ${input.eventType}`)
      if (input.date) lines.push(`**Date:** ${input.date}`)
      if (input.city) lines.push(`**City:** ${input.city}`)
      if (input.guests) lines.push(`**Guests:** ${input.guests}`)
      lines.push('', '**What they need:**', input.needs)
      lines.push('', '---')
      if (input.name) lines.push(`**Name:** ${input.name}`)
      lines.push(`**Email:** ${input.email}`)
      lines.push('', '_Filed from the "Tell us about your event" form on 2026.wedance.vip/for-events._')

      const [labelId, stateId] = await Promise.all([ensureLabelId(), triageStateId()])
      const issueInput: Record<string, unknown> = {
        teamId: TEAM_ID,
        title,
        description: lines.join('\n'),
        priority: 2,
      }
      if (labelId) issueInput.labelIds = [labelId]
      if (stateId) issueInput.stateId = stateId

      const d = await linear<{ issueCreate: { success: boolean; issue: { identifier: string; url: string } } }>(
        `mutation($i:IssueCreateInput!){ issueCreate(input:$i){ success issue{ identifier url } } }`,
        { i: issueInput },
      )

      trackServer(ctx, 'event_inquiry_submitted', { event_type: input.eventType || null, city: input.city || null })
      return { ok: d.issueCreate.success }
    }),

  reporter: protectedProcedure.query(async ({ ctx }) => {
    const [d] = await ctx.db
      .select({ name: dancers.name, email: dancers.email })
      .from(dancers)
      .where(eq(dancers.id, ctx.dancerId))
    return { name: d?.name || null, email: d?.email || null }
  }),
})
