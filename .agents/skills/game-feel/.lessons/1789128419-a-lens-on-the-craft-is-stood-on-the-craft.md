---
title: A lens bolted to the craft is stood on the HULL, never at a fixed height over the cog — a fixed offset puts it inside a taller hull, and the near plane then cuts a hole clean through the machine
date: 2026-09-11
scope: pwa/src/game/camera-rigs.ts, pwa/src/game/camera.ts, pwa/src/game/craft-body.ts
concepts: [camera, framing, cockpit, near-plane, clipping, roster]
---

Reported as "you should not be able to see through the craft in that camera
angle", and it is not transparency: `NEAR` is 0.2 m (`renderer.ts`), the hull
is a closed mesh with no back faces, so any deck inside the near plane is
cut open and the sea is drawn through the gap.

`EYE_RIGS` authored `up`/`forward` as fixed body metres from the cog. The
roster's decks are NOT the same height — at the bow station the otter's stands
0.70 m over its cog and the dart's 0.44 m — so one number tuned on the skiff
gave 0.10 m of clearance there, 0.02 m on the marlin and put the otter's lens
0.08 m INSIDE its own foredeck. Five of the eight (rig × craft) placements were
inside the near plane.

The fix is to ask the builder: `deckOf(spec, style, z)` in `craft-body.ts`
(bisects the station, then reads the same loft the mesh is drawn from), handed
to `camera.ts` as a closure by the renderer on craft load (`setFit`), because
`camera.ts` is three-free and cannot import it. Rigs then carry `overDeck`, a
clearance, not a height.

Two things worth knowing next time:

- **Size the clearance against the near plane, not the eye.** The bottom of the
  frame leaves at `fovMax/2` below the axis and a nose-down hull tips it ~8°
  further, so the deck's first hit is at `overDeck / tan(fovMax/2 + 8°)` along
  the view axis. That is what sets 0.32 m on `bow`.
- **A bar in the frame must be at least NEAR away or it is cut open too**, and
  on the hulls whose grips reach furthest forward no height buys that — so
  `nose` is anchored a quarter metre AHEAD of the grips instead. Anchor a
  cockpit lens to `cockpitOf`'s grips, never to the cog.

Verify with a raycast probe over the whole roster (build each craft with a
DoubleSide material — a lens inside a hull makes BOTH the up and down rays
miss a FrontSide one, which reads as "no deck there" rather than as the fault).
