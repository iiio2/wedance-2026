import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { asInline, requestOf } from './gemini'

describe('asInline', () => {
  it('reads the format off the bytes, not the content-type (v3 photos come as octet-stream)', async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#c00' } }).png().toBuffer()
    expect((await asInline(png))?.mimeType).toBe('image/png')
  })
  it('converts formats Gemini does not take to PNG', async () => {
    const gif = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#c00' } }).gif().toBuffer()
    expect((await asInline(gif))?.mimeType).toBe('image/png')
  })
  it('is null for bytes that are not an image', async () => {
    expect(await asInline(Buffer.from('<html>not found</html>'))).toBeNull()
  })
})

describe('requestOf', () => {
  it('keeps the text in order and marks each image where it sat', () => {
    const r = requestOf({ contents: [{ parts: [{ inlineData: { mimeType: 'image/png', data: 'A'.repeat(4096) } }, { inlineData: { mimeType: 'image/jpeg', data: '' } }, { text: 'Image 2 is the artist.' }] }] })
    expect(r.prompt).toBe('[image 1: image/png, 3 KB]\n[image 2: image/jpeg, 0 KB]\nImage 2 is the artist.')
    expect(r.images).toEqual([{ mimeType: 'image/png', kb: 3 }, { mimeType: 'image/jpeg', kb: 0 }])
  })
})
