import { describe, it, expect } from 'vitest'
import { isLocalHost } from './analytics-host'

describe('isLocalHost', () => {
  it.each(['localhost', '127.0.0.1', '127.1.2.3', '[::1]', '::1', '0.0.0.0', 'app.localhost', 'wedance.test', 'LOCALHOST'])('%s is local', (h) => {
    expect(isLocalHost(h)).toBe(true)
  })

  it.each(['2026.wedance.vip', 'wedance-2026-git-x.vercel.app', 'localhost.example.com', 'test.wedance.vip', '', null, undefined])('%s is not local', (h) => {
    expect(isLocalHost(h as string)).toBe(false)
  })
})
