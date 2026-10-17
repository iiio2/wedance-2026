import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { useDb } from '../../utils/db'
import { profileContacts, profiles } from '../../database/schema'

/** The unsubscribe link in a site's welcome email (RAZ-412). The id is the secret. */
export default defineEventHandler(async (event) => {
  const id = z.string().uuid().safeParse(getQuery(event).id)
  setResponseHeader(event, 'content-type', 'text/html; charset=utf-8')
  const page = (msg: string) => `<!doctype html><meta name="viewport" content="width=device-width"><title>Unsubscribe</title><body style="font-family:sans-serif;max-width:460px;margin:15vh auto;padding:0 20px;color:#333"><p>${msg}</p></body>`
  if (!id.success) return page('This link doesn’t work any more.')
  const db = useDb()
  const [c] = await db.select({ id: profileContacts.id, name: profiles.name }).from(profileContacts)
    .innerJoin(profiles, eq(profiles.id, profileContacts.profileId)).where(eq(profileContacts.id, id.data))
  if (!c) return page('This link doesn’t work any more.')
  await db.update(profileContacts).set({ status: 'unsubscribed', updatedAt: new Date() }).where(eq(profileContacts.id, c.id))
  return page(`Done: you won’t get emails from ${c.name.replace(/[<>&]/g, '')} any more.`)
})
