import { Resend } from 'resend'
import { festivalPath } from '../../shared/utils/eventSlug'

let _resend: Resend | null = null

function getResend(): Resend {
  if (!_resend) {
    const config = useRuntimeConfig()
    if (!config.resendApiKey) {
      throw new Error('RESEND_API_KEY is not set')
    }
    _resend = new Resend(config.resendApiKey)
  }
  return _resend
}

export async function sendMagicLinkEmail(to: string, name: string, magicLinkUrl: string) {
  const config = useRuntimeConfig()

  // In development without Resend key, log the link instead
  if (!config.resendApiKey) {
    console.log(`\n🔗 Magic link for ${to}: ${magicLinkUrl}\n`)
    return
  }

  const resend = getResend()

  await resend.emails.send({
    from: config.resendFromEmail || 'WeDance <noreply@wedance.vip>',
    to,
    subject: 'Sign in to WeDance',
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Hey ${escapeHtml(name)}!</h2>
        <p>Click the button below to sign in to WeDance:</p>
        <a href="${magicLinkUrl}"
           style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Sign in to WeDance
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          This link expires in 15 minutes. If you didn&apos;t request this, just ignore this email.
        </p>
      </div>
    `,
  })
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  const config = useRuntimeConfig()

  if (!config.resendApiKey) {
    console.log(`\n🔗 Password reset link for ${to}: ${resetUrl}\n`)
    return
  }

  const resend = getResend()

  await resend.emails.send({
    from: config.resendFromEmail || 'WeDance <noreply@wedance.vip>',
    to,
    subject: 'Reset your WeDance password',
    html: `
      <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Hey ${escapeHtml(name)}!</h2>
        <p>Click the button below to set a new password for your WeDance account:</p>
        <a href="${resetUrl}"
           style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Reset my password
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          This link expires in 15 minutes. If you didn&apos;t request this, just ignore this email.
        </p>
      </div>
    `,
  })
}

export interface TicketConfirmationParams {
  to: string
  buyerName: string
  festivalName: string
  festivalSlug: string
  startDate: string | null
  endDate: string | null
  ticketName: string | null
  amountCents: number
}

export async function sendTicketConfirmationEmail(params: TicketConfirmationParams) {
  const config = useRuntimeConfig()

  if (!config.resendApiKey) {
    console.log(`\n🎟️ Ticket confirmation for ${params.to}: ${params.festivalName} — ${params.ticketName ?? 'Social Unlock'}\n`)
    return
  }

  const resend = getResend()
  const siteUrl = config.siteUrl || 'https://2026.wedance.vip'

  const amountFormatted = `€${(params.amountCents / 100).toFixed(2)}`
  const ticketLabel = params.ticketName ?? 'Social Unlock'

  const dateRange = formatDateRange(params.startDate, params.endDate)

  const festivalUrl = `${siteUrl}${festivalPath(params.festivalSlug)}`

  await resend.emails.send({
    from: config.resendFromEmail || 'WeDance <noreply@wedance.vip>',
    to: params.to,
    subject: `Your ticket for ${escapeHtml(params.festivalName)}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">You&apos;re in, ${escapeHtml(params.buyerName)}! 🎉</h2>
        <p>Your purchase for <strong>${escapeHtml(params.festivalName)}</strong> is confirmed.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Ticket</td>
            <td style="padding: 8px 0; font-weight: bold;">${escapeHtml(ticketLabel)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Amount paid</td>
            <td style="padding: 8px 0; font-weight: bold;">${amountFormatted}</td>
          </tr>${dateRange ? `
          <tr>
            <td style="padding: 8px 0; color: #666;">Date</td>
            <td style="padding: 8px 0; font-weight: bold;">${escapeHtml(dateRange)}</td>
          </tr>` : ''}
        </table>
        <a href="${festivalUrl}"
           style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          View festival details
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">
          If you have any questions, reply to this email.
        </p>
      </div>
    `,
  })
}

function formatDateRange(start: string | null, end: string | null): string | null {
  if (!start) return null
  const fmt = (d: string) => {
    const date = new Date(d + 'T00:00:00Z')
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  if (!end || start === end) return fmt(start)
  return `${fmt(start)} – ${fmt(end)}`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Business mode: tell someone their claim / join / reclaim request was decided.
 * Logged instead of sent when Resend isn't configured (local dev).
 */
export async function sendAccessDecisionEmail(params: {
  to: string
  name: string
  profileName: string
  approved: boolean
  role: 'owner' | 'editor'
  link: string
}) {
  const config = useRuntimeConfig()
  const subject = params.approved
    ? `You now manage ${params.profileName} on WeDance`
    : `Your request for ${params.profileName} wasn’t approved`
  if (!config.resendApiKey) {
    console.log(`\n✉️  ${params.to}: ${subject} → ${params.link}\n`)
    return
  }
  const body = params.approved
    ? `<p>You were added to <strong>${escapeHtml(params.profileName)}</strong> as ${params.role === 'owner' ? 'an owner' : 'an editor'}.</p>
       <a href="${params.link}" style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open your business page</a>`
    : `<p>Your request to manage <strong>${escapeHtml(params.profileName)}</strong> wasn’t approved.</p>
       <p>If it really is yours, send a new request with something we can check, e.g. a message from the profile’s Instagram account.</p>`
  await getResend().emails.send({
    from: config.resendFromEmail || 'WeDance <noreply@wedance.vip>',
    to: params.to,
    subject,
    html: `<div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Hey ${escapeHtml(params.name)}!</h2>${body}</div>`,
  })
}

/**
 * Business mode: tell someone their claim needs more info before we can decide.
 * Logged instead of sent when Resend isn't configured (local dev).
 */
export async function sendInfoRequiredEmail(params: {
  to: string
  name: string
  profileName: string
  reviewerNote: string
  link: string
}) {
  const config = useRuntimeConfig()
  const subject = `More info needed for your ${params.profileName} claim`
  if (!config.resendApiKey) {
    console.log(`\n\u2709\ufe0f  ${params.to}: ${subject} \u2192 ${params.link}\n`)
    return
  }
  await getResend().emails.send({
    from: config.resendFromEmail || 'WeDance <noreply@wedance.vip>',
    to: params.to,
    subject,
    html: `<div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Hey ${escapeHtml(params.name)}!</h2>
      <p>We're reviewing your request for <strong>${escapeHtml(params.profileName)}</strong> and need a bit more information:</p>
      <blockquote style="border-left: 3px solid #ddd; margin: 16px 0; padding: 8px 16px; color: #555;">${escapeHtml(params.reviewerNote)}</blockquote>
      <a href="${params.link}" style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Update your request</a>
      <p style="color: #666; font-size: 14px; margin-top: 20px;">
        Go to your profile page on WeDance and re-submit your claim with the requested evidence.
      </p>
    </div>`,
  })
}

/**
 * Business mode: an organizer asked a page someone runs on WeDance — an artist
 * to confirm they're in a line-up, or a venue to host an event. Sent to the
 * page's team when the organizer clicks "Email them". Logged in local dev.
 */
export async function sendInviteEmail(params: {
  to: string
  name: string
  kind: 'artist' | 'venue'
  host: string
  profileName: string
  eventName: string
  when: string
  lines: string[]
  link: string
}) {
  const config = useRuntimeConfig()
  const subject = params.kind === 'venue'
    ? `${params.host} asked ${params.profileName} to host ${params.eventName}`
    : `${params.host} added ${params.profileName} to ${params.eventName}`
  if (!config.resendApiKey) {
    console.log(`\n✉️  ${params.to}: ${subject} → ${params.link}\n`)
    return
  }
  const ask = params.kind === 'venue'
    ? 'Can you host it? Say yes, suggest another date, or no, with your terms. It takes a minute.'
    : 'Confirm you’re in, check your programme and the posts about you.'
  const lines = params.lines.map(l => `<li>${escapeHtml(l)}</li>`).join('')
  await getResend().emails.send({
    from: config.resendFromEmail || 'WeDance <noreply@wedance.vip>',
    to: params.to,
    subject,
    html: `<div style="font-family: sans-serif; max-width: 460px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Hey ${escapeHtml(params.name)}!</h2>
      <p><strong>${escapeHtml(params.host)}</strong> ${params.kind === 'venue' ? 'would like to hold' : 'added you to'} <strong>${escapeHtml(params.eventName)}</strong>${params.kind === 'venue' ? ` at ${escapeHtml(params.profileName)}` : ''}.</p>
      <p style="color: #555;">${escapeHtml(params.when)}</p>
      ${lines ? `<ul style="color: #555; padding-left: 18px;">${lines}</ul>` : ''}
      <p>${ask}</p>
      <a href="${params.link}" style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Answer</a>
      <p style="color: #888; font-size: 13px; margin-top: 20px;">You get this because you run ${escapeHtml(params.profileName)} on WeDance. It’s also under “Needs you” on your Business home.</p>
    </div>`,
  })
}

/**
 * Someone asked to book an artist or venue from their WeDance page. Sent to
 * the page's team (else its private booking email, else WeDance to pass on).
 * Reply-To is the asker, so answering is just replying. Logged in local dev.
 */
export async function sendBookingInquiryEmail(params: {
  to: string
  name: string
  profileName: string
  forward: boolean
  from: { name: string; email: string; phone?: string | null; organization?: string | null }
  lines: string[]
  message: string
  link: string
}) {
  const config = useRuntimeConfig()
  const subject = `${params.from.name} wants to book ${params.profileName}`
  if (!config.resendApiKey) {
    console.log(`\n✉️  ${params.to}: ${subject} (reply to ${params.from.email}) → ${params.link}\n`)
    return
  }
  const lines = params.lines.map(l => `<li>${escapeHtml(l)}</li>`).join('')
  const who = params.from.organization ? `${params.from.name} (${params.from.organization})` : params.from.name
  await getResend().emails.send({
    from: config.resendFromEmail || 'WeDance <noreply@wedance.vip>',
    to: params.to,
    replyTo: params.from.email,
    subject,
    html: `<div style="font-family: sans-serif; max-width: 460px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Hey ${escapeHtml(params.name)}!</h2>
      <p><strong>${escapeHtml(who)}</strong> wants to book <strong>${escapeHtml(params.profileName)}</strong> through WeDance.</p>
      ${lines ? `<ul style="color: #555; padding-left: 18px;">${lines}</ul>` : ''}
      <p style="white-space: pre-line; border-left: 3px solid #ddd; padding-left: 12px; color: #333;">${escapeHtml(params.message)}</p>
      <p>Reply to this email to answer ${escapeHtml(params.from.name)} directly (${escapeHtml(params.from.email)})${params.from.phone ? `, or call or WhatsApp them: <a href="https://wa.me/${escapeHtml(params.from.phone.replace(/[^\d+]/g, '').replace(/^00/, '+').replace(/^\+/, ''))}">${escapeHtml(params.from.phone)}</a>` : ''}.</p>
      <a href="${params.link}" style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open on WeDance</a>
      <p style="color: #888; font-size: 13px; margin-top: 20px;">${params.forward
        ? `Nobody runs ${escapeHtml(params.profileName)} on WeDance yet: pass this on to them.`
        : `You get this because you run ${escapeHtml(params.profileName)} on WeDance. It’s also under “Needs you” on your Business home.`}</p>
    </div>`,
  })
}

/** Someone signed up on a profile's website (RAZ-412): tell the team. */
export async function sendSiteSignupTeamEmail(params: {
  to: string
  name: string
  profileName: string
  contact: { name: string; email: string; phone?: string | null; locale?: string | null }
  source: Record<string, string>
  link: string
}) {
  const config = useRuntimeConfig()
  const subject = `New sign-up on your website: ${params.contact.name}`
  if (!config.resendApiKey) {
    console.log(`\n✉️  ${params.to}: ${subject} → ${params.link}\n`)
    return
  }
  const rows = [
    ['Name', params.contact.name], ['Email', params.contact.email], ['Phone', params.contact.phone || ''], ['Language', params.contact.locale || ''],
    ...Object.entries(params.source).map(([k, v]) => [k, v]),
  ].filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding: 4px 12px 4px 0; color: #888;">${escapeHtml(k!)}</td><td>${escapeHtml(v!)}</td></tr>`).join('')
  await getResend().emails.send({
    from: config.resendFromEmail || 'WeDance <noreply@wedance.vip>',
    to: params.to,
    replyTo: params.contact.email,
    subject,
    html: `<div style="font-family: sans-serif; max-width: 460px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Hey ${escapeHtml(params.name)}!</h2>
      <p><strong>${escapeHtml(params.contact.name)}</strong> signed up on ${escapeHtml(params.profileName)}’s website.</p>
      <table style="border-collapse: collapse; font-size: 14px;">${rows}</table>
      <p style="margin-top: 16px;"><a href="${params.link}" style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">See your contacts</a></p>
      <p style="color: #888; font-size: 13px;">Reply to this email to answer them directly.</p>
    </div>`,
  })
}

/** The welcome email a profile wrote for people who sign up on its website. */
export async function sendSiteWelcomeEmail(params: {
  to: string
  profileName: string
  replyTo?: string | null
  subject: string
  body: string
  siteUrl?: string | null
  unsubscribeUrl: string
}) {
  const config = useRuntimeConfig()
  if (!config.resendApiKey) {
    console.log(`\n✉️  ${params.to}: ${params.subject}\n${params.body}\n`)
    return
  }
  // Plain paragraphs; bare links become links.
  const html = params.body.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>').replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')}</p>`).join('')
  const from = (config.resendFromEmail || 'WeDance <noreply@wedance.vip>').replace(/^[^<]*</, `${params.profileName.replace(/[<>"]/g, '')} <`)
  await getResend().emails.send({
    from,
    to: params.to,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    subject: params.subject,
    headers: { 'List-Unsubscribe': `<${params.unsubscribeUrl}>` },
    html: `<div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
      ${html}
      <p style="color: #999; font-size: 12px; margin-top: 32px;">${escapeHtml(params.profileName)}${params.siteUrl ? ` · <a href="${params.siteUrl}" style="color: #999;">${escapeHtml(params.siteUrl.replace(/^https?:\/\//, ''))}</a>` : ''} · via WeDance<br>
      <a href="${params.unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>
    </div>`,
  })
}

/** Gigs (MCP phase 2): someone applied to a gig role. Goes to the gig's contact email. */
export async function sendGigApplicationEmail(params: {
  to: string
  gigTitle: string
  applicant: { name: string; email: string; page?: string | null }
  message: string
  link: string
}) {
  const config = useRuntimeConfig()
  const subject = `${params.applicant.name} applied: ${params.gigTitle}`
  if (!config.resendApiKey) {
    console.log(`\n✉️  ${params.to}: ${subject} (reply to ${params.applicant.email}) → ${params.link}\n`)
    return
  }
  await getResend().emails.send({
    from: config.resendFromEmail || 'WeDance <noreply@wedance.vip>',
    to: params.to,
    replyTo: params.applicant.email,
    subject,
    html: `<div style="font-family: sans-serif; max-width: 460px; margin: 0 auto; padding: 20px;">
      <p><strong>${escapeHtml(params.applicant.name)}</strong>${params.applicant.page ? ` (<a href="${params.applicant.page}">their page</a>)` : ''} applied to your gig <strong>${escapeHtml(params.gigTitle)}</strong> on WeDance.</p>
      <p style="white-space: pre-line; border-left: 3px solid #ddd; padding-left: 12px; color: #333;">${escapeHtml(params.message)}</p>
      <p>Reply to this email to answer them, or accept or decline on WeDance.</p>
      <a href="${params.link}" style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">See applications</a>
    </div>`,
  })
}

/** Gigs: the poster accepted or declined an application. */
export async function sendGigDecisionEmail(params: { to: string; name: string; gigTitle: string; accepted: boolean; poster: { name: string; email: string }; link: string }) {
  const config = useRuntimeConfig()
  const subject = params.accepted ? `You’re in: ${params.gigTitle}` : `Your application: ${params.gigTitle}`
  if (!config.resendApiKey) {
    console.log(`\n✉️  ${params.to}: ${subject} → ${params.link}\n`)
    return
  }
  await getResend().emails.send({
    from: config.resendFromEmail || 'WeDance <noreply@wedance.vip>',
    to: params.to,
    replyTo: params.poster.email,
    subject,
    html: `<div style="font-family: sans-serif; max-width: 460px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Hey ${escapeHtml(params.name)}!</h2>
      <p>${params.accepted
        ? `<strong>${escapeHtml(params.poster.name)}</strong> accepted your application for <strong>${escapeHtml(params.gigTitle)}</strong>. Reply to this email to sort out the details.`
        : `<strong>${escapeHtml(params.poster.name)}</strong> went with someone else for <strong>${escapeHtml(params.gigTitle)}</strong>. Thanks for applying, and keep an eye on new gigs.`}</p>
      <a href="${params.link}" style="display: inline-block; background: #000; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Open gigs</a>
    </div>`,
  })
}
