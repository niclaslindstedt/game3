---
name: craft-design
description: "Use when designing or changing how a CRAFT LOOKS — its hull's silhouette, the deck, the seat, the handlebars, the sponsons, the colours. Owns the parametric low-poly builder (pwa/src/game/craft-body.ts), the per-craft styles (craft-styles.ts — one style built, the other three reusing it with their own dimensions and colours), and the render-compare-iterate loop: `make crafts` for the elevation sheet (pure Node, seconds, the physics' waterline and probes over the drawn hull), then the built app at rest with `make screenshots SCENE=rest`, LOOK, refine, then verify at speed."
---

# Craft design

Craft in this game are not modelled in a DCC tool and not hand-placed boxes:
they are **generated**. `pwa/src/game/craft-body.ts` builds a low-poly hull,
deck, seat and handlebars from a `CraftBodySpec` — and the spec's DIMENSIONS
come from the catalog row (`length`, `beam`, `deadrise`), so the drawn hull
is the physics' hull. Designing a craft means editing a style and LOOKING,
never guessing from numbers.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs craft-design --list`, then what the task
touches. Load `skill-reflection` at both ends, and `write-code` beside this
skill for any code change.

## Where everything lives

| Piece | Role |
| --- | --- |
| `pwa/src/game/craft-body.ts` | The assembly line: one cross-section per station (keel, chine, spray strake, the rail's two edges, the coaming, down into the footwell, across to the pedestal, up over its crown) lofted along stations whose rise and taper are read off `TUNING.hull` — the physics' own probe tables — so the drawn keel is the probes' keel; then the saddle loft, the boarding bumper, the sponsons, the pump housing and nozzle, the steering pod, column, bars, grips and mirrors. Everything is ONE vertex-coloured geometry with a per-facet brightness hash, drawn as one mesh |
| `pwa/src/game/craft-styles.ts` | The styles — one `CraftStyle` per catalog id: the paint (hull, topside, rail, deck, seat and its top insert, tray, bar, grip) and a `CraftShape` (the bow's rake, the hood's height, the saddle's length and height, the column's length, the sponsons' reach). **Pure data, no three.js import** (Node tooling loads it). `RUNABOUT` is the one authored shape; the sit-downs spread it with a knob or two each, the dart is its own |
| `engine/game/defs/craft.ts` | NOT this skill's file — the physics row. The builder READS `length`, `beam`, `height`, `deadrise` and `cog` from it, and the station tables from `TUNING.hull`; a style never restates them |
| `scripts/craft-preview.mjs` | `make crafts` — the elevation sheet: every craft from the real builder in side, bow, stern, plan and chase views, the rest waterline (`restY`) and every probe (`hullProbes`) over it, and a table of draft, freeboard, bar height and triangle count. Pure Node through `aliasEngine`, no build |
| `pwa/src/game/renderer.ts` | Places the body from `CraftState` (`x, y, z`, the quaternion) — the mesh's origin is the CoG, so it pitches and rolls about the point the physics does |
| `pwa/src/game/rider.ts`, `rider-pose.ts` | The rider — the `rider` skill's. It is stood on this builder's deck through `cockpitOf` (the saddle's bucket, the grips, the footwells as they are drawn), so a change to the seat, the bars or the wells moves him, and the sheet shows whether he can still reach |
| `pwa/src/game/scenarios.ts` | `rest` is the contact sheet for now: the craft afloat, still, beside the shore |
| `scripts/screenshot.mjs` | `make screenshots SCENE=rest CRAFT=<id>` photographs it, both viewports |
| `pwa/src/identity.ts` | The PALETTE the colours are drawn from — a style names a palette entry, never a hex |

## The loop: sheet → LOOK → iterate → the built app

1. **Sheet the current state**: `make crafts` (a second, no build) writes
   `previews/crafts.png` — the four craft in five views, the physics over
   them — and prints the table. Keep the picture and the table: the PR
   owes both, before and after.
2. **Change one axis at a time** — a `CraftShape` knob, a paint entry, a
   station's cross-section — and re-sheet. Judge the SIDE view for the
   silhouette (the sheer, the stem's rake, the hood against the saddle),
   the BOW and STERN for the hood's shoulders and the transom, the PLAN
   for the footwells and the pedestal, and the CHASE cell for how it will
   read from the game's camera. A change that moved three things teaches
   nothing.
3. **LOOK — with the Read tool.** The sheet is where the sculpture is
   judged; every proportion argued about is a number in its table.
4. **Then the built app**: `make build`, then
   `CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=rest
   CRAFT=<id>` for every craft touched. The landscape frame is the chase
   camera's view at its real range — sixty pixels tall, against the
   water's palette, under the scene's light — and it is the verdict; the
   sheet only diagnoses.
5. **Close at speed**: `make screenshots SCENE=cruise` and `SCENE=carve` —
   only the game proves the read at speed, in spray, rolled into a turn.

## Judging a craft (what "good" means here)

- **The chase view is the verdict.** A craft is judged from behind and a
  little above, at speed, at maybe 60 px tall — the silhouette, the deck
  colour and the sponsons must read THERE. Elevations only diagnose.
- **It reads as a PWC.** A raked bow, a gunwale that sweeps up forward, a
  flat deck with a long seat and the bars ahead of it, sponsons at the
  chine, a transom with the jet's nozzle. The one style has to say all of
  that at a glance; a hull that reads as a boat or a surfboard has lost a
  line.
- **Identity per craft, one glance apart**: the skiff short and chunky in
  a bright colour, the marlin long and low with a dark hull and a light
  deck stripe, the otter wide and tall-sided in a quiet two-tone, the dart
  narrow with a tiny seat and the bars high — a stand-up. The dimensions do
  most of this for free because they come from the catalog; the colours
  and the seat/bars proportions do the rest.
- **Match the world's art direction**: faceted, chunky, flat-shaded under
  the hemisphere light, colours from `identity.ts`'s palette. No smooth
  curves — the loft's hard stations ARE the style, and the per-face
  normals are what keep them reading as stations.
- **The waterline is honest.** At rest the hull sits at the physics' draft;
  the drawn hull's bottom must be at the depth the probes are, and the
  gunwale must be above the water by what the freeboard implies. A hull
  drawn deeper than it floats is a hull that appears to hover; shallower,
  and it appears to sink.
- **Physical scale is fixed by the catalog**: a craft is its row's
  `length` × `beam`, and the camera, the gates and the ramps are sized for
  that. Changing a craft's LOOK never changes its size; changing its size
  is a `craft-tuning` change that the look follows.

## The craft rules

- **Everything is merged vertex-coloured low-poly under one material.**
  The body is ONE geometry per style — the hull and deck loft, the saddle
  loft, every box and every tube — drawn as one mesh: one draw call a
  craft. New parts go through the builder's helpers (`loft`, `cap`,
  `box`, `tube`), never a three.js primitive with its own material; the
  per-facet brightness hash keeps a big flat colour from reading plastic.
- **The builder reads the row and the physics; the style adds only what
  neither says.** Colours, the bow's rake, the hood's height, the saddle's
  proportions, the column's length, the sponsons' reach are style; length,
  beam, depth, deadrise and the CoG are the row's, and the keel's rise,
  the bow's taper and the chines' position are `TUNING.hull`'s. A style
  that restates a dimension drifts from the physics on the next catalog
  change; a loft that draws its own rise draws a keel the probes are not
  on.
- **Rings run counter-clockwise seen from astern, and advance toward the
  bow.** That is the winding `loft` and `cap` assume (`cap(…, true)` faces
  aft, `cap(…, false)` forward); a half-section is authored starboard,
  keel to crown, and `mirror`ed. A part wound the other way is invisible
  from outside and visible from inside — the sheet shows it as a hole.
- **Keep every three.js allocation out of the per-frame path.** The body is
  built once per craft per level; the renderer moves it. A material or a
  geometry created in the frame loop is a leak that shows as a stutter
  minutes in.
- **The mesh's origin is the CoG.** The physics pitches and rolls about the
  CoG; a mesh whose origin is the keel or the transom swings its bow
  through the water on every wave for nothing the physics did.
- **The rider reaches what is drawn.** `cockpitOf` reports the saddle's
  bucket, the grips and the footwells from the same `layout` the loft
  reads, and the rider's hands are solved onto those grips. Read the
  sheet's `helmet` column and his arms after any change to the hood, the
  column, the saddle, the wells or the pod: arms at full stretch at rest
  mean the grips have moved out of reach, and `tests/rider_test.ts` fails
  before the picture shows it.

### The cockpit is measured, not eyeballed

**The deck decides how the rider SITS.** A hunched, splay-legged rider is
almost never a stance number — it is a footwell level with the gunwale, a
saddle too low over it, or bars a metre ahead. So before touching `STANCE`,
measure the deck against the machine it is imitating. Every manufacturer
prints overall height; the rest is a tape measure on any PWC.

| Measure, from `cockpitOf` | A real runabout |
| --- | --- |
| saddle over the footwell floor | 0.47–0.56 m |
| keel to the footwell floor | 0.30–0.45 m |
| keel to the saddle | 0.85–1.00 m |
| keel to bar-top (the printed overall height) | 1.15–1.30 m |
| grips over the saddle | 0.30–0.40 m |
| grips ahead of the seating point | 0.50–0.68 m |
| boots apart (a stand-up's tray: 0.30–0.36) | 0.56–0.64 m |

The levers, in the order they bite: `shape.well` (the wells' depth — the
big one, and the only fix for knees up around the bars), `shape.pedestal`
(how far apart the boots must stand, hence the thighs' splay),
`shape.seatHeight` with the pedestal's top (the saddle's height),
`hoodStart`/`hoodTop` with `SEAT_AT` (how far ahead the bars are), and
`shape.column` (their height). The hull's own `length`, `beam`, `height`
and `deadrise` are the PHYSICS' and never move for a look — which is why a
craft whose deck still reads too tall after all of the above is a
`craft-tuning` conversation, not this skill's.

Two traps in the drawn section itself: the footwell floor must stay above
the chine or it pokes out through the topside (`wellFloorAt` clamps it,
and is the ONE line both the loft and `cockpitOf` read — the boots sink
into the deck the day they disagree); and the rail-plus-coaming stack sits
on top of the sheer, so it is the WALL a player sees — a stack as deep as
a hand turns a 3 m runabout into a small boat and its rider into a child.

## Adding a craft

A new craft is a row in `CRAFT` (load `craft-tuning`), a style in
`craft-styles.ts` reusing the built style with the new dimensions and
colours, and a `SCENE=rest` render at both viewports in the PR. Give it a
one-glance signature.

## What the change obliges elsewhere

- `make crafts` before and after, the picture and the table, in the PR;
  `make screenshots SCENE=rest` per craft touched; `SCENE=cruise` for
  anything that changes the silhouette; `make profile` for the draw calls.
- Nothing in `docs/` restates a style; the README's What names the four
  craft and their characters, which the look should match.
- A `.changes/unreleased/` fragment — the craft is what the player looks at
  for the whole run.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. What belongs here:
a proportion that reads wrong at chase range and right in elevation, a colour
that vanishes against foam, a part the builder was missing, a view the sheet
should add.
