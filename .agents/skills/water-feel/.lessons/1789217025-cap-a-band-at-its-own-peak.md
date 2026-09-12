---
title: Cap a band at a multiple of its OWN peak, never at an absolute period floor — and measure a band by the worst `a·k` and the biggest energy share over the corpus, not by one seed
date: 2026-09-11
scope: engine/game/water.ts, engine/game/defs/tuning.ts
concepts: [spectrum, steepness, tuning, measurement]
---

`layBand`'s short end is `max(bandHigh, tp / minPeriod)`, and `minPeriod` is
an ABSOLUTE floor in seconds. Against a slow peak that ratio explodes: an
84 s swell gets 0.7–33.7 f_p where a coastal sea gets 0.7–2.4 — forty-eight
times the frequency range on the same components, so one component is handed
a whole octave of a spectrum. `sea.open.bandHigh` = 4.8 is the cap that
stops it, and it stays whatever else changes about how a band is drawn.

**The measurement is three lines over the seed corpus, per BAND**: the worst
`c.amp * c.k0` (Michell breaks at 0.44) and the biggest single
`amp² / Σamp²`. One seed says nothing — the fault was found at `a·k` 0.89
with 90 % of a band's energy in one component, on a seed nobody had
rendered. Run it against the baseline tree too: some of what it finds is
pre-existing, which is what says "match the bar, don't chase it".

What it will no longer find is the old LUMPING: a component's energy used to
carry the cos² directional weight, which vanishes at the edge of the spread,
so a component that landed out there was robbed of its spectral share and its
neighbours took the sea. That is fixed at the source — the heading is drawn
THROUGH the spread by inverse transform (`spreadQuantile`) — and the corpus's
worst share fell from 0.87 to 0.59 and its worst `a·k` from 0.63 to 0.15.
Do not reach for more components to fix a lumping band; check the draw first.
