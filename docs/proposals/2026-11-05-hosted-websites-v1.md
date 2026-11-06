---
title: Hosted websites v1 — an organizer gets a live website in minutes, without a developer
date: 2026-11-05 17:00
status: accepted
decided: 2026-11-05 (Alex agreed to all four recommended decisions: D1 sites.wedance.vip/<handle>, D2 free on the WeDance address / paid own domain, D3 "Made with WeDance" on free sites, D4 new repo wedance-sites)
owner: Forge
---

# Hosted websites v1

## Why

WeDance is already the CMS and CRM of a profile's own website (RAZ-412): the sections, words in
every language, events, sign-ups (Contacts), version history and AI editing over MCP. But a site
only exists when a developer builds one:

1. a Nuxt repo that extends [`wedance-site-kit`](https://github.com/razbakov/wedance-site-kit)
   and names the profile in its config,
2. its look written as CSS variables / Tailwind colours, its header, footer, Impressum and privacy
   pages written by hand,
3. its own Vercel project, a domain, DNS.

That is how the two sites we run today were made. No organizer can do it alone, so the CMS reaches
nobody beyond them. v1 removes the developer from the path for the common case.

## Goal

An organizer with a WeDance page opens **Business → Website → Create my website**, gets a filled
first draft built from their page, picks a look, presses **Publish**, and the site is live at a
WeDance address within a minute — on a phone too. Events keep themselves up to date, sign-ups land
in Contacts, every save is a version, and they can keep editing it here or from ChatGPT/Claude.

**Done when:** a page with no site goes from nothing to a published site in under 5 minutes, with
no code and no DNS, and the two existing hand-built sites keep working unchanged.

## What exists (reuse, don't rebuild)

| Piece | Where | Reused for |
|---|---|---|
| Content model, languages, validation | `shared/types/profileSite.ts` | the same, plus `theme`, `published`, `legal` |
| Public site API (60 s CDN cache) | `GET /api/profiles/<u>/site`, `/events`, `POST /contacts` | the hosted renderer reads exactly this |
| Section components, theme tokens | `wedance-site-kit` (Nuxt layer, Tailwind 3) | the hosted renderer extends it |
| Editor, history, MCP tools | `/business/network/<u>/website`, `website-history`, `get_my_site` / `update_my_site` / `site_history` / `restore_site_version` | unchanged; gains Look, Publish and Legal |
| Image upload | `/api/media/image?folder=sites` | logo, favicon |
| AI writing | Gemini (`server/utils/instagram/eventExtract.ts` pattern), captions | the first draft's texts |

## Shape

### 1. One hosted renderer for every site — new repo `wedance-sites`

A small Nuxt 4 app that **extends `wedance-site-kit`** and is deployed once (one Vercel project).
It serves any profile's site, picked per request:

- **Which site:** v1 by path, `sites.wedance.vip/<handle>` (and `/<handle>/de/…`). The server
  middleware sets the profile for the request; the hostname rule (custom domains, subdomains) slots
  in later without changing pages. See decision D1.
- **Kit change (v0.2.0, backwards compatible):** `useWeDanceProfile()` reads the profile from a
  per-request state (`useState('wedance-profile')`) and falls back to `runtimeConfig` — so
  the existing hand-built sites keep working with no change.
- **Languages:** the app declares all nine `SITE_LOCALES`; a language the site doesn't have
  redirects to its main language.
- **Header and footer** (new kit components, so the hand-built sites can adopt them too): name or
  logo, the menu from sections that have an anchor + menu label, language switch; footer with the
  page's social links, contact, Impressum / Privacy links and a small "Made with WeDance".
- **Look:** the site's theme (below) is written into `<head>` as the kit's `--site-*` variables
  on the server, so the first paint is already in its colours.
- **Speed:** server-rendered, cached at the edge for 60 s with stale-while-revalidate, like the
  API. Sitemap and robots per site.
- **Not published / no site:** a plain 404 page with a link to the WeDance profile.

Why a separate app and not a route in this one: the kit is Tailwind 3 and this app is Tailwind 4;
and a bug or traffic spike on a client's site must not touch the WeDance app.

### 2. Look — theme presets in WeDance

`ProfileSite.theme = { preset, accent?, font?, logo?, favicon? }`.

- 5–6 presets that fill all 13 role tokens (e.g. *Night & gold* (today's default), *Cuban warm*,
  *Clean light*, *Bold red*, *Tropical*, *Mono*), each shown as a swatch with a sample heading.
- Optional: one accent colour (we derive highlight / on-accent with a contrast check), a heading
  font from a short list (Google Fonts), logo and favicon upload.
- Editor: **Settings → Look**. Contract change goes to `profileSite.ts` first, then the kit's
  `wedanceSite.ts` (as its README asks).

### 3. "Create my website" — a first draft from the page

For a page with no site, Business → Website shows **Create my website** instead of an empty editor.
It builds a draft from what WeDance already knows:

| Section | Filled from |
|---|---|
| Hero | name, photo (or the latest flyer), city + styles as the small line, buttons to the events and the sign-up form |
| Text "About" | bio (AI tidies it into 2–3 short paragraphs) |
| Events | the page's events (nothing to type) |
| Person / Cards | for artists: their bio and styles; for venues: rooms and capacity; for organizers: their regular nights |
| Location | the venue address and map link, when there is one |
| Questions | 3–4 common ones for the page type, as editable starters |
| Sign-up | default title in each language |

Languages: the page's city language + English. Texts the page doesn't have are AI-written and
marked so the owner checks them. The draft is **unpublished** until they press Publish.
MCP gets the same: `create_my_site` (from the page, optional instructions) and `publish_my_site`
(preview → confirm), so "make me a website from my Instagram" works end to end.

### 4. Publish, address, preview

- `ProfileSite.published` (missing = published, so the two existing sites don't change).
- The editor shows the site's address, **Publish / Unpublish**, and **Open site**.
- **Preview of the saved version before publishing:** the editor opens the hosted site with a
  signed preview token; the site API returns unpublished content for a valid token.
  Live preview of *unsaved* edits (the draft posted into an iframe) is v1.1.

### 5. Impressum and privacy (needed in Germany)

German business sites must have an Impressum; any site that collects sign-ups needs a privacy page.

- Settings → Legal: who runs the site (name, address, email, phone, VAT id if any, responsible for
  content). Prefilled from the page's contact details where we have them.
- The renderer serves `/impressum` and `/privacy` from those fields plus a fixed template (DE + EN)
  that names WeDance as the processor of sign-ups.
- Publishing a site whose page is in Germany needs the Impressum fields filled.
- The template text needs a one-time legal check before launch (see risks).

## Out of v1 (next, in this order)

1. **Own domain** (v2): "Connect your domain" with the Vercel Domains API on the renderer project,
   the DNS records to set shown on screen, verification status, automatic SSL; the renderer picks
   the site by hostname.
2. Live preview of unsaved edits; draft vs published versions.
3. Visits and sign-up numbers for owners (PostHog, `app = wedance-sites`, `profile` group).
4. More pages beyond the legal ones (team, past events); video upload for the hero.
5. Moving the existing hand-built sites onto the hosted renderer (optional — they work).

## Decisions for Alex

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | The free address | (a) `sites.wedance.vip/<handle>` — one DNS record, works now · (b) `<handle>.wedance.vip` — needs `wedance.vip` DNS moved from Netlify to Vercel (Vercel only issues wildcard certificates on its own nameservers), touching the live v3 site · (c) `<handle>.<new domain>` on Vercel DNS, e.g. a short domain bought for sites | **(a) for v1**, (c) when custom domains come; (b) only if we want the v3 DNS on Vercel anyway |
| D2 | Price | free for every page · part of the organizer subscription · free on the WeDance address, paid for an own domain | **Free on the WeDance address, paid for an own domain** (v2) — gets organizers in, charges where the value is |
| D3 | "Made with WeDance" in the footer | always · removable on paid | **Always on free sites**, removable on paid |
| D4 | Where the renderer lives | new repo `wedance-sites` · a folder in `wedance-site-kit` | **New repo**: the kit stays a library, the renderer is an app with its own deploys |

## Plan

| Step | What | Size |
|---|---|---|
| 1 | Kit v0.2.0: per-request profile, header + footer + language switch components, theme variables from `site.theme` | 1 day |
| 2 | `wedance-sites` app: path routing, locales, 404, sitemap/robots, caching; Vercel project + `sites.wedance.vip` | 1–2 days |
| 3 | Contract: `theme`, `published`, `legal` in `profileSite.ts` (+ kit types); site API: published check, preview token, theme | 0.5 day |
| 4 | Editor: Settings → Look (presets) and Legal; Publish / address / Open site | 1 day |
| 5 | Create my website: draft builder (page data + AI texts), first-run screen; MCP `create_my_site`, `publish_my_site` | 1–2 days |
| 6 | Impressum / privacy pages and the publish check for German pages | 0.5 day (+ legal check) |
| 7 | End to end: a fresh test page → create → look → publish → live on a phone; the two existing sites unchanged | 0.5 day |

Roughly **6–8 days**. Steps 1–2 can ship first on their own: the existing content already renders
on `sites.wedance.vip/<handle>`, which is a useful check before the create flow exists.

## Risks

- **Legal text.** A wrong Impressum/privacy template is a real liability for organizers. Mitigation:
  one legal check of the template before launch; owners confirm the fields.
- **Scope creep toward "Wix for dance schools"** — domains, support, uptime. Mitigation: one
  well-made template with presets; no free-form page builder; custom domains only as a paid step.
- **One renderer for everyone.** A broken release breaks every hosted site at once. Mitigation:
  preview deployments checked against a few real sites (a display check like
  `e2e/synced-events.check.ts`), and the existing hand-built sites stay independent.
- **AI-written first draft.** It can invent facts (prices, times). Mitigation: it only rewrites what
  the page has, invents no numbers or dates, and marks every AI text for the owner to check.
