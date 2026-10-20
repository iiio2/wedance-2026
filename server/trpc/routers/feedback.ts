import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { router, publicProcedure } from '../trpc'
import { dancers } from '../../database/schema'
import { trackServer } from '../../utils/posthog'

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
const IDEA_LABEL_NAME = 'user-idea'
const IDEA_LABEL_COLOR = '#f5a623'

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

type CreatedIssue = { issueCreate: { success: boolean; issue: { id: string; identifier: string; url: string } } }

const ISSUE_CREATE = `mutation($i:IssueCreateInput!){ issueCreate(input:$i){ success issue{ id identifier url } } }`

// File the issue; if Linear rejects the full payload, file a minimal one and attach
// the rest as a comment, so a user's report is never lost (RAZ-618).
async function createIssueResilient(
  full: Record<string, unknown>,
  minimal: Record<string, unknown>,
  rest: string,
): Promise<CreatedIssue['issueCreate']> {
  try {
    return (await linear<CreatedIssue>(ISSUE_CREATE, { i: full })).issueCreate
  } catch (e) {
    console.error('[feedback] issueCreate failed, retrying minimal:', (e as Error).message)
  }
  const created = (await linear<CreatedIssue>(ISSUE_CREATE, { i: minimal })).issueCreate
  if (created.issue?.id && rest) {
    try {
      await linear(`mutation($i:CommentCreateInput!){ commentCreate(input:$i){ success } }`, {
        i: { issueId: created.issue.id, body: rest.slice(0, 50_000) },
      })
    } catch (e) {
      console.error('[feedback] context comment failed:', (e as Error).message)
    }
  }
  return created
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

  report: publicProcedure
    .input(
      z.object({
        type: z.enum(['bug', 'idea']).default('bug'),
        description: z.string().min(1, 'Please describe the problem').max(5000),
        email: z.string().email().optional().or(z.literal('')),
        context: ContextSchema.optional(),
        // data URL (image/jpeg) from html2canvas; capped ~6MB.
        screenshot: z.string().max(6_500_000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const isIdea = input.type === 'idea'

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
      // Slice by code point so an emoji is never cut in half.
      const chars = Array.from(desc)
      const title = `${isIdea ? '💡' : '🐞'} ${chars.slice(0, 70).join('')}${chars.length > 70 ? '…' : ''}`

      // Upload screenshot first so we can embed it inline in the description.
      const assetUrl = input.screenshot ? await uploadScreenshot(input.screenshot) : null

      const lines: string[] = [
        desc,
        '',
        '---',
        `**${isIdea ? 'Submitted' : 'Reported'} by:** ${reporter}${reporterEmail ? ` · ${reporterEmail}` : ''}${ctx.dancerId ? ` · dancer \`${ctx.dancerId}\`` : ' · not signed in'}`,
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

      const widgetName = isIdea ? 'Share an idea' : 'Report a problem'
      lines.push('', '---', `_Filed automatically from the “${widgetName}” widget on 2026.wedance.vip._`)

      const [labelId, stateId] = await Promise.all([
        ensureLabelId(isIdea ? IDEA_LABEL_NAME : LABEL_NAME, isIdea ? IDEA_LABEL_COLOR : LABEL_COLOR),
        triageStateId(),
      ])
      const issueInput: Record<string, unknown> = {
        teamId: TEAM_ID,
        projectId: SUPPORT_PROJECT_ID,
        title,
        description: lines.join('\n'),
        priority: isIdea ? 4 : 3,
      }
      if (labelId) issueInput.labelIds = [labelId]
      if (stateId) issueInput.stateId = stateId

      // Fallback: the user's words + who sent it, in the Support project. Everything
      // else (page, device, console errors, screenshot) follows as a comment.
      const minimalInput: Record<string, unknown> = {
        teamId: TEAM_ID,
        projectId: SUPPORT_PROJECT_ID,
        title,
        description: lines.slice(0, 4).join('\n'),
      }
      const created = await createIssueResilient(issueInput, minimalInput, lines.slice(4).join('\n'))

      return {
        ok: created.success,
        identifier: created.issue.identifier,
        url: created.issue.url,
      }
    }),
})
