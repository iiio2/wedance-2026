import { initTRPC, TRPCError } from '@trpc/server'
import type { Context } from './context'

const t = initTRPC.context<Context>().create()

export const router = t.router
export const publicProcedure = t.procedure

export const protectedProcedure = t.procedure.use(({ ctx, next, type }) => {
  if (!ctx.dancerId) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not signed in' })
  }
  // Admin viewing as someone: see exactly what they see (their access, not
  // admin's), and change nothing on their behalf.
  if (ctx.viewAs) {
    if (type !== 'query') throw new TRPCError({ code: 'FORBIDDEN', message: `You’re viewing as ${ctx.viewAs.name}: read-only. Stop viewing to make changes.` })
    return next({ ctx: { ...ctx, dancerId: ctx.viewAs.id, isAdmin: false } })
  }
  return next({ ctx: { ...ctx, dancerId: ctx.dancerId } })
})

export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.isAdmin) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' })
  }
  return next({ ctx: { ...ctx, dancerId: ctx.dancerId! } })
})
