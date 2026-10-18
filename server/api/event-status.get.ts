import { useDb } from '../utils/db'
import { eventPageExists } from '../utils/eventLookup'

/**
 * GET /api/event-status?id=<param> → { found } — whether /events/<param> has a
 * published event (or booking request) behind it. The event page calls this
 * during SSR so a missing or unpublished event answers HTTP 404 instead of an
 * empty 200 (the page itself loads its data in the browser).
 */
export default defineEventHandler(async (event) => {
  const { id } = getQuery(event)
  const param = typeof id === 'string' ? id.trim().slice(0, 200) : ''
  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (!param) return { found: false }
  return { found: await eventPageExists(useDb(), param) }
})
