---
title: The same seed asked for a TRICKS field is not always the same shore as the seed asked for a race — so a pinned level may only be ridden in the discipline it was curated in
date: 2026-09-17
scope: pwa/src/game/campaign.ts, pwa/src/game/campaign-levels.ts, engine/mapgen
concepts: [campaign, mapgen, tricks, digest, modes]
---

`compile.ts` says R35's trick field "changes nothing else about the level", and
within one compile that is true. It is NOT true across `generateLevel`: the
search rejects sub-seeds on the ANALYZER's verdict, and the analyzer judges a
tricks level by rules a race level does not have, so a seed can survive one and
be rejected by the other. Measured on the campaign's own seeds: mangrove 34
builds 14 gates as a race and 16 as a tricks run; taiga 14 builds 13 and 15.
Same start, different course.

The consequence, when the three measured modes moved onto the pinned shores:
a campaign level rides only the modes its OWN `mode` fits (`fitsMode` — a race
shore takes RACE and TIME TRIAL, a tricks shore takes TRICKS). Offering a
tricks rung "as a race" would build a different coast under the level's name
and under a digest that no longer describes it, and nothing would say so —
`generator_version_test` only rebuilds a level the way the campaign rides it.

Check this with a throwaway probe rather than by reading the generator: alias
`@engine` with `scripts/lib/engine-alias.mjs` (it takes the repo ROOT as an
argument — `aliasEngine("/path/to/repo")`, not a bare call), then build the
seed both ways and compare `levelDigest`, `course.gates.length` and `ramps`.
