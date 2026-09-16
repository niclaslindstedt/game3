---
title: A gentle mark on the water reads through CHURN, not relief — but past about 0.6 the churn stops reading as disturbed water and starts reading as murk
date: 2026-09-16
scope: pwa/src/game/wake-bob.ts, pwa/src/game/water-shader.ts
concepts: [wake, relief, churn, ripple, screenshots]
---

A ripple is centimetres tall on a grid whose cell is a metre and a half, so
its relief can only ever turn the water's normal a little; what actually
reads at chase range is the CHURN, which breaks the reflection and lightens
the water along the mark. Building the bob's rings (`wake-bob.ts`) that came
out as a band: 0.35 vanished into the sea's own lace, 0.6 read as a ring of
disturbed water, and 0.8 read as a patch of MURK — because churn also raises
the surface's alpha (`CHURN_ALPHA`), and a mark opaque enough to hide the
bottom stops looking like water moving and starts looking like a stain. If a
white-free mark is reading as a smudge rather than a shape, the churn is the
number to come down on, not up.

(The ring's relief still has to clear the blur — its crest and trough were
1.84 m apart inside a ~2 m blur and cancelled exactly as the stern wave's
lesson says. Stretching to 4 m wide with the trough 3.2 m in fixed it, where
deepening it had not.)

And judge a concentric mark from OVERHEAD first (`--camera drone`, or `make
wake --channels`). Every camera in the game sees a ring end-on at a grazing
angle, where one arc of it is indistinguishable from a patch of sea that
happens to be smooth.

