/**
 * Reusable valibot field schemas for client forms. Text fields trim their input
 * and carry the message shown in the form's error slot, so the same mistake
 * reads the same everywhere. Optional fields turn blank input into `undefined`
 * so the tRPC call omits them (zod rejects '' for `.url()` / `.email()`).
 */
import * as v from 'valibot'
import { handleError } from '../utils/handle'
import { parseInstagramHandle } from '../utils/instagram'

export const DANCE_ROLES = ['lead', 'follow', 'both'] as const
export const PASSWORD_MIN_LENGTH = 8

const HTTP_URL = /^https?:\/\//i
const blankToUndefined = (s: string) => s || undefined

/** Trimmed text; may be empty. */
export function trimmedText() {
  return v.pipe(v.string(), v.trim())
}

/** Trimmed text that must not be empty. */
export function requiredText(message: string) {
  return v.pipe(v.string(), v.trim(), v.nonEmpty(message))
}

/** Trimmed text that may be blank (→ `undefined`). */
export function optionalText(maxLength = Number.POSITIVE_INFINITY, message?: string) {
  return v.pipe(v.string(), v.trim(), v.maxLength(maxLength, message), v.transform(blankToUndefined))
}

/** "a, b, ,c" → ['a', 'b', 'c'] */
export function commaList() {
  return v.pipe(v.string(), v.transform(s => s.split(',').map(item => item.trim()).filter(Boolean)))
}

export function email(requiredMessage = 'Email is required.', invalidMessage = 'Enter a valid email address.') {
  return v.pipe(v.string(), v.trim(), v.nonEmpty(requiredMessage), v.email(invalidMessage))
}

export function optionalEmail(invalidMessage = 'Enter a valid email address.') {
  return v.pipe(
    v.string(), v.trim(), v.transform(blankToUndefined),
    v.optional(v.pipe(v.string(), v.email(invalidMessage))),
  )
}

/** A new password (register, reset, change). Never trimmed. */
export function newPassword(requiredMessage = 'Password is required.') {
  return v.pipe(
    v.string(),
    v.nonEmpty(requiredMessage),
    v.minLength(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`),
  )
}

// http(s) only: these links are rendered as hrefs, and `v.url()` alone also
// accepts `javascript:` URLs.
function httpUrl(message: string) {
  return v.pipe(v.string(), v.url(message), v.regex(HTTP_URL, message))
}

export function webUrl(requiredMessage: string, invalidMessage = 'Enter a full link starting with https://') {
  return v.pipe(v.string(), v.trim(), v.nonEmpty(requiredMessage), httpUrl(invalidMessage))
}

export function optionalWebUrl(invalidMessage = 'Enter a full link starting with https://') {
  return v.pipe(v.string(), v.trim(), v.transform(blankToUndefined), v.optional(httpUrl(invalidMessage)))
}

/** Value of an `<input type="date">` (YYYY-MM-DD). */
export function isoDate(requiredMessage: string) {
  return v.pipe(v.string(), v.nonEmpty(requiredMessage), v.isoDate(requiredMessage))
}

export function optionalIsoDate(invalidMessage = 'Pick a valid date.') {
  return v.pipe(v.string(), v.transform(blankToUndefined), v.optional(v.pipe(v.string(), v.isoDate(invalidMessage))))
}

/** Value of an `<input type="time">` (HH:MM). */
export function optionalIsoTime(invalidMessage = 'Pick a valid time.') {
  return v.pipe(v.string(), v.transform(blankToUndefined), v.optional(v.pipe(v.string(), v.isoTime(invalidMessage))))
}

/** A field this variant of the form doesn't collect: always `undefined`. */
export function notCollected() {
  return v.pipe(v.unknown(), v.transform(() => undefined))
}

// The handle rule (shared/utils/handle.ts), with its message for what's wrong.
const handleRule = () => v.rawCheck<string>(({ dataset, addIssue }) => {
  const err = dataset.typed ? handleError(dataset.value) : null
  if (err) addIssue({ message: err })
})
const asHandle = (s: string) => s.replace(/^@/, '').toLowerCase()

/** A handle someone picks (/@handle): "@Caliente.Nights" → "caliente.nights". */
export function requiredHandle(requiredMessage: string) {
  return v.pipe(v.string(), v.trim(), v.nonEmpty(requiredMessage), v.transform(asHandle), handleRule())
}

/** Same, optional: blank → `undefined`. */
export function optionalHandle() {
  return v.pipe(v.string(), v.trim(), v.transform(s => asHandle(s) || undefined), v.optional(v.pipe(v.string(), handleRule())))
}

/** An Instagram link or @handle → the handle; blank → `undefined`. */
export function optionalInstagram(invalidMessage = 'Paste a link like instagram.com/name, or @name.') {
  return v.pipe(
    v.string(), v.trim(), v.transform(blankToUndefined),
    v.optional(v.pipe(v.string(), v.check(s => !!parseInstagramHandle(s), invalidMessage), v.transform(s => parseInstagramHandle(s)!))),
  )
}
