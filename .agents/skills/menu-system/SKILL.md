---
name: menu-system
description: "Use when changing the SHELL the game lives inside — the attract card the app opens on, the front door and its START / OPTIONS / DEVELOPER rows, the seven-second hold that lets the developer menu out, an options or developer row, the loading card over a run being stood up, how a card is walked on the keys, or anything the game REMEMBERS between visits (pwa/src/game/settings.ts). Owns the four-surface state machine in App.tsx, the DOM-free-payload split every card is built on, the rule that the sea never stops behind a card, and the `make screenshots SCENE=… --surface` loop that judges the result. Not the readouts over a run in progress — that is `hud-and-menus`."
---

# The menu system: the shell the game lives inside

Everything between opening the page and having hands on a craft, and
everything the game remembers about the visit before. Four surfaces over one
canvas, and one rule they are all arranged around:

**THE SEA NEVER STOPS.** The engine is stepping and the renderer is drawing
behind every card the app can put up. A menu that froze the water would
announce that the game is not running, and it is the first thing to check
after any change here — `window.__SH_COST__.frameMs` keeps moving while a
card is up, or the change is wrong.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
menu-system --list`. Load **`skill-reflection`** at both ends, **`write-code`**
beside this one, **`hud-and-menus`** for anything drawn over a RUN, and
**`ui-review`** for the fit-and-finish sweep at the reference viewports.

## The four surfaces

| Surface | Covers | Where |
| --- | --- | --- |
| `splash` | The house's name while the first shore is built, then the title and an invitation | `splash-screen.tsx` over the timing in `splash.ts` |
| `menu` | The front door, over a bot-ridden sea | `menu-main.tsx` → `menu-start.tsx` → `menu-craft.tsx`, `menu-options.tsx`, `menu-dev.tsx` |
| `loading` | A run being stood up, paid for in slices | `loading-screen.tsx` over `run-loader.ts` |
| `run` | The player's hands on it, with the HUD over the top | `hud.tsx` (`hud-and-menus`) |

The state machine is `Shell` in `App.tsx`, and **one engine state carries
through all four** — the mode only decides who rides it, `botInput` under a
card and the input manager under a run. Leaving a run (Escape) hands the same
craft back to the bot rather than tearing anything down, which is why the
front door comes up over the shore the player was just on.

## Where each piece lives

| Piece | Where |
| --- | --- |
| What the game REMEMBERS, and the versioned storage round it | `pwa/src/game/settings.ts` |
| The shared row vocabulary: the head, `OptionRow` (with its dealt mark), `SliderRow`, `StepRow`, `ToggleRow` | `pwa/src/game/menu.tsx` |
| The craft on a turntable, and what the card bills it at | `pwa/src/game/craft-picker.tsx` + `craft-turntable.ts` (three.js, a dynamic chunk) over `craft-stats.ts` (DOM-free) |
| The seven-second hold on START | `pwa/src/game/menu-hold.ts` (the rule) + `menu-main.tsx` (the pointer, the key, the clock) |
| Walking a card on the keys | `pwa/src/game/menu-nav.ts` (the DOM half) over `menu-cursor.ts` (the geometry) |
| Sequencing a load into phases | `pwa/src/game/run-loader.ts` — DOM-free; the STEPS are closures built in `App.tsx` |
| The app's mark, building | `pwa/src/game/mark-wave.tsx` over `app-mark.ts`'s paths |
| Every word on every card | `pwa/src/game/strings.ts` (§39.1) — no card carries a literal |
| The chrome | `pwa/src/styles.css`, from `── THE MENU SYSTEM` down |

## The rules that are easy to undo by accident

- **The DOM-free payload split, exactly as `hud-and-menus` states it.** The
  decision is a pure module the root suite reads without a browser
  (`tests/menu_system_test.ts`); the `.tsx` only renders it. `splash.ts`,
  `menu-hold.ts`, `menu-cursor.ts`, `run-loader.ts` and `settings.ts`'s
  `mergeSettings` are all on the testable side of that line, and a rule moved
  out of one of them into its component is a rule that stops being checked.
- **A ROW CANNOT ASK A QUESTION WHOSE ANSWERS ARE SHAPES.** Chips work
  because the answer and everything it was chosen over are on screen
  together; four craft named in a row asks a rider to choose between four
  hulls they have never seen, which is the reason the craft is a card of its
  own (`menu-craft.tsx`) rather than a row on the start card — the second of
  the two, with RIDE on it, so the last thing seen before the water is the
  hull. It writes the same `settings.ride.craft` a chip row would have, so a
  run stood up from it and a run stood up from a `?craft=` link are one run.
- **A settings row the app IGNORES is worse than no row.** The player moves
  it, nothing happens, and now nothing else on the page can be trusted
  either. There is no volume fader while `game/audio/` is a placeholder, and
  no bindings while `input.ts` carries a fixed table. Each becomes a row the
  day the thing behind it exists — as the picture rows did, once
  `settings-video.ts` gave the renderer a ladder and `renderer.setVideo` a
  place to read it.
- **The stored blob is merged FIELD BY FIELD and every value is CHECKED**
  against what this build offers (`mergeSettings`). A value off a ladder is
  one the menu has no chip to put the cursor back on, so the player can never
  return to it — `Object.assign` over the whole thing is the bug.
- **A completed hold is not also a press, and `armed` must still be SPENT.**
  The release that arms the hold is the one release certain to change the
  card under the finger (the DEVELOPER row appears), and a browser raises no
  `click` when press and release land on different elements — so the flag
  waits for a press that never comes and eats the next real one instead. The
  clock in `menu-main.tsx`'s `end` is what stops that; do not remove it
  because "the click always arrives". It does not.
- **Every fill on the LOADING card is a `transform`.** The phases that need a
  bar most are single indivisible calls that hold the main thread for
  seconds, and a width or a stroke animated on that thread freezes solid for
  exactly as long as the player most needs to see something moving. The mark
  is a compositor WIPE for the same reason, never `stroke-dashoffset`.
- **The count on the loading card is of PHASES, never of seconds.** A bar per
  phase only has to be right about the phase it is under; one bar across the
  whole load reaches nine tenths and sits there.
- **Confirm is the BROWSER's.** Every control on every card is a real
  `<button>`, so Enter and Space on a focused one already activate it.
  `menu-nav.ts` is wired for the DIRECTIONS and BACK only — a `confirm` on
  top would press the row twice, which on START is a run started over the top
  of the developer menu the hold just opened.
- **The cursor's ring only appears once somebody has walked a card with the
  keys.** A ring that arrived under a mouse is a second cursor moving on its
  own; `App.tsx` gates `nav.sync()` on that.
- **Anything reachable from a card is reachable as a URL.** Every developer
  row is a parameter `App.tsx` already reads, `?menu=` opens the front door
  on a page, and COPY REPRO LINK writes the lot back out. That is what makes
  a frame somebody found handable to somebody else — keep it true when adding
  a row.

## The loop

```sh
make build
CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/screenshot.mjs --surface all
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=cruise   # the run behind it
npx vitest run tests/menu_system_test.ts
```

`--surface splash,menu,start,craft,options,developer` photographs the cards at both
reference viewports; it waits on the card being in the DOM rather than on
`window.__SH_READY__`, which is a RUN's flag. Then LOOK, and run `ui-review`'s
audit at 1280×720 and 390×844.

**A picture is not the machine.** The surfaces can all photograph correctly
while the shell is broken — the hold bug above passed every screenshot. Drive
the real flow before calling a change done: attract card → a press → the
front door → START → the craft card and back → RIDE → the loading card →
the HUD, then Escape back, and the hold on START twice over (the second press after an
unlock is the one that breaks). The craft card has its own version of that
trap: the turntable is a DYNAMIC chunk, so a pick taken before it lands has
to be waiting for it — which is why the chosen id rides on the canvas's own
dataset and not only in a ref.

## What the change obliges elsewhere

- A new URL parameter or surface → `docs/configuration.md`, `App.tsx`'s
  header, and `scripts/screenshot.mjs` if the lab should reach it.
- A word on a card → `strings.ts`, never a literal in the component.
- A new setting → `mergeSettings` **and** a case in `tests/menu_system_test.ts`
  for what an older blob does to it.
- Anything the player sees → a `.changes/unreleased/` fragment.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. A settled rule about
what a card may do to the game behind it — or about which half of a surface
belongs on the testable side of the line — belongs in the rules above once it
has held twice.
