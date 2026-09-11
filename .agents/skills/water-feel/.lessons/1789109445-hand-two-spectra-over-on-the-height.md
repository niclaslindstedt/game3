---
title: Cross two spectra over on the HEIGHT, not on their shares — and draw the new band LAST so every digest holds
date: 2026-09-11
scope: engine/game/water.ts
concepts: [spectrum, determinism, rng, feel]
---

Adding a band that takes over from another (the OPEN band, the storm past
the level's rim) is two decisions, and the obvious answer is wrong in both.

**The handover.** Fading one band's share out linearly while fading the
other's in puts a DIP in the sea where they cross: the two carry different
heights, and shares that sum to one do not make heights that do. Write the
target HEIGHT first — grow it straight from the coast's own `hsRef` to the
storm's `open.hs` over the ramp — and solve the new band's share from what
the old one no longer carries, in energy:
`open = √(target² − carried²) / openHs`. Then Hs is monotone by
construction and there is no calm belt to ride through.

**The draw order.** `createSea` pulls its component frequencies, directions
and phases off one seeded stream, so a band laid before an existing one
re-rolls every level's sea. Lay it LAST and every existing component is the
draw it always was. Then SORT the combined list longest-first, which the
renderer's far grid and `surfaceAt`'s `count` both depend on: sorting is
safe because a band whose share is 0 is skipped before it reaches the sum,
so the non-zero terms stay in the same relative order and a coast's water
comes back bit for bit identical. Ten of sixteen `make sim` digests were
unchanged on a change that added eight components to every level.
