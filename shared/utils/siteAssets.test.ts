import { describe, expect, it } from 'vitest'
import { absoluteAsset, absoluteSiteAssets, siteOrigin } from './siteAssets'

describe('site assets', () => {
  it('the site’s own paths become URLs on its domain; full URLs stay', () => {
    const o = siteOrigin('https://salsaclub.example/')
    expect(o).toBe('https://salsaclub.example')
    expect(absoluteAsset('/images/group.jpg', o)).toBe('https://salsaclub.example/images/group.jpg')
    expect(absoluteAsset('https://res.cloudinary.com/x.jpg', o)).toBe('https://res.cloudinary.com/x.jpg')
    expect(absoluteAsset('//cdn.example/x.jpg', o)).toBe('//cdn.example/x.jpg')
    expect(absoluteAsset('/x.jpg', null)).toBe('/x.jpg')
    expect(siteOrigin('salsaclub.example')).toBe('https://salsaclub.example')
    expect(siteOrigin('not a url')).toBeNull()
  })
  it('sections, items and the share image', () => {
    const out = absoluteSiteAssets({
      seo: { image: '/og.jpg' },
      sections: [{ image: '/a.jpg', video: '/hero.mp4', items: [{ image: '/b.jpg' }, {}] }, {}],
    }, 'https://salsaclub.example')
    expect(out.seo?.image).toBe('https://salsaclub.example/og.jpg')
    expect(out.sections[0]).toEqual({ image: 'https://salsaclub.example/a.jpg', video: 'https://salsaclub.example/hero.mp4', items: [{ image: 'https://salsaclub.example/b.jpg' }, { image: undefined }] })
    expect(out.sections[1]).toEqual({ image: undefined, video: undefined, items: undefined })
  })
  it('no domain: unchanged', () => {
    const site = { sections: [{ image: '/a.jpg' }] }
    expect(absoluteSiteAssets(site, null)).toBe(site)
  })
})
