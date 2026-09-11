---
title: An in-craft lens is placed among the craft's OWN FITTINGS — the rider tucks forward of it and the lamps stand forward of it, so verify at speed AND after dark
date: 2026-09-10
scope: pwa/src/game/camera-rigs.ts, pwa/src/game/rider-pose.ts, pwa/src/game/craft-lamps.ts
concepts: [camera, rider, cockpit, framing, lamps, night]
---

`camera.ts` is three-free and cannot read `cockpitOf` or `lampOf`, so the two
bolted-on rigs' offsets are hand-authored body metres from the cog. Everything
they can collide with is therefore invisible to the code and has to be found by
LOOKING — and there are two families of it.

**The rider moves.** `rider-pose.ts` tucks him forward as pace rises, so an eye
at his head's resting position is inside his chest at rest and behind his head
at 60 km/h; the frame becomes his shoulders over the top of the picture, which
reads as a rendering bug rather than a camera one. Verify at `SCENE=carve`, not
`rest` — the tuck is a function of speed and the rest pose hides it.

**The craft's fittings stand FORWARD of the lens.** `lampOf` puts the skiff's
headlamp at z = 1.63 and the rail lamps at 1.48, while `bow` sits at z = 1.15
and `nose` at 0.72 — so all of it is between the eye and the water. By day
nothing shows; after dark a 0.9 m additive bloom sprite 0.48 m from the lens is
a flare across the frame and a 3.5 cm rail lamp is a coloured slab in the
corner. `craft-lamps.ts`'s `setAboard` now hides the hardware (never the beam)
for `isEyeCamera` rungs. **Photograph every new eye rig at night** —
`--hour 21 --weather clear` — because a daylight sheet cannot show this class
of fault at all.

What worked on the skiff (length 3.1 m, cog near mid): `nose` at up 0.95,
forward 0.72 — over the bar and clear of his tuck, the grips framing the bottom
sixth; `bow` at up 0.62, forward 1.15 — the deck's point across the bottom of
the frame. Half a metre lower on `bow` and the near water mesh draws over the
deck and the chines cross the frame as stray lines.
