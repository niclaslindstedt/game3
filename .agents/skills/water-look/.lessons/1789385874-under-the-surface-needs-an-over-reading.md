---
title: Closing the water's window deletes anything drawn UNDER the surface — every submerged mark owes a second, on-top reading at about a tenth of white
date: 2026-09-14
scope: pwa/src/game/guide-line.ts, pwa/src/game/water-mesh.ts
concepts: [see-through, water-mesh, water, guide-line, renderer]
---

OPTIONS ▸ VIDEO ▸ SEE-THROUGH is not a detail row: `WaterMesh.setWindow(false)`
makes the near water OPAQUE (`material.transparent = false`, still writing
depth), so a mark drawn under the surface with `renderOrder = -1` is not
merely dimmer, it is gone — and it reads to the player as a feature that has
silently stopped working rather than as a row they turned off.

A submerged mark therefore owes the closed case its own reading: the same
plate lifted just PROUD of the surface along the water's normal (about 0.1 m
is enough to clear it without floating) with `renderOrder` back to 0, which
puts it in the ordinary transparent pass — drawn after the opaque water and
depth-tested against it, so the shore and the hull still occlude it.

The opacity is NOT the same on both sides. Under a see-through surface the
water takes most of the mark's edge off before the player sees it, so 0.55
white is subtle there; over an opaque sea nothing does, and the same value
reads as a stripe painted on the lens. About **0.1** is what looks like a
sheen on the water at chase range — judged by shooting one scene at
`--see 1` and `--see 0` and comparing, never from the value alone.
