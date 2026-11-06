<script setup lang="ts">
/**
 * /privacy-policy — GDPR information (Art. 13/14 GDPR).
 * Keep it in step with the code: when a new processor, cookie or data flow is
 * added (see the env vars in server/ and the PostHog section in CLAUDE.md),
 * add it here and bump LEGAL_UPDATED in shared/legal.ts.
 */
import type { LegalSection } from '~/components/LegalDocument.vue'
import { OPERATOR, OPERATOR_ADDRESS } from '#shared/legal'

definePageMeta({ layout: false })
useHead({
  title: 'WeDance — Privacy Policy',
  meta: [{ name: 'description', content: 'How WeDance collects, uses and protects your personal data, and the rights you have under the GDPR.' }],
})

const mail = `<a href="mailto:${OPERATOR.email}">${OPERATOR.email}</a>`

const intro = `This policy explains what personal data WeDance processes when you use the website
<b>2026.wedance.vip</b>, the hosted websites at <b>sites.wedance.vip</b>, and WeDance inside AI assistants such as
ChatGPT or Claude — why we do it, who helps us, and what rights you have. We keep data to what the features need,
we never sell it, and we do not use it for advertising.`

const sections: LegalSection[] = [
  {
    id: 'controller',
    heading: '1. Who is responsible',
    paragraphs: [
      `The controller under the GDPR is <b>${OPERATOR.name}</b>, trading as ${OPERATOR.tradeName}, ${OPERATOR_ADDRESS}. Email: ${mail}.`,
      'We are not required to appoint a data protection officer. For any privacy question or request, write to the address above.',
    ],
  },
  {
    id: 'visiting',
    heading: '2. Visiting the website',
    paragraphs: [
      'When you open a page, your browser sends technical data: IP address, date and time, the page requested, referrer, browser and operating system. Our host needs it to deliver the page and to keep the service secure (for example against attacks). Server logs are kept for a short period and then deleted.',
      'Legal basis: our legitimate interest in a secure, working website (Art. 6 (1) (f) GDPR).',
    ],
  },
  {
    id: 'account',
    heading: '3. Your account',
    paragraphs: [
      'You can browse events without an account. If you create one, we process your email address, your name, a password (stored only as a one-way hash) or a sign-in link sent by email, and what you choose to add to your profile: photo, bio, city, dance styles, role (leader / follower), social links and a public handle.',
      'If you had an account on an earlier version of WeDance (wedance.vip), your account and public profile were carried over so you can keep using the same login.',
      'You stay signed in with a session token for up to 30 days. You can change your profile in Settings, and delete your account at any time in <b>Settings → Account → Delete account</b>.',
      'Legal basis: providing the service you signed up for (Art. 6 (1) (b) GDPR).',
    ],
  },
  {
    id: 'social',
    heading: '4. What other people can see',
    items: [
      '<b>Public profile and pages:</b> your handle, name, photo, bio, city, styles and links are public if you set a public handle. Pages of schools, venues, artists and organisers are public.',
      '<b>Who’s going:</b> when you mark that you are going to an event, other dancers see you only if you turn on sharing for that event. You can turn it off at any time.',
      '<b>Your plans:</b> your week and festival plans are private unless you share a link to them.',
      '<b>Activity you post:</b> reviews, questions to locals, votes, hangouts, ride shares, roommate searches and gig applications are visible to the people the feature is meant for (for example the organiser who receives your application).',
      '<b>Messages to organisers and venues:</b> booking and event enquiries are forwarded to the page you contact, including your name and email so they can reply.',
    ],
  },
  {
    id: 'public-info',
    heading: '5. Events and pages we list from public sources',
    paragraphs: [
      'To show a complete dance calendar, WeDance lists events and the pages of the schools, venues, organisers and artists behind them. This information comes from the organisers themselves, from the earlier WeDance site (wedance.vip), and from public announcements such as public Instagram profiles and posts. From public Instagram profiles we only take public fields: name, handle, profile photo, bio, the link in the bio and, for venues, the business address — never private messages, followers or contact data that isn’t public. Photos are copied to our own image storage instead of linking to Instagram.',
      'Legal basis: our legitimate interest, and that of the dance community, in an accurate, findable event calendar (Art. 6 (1) (f) GDPR). The data is already public and is used only to present the person’s dance activity.',
      `If a page is about you, you can claim it and edit it, or ask us to correct or remove it — write to ${mail}. You can object to this processing at any time (see section 13).`,
    ],
  },
  {
    id: 'tickets',
    heading: '6. Tickets, payments and subscriptions',
    paragraphs: [
      'When you buy a ticket or a subscription, we process your name, email, the order (event, ticket type, price, discount or promoter code) and the payment status. Payment details are entered directly with our payment provider; we never see or store your full card or bank data.',
      'For ticketed events, the organiser receives the attendee data needed to run the event and check you in at the door (name, ticket type, order reference).',
      'Payments are handled by <b>Stripe Payments Europe Ltd.</b> (Ireland). Some organisers sell through <b>Ticket Tailor</b> (Zimma Ltd., United Kingdom); in that case Ticket Tailor tells us about the order so it can appear in your plan.',
      'Legal basis: performing the purchase contract (Art. 6 (1) (b) GDPR) and our legal obligations to keep accounting records — invoices and booking records are kept for up to 10 years (Art. 6 (1) (c) GDPR, §147 AO, §257 HGB).',
    ],
  },
  {
    id: 'organisers',
    heading: '7. For organisers, venues and artists',
    paragraphs: [
      'If you manage a page, we process the content you add (events, line-ups, photos, flyers, website content) and the people on your team with their roles. For your events we show you aggregated insights (views, interest, sales) and, where relevant, the attendee data described in section 6. You are responsible for using attendee data only for running your event.',
      'If you paste a link to an Instagram post, we fetch that public post and its picture to prepare a draft event (see section 9).',
    ],
  },
  {
    id: 'ai-assistants',
    heading: '8. Using WeDance in ChatGPT, Claude and other AI assistants',
    paragraphs: [
      'You can connect WeDance to an AI assistant. When you connect, you sign in to WeDance and approve the access the assistant asks for; it then receives an access token for your account. The assistant can only do what WeDance’s tools allow, and anything that publishes or contacts other people is shown to you as a preview first and only happens after you confirm.',
      'What you ask the assistant, and the WeDance data it fetches to answer you (for example events, your plan or your pages), is processed by the assistant’s provider under their own privacy policy — for example OpenAI for ChatGPT or Anthropic for Claude. We do not receive your conversation with the assistant; we only receive the tool requests it sends to WeDance. We record which tool was called, whether it worked, which assistant app sent it and the country (from the request), to keep the service working and improve it.',
      'You can see and revoke every connected app in <b>Settings → Connections</b>. Revoking ends its access immediately.',
      'Legal basis: providing the service you asked for (Art. 6 (1) (b) GDPR); the usage records rely on our legitimate interest in a reliable service (Art. 6 (1) (f) GDPR).',
    ],
  },
  {
    id: 'processors',
    heading: '9. Service providers we use',
    paragraphs: [
      'We use the following providers, who process data on our behalf under a data processing agreement (Art. 28 GDPR) and only for the purpose stated:',
    ],
    items: [
      '<b>Vercel Inc.</b> (USA) — hosting and delivery of the website.',
      '<b>Neon Inc.</b> (USA) — our database, stored in the EU (Frankfurt).',
      '<b>Resend</b> (Plus Five Five, Inc., USA) — sending emails: sign-in links, confirmations and notifications.',
      '<b>Cloudinary Ltd.</b> (Israel / USA) — storing and resizing photos, flyers and cover images.',
      '<b>Stripe</b> and <b>Ticket Tailor</b> — payments and ticket sales (section 6). Stripe is an independent controller for some payment data, such as fraud prevention.',
      '<b>PostHog Inc.</b> — product analytics, hosted in the EU (section 10).',
      '<b>Functional Software Inc. (Sentry)</b> (USA) — error monitoring (section 10).',
      '<b>Google</b> (Google Ireland Ltd. / Google LLC) — the Gemini AI model, used when you ask WeDance to read an Instagram post into an event, design a flyer or write captions. We send it only the post text, images and event details needed for that request; it is not used to train Google’s models under the paid API terms. We also use Google Maps services to look up addresses and cities.',
      '<b>Apify Technologies s.r.o.</b> (Czech Republic) — fetching public Instagram profiles and posts (sections 5 and 7).',
    ],
  },
  {
    id: 'analytics',
    heading: '10. Analytics and error monitoring',
    paragraphs: [
      '<b>PostHog (EU-hosted)</b> helps us understand which features are used so we can improve them. It records page views and actions such as "added an event to my plan", together with a random or account identifier and non-identifying details like your city. We never send your name, email or the text of your searches (only their length). PostHog may record anonymised session replays in which form inputs are masked. Our aggregate numbers are public on <a href="/open">Open metrics</a>.',
      '<b>Sentry</b> records technical errors (error message, page, browser) so we can fix them. For a small share of visits, and when an error happens, it also records a replay of the page interaction; text you type in form fields is masked.',
      'Legal basis: our legitimate interest in a working, improving service (Art. 6 (1) (f) GDPR), and — where these tools store information on your device — §25 TDDDG. You can object at any time (section 13); blocking analytics in your browser does not affect how WeDance works.',
    ],
  },
  {
    id: 'cookies',
    heading: '11. Cookies and local storage',
    items: [
      '<b>Sign-in</b> — your session token and a cached copy of your profile are kept in your browser’s local storage so you stay signed in (up to 30 days). Necessary.',
      '<b>Your plans and preferences</b> — plans made before signing in, dismissed hints and similar settings are kept in local storage on your device. Necessary for the features you use.',
      '<b>Voting session</b> (<code>wd_vote_sid</code>, 1 year) — an anonymous random id that stops the same browser voting twice in city video votes. Necessary.',
      '<b>Promoter link</b> (<code>wd_via</code>, 30 days) — remembers the promoter link you arrived through, so the promoter is credited if you buy a ticket.',
      '<b>Analytics and error monitoring</b> — PostHog and Sentry store a random identifier in local storage and cookies (section 10).',
    ],
  },
  {
    id: 'transfers',
    heading: '12. Transfers outside the EU',
    paragraphs: [
      'Some providers above are based in the USA or the UK. Transfers to the USA rely on the EU–US Data Privacy Framework where the provider is certified, and otherwise on the EU Standard Contractual Clauses. Transfers to the UK and Israel rely on the European Commission’s adequacy decisions.',
    ],
  },
  {
    id: 'rights',
    heading: '13. Your rights',
    paragraphs: [
      `You have the right to access your data (Art. 15 GDPR), to correct it (Art. 16), to have it deleted (Art. 17), to restrict its processing (Art. 18), to receive it in a portable format (Art. 20) and to withdraw any consent you gave, with effect for the future (Art. 7 (3)). Write to ${mail}; we answer within one month.`,
      '<b>Right to object (Art. 21 GDPR):</b> where we rely on legitimate interests (sections 2, 5, 8 and 10), you can object at any time for reasons arising from your particular situation. We will then stop, unless we have compelling legitimate grounds or need the data to establish, exercise or defend legal claims.',
      'You can also complain to a data protection supervisory authority. The authority responsible for us is the Bayerisches Landesamt für Datenschutzaufsicht (BayLDA), Promenade 18, 91522 Ansbach, Germany — <a href="https://www.lda.bayern.de">www.lda.bayern.de</a>.',
    ],
  },
  {
    id: 'retention',
    heading: '14. How long we keep data',
    items: [
      '<b>Account and profile</b> — until you delete your account. Deletion removes your account, profile, plans and what you posted; a few items other people rely on (such as a gig listing) are anonymised instead. Order records are kept as described below.',
      '<b>Orders and invoices</b> — up to 10 years, as required by tax and commercial law.',
      '<b>Enquiries and support messages</b> — as long as needed to handle them, then at most 3 years.',
      '<b>Analytics and error data</b> — kept by PostHog and Sentry for a limited period (typically up to 12 months for analytics and 90 days for errors), then deleted.',
      '<b>Server logs</b> — a few days to a few weeks at our host.',
    ],
  },
  {
    id: 'minors',
    heading: '15. Children',
    paragraphs: [
      'WeDance is meant for people aged 16 and over. We do not knowingly collect data from younger children. If you believe a child has created an account, write to us and we will delete it.',
    ],
  },
  {
    id: 'changes',
    heading: '16. Changes',
    paragraphs: [
      'We update this policy when WeDance changes, for example when we add a feature or a provider. The date at the top shows the current version. If a change significantly affects how we use your data, we will tell signed-in users before it takes effect.',
    ],
  },
]
</script>

<template>
  <LegalDocument title="Privacy Policy" :intro="intro" :sections="sections" />
</template>
