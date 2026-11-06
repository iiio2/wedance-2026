import { describe, it, expect, vi, beforeEach } from 'vitest'

const upload = vi.hoisted(() => vi.fn())
vi.mock('cloudinary', () => ({ default: { v2: { config: vi.fn(), uploader: { upload } } } }))

import { rehostImage } from './rehostImage'

let config: any
vi.stubGlobal('useRuntimeConfig', () => config)

describe('rehostImage (#454)', () => {
  beforeEach(() => {
    upload.mockReset()
    config = { cloudinaryApiKey: 'k', cloudinaryApiSecret: 's', public: { cloudinaryCloudName: 'wd' } }
  })

  it('copies a remote photo into the profiles folder and returns our URL', async () => {
    upload.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/wd/image/upload/v1/wedance-2026/profiles/a.jpg' })
    await expect(rehostImage('https://scontent.cdninstagram.com/a.jpg')).resolves.toBe('https://res.cloudinary.com/wd/image/upload/v1/wedance-2026/profiles/a.jpg')
    expect(upload).toHaveBeenCalledWith('https://scontent.cdninstagram.com/a.jpg', { folder: 'wedance-2026/profiles', resource_type: 'image' })
  })

  it('keeps a photo already on our Cloudinary', async () => {
    const own = 'https://res.cloudinary.com/wd/image/upload/v1/x.jpg'
    await expect(rehostImage(own)).resolves.toBe(own)
    expect(upload).not.toHaveBeenCalled()
  })

  it('says so when the link is not an image Cloudinary can load', async () => {
    upload.mockRejectedValue(new Error('Invalid image file'))
    await expect(rehostImage('https://example.com/page.html')).rejects.toThrow(/couldn’t be loaded/)
  })

  it('refuses when uploads are not configured', async () => {
    config = { cloudinaryApiKey: '', cloudinaryApiSecret: '', public: { cloudinaryCloudName: '' } }
    await expect(rehostImage('https://example.com/a.jpg')).rejects.toThrow(/isn’t set up/)
  })
})
