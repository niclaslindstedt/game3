---
title: A generator change that moves what a seed builds now owes a VERSION row — the campaign's twelve shores carry a digest the suite rebuilds and compares
date: 2026-09-16
scope: engine/mapgen/versions.ts, engine/mapgen/digest.ts, engine/mapgen/generate.ts, pwa/src/game/campaign-levels.ts
concepts: [determinism, versions, digest, campaign, rng, seeds]
---

Every earlier lesson here about the rng stream ("draw a new field LAST",
"one new draw re-rolls every level") was about the population tests and
the sim digests. There is now a third thing on the line: the campaign's
twelve pinned shores, each named, timed and given a medal table, with a
player's board on it. `tests/generator_version_test.ts` rebuilds all
twelve and holds each to the `levelDigest` it pins — every gate, ramp and
rock, the start, the wind, the sea, the ground under each gate — so a
draw-order change or a rule move that reaches a pinned seed is a red
test with the level's name on it.

When it goes red, the fix is NEVER to regenerate the digest unless the
level was deliberately moved. The honest move is a row in
`GENERATOR_VERSIONS` with the old behaviour kept on the old row as an
optional trait read through `generatorTraits(opts.version)` at the one
place the rule differs; the levels stay on their version until somebody
curates them onto the new one. And a version nothing names is deleted,
row and branch together — the same test refuses a museum.

Two things about the digest itself worth knowing before touching it: it
reads the SHORE only — the level's dealt hour, season, sky and wind, not
the campaign's pinned day, so changing a level's day never moves its
digest — and it samples the ground at every gate rather than hashing the
heightfields, so a bed change that never reaches a gate is invisible to
it on purpose.
