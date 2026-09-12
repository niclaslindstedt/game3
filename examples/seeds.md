# Known-good level seeds

Drawn with `npm run level -- --seed <n>`; ridden with
`npm run sim -- --seeds <n>`. Character as of the current generator rules —
the generator is deterministic per seed, so these stay stable until the
rule book (`engine/mapgen/rules.ts`) changes, at which point regenerate this
list from a fresh `make analyze COUNT=24` sweep and a look at each plan.

Every seed here is ridden on the taiga coast (low bedrock slabs, boulder
fields, gravel pockets, skerries offshore) — the mangrove coast builds a
different shore from the same number (`--biome mangrove`), and is swept
separately; the column that separates them is the wind, which is what sets
the sea.

| Seed | Character                                                         |
| ---- | ----------------------------------------------------------------- |
| 1    | The default level — the seed the game opens on with no `?seed=`   |
| 7    | Sheltered: the lighter wind, gates tucked between skerries        |
| 38   | Exposed: a fresh onshore wind, a metre of sea on the outer gates  |
| 123  | Ramp run: the air gates fall on the long open reach, back to back |

Fill this in from the sim table and the level plans once the generator has
been swept — a row here is a claim somebody has looked at.
