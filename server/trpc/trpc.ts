import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'
import { withAi } from '../utils/aiUsage'
import { assertScope, checkProcedureScope } from './scopes'
import type { Scope } from '../oauth/config'

const t = initTRPC.context<Context>().create()

export const router = t.router
// Every procedure names itself and its caller for the AI usage log (an AI call
// made inside, even after the response, is logged with them).
// A connected app's token (MCP) may only call procedures its scopes allow
// (server/trpc/scopes.ts, default deny); web sessions pass straight through.
const base = t.procedure
  .use(({ ctx, path, next }) => withAi({ source: path, dancerId: ctx.dancerId }, () => next()))
  .use(({ ctx, path, next }) => {
    checkProcedureScope(ctx, path)
    return next()
  })
export const publicProcedure = base

/** Extra scope requirement on top of the path map, e.g. `.use(requireScope('business:publish'))`. */
export const requireScope = (...scopes: Scope[]) => t.middleware(({ ctx, next }) => {
  for (const s of scopes) assertScope(ctx, s)
  return next()
})

export const protectedProcedure = base.use(({ ctx, next, type, path }) => {
  if (!ctx.dancerId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not signed in' })
  }
  // Admin acting as someone: everything runs as that user (their profiles,
  // inbox, events), and they can change things on the user's behalf. Admin
  // rights stay on, so nothing is blocked. Changes are logged with both names.
  if (ctx.viewAs) {
    if (type === 'mutation') console.info(`[view-as] admin ${ctx.dancerId} as ${ctx.viewAs.id} (${ctx.viewAs.name}): ${path}`)
    return next({ ctx: { ...ctx, dancerId: ctx.viewAs.id } })
  }
  return next({ ctx: { ...ctx, dancerId: ctx.dancerId } })
})

export const adminProcedure = base.use(({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' })
  }
  return next({ ctx: { ...ctx, dancerId: ctx.dancerId! } })
})
