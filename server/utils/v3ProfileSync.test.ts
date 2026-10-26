import { describe, it, expect } from 'vitest'
import { addressKey, isAddressName, planProfiles, toSocials, type ExistingProfile } from './v3ProfileSync'
import { buildCityIndex } from './v3EventSync'

const MUNICH = 'ChIJ2V-Mo_l1nkcRfZixfUq4DAE'
const cityIndex = buildCityIndex([{ city: 'Munich', citySlug: 'munich' }])
const venue = (name: string, address: string, extra: Record<string, any> = {}) => ({
  name, formatted_address: address,
  address_components: [{ long_name: 'München', types: ['locality'] }, { long_name: 'Germany', short_name: 'DE', types: ['country'] }],
  geometry: { location: { lat: 48.14, lng: 11.55 } }, ...extra,
})
const ev = (id: string, v: any, org: any = null, artists: any[] = []) => ({ id, type: 'event', name: 'E', startDate: 2e12, place: MUNICH, venue: v, org, artists })
const row = (p: Partial<ExistingProfile>): ExistingProfile => ({
  id: p.username!, type: 'venue', name: '', city: 'Munich', citySlug: 'munich', photo: null, bio: null, styles: [],
  address: null, socials: [], claimed: false, sourceRef: null, ...p, username: p.username!,
})
const run = (events: any[], existing: ExistingProfile[], v3Profiles: any[] = []) =>
  planProfiles({ events, eligibleIds: new Set(events.map(e => e.id)), v3Profiles, existing, takenHandles: new Set(), cityIndex, placeLocality: new Map([[MUNICH, 'München']]) })

describe('helpers', () => {
  it('normalises street addresses for matching', () => {
    expect(addressKey('Arnulfstraße 195, 80634 München, Germany')).toBe('arnulfstrasse 195')
    expect(addressKey('Arnulfstr. 195, München')).toBe('arnulfstrasse 195')
    expect(addressKey('Hofgarten, München')).toBeNull()
  })
  it('detects address-only venue names', () => {
    expect(isAddressName('Arnulfstraße 195', 'Arnulfstraße 195, 80634 München')).toBe(true)
    expect(isAddressName('Buena Vista Bar', 'Herzog-Wilhelm-Str. 8, München')).toBe(false)
  })
  it('keeps only public social links, turning handles into URLs', () => {
    expect(toSocials({ instagram: 'salsea', facebook: 'https://facebook.com/x', email: 'a@b.c', phone: '+49', whatsapp: '1' }))
      .toEqual([{ platform: 'instagram', url: 'https://instagram.com/salsea' }, { platform: 'facebook', url: 'https://facebook.com/x' }])
  })
})

describe('planProfiles — venues', () => {
  it('links by Google place id (v4 venue handle convention)', () => {
    const p = run([ev('e1', venue('Club', 'X 1, München', { place_id: 'ChIJabc' }))], [row({ username: 'ChIJabc', name: 'Club Old' })])
    expect(p.links.get('e1')!.venueUsername).toBe('ChIJabc')
    expect(p.ops.filter(o => o.op === 'create')).toHaveLength(0)
  })
  it('links by name + city, then by address + city', () => {
    const p = run([
      ev('e1', venue('Buena Vista Bar', 'Herzog-Wilhelm-Straße 8, München')),
      ev('e2', venue('Arnulfstraße 195', 'Arnulfstraße 195, 80634 München')),
    ], [row({ username: 'bvb', name: 'Buena Vista Bar' }), row({ username: 'kizztalk', name: 'Kizztalk', address: 'Arnulfstr. 195, 80634 München' })])
    expect(p.links.get('e1')!.venueUsername).toBe('bvb')
    expect(p.links.get('e2')!.venueUsername).toBe('kizztalk')
    expect(p.how.venue).toMatchObject({ 'name+city': 1, 'address+city': 1 })
  })
  it('matches a contained venue name ("Dianatempel, Hofgarten" → "Dianatempel")', () => {
    const p = run([ev('e1', venue('Dianatempel, Hofgarten', 'Dianatempel, Hofgarten, 80538 München'))], [row({ username: 'dt', name: 'Dianatempel' })])
    expect(p.links.get('e1')!.venueUsername).toBe('dt')
  })
  it('creates one venue named from the address and reuses it for every event there', () => {
    const v = venue('Arnulfstraße 195', 'Arnulfstraße 195, 80634 München, Germany')
    const p = run([ev('e1', v), ev('e2', v)], [])
    const creates = p.ops.filter(o => o.op === 'create')
    expect(creates).toHaveLength(1)
    expect(creates[0]!.op === 'create' && creates[0]!.fields).toMatchObject({ type: 'venue', name: 'Arnulfstraße 195', citySlug: 'munich', sourceRef: { source: 'wedance-v3' } })
    expect(p.links.get('e1')!.venueUsername).toBe(p.links.get('e2')!.venueUsername)
    expect(p.createdFromAddress).toEqual(['Arnulfstraße 195 (Munich)'])
  })
  it('reads the street out of "Venue Name, Street 4, 80799 München"', () => {
    expect(addressKey('Salsamás Maxvorstadt, Schnorrstr. 4, 80799 München')).toBe('schnorrstrasse 4')
  })
  it('uses the organiser profile as venue when the school hosts its own classes', () => {
    const p = run([ev('e1', venue('Mike Dance Tanzschule', 'Klausenburger Str. 9, 81677 München'), { id: 'm1', username: 'mikedancetanzschule' })],
      [row({ username: 'mikedancetanzschule', type: 'organizer', name: 'Mike Dance Tanzschule München', sourceRef: { firebaseId: 'm1' } })])
    expect(p.links.get('e1')).toMatchObject({ venueUsername: 'mikedancetanzschule', organizerUsername: 'mikedancetanzschule' })
    expect(p.ops.filter(o => o.op === 'create')).toHaveLength(0)
  })
  it('never writes to a claimed profile', () => {
    const p = run([ev('e1', venue('Buena Vista Bar', 'Herzog-Wilhelm-Straße 8, München'))], [row({ username: 'bvb', name: 'Buena Vista Bar', claimed: true })])
    expect(p.links.get('e1')!.venueUsername).toBe('bvb')
    expect(p.ops).toHaveLength(0)
  })
})

describe('planProfiles — organisers & artists', () => {
  const v = venue('Buena Vista Bar', 'Herzog-Wilhelm-Straße 8, München')
  it('links an organiser by v3 profile id (source_ref.firebaseId) and only fills empty fields', () => {
    const p = run([ev('e1', v, { id: 'v3org', username: 'MontunoClub', name: 'Montuno Club', photo: 'https://img/x.png' })],
      [row({ username: 'montunoclub', type: 'organizer', name: 'MontunoClub', bio: 'mine', sourceRef: { firebaseId: 'v3org' } })],
      [{ id: 'v3org', type: 'Organiser', username: 'MontunoClub', name: 'Montuno Club', photo: 'https://img/x.png', bio: 'theirs', visibility: 'Public', place: MUNICH, email: 'x@y.z', phone: '1' }])
    expect(p.links.get('e1')!.organizerUsername).toBe('montunoclub')
    const fill = p.ops.find(o => o.op === 'fill')!
    expect(fill.fields).toMatchObject({ photo: 'https://img/x.png' })
    expect((fill.fields as any).bio).toBeUndefined() // not empty → untouched
    expect((fill.fields as any).name).toBeUndefined() // never renamed
    expect(JSON.stringify(p.ops)).not.toMatch(/x@y\.z|"phone"/)
  })
  it('creates an unclaimed organiser from a public v3 profile and never links the seeding bot', () => {
    const p = run([ev('e1', v, { id: 'o2', username: 'NewSchool' }), ev('e2', v, { username: 'wedance-bot' })], [],
      [{ id: 'o2', type: 'Organiser', username: 'NewSchool', name: 'New School', visibility: 'Public', place: MUNICH, instagram: 'newschool' }])
    expect(p.links.get('e1')!.organizerUsername).toBe('newschool')
    expect(p.links.get('e2')!.organizerUsername).toBeNull()
    const c = p.ops.find(o => o.op === 'create' && o.fields.type === 'organizer')!
    expect(c.op === 'create' && c.fields).toMatchObject({ name: 'New School', citySlug: 'munich', socials: [{ platform: 'instagram', url: 'https://instagram.com/newschool' }], sourceRef: { source: 'wedance-v3', sourceId: 'o2' } })
  })
  it('skips private (Members-only) v3 artists that no public event names', () => {
    const p = run([ev('e1', v)], [], [{ id: 'a1', type: 'Artist', username: 'hidden', name: 'Hidden', visibility: 'Members', place: MUNICH }])
    expect(p.stats.artist.skippedPrivate).toBe(1)
    expect(p.ops.filter(o => o.op === 'create' && o.fields.type === 'artist')).toHaveLength(0)
  })
  it('links artists named on the event', () => {
    const p = run([ev('e1', v, null, [{ id: 'a2', username: 'Migo.bachatero', name: 'Migo' }])], [],
      [{ id: 'a2', type: 'Artist', username: 'Migo.bachatero', name: 'Migo', visibility: 'Public', place: MUNICH }])
    expect(p.links.get('e1')!.artists).toEqual(['migo.bachatero'])
  })
})

// RAZ-685 — C3: synced events link the same venue / organiser / artist every
// time, by the documented priority, inside the event's city.
describe('C3 deterministic profile matching (RAZ-685)', () => {
  const v = venue('Buena Vista Bar', 'Herzog-Wilhelm-Straße 8, München', { place_id: 'ChIJbvb000000000000000' })

  it('venue: place id beats name + city beats address + city', () => {
    const existing = [
      row({ username: 'by-address', name: 'Something Else', address: 'Herzog-Wilhelm-Str. 8, 80331 München' }),
      row({ username: 'by-name', name: 'Buena Vista Bar' }),
      row({ username: 'ChIJbvb000000000000000', name: 'Old Google Name' }),
    ]
    expect(run([ev('e1', v)], existing).links.get('e1')!.venueUsername).toBe('ChIJbvb000000000000000')
    expect(run([ev('e1', v)], existing.slice(0, 2)).links.get('e1')!.venueUsername).toBe('by-name')
    expect(run([ev('e1', v)], existing.slice(0, 1)).links.get('e1')!.venueUsername).toBe('by-address')
  })

  it('organiser: v3 profile id beats handle beats name + city', () => {
    const org = { id: 'v3-org-1', username: 'SalsaSchool', name: 'Salsa School' }
    const existing = [
      row({ username: 'name-twin', type: 'organizer', name: 'Salsa School' }),
      row({ username: 'salsaschool', type: 'organizer', name: 'Different' }),
      row({ username: 'by-v3-id', type: 'organizer', name: 'Renamed School', sourceRef: { firebaseId: 'v3-org-1' } }),
    ]
    expect(run([ev('e1', v, org)], existing).links.get('e1')!.organizerUsername).toBe('by-v3-id')
    expect(run([ev('e1', v, org)], existing.slice(0, 2)).links.get('e1')!.organizerUsername).toBe('salsaschool')
    expect(run([ev('e1', v, org)], existing.slice(0, 1)).links.get('e1')!.organizerUsername).toBe('name-twin')
  })

  it('never matches a same-named venue or organiser in another city', () => {
    const prague = { city: 'Prague', citySlug: 'prague' }
    const p = run([ev('e1', venue('Buena Vista Bar', 'Herzog-Wilhelm-Straße 8, München'), { id: 'o9', username: 'TwinSchool', name: 'Twin School' })], [
      row({ username: 'bvb-prague', name: 'Buena Vista Bar', ...prague }),
      row({ username: 'twin-prague', type: 'organizer', name: 'Twin School', ...prague }),
    ])
    const links = p.links.get('e1')!
    expect(links.venueUsername).not.toBe('bvb-prague')
    expect(links.organizerUsername).not.toBe('twin-prague')
    const created = p.ops.filter(o => o.op === 'create').map(o => o.op === 'create' && o.fields)
    expect(created).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'venue', citySlug: 'munich' }),
      expect.objectContaining({ type: 'organizer', citySlug: 'munich' }),
    ]))
  })

  it('with several candidates picks claimed first, then a real handle over a place id, then alphabetical — whatever the row order', () => {
    const twins = [
      row({ username: 'zz-bvb', name: 'Buena Vista Bar' }),
      row({ username: 'ChIJtwin00000000000000', name: 'Buena Vista Bar' }),
      row({ username: 'aa-bvb', name: 'Buena Vista Bar' }),
    ]
    const plain = venue('Buena Vista Bar', 'Herzog-Wilhelm-Straße 8, München')
    for (const order of [twins, [...twins].reverse(), [twins[1]!, twins[2]!, twins[0]!]]) {
      expect(run([ev('e1', plain)], order).links.get('e1')!.venueUsername).toBe('aa-bvb')
      expect(run([ev('e1', plain)], [...order, row({ username: 'zz-claimed', name: 'Buena Vista Bar', claimed: true })]).links.get('e1')!.venueUsername).toBe('zz-claimed')
    }
    expect(run([ev('e1', plain)], [twins[0]!, twins[1]!]).links.get('e1')!.venueUsername).toBe('zz-bvb')
  })

  it('repeated resolution produces the same links and operations', () => {
    const events = [
      ev('e1', v, { id: 'o1', username: 'NewSchool', name: 'New School' }, [{ id: 'a1', username: 'dj.one', name: 'DJ One' }]),
      ev('e2', venue('Arnulfstraße 195', 'Arnulfstraße 195, 80634 München'), { id: 'o1', username: 'NewSchool' }, [{ id: 'a1', username: 'dj.one' }]),
      ev('e3', venue('Arnulfstraße 195', 'Arnulfstraße 195, 80634 München')),
    ]
    const existing = [row({ username: 'aa-bvb', name: 'Buena Vista Bar' })]
    const v3 = [{ id: 'o1', type: 'Organiser', username: 'NewSchool', name: 'New School', visibility: 'Public', place: MUNICH }]
    const first = run(events, existing, v3)
    const again = run(events, existing, v3)
    const shuffled = run([...events].reverse(), [...existing].reverse(), v3)
    expect([...again.links]).toEqual([...first.links])
    expect(again.ops).toEqual(first.ops)
    expect(Object.fromEntries(shuffled.links)).toEqual(Object.fromEntries(first.links))
    // One profile per identity: the address venue and the organiser are created once.
    expect(first.ops.filter(o => o.op === 'create').map(o => o.op === 'create' && o.fields.username).sort())
      .toEqual([...new Set(first.ops.filter(o => o.op === 'create').map(o => o.op === 'create' && o.fields.username))].sort())
    expect(first.links.get('e2')!.venueUsername).toBe(first.links.get('e3')!.venueUsername)
  })
})

// RAZ-686 — C3: only public v3 profiles and only their public fields are copied.
describe('C3 imported profiles carry public safe fields only (RAZ-686)', () => {
  const v = venue('Buena Vista Bar', 'Herzog-Wilhelm-Straße 8, München', { international_phone_number: '+49 89 1234', formatted_phone_number: '089 1234', website: 'https://bvb.example' })
  const PRIVATE = { email: 'private@example.com', phone: '+49 170 0000', whatsapp: '+49 170 1111', telegram: '@secret-tg', password: 'secret-password', hash: 'secret-hash', salt: 'secret-salt', birthday: '1990-01-01', gender: 'secret-gender', uid: 'secret-firebase-uid' }
  const ALLOWED = new Set(['username', 'type', 'name', 'city', 'citySlug', 'photo', 'bio', 'styles', 'address', 'socials', 'sourceRef'])

  it('creates profiles with allowed fields only — no contact or login data', () => {
    const p = run([ev('e1', v, { id: 'o1', username: 'PubSchool', name: 'Pub School', ...PRIVATE }, [{ id: 'a1', username: 'pub.artist', name: 'Pub Artist', ...PRIVATE }])], [], [
      { id: 'o1', type: 'Organiser', username: 'PubSchool', name: 'Pub School', bio: 'We teach', photo: 'https://img/o.png', instagram: 'pubschool', visibility: 'Public', place: MUNICH, ...PRIVATE },
      { id: 'a1', type: 'Artist', username: 'pub.artist', name: 'Pub Artist', visibility: 'Public', place: MUNICH, ...PRIVATE },
    ])
    const creates = p.ops.filter(o => o.op === 'create')
    expect(creates.map(o => o.op === 'create' && o.fields.type).sort()).toEqual(['artist', 'organizer', 'venue'])
    for (const o of creates) {
      if (o.op !== 'create') continue
      expect(Object.keys(o.fields).filter(k => !ALLOWED.has(k))).toEqual([])
      expect(o.fields.socials.every(s => ['instagram', 'facebook', 'youtube', 'tiktok', 'twitter', 'spotify', 'website'].includes(s.platform))).toBe(true)
    }
    const json = JSON.stringify(p.ops)
    for (const secret of Object.values(PRIVATE)) expect(json).not.toContain(secret)
    expect(json).not.toMatch(/1234/) // the venue's phone numbers
  })

  it('a Members-only organiser named by a public event is built from the event snapshot, never its private profile', () => {
    const p = run([ev('e1', v, { id: 'o2', username: 'HiddenSchool', name: 'Hidden School' })], [], [
      { id: 'o2', type: 'Organiser', username: 'HiddenSchool', name: 'Private Name', bio: 'members-only bio', photo: 'https://img/private.png', instagram: 'privateig', visibility: 'Members', place: MUNICH },
    ])
    const c = p.ops.find(o => o.op === 'create' && o.fields.type === 'organizer')
    expect(c && c.op === 'create' && c.fields).toMatchObject({ name: 'Hidden School', bio: null, photo: null, socials: [] })
    expect(JSON.stringify(p.ops)).not.toMatch(/members-only bio|private\.png|privateig|Private Name/)
  })

  // KNOWN DEFECT (follow-up RAZ-726): resolvePerson reads the v3 profile's place before
  // checking visibility, so a Members-only profile's city reaches the public profile.
  // Expected to fail until fixed — flip to it() then.
  it.fails('a Members-only organiser takes its city from the public event, not from its private profile', () => {
    const p = run([ev('e1', v, { id: 'o4', username: 'ElsewhereSchool', name: 'Elsewhere School' })], [], [
      { id: 'o4', type: 'Organiser', username: 'ElsewhereSchool', name: 'Elsewhere School', visibility: 'Members', place: 'ChIJprivatecity00000000' },
      { id: 'c1', type: 'City', name: 'Prague', place: 'ChIJprivatecity00000000' },
    ])
    const c = p.ops.find(o => o.op === 'create' && o.fields.type === 'organizer')
    expect(c && c.op === 'create' && c.fields).toMatchObject({ city: 'Munich', citySlug: 'munich' })
  })

  it('never fills an existing profile from a Members-only v3 profile', () => {
    const p = run([ev('e1', v, { id: 'o3', username: 'Matched' })],
      [row({ username: 'matched', type: 'organizer', name: 'Matched', sourceRef: { firebaseId: 'o3' } })],
      [{ id: 'o3', type: 'Organiser', username: 'Matched', name: 'Matched', bio: 'secret bio', photo: 'https://img/secret.png', visibility: 'Members', place: MUNICH }])
    expect(p.links.get('e1')!.organizerUsername).toBe('matched')
    expect(p.ops.filter(o => o.op !== 'create')).toEqual([])
  })

  it('skips Members-only artists of the synced city that no event names (none created)', () => {
    const p = run([ev('e1', v)], [], [
      { id: 'a5', type: 'Artist', username: 'members.artist', name: 'Members Artist', visibility: 'Members', place: MUNICH },
      { id: 'a6', type: 'Artist', username: 'public.artist', name: 'Public Artist', visibility: 'Public', place: MUNICH },
    ])
    const artists = p.ops.filter(o => o.op === 'create' && o.fields.type === 'artist').map(o => o.op === 'create' && o.fields.username)
    expect(artists).toEqual(['public.artist'])
  })
})
