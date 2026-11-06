/**
 * wedance.vip (v3) accounts → 2026 `dancers`. v3 is live; the v4 migration
 * (scripts/migrate/02-users.mjs) was a snapshot that stops around April 2026, so
 * everyone who joined since — and the v3 id of people matched only by email —
 * comes from here. Read only: Firebase Auth `accounts:batchGet` and Firestore
 * `:runQuery`, nothing is ever written to v3.
 *
 * Rules (planUsers, pure):
 *   - Match by v3 id (source_ref.firebaseId), then by email. Disabled or email-less
 *     accounts are skipped.
 *   - New people: email, name, photo, bio, city, Instagram from their v3 profile
 *     (else the Auth display name / photo), joined date = their v3 sign-up, and
 *     source_ref { source: 'wedance-v3', firebaseId }. No handle (no public
 *     dancer page) and no admin rights.
 *   - Existing people: only EMPTY fields are filled; the v3 id is added to
 *     source_ref when missing (never `source`, which marks rows this sync created
 *     and is the rollback key). Never renamed, never their password replaced.
 *   - Photos that no longer load (4xx, e.g. the old Cloudinary account) are skipped;
 *     the Auth photo is used instead when that one loads.
 *   - Passwords: the Firebase scrypt hash + salt (same project and hash config as
 *     the v4 import, verified by server/trpc/routers/auth.ts) — only when Google
 *     returns them. A service account without the "Firebase Authentication Admin"
 *     role gets "REDACTED" instead; then nobody gets a password and they sign in
 *     with a magic link. Re-running later fills hashes only for accounts with none.
 */
import { accessToken, decodeValue, type ServiceAccount } from './v3EventSync'

export type AuthUser = {
  localId: string
  email?: string
  displayName?: string
  photoUrl?: string
  passwordHash?: string
  salt?: string
  disabled?: boolean
  createdAt?: string // ms since epoch, as a string
  lastLoginAt?: string
}

export type ExistingDancer = {
  id: string
  email: string
  name: string
  photo: string | null
  bio: string | null
  city: string | null
  instagram: string | null
  hash: string | null
  salt: string | null
  sourceRef: Record<string, unknown> | null
}

type Fields = { name: string; photo: string | null; bio: string | null; city: string | null; instagram: string | null; hash: string; salt: string }
export type UserOp =
  | { op: 'create'; uid: string; email: string; createdAt: Date | null; fields: Fields }
  | { op: 'fill'; id: string; uid: string; email: string; fields: Partial<Fields>; sourceRef: Record<string, unknown> | null }

export type UserPlan = {
  ops: UserOp[]
  stats: { accounts: number; skipped: number; matchedById: number; matchedByEmail: number; created: number; filled: number; unchanged: number; withPassword: number; passwordsRedacted: boolean }
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const httpUrl = (v: unknown) => { const s = str(v); return s && /^https?:\/\/\S+$/i.test(s) ? s : null }
/** Google returns base64("REDACTED") instead of the hash without the right role. */
export const isRedacted = (h: unknown) => typeof h === 'string' && Buffer.from(h, 'base64').toString() === 'REDACTED'
/** Firebase REST gives web-safe base64; the v4 import (auth:export) stored standard base64. */
export const stdBase64 = (s: string) => Buffer.from(s, 'base64url').toString('base64')
const instagramHandle = (v: unknown) => {
  const s = str(v)
  if (!s) return null
  const m = s.match(/instagram\.com\/([\w.]+)/i)
  return (m ? m[1] : s.replace(/^@/, ''))!.toLowerCase() || null
}

export function planUsers(input: {
  authUsers: AuthUser[]
  profiles: Map<string, Record<string, any>> // v3 profile doc by id (= Auth uid)
  existing: ExistingDancer[]
  cityOfPlace: (place: unknown) => string | null // v3 city place id → 2026 city name
  deadPhotos?: Set<string> // photo URLs that answer 4xx (findDeadPhotos) — never copied
}): UserPlan {
  const plan: UserPlan = { ops: [], stats: { accounts: input.authUsers.length, skipped: 0, matchedById: 0, matchedByEmail: 0, created: 0, filled: 0, unchanged: 0, withPassword: 0, passwordsRedacted: false } }
  const byUid = new Map<string, ExistingDancer>()
  const byEmail = new Map<string, ExistingDancer>()
  for (const d of input.existing) {
    const uid = str(d.sourceRef?.firebaseId)
    if (uid && !byUid.has(uid)) byUid.set(uid, d)
    byEmail.set(d.email.toLowerCase(), d)
  }
  const seenEmail = new Set<string>()
  // Oldest account first, so a duplicated email keeps the original one.
  const users = [...input.authUsers].sort((a, b) => Number(a.createdAt ?? 0) - Number(b.createdAt ?? 0))
  for (const u of users) {
    const email = str(u.email)?.toLowerCase()
    if (!email || u.disabled || seenEmail.has(email)) { plan.stats.skipped++; continue }
    seenEmail.add(email)
    const p = input.profiles.get(u.localId) ?? {}
    const redacted = isRedacted(u.passwordHash)
    if (redacted) plan.stats.passwordsRedacted = true
    const pw = u.passwordHash && u.salt && !redacted ? { hash: stdBase64(u.passwordHash), salt: stdBase64(u.salt) } : null
    const fields: Fields = {
      name: str(p.name) ?? str(u.displayName) ?? str(p.username) ?? email.split('@')[0]!,
      photo: [httpUrl(p.photo), httpUrl(u.photoUrl)].find(u => u && !input.deadPhotos?.has(u)) ?? null,
      bio: str(p.bio)?.slice(0, 2000) ?? null,
      city: input.cityOfPlace(p.place) ?? input.cityOfPlace(p.current) ?? null,
      instagram: instagramHandle(p.instagram),
      hash: pw?.hash ?? '',
      salt: pw?.salt ?? '',
    }
    const row = byUid.get(u.localId) ?? byEmail.get(email) ?? null
    if (!row) {
      plan.ops.push({ op: 'create', uid: u.localId, email, createdAt: u.createdAt ? new Date(Number(u.createdAt)) : null, fields })
      plan.stats.created++
      if (pw) plan.stats.withPassword++
      continue
    }
    if (byUid.get(u.localId) === row) plan.stats.matchedById++
    else plan.stats.matchedByEmail++
    const patch: Partial<Fields> = {}
    for (const k of ['photo', 'bio', 'city', 'instagram'] as const) if (!str(row[k]) && fields[k]) patch[k] = fields[k]!
    if (pw && !str(row.hash)) { patch.hash = pw.hash; patch.salt = pw.salt; plan.stats.withPassword++ }
    const needsId = !str(row.sourceRef?.firebaseId)
    if (!Object.keys(patch).length && !needsId) { plan.stats.unchanged++; continue }
    plan.ops.push({ op: 'fill', id: row.id, uid: u.localId, email, fields: patch, sourceRef: needsId ? { ...row.sourceRef, firebaseId: u.localId } : null })
    plan.stats.filled++
  }
  return plan
}

// ---------------------------------------------------------------------------
// v3 reads
// ---------------------------------------------------------------------------

/** Every Firebase Auth account (accounts:batchGet, 1000 a page). */
export async function fetchAuthUsers(sa: ServiceAccount): Promise<AuthUser[]> {
  const token = await accessToken(sa, 'https://www.googleapis.com/auth/cloud-platform')
  const users: AuthUser[] = []
  let next = ''
  do {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}/accounts:batchGet?maxResults=1000${next ? `&nextPageToken=${encodeURIComponent(next)}` : ''}`, { headers: { authorization: `Bearer ${token}` } })
    if (!res.ok) throw new Error(`Firebase accounts:batchGet failed: ${res.status} ${await res.text()}`)
    const j = (await res.json()) as { users?: AuthUser[]; nextPageToken?: string }
    users.push(...(j.users ?? []))
    next = j.nextPageToken ?? ''
  } while (next)
  return users
}

/** Every v3 profile document (people and pages), by id. */
export async function fetchAllV3Profiles(sa: ServiceAccount): Promise<Map<string, Record<string, any>>> {
  const token = await accessToken(sa)
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'profiles' }] } }),
  })
  if (!res.ok) throw new Error(`Firestore runQuery(profiles) failed: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, any> } }[]
  return new Map(rows.filter(r => r.document).map(r => [
    r.document!.name.split('/').pop()!,
    Object.fromEntries(Object.entries(r.document!.fields ?? {}).map(([k, x]) => [k, decodeValue(x)])),
  ]))
}
