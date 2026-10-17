import { z } from 'zod'
import { and, eq, gte, sql } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { dancers, profileContacts, profileMembers, profileSites, profiles } from '../../../database/schema'
import { profileByHandle, siteUrl } from '../../../utils/profileFeed'
import { sendSiteSignupTeamEmail, sendSiteWelcomeEmail } from '../../../utils/email'
import { pick, type ProfileSite } from '../../../../shared/types/profileSite'

/**
 * Sign-ups from a profile's own website (RAZ-412): the site's form posts here
 * (cross-origin, so CORS is open) and the person becomes one of the profile's
 * contacts on WeDance (/business/network/<username>/contacts). The team is
 * emailed; the person gets the welcome email the profile wrote on WeDance.
 * Signing up again with the same email updates the contact.
 *
 * Limits: 5 a day per email per profile, 300 a day per profile.
 */
const input = z.object({
  name: z.string().trim().min(1, 'Please add your name.').max(120),
  email: z.string().trim().toLowerCase().email('Please check your email address.').max(200),
  phone: z.string().trim().max(40).optional().default(''),
  locale: z.string().max(12).optional(),
  // Where they came from: form, page, utm_*, referrer, promo_code…
  source: z.record(z.string().max(40), z.string().max(500)).optional().default({}),
  // Hidden field: only bots fill it.
  website: z.string().optional(),
})

const DAY = 24 * 3600_000
const FORWARD_TO = 'hello@wedance.vip'

export default defineEventHandler(async (event) => {
  if (handleCors(event, { origin: '*', methods: ['POST', 'OPTIONS'], allowHeaders: ['content-type'] })) return
  assertMethod(event, 'POST')
  const parsed = input.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: parsed.error.issues[0]?.message || 'Check the form.' })
  const body = parsed.data
  if (body.website) return { ok: true }

  const db = useDb()
  const profile = await profileByHandle(db, String(getRouterParam(event, 'username') ?? ''))
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'Profile not found' })

  const since = new Date(Date.now() - DAY)
  const count = async (...w: any[]) => (await db.select({ n: sql<number>`count(*)::int` }).from(profileContacts).where(and(eq(profileContacts.profileId, profile.id), gte(profileContacts.updatedAt, since), ...w)))[0]?.n ?? 0
  if (await count() >= 300 || await count(eq(sql`lower(${profileContacts.email})`, body.email), gte(profileContacts.createdAt, since)) >= 5) {
    throw createError({ statusCode: 429, statusMessage: 'Thanks — we already have you.' })
  }

  const source = Object.fromEntries(Object.entries(body.source).filter(([, v]) => v))
  const [dancer] = await db.select({ id: dancers.id }).from(dancers).where(eq(sql`lower(${dancers.email})`, body.email)).limit(1)
  const [existing] = await db.select({ id: profileContacts.id }).from(profileContacts)
    .where(and(eq(profileContacts.profileId, profile.id), eq(sql`lower(${profileContacts.email})`, body.email)))
  const now = new Date()
  let id: string
  if (existing) {
    id = existing.id
    await db.update(profileContacts).set({
      name: body.name, ...(body.phone ? { phone: body.phone } : {}), locale: body.locale ?? null,
      status: 'subscribed', updatedAt: now, ...(dancer ? { dancerId: dancer.id } : {}),
    }).where(eq(profileContacts.id, id))
  } else {
    const [row] = await db.insert(profileContacts).values({
      profileId: profile.id, dancerId: dancer?.id ?? null, email: body.email, name: body.name,
      phone: body.phone || null, locale: body.locale ?? null, source,
    }).returning({ id: profileContacts.id })
    id = row!.id
  }

  // Emails never fail the sign-up.
  const [siteRow] = await db.select({ content: profileSites.content }).from(profileSites).where(eq(profileSites.profileId, profile.id))
  const site = siteRow?.content as ProfileSite | undefined
  const [p] = await db.select({ contact: profiles.contact }).from(profiles).where(eq(profiles.id, profile.id))
  const team = await db.select({ email: dancers.email, name: dancers.name }).from(profileMembers)
    .innerJoin(dancers, eq(dancers.id, profileMembers.dancerId)).where(eq(profileMembers.profileId, profile.id))
  const own = (p?.contact as { email?: string } | null)?.email?.trim()
  const to = team.length ? team : [{ email: own || FORWARD_TO, name: profile.name }]
  for (const m of to) {
    try {
      await sendSiteSignupTeamEmail({
        to: m.email, name: m.name ?? profile.name, profileName: profile.name,
        contact: { name: body.name, email: body.email, phone: body.phone, locale: body.locale },
        source, link: `${siteUrl()}/business/network/${profile.username}/contacts`,
      })
    } catch (e) { console.error('[contacts] team email failed', e) }
  }
  if (!existing && site?.welcome) {
    const lang = body.locale && site.locales.includes(body.locale) ? body.locale : site.locales[0]!
    const first = body.name.split(' ')[0]!
    const subject = pick(site.welcome.subject, lang, site.locales[0]!).replaceAll('{name}', first)
    const text = pick(site.welcome.body, lang, site.locales[0]!).replaceAll('{name}', first)
    if (subject && text) {
      try {
        await sendSiteWelcomeEmail({
          to: body.email, profileName: profile.name, replyTo: own || team[0]?.email, subject, body: text,
          siteUrl: site.domain, unsubscribeUrl: `${siteUrl()}/api/contacts/unsubscribe?id=${id}`,
        })
      } catch (e) { console.error('[contacts] welcome email failed', e) }
    }
  }
  return { ok: true }
})
