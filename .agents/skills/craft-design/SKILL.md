---
name: craft-design
description: "Use when designing or changing how a CRAFT LOOKS — its hull's silhouette, the deck, the seat, the handlebars, the sponsons, the colours. Owns the parametric low-poly builder (pwa/src/game/craft-body.ts), the per-craft styles (craft-styles.ts — one style built, the other three reusing it with their own dimensions and colours), and the render-compare-iterate loop: build, photograph at rest with `make screenshots SCENE=rest`, LOOK, refine, then verify at speed. A `make crafts` turntable is future; until it exists the rest scene is the contact sheet."
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
| `pwa/src/game/craft-body.ts` | The assembly line: the hull loft (a V-bottom from the deadrise, a bow, a transom, the gunwale line), the deck, the seat, the handlebars, the sponsons; writes flat vertex colour and a per-face normal, so a low-poly body reads as panels under the scene's light |
| `pwa/src/game/craft-styles.ts` | The styles — one `CraftBodySpec` per catalog id. **Pure data, no three.js import** (Node tooling loads it). ONE style is authored; the other three reuse it with their own dimensions and colours |
| `engine/game/defs/craft.ts` | NOT this skill's file — the physics row. The builder READS `length`, `beam`, `deadrise` and `cog` from it; a style never restates them |
| `pwa/src/game/renderer.ts` | Places the body from `CraftState` (`x, y, z`, the quaternion) — the mesh's origin is the CoG, so it pitches and rolls about the point the physics does |
| `pwa/src/game/rider.ts` | PLACEHOLDER: the rider model. Not this session's — the craft ships with no rider, and the seat and bars are sized for one |
| `pwa/src/game/scenarios.ts` | `rest` is the contact sheet for now: the craft afloat, still, beside the shore |
| `scripts/screenshot.mjs` | `make screenshots SCENE=rest CRAFT=<id>` photographs it, both viewports |
| `pwa/src/identity.ts` | The PALETTE the colours are drawn from — a style names a palette entry, never a hex |

## The loop: build → render → LOOK → iterate

1. **Render the current state**: `make build`, then
   `CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=rest
   CRAFT=skiff` (and each of the other three). The frames land in
   `previews/`; the landscape frame is the chase camera's view — the one
   that matters — and portrait shows the craft taller in the frame.
2. **Generate candidates, one axis at a time.** Clone the style, patch ONE
   thing (the bow's rake, the gunwale height, the seat's length, the
   sponson's flare, a colour), give the variant an id that says what
   changed, and render it. A sheet of one variant per axis reads as an
   A/B test; a variant that moved three things teaches nothing.
3. **LOOK — with the Read tool.** Judge the landscape frame at the chase
   camera's range first; only then the portrait.
4. **Fold the winner into `craft-styles.ts`, re-render.**
5. **Close at speed**: `make screenshots SCENE=cruise` and `SCENE=carve` —
   the contact sheet judges the sculpture; only the game proves the read at
   speed, in spray, rolled into a turn, against the water's palette.

**`make crafts` is the future contact sheet** — a turntable of every style
from the chase view and the elevations, with the physics' probe layout drawn
over the hull. Until it exists, `SCENE=rest` per craft is the sheet, and a
session that finds itself rendering all four repeatedly is the session that
should write the tool (`scripts/craft-preview.mjs`, over `serve-dist.mjs`),
then update this skill.

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
  The body is one geometry per style (hull + deck + seat + bars merged),
  drawn as one mesh, so a craft is a handful of draw calls. New parts go
  through the builder's helpers; per-facet brightness jitter keeps a
  big flat colour from reading plastic.
- **The builder reads the row; the style adds only what the row does not
  say.** Colours, the bow's rake, the seat's proportions, the bars' height,
  the sponsons' flare are style; length, beam, deadrise and the CoG are the
  row's. A style that restates a dimension drifts from the physics on the
  next catalog change.
- **Keep every three.js allocation out of the per-frame path.** The body is
  built once per craft per level; the renderer moves it. A material or a
  geometry created in the frame loop is a leak that shows as a stutter
  minutes in.
- **The mesh's origin is the CoG.** The physics pitches and rolls about the
  CoG; a mesh whose origin is the keel or the transom swings its bow
  through the water on every wave for nothing the physics did.
- **No rider yet, but room for one.** The seat is sized for the catalog's
  `riderHeight`, the bars stand where hands would be; when `rider.ts` is
  built it sits on this deck without the deck moving.

## Adding a craft

A new craft is a row in `CRAFT` (load `craft-tuning`), a style in
`craft-styles.ts` reusing the built style with the new dimensions and
colours, and a `SCENE=rest` render at both viewports in the PR. Give it a
one-glance signature.

## What the change obliges elsewhere

- `make screenshots SCENE=rest` per craft touched, in the PR, before and
  after; `SCENE=cruise` for anything that changes the silhouette.
- Nothing in `docs/` restates a style; the README's What names the four
  craft and their characters, which the look should match.
- A `.changes/unreleased/` fragment — the craft is what the player looks at
  for the whole run.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. What belongs here:
a proportion that reads wrong at chase range and right in elevation, a colour
that vanishes against foam, a part the builder was missing — and, when the
turntable tool gets written, the loop above rewritten around it.
