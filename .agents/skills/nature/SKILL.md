---
name: nature
description: "Use when working on the NATURE the levels run along — the shore's materials (bedrock slabs, boulder fields, sand pockets, the skerries standing offshore), the biome-as-data model behind them, what the renderer's terrain.ts paints for each, the rocks it stands up, the sea life under the water (R20), the flora above the waterline, and — later — the countries beyond the taiga. Owns the engine's biome row, the surface classifier's vocabulary, the terrain's paint, the placement rules that keep every solid in the engine's field, and the look-first verification loop."
---

# The nature: the shore, its stone, and what will grow on it

The shore IS half the game's look — the course is a line of buoys along it.
This skill owns everything the shore is MADE of and how it is painted: which
biome a level is set on, what its surfaces are, where its rocks stand, what
swims off it and what grows above the waterline. The water itself is
`water-feel`'s and its look `water-look`'s; the course laid along the shore
is `mapgen-improvement`'s.

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
| `pwa/src/game/water-optics.ts` | WHAT A COAST'S WATER IS MADE OF, the app side of a biome row: its three tones and the depths they run over, the surface's window, the flat unlit tone the bottom fades into, and `clarity` — the ONE depth scale the window, the bed's fade and the sea life's haze are all written against. A coast in `BIOMES` without a row here throws on its first level (`tests/water_optics_test.ts`). The see-through model those numbers feed is `water-look`'s |
| `pwa/src/game/water-mesh.ts` | NOT this skill's — but its colour-by-depth reads the same `ground` and the same optics row, so a bed that changes shape changes what the water looks like over it (`water-look`) |
| `engine/game/defs/fauna.ts` | THE CATALOG (R20): the ten animals, and for each what it is — length, beam, cruising speed, the depth it holds at, the water it needs, its offshore band, its school size, how often it comes up (`breath` / `bask`) and how deep it holds when it does (`awash`), whether its bulls breach (`breach`), its temperature band — and `perKm`, how rare it is. `rarityOf` turns that one number into the word; nothing states the word |
| `engine/mapgen/fauna.ts` | THE PLACER (R20): pods laid along the coast after the rocks, each tried a bounded number of times for a spot with the water its species needs the whole way round the loop it swims, clear of the solids. Its draws come off the END of the seed's stream, after R19's sky, so adding or retuning an animal moves no geometry |
| `engine/game/fauna.ts` | THE SWIM MODEL: `faunaPose(pod, i, t, out, waterY)` — the loop, the formation, the weave, the rise, the breach — a pure function of the placement, the clock and the sea over the pod. Nothing about the sea life is ever stepped |
| `pwa/src/game/fauna.ts` | THE LOOK: `STYLES` (paint, fin proportions, markings) and the parametric body, one instanced draw call a species, with the tail beat and the depth haze grafted into the vertex shader |
| `pwa/src/game/flora-defs.ts` | THE ROSTER: the thirteen rows the shore is covered in — for each, what it IS (its form, height band, spread, bark and the two greens of its canopy) and its HABITAT (the ground and inland bands, the surfaces, the slope it holds on, its share, the bigger share it takes on a riverbank, the shelter it needs, the patch it comes in). `TREE_LINE` is stated here and `terrain.ts` paints the forest floor under it |
| `pwa/src/game/flora-plan.ts` | THE PLACER: candidates thrown along `level.shore` — which the river's banks are part of (R26) — and each point offered to every row, one species picked weighted by share. Three-free, so `tests/flora_test.ts` holds the habitats |
| `pwa/src/game/flora-shapes.ts` | THE BUILDERS: seven parametric low-poly forms carrying the thirteen rows, each one flat-shaded vertex-coloured geometry off the shared `lowpoly` Builder, with the facet budget that gives a 30 cm plant a bipyramid and a spruce a lump |
| `pwa/src/game/flora.ts` | The wiring: one instanced mesh a species, the per-instance matrix and tint, and the DETAIL row's thinning |

Biome → material ids are strings on purpose: `biomes.ts` imports nothing from
the renderer, and the terrain painter throws on an unknown `Surface`, so a new
material fails loudly on the first level build. Shared value noise lives in
`engine/lib/noise.ts` (and `pwa/src/lib/noise.ts` for paint-only detail) —
the shore's shaping and the terrain's paint must keep drawing from the same
helpers or their patches stop lining up.

## The sea life, and why it is drawn the way it is

The game only ever sees an animal from a CHASE CAMERA looking ALONG the
water, and that one fact decides everything about the fauna's look:

- **A silhouette from above is all there is.** The dorsal, the pectorals and
  the tail span are what separate one species from another; a marking that
  only shows in profile shows nowhere. The markings that survive are the
  ones on a back — an orca's saddle, a minke's flipper bands, a perch's bars.
- **Depth is the enemy of visibility, and the depth cue at the same time.**
  The water's own alpha (`water-mesh.ts`) is one number for a patch of sea
  and cannot know how far under it a thing is; the ANIMAL carries its own
  depth, hazed toward the water's bright shallow tone, so a deep one is a
  pale ghost and a surfacing one is crisp and dark. That is why every animal
  in the catalog holds far shallower than the water it needs: `depth` and
  `water` say different things and neither is the other's slack.
- **EVERY depth cue rides the THING's depth, never the surface's**, and the
  one scale they all use is the coast's `clarity`: the animals haze toward
  the bright shallow tone, the sea bed fades into the coast's flat unlit
  `bed` tone, and the surface's window merely thickens over the same reach.
  So "you cannot see the bottom" and "you can see the fish" are one sea
  rather than two settings — and the corollary is that the window is never
  the lever for hiding anything, because it hides the sea life by the same
  share.
- **Coming up is the sighting, and it is measured against the WATER.** A
  cetacean rolling its back through the surface is the only moment it
  reads at range, which is why the catalog's breathing intervals are the
  short end of the real ones — and why the porbeagle comes up too (`bask`)
  even though it breathes water. What shows is the FIN and nothing under
  it: `awash` is how deep the centreline holds at the top of the rise, in
  body radii, and about one radius puts the back awash with the dorsal
  cutting the surface. Taken against the sea over the pod rather than
  against y = 0, because a level's sea is metres high and a fin that
  clears the mathematical plane clears nothing. Only a BULL DOLPHIN goes
  further, and that leap is the one time this game shows an animal
  against the sky.
- **Rarity is the feature.** Retuning `perKm` is retuning the whole thing:
  run a sweep of seeds and COUNT before and after (`make level SEED=n`
  prints a seed's roster, `make analyze` the pods and animals per level),
  and check the ladder still reads — commonest several times a ride,
  legendary once in dozens.

## The cover above the waterline

Thirteen rows, and the reason there are thirteen is that a taiga COAST is
not the taiga. The picture people carry inland — a wall of spruce — is
wrong at the water, and a shore drawn from it reads as a screensaver:

- **The shore is a LADDER, and the ladder is the design.** Reed in the
  shallow water, sedge in the wet margin, alder and sallow on the bank,
  lyme grass on the sand, birch running down to the waterline, Scots pine
  on the dry slabs with juniper and ling between them, spruce only where
  the ground behind holds water, bare rock over the tree line. Each rung
  is a habitat band rather than a place, so it holds on every seed.
- **The leaf trees are what say NORTHERN.** A white birch trunk against a
  dark conifer is the single most legible thing on this coast at any
  distance, and a roster of conifers alone reads as generic forest
  wherever it is set.
- **The river is made of its plants.** Three fields do it and not one is a
  special case in the placer: the riparian rows take a much bigger share
  within `riverside.within` of the river's line, reed needs a `shelter`
  ring only a cove or a mouth gives it, and the patchy rows come in
  patches. A mouth grows a wall of reed with alder behind it; the open
  coast does not. Retuning `riverside.share` is retuning the delta.
- **Nothing in the roster is a solid.** The hull rides through a reed bed.
  That is the deal that lets the renderer place it at all, and it is why
  the DETAIL row may thin it and may never thin a rock.
- **A plant's facets come off its height.** A row that never exceeds a
  metre and a half is a few pixels from the saddle and there are thousands
  more of them than of the trees, so it gets a bipyramid where a tree gets
  a lump. Derived rather than stated per row, so a species retuned taller
  earns its facets on the same edit.
- **Judge the roster on the sheet, the shore in the app.** `make flora`
  is the ladder side by side; `make screenshots SCENE=river` is whether
  the delta reads. And `make profile` before and after, always: the cover
  is the biggest single block of geometry in the frame.

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
- **A new species**: a row in `pwa/src/game/flora-defs.ts` — what it looks
  like and where it grows — and, only if no existing form carries it, a
  case in `flora-shapes.ts`. Nothing else changes: the placer reads the
  roster, the lab sheets whatever is in it, and the test asserts the row's
  own bands. Judge it with `make flora` before you ever look at a shore.

## What the change obliges elsewhere

- A material or relief change → `make level` at several seeds and
  `make analyze` over a sweep (the depth and clearance checks read the bed).
- A flora change → `make flora`, `make screenshots SCENE=river` and
  `SCENE=rest`, and `make profile` before and after.
- A `biomes.ts` change → the corpus digest, before and after.
- `docs/level-generator.md` for anything the rules quote; a changeset
  fragment — the shore is what the player looks at.

## Skill self-improvement

Record lessons under `.agents/skills/nature/.lessons/` in the
`skill-reflection` format; that skill decides at session end what gets
promoted into this file. Never append lessons here directly.
