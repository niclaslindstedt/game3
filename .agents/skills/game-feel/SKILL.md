---
name: game-feel
description: "Use when the task is about how the game FEELS to ride — the sensation of a hull meeting a wave (the lift, the slam, the spray, the air), the sense of speed over water, the camera's framing, how pace and danger read on screen. The feeling of riding IS the core product; this skill owns the reference (the 90s jetski racers), the levers that create the sensation across the wave field, the hull's probes, the camera, how the levers interact, and the look-first verification loop. Load it for any change whose acceptance test is 'does it feel like riding water', alongside the skill that owns the specific subsystem being edited."
---

# Game feel — the hull meeting the wave

The whole game is one sensation: a hull crossing water that is MOVING. A change
can pass every test and still fail the product: **the acceptance test for feel
is a strip, a screenshot or a run, looked at**, next to the reference. This
skill owns that judgement and the levers behind it.

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs game-feel`. Record what a tuning session
learns at the end (`skill-reflection` owns the format).

## The reference: the 90s jetski racers

The arcade jetski racers of the nineties are the north star for how water
and a craft on it should read. What they got right, and what every lever
below is measured against:

- **The water is a PARTICIPANT, not a floor.** Every wave lifts the craft,
  every trough drops it, and the rider is fighting the sea as much as the
  course. A swell taken at speed launches you; a swell taken across throws
  the hull sideways; chop at full throttle is a drumroll of small slams. Flat
  water is the exception and reads as a reward.
- **Speed is felt through the HULL, not the speedo.** Pitch up over a crest,
  the bow dropping into the next face, the spray sheet off the sponsons, the
  wake behind — a craft at 90 km/h on glass reads slower than one at 60 into
  chop. Speed sells as motion RELATIVE TO THE WATER.
- **Air is a moment.** A big wave or a ramp puts the craft clearly out of the
  water: the engine revs free, the spray stops, the nose drifts, and the
  landing is a decision (lean back to land flat, lean forward to dive). Every
  flight has a launch, a hang and a landing that each read distinctly.
- **The turn is a lean and a carve.** The craft rolls INTO a turn, the inside
  sponson digs, the wake bends, and the throttle is what makes it turn —
  off-throttle, the nose goes straight on. Steering with the throttle is the
  whole skill of the game.
- **The camera stays low and behind, and the horizon breathes.** The chase
  camera sits close over the transom, low enough that the next wave hides the
  one after it; it pitches and heaves a little with the craft so a big swell
  reads in the frame, and yaws to look through the turn.
- **Buoys are the course.** Gates read from a distance, the next one is
  always findable, and missing one COSTS.

Two frames to hold in mind: a bright choppy bay ridden at speed, for the
chop and the spray sheet; and a glassy inland lake, for the still water and
the reflection the craft breaks. `SCENE=chop` and `SCENE=cruise` are ours.

## The levers, and who owns each

Feel is produced by five subsystems TOGETHER. A change to one usually needs a
sympathetic change in another — a taller sea with no more planing lift makes
the game harder, not more dramatic.

| Lever | Where | Owning skill |
| --- | --- | --- |
| The sea itself: height, period, steepness, how it builds offshore | `engine/game/water.ts`, `wind.ts` | `water-feel` |
| How the hull answers it: buoyancy, planing, slamming, the jet, the lean | `engine/game/craft.ts`, `hull.ts`, `flight.ts`, `defs/tuning.ts` | `craft-physics` |
| What separates the four craft | `engine/game/defs/craft.ts` | `craft-tuning` |
| Course scale: gate spacing, offshore band, ramp placement | `engine/mapgen/rules.ts` | `mapgen-improvement` |
| Camera: the ladder, its rigs, the flown hand-over, the landing's kick | `pwa/src/game/camera.ts`, `camera-rigs.ts`, `camera-change.ts` | (this skill) |
| Water-contact FX: the spray, the wake as a map, a pulse in the hands | `pwa/src/game/spray.ts`, `wake.ts`, `rumble.ts` | `visual-effects` |
| The water's LIGHT: the sky each face reflects, the glint, the ripples, the foam — per pixel, never moving a vertex | `pwa/src/game/water-shader.ts`, `water-mesh.ts` | `water-look` |
| The sky the water reflects: the sun's hour, the weather, the clouds, the night | `pwa/src/game/sky.ts`, `environment.ts` | `atmosphere` |

What each contributes:

- **The wave field is the drama.** `Hs` and `Tp` set how often and how hard
  the hull leaves the water; the fetch law means the sea builds as you ride
  OUT and calms as you come IN, so a course that swings offshore gets rougher
  on purpose. Steepness (H/λ) decides whether a wave is a hill or a wall.
- **The probes are the hull's nerves.** Twelve probes read the surface, and
  their lever arms are what turns a wave into pitch and roll. Fewer probes or
  a smaller footprint reads as a raft; more damping reads as a barge. The
  planing lift is what gets the hull ON TOP of chop at speed — without it the
  craft ploughs, and ploughing reads as slow at any speed.
- **The camera sits low and follows the water's rhythm.** A chase rig that
  holds a fixed height over sea level reads the swell as the craft moving;
  one that follows the craft's heave exactly reads the swell as nothing. The
  answer is in between: a lagged heave follow, a pitch that tilts with the
  hull by a fraction, and a yaw that looks through the turn.
- **Speed only feels fast against wave scale.** A craft with a taller top
  speed needs longer gate spacing and a wider offshore band (`rules.ts`), or
  the level reads as twitchy instead of quick.
- **The wind vane is a promise.** The HUD's vane says where the sea is coming
  from, and the sea had better come from there.

## The camera module, and what it decides

The camera is this skill's own subsystem — `pwa/src/game/camera.ts`, reading
`GameState` and nothing else. One row per question:

| Question | Where |
| --- | --- |
| Where the chase camera stands behind the craft, and how far it pulls back with speed | the rig constants at the top of `camera.ts` |
| How much of the craft's heave, pitch and roll the lens shares | the follow fractions beside them — a lagged share, never 1 |
| Looking through a turn | the yaw blend between heading and velocity direction |
| What the camera does in the AIR | the rod follows the flight path's angle, its length unchanged, so the craft stays the same size off a ramp as on the water |
| The landing's shudder | a damped kick on the `land` event, sized by the landing's vertical speed |
| The `C` key | the rig ladder (chase, close, far — and the ones added later) |

**A reading that moves where the camera STANDS is stepped before the lens is
placed.** The sea height under the lens, the follow target and the pull-back
are all sampled AT the lens; a boom moved after that sample stands over water
read a metre away, and on a big swell that is a shot that pumps.

## The workflow

1. **State the feeling** being tuned in one sentence ("a head sea at full
   throttle should feel like a drumroll, not a trampoline"), and find the
   reference moment for it.
2. **Change the smallest set of levers** that plausibly produce it. Numbers
   in `defs/tuning.ts`, `defs/craft.ts` or `rules.ts`, not new mechanics,
   unless the mechanic is the gap.
3. **Read it on the bench BEFORE looking at it.** Every feel lever has a lab
   that runs in seconds with no build:

   ```sh
   make waves SEED=<n>            # the sea: Hs, Tp, the transect, the spectrum
   make ride SCENARIO=chop        # the hull crossing it: a strip, with numbers
   make ride SCENARIO=launch      # …and the ramp: launch, hang, landing
   make ride SCENARIO=carve       # …and the turn: roll, nozzle, speed bled
   ```

   The ride strip is where a claim is made: pitch amplitude over chop, how
   many frames the hull is airborne, how much speed a slam costs. A feel that
   cannot be pointed at in the strip is a feel that will not survive the next
   tuning pass.
4. **`make sim` before and after** any engine or rules lever — the feeling is
   never allowed to cost the bots the level (finishes, missed gates, dives
   and groundings are the regression surface).
5. **LOOK**: `make build`, then `make screenshots SCENE=chop` (and `swell`,
   `launch`, `landing`; in web sessions `CHROMIUM_PATH=/opt/pw-browsers/chromium`).
   Put the shot next to the reference and compare proportions, not vibes:
   how much of the frame is water, where is the horizon, does the hull's
   attitude read, is there spray where the hull meets the water? **Every
   camera framing change gets its own PORTRAIT shot** (390×844): the fov is
   vertical, so landscape cannot show what a phone held upright does.
6. **Iterate camera and FX freely** — they are presentation and cost nothing
   to re-tune. Engine feel numbers move in small steps; each step re-labbed.

## Hard-earned constraints

- **What is drawn IS what is simulated.** The water mesh is displaced by the
  engine's own `surfaceAt`; the hull's probes read the same function. A
  renderer-side "make the waves look bigger" is a hull that floats above or
  sinks into the picture, and it is the single most visible way this game
  can break. Bigger waves are a `water-feel` change.
- **No thrust, no steering.** Off the throttle the craft goes straight on —
  that is the real characteristic and the whole skill. Any "help" added to
  off-throttle steering flattens the game. The small hull-keel authority in
  `craft.ts` is the ceiling.
- **The body rolls into the turn; it does not slide.** A PWC carves — the
  lateral keel drag is large, the rider leans in, and the hull banks. It is not
  a car that drifts; a craft that slides sideways flat reads as a hovercraft.
- **The landing is charged for what the flight put in.** Slamming reads the
  probe's own vertical closing speed against the surface; a landing that is
  charged the CoG's descent, or one charged every step the hull chatters over
  chop, is a craft that stops dead on every wave.
- **Anything that vibrates the lens is a few incommensurate oscillators
  under 8 Hz on a decaying envelope**, never a fresh random offset per frame:
  white noise at a real slam's amplitude is a broken picture, and at 30 fps
  it aliases into a slow lurch.
- The renderer never mutates `GameState`; feel state that must persist
  (camera smoothing, the spray's decay) lives in renderer-side closures and
  resets with the next level's meshes.
- Readouts the FX need from the rider (throttle, lean, steer) are
  `CraftState` / `CraftInput` fields the engine wrote — the renderer never
  re-derives intent from physics deltas.
- The screen is a MIRROR of the engine's map view: camera and FX code work in
  world coords and stay sign-consistent; never flip a sign in the camera to
  fix a perceived left/right issue. Heading 0 is +z and grows clockwise from
  above; forward is `(sin h, cos h)`.
- Speed thresholds quoted in feel terms convert as 70 km/h ≈ 19.4 m/s; the
  engine is all metres and seconds.

## What the change obliges elsewhere

- A lever in `tuning.ts` / `craft.ts` / `water.ts` → `docs/riding.md` or
  `docs/water.md`, the owning lab's before/after, `make sim` both tables.
- A camera change → `make screenshots` at both viewports in the PR.
- A user-visible change → a `.changes/unreleased/` fragment (the `changelog`
  skill).

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording
here: a lever that reliably fixes a feel complaint, a coupling between a sea
number and a hull number, a camera fraction that turned out to be the whole
difference — and the reference moment a session found itself comparing
against, so the next one starts there.
