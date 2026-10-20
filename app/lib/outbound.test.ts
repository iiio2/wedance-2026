import { describe, it, expect } from 'vitest'
import { classifyOutbound, ticketProvider } from './outbound'

const HERE = '2026.wedance.vip'

describe('classifyOutbound', () => {
  it('ignores links that stay on WeDance', () => {
    expect(classifyOutbound('/events/1', HERE)).toBeNull()
    expect(classifyOutbound('#reviews', HERE)).toBeNull()
    expect(classifyOutbound('https://2026.wedance.vip/cities', HERE)).toBeNull()
    expect(classifyOutbound('javascript:void(0)', HERE)).toBeNull()
    expect(classifyOutbound('', HERE)).toBeNull()
    expect(classifyOutbound(null, HERE)).toBeNull()
  })

  it.each([
    ['https://www.instagram.com/someone/', 'instagram', 'instagram.com'],
    ['https://wa.me/4917612345678', 'whatsapp', 'wa.me'],
    ['https://chat.whatsapp.com/AbCdEf', 'whatsapp', 'chat.whatsapp.com'],
    ['https://t.me/salsamunich', 'telegram', 't.me'],
    ['https://maps.app.goo.gl/xyz', 'map', 'maps.app.goo.gl'],
    ['https://www.google.com/maps/place/Foo', 'map', 'google.com'],
    ['https://www.google.com/search?q=x', 'website', 'google.com'],
    ['https://www.tickettailor.com/events/x/123', 'ticket', 'tickettailor.com'],
    ['https://www.eventbrite.de/e/x', 'ticket', 'eventbrite.de'],
    ['https://youtu.be/abc', 'youtube', 'youtu.be'],
    ['https://salsa-school.de/kurse?id=1', 'website', 'salsa-school.de'],
  ])('%s → %s', (href, kind, host) => {
    expect(classifyOutbound(href, HERE)).toEqual({ kind, platform: kind, host })
  })

  it('never returns the path, query or address', () => {
    const json = JSON.stringify([
      classifyOutbound('https://wa.me/4917612345678?text=hi', HERE),
      classifyOutbound('mailto:someone@example.com', HERE),
      classifyOutbound('tel:+4917612345678', HERE),
    ])
    expect(json).not.toMatch(/4917612345678|someone|example\.com|hi/)
    expect(classifyOutbound('mailto:a@b.c', HERE)).toEqual({ kind: 'email', platform: 'email', host: null })
    expect(classifyOutbound('tel:+1', HERE)).toEqual({ kind: 'phone', platform: 'phone', host: null })
  })

  it('lets the link say what it is (data-outbound-kind) and keeps the platform', () => {
    expect(classifyOutbound('https://chat.whatsapp.com/x', HERE, 'community_group')).toEqual({ kind: 'community_group', platform: 'whatsapp', host: 'chat.whatsapp.com' })
    expect(classifyOutbound('https://festival.com/tickets', HERE, 'ticket')).toMatchObject({ kind: 'ticket', platform: 'website' })
  })

  it('treats localhost ports as the same host', () => {
    expect(classifyOutbound('http://localhost:3000/x', 'localhost:3000')).toBeNull()
  })
})

describe('ticketProvider', () => {
  it('names the ticket shop from the link host', () => {
    expect(ticketProvider('https://www.tickettailor.com/events/x/1')).toBe('tickettailor')
    expect(ticketProvider('https://buy.stripe.com/abc')).toBe('stripe')
    expect(ticketProvider('https://festival.com/tickets')).toBe('external')
    expect(ticketProvider(null)).toBe('external')
  })
})
