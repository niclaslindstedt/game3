---
title: Attribute a contact change's extremes with a `rules.contact: false` control run, not by reading the peak alone
date: 2026-09-16
scope: engine/game/rivals.ts, engine/game/hull-contact.ts
concepts: [contact, rivals, measurement, repro, sweep]
---

A staged pair sweep is the diagnosis (SKILL.md's rule), but it does not tell
you whether a full race is healthy. Stepping twelve bot-ridden hulls for 150 s
and printing the worst `|wy|` over every hull and every step looked alarming —
25 rad/s, roll reaching 180° — until the same race was run with
`createGame({ mode: "race", rules: { contact: false } })`: **14–40 rad/s and
180° of roll with hull-against-hull switched off entirely.** Those peaks are
rocks, ramps, landings and capsizes, not the bump; on one seed the new contact
model came out BELOW the no-contact control.

So a whole-race peak is a number with no owner. The control run is one line and
it is what turns "the contact is violent" into "the contact is not what did
this". Watch `home n/12`, non-finite counts and whether any pair sticks — those
are what a race-length run is actually good for — and leave the per-contact
question to the staged sweep.

A second control worth having for the same reason: `make sim` rides
`OPEN_RULES`, which has NO rivals, so a hull-against-hull change must leave
every sim table and every determinism digest **byte-identical**. If they move,
the change reached the solo path and the sweep did not show you where.
