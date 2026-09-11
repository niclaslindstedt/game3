---
name: water-look
description: "Use when working on how the SEA LOOKS — the water as DRAWN rather than as simulated: the grid of nested rings and the far grid that carry the engine's surface, how the surface is LIT per pixel (the sky each face mirrors, the shore in the water, the sun's glint, the wind's ripples, the rain's rings, the light through a crest, the foam and the whitecaps, the craft's lamp on the water), what a coast's water is MADE of (its tones, its window, its clarity, the bed it fades into), and how far a rider can see into it. Owns `pwa/src/game/water-mesh.ts`, `water-grid.ts`, `water-shader.ts`, `water-optics.ts` and `reflection.ts`, and the WATER row's ladder. Not what the surface IS doing (`water-feel` — `surfaceAt` is the engine's) and not the sky itself (`atmosphere`)."
---

# The water's look — the sea as drawn

The sea is the product's face. `water-feel` owns what the surface IS doing at
`(x, z, t)`; this skill owns everything between that answer and the pixel: the
lattice that samples it, the light that falls on it, the sky and the shore it
mirrors, the colour of the water body and how far into it the eye gets. The
one rule under all of it: **nothing here moves the surface.** A vertex is the
engine's own `surfaceAt`, and everything this skill does happens to the LIGHT.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
water-look --list`, then the ones the task touches. Load **`skill-reflection`**
at both ends of the session and **`write-code`** beside this one.

| Load beside this one | For |
| --- | --- |
| `water-feel` | the surface the grid samples — a wave that is too small is a `TUNING.sea` change, never a shader one |
| `atmosphere` | the sky the water reflects, and the one `Preset` every light here reads |
| `visual-effects` | the spray over the water and the wake's map the shader reads |
| `nature` | the bed the water is coloured over, the sea life seen through it |
| `game-feel` | whether the sea reads as drama at riding pace |

## The files, one direction of flow

| File | Owns |
| --- | --- |
| `pwa/src/game/water-grid.ts` | THE LATTICE: a fine core round the craft and nested square rings each of twice the cell, every ring dividing the coarsest, so snapping the grid's origin to the coarsest cell keeps every vertex on the world point it sampled last frame. `tests/water_grid_test.ts` holds the seams, the winding and the snap |
| `pwa/src/game/water-mesh.ts` | THE WATER, DRAWN: the near grid displaced by `surfaceAt` at the frame's `t`, only inside the lens's frustum; the FAR grid summing only the longest components, with a hole under the near one and sunk under it; the fade between them; the colour per vertex by depth off the coast's optics; the FOAM SHARE in the colour's alpha where a crest breaks or the shallows shoal, and WHITECAPS past `WHITECAP_WIND`; `seeThrough()` — how far a rider can see into the water, 0 when the window is closed |
| `pwa/src/game/water-shader.ts` | HOW THE WATER IS LIT, per pixel: the body under the two lights and the light through a crest, Schlick's Fresnel on the WAVE's normal against `skyAlong`, the shore's mirror laid over it, the rain's rings, ONE Beckmann glint lobe over Cox and Munk's slope variance, the ripple tile scrolled downwind and faded with distance, the lamp's pool, the foam's lace, the wake's map read per vertex and per pixel. `tests/water_shader_test.ts` holds the uniform contract |
| `pwa/src/game/water-optics.ts` | WHAT A COAST'S WATER IS MADE OF: three tones and the depths they run over, the surface's window, the flat unlit tone the bottom fades into, and `clarity` — the ONE depth scale the window, the bed's fade and the sea life's haze are written against. The app half of a biome row; `tests/water_optics_test.ts` holds the two lists to each other |
| `pwa/src/game/reflection.ts` | WHAT THE WATER MIRRORS BESIDES THE SKY: the scene drawn once a frame from the lens's mirror image in the water plane, Lengyel's oblique near plane so nothing under the surface is drawn, into a small texture the shader lays over the analytic sky wherever it has a picture. The WATER row's; OFF is no pass |
| `pwa/src/game/sky-glsl.ts` | `atmosphere`'s — but `mirrorBuild` is the rough-mirror build the water and the craft's gel coat are compiled with, and `seaMirror(preset)` the same question for the horizon ring's one grazing angle |
| `pwa/src/game/fx-textures.ts` | `visual-effects`'s — the foam tile and the ripple tile, made in code, and `TEXTURE_ANISOTROPY` |
| `pwa/src/game/settings-video.ts` | The WATER row: the grid's cell, its rings, the far reach, the ripple fade — the biggest CPU bill in the frame, and the rider's to spend. `tests/video_test.ts` reads the ladder |

## The judgement: LOOK, at the right cells

There is no bench for light. The review is the built app, and the trap is
that one shot of one sea at one hour says almost nothing:

```sh
make build
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=cruise      # the body and the mirror
make screenshots SCENE=swell                                                # the faces and the crests
make screenshots SCENE=storm ARGS="--hs 20"                                 # the foam and the whitecaps
make screenshots SCENE=cruise HOUR=20.5 WEATHER=clear                       # the glint's road, the lamp
make screenshots SCENE=cruise WEATHER=squall                                # the mirror under a lid
make screenshots SCENE=cruise ARGS="--see 0"  # beside --see 1: the window closed and open
make screenshots SCENE=wildlife                                             # into the water
```

Three habits, each of which found a fault five rounds of screenshots missed:

- **Shoot the same sea under two skies before touching a term.** A storm's
  "foam" was the squall's fog and the low sky mirrored on wave backs; one
  shot under `--weather clear` said so in a minute.
- **Zoom.** A 3× device-scale capture clipped to the stern or to a crest
  shows what a 1280 px frame hides (a road with no texture, a ripple tile in
  corduroy streaks). A scratch page over `scripts/lib/serve-dist.mjs` and
  `playwright-core` with `deviceScaleFactor: 3` and a `clip` is ten lines
  (`lab-tooling`).
- **Paint the raw channels.** When a map effect (the wake, the reflection)
  looks wrong, write its channels straight into the colour in a diagnostic
  build before touching a number — one shot says "empty" where five tuning
  rounds guess.

And ride it: a twitch at the grid's scale shows in no still. Reason from cell
size and pass time, then `npm run dev` and cross some chop.

`make profile` before and after anything that adds a pass, a sample or a
texture read — the grid is the dearest JavaScript in the frame and the shader
the dearest fill.

## Craft rules

- **What is drawn IS what is simulated.** Every vertex is `surfaceAt`; the
  wake's relief is the ONE thing added to it, and it is added on the CPU to
  the engine's own height with its slope folded into the wave's normal. A
  ripple, a bump or a "bigger wave" written in the shader is a hull floating
  above or buried in the picture. The ripples change the LIGHT and never the
  surface, so a probe reading the same water agrees.
- **Only nested power-of-two rings snapped to the coarsest cell stay still.**
  A grid whose cells stretch with distance swims with the craft however it
  snaps; a uniform grid at the core's cell is unaffordable. The rings are the
  answer and `water_grid_test.ts` holds the snap.
- **The far water carries only the long components.** It sums `surfaceAt`
  with the field's `count` cut to what its cells can carry, has a hole under
  the near grid and is sunk under it by more the bigger the chop it leaves
  out; the near grid's outer fifth fades to IT, never to flat.
- **Every absolute tilt threshold is tuned for a wind sea** — hold it against
  the sea's own characteristic tilt too, or a monster swell paints white from
  edge to edge.
- **Fresnel off the WAVE's normal, one glint lobe, no painted crest.** A rough
  surface's reflectance is the average over its slopes, which is smooth; a
  Fresnel read off the rippled normal flickers at a grazing angle. The glint
  is ONE Beckmann lobe whose variance is Cox and Munk's for the wind, the
  road and the sparkle at once, with the ripple tile carrying a share of it
  where the tile is resolved. A crest is read by what it REFLECTS.
- **The mirror is BLURRED, and it fades at the skyline.** The water's
  `skyAlong` is compiled with wider bands and fewer octaves (`mirrorBuild`);
  a reflected ray that dips under the skyline lands on the next wave's back,
  so it is mixed toward the body (`MIRROR_UNDER`), never handed the fog.
- **The shore in the water is a second pass, sky left OUT, cleared to alpha
  0.** The mirrored lens is the real one reflected through the WATER PLANE
  (position, aim and up), never through the origin — a virtual lens at
  (−x, y, −z) is a texture of nothing and no other visible error. The dome
  and the rain stay out of the pass (the sky is reflected analytically and
  blurred), alpha is what tells the shader where the picture is, and the
  cover is culled against the mirrored frustum too.
- **Most of the open sea's tone is the bed showing through it.** An opacity
  switch that only sets alpha to 1 hands back a pale, milky sea; closing the
  window dims the vertex colour by what the blend was worth (`CLOSED_BED`).
  And nothing hides the bottom by raising the surface's alpha: the bed fades
  into the coast's flat unlit `bed` tone over `clarity` (`terrain.ts`), the
  animals haze over the same scale (`fauna.ts`), and the window merely
  thickens over the same reach — one sea, not three settings.
- **Foam is lace, not paint, and prove the white is foam first.** The
  breaking term is gated to the CREST; the whitecap gate sits at a quarter to
  a half of Hs (Hs is four sigma, so a gate at 0.75·Hs caps nothing); judge
  the height against the sea HERE (`seaShares`), not the level's headline.
  The tile is read in wind space, stretched downwind, and the darkest holes
  stay open on the water at full share.
- **A tile seen along the water needs anisotropy.** The chase lens sits two
  metres up looking along the sea, so isotropic mips smear the ripple and
  foam tiles into streaks radiating from the lens; `TEXTURE_ANISOTROPY`
  (`fx-textures.ts`) is the fix and SwiftShader honours it, so the streaks
  show in a headless shot too.
- **Anything that displaces the grid is smooth at the grid's scale in space
  AND time.** The wake's relief is read off a blurred mip (`WAKE_RELIEF_LOD`)
  and given a rise time (`RELIEF_RISE`); a feature narrower than a few cells
  makes one vertex at a time jump, and a frame diff cannot see it.
- **Every uniform is read and every read has a uniform** — the shader test
  parses the GLSL against the material, and an array uniform slips past a
  regex written for scalars: the parser learns, not the shader.
- **Every shader ends with `#include <colorspace_fragment>`**, and the sky it
  reads is the preset's own: the glint dies behind a squall's ceiling, the
  lamp is off by day. The near grid and the far grid share one material, so
  every geometry that uses it has the same colour-attribute width.

## Adding things

- **A term in the light** (a new reflection, a new foam source): a uniform on
  the material AND a read in the GLSL (the test holds both), sourced from the
  `Preset` or a `CraftState` field, judged at two skies and zoomed.
- **A coast's water**: a row in `water-optics.ts` beside its `BIOMES` row —
  the tones, the ramp, the window, the bed and `clarity` — and nothing else;
  `terrain.ts` and `fauna.ts` read the same row.
- **A cost knob**: a column on the WATER row's ladder in `settings-video.ts`
  with `renderer.setVideo` the one place it becomes a draw call, and a case
  in `tests/video_test.ts`.

## What the change obliges elsewhere

- Screenshots at two skies and both viewports in the PR; `make profile`
  before and after.
- `npx vitest run tests/water_shader_test.ts tests/water_grid_test.ts
  tests/water_optics_test.ts tests/video_test.ts`.
- The water bullet in `docs/architecture.md`; a `.changes/unreleased/`
  fragment — the sea is what the player looks at.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment
here: a white that was not foam, a term that only read right zoomed, a
threshold that broke on a sea it was never tuned for.
