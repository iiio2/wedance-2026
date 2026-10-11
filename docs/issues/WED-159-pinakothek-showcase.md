---
title: "Pinakothek Showcase"
type: Story
id: WED-159
p: E807
source_github: "razbakov/wedance-2026#57"
linear_url: https://linear.app/wedance/issue/WED-159
audience: Organizer
cuj: "C6 — Host — Private event & venue"
jtbd: "J6 — Run a great event / throw a great night"
status: built
wsjf_business_value: 5
wsjf_time_criticality: 3
wsjf_risk_opportunity: 5
wsjf_job_size: 5
wsjf: 2.6
origin: engineering-backlog (migrated from GitHub Issues 2026-07-16)
---

> Migrated from GitHub [razbakov/wedance-2026#57](https://github.com/razbakov/wedance-2026/issues/57) · tracked in Linear **WED-159** (https://linear.app/wedance/issue/WED-159).

**Original title:** Pinakothek der Moderne booking showcase (5 areas) for organizers

## Tension
Need a flagship bookable venue to prove the model and help Munich social-dance organizers find space.

## Driver
Concrete wedge for the booking subsystem; a real 'book a spot to run your social' demo.

## Requirement
- Venue profile @pinakothek-der-moderne (type=venue) with its 5 bookable areas (photos, capacity, floor type, price/inquiry, availability).
- Organizer flow: browse areas → request date → accept T&C → submit → venue responds.
- 'Book a space' info page + surface on /for-events and city pages.
- FACT-CHECK before shipping: real names/count of bookable areas, that it rents for social dance, pricing. No invented specifics (content rule).

Depends on: unify-profiles, booking-subsystem. Plan: 2026-07-07-unified-profiles-booking-plan.md
