import { describe, it, expect } from 'vitest'
import { sizedImage } from './image'

const CLD = 'https://res.cloudinary.com/djumxevsm/image/upload'

describe('sizedImage', () => {
  it('adds a size, format and quality to a plain Cloudinary upload', () => {
    expect(sizedImage(`${CLD}/v1793646578/wedance-2026/flyers/montunoclub/abc.png`, 640))
      .toBe(`${CLD}/c_limit,w_640,f_auto,q_auto/v1793646578/wedance-2026/flyers/montunoclub/abc.png`)
  })

  it('works on uploads without a version', () => {
    expect(sizedImage(`${CLD}/wedance-2026/profiles/x.jpg`, 192))
      .toBe(`${CLD}/c_limit,w_192,f_auto,q_auto/wedance-2026/profiles/x.jpg`)
  })

  it('rounds the width', () => {
    expect(sizedImage(`${CLD}/v1/a.jpg`, 191.6)).toContain('w_192,')
  })

  it('keeps a link that already has a transformation', () => {
    const url = `${CLD}/c_fill,w_540,h_960/v1791919371/wedance-2026/flyers/ritmo-jg/z.jpg`
    expect(sizedImage(url, 640)).toBe(url)
    const single = `${CLD}/fl_attachment/v1/a.png`
    expect(sizedImage(single, 640)).toBe(single)
  })

  it('leaves other hosts, previews, videos and SVGs alone', () => {
    for (const url of [
      'https://scontent.cdninstagram.com/v/t51/abc.jpg',
      'data:image/png;base64,AAAA',
      'blob:https://2026.wedance.vip/123',
      'https://res.cloudinary.com/djumxevsm/video/upload/v1/a.mp4',
      'https://res.cloudinary.com/djumxevsm/image/fetch/https://x.com/a.jpg',
      `${CLD}/v1/logo.svg`,
      '/favicon.svg',
    ]) expect(sizedImage(url, 640)).toBe(url)
  })

  it('passes empty values through as undefined', () => {
    expect(sizedImage(null, 640)).toBeUndefined()
    expect(sizedImage(undefined, 640)).toBeUndefined()
    expect(sizedImage('', 640)).toBeUndefined()
  })
})
