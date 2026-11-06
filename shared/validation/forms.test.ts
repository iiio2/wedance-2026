import { describe, it, expect } from 'vitest'
import {
  bookingRequestSchema,
  BusinessCreateSchema,
  ChangePasswordSchema,
  CommunityGroupSchema,
  deleteAccountSchema,
  FestivalBasicsSchema,
  GigSchema,
  GiveawaySchema,
  LoginSchema,
  onboardingDetailsSchema,
  ProfileSettingsSchema,
  RegisterSchema,
  RenameHandleSchema,
  ReportProblemSchema,
  ResetPasswordSchema,
  RidePostSchema,
  VideoSubmissionSchema,
  validateForm,
} from './index'

function errorOf(result: ReturnType<typeof validateForm>) {
  return result.success ? null : result.error
}

describe('validateForm', () => {
  it('returns the trimmed payload on success', () => {
    const result = validateForm(LoginSchema, { email: '  ana@example.com ', password: ' secret ' })
    expect(result).toEqual({ success: true, data: { email: 'ana@example.com', password: ' secret ' } })
  })

  it('reports the first invalid field first, one message per field', () => {
    const result = validateForm(RegisterSchema, { name: '  ', email: '', password: 'short' })
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error).toBe('Name is required.')
    // email has both "required" and "invalid" issues — only the first is kept.
    expect(result.errors).toEqual([
      'Name is required.',
      'Email is required.',
      'Password must be at least 8 characters.',
    ])
    expect(result.fieldErrors).toEqual({
      name: 'Name is required.',
      email: 'Email is required.',
      password: 'Password must be at least 8 characters.',
    })
  })

  it('keys cross-field errors by the field they are forwarded to', () => {
    const result = validateForm(ResetPasswordSchema, { password: '12345678', confirmPassword: 'nope' })
    expect(result.success ? null : result.fieldErrors).toEqual({ confirmPassword: 'Passwords do not match.' })
  })
})

describe('auth schemas', () => {
  it('rejects a malformed email', () => {
    expect(errorOf(validateForm(LoginSchema, { email: 'ana@', password: 'x' }))).toBe('Enter a valid email address.')
  })

  it('checks that the reset passwords match', () => {
    expect(errorOf(validateForm(ResetPasswordSchema, { password: '', confirmPassword: '' }))).toBe('Password is required.')
    expect(errorOf(validateForm(ResetPasswordSchema, { password: '12345678', confirmPassword: '1234567' }))).toBe('Passwords do not match.')
    expect(validateForm(ResetPasswordSchema, { password: '12345678', confirmPassword: '12345678' }).success).toBe(true)
  })
})

describe('onboardingDetailsSchema', () => {
  it('validates only the fields the persona collects', () => {
    const social = onboardingDetailsSchema({ city: true, styles: true, role: true })
    expect(errorOf(validateForm(social, { city: ' ', danceStyles: ['Salsa'], role: 'lead' }))).toBe('Please tell us your city.')
    expect(errorOf(validateForm(social, { city: 'Munich', danceStyles: [], role: 'lead' }))).toBe('Pick at least one dance style.')
    expect(errorOf(validateForm(social, { city: 'Munich', danceStyles: ['Salsa'], role: '' }))).toBe('Choose lead, follow, or both.')

    const festivals = onboardingDetailsSchema({ styles: true, role: true })
    expect(validateForm(festivals, { city: 'ignored', danceStyles: ['Zouk'], role: 'both' })).toEqual({
      success: true,
      data: { city: undefined, danceStyles: ['Zouk'], role: 'both' },
    })
  })
})

describe('ProfileSettingsSchema', () => {
  const base = {
    name: 'Ana', city: ' ', danceStyles: [], danceLevels: {}, role: '', photo: '', bio: '',
    instagram: '', youtube: '', website: '', profilePublic: true,
  }

  it('keeps blank text fields as "" (clears them) but omits a blank photo', () => {
    const result = validateForm(ProfileSettingsSchema, base)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.city).toBe('')
    expect(result.data.role).toBeUndefined()
    expect(result.data.photo).toBeUndefined()
  })

  it('rejects a non-http photo URL', () => {
    expect(errorOf(validateForm(ProfileSettingsSchema, { ...base, photo: 'javascript:alert(1)' }))).toBe('Enter a valid image URL.')
  })
})

describe('account schemas', () => {
  it('requires both passwords when changing it', () => {
    expect(errorOf(validateForm(ChangePasswordSchema, { current: '', next: '12345678' }))).toBe('Enter your current password.')
    expect(errorOf(validateForm(ChangePasswordSchema, { current: 'old', next: 'short' }))).toBe('Password must be at least 8 characters.')
  })

  it('confirms deletion only with the exact name', () => {
    expect(validateForm(deleteAccountSchema('Ana'), { confirmation: 'Ana' }).success).toBe(true)
    expect(errorOf(validateForm(deleteAccountSchema('Ana'), { confirmation: 'ana' }))).toBe('Please type "Ana" to confirm.')
    // No name loaded → nothing confirms, not even an empty input.
    expect(validateForm(deleteAccountSchema(null), { confirmation: '' }).success).toBe(false)
  })
})

describe('community schemas', () => {
  it('drops a blank optional email from a problem report', () => {
    expect(validateForm(ReportProblemSchema, { description: ' Broken ', email: ' ' })).toEqual({
      success: true,
      data: { description: 'Broken', email: undefined },
    })
  })

  it('requires an http(s) video link', () => {
    const entry = { title: 'My clip', videoUrl: 'youtube.com/watch?v=1', danceStyle: '', email: 'a@b.co' }
    expect(errorOf(validateForm(VideoSubmissionSchema, entry))).toBe('Paste the full video link, starting with https://')
    expect(validateForm(VideoSubmissionSchema, { ...entry, videoUrl: 'https://youtu.be/1' }).success).toBe(true)
  })

  it('rejects a ride with no seats or too many', () => {
    const ride = { type: 'offering' as const, originCity: 'Munich', date: '2026-11-01' }
    expect(validateForm(RidePostSchema, { ...ride, seats: 3 }).success).toBe(true)
    expect(validateForm(RidePostSchema, { ...ride, type: 'looking', seats: undefined }).success).toBe(true)
    expect(errorOf(validateForm(RidePostSchema, { ...ride, seats: 7 }))).toBe('You can offer up to 6 seats.')
    expect(errorOf(validateForm(RidePostSchema, { ...ride, date: '' }))).toBe('Pick a date.')
  })
})

describe('bookingRequestSchema', () => {
  const request = {
    spaceId: 'space-1', title: 'Sunday Social', eventType: 'Social', styles: ['Salsa'],
    eventDate: '', startTime: '', endTime: '', artists: 'DJ A, , @b ', organizerHandle: '',
    message: '', name: '', headcount: '' as string | number, email: 'host@example.com', terms: true,
  }

  it('normalises optional fields for the API', () => {
    const result = validateForm(bookingRequestSchema({ free: true }), request)
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.artists).toEqual(['DJ A', '@b'])
    expect(result.data.headcount).toBeUndefined()
    expect(result.data.eventDate).toBeUndefined()
  })

  it('words the terms message by booking type', () => {
    expect(errorOf(validateForm(bookingRequestSchema({ free: true }), { ...request, terms: false }))).toBe('Please agree to the community guidelines.')
    expect(errorOf(validateForm(bookingRequestSchema({ free: false }), { ...request, terms: false }))).toBe('Please accept the booking terms.')
  })

  it('rejects a non-positive headcount', () => {
    expect(errorOf(validateForm(bookingRequestSchema({ free: true }), { ...request, headcount: '0' }))).toBe('Guests must be at least 1.')
  })
})

describe('GigSchema', () => {
  it('omits blank optional links and rejects bad ones', () => {
    const gig = {
      kind: 'offer' as const, category: 'DJ', title: 'Timba sets', posterName: 'DJ A', posterType: 'Artist',
      location: 'Munich', styles: [], when: 'Weekends', compensation: 'On request', deadline: '',
      contactEmail: 'dj@example.com', contactUrl: '', entityUrl: '',
    }
    const ok = validateForm(GigSchema, gig)
    expect(ok.success && ok.data.contactUrl).toBeUndefined()
    expect(errorOf(validateForm(GigSchema, { ...gig, contactUrl: 'mysite.com' }))).toBe('Enter a full link starting with https://')
    expect(errorOf(validateForm(GigSchema, { ...gig, category: '' }))).toBe('Pick a service category.')
  })
})

describe('date-window schemas', () => {
  it('lists every missing festival basic, then checks the date order', () => {
    const empty = validateForm(FestivalBasicsSchema, { name: '', startDate: '', endDate: '' })
    expect(empty.success ? [] : empty.errors).toEqual([
      'Festival name is required.',
      'Start date is required.',
      'End date is required.',
    ])
    expect(errorOf(validateForm(FestivalBasicsSchema, { name: 'Fest', startDate: '2026-05-02', endDate: '2026-05-01' })))
      .toBe('End date must be on or after start date.')
    expect(validateForm(FestivalBasicsSchema, { name: 'Fest', startDate: '2026-05-01', endDate: '2026-05-01' }).success).toBe(true)
  })

  it('requires a giveaway to end after it starts', () => {
    const giveaway = {
      citySlug: 'munich', sponsorName: 'S', title: 'T', description: 'D', prizeDescription: 'P',
      ctaUrl: 'https://example.com', imageUrl: '', termsUrl: '', startsAt: '2026-05-01', endsAt: '2026-05-01',
      status: 'active' as const,
    }
    expect(errorOf(validateForm(GiveawaySchema, giveaway))).toBe('End date must be after the start date.')
    expect(validateForm(GiveawaySchema, { ...giveaway, endsAt: '2026-05-02' }).success).toBe(true)
  })

  it('splits community group styles', () => {
    const result = validateForm(CommunityGroupSchema, {
      citySlug: 'munich', name: 'Salsa MUC', platform: 'whatsapp', inviteUrl: 'https://chat.whatsapp.com/x',
      styles: 'Salsa, Bachata,', source: '', verified: false,
    })
    expect(result.success && result.data.styles).toEqual(['Salsa', 'Bachata'])
  })
})

describe('BusinessCreateSchema', () => {
  const base = { type: 'artist', instagram: '', name: 'Caliente Nights', city: '', handle: '' }

  it('keeps an Instagram-style handle as typed, lowercased', () => {
    const r = validateForm(BusinessCreateSchema, { ...base, instagram: 'https://www.instagram.com/caliente.nights/', handle: '@Caliente.Nights' })
    expect(r.success && r.data).toMatchObject({ instagram: 'caliente.nights', handle: 'caliente.nights', city: undefined })
  })

  it('leaves a blank handle out', () => {
    const r = validateForm(BusinessCreateSchema, base)
    expect(r.success && r.data.handle).toBeUndefined()
  })

  it('flags a bad handle and a bad Instagram link with their own messages', () => {
    const r = validateForm(BusinessCreateSchema, { ...base, instagram: 'two words', handle: 'flyer.png' })
    expect(r.success).toBe(false)
    if (r.success) return
    expect(r.fieldErrors.instagram).toMatch(/instagram\.com/)
    expect(r.fieldErrors.handle).toMatch(/file name/)
    expect(validateForm(BusinessCreateSchema, { ...base, handle: 'admin' }).success).toBe(false)
    expect(validateForm(BusinessCreateSchema, { ...base, handle: 'a..b' }).success).toBe(false)
  })
})

describe('RenameHandleSchema', () => {
  it('requires a valid handle', () => {
    expect(errorOf(validateForm(RenameHandleSchema, { handle: ' ' }))).toBe('Pick a handle.')
    const r = validateForm(RenameHandleSchema, { handle: 'Salsa_Munich' })
    expect(r.success && r.data.handle).toBe('salsa_munich')
  })
})
