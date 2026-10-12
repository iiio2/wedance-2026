# WeDance Design System

Design tokens, font families, and component conventions for the 2026 tropical aesthetic.

Live reference: [`/docs/design`](https://2026.wedance.vip/docs/design) — the design system docs (foundations, components, patterns), part of the public, indexed `/docs` hub. The old `/styleguide` and `/design/**` URLs redirect there.

## Tokens

All tokens are defined in `app/assets/css/tailwind.css`. They fall into three layers:

### 1. Brand primitives (`--wd-*`)

Raw palette values. Use these only when a semantic token doesn't fit.

| Token | Hex | Tailwind class | Role |
|---|---|---|---|
| `--wd-cream` | `#fbf5ea` | `bg-wd-cream` | Warm background |
| `--wd-brown-900` | `#3b1f0d` | `text-wd-brown-900` | Deepest brown (headings) |
| `--wd-brown-700` | `#5b3a1d` | `text-wd-brown-700` | Body text brown |
| `--wd-amber-600` | `#9a5614` | `text-wd-amber-600` | Accent / section labels |
| `--wd-red-600` | `#dc2626` | `bg-wd-red-600` | Primary CTA red |
| `--wd-red-800` | `#b91c1c` | `bg-wd-red-800` | Button shadow |
| `--wd-orange-500` | `#f97316` | `bg-wd-orange-500` | Gradient accent |
| `--wd-green-600` | `#16a34a` | `bg-wd-green-600` | Success green |
| `--wd-cyan-600` | `#0891b2` | `bg-wd-cyan-600` | Info cyan |
| `--wd-amber-500` | `#f59e0b` | `bg-wd-amber-500` | Warning amber |

### 2. Semantic tokens (shadcn mapping)

These drive all shared UI components (`app/components/ui/*`). Prefer these over primitives.

| Token | Light value | Usage |
|---|---|---|
| `--background` | cream | Page background |
| `--foreground` | brown-900 | Default text |
| `--primary` | red-600 | CTAs, links, active states |
| `--primary-foreground` | white | Text on primary backgrounds |
| `--secondary` | amber-600 | Section labels, captions |
| `--secondary-foreground` | cream | Text on secondary backgrounds |
| `--muted` | cream/brown mix | Subtle backgrounds |
| `--muted-foreground` | brown-700 | Body text, descriptions |
| `--accent` | amber tint | Hover/highlight backgrounds |
| `--accent-foreground` | amber-600 | Text on accent backgrounds |
| `--destructive` | red-600 | Error states, validation, destructive buttons/badges |
| `--destructive-foreground` | white | Text on destructive backgrounds (use `text-destructive` for red text on light) |
| `--card` | white | Card surfaces |
| `--border` | brown-900 @ 13% | Borders, dividers |
| `--input` | brown-900 @ 20% | Input borders |
| `--ring` | amber-600 | Focus rings |

### 3. Status colours

| Token | Hex | Usage |
|---|---|---|
| `--success` | `#16a34a` | Success messages, confirmations |
| `--info` | `#0891b2` | Informational highlights |
| `--warning` | `#f59e0b` | Warnings, caution states |

### 4. Extended palette

Accents and tints pages use beyond the core brand (purple, pink, violet, sky, rose, sand, extra amber/red/green/cyan steps …). Full list with swatches on [`/docs/design/foundations/colors`](/docs/design/foundations/colors); definitions in `tailwind.css` under "Extended palette". Same naming: `var(--wd-purple-500)`, `bg-wd-purple-500`.

### 5. JS mirror — `app/lib/brand.ts`

`WD` exports every `--wd-*` hex for places where the colour is computed in JS — accent rotations (`[WD.red600, WD.cyan600][i]`) and alpha suffixes (`accent + '55'`), which a CSS variable can't take. `app/lib/brand.test.ts` fails if `WD` and `tailwind.css` drift apart.

Rule of thumb: **CSS context → `var(--wd-*)`; JS value → `WD.*`.**

Alpha tints in CSS: `color-mix(in srgb, var(--wd-red-600) 13%, transparent)` (not `#dc262622`).

### 6. Shadows (`--wd-shadow-*` → `shadow-wd-*`)

Five recipes, documented on `/docs/design/foundations/elevation`. Values are copied from the recipes pages already use, so swapping an inline shadow for the token is a visual no-op.

| Token | Utility | Value | Use |
|---|---|---|---|
| `--wd-shadow-lip` | `shadow-wd-lip` | `0 3px 0 -1px var(--wd-red-800)` | Hard under-edge on pill buttons |
| `--wd-shadow-card` | `shadow-wd-card` | `0 1px 0 color-mix(in srgb, var(--wd-brown-900) 4%, transparent), 0 6px 18px rgba(59,31,18,0.04)` | Cards on cream |
| `--wd-shadow-sticker` | `shadow-wd-sticker` | `3px 4px 0 -1px currentColor` | Offset accent shadow on festival / plan cards |
| `--wd-shadow-float` | `shadow-wd-float` | `0 6px 20px rgba(0,0,0,0.18), 0 3px 0 -1px rgba(0,0,0,0.15)` | Floating buttons, popovers |
| `--wd-shadow-focus` | `shadow-wd-focus` | `0 0 0 3px color-mix(in srgb, var(--wd-red-600) 15%, transparent)` | Soft halo on focused inputs |

**Recolouring lip and sticker:** set `--wd-shadow-color` on the element and use the utility (`class="shadow-wd-sticker" :style="{ '--wd-shadow-color': accent }"`). The utilities inline the recipe, so the variable resolves on that element. `var(--wd-shadow-lip|sticker)` in inline CSS resolves at `:root` and always gets the default colour.

Not tokens (yet): the 4px-deep lip on large CTAs (`0 4px 0 -1px …`, ~20 uses) and larger sticker offsets on hero art. Promote when one becomes a rule.

### 7. Motion (`--wd-duration-*`, `--wd-ease-*`)

| Token | Value | Tailwind | Use |
|---|---|---|---|
| `--wd-duration-instant` | `80ms` | `duration-wd-instant` | Press feedback |
| `--wd-duration-quick` | `150ms` | `duration-wd-quick` | Colour / border hovers |
| `--wd-duration-standard` | `220ms` | `duration-wd-standard` | Lift, scale, small moves |
| `--wd-duration-slow` | `380ms` | `duration-wd-slow` | Ripples, entrances |
| `--wd-ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `ease-wd-spring` | Playful overshoot |
| `--wd-ease-out` | `ease-out` (CSS keyword) | `ease-wd-out` | Arriving, settling |
| `--wd-ease-in-out` | `ease-in-out` | `ease-wd-in-out` | Back-and-forth loops |

`.wd-cta` uses these tokens for its transitions and ripple (computed values unchanged). Its ambient loops (4.5s / 6s) and 800ms gradient shift stay literal — nothing else should use them. Note `ease-wd-out` is the CSS keyword, not Tailwind's `ease-out` curve.

### 8. Small type sizes (`text-eyebrow`, `text-meta`, `text-tag`)

Below `text-xs` (12px) the Tailwind scale stops, so pages used arbitrary sizes. Survey 2026-10-10 (product pages; sketches and `/docs/design` excluded): 292 `text-[Npx]`, of which `text-[10px]` ×216, `text-[11px]` ×46, `text-[9px]` ×29. Those three became `@theme` tokens:

| Utility | Size | Replaces | Use |
|---|---|---|---|
| `text-eyebrow` | 10px | `text-[10px]` | Eyebrows, section labels, status pills (usually `uppercase tracking-[0.3em] font-bold`) |
| `text-meta` | 11px | `text-[11px]` | Meta lines under card titles |
| `text-tag` | 9px | `text-[9px]` | Tiny tags inside cards / chips — never reading text |

They set font-size only (no line-height token), exactly like the arbitrary class, so swapping is a no-op (verified: computed font-size and line-height identical, with and without `leading-*`). Not tokenised: 12px = `text-xs`; 13px appears only in the docs; 7–8px only in sketches. Existing pages are **not** migrated yet — do it when a page is next touched.

## Spacing & layout

Documented on `/docs/design/foundations/spacing`. No custom spacing tokens — Tailwind's 4px scale.

- **Steps in use:** 0.5 · 1 · 1.5 · 2 · 3 · 4 · 6 · 8 · 12 · 16 · 20. Most common: `gap-2` (324), `px-4` (256), `gap-3` (197).
- **Containers:** `max-w-xl` (forms) · `2xl` · `3xl` (reading) · `4xl` · `5xl` (default wide page) · `6xl` · `7xl` (headers/footers). Standard shell: `max-w-5xl mx-auto px-4`.
- **Gutter:** `px-4` on every screen size.
- **Section rhythm:** `py-16` landing sections, `py-12` content pages, `py-20` heroes; title → content `mt-6`–`mt-8`; cards `gap-4`.
- **Breakpoints:** Tailwind defaults. Mobile first; `sm:` does most of the work (426 uses), `md:` 85, `lg:` 35, `xl:` almost never.

## Icons

Documented on `/docs/design/foundations/icons`. `lucide-vue-next` only — 106 distinct icons across 72 files.

- **Stroke:** default 2px everywhere (476 uses, none override it). Don't pass `stroke-width`.
- **Colour:** `currentColor` — colour the parent. Status colours only when the icon is the status.
- **Sizes:** `w-3` (with 10–11px text) · `w-3.5` (with `text-xs/sm`) · **`w-4` default** · `w-5` (icon-only buttons, headers) · `w-6` (feature tiles) · `w-8` (empty states). Always set `h-*` too (or `size-*`).
- **Alignment:** `inline-flex items-center gap-1.5`; `shrink-0` on the icon when text wraps.
- **A11y:** decorative icons `aria-hidden="true"`; icon-only buttons need an `aria-label` naming the action and a ≥40px hit area (`p-2` around `w-5`).

## Font Families

Three families since 2026-10-12: Playfair (display), system-ui (UI), Caveat (handwritten accent). Permanent Marker, Anton and DM Serif Display are retired. Caveat was briefly folded into Playfair italic on 2026-10-10 — that made the homepage read generic, so it came back.

| Token | Tailwind class | Inline CSS | Stack | Usage |
|---|---|---|---|---|
| `--wd-font-display` | `font-display` | `font-family:var(--wd-font-display)` | Playfair Display, serif | Headings, brand text |
| `--wd-font-display` + italic | `font-display italic` | `…;font-style:italic` | Playfair Display italic | Emphasis inside serif headings ("your *own stage*") |
| `--wd-font-hand` | `font-hand` | `font-family:var(--wd-font-hand)` | Caveat | Short handwritten asides: captions under CTAs, signatures, card footers, "you are here". Never body text, never more than a line |
| `--wd-font-sans` | `font-sans` | `font-family:var(--wd-font-sans)` | system-ui, sans-serif | Body text, UI, forms |

## Decisions (2026-10-10)

- **Light only.** No dark theme; the `.dark` tokens were removed. Don't use `dark:` utilities — in Tailwind v4 they follow the OS setting and darken parts of a light page.
- **Forms:** mark optional fields with "(optional)" (`<Field optional>`); never asterisks on required ones. One look everywhere — admin forms use the same white controls, no cream variant.
- **Checkbox:** native `<input type="checkbox">` with `accent-primary` — accessible on every OS; no custom-drawn box.
- **Button accent:** brand variants take `accent="<colour>"` for non-red buttons (festival accent, categories). The colour must reach 4.5:1 with white.
- **Lip shadow:** one depth, 3px (`shadow-wd-lip`). Existing 4px lips migrate to it when touched.

## Rules

1. **No new inline hex.** Use a token or Tailwind class. If none fits, propose a new token in a PR.
2. **Semantic first.** Reach for `text-foreground`, `bg-primary`, `text-muted-foreground` before `text-wd-brown-900`.
3. **Brand primitives for one-offs.** Gradient CTAs, specific decorative elements — use `--wd-*` tokens directly.
4. **Font classes, not inline font-family.** Use `font-display`, `font-sans` (italic display for highlights).
5. **Light only.** No `.dark` theme and no `dark:` utilities (see Decisions).

## Font loading

Playfair Display is loaded **once, globally**, in `nuxt.config.ts` → `app.head.link`, so every page and layout (including `layout: 'default'` admin pages) gets it:

```ts
{ rel: 'preconnect', href: 'https://fonts.googleapis.com' },
{ rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
{ rel: 'preload', as: 'style', href: GOOGLE_FONTS_CSS },
{ rel: 'stylesheet', href: GOOGLE_FONTS_CSS },
// GOOGLE_FONTS_CSS = …/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&display=swap
```

- **Weights are exactly what the UI renders:** 400, 700 (`font-bold`), 900 (`font-black`) upright, plus 400 and 700 italic. Each is in use (surveyed from computed styles across ~25 routes). Adding a weight to the URL costs an extra font file — only do it when a component needs it.
- `display=swap` keeps text visible in the fallback serif while Playfair downloads; the preconnects + style preload start the fetch before the CSS that needs it.
- `--wd-font-sans` is `system-ui` — nothing to load.

Rules:

1. **Never add per-page font links.** No `useHead({ link: [...fonts.googleapis.com...] })` in pages, layouts or components — the global link already covers them, and duplicates just add head noise.
2. Never add another Google Font without a design-system PR.
3. Exception: festival-specific brand fonts in `app/pages/sketches/**` and `app/data/mock-*.ts` are content, not design system, and stay where they are.

## Inline style inventory

Phase 2 (2026-10-10) migrated all product pages and components (sketches excluded):

- ~2,050 inline CSS hex values → `var(--wd-*)` / `color-mix(...)`
- ~410 JS hex literals → `WD.*`
- ~660 inline `font-family` declarations → font tokens
- Verified by full-page pixel diff of 24 routes: identical except intended font changes.

What still holds a literal hex (by design or below the token threshold):

- `app/pages/sketches/**` — frozen design explorations, not product.
- `app/data/mock-*.ts` — festival accent colours are content, not design.
- ~30 one-off colours used ≤3 times (e.g. `#166534`, `#f5f0e8`, `#1f0f06`). Promote to a token the second time someone needs one.
- `rgba(...)` shadows — left inline; the five common recipes are now tokens (`shadow-wd-*`, see Tokens §6). Migrate when a page is next touched.

## Guardrails

Automated checks so the system can't drift or break silently. Each failure message points back here.

| Check | Command | Runs in CI | What fails it |
|---|---|---|---|
| Token drift | `bun run test:tokens` (also part of `bun run test`) | yes (`unit`) | a file gains a literal 6/8-digit hex; an inline `font-family` that isn't `var(--wd-font-*)`; a Google Fonts URL loading anything but Playfair Display; a quoted comma list in a font token (`'Caveat, cursive'` = one bogus family); a Tailwind class name built at runtime (`` `bg-wd-${key}` ``, `'text-' + c` — Tailwind never generates it) |
| Component contract | `bun run test:design` | yes (`e2e-smoke`) | a `<Button>` that isn't a `<button>`/`<a href>`; a disabled Button without the `disabled` attribute or `cursor: not-allowed`; an enabled one without `cursor: pointer`; Button/Badge text contrast < 4.5:1 |
| Accessibility | `bun run test:design` | `/docs/design` pages only | built-in: `<html lang>`, `<main>`, one `<h1>`, img alt, names on buttons/links/inputs; plus axe-core WCAG 2.1 A/AA when `@axe-core/playwright` is installed (skipped otherwise) |
| Visual regression | `bun run test:visual` | no (local) | the first viewport of a `/docs/design` page or key product route (data masked) at 1280 and 375 differs from its baseline |

**Ratchets, not walls.** Existing debt is frozen, new debt fails:

- `scripts/design-guardrails/baseline.json` — hex/font literal counts per file. Removed some? `bun scripts/design-guardrails/update-baseline.ts` (it refuses to raise a number unless `--allow-increase`, which needs a reason in the PR).
- `e2e/design/a11y-baseline.json` — known violations. `/docs/design` pages: per-rule counts. Product routes: per-rule `"*"` (counts move with DB content; a *new* rule still fails). Fixed one? Delete or lower the entry.
- `CONTRAST_DEBT` in `e2e/design/contract.spec.ts` — colour pairs below 4.5:1 that are tolerated but may not get worse. Delete the entry when the token is fixed.

**Coverage is automatic.** `/docs/design` pages come from `app/lib/design-nav.ts` (every non-planned item whose page exists). Product routes are one line each in `PRODUCT_ROUTES` (`e2e/design/pages.ts`). Mark a data-driven region `data-visual-mask` to exclude it from screenshots.

**Running locally.** Start a dev server, then `DESIGN_BASE_URL=http://localhost:<port> bun run test:design` (without the variable Playwright starts `bun run dev` on :3000). Accept intended visual changes with `bun run test:visual:update` and commit the PNGs (`e2e/design/__screenshots__/<platform>/`; baselines are per-OS, generated on macOS). All specs are read-only — safe against the production DB in `.env`.
