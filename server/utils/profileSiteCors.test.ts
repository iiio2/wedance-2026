import { describe, it, expect } from 'vitest'
import { createApp, createError, defineEventHandler, toWebHandler } from 'h3'
import { profileSiteCors } from './profileSiteCors'

function app(handler = defineEventHandler(() => { throw createError({ statusCode: 404, statusMessage: 'This profile has no website on WeDance yet' }) })) {
  const a = createApp()
  a.use(profileSiteCors)
  a.use(handler)
  return toWebHandler(a)
}

const get = (path: string, init: RequestInit = {}) =>
  app()(new Request(`http://localhost${path}`, { ...init, headers: { origin: 'https://artist.example', ...init.headers } }))

describe('profile site CORS', () => {
  it('puts the header on a 404', async () => {
    const res = await get('/api/profiles/artistpage/site?lang=de')
    expect(res.status).toBe(404)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('covers the events feed', async () => {
    const res = await get('/api/profiles/artistpage/events')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('answers the preflight', async () => {
    const res = await get('/api/profiles/artistpage/site', { method: 'OPTIONS', headers: { 'access-control-request-method': 'GET' } })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toContain('GET')
  })

  it('leaves other routes alone', async () => {
    const res = await get('/api/profiles/artistpage/contacts-export')
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})
