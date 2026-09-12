---
title: A band's WIDTH and where its slices SIT decide whether one component carries too much — not how many components there are
date: 2026-09-11
scope: engine/game/water.ts, engine/game/defs/sea.ts, engine/game/defs/tuning.ts
concepts: [spectrum, steepness, tuning, measurement, feel, performance]
---

Two faults come out of the same place — a slice of band is finally ONE
sine, so the widest slice is where a chunk of the sea stands up as a single
wave — and neither is fixed by laying more components.

**Too wide a band.** `layBand`'s short end is `max(bandHigh, tp /
minPeriod)`, and `minPeriod` is an ABSOLUTE floor in seconds: against an
84 s swell that asks for 0.7–33.7 f_p where a coastal sea gets 0.7–2.4.
One component then reached `a·k` 0.89 carrying 90 % of its band — past
Michell's 0.44 — and 24 components barely helped (0.49), because the width
was the fault. `sea.open.bandHigh` = 4.8 is the cap that fixed it.

**Cut evenly in frequency.** Then the PEAK, where a JONSWAP sea keeps most
of its energy, is one component with its nearest neighbour an octave away:
the two beat inside the water a rider can see, which is the corduroy. Cut
by ENERGY (`energySlices`, `sliceMix`) and three or four slices crowd
within a tenth of the peak, carrying one wave train whose beat is hundreds
of metres. Over ten seeds, the biggest autocorrelation down the wind at
1.5–8 λp: **0.24 cut by frequency, 0.17 cut by energy, 0.15 at double the
count** — the cut buys what doubling costs 7 ms a frame for.

Cut by energy at full strength, though, and the widest slice bites back:
the OPEN band reached `a·k` 0.41. `sliceMix` 0.7 with the open ladder at 0
holds every band under 0.2. And take each slice's energy CENTROID, never
its middle — a wide tail slice holds its energy at the low end.

**The check is one sweep per BAND over the corpus**: the worst `amp · k0`
and the biggest single `amp² / Σamp²`. Run it against the baseline tree
too; some of what it finds is pre-existing, which is what says "match the
bar, don't chase it".
