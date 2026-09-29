---
name: blender-assets
description: "Use when a game asset is to be MODELLED IN BLENDER off the game's own data — the crafts, the rider and every kind of tree today; an animal or any other drawn thing when its kind is added — for studio renders, a real-time glTF with LODs, or the models the game draws. Owns `make blender` (`scripts/blender.mjs`, the registry of KINDS; the JSON each is handed is `pwa/src/game/model-data.ts`), the Blender shelf (`scripts/blender/lib.py`: the helpers, the studio on the water, the game-budget export) and each kind's builder (`scripts/blender/craft.py`, `rider.py`, `tree.py`), the RIG every craft and rider carries and the clips baked into it (the game-side contracts `craft-rig.ts` and `rider-rig.ts`), the asset sheet that sets a model below the builder's own (`make crafts ARGS=--asset=…`) and the flora lab's compare sheet (`make flora ARGS=\"--models --compare\"`), THE MODELS IN THE GAME (the `VITE_MODEL_CRAFTS` / `VITE_MODEL_RIDERS` / `VITE_MODEL_TREES` build switches, `make models`, `make ci-models`, `pwa/models-plugin.ts`, the stamps in `pwa/models-stamp.ts`, `craft-models.ts` and `tree-models.ts`, the meshopt packer `scripts/lib/glb-pack.mjs`: packed, loaded, merged, dressed, posed or planted in place of the code's drawn triangles), the frame a model is stated in and turned back from, the triangle budget and its LODs and bands, and running Blender headless on Linux and macOS. Not the game's own builders (`craft-design`, `rider`, `nature`'s `flora-shapes.ts`) — though they are what every model is held against."
---

# Blender assets

The game draws its **crafts, its rider and its trees from the models made
here** — committed in `pwa/models/` by `make models` — and builds everything
else (and, one switch away, the crafts, the rider and the trees too) in code
(§ "The models in the game"). The code's builders (`craft-body.ts`,
`rider.ts`, `flora-shapes.ts`) stay the ground truth: every model is made off
the SAME numbers they draw from, so a model cannot drift from the physics or
from the roster, and the code-built thing is what a model is judged against.

This is the sibling snowmobile game's skill and shelf, adopted: the same
loop, the same frame rule, the same tree pipeline (variants as data, roles
and tones instead of colours, a hand-built far sketch, meshopt packing, a
stamp of its own), retyped for a coast — a craft is a hull on the water, the
rider sits a saddle, a tree is a kind of the shore's cover.

Three rules make that possible, and every step below serves one of them:

1. **A model is built off the game's data, never off numbers of its own.**
   `pwa/src/game/model-data.ts` is the JSON a builder is handed: a craft's
   spec, its style, and `craftLines` (`craft-body.ts`) — every station's
   cross-section off the physics' own station tables, the saddle's rings,
   every fitting as the builder places it, the cockpit and the opening the
   sea is cut out of; for the rider, his body, his pose, every bone's frame,
   the pieces the code draws him of (`figureParts`) and every clip sampled
   off `poseRider`; for a tree, its row of the roster (`flora-defs.ts`), the
   proportions the code draws its FORM with (`TREE_SHAPE`), its six variants
   (`tree-variants.ts`) and each one's silhouette sampled off `crownAt`. A
   hand-typed dimension in a builder is the drift this rules out; where the
   data says nothing (a sponson's rounding, a leaflet's width), place it off
   something it does say.
2. **The lab's outputs are not committed; the game's models are.** Every
   render, `.blend` and LOD lands in the gitignored `previews/blender/`;
   only `make models` publishes — the LOD0 of every craft and the rider, and
   every kind of tree packed — into `pwa/models/`, with the stamps
   `tests/models_test.ts` holds to the tree.
3. **A model is judged beside the game's own**, through the game's own code
   (`make crafts ARGS=--asset=…` runs `craft-models.ts` in Node; `make flora
   ARGS="--models --compare"` draws `tree-models.ts` beside `flora-shapes.ts`
   in three.js), and then in the built game (`make screenshots`, models on
   and off) — not only in a Blender studio, which flatters everything and,
   for a two-faced leaf, lies (§ "The trees").

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons blender-assets --list`. Load `skill-reflection` at
both ends, `lab-tooling` for any change to the driver or a lab, and the skill
that owns the asset's SUBJECT (`craft-design` for a craft, `rider` for the
rider, `nature` for a tree) — its judging rules apply to a model too.

## Where everything lives

| Piece | Role |
| --- | --- |
| `scripts/blender.mjs` | THE DRIVER (`make blender`): `KINDS` (per kind: its ids and its data, both off `model-data.ts`; its builder; its default), finds Blender, runs each QUALITY, echoes what matters (`BONES`, `CLIPS`, `TRIANGLES`, what was saved, any traceback) and fails on a Python error |
| `pwa/src/game/model-data.ts` | WHAT BLENDER IS HANDED: `craftModelData(id)`, `riderModelData()`, `treeModelData(kind)` (no colour — the stamp is taken over it) and `treeStillPaint(kind)` (the row's colours in linear light, for the stills only) — the game's own numbers, read by the driver and by the stamps |
| `scripts/blender/lib.py` | THE SHELF every builder imports: the scene, `mat`, the geometry (`loft`, `superellipse`, `tube`, `cyl`, `box`, `ellipsoid`, `coil`, `catmull`, `resample`, boolean cutters), THE RIG (`rides`, `bone`, `marker`, `clip` — a `lift`/`turn`, `turns` about axes, or a whole `matrix` — `weights`, `morph`), and `finish()` — the rig built and skinned, the clips baked, the studio on the water, the Cycles stills, the join into one skinned mesh, LOD0 and the decimated LODs as glTF. The sibling's shelf, plus `turns`, CPU-unless-macOS Cycles and the sea studio |
| `scripts/blender/craft.py` | THE CRAFT BUILDER: the shell (keel, strakes, chine, topside, sheer) and the deck (coaming, footwells, pedestal, hood, crown) as two creased subdivided cages through the code's own stations, the rubber rail, the saddle, the grab handle, the platform, the sponsons, the pump, the ride plate, the nozzle and the reverse gate, the pod, the column, the bars and grips, the mirrors |
| `scripts/blender/rider.py` | THE RIDER BUILDER: one SKIN that bends (the ANSUR II survey's mean man at the game's `RIDER_SCALE`, in a runabout racer's kit, lofted a piece a bone, remeshed, coloured along planes, weighted across each joint) and rigid parts on one bone each — the helmet lofted through the code's own shell rings, the chin bar and the peak, the vest's straps, the knee pads, the boots, the gloves |
| `scripts/blender/tree.py` | THE TREE BUILDER (`KIND=tree`, `ID=<kind>` or `all`): a kind's six variants off their own rows, each a whole tree and a far sketch, one glTF a kind; no rig — the shore instances it (§ "The trees") |
| `pwa/src/game/tree-variants.ts` | THE TREES AS DATA (three-free): `TREE_KINDS` (every tree-form row), `TREE_SHAPE` (the code's form proportions, which `flora-shapes.ts` reads), `TREE_VARIANTS`, `crownAt`, `variantAt`, `TREE_REFERENCE` |
| `pwa/src/game/tree-models.ts`, `scripts/lib/glb-pack.mjs` | THE TREES IN THE GAME: a kind's model read into the unit frame and dressed in its row's colours (`treeModel`, `roleColours`), and the packer every published tree goes through (quantized, meshopt) |
| `pwa/src/game/craft-rig.ts` | THE CRAFT'S CONTRACT: `BAR_TURN` / `BUCKET_SWING` (handed to Blender, so the clips run the same travel), `barTurn(craft)`, `turnGrips`, `rigCraft` (the `bars`, `nozzle` and `bucket` drivers posed off `CraftState`, each about the axis the builder wrote into the bone's extras, in the BODY frame) |
| `pwa/src/game/rider-rig.ts` | THE RIDER'S CONTRACT: `riderBones(pose)` (every bone's frame off a `RiderPose`, each limb ROLLED TO ITS BEND), `RIDING` (the pose he is bound in), `riderClips()` (every clip SAMPLED off `poseRider`), `rigRider` |
| `pwa/src/game/craft-models.ts` | THE CRAFTS AND THE RIDER IN THE GAME: `MODELS` (the switches), `loadModels`, `dressOf`, `hangCraft` / `cloneCraft` / `poseCraft`, `onTheBars`, `hangRider`, and `adoptModels` (the lab's way in) |
| `pwa/models-plugin.ts`, `pwa/models-stamp.ts`, `scripts/models.mjs` | THE PACKING AND THE STAMPS: which files a build emits (and the error naming `make models` when one is missing), the hash of the builders and of every model's data — the crafts' and rider's (`modelStamp`) and the trees' apart (`treeStamp`) — and the publisher (`--set=machines|trees`) |
| `scripts/craft-preview.mjs` | THE ASSET SHEET (`make crafts ARGS="--asset=a.glb,b.glb --rider=r.glb --steer=0.8"`): the builder's craft in the first row, each model below it, every one ridden by the code's rider (or the modelled one) → `previews/crafts-asset-<id>.png` |
| `scripts/flora-preview.mjs` + `pwa/src/tools/flora-preview.ts` | THE TREE SHEETS: `make flora ARGS=--models` (the roster with every tree drawn off its model), `ARGS="--models --from=previews/blender --compare"` (a row a kind: the code's tree, six variants, two sketches, triangles under each) → `previews/flora-compare-<biome>.png` |
| `previews/blender/` | Everything made: `<id>.json` (what Blender was handed), `<id>-render-<view>.png`, `<id>-game-*.png`, `<id>-lod{0,1,2}.glb` (a tree: `<kind>.glb`), `<id>-{render,game}.blend` |

## The loop

1. **Look at what the game draws first**: `make crafts` (or `CRAFT=dart`),
   `make flora BIOME=…`. That is the bar a model has to clear.
2. **References — locally, if any.** A studio side profile of a real
   runabout, a photograph of a stand of the species, go in the session's
   scratchpad ONLY: never under the tree, never in an artifact, never named —
   not the maker, not the model, not in a file name (`AGENTS.md`: NAME NO
   REAL PRODUCT).
3. **Iterate fast in render quality**, one or two views, few samples:
   `make blender ID=skiff ARGS="--quality=render --views=three,chase --samples=16"`
   — about a minute a pass on four CPU cores (the rider half that; a tree's
   `--views=row` ten seconds). READ the pictures. Silhouette first (the side),
   then the chase view, then detail.
4. **Then the budget**: `make blender ID=skiff ARGS="--quality=game --views=none"`
   — the parts joined into one skinned mesh on the rig, the clips baked,
   LOD0 and two LODs exported, every count printed (~15 s a craft; every tree
   kind `KIND=tree ID=all`, ~1 s each).
5. **Then the game's lab**: the craft sheet, `make crafts ARGS="--asset=previews/blender/skiff-lod0.glb,previews/blender/skiff-lod2.glb --rider=previews/blender/rider-lod0.glb"`
   (the chase view is the verdict, `--steer=0.8` checks the rig), or the tree
   sheet, `make flora ARGS="--models --from=previews/blender --compare" BIOME=taiga`.
6. **Then the game**: `make models`, `make build`, `make screenshots
   ARGS="--mode free"` against a `VITE_MODEL_CRAFTS=0 VITE_MODEL_RIDERS=0
   VITE_MODEL_TREES=0 make build` (the switch of the subject alone), on the
   coasts the subject grows on, and `make profile ARGS="--biome …"` before
   and after. Report both with the pictures and the triangle table.

## The frame

A builder states its asset in the frame the game's data is in, and nothing
else. A craft or the rider is stated in the craft's BODY frame (x right, y
up, z forward, the origin at the centre of gravity) laid as Blender's
`(-x, z, y)` — a turn, not a mirror (`B()` in both builders) — so it faces
+y. glTF export turns Blender's z-up to y-up with forward on −z; the game
turns it back with ONE half turn about y (`craft-models.ts`), and the model
then stands in the body frame exactly, on the same origin as the code's hull
and figure. The rider's sides are the ENGINE's (`_l` is the pose's index 0,
x negative in the body frame). A tree is stated in metres at
`TREE_REFERENCE` tall, z up from its foot, leaning to +x; `tree-models.ts`
divides the reference height out of all three axes into the unit frame the
code's builder draws in. Never bake a turn into a model.

## Modelling craft (what the craft, the rider and the trees taught)

- **Panels are a CAGE under a subdivision surface, with creases.** The
  shell's section is the code's keel, two strakes on the V, the chine and
  its flat, the topside and the sheer; the deck's is the coaming, the
  footwell, the pedestal and the crown — each lofted through the code's own
  stations, subdivided, the chine and the keel creased hard. The cage is the
  low-poly base the game budget subdivides once.
- **Paint follows the cage's bands**, assigned per cage FACE, so every
  colour edge runs along a crease after subdivision.
- **The physics' lines are the hull's; the moulding's paint is the model's.**
  The code's hull is a tall white wall with a thin deck on top — it reads as
  a dinghy from behind. What made the model read as a runabout, on the SAME
  lines: the deck's colour brought down over the top of the flank to a SPLIT
  with a stepped rubber lip, the gunwale rolled over the rail, the platform
  matted, the transom closed in the flanks' two colours, and the bow's flat
  last station pinched to a stem.
- **Every part is data-driven or class-proportional**, so one builder models
  all four: the stand-up got its tray and its short pad, the runabouts their
  saddles, grab handles and mirrors, with no class-specific code.
- **What must read as its own thing is its own piece** (the rider's neck); a
  strap is laid ON a surface by hand (`closest_point_on_mesh`, stood off
  along the normal), not by a shrinkwrap, which left a ribbon where it began.

## The budget

Measured (Blender 5.2, Linux): render quality ~79k triangles a craft, ~205k
the rider (the 6 mm remesh). Game quality: a runabout **LOD0 ≈ 14.4k**
(the body ~13.2k, the bars 0.6k, the gate 0.4k, the nozzle 0.1k), **LOD1 ≈
5.0k**, **LOD2 ≈ 1.4k**; the stand-up 13.4k / 4.7k / 1.3k; the rider **LOD0 ≈
9.3k**, LOD1 3.3k, LOD2 0.9k. Files: a craft ~0.67 MB, the rider ~0.53 MB.
The lower LODs are a blind decimation — fine at range, torn up close — and
are packed by nothing yet. The trees' budget is theirs (§ "The trees").

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
- **Traps met.** An NLA track left unmuted PLAYS under the next clip's bake
  — mute each as it is laid (lib.py does). A three.js action set to its
  full length wraps to frame 0 — `LoopOnce` with `clampWhenFinished`. A
  joined mesh takes its data name from the active part — name both.

## The rider

The rider has no clips of his own in the game: `poseRider` places every
joint and `riderBones` turns that into bone frames, so a model is posed by
the very arithmetic the code's figure is. His clips (`ride`, `turn`, `lean`,
`tuck`, `stand`, `air`, `haul`) are that arithmetic SAMPLED in Node and
handed to Blender as every bone's matrix at every frame. Nothing about how he
moves is written in Python.

- **Bones are rolled to the bend.** A limb's two bones take +z from where
  its middle joint points (knee − the mid of hip and ankle, leaning on a
  bias so a straight limb keeps a roll): a hint fixed in the body frame
  flips a bone half a turn the day a limb crosses it.
- **Colour on a skinned body stops on a PLANE**: cut the mesh along it
  (`bmesh.ops.bisect_plane`) before colouring by face — the vest's hem and
  its band square to the spine, each arm's cap square to the upper arm, the
  lap square to each thigh. Colouring by nearest bone alone leaves a ragged
  edge, and nearest-bone lies near a joint (a point on the chest can be
  nearer an upper arm than the spine): ask how far along the bone the point
  projects and how far off it it is.
- **No sheen on anything exported**: three draws the extension as a pale
  bloom.

## The trees

`KIND=tree`, `ID=<kind>` (or `all`): ONE glTF a kind, every variant twice —
`v<i>` (the whole tree) and `v<i>_far`, a HAND-BUILT sketch (three skirts, a
few pads, a core and three clusters, one strip a frond; a decimation shreds a
crown of separate pieces). ~1 s a kind at game quality.

- **Which rows are trees.** Every row of the cover roster whose form is
  `pine`, `spire`, `broadleaf`, `palm` or `mangrove` (`TREE_FORMS`) — the
  taiga's alder, birch, aspen, rowan, pine and spruce; the mangrove's red and
  black mangrove, coconut, cabbage palm, live oak and slash pine; the karst's
  holm oak, olive, cypress and coastal pine. The arctic grows none. A
  `bush` (a willow, a juniper, the maquis, the moss mat), a `tuft`, a `reed`
  and a `stone` stay the code's: one builder for a heather mat and a myrtle,
  and thousands more of them than of the trees.
- **The numbers are the code's.** `TREE_SHAPE` is every proportion
  `flora-shapes.ts` draws a tree form with, lifted out of it — the code reads
  it from there, byte for byte the geometry it drew before — and `crownAt`
  is the silhouette it makes, sampled into the JSON as `profile`, which the
  builder sizes boughs, pads and clusters to. A variant row is a DEPARTURE
  from its species' look (a share of its spread, its bare trunk or stems
  where it says), never a restatement; variant 0 is the row's own tree.
  Where the sibling snowmobile game models the same kind (the spruce, the
  pine, the birch, the aspen, the rowan, the alder) its rows are the start,
  the snow left off and the leaves put back.
- **No colour in the file.** A face is a ROLE (`leaf`, `bark`, `twig`,
  `mark` — its material's name, `ROLES` in `tree.py`, read by the suite); a
  vertex's `tone` is a SHADE and a BLEND between the role's two colours.
  `treeModel` dresses it in the kind's own row (`roleColours`: the foliage
  lit to dark, the bark to its upper reach — a Scots pine's copper — a twig
  from bark to the leaf's dark, a birch's `stemMark`).
- **Volume normals** on all foliage (out of the crown and up), so a crown of
  pieces is lit as one mass. A two-faced leaf (a frond, a fan) gives its
  up-facing face a normal out and up and its down-facing face one out and
  only a little up — never down, or a crown seen from under goes black. The
  down face against its geometric normal is black in a CYCLES still and fine
  in three.js: judge a palm in the flora sheet, not the studio.
- **A crown in leaf is a SHELL of clusters over a shaded CORE.** Small lobed
  clusters (6 round, two rings, each turned and tipped its own way, sizes two
  to one) laid inside the silhouette with their outsides on it; one size of
  lump in rows is a head of broccoli, bipyramids read as a heap of diamonds.
  A column (the cypress) is mostly core, its boughs a shag on it.
- **A fan palm's fan opens in the plane of its pitched stalk and the side**,
  its fronds pitched round the head from −35° to +55°; a fan laid flat reads
  as a lily pad. A feather palm's leaflets are a V hanging under the rachis,
  cut into a comb at the edge.
- **Winding.** Blender is z up, so a ring laid anticlockwise from above,
  walked bottom to top, faces out. The game culls back faces (the Cycles
  still does not).
- **Budget** (whole / sketch, triangles): alder 624–1,036 / 98; birch
  590–946 / 89–98; aspen 494–776 / 89–98; rowan 606–906 / 89–98; pine
  254–398 / 95; spruce 762–998 / 69; red mangrove 642–850 / 143; black
  mangrove 624–946 / 98; coconut 731–955 / 76; cabbage palm 639–771 / 76;
  live oak 534–872 / 89–98; slash pine 254–446 / 95; holm oak 534–856 /
  89–98; olive 494–906 / 89–98; cypress 876–1,118 / 69; coastal pine
  254–476 / 95–130. A sketch must cost no more than the code's tree (60–210),
  because it is what stands out to the fog.
- **In the game** (`flora.ts`): a modelled kind draws `TREE_SHAPES` (4) of
  its variants whole to `TREE_FULL` (90 m) and `TREE_SKETCHES` (2) sketches
  beyond, bucketed in `TREE_TILE` (48 m) squares so the band is decided a
  tile at a time. Measured (`make profile`, seed 38, cruise): the taiga
  +11 % of the frame's triangles (962,825 → 1,066,440) and +58 draws; the
  mangrove −12 % (912,123 → 799,387: the sketches are cheaper than the
  code's palms and mangroves) and +33 draws; the karst −3 % and +8 draws. The first cut — six variants, 150 m,
  sketches dearer than the code — was +39 % and +130 draws on the taiga:
  the draws are a mesh a shape a band a pass, and the mirror is a pass.
- **Packed.** `make models` runs each through `scripts/lib/glb-pack.mjs`
  (reordered; positions to 4 mm on the node's scale, normals and tone to 8
  bits; one meshopt view a stream): 31–80 KB a kind, ~0.9 MB the woods.
- **Judged** on `make flora ARGS="--models --from=previews/blender --compare"
  BIOME=…` (the code's tree beside every variant and two sketches, from a
  rider's eye), then `make build` + `screenshots ARGS="--mode free"` against
  a `VITE_MODEL_TREES=0` build, on a cold coast and a warm one.
- **Stamped apart** (`treeStamp`, `sources.json`'s `trees`; `make models
  SET=trees`) over `tree.py`, the packer and every kind's SHAPE data (no
  colour: a retinted row moves no model) — but `blender.mjs` and `lib.py`
  are in both stamps, so touching them remakes the crafts too.

## Blender, headless

- **Linux**: the release tarball (SHA-256 checked), on the PATH or
  `BLENDER=`. Cycles runs on the CPU (four cores: keep stills to 10–24
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
  Color`; the RGBA Mix node's colours are inputs 6 and 7 and its result
  output 2; creases are the `crease_edge` float attribute;
  `bmesh.ops.create_cone` takes `radius1`/`radius2`; curve objects must be
  converted to meshes before a join or an export.

## Adding a kind

1. **The data**: a function in `model-data.ts` returning the game's OWN
   tables for one (imported, never restated), a row in `KINDS` in
   `scripts/blender.mjs`, and the data added to a stamp (`modelStamp`, or a
   stamp of its own as the trees have). The rider and the trees are the
   worked examples.
2. **The builder**, `scripts/blender/<kind>.py`: `from lib import *`, its
   frame stated in its header, `rides()` / `bone()` for the rig, `clip()`
   for what it plays, `finish(name, OUT, SAMPLES, centre, size)` at the end,
   every material named for what the game dresses it as. A helper two kinds
   need goes into `lib.py`.
3. **The game**: its file in `modelFiles`, its load and its dress in a
   `*-models.ts`, a case in `tests/models_test.ts` (and a suite of its own
   for what decodes).
4. **The lab**: the kind's own lab owes a model view beside the code's (the
   craft sheet's `--asset`, the flora sheet's `--compare`), the turn back
   into the game's frame in the lab, not the model. Update this skill's
   table and the README's `make blender` row.

## The registry

`pwa/src/game/model-registry.ts` is the one list of every kind of object the game draws and whether what the player sees is a Blender model or code — its ids, its code builder (always one: the switch's other side), its Blender builder, committed files and switch when modelled. `docs/models.md` is its table (`make model-registry`), and `tests/model_registry_test.ts` holds the Blender rows to exactly what `modelFiles` packs. **Modelling a kind is a row flipped from `code` to `blender` in the same change that ships its models**; the suite fails until the row, the files and the page agree.

## The models in the game

Every build draws them — local, CI, the site's slots, a release, the
desktop and store apps — unless SWITCHED BACK: `VITE_MODEL_CRAFTS=0` (the
code-built crafts), `VITE_MODEL_RIDERS=0` (the code-built rider),
`VITE_MODEL_TREES=0` (the code-built trees), in the environment or the root
`.env`; unset, empty or anything else is on (`model-switch.ts`). Every
workflow hands its build the repository SECRETS of the same names (this
repository keeps no Actions variables), so `make ci-models MODELS=off`
switches every CI build back with no commit.

- **Committed, stamped, drift-tested.** `make models` makes every craft, the
  rider and every kind of tree at game quality (no stills, ~1.5 min;
  `SET=machines` / `SET=trees` one half) and `scripts/models.mjs` publishes
  them into `pwa/models/<id>.glb`, `rider.glb` and `trees/<kind>.glb` with
  `sources.json`: `modelStamp` and `treeStamp` (`pwa/models-stamp.ts`) — the
  builders' text and every model's DATA, hashed at a hundredth of a
  millimetre. A change to a builder, a station table, a style's colour, the
  rider's pose or a tree row's shape fails `tests/models_test.ts` until `make
  models` is run and `pwa/models/` committed with it. CI needs no Blender.
- **Packed by the build.** `pwa/models-plugin.ts` emits them into the
  bundle (before `appPwa`, so the worker precaches them) and serves them the
  same way in dev; a build whose model is missing FAILS, naming `make
  models`. `envDir` is the repository root.
- **Fetched before anything is built.** `loadModels()` (`load-models.ts`,
  re-exported by the renderer) runs before the renderer's kit is handed out
  (`App.tsx`) and fetches the crafts, the rider and the trees; the craft
  card's turntable fetches its own (`craft-picker.tsx`).
- **A craft is merged into ONE draw, on the craft's own surface.** `prepare`
  merges a glTF's primitives into one skinned mesh whose vertices carry the
  dress (`color`, `aShine`), drawn with `smoothOf(surface)` on the same sky
  uniforms — on a COPY of the loaded scene: merging in place left the second
  preparation of the same glTF painted in its first material.
- **The code craft is still built and still the craft.** `hangCraft` hangs
  the model under the group `buildCraft` made and COLLAPSES the code's hull;
  the lamps, the camera's deck, the sea's cut and every reader of the group
  go on as they were. The rider's model hangs under the code figure's mesh
  (`hangRider`). Rivals are copied with `cloneCraft`, and a model's geometry
  is shared.
- **Posed every frame off the same readings**: `poseCraft` where the
  renderer poses each hull, and `onTheBars` in the rider's `update`.
- **Dressed by NAME.** `dressOf` maps each material's name (as the builders
  name them — `tests/models_test.ts` reads them as text) to a `CraftStyle`
  field, a moulding, the pod's `glass`, or a key of the rider's `PAINT`; a
  tree's roles to its row's colours (`roleColours`,
  `tests/tree_models_test.ts` reads `ROLES`).
- **A tree is planted, not hung.** `flora.ts` instances a modelled kind as
  it instances every species — one buffer, tiles culled a frame at a time,
  the mirror handed a prefix — but a mesh a variant a band, a tile carrying
  a run of plants a variant; the placer's height, yaw and tint are the
  code's. A kind with no model loaded is drawn by the code's builder.

## Skill self-improvement

Load **`skill-reflection`** before a session that used this skill commits.
What belongs here: a Blender or glTF trap met, a budget measured on a new
kind, a modelling move that made a class or a species read (or failed to), a
kind added.
