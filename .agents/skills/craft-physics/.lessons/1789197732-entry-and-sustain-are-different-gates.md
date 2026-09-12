---
title: A gate written on a quantity the feature itself changes will cancel the feature — require it to START, not to CONTINUE
date: 2026-09-12
scope: engine/game/craft.ts
concepts: [tuning, arcade, dead-band, hull, game-feel]
---

The stand-up is gated on the hull carrying the rider, stated as
`wetted >= stand.wetted`. That is right for GETTING up and fatal for STAYING
up, because standing the craft on its tail is precisely what takes the bottom
out of the water: the hull reared to 27°, `wetted` fell through the bar, and
the rider was put back on the seat partway through the 77° he was on his way
to. The gate cancelled the thing it was gating.

The same shape bit the throttle bar. Balancing on the tail IS throttle work —
the rider holds the attitude by easing on and off — so one bar for entry and
sustain meant every correction dropped him and restarted the dwell: the trick
could be entered and never held.

So for anything with a committed state, write TWO conditions. Entry is the
deliberate one (a dwell, a full bar, the pre-condition). Sustain is looser
(`stand.keep` = 0.55 of each bar) and drops any pre-condition the state
itself invalidates. The tell is a feature that works for a fraction of a
second and then undoes itself, with no error anywhere — it looks like a
tuning problem and is a structural one.
