import { describe, it, expect } from 'vitest'
import { isRedacted, planUsers, stdBase64, type AuthUser, type ExistingDancer } from './v3UserSync'

const REDACTED = Buffer.from('REDACTED').toString('base64')
const dancer = (d: Partial<ExistingDancer>): ExistingDancer => ({
  id: 'd1', email: 'a@x.de', name: 'A', photo: null, bio: null, city: null, instagram: null, hash: '', salt: '', sourceRef: null, ...d,
})
const run = (authUsers: AuthUser[], existing: ExistingDancer[] = [], profiles: Record<string, any> = {}) =>
  planUsers({ authUsers, existing, profiles: new Map(Object.entries(profiles)), cityOfPlace: p => (p === 'MUC' ? 'Munich' : null) })

describe('planUsers', () => {
  it('creates a new person from their v3 profile, keeping their sign-up date, with no handle', () => {
    const p = run([{ localId: 'u1', email: 'New@X.de', createdAt: '1700000000000', displayName: 'Auth Name' }], [],
      { u1: { name: 'Profile Name', photo: 'https://img/p.png', bio: 'hi', place: 'MUC', instagram: 'https://instagram.com/New.Dancer/' } })
    expect(p.ops).toEqual([{ op: 'create', uid: 'u1', email: 'new@x.de', createdAt: new Date(1700000000000),
      fields: { name: 'Profile Name', photo: 'https://img/p.png', bio: 'hi', city: 'Munich', instagram: 'new.dancer', hash: '', salt: '' } }])
  })

  it('matches by v3 id before email, fills only empty fields and never renames', () => {
    const p = run([{ localId: 'u1', email: 'changed@x.de' }],
      [dancer({ id: 'd1', email: 'old@x.de', name: 'Kept', bio: 'mine', sourceRef: { firebaseId: 'u1' } })],
      { u1: { name: 'Other', bio: 'theirs', photo: 'https://img/p.png' } })
    expect(p.stats.matchedById).toBe(1)
    expect(p.ops).toEqual([{ op: 'fill', id: 'd1', uid: 'u1', email: 'changed@x.de', fields: { photo: 'https://img/p.png' }, sourceRef: null }])
  })

  it('skips a profile photo that no longer loads and falls back to the Auth photo', () => {
    const dead = 'https://res.cloudinary.com/x/dead.jpg'
    const plan = (auth?: string) => planUsers({ authUsers: [{ localId: 'u1', email: 'n@x.de', photoUrl: auth }], existing: [],
      profiles: new Map([['u1', { name: 'N', photo: dead }]]), cityOfPlace: () => null, deadPhotos: new Set([dead]) })
    expect((plan().ops[0] as any).fields.photo).toBeNull()
    expect((plan('https://lh3.googleusercontent.com/a.jpg').ops[0] as any).fields.photo).toBe('https://lh3.googleusercontent.com/a.jpg')
  })

  it('records the v3 id on a person matched only by email', () => {
    const p = run([{ localId: 'u2', email: 'a@x.de' }], [dancer({ sourceRef: { v4UserId: 'v4' } })])
    expect(p.stats.matchedByEmail).toBe(1)
    expect(p.ops[0]).toMatchObject({ op: 'fill', sourceRef: { v4UserId: 'v4', firebaseId: 'u2' } })
  })

  it('never tags a 2026 account it only matched as created by the sync (that tag is the rollback key)', () => {
    const p = run([{ localId: 'u4', email: 'a@x.de' }], [dancer({ sourceRef: null })])
    expect(p.ops[0]).toMatchObject({ op: 'fill', sourceRef: { firebaseId: 'u4' } })
    expect((p.ops[0] as any).sourceRef.source).toBeUndefined()
  })

  it('is a no-op for people already up to date', () => {
    const p = run([{ localId: 'u1', email: 'a@x.de' }], [dancer({ sourceRef: { firebaseId: 'u1' } })])
    expect(p.ops).toEqual([])
    expect(p.stats.unchanged).toBe(1)
  })

  it('copies a real password hash (as standard base64), never a REDACTED one, and never replaces a password', () => {
    const real = { passwordHash: 'ab-_cd', salt: 'c2FsdA' }
    const p = run([
      { localId: 'n1', email: 'new@x.de', ...real },
      { localId: 'n2', email: 'red@x.de', passwordHash: REDACTED, salt: 'c2FsdA' },
      { localId: 'u3', email: 'has@x.de', ...real },
    ], [dancer({ id: 'd3', email: 'has@x.de', hash: 'existing', sourceRef: { firebaseId: 'u3' } })])
    const create = (uid: string) => p.ops.find(o => o.op === 'create' && o.uid === uid)
    expect(create('n1')).toMatchObject({ fields: { hash: stdBase64('ab-_cd'), salt: stdBase64('c2FsdA') } })
    expect(create('n2')).toMatchObject({ fields: { hash: '', salt: '' } })
    expect(p.ops.find(o => o.op === 'fill')).toBeUndefined()
    expect(p.stats.passwordsRedacted).toBe(true)
    expect(isRedacted(REDACTED)).toBe(true)
  })

  it('skips disabled and email-less accounts, and keeps the oldest of a duplicated email', () => {
    const p = run([
      { localId: 'late', email: 'dup@x.de', createdAt: '2000' },
      { localId: 'early', email: 'DUP@x.de', createdAt: '1000' },
      { localId: 'off', email: 'off@x.de', disabled: true },
      { localId: 'anon' },
    ])
    expect(p.ops.map(o => o.uid)).toEqual(['early'])
    expect(p.stats.skipped).toBe(3)
  })
})
