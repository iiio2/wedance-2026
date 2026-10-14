import { describe, it, expect } from 'vitest'
import { videoEmbedUrl } from './video'

describe('videoEmbedUrl', () => {
  it('turns YouTube links into embed links', () => {
    for (const l of ['https://www.youtube.com/watch?v=tnkxaw7_xxg', 'https://youtu.be/tnkxaw7_xxg?si=abc', 'youtube.com/shorts/tnkxaw7_xxg', 'https://www.youtube.com/embed/tnkxaw7_xxg'])
      expect(videoEmbedUrl(l)).toBe('https://www.youtube.com/embed/tnkxaw7_xxg')
  })
  it('turns Vimeo links into player links', () => {
    expect(videoEmbedUrl('https://vimeo.com/123456789')).toBe('https://player.vimeo.com/video/123456789')
  })
  it('rejects anything else', () => {
    expect(videoEmbedUrl('https://instagram.com/p/abc')).toBeNull()
    expect(videoEmbedUrl('not a link')).toBeNull()
    expect(videoEmbedUrl('')).toBeNull()
  })
})
