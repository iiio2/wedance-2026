import { describe, expect, it } from 'vitest'
import { siteAccess, sitePreviewToken } from './sitePreview'
import { signPayload } from '../oauth/crypto'

describe('who sees a site', () => {
  const token = sitePreviewToken('p1')
  it('a published site (or one from before drafts existed): everyone', () => {
    expect(siteAccess({}, 'p1', null)).toEqual({ visible: true, preview: false })
    expect(siteAccess({ published: true }, 'p1', '')).toEqual({ visible: true, preview: false })
  })
  it('a draft: only with this profile’s preview link', () => {
    expect(siteAccess({ published: false }, 'p1', null).visible).toBe(false)
    expect(siteAccess({ published: false }, 'p1', token)).toEqual({ visible: true, preview: true })
    expect(siteAccess({ published: false }, 'p2', token).visible).toBe(false)
  })
  it('expired, tampered or minted for something else: no', () => {
    expect(siteAccess({ published: false }, 'p1', token, Date.now() + 8 * 24 * 3600 * 1000).visible).toBe(false)
    expect(siteAccess({ published: false }, 'p1', `${token}x`).visible).toBe(false)
    expect(siteAccess({ published: false }, 'p1', signPayload('consent', { p: 'p1' }, 600)).visible).toBe(false)
  })
})
