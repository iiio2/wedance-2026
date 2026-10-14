/**
 * A line-up of many faces for one painting: their photos side by side in one
 * grid image, in line-up order. Painting each face from its own photo works
 * for one or two people; a festival's flyer shows everyone, so Gemini gets the
 * grid as one reference and paints a portrait of each (shared/utils/flyer.ts
 * paintPrompt, `grid`).
 */
import sharp from 'sharp'
import type { InlineImage } from './gemini'

const TILE = 384
const GAP = 12

export async function faceGrid(photos: InlineImage[]): Promise<InlineImage | null> {
  if (!photos.length) return null
  const n = photos.length
  const cols = n <= 4 ? n : n <= 9 ? 3 : 4
  const rows = Math.ceil(n / cols)
  const tiles = await Promise.all(photos.map(p => sharp(Buffer.from(p.data, 'base64')).resize(TILE, TILE, { fit: 'cover', position: 'attention' }).jpeg().toBuffer()))
  const out = await sharp({
    create: { width: cols * TILE + (cols + 1) * GAP, height: rows * TILE + (rows + 1) * GAP, channels: 3, background: '#ffffff' },
  })
    .composite(tiles.map((input, i) => ({ input, left: GAP + (i % cols) * (TILE + GAP), top: GAP + Math.floor(i / cols) * (TILE + GAP) })))
    .jpeg({ quality: 85 })
    .toBuffer()
  return { mimeType: 'image/jpeg', data: out.toString('base64') }
}
