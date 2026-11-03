---
title: One handle per person — a dancer's own page is their public identity
status: proposed
date: 2026-11-03
---

## Context

ADR-004 keeps **dancers** (accounts) and **profiles** (pages) apart and connects
them through `profile_members`. That fits organisations — a school, a festival, a
venue has a team and outlives any one member. It does not fit a *person* who is
several things at once.

A dancer who also teaches and organises has, today:

- `/u/<username>` — their dancer profile (styles, lead/follow, festivals they go to);
- `/@<artist-page>` — a page of type `artist`, which they manage as a team member;
- `/@<organiser-page>` — a page of type `organizer`.

Three URLs, three photos and bios, and no answer to "which link goes in my
Instagram bio". wedance.vip (v3) and Instagram give a person one handle.
`profiles.type` holds one value, so being a teacher *and* an organiser means two
pages even when both are just "me". Issue #474.

## Options

1. **Merge dancers into profiles** (a dancer is a profile of type `dancer`).
   Rejected in ADR-004 for good reasons: privacy defaults, erasure, every FK to
   `dancers`. Still true.
2. **Show everything on `/u/`** — list the pages a dancer runs on their dancer
   profile. Cheap, but the dancer handle is a generated slug (`ana-x7k2p`); the
   artist page holds the real, indexed, Instagram-matching handle and the
   follows, reviews and line-ups. The wrong URL wins.
3. **A dancer points at one page that is them** — `dancers.page_profile_id`.
   That page's `/@handle` becomes the person's identity: the dancer URLs forward
   to it, and it shows their dancer side.

## Decision

Option 3. Split by **person vs organisation**, not by role.

- `dancers.page_profile_id uuid UNIQUE REFERENCES profiles ON DELETE SET NULL`
  (migration 0059). One page per person, one person per page.
- Only an **owner** of a visible page of type `artist`, `organizer` or `promoter`
  may pick it (`profile.setPage`); venues are places, never people.
  `profile.myPage` lists the candidates. Settings → "Your public page".
- `/u/<username>` and `/@<username>` (dancer) forward to `/@<page>`. Who's Going
  faces, review authors and "My profile" keep linking to `/u/` and land there.
- `entity.getByHandle` returns `person` for such a page: role, dance styles, the
  dancer handle (for their year plan) and the other visible pages they own
  ("Also runs"). **A private dancer stays private**: `person` is null, and the
  page shows only itself — never who owns it.
- Organisations stay separate pages with teams. "Runs events under my own name"
  is a person; "Salsa Nights Munich" with its own Instagram is an organisation.

## Consequences

- One link per person; nothing is moved or deleted, and clearing the setting
  restores the old behaviour (rollback: drop the column).
- The page and the dancer row still each hold a name, photo and bio. The page
  wins in public; the dancer's own only shows where the page does not (Who's
  Going faces, until they read the page's).
- A person who teaches and organises under their own name still needs one page
  type. Later: `profiles.roles` (ADR-004 step 14) instead of a single `type` for
  person pages, so one page can say teacher · DJ · organiser.
- Later: offer "Create my page" from Settings for dancers without one, an MCP
  tool for the setting, and a nudge when a dancer owns exactly one artist page.
