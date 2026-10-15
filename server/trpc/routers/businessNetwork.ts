import { z } from 'zod'
import { eq, and, inArray, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { profiles, profileMembers, networkLinks } from '../../database/schema'
import { eventPath } from '../../../shared/utils/eventSlug'

/**
 * Business mode — Network (RAZ-408). The artists, venues and organizers a page
 * works with.
 *
 * 1. Derived: anyone who shares an event with one of my pages — as the event's
 *    host, venue, organizer or one of its artists. Only published events count,
 *    plus unpublished ones my own page hosts (someone else's draft must not
 *    reveal who they're booking).
 * 2. Curated (network_links): my team can ADD anyone by hand and HIDE a derived
 *    contact. Hidden contacts stay listed separately so they can be restored.
 *
 * Scope: one page I manage (`username`), or all of them (no username). In "all"
 * mode each contact carries `via` — which of my pages knows them.
 */

const handle = z.string().trim().min(1).max(120)

type Ctx = { db: any; dancerId: string; isAdmin?: boolean }
type Page = { id: string; username: string; name: string; type: string; city: string | null; photo: string | null }

// The pages in scope: the one asked for (must manage it) or all I manage.
async function myPages(ctx: Ctx, username?: string): Promise<Page[]> {
  const cols = { id: profiles.id, username: profiles.username, name: profiles.name, type: profiles.type, city: profiles.city, photo: profiles.photo }
  if (username && ctx.isAdmin) {
    const rows = await ctx.db.select(cols).from(profiles).where(eq(profiles.username, username))
    if (!rows.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
    return rows
  }
  const rows: Page[] = await ctx.db
    .select(cols)
    .from(profileMembers)
    .innerJoin(profiles, eq(profiles.id, profileMembers.profileId))
    .where(and(
      eq(profileMembers.dancerId, ctx.dancerId),
      username ? eq(profiles.username, username) : undefined,
    ))
    .orderBy(profiles.name)
  if (username && !rows.length) throw new TRPCError({ code: 'FORBIDDEN', message: 'You don’t manage this profile.' })
  return rows
}

const textArray = (xs: string[]) => sql`ARRAY[${sql.join(xs.map(x => sql`${x}`), sql`, `)}]::text[]`
const uuidArray = (xs: string[]) => sql`ARRAY[${sql.join(xs.map(x => sql`${x}`), sql`, `)}]::uuid[]`

type Shared = { id: string; name: string | null; startDate: string | null; href: string }
type Derived = Map<string, { events: Map<string, Shared>; via: Set<string> }>

// Everyone who shares an event with one of `pages`, keyed by their handle.
async function derive(db: any, pages: Page[]): Promise<Derived> {
  const ids = pages.map(p => p.id)
  const names = pages.map(p => p.username)
  const res: any = await db.execute(sql`
    select e.id, e.name, e.start_date as "startDate",
           e.venue_username as venue, e.organizer_username as organizer,
           coalesce(e.artists, '[]'::jsonb) as artists, hp.username as host
    from events e
    left join profiles hp on hp.id = e.host_profile_id
    where (e.host_profile_id = any(${uuidArray(ids)})
        or e.venue_username = any(${textArray(names)})
        or e.organizer_username = any(${textArray(names)})
        or coalesce(e.artists, '[]'::jsonb) ?| ${textArray(names)})
      and (e.published or e.host_profile_id = any(${uuidArray(ids)}))
  `)
  const rows: any[] = res.rows ?? res

  const mine = new Set(names)
  const out: Derived = new Map()
  for (const e of rows) {
    const artists: string[] = Array.isArray(e.artists) ? e.artists : []
    const parties = new Set([e.host, e.venue, e.organizer, ...artists].filter(Boolean) as string[])
    const via = [...parties].filter(u => mine.has(u))
    const shared: Shared = {
      id: e.id,
      name: e.name,
      startDate: e.startDate ? new Date(e.startDate).toISOString() : null,
      href: eventPath({ id: e.id, name: e.name }),
    }
    for (const u of parties) {
      if (mine.has(u)) continue
      const c = out.get(u) ?? { events: new Map(), via: new Set() }
      c.events.set(e.id, shared)
      via.forEach(v => c.via.add(v))
      out.set(u, c)
    }
  }
  return out
}

export const businessNetworkRouter = router({
  // My network: contacts (derived ∪ added − hidden) and the hidden ones.
  list: protectedProcedure
    .input(z.object({ username: handle.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const pages = await myPages(ctx, input?.username)
      if (!pages.length) return { pages: [], contacts: [], hidden: [] }
      const pageById = new Map(pages.map(p => [p.id, p.username]))
      const mine = new Set(pages.map(p => p.username))

      const derived = await derive(ctx.db, pages)
      const links: { profileId: string; status: 'added' | 'hidden'; username: string }[] = await ctx.db
        .select({ profileId: networkLinks.profileId, status: networkLinks.status, username: profiles.username })
        .from(networkLinks)
        .innerJoin(profiles, eq(profiles.id, networkLinks.otherProfileId))
        .where(inArray(networkLinks.profileId, pages.map(p => p.id)))

      // Per contact: which of my pages added / hid them.
      const addedVia = new Map<string, Set<string>>()
      const hiddenVia = new Map<string, Set<string>>()
      for (const l of links) {
        const bucket = l.status === 'added' ? addedVia : hiddenVia
        const s = bucket.get(l.username) ?? new Set()
        s.add(pageById.get(l.profileId)!)
        bucket.set(l.username, s)
      }

      const handles = [...new Set([...derived.keys(), ...addedVia.keys(), ...hiddenVia.keys()])].filter(u => !mine.has(u))
      if (!handles.length) return { pages, contacts: [], hidden: [] }
      const people: any[] = await ctx.db
        .select({ username: profiles.username, name: profiles.name, type: profiles.type, city: profiles.city, photo: profiles.photo })
        .from(profiles)
        .where(and(inArray(profiles.username, handles), eq(profiles.status, 'visible')))

      const now = new Date().toISOString()
      const contacts = []
      const hidden = []
      for (const p of people) {
        const d = derived.get(p.username)
        const events = d ? [...d.events.values()] : []
        // Weekly series run months ahead, so show the soonest upcoming shared
        // event ("next") and the latest one that already happened ("last").
        const upcoming = events.filter(e => e.startDate && e.startDate >= now).sort((a, b) => a.startDate!.localeCompare(b.startDate!))
        const past = events.filter(e => !e.startDate || e.startDate < now).sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
        // A contact is visible through each of my pages that derived or added
        // them, unless that same page hid them.
        const hid = hiddenVia.get(p.username) ?? new Set<string>()
        const via = [...new Set([...(d?.via ?? []), ...(addedVia.get(p.username) ?? [])])].filter(v => !hid.has(v))
        const row = {
          ...p,
          sharedEvents: events.length,
          next: upcoming[0] ?? null,
          last: past[0] ?? null,
          added: (addedVia.get(p.username)?.size ?? 0) > 0,
          via: via.sort(),
        }
        if (via.length) contacts.push(row)
        else if (hid.size) hidden.push({ ...row, via: [...hid].sort() })
      }
      // Upcoming work first (soonest on top), then the most recent past work.
      const byActivity = (a: any, b: any) =>
        (a.next ? 0 : 1) - (b.next ? 0 : 1)
        || (a.next && b.next ? a.next.startDate.localeCompare(b.next.startDate) : 0)
        || (b.last?.startDate ?? '').localeCompare(a.last?.startDate ?? '')
        || b.sharedEvents - a.sharedEvents
        || a.name.localeCompare(b.name)
      contacts.sort(byActivity)
      hidden.sort((a, b) => a.name.localeCompare(b.name))
      return { pages, contacts, hidden }
    }),

  // Add someone to one of my pages' network by hand.
  add: protectedProcedure
    .input(z.object({ from: handle, username: handle }))
    .mutation(async ({ ctx, input }) => {
      const [page] = await myPages(ctx, input.from)
      const [other] = await ctx.db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, input.username))
      if (!other) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
      if (other.id === page!.id) throw new TRPCError({ code: 'BAD_REQUEST', message: 'That’s your own page.' })
      await ctx.db.insert(networkLinks)
        .values({ profileId: page!.id, otherProfileId: other.id, status: 'added', createdBy: ctx.dancerId })
        .onConflictDoUpdate({ target: [networkLinks.profileId, networkLinks.otherProfileId], set: { status: 'added', createdBy: ctx.dancerId, createdAt: new Date() } })
      return { ok: true }
    }),

  // Hide a contact from these pages' network (all of `from` must be mine).
  hide: protectedProcedure
    .input(z.object({ from: z.array(handle).min(1).max(50), username: handle }))
    .mutation(async ({ ctx, input }) => {
      const pages = (await Promise.all(input.from.map(u => myPages(ctx, u)))).flat()
      const [other] = await ctx.db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, input.username))
      if (!other) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
      for (const page of pages) {
        if (page.id === other.id) continue
        await ctx.db.insert(networkLinks)
          .values({ profileId: page.id, otherProfileId: other.id, status: 'hidden', createdBy: ctx.dancerId })
          .onConflictDoUpdate({ target: [networkLinks.profileId, networkLinks.otherProfileId], set: { status: 'hidden', createdBy: ctx.dancerId, createdAt: new Date() } })
      }
      return { ok: true }
    }),

  // Undo a hide (or drop a hand-added contact): back to what events say.
  restore: protectedProcedure
    .input(z.object({ from: z.array(handle).min(1).max(50), username: handle }))
    .mutation(async ({ ctx, input }) => {
      const pages = (await Promise.all(input.from.map(u => myPages(ctx, u)))).flat()
      const [other] = await ctx.db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, input.username))
      if (!other) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
      await ctx.db.delete(networkLinks).where(and(
        inArray(networkLinks.profileId, pages.map(p => p.id)),
        eq(networkLinks.otherProfileId, other.id),
      ))
      return { ok: true }
    }),
})
