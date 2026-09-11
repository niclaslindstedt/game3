---
title: The reverse gate flips the jet's AXIAL sense only — apply the nozzle angle to a negative axial and the craft steers backwards with way still on
date: 2026-09-11
scope: engine/game/propulsion.ts, engine/game/craft.ts
concepts: [bucket, reverse, steering, nozzle, brake]
---

`bucketVector` used to return one `axial` share that went negative past the
gate's neutral, and `craft.ts` resolved the whole thrust off it
(`bx = -along·sin δ`). That is a REFLECTION of the thrust vector, so the
steering reaction reversed with the axial: pulling the brake at 58 km/h with
full right lock turned the skiff 20° LEFT over three seconds, and backing
off the dock swung the bow the wrong way entirely.

The gate is a clamshell downstream of the nozzle: it catches a jet already
thrown to one side and its walls send it forward on THAT side. So it
reverses the axial sense and not the side of the transom the flow leaves
from. `bucketVector` now returns `lateral = (1 − d) + d·reverse`, always
positive, and `craft.ts` resolves the side force off it while `axial` keeps
the along-hull half.

The payoff is that the inverted feel of reverse needs no model at all: it is
a hull travelling STERN-FIRST, where a bow swung right walks the craft left,
which `craft_test`'s "backs the craft the other way round" case holds. And
braking now turns BETTER than a coast (2.7–4.6× the heading on the flat
bench) because `pump.bucketThrottle` keeps the pump fed and the gate's spill
buries the bow into its own sponsons — which is what a rider braking into a
turn expects.

The same trap is live anywhere a deflection is modelled as a share of a
force rather than a direction: ask which COMPONENT the geometry actually
turns.
