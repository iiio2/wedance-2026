import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { router, publicProcedure } from '../trpc'
import { dancers } from '../../database/schema'

/**
 * User problem reports → Linear.
 *
 * The "Report a problem" widget (app/components/ReportProblem.vue) collects a
 * free-text description plus a rich context bundle (URL, route, device, recent
 * client console errors, Sentry replay link, etc.) and an optional html2canvas
 * screenshot. This mutation files it as an issue in Linear team WED with the
 * `user-report` label, in the team's triage state and the WeDance Support
 * project, and embeds the screenshot
 * inline via Linear's file upload.
 *
 * User identity (id / email / name) is taken from the *server-trusted* session,
 * never from the client, so a report can't be spoofed to look like another user.
 *
 * Requires LINEAR_API_KEY (Personal API key, same one wedance-org uses). If it
 * is unset the mutation throws a clean error and the widget shows a fallback.
 */

// Wedance (WED) team — same id wedance-org/api/comment.js files objections into.
const TEAM_ID = '9fc5052b-a799-4b60-99b5-300512ddd275'
// "WeDance Support" project — every problem report lands here (RAZ-425).
const SUPPORT_PROJECT_ID = 'ff24241d-28fe-4f2e-92c2-b220340dbe18'
const LABEL_NAME = 'user-report'
const LABEL_COLOR = '#eb5757'

const ContextSchema = z.object({
  url: z.string().max(2000).optional(),
  routePath: z.string().max(500).optional(),
  userAgent: z.string().max(600).optional(),
  viewport: z.string().max(40).optional(),
  screen: z.string().max(40).optional(),
  devicePixelRatio: z.number().optional(),
  language: z.string().max(40).optional(),
  timezone: z.string().max(80).optional(),
  referrer: z.string().max(2000).optional(),
  appVersion: z.string().max(80).optional(),
  online: z.boolean().optional(),
  consoleErrors: z.array(z.string().max(2000)).max(30).optional(),
  sentryReplayUrl: z.string().max(600).optional(),
  sentryReplayId: z.string().max(200).optional(),
  sentryLastEventId: z.string().max(200).optional(),
  posthogSessionUrl: z.string().max(600).optional(),
})

async function linear<T = any>(query: string, variables: Record<string, unknown>): Promise<T> {
  const key = process.env.LINEAR_API_KEY
  if (!key) throw new Error('LINEAR_API_KEY not configured')
  const r = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: key },
    body: JSON.stringify({ query, variables }),
  })
  const j = await r.json()
  if (j.errors) throw new Error(j.errors[0]?.message || 'Linear API error')
  return j.data as T
}

// Find (or create) the `user-report` label on the team, return its id.
async function ensureLabelId(): Promise<string | null> {
  try {
    const q = `query($t:String!){ team(id:$t){ labels(filter:{name:{eq:"${LABEL_NAME}"}}){ nodes{ id } } } }`
    const d = await linear<{ team: { labels: { nodes: { id: string }[] } } }>(q, { t: TEAM_ID })
    const existing = d.team.labels.nodes[0]
    if (existing) return existing.id
    const m = `mutation($t:String!){ issueLabelCreate(input:{name:"${LABEL_NAME}",color:"${LABEL_COLOR}",teamId:$t}){ issueLabel{ id } } }`
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

// Upload a data-URL screenshot to Linear, return the public asset URL to embed.
async function uploadScreenshot(dataUrl: string): Promise<string | null> {
  try {
    const match = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(dataUrl)
    if (!match) return null
    const contentType = match[1]!
    const buffer = Buffer.from(match[2]!, 'base64')
    const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
    const filename = `report-${Date.now()}.${ext}`

    const d = await linear<{
      fileUpload: {
        success: boolean
        uploadFile: { uploadUrl: string; assetUrl: string; headers: { key: string; value: string }[] }
      }
    }>(
      `mutation($ct:String!,$fn:String!,$sz:Int!){ fileUpload(contentType:$ct, filename:$fn, size:$sz){ success uploadFile{ uploadUrl assetUrl headers{ key value } } } }`,
      { ct: contentType, fn: filename, sz: buffer.length },
    )
    const uf = d.fileUpload?.uploadFile
    if (!d.fileUpload?.success || !uf) return null

    const headers: Record<string, string> = { 'Content-Type': contentType }
    for (const h of uf.headers || []) headers[h.key] = h.value
    const put = await fetch(uf.uploadUrl, { method: 'PUT', headers, body: buffer })
    if (!put.ok) return null
    return uf.assetUrl
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
    .mutation(async ({ input }) => {
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

      return { ok: d.issueCreate.success }
    }),

  report: publicProcedure
    .input(
      z.object({
        description: z.string().min(1, 'Please describe the problem').max(5000),
        email: z.string().email().optional().or(z.literal('')),
        context: ContextSchema.optional(),
        // data URL (image/jpeg) from html2canvas; capped ~6MB.
        screenshot: z.string().max(6_500_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Server-trusted reporter identity from the session (never the client).
      let reporter = 'Anonymous visitor'
      let reporterEmail = (input.email || '').trim()
      if (ctx.dancerId) {
        const [d] = await ctx.db
          .select({ name: dancers.name, email: dancers.email })
          .from(dancers)
          .where(eq(dancers.id, ctx.dancerId))
        if (d) {
          reporter = d.name || 'Signed-in dancer'
          reporterEmail = d.email || reporterEmail
        }
      }

      const c = input.context ?? {}
      const desc = input.description.trim()
      const title = `🐞 ${desc.slice(0, 70)}${desc.length > 70 ? '…' : ''}`

      // Upload screenshot first so we can embed it inline in the description.
      const assetUrl = input.screenshot ? await uploadScreenshot(input.screenshot) : null

      const lines: string[] = [
        desc,
        '',
        '---',
        `**Reported by:** ${reporter}${reporterEmail ? ` · ${reporterEmail}` : ''}${ctx.dancerId ? ` · dancer \`${ctx.dancerId}\`` : ' · not signed in'}`,
      ]
      if (c.url) lines.push(`**Page:** ${c.url}`)
      if (c.routePath) lines.push(`**Route:** \`${c.routePath}\``)
      if (c.referrer) lines.push(`**Referrer:** ${c.referrer}`)

      const env: string[] = []
      if (c.userAgent) env.push(`UA: ${c.userAgent}`)
      if (c.viewport) env.push(`viewport ${c.viewport}`)
      if (c.screen) env.push(`screen ${c.screen}`)
      if (c.devicePixelRatio) env.push(`dpr ${c.devicePixelRatio}`)
      if (c.language) env.push(`lang ${c.language}`)
      if (c.timezone) env.push(`tz ${c.timezone}`)
      if (typeof c.online === 'boolean') env.push(c.online ? 'online' : 'OFFLINE')
      if (c.appVersion) env.push(`build ${c.appVersion}`)
      if (env.length) lines.push(`**Environment:** ${env.join(' · ')}`)

      if (c.sentryReplayUrl) lines.push(`**Sentry replay:** ${c.sentryReplayUrl}`)
      else if (c.sentryReplayId) lines.push(`**Sentry replay id:** \`${c.sentryReplayId}\``)
      if (c.sentryLastEventId) lines.push(`**Sentry last event:** \`${c.sentryLastEventId}\``)
      if (c.posthogSessionUrl) lines.push(`**PostHog session:** ${c.posthogSessionUrl}`)

      if (c.consoleErrors?.length) {
        lines.push('', '**Recent client errors:**', '```', ...c.consoleErrors.slice(-15), '```')
      }

      if (assetUrl) lines.push('', '**Screenshot:**', '', `![screenshot](${assetUrl})`)

      lines.push('', '---', '_Filed automatically from the “Report a problem” widget on 2026.wedance.vip._')

      const [labelId, stateId] = await Promise.all([ensureLabelId(), triageStateId()])
      const issueInput: Record<string, unknown> = {
        teamId: TEAM_ID,
        projectId: SUPPORT_PROJECT_ID,
        title,
        description: lines.join('\n'),
        priority: 3,
      }
      if (labelId) issueInput.labelIds = [labelId]
      if (stateId) issueInput.stateId = stateId

      const d = await linear<{ issueCreate: { success: boolean; issue: { identifier: string; url: string } } }>(
        `mutation($i:IssueCreateInput!){ issueCreate(input:$i){ success issue{ identifier url } } }`,
        { i: issueInput },
      )

      return {
        ok: d.issueCreate.success,
        identifier: d.issueCreate.issue.identifier,
        url: d.issueCreate.issue.url,
      }
    }),
})
