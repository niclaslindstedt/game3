---
name: hud-and-menus
description: "Use when changing WHAT THE PLAYER READS AND PRESSES — a HUD readout (the speed, the rpm bar, the run clock and gate count, the last split, the wind vane, the air time, the build label), the touch controls (the handlebar overlay on the left, the analogue throttle lever you drag DOWN on the right) and their bindings, the keyboard map, or — once they exist — a menu page, a setting, the minimap. Owns the DOM-free-payload split every one of these is built on, the thumb-guard discipline, and where each surface lives. Load `ui-review` beside it for the screenshot-audit sweep that judges the result."
---

# The HUD and the controls: what the player reads and presses

Everything on screen that is not the world. Two surfaces, one rule: the
**decision is DOM-free, the DOM only renders it**. A payload module works out
what to show — the numbers, the framing, what a drag MEANS — and a `.tsx`
component draws it. That split is why the root vitest suite can test the
throttle lever's gesture without a browser (`tests/input_model_test.ts`), and
it is the first thing to preserve in any change here.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
hud-and-menus --list`. Load **`skill-reflection`** at both ends, **`write-code`**
beside this one, and **`ui-review`** for the fit-and-finish sweep at the
reference viewports. For what a readout MEANS (the wind vane's promise, the
air time as a moment) load `game-feel`.

## The HUD

| Surface | Where |
| --- | --- |
| The readouts: speed (km/h, big), the rpm bar (no gear — a PWC has none), the run clock, gate `n / N`, the last split, the air time while airborne, the build label in the corner | `pwa/src/game/hud.tsx` + `pwa/src/styles.css` |
| A dial or a bar, as a component | `pwa/src/game/hud-dial.tsx` — the rpm bar is one; a temperature or a fuel gauge, when they come, are others |
| The WIND VANE — direction as a needle, speed as a figure | in `hud.tsx`, reading `state.wind`; it says where the sea is coming from, and the sea comes from there (`water-feel`) |
| What the speedo READS | `CraftState.speed` — `|v|`, vertical included; stated once in `engine/game/state.ts`, never re-derived in the HUD |
| The split against the last gate | `Progress.splits` / `lastGatePassedAt` in `engine/game/course.ts` — the HUD shows it, never computes it |
| The `__SH_READY__` flag the screenshot harness waits on | `App.tsx`, set once the first frame has drawn — a HUD change that delays it is a harness that times out |
| The minimap | `pwa/src/game/minimap.ts` — a PLACEHOLDER with a header comment. When it is built it follows the split above: a DOM-free scene module the tests read, a `.tsx` that draws it |

## The controls

| Surface | Where |
| --- | --- |
| What a key or a touch MEANS, as maths | `pwa/src/game/input-model.ts` — DOM-free: the throttle ramp, the steer ramp, the lever's drag → throttle curve, the handlebar's travel → steer/lean; `tests/input_model_test.ts` reads it |
| Listening to the DOM | `pwa/src/game/input.ts` — keyboard (W/↑ throttle, S/↓ lean back, A/D ←/→ steer, Shift lean forward, R reset to the last gate, Enter restart, C camera) and the touch zones; nothing here decides, it only feeds the model |
| Touch: the HANDLEBAR overlay | `pwa/src/game/hud-touch.tsx`, LEFT half — thumb travel → steer, vertical travel → lean; drawn as a bar that tilts with the thumb |
| Touch: the THROTTLE LEVER | `hud-touch.tsx`, RIGHT half — the touch anchors at 0, dragging DOWN opens the throttle (full at ~90 px), analogue, held while the finger is down, released on lift; drawn as a lever that follows the thumb |
| A zone's grip on a finger | the thumb-guard discipline in `hud-touch.tsx`: a touch belongs to the zone it STARTED in until it lifts, whatever it wanders over; a second finger on the same half is ignored, not merged |
| The `reset` edge | `CraftInput.reset` is an EDGE — true for one step — and `input-model.ts` is where a held key becomes one |

## The traps

- **The throttle lever drags DOWN, and that is a decision, not an accident.**
  A thumb resting on the lower-right of a phone held sideways pulls toward
  the palm; dragging down is the motion that is easy to hold at speed and
  easy to feather. A lever that opens UPWARD fights the hand. Keep the anchor
  at the touch point (never a fixed on-screen zero), so the lever works
  wherever the thumb lands.
- **Analogue means analogue.** The lever's output is a 0..1 the engine reads
  straight into `throttle`; a keyboard's throttle is RAMPED to 1 in
  `input-model.ts` so a key press does not read as a lever slammed open. Do
  not quantise either.
- **Lean has TWO thumbs.** The handlebar's vertical travel leans on touch;
  S/Shift lean on keys. A HUD change that moves the handlebar's zone changes
  how far a thumb can lean — check `input-model.ts`'s travel-to-lean curve
  still reaches ±1.
- **The HUD reads `GameState` and writes nothing.** No HUD-side timer, no
  HUD-side split arithmetic, no HUD-side "airborne" guess from `y`. If a
  readout needs a number the engine does not expose, the engine grows a
  field (the `engine-system` skill) — never the HUD a formula.
- **The build label is §38's "the running build says what it is".** It reads
  `engine/version.ts` and the build's short hash; do not drop it for room.
- **A menu is not a saving.** When menus come (`menu-main.tsx` is a
  placeholder), the sibling game's rule applies: the menu's backdrop is the
  real game, ridden by the bot under a drone camera. A menu that stops the
  sea is a bug.

## The loop

```sh
make build
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=cruise     # the HUD at speed, both viewports
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=launch     # …with the air time up
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=rest       # …at rest, every readout at its floor
npx vitest run tests/input_model_test.ts                                  # the gestures, headless
```

Then run `ui-review`'s audit at the reference viewports (desktop landscape
1280×720 and phone portrait 390×844, and rotation is its own case). A HUD
change is not finished until it has been LOOKED at on a phone-shaped
viewport — the failure mode here is always overlap, clipping, or a control
under a thumb that already has a job: the throttle thumb owns the lower
right, the handlebar thumb the lower left, and no readout that must be
watched mid-turn goes under either.

## What the change obliges elsewhere

- A key or a gesture → `docs/getting-started.md` and the README's Quick
  start; `tests/input_model_test.ts` for the maths.
- A readout → a scene that photographs it, if none does (`scenarios.ts` +
  `scripts/screenshot.mjs`), and `docs/getting-started.md`.
- Anything the player sees → a `.changes/unreleased/` fragment.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. A settled rule of
thumb about the thumbs — where a zone may reach, what a drag may mean —
belongs in the traps above once it has held twice.
