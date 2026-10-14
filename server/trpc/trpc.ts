import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'
import { withAi } from '../utils/aiUsage'

const t = initTRPC.context<Context>().create()

export const router = t.router
// Every procedure names itself and its caller for the AI usage log (an AI call
// made inside, even after the response, is logged with them).
const base = t.procedure.use(({ ctx, path, next }) => withAi({ source: path, dancerId: ctx.dancerId }, () => next()))
export const publicProcedure = base

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
