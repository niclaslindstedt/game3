---
title: The CoG is the trim knob AND the steering lever — the nozzle is fixed at the transom, so mass moved aft is arm taken off the bucket, and the marlin's braked corner fails first
date: 2026-09-12
scope: engine/game/defs/craft.ts
concepts: [tuning, roster, steering, trim, brake]
---

`cog.z` reads as a pure trim knob and is not one. `craft.ts` builds the
nozzle's moment arm as `−length/2 − cog.z + 0.1`, so every millimetre the mass
moves aft is a millimetre off the lever the nozzle AND the reverse gate turn
the hull on. Moving the roster from 10% to 14% of length aft of mid took about
10% off every craft's arm.

The powered turn barely notices (full lock at 20 m/s moved 132° → 131° over
four seconds on the marlin). What fails is the BRAKED corner, and it fails as
a threshold rather than a slide: `craft_test`'s "a corner in half the water"
holds `brake.path < power.path × 0.7`, and the marlin — the tracker, smallest
gate, least-angled nozzle, already the roster's marginal case at 0.63 — went
0.639 / 0.661 / 0.706 / 0.705 at 11 / 12 / 13 / 14%. The skiff and otter sat
near 0.50 and 0.45 throughout and said nothing.

So: **sweep the fraction and read the braked corner at every step, not just
the ends**, and expect the answer to be set by whichever craft is already
closest to the bar rather than by the one you are tuning for.

Resist compensating. `pump.brakeSteer`'s own comment warns that the next notch
up makes the skiff and the otter pirouette, and `hull.brakeBite` at 0.86 only
just recovered the marlin (0.683 against the 0.700 bar) — a 23% move on a
shared knob to buy back a per-craft threshold. Taking 12% instead cost most of
nothing and needed no second knob.
