---
name: visual-effects
description: "Use when creating or tuning what the CRAFT THROWS OFF and what the rider FEELS — the spray (the chine sheets, the rooster tail, the landing plume, the bow plunge), the wake as a map the water shader draws (the road, the boil, the fan, the hollow, a landing's foam), the textures those are drawn with, the footprints on the sand, the landing's shudder in the lens, and the vibration table under the player's hands. Covers the event → effect flow (the engine emits events and writes `CraftState`; the renderer turns them into transient visuals and pulses), the two surfaces (the three.js scene and the water shader's map), the low-poly art direction the effects sit inside, and the loop that judges them — zoomed. Not the water's own light (`water-look`) and not the sky (`atmosphere`)."
---

# Visual effects — what the craft throws off

Transient FX are **presentation only**: the engine (`engine/`) knows nothing
of them. It emits an EVENT or writes a `CraftState` reading, and the app turns
that into a short-lived drawn thing or a pulse in the hands. An effect never
changes what happens, only how it reads. The renderer reads `GameState` and
the events `step()` returns; it never mutates state and never steps physics.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
visual-effects --list`, then the ones the task touches. Load
**`skill-reflection`** at both ends of the session and **`write-code`** beside
this one. For the water the spray falls back onto, `water-look`; for the
sound the same event makes, `sound-effects` — the two surfaces read the same
event and the same `slam`, and where they disagree it is on purpose.

## The two surfaces

Pick by what the effect is anchored to:

| Surface | Use for | Lives in |
| --- | --- | --- |
| **The three.js scene** | Anything IN THE AIR: droplets, a plume, a sheet off a chine — one point-sprite batch, lit by the same two lights the water is | `pwa/src/game/spray.ts` is the reference pattern; wired from `renderer.ts` |
| **The water shader's map** | Anything ON THE WATER: the road, the boil, a landing's foam, the hollow the transom leaves — rasterised into a texture round the craft and drawn by the SAME foam term, in the same light, as a whitecap out at sea | `pwa/src/game/wake.ts` lays it, `wake-profile.ts` shapes it (three-free), `water-shader.ts` reads it |

There is no third surface: a ribbon, a decal or a second material laid over
the sea is unlit while the sea is lit by two lights, its tile is read in
another space, and it cannot bend the reflection under it. It reads as paint
at any hour and as a grey strip at dusk.

The LENS's reaction (the landing's damped kick, the flown view change) is the
camera's — `camera.ts` and `camera-change.ts`, under `game-feel`; an effect
that wants the camera to move goes there, not into an ad-hoc transform.

## The modules

| Effect | Where |
| --- | --- |
| The spray: the chine sheets while planing, the pump's rooster tail, the reverse bucket's boil, the landing's plume, the bow driving into a face | `pwa/src/game/spray.ts` — one `THREE.Points` pool, a custom shader so every droplet has its own size, everything within a hull length of the craft |
| The wake's SHAPE by speed and by age — the road, the boil, the fan at Kelvin's angle, the hollow, the rise time of the relief | `pwa/src/game/wake-profile.ts`; `tests/wake_test.ts` holds the reference photograph's claims as arithmetic |
| The wake's MAP — the trail rasterised once a frame from straight above, one channel each for foam, churn, crest and hollow; a landing's foam stamped into it by the spray | `pwa/src/game/wake.ts` |
| The foam's mottling and the droplet, made in code; the anisotropy every tile seen along the water needs | `pwa/src/game/fx-textures.ts` |
| Footprints on the sand — decoration placed on the level's own seed, on `sand` only, instanced, never a solid | `pwa/src/game/footprints.ts` |
| WHAT IS FELT: which moment is worth a pulse and how big, the sea's slam read off `CraftState.slam` | `pwa/src/game/rumble.ts` (DOM-free; `tests/rumble_test.ts`) |
| The motor: the browser's Vibration API or the shell's tap, the ledger, the player's switch | `pwa/src/game/haptics.ts` — the only `navigator.vibrate`; the phone's half is `platform-shells`' |

## The flow: reading → effect → draw

1. **The engine says what happened.** A moment is a `GameEvent` (`land`,
   `dive`, `hit`, `gate`…) pushed from the step it happens in; a condition is
   a `CraftState` field the engine wrote (`planing`, `wetted`, `throttleEff`,
   `airborne`, `submergedDepth`, `vy`, `slam`). Event-driven for "at the
   moment of", state-driven for "while". The renderer never re-derives
   intent from physics deltas — the one thing observed by difference is the
   bow plunge (`submergedDepth`'s rate), because no event fires for it.
2. **Observe every STEP, draw every frame.** `renderer.observe` is called
   inside the step loop; a reading that spikes for two steps (the slam) is a
   random sample of itself if read once per frame, and the slower the machine
   the more of it is dropped. Keep the hardest reading since the last payout
   across frames (`rumble.ts`'s `step`/`frame` pair is the pattern).
3. **The effect animates by its own progress `t`** (0→1 over its life), off
   the sim clock, so a still pre-rolled for a screenshot carries the same
   spray the player would see.

## The art direction — effects must sit inside it

The world is flat-shaded, vertex-coloured, low-poly, under one hemisphere and
one key, with every texture made in code. An effect that ships a soft
particle shader or a smoke sprite reads as pasted on.

- **Spray is MANY SMALL sharp droplets.** Sprites of 0.15–0.6 m, each a
  cluster of small solid drops rather than one soft disc, alpha 0.7–0.8,
  count in the thousands (one draw call, so count is cheap), and a fade over
  the last few metres to the lens — a few big soft sprites read as smoke,
  and a soft disc with grain reads as soap bubbles at the next zoom.
- **The white road is foam ON the water.** The reference is the aerial
  photograph of a runabout at pace: a beam-wide road that stays white for a
  few seconds and breaks into patches, a boil at the transom, a pale V at
  Kelvin's angle whose width is the SPEED, and a rooster tail as a fine fan
  over it — not blobs down its middle.
- **Lit by the world's lights.** The droplets take the hemisphere and the key
  each frame, so a plume at dusk is the dusk's colour; the road goes through
  the same lace as a whitecap. Palette colours from `identity.ts`, no greys
  the world does not contain.
- **Motion carries the effect.** Speed reads through spawn rate, inherited
  velocity and lifetime; a sheet that streams back sells 80 km/h better than
  any texture.

## Craft rules

- **Presentation-only, structurally.** No effect writes `GameState`, draws
  from `state.rng` or feeds anything back into `step()`. Renderer-side
  randomness (droplet jitter, the footprints' scatter) uses its own source,
  seeded from the level so a seed draws the same shore; a world-coordinate
  scatter goes through a hash, never `x % n`.
- **Budget per frequency.** The spray runs continuously while planing and
  must be near-free: pre-allocated pools, no per-frame allocation, one
  geometry and one material per system. The wake's map is one small render
  target. A once-per-run flourish can afford more.
- **A mark material is double-sided, and the map's channels get a
  diagnostic.** A ribbon's winding in plan folds over on the inside of a
  turn, and single-sided the map comes back EMPTY with no other visible
  error. When a map effect looks wrong, paint its raw channels onto the
  water before touching a number.
- **The churn must not close the window, and the foam gain sits under the
  lace's saturation** — the near sea's tone is the dark bed through it
  (`water-look`), and a fresh road past saturation is a flat white blanket.
- **Anything that displaces the water is smooth at the grid's scale in
  space and time** — a blurred mip and a rise time; the water grid's cells
  are metres, and a metre-wide trough makes one vertex at a time jump.
- **A pulse is sized against the RIDE, not a held key.** Size a rumble
  threshold from the bot riding the course at pace (`botInput`), never from
  a scratch probe holding the throttle from the start line; and remember a
  held key in headless Chromium does nothing before `window.__SH_READY__`.
- **Events for sound too.** If the effect's moment would also want audio,
  the EVENT carries what audio needs; the event is designed once and consumed
  by every presentation channel (`audio/route.ts`, `rumble.ts`).
- **Reduced motion.** Anything screen-filling or flashing needs a
  `prefers-reduced-motion` fallback that keeps the information.

## The iterate loop — LOOK at it, ZOOMED

Never tune an effect blind:

1. **A scene in `pwa/src/game/scenarios.ts`** that stands the craft in the
   effect's moment (`cruise` at `--t 5` on the `close` camera for the road,
   `carve` on `far` for the fan, `landing` for the plume, `dive` for the
   plunge). An effect you are ADDING gets its scene in the same change — it
   is how a human reviews it without playing for it. The ride lab's list
   (`scripts/lib/ride-scenarios.mjs`) is named separately; add to both.
2. `make build && CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots
   SCENE=<name> CAMERA=close`, then **read the PNGs at 3×**: a 1280 px frame
   hides a dark gap behind the transom and a road with no texture in it. A
   scratch page over `scripts/lib/serve-dist.mjs` with `deviceScaleFactor: 3`
   and a `clip` on the stern is ten lines (`lab-tooling`).
3. **Two or three offsets for a timeline** (`--t`), one per beat: a landing
   is a burst, then a sheet, then the foam on the water.
4. **Ride it** for anything that moves — a twitch at the grid's scale and a
   pulse's timing show in no still: `npm run dev` and cross some chop.
5. Judge, refine the worst beat, re-shoot. `make profile` before and after.

A still lies three ways, and `playtest` owns the fixes: a beat under a
second of sim time is overshot under software rendering (ask for the FIRST
qualifying frame), a beat that only exists while something loads is reached
by holding the dependency back, and a frame is captured where the run is
STOOD, not where the script ends.

## Ship checklist

- [ ] Presentation-only — no simulation state touched, no `state.rng` draws.
- [ ] Right surface: the scene for the air, the wake's map for the water,
      the camera module for the lens.
- [ ] Sits inside the art direction: palette colours, many small droplets,
      lit by the world's lights, no foreign fidelity.
- [ ] Pooled allocations; observed per step where the reading spikes.
- [ ] A scene exists and you LOOKED at it zoomed, at two offsets.
- [ ] `npx vitest run tests/wake_test.ts tests/rumble_test.ts
      tests/scenarios_test.ts`; `make profile` both tables in the PR.
- [ ] A `.changes/unreleased/` fragment — effects are player-visible by
      definition.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment
here: a beat that only read at a zoom, a channel that came back empty, a
reading that turned out to be sampled rather than seen.
