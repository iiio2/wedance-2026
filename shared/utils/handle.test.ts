import { describe, it, expect } from 'vitest'
import { handleError, isValidHandle, RESERVED_HANDLES } from './handle'

describe('handle rule', () => {
  it('accepts Instagram handles as they are, and the dashed handles we already have', () => {
    for (const h of ['caliente.nights', 'caliente.nights2', 'ritmo_jg', '_salsa_', 'la-clave', 'abc', 'dj.lole', 'my-mia.de', 'x'.repeat(40)])
      expect(handleError(h), h).toBeNull()
  })

  it('rejects the wrong length or characters', () => {
    for (const h of ['', 'ab', 'x'.repeat(41), 'Caliente', 'two words', 'café', 'a/b', '@abc', 'a+b'])
      expect(isValidHandle(h), h).toBe(false)
  })

  it('rejects a dot or dash at either end and ".."', () => {
    for (const h of ['.salsa', 'salsa.', '-salsa', 'salsa-', 'sal..sa'])
      expect(isValidHandle(h), h).toBe(false)
  })

  it('rejects reserved words', () => {
    for (const h of ['admin', 'business', 'my-plan', 'wedance']) expect(handleError(h), h).toMatch(/reserved/)
    expect(RESERVED_HANDLES).toContain('api')
  })

  it('rejects handles that end like a file a static host would serve', () => {
    for (const h of ['salsa.js', 'flyer.png', 'feed.xml', 'robots.txt', 'favicon.ico', 'data.json', 'style.css', 'pic.jpeg', 'site.webmanifest'])
      expect(handleError(h), h).toMatch(/file name/)
    // A dot is fine when what follows isn't a file type.
    for (const h of ['salsa.munich', 'bachata.pro', 'studio.de']) expect(isValidHandle(h), h).toBe(true)
  })
})
