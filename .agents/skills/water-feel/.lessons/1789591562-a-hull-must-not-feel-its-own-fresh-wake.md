---
title: A wake summed into `surfaceAt` feeds back through the probes — mask the OWNER's young sources inside its own footprint and lay passage sources per METRE, or the hull heaves itself into its own wave
date: 2026-09-16
scope: engine/game/wash.ts, engine/game/defs/wash.ts, engine/game/water.ts
concepts: [wash, wake, huygens, feedback, stability, probes, sources]
---

The wash is Huygens' construction: every source is a full ring from its
birth, and the sum is what the hull's probes read. The first cut fed back
two ways and blew up. (1) Sources laid on a STEP cadence put forty of them
inside one wavelength at the hump, and their coherent trough under the hull
was two metres: the density of a line source must be per metre of travel
(`spacing`), never per step — the bob alone stays on a time cadence, because
it is a rate. (2) A ring's FORWARD arc is standing where the hull now is a
hull length later, so the hull rode up on its own fresh rings and then laid
bigger ones; the inner gate at the birth radius does not cover it, because
the hull has moved. The fix is the owner's footprint mask on sources younger
than `young` — a rival on the same water feels every ring, and the hull
feels its own again when it turns back across its trail. Judge both with the
stability case in `tests/wash_test.ts` (every throttle for twenty seconds on
a flat calm, the wash under `maxCrest` and the altitude under a metre) and
with `make wash`, whose hump column is the resonant case: the hull at the
celerity is meant to sit in a coherent trough, and that trough must stay a
squat and not a well.
