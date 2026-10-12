import { Resend } from 'resend'

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

  const festivalUrl = `${siteUrl}/festivals/${params.festivalSlug}`

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
