---
title: A lab measuring a renderer rule must run the renderer's ACCUMULATION too — the instant under-reads foam tenfold
date: 2026-09-16
scope: scripts/, pwa/src/game/water-break.ts, pwa/src/game/foam-field.ts
concepts: [measurement, tooling, renderer, foam]
---

`scripts/surf-lab.mjs` asks `water-break.ts` how much of a piece of sea has
gone over, and the first version averaged that share at a point over time. It
reported four parts in a THOUSAND on a sea a screenshot showed visibly
streaked with white — so the rule looked fine and the tuning it drove would
have been wrong in both directions.

The share a rule returns is what is BREAKING at this instant, and a world
point is at the top of a wavelet for about a tenth of a second. What the rider
sees is `foam-field.ts`: the running maximum of the instant against what is
left of the last `FOAM_LIFE` seconds of it. Running that same decay in the lab
(`held = max(instant, held·e^(−dt/FOAM_LIFE))`, discarding the first few
lifetimes so the field has filled) moved the same measurement from 0.4 % to
4.1 % and made the before/after legible.

The general rule: when a lab measures something the renderer ACCUMULATES —
foam, a trail, a decaying field — reproduce the accumulation, or the number is
about a different quantity than the one on screen. Report a COVERAGE beside
the mean too (the share of time above a visible threshold); a mean of 2 % can
be a constant haze or a crest that is fully white a twentieth of the time, and
those look nothing alike.

Two things made this measurable at all, both worth copying: the rule was
pulled out of `water-mesh.ts` into a three-free module the lab reads through
`aliasEngine(root)`, and it reports its terms APART (surf / crest / caps)
rather than only their sum — the whole fault was the right total made of the
wrong terms.
