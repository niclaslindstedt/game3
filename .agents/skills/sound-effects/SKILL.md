---
name: sound-effects
description: "Use when adding or tuning a SOUND — the engine's note and the pump's whine, the spray, the wind, the sea and the surf (the continuous BEDS), a one-shot: a slap, a landing, a dive, a hull on a rock, a buoy's chime — or a BIRD's cry and how often and how far off it is heard. Every sound is synthesized at runtime from authored parameters under pwa/src/game/audio/; the game ships no audio file. Owns the vocabulary (`lib/voice.ts`), the instrument (`lib/synth.ts`), the bank, the route, the beds and the listener, the mixing budget, and the audition page — `make audition`, and `--meter` for the levels — which is the only honest way to judge any of it. NOT for music: a score is a different craft with a different review loop, reserved as `soundtrack`."
---

# Designing sound effects

The game ships **no audio files**. Every sound is synthesized at runtime from
a handful of numbers, authored as TypeScript data in `pwa/src/game/audio/`,
which keeps the app tiny and offline and makes the sound design as diffable
as the craft catalog. `docs/audio.md` is the reference; this is the loop.

**The register is a modern arcade racer on real water — not a chip, and not
a sample library.** A jet ski is a small engine with grit in it, a pump that
WHINES, a sheet of spray that hisses, and water, which has no transient at
all. Four things in the instrument exist to reach that, and reaching for
them is what stops a new sound sounding chip:

| Reach for | When |
| --- | --- |
| `color: "brown" \| "pink"` on a noise | ALWAYS decide this before the filter. Brown is mass and distance (a swell, the surf, a landing's weight), pink is spray and wind and every sheet of water, white is grit and the crack of fibreglass. |
| `filter.to` — a moving cutoff | Any sound that is a GESTURE rather than a hit: a sheet leaving the chines, a bow burying and coming back up, the whoosh through a ring. |
| `drive` — the waveshaper | Anything with combustion or a body in it. A clean triangle is a flute; a driven one is an engine. It is a SOFT curve at every setting — never a clip, because a clip aliases and a Bluetooth codec turns that into a swirl. |
| `attackMs` + `holdMs` on a NOISE | Every splash. Water SWELLS: a landing opens over tens of milliseconds and holds before it thins. Never on the one thing that is not water (a hull on a rock). A bed is a LAYER (below) and has no envelope at all. |

**MUSIC IS NOT HERE.** A score is a different format, a different review
surface and different faults; it is reserved as the **`soundtrack`** skill
and arrives as a second VIEW of the one synth with its own fader, never a
second synth (`bus.ts`).

**Read this skill's lessons first** —
`node scripts/skill-lessons.mjs sound-effects --list`, then the ones this task
touches. Reflecting them back at the end is the **`skill-reflection`** skill's
job; load it at both ends of the session. Load **`write-code`** too, and
**`game-feel`** whenever the acceptance test is "does it sound like riding".

## Files

| File | Role |
| --- | --- |
| `pwa/src/lib/voice.ts` | **The vocabulary.** Every parameter a sound may be written in, the `Synth` interface, and the `LayerSpec` / `LayerTarget` / `Layer` a bed is made of — plus the arithmetic worth testing without a browser (`envelopeShape`, `safeCutoff`, the shaper). DOM-free on purpose. |
| `pwa/src/lib/synth.ts` | The instrument: `tone()` and `noise()` for one-shots, `layer()` for the beds, the shared echo bus (the SHORE's answer — short, damped), the master limiter, and the whole audio-context lifecycle (unlock, iOS interruption, zombie-context recovery, the route re-seat). The only module that touches WebAudio. |
| `pwa/src/game/audio/bank.ts` | **THE RUN'S SOUND DESIGN.** Every discrete sound, as data: a description and a list of voices. This is where most one-shot work happens. |
| `pwa/src/game/audio/route.ts` | **WHICH sound an event makes**, how big (`PlayShape`), and which bubbles it leaves — pure functions from `GameEvent`. |
| `pwa/src/game/audio/bubbles.ts` | The one liquid sound with a physics: Minnaert's bubble, a sine chirping up. The tail every splash gets. |
| `pwa/src/game/audio/engine-voice.ts` | The engine and the PUMP, as eight LAYERS: `engineTargets` is a pure function from revs, throttle, load, how wet the intake is and the jet's slip to where each should be. The one sound whose pitch is arithmetic rather than taste. |
| `pwa/src/game/audio/water-voice.ts` | The hull in the water, the wind and the sea — seven layers — as a pure function of how the craft is going and where the shore is. |
| `pwa/src/game/audio/listener.ts` | **WHERE THE EAR IS.** One row per rung of the camera ladder: what each seat does to the engine, the exhaust, the pump, the hull, the wind, the sea, the one-shots. The beds and the router both read it. |
| `pwa/src/game/audio/ride-bed.ts` | The scheduler: reads `GameState` once a frame, turns it into every layer's target, and raises the one cue the engine never reports — the SLAP, off the hull's own `slam`. |
| `pwa/src/game/audio/bird-voice.ts` | **WHAT THE BIRDS SAY**, plan-free: `BIRD_CALLS` — which bank id each species cries, how often on the wing and on the rock, the reference distance and the reach — and the arithmetic: `criesIn` (a hashed draw per quarter-second slot off the flock's own scatter, so a seed cries the same twice), `heardAt` (the inverse square past the reference, faded to nothing at the reach), `callRate`, `cryPan`, `cryPitch`. A new bird's voice is a row here and a def in the bank; the cormorant and the eagle are `null` on purpose. |
| `pwa/src/game/audio/bird-bed.ts` | The birds' scheduler: asks `birdPlanFor(level)` — the SAME plan the renderer draws, kept against the level — and per frame asks which flocks are in earshot, how much of each is up (`flightShare`), and deals the cries owed since the last frame; keeps its own flush memory off `flushAt` and books the flush's shouts on the ENGINE's clock. The window is capped at a second and `silence()` forgets it. |
| `pwa/src/game/audio/rack.ts` | The plumbing every bed shares: build a layer, rebuild one whose context died, steer it on its glide. |
| `pwa/src/game/audio/play.ts`, `types.ts` | Firing one def through a shape; what a def and a shape ARE. |
| `pwa/src/game/audio/bus.ts` | One synth, the volume-scaled view the fader moves, and the unlock. |
| `pwa/src/game/audio/index.ts` | The front door: events in, the bed fed per frame, the seat, `silence()`, `reset()`. `App.tsx` is its one caller. |
| `pwa/src/game/settings.ts` | The fader the player keeps (`audio.sfx`, twentieths, 0 is OFF). |
| `scripts/audition.mjs` | **THE REVIEW SURFACE** (`make audition`), and the meter (`ARGS=--meter`). |
| `tests/audio_test.ts` | The guards: every event answered, the ceiling, the beds' shapes, the silence said, every cutoff under the headset's Nyquist. |

## An event, a cue, or a bed — the first decision, and the one that matters

| It is… | When | Where it goes |
| --- | --- | --- |
| **An EVENT sound** | The simulation reported a moment: `step()` pushed a `GameEvent` | A def in `bank.ts` + a rung in `route.ts` |
| **A CUE** | The APP can work it out from the state and the engine never said so — the slap of the bottom on a wave | Raised by the bed's own reading of the state (`ride-bed.ts`) |
| **A BED** | It has no beginning and no end: the engine, the pump, the spray, the wind, the sea, the surf | A LAYER in `engine-voice.ts` / `water-voice.ts`, steered per frame by `ride-bed.ts` |

The trap is reaching for a new engine event to make a noise. **Never add a
`GameEvent` for presentation**: if the app can work it out from the state it
already has, it must. The slap is the worked example — the engine publishes
the hull's `slam` (N) on `CraftState` and the bed decides when a slam is a
slap; nothing in `engine/` knows there is a sound.

**A field left out of a route rung answers every value of it.** Add a new
`case` only when the event genuinely picks a DIFFERENT sound (a level
landing and a slammed one); if it only picks a different SIZE, that is a
`PlayShape` (`gain`, `pitch`, `stretch`, `pan`) on the sound already there.

## A BED is a LAYER; an EVENT is a one-shot

Every one-shot is attack-then-decay: the level falls exponentially across the
whole duration — a tenth of the peak a quarter of the way in — which is why a
longer `durationMs` makes a sound RING rather than sustain. A `holdMs` turns
it into a swell, which is what every splash is.

A bed is not made of one-shots, and **never write one out of them**. It is a
`Layer` (`Synth.layer`): a node graph built ONCE — an oscillator or a looping
window onto the noise pool, a filter, a saturation curve, a gain — and then
STEERED. Every frame the scheduler hands it a `LayerTarget` (level, pitch,
cutoff, grit, pan) and a glide, and the layer moves there with
`setTargetAtTime` on the audio thread. The rules:

1. **What a layer IS goes in the `LayerSpec`; what MOVES goes in the target.**
   The oscillator, the noise colour, the filter's type and Q and the curve
   cannot be changed smoothly under a running signal, so they are decided
   once. A different colour of rush is a second layer, not a colour switch.
2. **A bed is a PURE FUNCTION from the state to a table of targets**
   (`engineTargets`, `waterTargets`). That is what makes it testable, what
   lets the audition page drive it from sliders, and what keeps
   `ride-bed.ts` a reader of the state rather than a sound designer. Add a
   layer by adding a key to the spec table, the glide table and the target
   function; the tests read the targets by NAME.
3. **The glide is the character of the change**, and it is seconds: pitch on
   a few hundredths (a rev that lags the needle reads as a slow engine), the
   hull's layers on a tenth (a hull leaving the water is a cross-fade), the
   sea on a quarter or more (a swell does not change its mind).
4. **A driven layer has ONE curve and moves the gain in front of it.**
   `LayerTarget.grit` is the pre-gain; swapping a curve under a running
   signal is a step.
5. **Nothing is booked ahead.** A late frame leaves every layer holding its
   last target. A bed fed on a cadence breathes with the frame rate and
   leaves a hole in itself whenever it is starved — and a hole is what a
   player reports as CRACKLE. The one-shots the bed raises play NOW.
6. **…so SILENCE HAS TO BE SAID.** A bed that simply stops being FED does
   not stop: it holds, at whatever level the hull was last doing, until
   something takes it down. Every frame that is not hearing the run — the
   pause card, a hidden tab, a frozen screenshot — calls
   `RunAudio.silence()`. Adding a path that skips `frame()` without hushing
   is how the engine ends up playing under the pause card.
7. **A silent layer costs nothing to keep.** Set its level to 0 and leave it
   built; `rack.ts` rebuilds a layer only when its context has died.

## What the water taught the vocabulary

- **Water has no transient.** A landing, a dive, a capsize, a reset are a
  pink swell opening through a bandpass sweep with a brown thump under it
  and no click anywhere. `tests/audio_test.ts` holds every water noise to an
  attack. The one hit in the bank is the hull on a ROCK.
- **Every splash gets a tail of bubbles** (`bubblesForEvent`): a handful
  after a landing, the air out of a hull after a dive or a capsize. They are
  sines at Minnaert's frequency (`3.26 / r` Hz·m) chirping UP as they rise,
  and they are gloss — never louder than 0.012.
- **The engine's pitch is arithmetic.** Three cylinders, four strokes:
  `rpm / 60 × 1.5` (`FIRINGS_PER_REV`). The pump's whine is three blades
  past six stator vanes: `rpm / 60 × 18` (`WHINE_PER_REV`). Nothing about
  either is chosen by ear; what IS chosen is the level of every layer.
- **The air is part of the engine's voice.** Off a lip the pump unloads and
  the physics runs the crank free; the bed hears it as `wet` → 0 and `load`
  → 0: the froth and the gurgle go, the whine thins, the hum loses its
  grit. The spray, the wash and the chop go with the water; only the WIND
  keeps going. Do not fake any of this with a `launch` one-shot — the
  one-shot is the sheet leaving, and quiet.
- **The surf comes from the shore, breathing on the sea's own period.**
  `waterTargets` reads `Level.offshore` (the distance) and its gradient (the
  direction, panned through `SCREEN_TO_ENGINE`) and `sea.tp`; nothing about
  the shore is guessed. Inside `SURF_REACH` on a big day the break is the
  loudest thing on the water when the throttle is shut.
- **The sense of speed is the spray, on a power of the pace**, and it needs
  the hull planing. The wind is on the SQUARE of the apparent wind — the
  craft's own speed and the true wind as one vector — so a headwind is loud
  and a tailwind is quiet at the same speed.

## Mixing rules, and they are enforced by test

- The biggest water (a capsize, a dive) is the ceiling at ~0.07 per voice
  and nothing in the bank passes 0.1. Ordinary contacts sit at 0.04–0.06.
  Anything that can happen several times a second (the slap) stays under
  0.05. Gloss layers (tails, bubbles) sit at 0.012–0.02.
- **The course is quieter than the water**: every chime under 0.04. A gate
  is heard OVER a run, never instead of one.
- **A bed's level is heard as written, THROUGH THE LISTENER.** Every target
  is multiplied by the seat's row in `listener.ts` before it reaches the
  layer, and every one-shot by its `events` gain and `muffle` pitch. Retune
  a sound at the CHASE seat and check it from the bow and the heli before
  calling it done. A camera-dependent sound is a COLUMN in the listener
  table, never a branch in a bed or a def.
- **Under a card the whole bed is ducked** (`CARD_DUCK` in `App.tsx`): the
  bot's run behind the front door is scenery. The run's EVENTS make no noise
  at all without the player's hands on the craft.
- Keep every sound's `description` current. It is the sentence the next
  person checks their retune against, and a def without one fails the test.

## Iteration cycle — a SOUND

1. Edit the def in `bank.ts` (or the bed's target function). A new sound
   needs a rung in `route.ts` or a cue that raises it, or it can never play.
2. `make audition` and **listen to it in a browser**, next to the sounds it
   will be heard beside. A sound judged in isolation is a sound that turns
   out to be twice as loud as everything around it.
3. **A session that cannot listen METERS**: `CHROMIUM_PATH=/opt/pw-browsers/chromium
   make audition ARGS=--meter` drives the page headlessly and prints a level
   (dBFS) for every bed preset — idle, the launch, cruise, flat out, the air,
   a storm at the shore — and every sound in the bank. Read it as a SHAPE:
   idle under cruise under flat out; the air under flat out with the water
   gone; the big water at the top of the bank and the chimes at the bottom;
   nothing within a few dB of the limiter. Keep the table before and after,
   and put both in the PR. It is not a judgement — a sound that meters right
   can still be the wrong sound — but a mix that meters wrong IS wrong.
4. `npx vitest run tests/audio_test.ts` — the mix budget, the route
   coverage, the beds' shapes, and every cutoff — authored or computed —
   against the headset's rate.
5. For a BED, move the sliders through the whole range on the audition page.
   The faults are all at the ends: an engine that buzzes at idle, a spray
   that arrives all at once, a surf that does not breathe.
6. **Then hear it in the game** (`npm run dev`), because the mix is the
   point: a landing lands over an engine, a spray bed and the wind. If a
   sound smears the mix, shorten it before quieting it.
7. Loop until each moment is identifiable with your eyes closed.

**The audition page is part of the deliverable, not a courtesy.** A PR that
changes what the game sounds like and gives its reviewer no way to hear it
is a PR nobody can review: say `make audition` in the PR body and paste the
meter's table.

## What the engine will not tell you

- **There is a throttle in the state** (`craft.throttleEff`, after the
  engine's lag), unlike the rally game's. The LOAD is not: it is the
  throttle with water under the pump (`wet`, off `wetted`), so a free rev in
  the air is thin and a pull out of a bay is fat at the same revs.
- **The slam is on the state** (`craft.slam`, N, the wedge impact of the
  probes entering the water). It is a force per STEP and the bed reads the
  last step of the frame; a slam that lasts a few steps is one slap, and
  `SLAP.gap` keeps a short chop from becoming a buzz.
- **The intake's own `intakeWet` is not published** — the bed reads a
  quarter of the bottom wet as a fed pump. If the engine's cut-off and the
  bed's ever disagree audibly, publish the engine's.
- **Hull events under the engine's own floors are silent by design**: no
  `land` under `flight.minAir`, no `hit` under the contact cooldown.

## When a sound is allowed to START

A browser makes no sound before the player has touched something, and a
context built outside a real gesture is one iOS Safari will never resume.
`unlockAudio()` hangs off document-wide `pointerdown` and `keydown` in the
capture phase (`App.tsx`) — never off a cue a hover could raise. Keep that
invariant if you touch `App.tsx`; a menu sound (when one comes) must not
unlock.

## What the change obliges elsewhere

- `make audition` before and after, the meter's table in the PR;
  `npx vitest run tests/audio_test.ts`; `make build` (the bank is on the
  startup path through `App.tsx`, and `make check-seo` holds the budget).
- `docs/audio.md` restates the shape of it; a new layer, a new column in
  the listener or a new kind of cue is a line there.
- A `.changes/unreleased/` fragment — a sound is what the player hears for
  the whole run.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. It owns the lesson
lifecycle: recording what the pass learned (with a `scope` and `concepts`),
fixing anything here that turned out WRONG, deleting what went stale, and
promoting anything true in every run into the vocabulary above.

```sh
node scripts/skill-lessons.mjs sound-effects --list
```

The lessons here are a **palette of parameter recipes that worked** — read
them back before designing a sound, and add to them after.
