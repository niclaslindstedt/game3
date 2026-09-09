---
name: nature
description: "Use when working on the NATURE the levels run along — the shore's materials (bedrock slabs, boulder fields, sand pockets, the skerries standing offshore), the biome-as-data model behind them, what the renderer's terrain.ts paints for each, the rocks it stands up, and — later — the flora above the waterline and the countries beyond the taiga. Owns the engine's biome row, the surface classifier's vocabulary, the terrain's paint, the placement rules that keep every solid in the engine's field, and the look-first verification loop."
---

# The nature: the shore, its stone, and what will grow on it

The shore IS half the game's look — the course is a line of buoys along it.
This skill owns everything the shore is MADE of and how it is painted: which
biome a level is set on, what its surfaces are, where its rocks stand, and
(later) what grows above the waterline. The water itself is `water-feel`'s;
the course laid along the shore is `mapgen-improvement`'s.

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs nature --list`, then the ones the task
touches. Load **`skill-reflection`** at both ends of the session, and
**`write-code`** beside this one for any code change.

## The files, one direction of flow

| File | Owns |
| --- | --- |
| `engine/mapgen/biomes.ts` | Biomes AS DATA, engine side: one row per `BiomeId` — the shore's material mix, the relief (how high the slabs, how dense the boulders, how big the sand pockets), the skerry field offshore, the water's density and temperature band, the wind band. `taiga` is the only built row; `archipelago`, `fjord`, `atoll`, `delta`, `arctic` are reserved ids with no row yet |
| `engine/mapgen/shore.ts` | The shoreline for the biome and the surface classifier behind `level.materialAt(x, z) → Surface` (`bedrock`, `rock`, `sand`, `water`) — the vocabulary every painter reads |
| `engine/mapgen/geology.ts` | The ground's SHAPE: the sea bed's slope, the land's low rise and its plateau, the noise (`engine/lib/noise.ts`) that makes bedrock read as slabs rather than a ramp |
| `engine/mapgen/compile.ts` | Bakes the ground heightfield and the solids — where every skerry, boulder and reef STANDS, because the craft can hit them (the `collision` skill owns the contact) |
| `pwa/src/game/terrain.ts` | The terrain mesh from `level.ground`, coloured by `level.materialAt`: granite grey bedrock, darker boulders, ochre sand, with the palette from `identity.ts` |
| `pwa/src/game/rocks.ts` | The low-poly solids drawn where `level.solids` put them — a skerry, a boulder, a reef awash |
| `pwa/src/game/water-mesh.ts` | NOT this skill's — but its colour-by-depth reads the same `ground`, so a bed that changes shape changes what the water looks like over it (`water-feel`) |
| `pwa/src/game/fauna.ts`, `engine/mapgen/fauna.ts` | Placeholders: the fish and animals in the sea. Not this session's |

Biome → material ids are strings on purpose: `biomes.ts` imports nothing from
the renderer, and the terrain painter throws on an unknown `Surface`, so a new
material fails loudly on the first level build. Shared value noise lives in
`engine/lib/noise.ts` (and `pwa/src/lib/noise.ts` for paint-only detail) —
the shore's shaping and the terrain's paint must keep drawing from the same
helpers or their patches stop lining up.

## The biome model

- **A biome is data, not code, on BOTH sides of the world.** The engine's
  row (`engine/mapgen/biomes.ts`: what the shore is made of, the relief, the
  water, the wind) and, when the renderer grows one, the app's row (a
  palette and later a flora roster). Which one a level is on is `level.biome`,
  drawn from the seed's options; nothing else in the engine names a country.
- **The taiga shore is the Baltic's: low, hard, broken.** Bedrock SLABS
  sloping into the water (the glacier's work — smooth, low, grey), BOULDER
  fields where the moraine was dumped, SAND POCKETS in the bays between, and
  SKERRIES — the same bedrock standing just out of the water offshore, with
  reefs just under it. No cliffs, no beaches that run for a kilometre. A shore
  that reads as one material for 300 m is a shore that has lost its quilt.
- **Materials come in PATCHES, not confetti.** A real shore is a slab, then a
  boulder field, then a bay of sand: patches tens of metres across with
  meandering borders, drawn from a low-frequency noise the geology and the
  classifier share. Per-cell noise reads as static.
- **Context beats material.** Within a metre of sea level the classifier
  says what the WATERLINE is made of, whatever the patch behind it — sand
  where the bay is shallow, rock where the slab runs in — because the
  waterline is the one line of the shore the player reads at speed, and the
  water's colour-by-depth has to agree with it.
- **Everything solid is placed engine-side.** The renderer draws `level.solids`
  where the compiler put them — never the reverse, and never a drawn rock
  without a collider or a collider without a drawing. What the renderer may
  place on its own is decoration that cannot be hit: paint, and later the
  flora above the waterline.

## Verify by LOOKING

Numbers can't judge a shore. After any nature change:

1. `make level SEED=7` (and a few other seeds) — the plan shows the
   materials as shading and every solid as a mark; a shore whose quilt has
   collapsed is obvious here first, in seconds, with no build.
2. `make build`, then `CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots
   SCENE=cruise` (and `carve`, `offshore`) — the shore at riding pace, from
   the chase camera, at both viewports. Does bedrock read as slabs? Do the
   boulders read as a field rather than a sprinkle? Does the sand sit in the
   bays? Do the skerries stand where the plan put them, and does the water
   over a reef read shallow?
3. **Stand still and look**: `make screenshots SCENE=rest` is the craft at
   rest beside the shore, and the only shot where a material's paint is
   judged rather than glanced at.

`tests/mapgen_test.ts` holds the classifier's contract over the shared corpus
(every gate over `water`, every solid on `rock` or `bedrock` or awash, the
materials present in the biome's stated shares).

## The craft rules

- **Everything is vertex-coloured low-poly under one hemisphere + directional
  light** (the placeholder for the sky system). Per-facet brightness jitter
  and a big soft noise band are what keep a grey slab from reading as
  plastic; a texture is not the answer.
- **Paint is seeded by the level seed.** Cosmetic randomness (facet jitter,
  patch tint) goes through a PRNG derived from `level.seed` so a seed always
  paints the same shore. It costs nothing; keep it deterministic.
- **The waterline is a hard edge in the paint and a soft one in the mesh.**
  The terrain's vertices straddle sea level; the colour changes at y = 0
  (wet rock is darker), and the mesh continues under the water so the
  colour-by-depth of `water-mesh.ts` has a bed to read.
- **Bedrock shows where the ground is steep, boulders where it is broken.**
  Colour by slope and by the classifier together — a slab that climbs reads
  as rock whatever the patch says.
- **Nothing the terrain draws is closer than the hull's margin to the course
  path** — that is the analyzer's clearance check, not the painter's job, but
  a painter that lifts a vertex above sea level inside the path has invented
  a solid the engine does not know about. Paint never moves geometry.

## Adding things

- **A new material**: a `Surface` id in `engine/mapgen/types.ts` (tell the
  orchestrator — it is an exported shape), its share on the biome row, its
  patch in `shore.ts`'s classifier, its colour in `terrain.ts`, a row in
  `tests/mapgen_test.ts`'s material shares. `make level` shades it.
- **A new solid kind**: `Solid.kind` in `types.ts`, its placement in
  `compile.ts` under a rule in `rules.ts`, its shape in `rocks.ts`, and its
  contact in `collision.ts` (the `collision` skill).
- **A new biome**: a row in `engine/mapgen/biomes.ts` (the taiga's row stays
  neutral so no taiga seed re-rolls — `mapgen-improvement`'s invariant), a
  palette for the terrain, and eventually a flora roster and a sky look. The
  reserved ids exist so the campaign's level ids never change when the
  country arrives.
- **The flora above the waterline** (not built): pines and birches on the
  slabs, juniper and heather in the pockets, reeds in the bays. When it
  comes, it follows the sibling game's pattern — a species roster of
  parametric low-poly builders, instanced per variant, placed by the biome's
  communities, NEVER below the waterline and never inside the hull's margin
  — and this skill grows the sections for it.

## What the change obliges elsewhere

- A material or relief change → `make level` at several seeds and
  `make analyze` over a sweep (the depth and clearance checks read the bed).
- A `biomes.ts` change → the corpus digest, before and after.
- `docs/level-generator.md` for anything the rules quote; a changeset
  fragment — the shore is what the player looks at.

## Skill self-improvement

Record lessons under `.agents/skills/nature/.lessons/` in the
`skill-reflection` format; that skill decides at session end what gets
promoted into this file. Never append lessons here directly.
