<script setup lang="ts">
/**
 * /terms — Terms of use and sale for WeDance (platform, tickets, subscriptions,
 * AI assistants). Venue booking enquiries have their own /booking-terms.
 * Operator details come from shared/legal.ts.
 */
import type { LegalSection } from '~/components/LegalDocument.vue'
import { OPERATOR, OPERATOR_ADDRESS } from '#shared/legal'

definePageMeta({ layout: false })
useHead({
  title: 'WeDance — Terms',
  meta: [{ name: 'description', content: 'Terms of use and sale for WeDance: accounts, content, tickets, subscriptions and using WeDance in AI assistants.' }],
})

const mail = `<a href="mailto:${OPERATOR.email}">${OPERATOR.email}</a>`

const intro = `These terms apply to everyone who uses WeDance — on <b>2026.wedance.vip</b>, on websites hosted at
<b>sites.wedance.vip</b>, or through an AI assistant such as ChatGPT or Claude. WeDance is operated by
${OPERATOR.name} (${OPERATOR.tradeName}), ${OPERATOR_ADDRESS} (“we”, “us”). Venue booking enquiries are additionally
covered by our <a href="/booking-terms">Booking Terms</a>; how we handle personal data is explained in our
<a href="/privacy-policy">Privacy Policy</a>.`

const sections: LegalSection[] = [
  {
    id: 'service',
    heading: '1. What WeDance is',
    paragraphs: [
      'WeDance is a platform for the social dance community. Dancers find events, classes, festivals, venues and artists, plan what they attend and connect with other dancers. Organisers, schools, venues and artists publish and promote their events, manage their pages and websites, and sell tickets.',
      'Browsing WeDance is free. Some features for organisers are part of a paid subscription; the price is shown before you subscribe.',
      'Events are run by their organisers, not by WeDance. Listings come from organisers or from their public announcements; we work to keep them accurate but cannot guarantee that every date, time, price or line-up is correct. Check with the organiser if something matters to you.',
    ],
  },
  {
    id: 'account',
    heading: '2. Your account',
    items: [
      'You must be at least 16 years old to create an account.',
      'Give accurate information and keep your login to yourself. You are responsible for what happens under your account; tell us at once if you think someone else is using it.',
      'You may hold one personal account. Pages for a school, venue, festival or artist are managed from your personal account; only create or claim a page you are entitled to represent.',
      'You can delete your account at any time in Settings. We may suspend or close an account that seriously or repeatedly breaks these terms — we will tell you why, unless the law prevents it.',
    ],
  },
  {
    id: 'content',
    heading: '3. Content you publish',
    paragraphs: [
      'You keep all rights to the content you add — events, descriptions, photos, flyers, reviews, website text. You give us a non-exclusive, free, worldwide licence to host, show, resize and share that content on WeDance, on the websites we host for you, in AI assistants connected to WeDance, and in promoting the event or page it belongs to, for as long as it is on WeDance. You can remove your content at any time; the licence ends when it is removed, except for copies others have already shared.',
      'You confirm that you have the rights to what you publish — including photos of other people and music or artwork in flyers — and that it is accurate and lawful.',
      'Content generated with our AI tools (flyers, captions, draft events) is yours to use. Check it before publishing: AI can make mistakes.',
    ],
  },
  {
    id: 'rules',
    heading: '4. Rules of the community',
    paragraphs: ['Don’t use WeDance to:'],
    items: [
      'publish false, misleading or someone else’s events or pages, or impersonate another person or organisation;',
      'harass, threaten, discriminate against or expose other people, or share their personal data without permission;',
      'post unlawful content, spam, or advertising unrelated to dance;',
      'scrape the site, collect other users’ data, bypass limits or security, or overload the service;',
      'sell or resell tickets in breach of the organiser’s conditions.',
    ],
  },
  {
    id: 'reports',
    heading: '5. Reporting content',
    paragraphs: [
      `If you see content that is illegal, wrong or breaks these rules, use “Report a problem” on the page or write to ${mail}. We review reports promptly, may remove content or restrict accounts, and tell the person affected why. If you disagree with a decision about your content, reply to our message and we will look at it again.`,
    ],
  },
  {
    id: 'tickets',
    heading: '6. Buying tickets',
    paragraphs: [
      'Some events sell tickets through WeDance. Unless the checkout states otherwise, WeDance sells the ticket <b>in the name and on behalf of the organiser</b> shown on the event page. Your contract for attending the event — including its programme, house rules and conditions — is with that organiser. Your contract with WeDance covers the sale and delivery of the ticket.',
      'Prices are shown in the checkout, including any fees, before you pay. Payment is made through Stripe. The contract is concluded when you complete the payment; you then receive a confirmation by email and the ticket appears in your WeDance plan.',
      'When an organiser sells through their own shop (for example Ticket Tailor or another provider), you buy directly from them under their terms; WeDance only links to their shop.',
      '<b>No right of withdrawal:</b> tickets are for leisure events on a specific date. Under §312g (2) no. 9 BGB, the statutory 14-day right of withdrawal does not apply to them.',
      '<b>Cancellation and changes:</b> if an event is cancelled, you get your money back for the ticket. If it is postponed or substantially changed (for example a different city), you can choose to keep your ticket or get a refund. Smaller changes to the line-up or schedule do not give a right to a refund unless the organiser says so. Refunds go back to the original payment method. Whether a ticket can be transferred to another person or refunded in other cases depends on the organiser’s conditions shown with the event.',
    ],
  },
  {
    id: 'subscriptions',
    heading: '7. Subscriptions for organisers and venues',
    items: [
      'Paid plans are for businesses and organisers. The price, billing period and included features are shown before you subscribe. As a small business under §19 UStG we do not charge VAT.',
      'A subscription renews automatically for the same period until cancelled. You can cancel at any time with effect from the end of the current period; already paid periods are not refunded.',
      'We may change prices for future periods; we will tell you at least 30 days before, and you can cancel before the change takes effect.',
      'If you subscribe as a consumer, you have a 14-day right of withdrawal from the subscription. If you ask us to start the service during that period, you pay for the part already provided if you withdraw.',
    ],
  },
  {
    id: 'ai',
    heading: '8. Using WeDance in AI assistants',
    paragraphs: [
      'You can connect WeDance to an AI assistant such as ChatGPT or Claude. The assistant acts on your instructions, with the access you approved when connecting. You are responsible for what you ask it to do with your account. Actions that publish content or contact other people are shown to you as a preview and only happen after you confirm them.',
      'The assistant is provided by a third party under its own terms; we are not responsible for its answers. WeDance does not take payments inside an assistant — ticket tools give you a checkout link that you open yourself. You can disconnect an assistant at any time in Settings → Connections.',
    ],
  },
  {
    id: 'websites',
    heading: '9. Hosted websites',
    paragraphs: [
      'If you publish a website for your page through WeDance, you are the publisher of that website and responsible for its content and its legal information (such as your own imprint where required). We provide the hosting and editor. We may take a website offline if it breaks these terms or the law.',
    ],
  },
  {
    id: 'availability',
    heading: '10. Availability and changes',
    paragraphs: [
      'We work to keep WeDance available, but it may occasionally be unavailable because of maintenance or problems outside our control. We keep developing WeDance and may change or remove features. If a change removes something a paying subscriber relies on, we will tell you in advance and you may cancel.',
    ],
  },
  {
    id: 'liability',
    heading: '11. Liability',
    items: [
      'We are liable without limitation for intent and gross negligence, for injury to life, body or health, under the Product Liability Act, and where we have given a guarantee.',
      'For slight negligence we are liable only for breaching an essential contractual obligation (one that makes the contract possible and that you may rely on), limited to the damage typical and foreseeable for this kind of contract.',
      'We are not responsible for events themselves — their organisation, safety, cancellation or content — which is the responsibility of the organiser, nor for content published by other users or for third-party sites linked from WeDance.',
    ],
  },
  {
    id: 'changes',
    heading: '12. Changes to these terms',
    paragraphs: [
      'We may update these terms, for example when we add features or the law changes. We will tell registered users about significant changes at least 30 days before they take effect. If you don’t agree, you can delete your account or cancel your subscription before then.',
    ],
  },
  {
    id: 'law',
    heading: '13. Applicable law and disputes',
    paragraphs: [
      'German law applies, excluding the UN Convention on Contracts for the International Sale of Goods. If you are a consumer living in another EU country, you keep the protection of the mandatory consumer law of that country.',
      'If you are a merchant, the place of jurisdiction is Munich.',
      `We are not obliged and not willing to take part in dispute resolution proceedings before a consumer arbitration board. For any problem, contact us at ${mail} — we answer within two working days.`,
    ],
  },
]
</script>

<template>
  <LegalDocument title="Terms" :intro="intro" :sections="sections" />
</template>
