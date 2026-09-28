---
name: blender-assets
description: "Use when a craft or the rider is to be MODELLED IN BLENDER off the game's own data — or any other drawn thing when its kind is added — for studio renders, a real-time glTF with LODs, or the models the game draws. Owns `make blender` (`scripts/blender.mjs`, the registry of KINDS; the JSON each is handed is `pwa/src/game/model-data.ts`), the Blender shelf (`scripts/blender/lib.py`: the helpers, the studio on the water, the game-budget export) and each kind's builder (`scripts/blender/craft.py`, `rider.py`), the RIG every model carries and the clips baked into it (the game-side contracts `craft-rig.ts` and `rider-rig.ts`), the asset sheet that sets a model below the builder's own (`make crafts ARGS=--asset=…`), THE MODELS IN THE GAME (the `VITE_MODEL_CRAFTS` / `VITE_MODEL_RIDERS` build switches, `make models`, `make ci-models`, `pwa/models-plugin.ts`, the stamp in `pwa/models-stamp.ts`, `craft-models.ts`: packed, loaded, merged, dressed on the craft's own surface, posed in place of the code's drawn triangles), the frame a model is stated in and turned back from, the triangle budget and its LODs, and running Blender headless on Linux and macOS. Not the game's own builders (`craft-design`, `rider`) — though they are what every model is held against."
---

# Blender assets

The game draws its **crafts and its rider from the models made here** —
committed in `pwa/models/` by `make models` — and builds everything else
(and, one switch away, the crafts and the rider too) in code
(§ "The models in the game"). The code's builders (`craft-body.ts`,
`rider.ts`) stay the ground truth: every model is lofted off the SAME
numbers they draw from, so a model cannot drift from the physics, and the
code-built craft is what a model is judged against.

Three rules make that possible, and every step below serves one of them:

1. **A model is built off the game's data, never off numbers of its own.**
   `pwa/src/game/model-data.ts` is the JSON a builder is handed: a craft's
   spec, its style, and `craftLines` (`craft-body.ts`) — every station's
   cross-section off the physics' own station tables (the keel's rise, the
   plan's taper, the chine, the sheer, the rail, the coaming, the footwell,
   the pedestal, the crown), the saddle's rings, every fitting as the
   builder places it, the cockpit and the opening the sea is cut out of —
   and for the rider, his body, his pose, every bone's frame, the pieces
   the code draws him of (`figureParts`) and every clip sampled off
   `poseRider`. A hand-typed dimension in a builder is the drift this rules
   out; where the data says nothing (a sponson's rounding, a grab handle's
   bend), place it off something it does say.
2. **The lab's outputs are not committed; the game's models are.** Every
   render, `.blend` and LOD lands in the gitignored `previews/blender/`;
   only `make models` publishes the LOD0 of every craft and the rider into
   `pwa/models/`, with the stamp `tests/models_test.ts` holds to the tree.
3. **A model is judged beside the game's own**, through the game's own code
   (`make crafts ARGS=--asset=…` runs `craft-models.ts` in Node), and then in
   the built game (`make screenshots`, models on and off) — not only in a
   Blender studio, which flatters everything.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs blender-assets --list`. Load
`skill-reflection` at both ends, `lab-tooling` for any change to the driver
or the lab, and the skill that owns the asset's SUBJECT (`craft-design` for a
craft, `rider` for the rider) — its judging rules apply to a model too.

## Where everything lives

| Piece | Role |
| --- | --- |
| `scripts/blender.mjs` | THE DRIVER (`make blender`): `KINDS` (per kind: its ids and its data, both off `model-data.ts`; its builder; its default), finds Blender, runs each QUALITY, echoes what matters (`BONES`, `CLIPS`, `TRIANGLES`, what was saved, any traceback) and fails on a Python error |
| `pwa/src/game/model-data.ts` | WHAT BLENDER IS HANDED: `craftModelData(id)`, `riderModelData()` — the game's own numbers, read by the driver and by the stamp |
| `scripts/blender/lib.py` | THE SHELF every builder imports: the scene, `mat`, the geometry (`loft`, `superellipse`, `tube`, `cyl`, `box`, `ellipsoid`, `coil`, `catmull`, `resample`, boolean cutters), THE RIG (`rides`, `bone`, `marker`, `clip` — a `lift`/`turn`, `turns` about axes, or a whole `matrix` — `weights`, `morph`), and `finish()` — the rig built and skinned, the clips baked, the studio on the water, the Cycles stills, the join into one skinned mesh, LOD0 and the decimated LODs as glTF |
| `scripts/blender/craft.py` | THE CRAFT BUILDER: the shell (keel, strakes, chine, topside, sheer) and the deck (coaming, footwells, pedestal, hood, crown) as two creased subdivided cages through the code's own stations, the rubber rail, the saddle, the grab handle, the platform's bumper and step, the sponsons, the pump, the ride plate and the grate, the nozzle and the reverse gate, the pod, the column, the bars and grips, the mirrors |
| `scripts/blender/rider.py` | THE RIDER BUILDER: one SKIN that bends (the ANSUR II survey's mean man at the game's `RIDER_SCALE`, in a runabout racer's kit, lofted a piece a bone, remeshed, coloured along planes, weighted across each joint) and rigid parts on one bone each — the helmet lofted through the code's own shell rings in its livery, the chin bar and the peak, the vest's straps laid on the skin, the knee pads, the boots, the gloves |
| `pwa/src/game/craft-rig.ts` | THE CRAFT'S CONTRACT: `BAR_TURN` / `BUCKET_SWING` (handed to Blender, so the clips run the same travel), `barTurn(craft)`, `turnGrips` (the rider's hands turned with the bars, each arm solved back to its shoulder), `rigCraft` (the `bars`, `nozzle` and `bucket` drivers posed off `CraftState`, each about the axis the builder wrote into the bone's extras, in the BODY frame) |
| `pwa/src/game/rider-rig.ts` | THE RIDER'S CONTRACT: `riderBones(pose)` (every bone's frame off a `RiderPose` — the game's own spans, each limb ROLLED TO ITS BEND: +z where the knee or the elbow points), `RIDING` (the pose he is bound in: the skiff, half throttle), `riderClips()` (every clip SAMPLED off `poseRider`), `rigRider` (a loaded model's bones set to a pose, or a clip played) |
| `pwa/src/game/craft-models.ts` | THE MODELS IN THE GAME: `MODELS` (the switches), `loadModels`, `dressOf`, `hangCraft` / `cloneCraft` / `poseCraft`, `onTheBars`, `hangRider`, and `adoptModels` (the lab's way in) |
| `pwa/models-plugin.ts`, `pwa/models-stamp.ts`, `scripts/models.mjs` | THE PACKING AND THE STAMP: which files a build emits (and the error naming `make models` when one is missing), the hash of the builders and of every model's data, the publisher |
| `scripts/craft-preview.mjs` | THE ASSET SHEET (`make crafts ARGS="--asset=a.glb,b.glb --rider=r.glb --steer=0.8"`): the builder's craft in the first row, each model below it, every one ridden by the code's rider (or the modelled one), side, bow, stern, plan and chase, with the waterline and the probes over it → `previews/crafts-asset-<id>.png` |
| `previews/blender/` | Everything made: `<id>.json` (what Blender was handed), `<id>-render-<view>.png`, `<id>-game-*.png`, `<id>-lod{0,1,2}.glb`, `<id>-{render,game}.blend` |

## The loop

1. **Look at what the game draws first**: `make crafts` (or `CRAFT=dart`).
   That is the bar a model has to clear.
2. **References — locally, if any.** A studio side profile of a real
   runabout or stand-up of the class goes in the session's scratchpad ONLY:
   never under the tree, never in an artifact, never named — not the maker,
   not the model, not in a file name (`AGENTS.md`: NAME NO REAL PRODUCT).
3. **Iterate fast in render quality**, one or two views, few samples:
   `make blender ID=skiff ARGS="--quality=render --views=three,chase --samples=16"`
   — about a minute a pass on four CPU cores (the rider half that). READ the
   pictures. Silhouette first (the side), then the chase view, then detail.
4. **Then the budget**: `make blender ID=skiff ARGS="--quality=game --views=none"`
   — the parts joined into one skinned mesh on the rig, the clips baked,
   LOD0 and two LODs exported, every count printed (~15 s a craft).
5. **Then the asset sheet**: `make crafts ARGS="--asset=previews/blender/skiff-lod0.glb,previews/blender/skiff-lod2.glb --rider=previews/blender/rider-lod0.glb"`.
   The chase view is the verdict, as it is for the builder's craft
   (`craft-design`). `--steer=0.8` checks the rig: the bars and the nozzle
   turned, the rider's hands on the grips.
6. **Then the game**: `make models`, `make build`, `make screenshots`
   against a `VITE_MODEL_CRAFTS=0 VITE_MODEL_RIDERS=0 make build`, and
   `make profile` before and after. Report both with the pictures and the
   triangle table.

## The frame

A builder states its asset in the craft's BODY frame (x right, y up, z
forward, the origin at the centre of gravity) laid as Blender's
`(-x, z, y)` — a turn, not a mirror (`B()` in both builders) — so it faces
+y. glTF export turns Blender's z-up to y-up with forward on −z; the game
turns it back with ONE half turn about y (`craft-models.ts`), and the model
then stands in the body frame exactly, on the same origin as the code's
hull and figure. Never bake a turn into a model. The rider's sides are the
ENGINE's (`_l` is the pose's index 0, x negative in the body frame).

## Modelling craft (what the craft and the rider taught)

- **Panels are a CAGE under a subdivision surface, with creases.** The
  shell's section is the code's keel, two strakes on the V, the chine and
  its flat, the topside and the sheer; the deck's is the coaming, the
  footwell, the pedestal and the crown — each lofted through the code's own
  stations (every station `craftLines` hands in, plus the two where the
  pedestal's back wall steps), subdivided, the chine and the keel creased
  hard. The cage is the low-poly base the game budget subdivides once.
- **Paint follows the cage's bands**, assigned per cage FACE, so every
  colour edge runs along a crease after subdivision.
- **Colour on a skinned body stops on a PLANE**: cut the mesh along it
  (`bmesh.ops.bisect_plane`) before colouring by face — the vest's hem and
  its band square to the spine, each arm's cap square to the upper arm, the
  lap square to each thigh, the back panel's two edges as half-planes
  through the spine's own line. Colouring by nearest bone alone leaves a
  ragged edge wherever two bones' regions meet.
- **Nearest-bone lies near a joint.** A point on the chest can be nearer an
  upper arm than the spine; a rule "past the cap's plane is the arm" then
  paints a hole of skin in the vest. Ask how far along the bone the point
  projects and how far off it it is, not only which bone is nearest.
- **What must read as its own thing is its own piece.** The neck as a part
  of the remeshed skin gave a stair of faces at the collar; the neck as a
  piece of its own makes the collar an edge where two surfaces meet.
- **A shrinkwrap modifier left a ribbon where it started** (inside the vest,
  for no reason found). Laying a strap ON a surface is done by hand:
  `closest_point_on_mesh` for every point of the ribbon, stood off along the
  surface's own normal, then solidified about its middle.
- **The physics' lines are the hull's; the moulding's paint is the model's.**
  The code's hull is a tall white wall with a thin deck on top — it reads
  as a dinghy from behind. What made the model read as a runabout, on the
  SAME lines: the deck's colour brought down over the top of the flank to a
  SPLIT with a stepped rubber lip (and the rubber rail moved there), the
  gunwale rolled over the rail in a rounded bolster, the platform matted,
  the transom closed in the flanks' two colours with the lip across it, and
  the bow's flat last station pinched to a stem.
- **Every part is data-driven or class-proportional**, so one builder models
  all four: the stand-up got its tray and its short pad, the runabouts their
  saddles, grab handles and mirrors, with no class-specific code.

## The budget

Measured (Blender 5.2, Linux): render quality ~79k triangles a craft, ~205k
the rider (the 6 mm remesh). Game quality: a runabout **LOD0 ≈ 14.4k**
(the body ~13.2k, the bars 0.6k, the gate 0.4k, the nozzle 0.1k), **LOD1 ≈
5.0k**, **LOD2 ≈ 1.4k**; the stand-up 13.4k / 4.7k / 1.3k; the rider **LOD0 ≈
9.3k** (the skin decimated to ~3.6k, the helmet's shell 0.7k, boots, pads
and gloves the rest), LOD1 3.3k, LOD2 0.9k. Files: a craft ~0.67 MB, the
rider ~0.53 MB. The lower LODs are a blind decimation — fine at range, torn
up close — and are packed by nothing yet.

## The rig and the clips

- **Every part rides ONE bone, rigidly** (`rides(name)` before making the
  parts); the rider's skin alone is weighted across its joints
  (`weights(ob, fn)`: shared between the nearest bone and its neighbours by
  how much nearer each is, 4 cm apart half against a third).
- **DRIVERS** are the bones the game sets off the engine: the craft's
  `bars` (about the column), `nozzle` (its steer about the hull's up, its
  trim about the right) and `bucket` (the reverse gate). The axis rides in
  the bone's extras in the BODY frame, signed as the engine's reading is;
  `craft-rig.ts` turns each about its own head by `barTurn`, `nozzle`,
  `trim` and `bucket × BUCKET_SWING`.
- **The rider has no clips of his own in the game**: `poseRider` places
  every joint and `riderBones` turns that into bone frames, so a model is
  posed by the very arithmetic the code's figure is. His clips (`ride`,
  `turn`, `lean`, `tuck`, `stand`, `air`, `haul`) are that arithmetic
  SAMPLED in Node and handed to Blender as every bone's matrix at every
  frame. Nothing about how he moves is written in Python.
- **Bones are rolled to the bend.** A limb's two bones take +z from where
  its middle joint points (knee − the mid of hip and ankle, leaning on a
  bias so a straight limb keeps a roll): a hint fixed in the body frame
  flips a bone half a turn the day a limb crosses it, and a skinned arm
  twists like a sweet wrapper.
- **Traps met.** An NLA track left unmuted PLAYS under the next clip's bake
  — mute each as it is laid (lib.py does). A three.js action set to its
  full length wraps to frame 0 — `LoopOnce` with `clampWhenFinished`. A
  joined mesh takes its data name from the active part — name both.

## The models in the game

Every build draws them — local, CI, the site's slots, a release, the
desktop and store apps — unless SWITCHED BACK: `VITE_MODEL_CRAFTS=0` (the
code-built crafts) and/or `VITE_MODEL_RIDERS=0` (the code-built rider), in
the environment or the root `.env`; unset, empty or anything else is on
(`model-switch.ts`). Every workflow hands its build the repository SECRETS
of the same names (this repository keeps no Actions variables), so `make
ci-models MODELS=off` switches every CI build back with no commit.

- **Committed, stamped, drift-tested.** `make models` makes every craft and
  the rider at game quality (no stills, ~1.5 min) and `scripts/models.mjs`
  publishes their LOD0s into `pwa/models/<id>.glb` / `rider.glb` with
  `sources.json`: `modelStamp` (`pwa/models-stamp.ts`) — the builders' text
  and every model's DATA (`model-data.ts`), hashed at a hundredth of a
  millimetre. So a change to a builder, a station table, a style's colour
  or the rider's pose fails `tests/models_test.ts` until `make models` is
  run and `pwa/models/` committed with it, and a change to nothing a model
  reads (a sea-state number in `TUNING`) fails nothing. CI needs no Blender.
- **Packed by the build.** `pwa/models-plugin.ts` emits them as
  `models/<id>.glb` and `models/rider.glb` into the bundle (before `appPwa`,
  so the worker precaches them) and serves them the same way in dev; a
  build whose model is missing FAILS, naming `make models`. `envDir` is the
  repository root.
- **Fetched before anything is built.** `loadModels()` runs before the
  renderer's kit is handed out (`App.tsx`) and before the craft card's
  turntable builds (`craft-picker.tsx`) — a builder that ran first would
  draw the code's craft.
- **Merged into ONE draw, on the craft's own surface.** A glTF comes out a
  primitive a material; `prepare` merges them into one skinned mesh whose
  vertices carry the dress (`color` in the style's colour, `aShine` in the
  field's `FINISH`), drawn with `smoothOf(surface)` — the code's craft
  surface compiled without flat shading, on the same sky uniforms — so the
  gel coat reflects the same sky, the finishes read the same and a ghost's
  see-through carries over. `prepare` works on a COPY of the loaded scene:
  merging in place left the second preparation of the same glTF one mesh
  painted in its first material.
- **The code craft is still built and still the craft.** `hangCraft` hangs
  the model under the group `buildCraft` made and COLLAPSES the code's hull
  (an empty draw range); the lamps, the camera's deck (`deckOf`), the sea's
  cut (`wellCutOf`) and every reader of the group go on as they were. The
  rider's model hangs under the code figure's mesh (`hangRider`, in
  `createRider`), which is collapsed and no longer re-emitted — the model's
  bones take the pose the figure would have been drawn in, so the model is
  CHEAPER on the CPU than the figure it replaces. Rivals are copied with
  `cloneCraft` (a skinned mesh `clone`d still drives the pristine one's
  bones), and a model's geometry is shared (`userData.shared`: nothing that
  tears a craft down disposes it).
- **Posed every frame off the same readings**: `poseCraft` (the bars with
  the nozzle, the trim, the gate) where the renderer poses each hull, and
  `onTheBars` in the rider's `update` — the hands turned with the modelled
  bars, which the code's bars never are.
- **Dressed by NAME.** `dressOf` maps each material's name (as the builders
  name them — `tests/models_test.ts` reads them as text) to a `CraftStyle`
  field (`hull`, `topside`, `rail`, `deck`, `seat`, `seatTop`, `tray`,
  `bar`, `grip`), a moulding (`trim` in the rail's colour, `moulding` in the
  grip's), the pod's `glass`, or a key of the rider's `PAINT`.

## Blender, headless

- **Linux**: the release tarball (SHA-256 checked), on the PATH or
  `BLENDER=`. Cycles runs on the CPU (four cores: keep stills to 16–24
  samples and one or two views). There is no EGL in a bare container, so
  EEVEE and Workbench do not start: a quick debug still is Cycles at a few
  samples and a small resolution.
- **macOS** (the sibling snowmobile game's notes, unchanged): copy the app
  out of the DMG with `ditto`; an app copied without its files' times
  carries stale bytecode and Blender sits at 0 % CPU for ever — the driver
  runs it with `PYTHONDONTWRITEBYTECODE=1` AND `--python-use-system-env`.
  Cycles on Metal works headless; the first render compiles kernels for
  minutes.
- **A Python error exits 0** unless Blender is given `--python-exit-code 1`;
  the driver passes it.
- **API traps (5.x):** `use_nodes` is deprecated (set it in a `try`);
  Principled inputs are `Coat Weight`, `Transmission Weight`, `Emission
  Color`; creases are the `crease_edge` float attribute;
  `bmesh.ops.create_cone` takes `radius1`/`radius2`; curve objects must be
  converted to meshes before a join or an export; no SHEEN on anything
  exported (three draws the extension as a pale bloom).

## Adding a kind

1. **The data**: a function in `model-data.ts` returning the game's OWN
   tables for one (imported, never restated), a row in `KINDS` in
   `scripts/blender.mjs`, and the data added to `modelStamp`.
2. **The builder**, `scripts/blender/<kind>.py`: `from lib import *`, its
   frame stated in its header, `rides()` / `bone()` for the rig, `clip()`
   for what it plays, `finish(name, OUT, SAMPLES, centre, size)` at the end,
   every material named for what the game dresses it as.
3. **The game**: its file in `modelFiles`, its load and its hang in
   `craft-models.ts` (or a sibling), a case in `tests/models_test.ts`.
4. **The lab**: the kind's own lab owes an asset view like the craft
   sheet's, the turn back into the game's frame in the lab, not the model.
   Update this skill's table and the README's `make blender` row.

## Skill self-improvement

Load **`skill-reflection`** before a session that used this skill commits.
What belongs here: a Blender or glTF trap met, a budget measured, a
modelling move that made a class read (or failed to), a kind added.
