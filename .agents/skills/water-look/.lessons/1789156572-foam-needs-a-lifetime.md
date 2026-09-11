---
title: Foam belongs to the WATER, not to the frame — a share read off the instantaneous surface is a spark that lives a tenth of a second, and no screenshot can ever show you that it is wrong
date: 2026-09-11
scope: pwa/src/game/foam-field.ts, pwa/src/game/water-mesh.ts
concepts: [foam, whitecaps, water-mesh, shelter, screenshots, reference]
---

"The foam flickers for two or three hundred milliseconds" was exactly right,
and the number is the diagnosis. The mesh's foam share was a memoryless
function of `surfaceAt` at this instant — tilt band times crest gate — and a
world point is at the top of a wavelet for about that long. Measured on seed
28 over a 40 m patch at 60 Hz: median foamed spell **0.13 s**, max **0.28 s**,
100 % under half a second. That is not a tuning fault. It is the wrong
quantity: what the rule computes is what is BREAKING, and foam is what the
crest LEFT — air in the water, sitting where it was made while the wave
rolls on, decaying over seconds (Monahan and Lu's stage B, ~3.5 s).

Three things that cost a round each:

- **A still cannot judge a temporal property, and the screenshot lab is worse
  than neutral here.** `stand()` in `App.tsx` steps PHYSICS for `--t` seconds
  and renders exactly ONE frame, so anything with per-frame memory is empty
  in every shot. The before and after pictures came back byte-identical while
  the change was working perfectly. Measure the time-domain in Node against
  the engine first (spell durations, coverage), and only then look.
  The same one-frame fact is a real player bug: prime the memory at stand-up
  or every run starts on a sea that has never broken.
- **Per-vertex memory does not survive the grid.** The obvious store — a float
  beside each vertex — is wrong: the grid snaps its origin to the COARSEST
  cell (12–18 m, about half the core's width), so on every snap a band at the
  leading edge of the fine core is handed water only a coarse ring had
  sampled, and its memory resets in view. The store has to be anchored to the
  WORLD. A power-of-two field indexed modulo its side is the cheap answer:
  following the craft is a mask and the clearing of one band, never a copy,
  and it is independent of the WATER row's geometry. Keep it coarse on
  purpose — the share is low-frequency modulation and the foam TILE carries
  every streak and hole, so a 3–5 m cell loses nothing and old foam coming
  back blurred is old foam that has spread.
- **The whitecap wind is the one the water FEELS.** The gate read
  `sea.windSpeed`, the level's headline mean, so a bay in the lee of a
  headland capped as readily as the open sea two kilometres out. `oceanWind`
  with `sea.shelter.shelter` sampled per vertex is the same reading the sea
  itself is grown from, and on seed 28 it is the difference between 8.6 m/s
  and 7.4.

`read` is called for every vertex and `sow` early-returns for most, so the
field's cost is the READ: ~0.53 ms a frame on the `high` row (9.5 k vertices)
against the water's own ~9.5 ms of `surfaceAt`. Two divisions on the wrap were
a third of that before the side became a power of two.
