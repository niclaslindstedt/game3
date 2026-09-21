---
title: Foam belongs to the WATER, not to the frame — but a memory that spreads what it remembers is worse than none, and no screenshot tells you which fault you have
date: 2026-09-21
scope: pwa/src/game/water-mesh.ts, pwa/src/game/water-break.ts
concepts: [foam, whitecaps, water-mesh, shelter, screenshots, reference]
---

This one has been wrong in both directions, and the two faults look identical
from the saddle — a sea that is not the sea the rule describes.

**First: no memory at all.** The mesh's foam share was a memoryless function
of `surfaceAt` at this instant — tilt band times crest gate — and a world
point is at the top of a wavelet for about a tenth of a second. Measured on
seed 28 over a 40 m patch at 60 Hz: median foamed spell **0.13 s**, max
**0.28 s**. That is the wrong QUANTITY, not a tuning fault: what the rule
computes is what is BREAKING, and foam is what the crest LEFT.

**Then: a memory that spread.** The fix was a world-anchored store the mesh
sowed the breaking into and read back — and it kept the LOUDEST share over a
cell metres across and over seconds of clock at once. A hand's width of crest
going over therefore painted that whole cell white for as long as the memory
ran. Measured on seed 38: the rule asks for **0.8 %** of the ridden water and
the field drew a sheltered bay in **2.9 m/s** of wind at about **nine
tenths**. It stood for ten days and read as "the foam effect isn't very good".
The store is gone; the share is this point at this instant again.

If a memory comes back it is per POINT and per instant — decay in time with
no smear in space — and the mesh and `make surf` get it on the same day.

Four things that cost a round each:

- **A still cannot judge a temporal property, and the screenshot lab is worse
  than neutral.** `stand()` in `App.tsx` steps PHYSICS for `--t` seconds and
  renders exactly ONE frame, so anything with per-frame memory is empty in
  every shot: the before and after came back byte-identical while the change
  was working. Measure the time domain in Node first, then look. That same
  one-frame fact is a real player bug — a memory needs priming at stand-up.
- **THE DIAGNOSTIC THAT SETTLES IT IN ONE BUILD.** When the water is too
  white, rebuild with the accumulation removed and the rule kept. Clean water
  means the rule is right and the thing on top of it is lying; still white
  means the rule. Three rounds of tuning cannot separate those two.
- **Per-vertex memory does not survive the grid.** The grid snaps its origin
  to the COARSEST cell, so a band at the leading edge of the fine core is
  handed water only a coarse ring had sampled and resets in view. Any store
  has to be anchored to the WORLD — and that anchoring is what tempts you
  into a coarse cell, which is the smear above. The two pull against each
  other; that tension is the whole design problem.
- **The whitecap wind is the one the water FEELS.** The gate read
  `sea.windSpeed`, the level's headline mean, so a bay in the lee of a
  headland capped as readily as the open sea. `oceanWind` with
  `sea.shelter.shelter` per vertex is the reading the sea itself is grown
  from — on seed 28, 8.6 m/s against 7.4.
