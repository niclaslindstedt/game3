---
title: A lab that models the renderer's accumulation agrees with the MODEL, not the renderer — reproduce every dimension of it or none
date: 2026-09-21
scope: scripts/, pwa/src/game/water-break.ts, pwa/src/game/water-mesh.ts
concepts: [measurement, tooling, renderer, foam]
---

`scripts/surf-lab.mjs` asks `water-break.ts` how much of a piece of sea has
gone over. The first version averaged that share at a point over time and
reported four parts in a THOUSAND on a sea a screenshot showed streaked with
white — so the lab was measuring a different quantity from the one on screen.

The fix looked right and was half a fix. The renderer held the breaking in a
world-anchored store, so the lab ran the same decay at the station
(`held = max(instant, held·e^(−dt/LIFE))`) and the number moved from 0.4 % to
4.1 %. **But the store also smeared in SPACE** — it kept the loudest share
over a cell metres across, which the lab, measuring one point, could not see.
So the lab now agreed with a MODEL of the renderer while the renderer drew a
sheltered bay nine tenths white and the lab called it 1 %. The store is gone
and the lab measures the instant again; both are the rule, and they agree.

The rule, stated properly: when a lab measures something the renderer
ACCUMULATES, reproduce **every** dimension it accumulates over — time AND
space — or do not reproduce it at all and say plainly that the number is the
instant. A partial model is worse than the honest instant, because it reads
as agreement and nobody checks it again.

**The check that would have caught it**: once, compare the lab's number
against the PICTURE — the share of white pixels over a patch of sea in a
screenshot. A lab and a renderer agreeing to a factor of a hundred is not a
tuning question. Any lab modelling renderer state owes that comparison.

Two things made this measurable at all, both worth copying: the rule lives in
a three-free module the lab reads through `aliasEngine(root)`, and it reports
its terms APART (surf / crest / caps) rather than only their sum.
