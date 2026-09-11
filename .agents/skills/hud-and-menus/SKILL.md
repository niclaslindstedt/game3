---
name: hud-and-menus
description: "Use when changing WHAT THE PLAYER READS AND PRESSES DURING A RUN — a HUD readout (the speed, the rpm bar, the run clock and gate count, the last split, the wind vane, the air time, the build label), the touch controls (the handlebar overlay on the left, the analogue throttle lever you drag DOWN on the right) and their bindings, the keyboard map, or the minimap. Owns the DOM-free-payload split every one of these is built on, the thumb-guard discipline, and where each surface lives. The CARDS around a run — the attract screen, the front door, options, the developer page, the loading card, the settings they read and write — are `menu-system`. Load `ui-review` beside either for the screenshot-audit sweep that judges the result."
---

# The HUD and the controls: what the player reads and presses

Everything on screen during a RUN that is not the world. Two surfaces, one
rule: the
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

**The CARDS are next door.** The attract screen, the front door and its
START / OPTIONS / DEVELOPER rows, the loading card, and everything the game
remembers between visits (`settings.ts`) are **`menu-system`** — load that
one instead. The split is what is up: this skill owns what is drawn over a
run in progress, that one owns the shell around it. They share the payload
rule above, and `input.ts` sits on the seam — the keys that ride a craft are
here, the keys that walk a card are there.

## The HUD

| Surface | Where |
| --- | --- |
| The readouts: speed (km/h, big), the rpm bar (no gear — a PWC has none), the run clock, gate `n / N`, the last split, the air time while airborne, the build label in the corner | `pwa/src/game/hud.tsx` + `pwa/src/styles.css` |
| A dial or a bar, as a component | `pwa/src/game/hud-dial.tsx` — the rpm bar is one; a temperature or a fuel gauge, when they come, are others |
| The WIND VANE — direction as a needle, speed as a figure | in `hud.tsx`, reading `state.wind`; it says where the sea is coming from, and the sea comes from there (`water-feel`) |
| What the speedo READS | `CraftState.speed` — `|v|`, vertical included; stated once in `engine/game/state.ts`, never re-derived in the HUD |
| The split against the last gate | `Progress.splits` / `lastGatePassedAt` in `engine/game/course.ts` — the HUD shows it, never computes it |
| The `__SH_READY__` flag the screenshot harness waits on | `App.tsx`, set once the first frame has drawn — a HUD change that delays it is a harness that times out |
| The minimap | `pwa/src/game/minimap-scene.ts` (the coast cut into paths around an ANCHOR, translated to the craft every frame — one ladder of ground heights, each band's edge cut THROUGH the lattice, and `spanNow`'s smoothed window), `minimap-view.ts` (the gates, the chevron, the gauge, the scale bar, the readout), `minimap.tsx` (the glyphs, the two textures and the DOM) — the split above, and `tests/minimap_test.ts` reads the two payload halves without a browser |
| What the map says the shore IS | the bands' paint in `styles.css`: the wood's green and the bare stone over `TREE_LINE` are the WORLD's own (`terrain.ts`, `identity.ts`'s `pine`/`granite`), not a chart palette of their own — a map that invents a colour for the shore is a map that disagrees with what the rider can see |
| The way OUT of a run | Escape, an `InputAction` in `input.ts` that `App.tsx` turns into the front door coming up (`menu-system`) |

## The controls

| Surface | Where |
| --- | --- |
| What a key or a touch MEANS, as maths | `pwa/src/game/input-model.ts` — DOM-free: the throttle ramp, the steer ramp, the lever's drag → throttle curve, the handlebar's travel → steer/lean; `tests/input_model_test.ts` reads it |
| Listening to the DOM | `pwa/src/game/input.ts` — keyboard (W throttle, S/↓ lean back, Shift/↑ lean forward, A/D ←/→ steer, R reset to the last gate, Enter restart, C camera, Escape out to the menu) and the touch zones; nothing here decides, it only feeds the model |
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
- **The minimap draws in SCREEN space, and that is downstream of ONE flip.**
  `input-model.ts`'s `SCREEN_TO_ENGINE` is the sign boundary; the map's
  projection (`mx = -x`, `my = -z`) and the icon's negated heading are the
  same decision applied to a picture, so a right-hand turn swings the icon
  clockwise. North is up and east is LEFT — the price of agreeing with the
  chase camera, and not a bug to be tidied.
- **The build label is §38's "the running build says what it is".** It reads
  `engine/version.ts` and the build's short hash; do not drop it for room.
- **A new colour on this screen owes the night dressing a ramp.** The HUD dips
  with the craft's lamp — `snapshot.dark` on the root as `--hud-dark`, and the
  block on `.hud` in `styles.css` where every dipped token is a `color-mix` or
  a `calc` along it. Anything added in a literal white or a hard navy is a
  lamp in the corner of a night frame; take it off `--hud-ink`, `--hud-plate`,
  `--hud-edge` or `--hud-track` instead. What stays at full strength is the
  SIGNAL — `--hud-bad` (every warning) and `--hud-good` (the buoy orange, which
  has to agree with the buoys out on the water) — and that is a decision, not
  an oversight.
- **A menu is not a saving.** The menu's backdrop is the real game, ridden by
  the bot — a menu that stops the sea is a bug. That rule and the cards it
  governs are `menu-system`'s; it is restated here because a HUD change that
  reaches into `App.tsx`'s loop can break it from this side.

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
  start; `tests/input_model_test.ts` for the maths. A key that means
  something to a CARD as well goes past `menu-system` too.
- A readout → a scene that photographs it, if none does (`scenarios.ts` +
  `scripts/screenshot.mjs`), and `docs/getting-started.md`.
- Anything the player sees → a `.changes/unreleased/` fragment.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. A settled rule of
thumb about the thumbs — where a zone may reach, what a drag may mean —
belongs in the traps above once it has held twice.
