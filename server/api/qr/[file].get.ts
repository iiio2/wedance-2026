import { createError, defineEventHandler, getRouterParam, setResponseHeaders } from 'h3'
import { eq } from 'drizzle-orm'
import QRCode from 'qrcode'
import { useDb } from '../../utils/db'
import { events, trackedLinks } from '../../database/schema'
import { isLinkCode, linkUrl } from '../../utils/trackedLinks'
import { requestOrigin } from '../../oauth/http'

/**
 * The QR code of a promoter's tracked link: /api/qr/<code>.svg or .png
 * (promo_kit, my_link). Only for codes that exist, so this is not an open QR
 * generator; the code always points at the event on our own origin.
 */
export default defineEventHandler(async (event) => {
  const m = /^([a-z2-9]{8})\.(svg|png)$/.exec(getRouterParam(event, 'file') ?? '')
  if (!m || !isLinkCode(m[1])) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const [row] = await useDb().select({ code: trackedLinks.code, id: events.id, name: events.name })
    .from(trackedLinks).innerJoin(events, eq(events.id, trackedLinks.eventId)).where(eq(trackedLinks.code, m[1]))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const url = linkUrl(requestOrigin(event), row, row.code)
  // The link never changes for a code (the event's name may: the short id still finds it).
  setResponseHeaders(event, { 'Cache-Control': 'public, max-age=86400' })
  if (m[2] === 'svg') {
    setResponseHeaders(event, { 'Content-Type': 'image/svg+xml' })
    return QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M' })
  }
  setResponseHeaders(event, { 'Content-Type': 'image/png' })
  return QRCode.toBuffer(url, { type: 'png', width: 1024, margin: 2, errorCorrectionLevel: 'M' })
})
