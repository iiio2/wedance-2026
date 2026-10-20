import { describe, it, expect } from 'vitest'
import { isMagicLinkSignup } from './magicLinkSignup'

const now = new Date('2026-10-20T12:00:00Z')
const fresh = {
  createdAt: new Date('2026-10-20T11:50:00Z'),
  sourceRef: null,
  hash: '',
  emailVerifiedAt: null,
  hadSession: false,
}

describe('isMagicLinkSignup', () => {
  it('counts an account the magic-link flow just created', () => {
    expect(isMagicLinkSignup(fresh, now)).toBe(true)
    expect(isMagicLinkSignup({ ...fresh, sourceRef: {} }, now)).toBe(true)
  })

  it('never counts migrated v4 dancers', () => {
    expect(isMagicLinkSignup({ ...fresh, sourceRef: { source: 'wedance-v4', firebaseId: 'x' } }, now)).toBe(false)
  })

  it('does not count old accounts, even without a password', () => {
    expect(isMagicLinkSignup({ ...fresh, createdAt: new Date('2026-10-18T12:00:00Z') }, now)).toBe(false)
    expect(isMagicLinkSignup({ ...fresh, createdAt: null }, now)).toBe(false)
  })

  it('does not count accounts with a password, a verified email or an earlier session', () => {
    expect(isMagicLinkSignup({ ...fresh, hash: 'abc' }, now)).toBe(false)
    expect(isMagicLinkSignup({ ...fresh, emailVerifiedAt: new Date('2026-10-20T11:55:00Z') }, now)).toBe(false)
    expect(isMagicLinkSignup({ ...fresh, hadSession: true }, now)).toBe(false)
  })
})
