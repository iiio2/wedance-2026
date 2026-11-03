---
title: Flyer art-director agent — Claude directs Gemini, the organizer only sees finished flyers
date: 2026-11-03 15:30
status: parked
parked: 2026-11-03 (Commander — big, complex and unpredictable for now; kept for later)
research: docs/research/2026-11-03-flyer-generation-review.md
owner: Forge
---

# Flyer art-director agent

**Parked.** Not planned now: it is a large change with an uncertain cost and reliability curve.
Kept so the findings and the design aren't lost. Evidence and the spike:
[the research](../research/2026-11-03-flyer-generation-review.md).

## Why

Flyers are painted once from a fixed template, so each click is a lottery and the organizer is
the quality check (12 of 52 paintings kept; 0 of 8 for La Clave Halloween). In one spike, Claude
as art director (paint → look → judge → fix, 6 paintings) produced a usable flyer where the app's
prompt, on the same data, painted three strangers.

## Shape

**Engine**

1. **Agent loop instead of one shot.** Claude with tools `paint`, `edit`, `view` (the image goes
   back to Claude), `read_text`, `prep_photo`, `finish`. Instructions = the house recipe
   (`art-director.md`) + the organizer's style + a checklist. Budget ~6 paintings / ~5 min.
2. **Facts as data, not a text block.** The agent decides what goes on the poster and what leads.
3. **Visual quality gate before handover:** faces match the photos, nothing in Instagram's
   covered zones, the reason to come stands out, no empty bands, spelling proofed. A failing
   flyer is never shown.
4. **Photo prep:** best photo per person, face crop, logo blur; warn on weak photos.
5. **Style memory per organizer:** each kept/rejected flyer and each note updates that
   organizer's style doc, the way `flyer-style.md` grew for La Clave.
6. **Background job** past Vercel's 300 s limit (queue, Claude Managed Agents, or Hetzner).
7. **Eval set:** 5–10 real events re-run on every change to instructions or model. Metrics: keep
   rate, edits before keep, cost and time per kept flyer.

**UX**

- **Before:** one or two questions when the data is thin ("What's special about this night?",
  "Free all night or only before 21:00?"), prefilled from the event. A photo picker with quality
  hints ("face too small", "half the frame is equipment").
- **While it works:** show the work ("Trying a moon behind the title…", "Fixing: Yunior's face
  doesn't match") so a 5–7 min wait feels like progress; don't block the page; notify when done.
- **Result:** 2 finished options with a one-line reason each, each with its 4:5 feed version and
  a caption, ready to post.
- **Changing it:** a chat instead of the fix form ("make the free entry bigger"); quick chips
  ("bigger photo", "less busy", "more Halloween"); edits start from the best version; a version
  strip with one-tap revert.
- **Learning:** on reject, one tap for why (faces wrong / hard to read / too busy / not my style),
  feeding the style memory.
- **Power users:** the WeDance MCP tools already let an organizer's own Claude work this way.

## Rollout, if picked up

1. Rerun the spike with Sonnet 5.5 as director and run the 5–10 event eval: real cost and
   quality curve, not one sample.
2. Pilot behind a flag on our own events (La Clave, Montuno); compare keep rate and edits per
   kept flyer with the current app.
3. Open to organizers with pricing from the measured cost (e.g. one agent run free per event,
   unlimited on paid plans).

## Decisions it needs

- Opus or Sonnet as director (quality vs ~$1.74 per flyer measured with Opus).
- Where the agent runs.
- Pricing: whether agent flyers are a paid feature.

## Meanwhile

The cheap fixes in the research's "Cheap fixes inside the current pipeline" section apply to the
current pipeline on their own; the multi-person face bug is the urgent one.
