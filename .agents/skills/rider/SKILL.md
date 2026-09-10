---
name: rider
description: "Use when working on THE RIDER — the man on the saddle: how he is posed on the deck (the hands on the grips, the feet in the footwells, the stand-up's crouch), how his body answers the inputs and the hull (the lean, the hang into a turn, the tuck into the wind, the throttle's shove, a landing taken in the knees), and how he looks from behind at chase range. Owns pwa/src/game/rider-pose.ts (the pose as DOM-free maths, the body on springs) and rider.ts (the figure), `cockpitOf` in craft-body.ts as what he stands on, tests/rider_test.ts, and the loop: `make crafts` (he is on every sheet, at rest), then the built app at `SCENE=rest`, `cruise`, `carve`, `landing`."
---

# The rider

The rider is the one human thing in the frame, and the chase camera looks
at his back for the whole run. He is **generated from the deck and the
engine's readings**, never animated by hand: `rider-pose.ts` places every
joint from the craft's cockpit and a `RiderRead`, and `rider.ts` re-emits
the figure from those joints every frame into one vertex-coloured mesh.

**Before starting, read this skill's lessons** —
`node scripts/skill-lessons.mjs rider --list`. Load `skill-reflection` at
both ends, `write-code` beside this for any code change, and
`craft-design` when the deck he sits on is what moves.

## Where everything lives

| Piece | Role |
| --- | --- |
| `pwa/src/game/rider-pose.ts` | `RIDER_SCALE` (how big he is DRAWN), `BODY` (an anthropometric table's segments for a 1.8 m man, each carrying that scale), `STANCE` (the lean at idle, what the throttle and pace add, how far the pelvis slides and how wide the feet stand, how the head follows), `DYNAMICS` (the springs: pitch, roll, crush), `poseRider(cockpit, read)` → every joint, `createRiderDynamics()` → the springs stepped per engine step, `riderVisible` |
| `pwa/src/game/rider.ts` | `createRider(cockpit, surface?)`: the figure — the seat and hips as one mass leaning with the torso, the vest's lighter back and two orange straps, the full-face helmet in three bands of livery under a peak, muscled arms to the grips, the two-tone thighs, the orange shin stripe, the boots — and `observe` / `update` / `pose`. `FACETS` is the roundness dial and `k()` carries `RIDER_SCALE` into every girth. `RIDER_FINISH` says what each `PAINT` is finished in (`FINISH`, craft-surface.ts): the shell and the visor flare, the wet skin and neoprene carry a sheen, the vest's nylon does not — he is drawn on the craft's own surface, so the sun and the sky land on him as they land on the hull |
| `pwa/src/game/craft-body.ts` | `cockpitOf(spec, style)`: the saddle's bucket, the grips, the footwells, from the same `layout` the hull loft reads — the rider reaches what is drawn |
| `pwa/src/game/renderer.ts` | Builds the rider with the craft and adds his mesh to the craft's group; `observe` steps his springs, `render` poses him |
| `scripts/craft-preview.mjs` | `make crafts` — he is on every craft on the sheet, at rest, with a `helmet` column beside `bars` |
| `tests/rider_test.ts` | The pose held to the deck on every craft; the inputs moving the body the way they mean; the springs on a landing |

## How he is posed

1. The pelvis goes on the seat (`seat.y + BODY.pelvis`, toward the front
   of the bucket), or over the tray at a crouch on a stand-up.
2. The torso leans forward by `STANCE.seatedLean` plus the throttle's and
   the pace's share, minus the rider's lean back, plus the springs' pitch;
   it rolls into a turn by `riderRight`.
3. The hands are ON THE GRIPS. Each arm is solved back from its grip
   (`solveLimb`, the elbow out and down). If a shoulder cannot reach, the
   torso leans further, and at full lean the pelvis slides up the bucket
   (`seat.zMax`). A rider leaning back therefore sits with straight arms,
   the way a real one does — the torso angle barely changes.
4. The feet stand on the footwell floor ahead of the pelvis; the knees are
   solved up and in beside the saddle (forward, stood).
5. The head follows a share of the torso's lean and turns into the turn.

Everything deliberate is a `CraftState` field the engine wrote
(`riderAft`, `riderRight`, `throttleEff`, `speed`); nothing re-derives
intent. The involuntary part is `createRiderDynamics`: three damped
springs at a human's postural frequencies, driven by the hull's surge, its
vertical acceleration (differenced `vy` — free fall lifts him off the
seat, a slam compresses him) and the CHANGE in its pitch and roll rates
(the lag), plus a lurch on `hit` and `ground`. Stepped in `observe` with
the engine's dt, so a pre-rolled screenshot shows the same body.

## The loop

1. `make crafts` — the sheet, all four craft, at rest. Judge the STERN and
   CHASE cells first (that is the game's view), then SIDE for the lean and
   the reach: arms at full stretch at rest mean the grips are out of reach
   (`tests/rider_test.ts` holds the reach; it fails before the picture
   does).
2. A pose change is a `STANCE` number; a body change is `BODY`; a look
   change is `PAINT` or a `segment` in `figure`. One axis, re-sheet, look.
3. `make build`, then `CHROMIUM_PATH=/opt/pw-browsers/chromium make
   screenshots SCENE=rest`, `cruise`, `carve`, `landing` — a bright seed
   (19 is a clear late morning) — and crop the craft at 3× to judge; at
   1280 px he is sixty pixels tall and a pose reads only as a silhouette.
4. `make profile`: he is one draw call and about 1700 triangles — half a
   percent of the frame — so roundness is cheap and being ONE mesh is the
   invariant that matters, not the count.

## Judging him

- **From behind, at sixty pixels, he must read as a man on a machine**:
  the helmet, the shoulders, the back a lighter tone than the saddle, the
  straps, the arms out to the bars. Contrast does the work, not detail.
- **Hands on the grips, boots on the floor, always.** A hand floating off
  a grip is the first thing a player sees.
- **The body answers the hull.** Open the throttle: he goes back, then
  tucks. Turn: he hangs in and looks through it. A wave: the knees and the
  back take it, then settle. Nothing snaps — every motion is a spring or
  the engine's own lag.
- **Proportions are the table's; only the SCALE is a choice.** `BODY` is
  an anthropometric 1.8 m man (upper arm 0.31, forearm 0.27 + the fist,
  thigh 0.44, shin 0.42, shoulders 0.42 apart) with every segment
  multiplied by `RIDER_SCALE` — over one on purpose, because a correctly
  sized man on a correctly sized 3 m runabout reads as a child on a boat
  at chase range, and the reference draws its riders big. Move the scale
  to change how big he is; never a single segment. Fix a REACH at the deck
  or the stance, never by lengthening an arm.
- **Girth is silhouette.** Nothing is textured and nothing is
  smooth-shaded, so a limb is read from its outline: a segment lofted as
  an even taper reads as tubing however it is painted. Every limb is a
  wide joint, a wider muscle belly at the anatomical place, then a narrow
  joint — and the contrast between belly and joint is what carries the
  tone, not the absolute girth.

## What is not here yet

The rider thrown (`riderVisible` hides him while the hull is capsized or
being righted — nothing draws him in the water; the `wipeout` subject is
reserved), a second rider, a woman, a helmet without a peak. Bars that
turn with the steer would move his hands with them; today the bars are
static geometry and the hands stay on them.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording
here: a stance number that fixed a read at chase range, a reach that a
deck change broke, a spring gain that read as a twitch.
