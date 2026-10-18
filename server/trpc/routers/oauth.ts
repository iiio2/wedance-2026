import { z } from 'zod'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { dancers, mcpAudit, oauthClients, oauthGrants, profileMembers, profiles } from '../../database/schema'
import { approveConsent, consentToken, denyConsent, validateAuthorizeRequest } from '../../oauth/authorize'
import { BUSINESS_SCOPES, SCOPE_INFO, hasScope, siteOrigin, type Scope } from '../../oauth/config'
import { OAuthError } from '../../oauth/errors'
import { revokeGrant } from '../../oauth/tokens'
import { requireMember } from './business'

/**
 * The dancer's side of connected apps (MCP): the /oauth/authorize consent
 * screen and /settings/connections. Web sessions only: none of these paths is
 * in server/trpc/scopes.ts, so an app's token can never call them (an app
 * can't approve its own consent or list other connections).
 */

const authorizeParams = z.object({
  response_type: z.string().max(40).optional(),
  client_id: z.string().max(500).optional(),
  redirect_uri: z.string().max(2000).optional(),
  code_challenge: z.string().max(200).optional(),
  code_challenge_method: z.string().max(20).optional(),
  state: z.string().max(2000).optional(),
  scope: z.string().max(1000).optional(),
  resource: z.string().max(500).optional(),
})

const scopeView = (s: Scope) => ({ id: s, ...SCOPE_INFO[s] })
const originOf = (ctx: { origin?: string | null }) => siteOrigin(ctx.origin)

// An admin "viewing as" someone never grants, lists or revokes apps for them.
function ownAccount(ctx: { viewAs?: unknown }) {
  if (ctx.viewAs) throw new TRPCError({ code: 'FORBIDDEN', message: 'Connected apps can only be managed for your own account.' })
}

function asTrpc(e: unknown): never {
  if (e instanceof OAuthError) throw new TRPCError({ code: e.status === 403 ? 'FORBIDDEN' : 'BAD_REQUEST', message: e.description })
  throw e
}

export const oauthRouter = router({
  // What the consent screen shows. Never redirects by itself: the page does,
  // and only to a redirect_uri the app registered.
  authorizeInfo: publicProcedure
    .input(authorizeParams)
    .query(async ({ ctx, input }) => {
      const outcome = await validateAuthorizeRequest(ctx.db, input, originOf(ctx))
      if (!outcome.ok) {
        return outcome.fatal
          ? { status: 'error' as const, error: outcome.error, description: outcome.description }
          : { status: 'redirect' as const, redirect: outcome.redirect, error: outcome.error, description: outcome.description }
      }
      const { request } = outcome
      const client = {
        id: request.client.id,
        name: request.client.name,
        uri: request.client.clientUri,
        logo: request.client.logoUri,
        // Where the app sends you back: the host is what people can check.
        redirectHost: new URL(request.redirectUri).host || new URL(request.redirectUri).protocol,
        verifiedDomain: request.client.kind === 'cimd' ? new URL(request.client.id).host : null,
      }
      const scopes = request.scopes.map(scopeView)
      if (!ctx.dancerId) return { status: 'signin' as const, client, scopes }
      const [me] = await ctx.db.select({ name: dancers.name, email: dancers.email, isAdmin: dancers.isAdmin }).from(dancers).where(eq(dancers.id, ctx.dancerId))
      // admin is shown only to an admin (the app is already allowlisted by now).
      const visible = me?.isAdmin ? scopes : scopes.filter(s => s.id !== 'admin')
      const wantsBusiness = BUSINESS_SCOPES.some(s => hasScope(request.scopes, s))
      const myProfiles = wantsBusiness
        ? await ctx.db.select({ id: profiles.id, username: profiles.username, name: profiles.name, type: profiles.type, photo: profiles.photo, role: profileMembers.role })
          .from(profileMembers).innerJoin(profiles, eq(profiles.id, profileMembers.profileId))
          .where(eq(profileMembers.dancerId, ctx.dancerId)).orderBy(profiles.name)
        : []
      return {
        status: 'consent' as const,
        client,
        scopes: visible,
        me: { name: me?.name ?? '', email: me?.email ?? '' },
        profiles: myProfiles,
        requestToken: consentToken(request, ctx.dancerId),
      }
    }),

  // "Allow": record the grant, mint the code, hand back the redirect.
  approve: protectedProcedure
    .input(z.object({
      requestToken: z.string().min(10).max(4096),
      scopes: z.array(z.string().max(40)).max(20),
      profileIds: z.array(z.string().uuid()).max(100).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      ownAccount(ctx)
      try {
        const { redirect } = await approveConsent(ctx.db, {
          token: input.requestToken, dancerId: ctx.dancerId, isAdmin: ctx.isAdmin, scopes: input.scopes, profileIds: input.profileIds, origin: originOf(ctx),
        })
        return { redirect }
      } catch (e) { asTrpc(e) }
    }),

  // "Don't allow": back to the app with access_denied.
  deny: protectedProcedure
    .input(z.object({ requestToken: z.string().min(10).max(4096) }))
    .mutation(({ ctx, input }) => {
      ownAccount(ctx)
      try {
        return denyConsent({ token: input.requestToken, dancerId: ctx.dancerId, origin: originOf(ctx) })
      } catch (e) { asTrpc(e) }
    }),

  // /settings/connections: the apps I let in, what they may do, when they last did.
  connections: protectedProcedure.query(async ({ ctx }) => {
    ownAccount(ctx)
    const rows = await ctx.db.select({
      id: oauthGrants.id, scopes: oauthGrants.scopes, profileIds: oauthGrants.profileIds, lastUsedAt: oauthGrants.lastUsedAt, createdAt: oauthGrants.createdAt,
      clientName: oauthClients.name, clientUri: oauthClients.clientUri, logo: oauthClients.logoUri, clientId: oauthClients.id, kind: oauthClients.kind,
    })
      .from(oauthGrants).innerJoin(oauthClients, eq(oauthClients.id, oauthGrants.clientId))
      .where(and(eq(oauthGrants.dancerId, ctx.dancerId), isNull(oauthGrants.revokedAt)))
      .orderBy(desc(oauthGrants.createdAt))
    const ids = [...new Set(rows.flatMap((r: any) => r.profileIds as string[]))]
    const names = ids.length ? await ctx.db.select({ id: profiles.id, name: profiles.name, username: profiles.username }).from(profiles).where(inArray(profiles.id, ids)) : []
    const byId = new Map<string, { name: string; username: string }>(names.map((p: any) => [p.id, p]))
    return rows.map((r: any) => ({
      id: r.id,
      app: { name: r.clientName, uri: r.clientUri, logo: r.logo, domain: r.kind === 'cimd' ? new URL(r.clientId).host : null },
      scopes: (r.scopes as Scope[]).filter(s => s in SCOPE_INFO).map(scopeView),
      profiles: (r.profileIds as string[]).map(id => byId.get(id)).filter(Boolean),
      lastUsedAt: r.lastUsedAt as Date | null,
      createdAt: r.createdAt as Date,
    }))
  }),

  revokeConnection: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      ownAccount(ctx)
      const [g] = await ctx.db.select({ id: oauthGrants.id }).from(oauthGrants)
        .where(and(eq(oauthGrants.id, input.id), eq(oauthGrants.dancerId, ctx.dancerId)))
      if (!g) throw new TRPCError({ code: 'NOT_FOUND', message: 'That connection is gone.' })
      await revokeGrant(ctx.db, g.id, 'revoked_by_user')
      return { revoked: true }
    }),

  // What connected apps did for a profile I run (the audit log).
  auditForProfile: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      return ctx.db.select({
        id: mcpAudit.id, tool: mcpAudit.tool, result: mcpAudit.result, errorCode: mcpAudit.errorCode, createdAt: mcpAudit.createdAt,
        app: oauthClients.name, by: dancers.name,
      })
        .from(mcpAudit)
        .leftJoin(oauthClients, eq(oauthClients.id, mcpAudit.clientId))
        .leftJoin(dancers, eq(dancers.id, mcpAudit.dancerId))
        .where(eq(mcpAudit.profileId, p.id))
        .orderBy(desc(mcpAudit.createdAt))
        .limit(200)
    }),
})
