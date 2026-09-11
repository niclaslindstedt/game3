---
title: What lumps a band's energy into one short wave is its WIDTH, not its component count — an absolute `minPeriod` floor against a slow peak is what to look for
date: 2026-09-11
scope: engine/game/water.ts, engine/game/defs/tuning.ts
concepts: [spectrum, steepness, tuning, measurement]
---

`layBand`'s short end is `max(bandHigh, tp / minPeriod)`, and `minPeriod` is
an ABSOLUTE floor in seconds. Against a slow peak that ratio explodes: an
84 s swell gets 0.7–33.7 f_p where a coastal sea gets 0.7–2.4 — forty-eight
times the frequency range on the same eight components.

That breaks on the cos² directional weight, which VANISHES at the edge of the
spread (the `narrow-bands-lump` lesson, one band wider): when the longest
component's draw lands out there its energy is normalised onto whatever is
left, and across a band that wide the next candidate is a far SHORTER wave.
Measured over the corpus: `a·k` 0.89 with 90 % of the band's energy in one
component — several times past breaking, which the renderer paints entirely
in foam.

**More components barely helps** — 8 → 24 only took the worst `a·k` from 0.89
to 0.49, at triple the cost — because the width is the fault and not the
resolution. Capping the band at a multiple of its OWN peak (4.8, which is what
the twenty-metre storm has always had) took it to 0.462 against that storm's
own long-standing 0.461.

The measurement is three lines over the seed corpus: for each band, the worst
`c.amp * c.k0` and the biggest single `amp² / Σamp²`. Run it against the
baseline tree too — 0.461 turned out to be pre-existing, which is what said
"match the bar, don't chase it".
