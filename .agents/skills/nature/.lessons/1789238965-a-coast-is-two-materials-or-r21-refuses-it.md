---
title: A second biome's shore row is tuned against R21's quilt, not against the picture — sweep sixteen seeds before believing a sand threshold, and never zero the boulder field
date: 2026-09-12
scope: engine/mapgen/biomes.ts, engine/mapgen/compile.ts, engine/analysis/index.ts
concepts: [biome, shore, r21, sand, boulder-field, generator]
---

The mangrove row was first written the way the coast LOOKS — beach nearly
everywhere (`shore.sand` 1.75) and no boulder field at all (0), because a
warm flat coast has no moraine. Eight seeds in twelve then failed to build,
and the last attempt's reason was different each time ("the basin cannot
carry a course", "the route folds back") — which hides that the attempts
were being spent on R21's quilt: 2 112 m of unbroken sand on one seed,
2 080 m of unbroken bedrock on the next. Two facts behind it:

- The sand threshold gates on RUGGEDNESS, and the character field's shelter
  term pulls every inland channel under it at once, so a threshold that
  looks like "a bit more beach" turns a whole channel into one material.
- The "rock" SURFACE is the only thing that breaks a rugged stretch up. Zero
  the field and every marl point is one unbroken run, whatever the beaches
  do. On a warm coast it is the oyster bars and the coral rubble; keep it,
  and paint it (`shore-paint.ts`), rather than delete it.

The check is a scratch sweep over sixteen seeds per setting, counting builds
and the last reasons (`generateLevel` muted). Measured: sand ×1.0 with no
field builds 9/16; ×1.0 with a field of 0.5, 14/16; ×1.2 with 0.8, 16/16 —
the taiga's own rate; ×1.35 with 0.8, 15/16. Put the numbers in the row's
comment so the next retune starts from them.
