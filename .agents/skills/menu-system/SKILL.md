---
name: menu-system
description: "Use when changing the SHELL the game lives inside — the attract card the app opens on, the front door and its CAMPAIGN / mode / OPTIONS / DEVELOPER tiles, the seven-second hold on the craft card's turntable that lets the developer menu out, an options or developer row, the loading card over a run being stood up, the pause card that holds a run mid-ride, how a card is walked on the keys, or anything the game REMEMBERS between visits (pwa/src/game/settings.ts). Owns the five-surface state machine in shell.ts and App.tsx, the DOM-free-payload split every card is built on, the rule that the sea never stops behind a card and the one card it does not hold for, and the `make screenshots SCENE=… --surface` loop that judges the result. Not the readouts over a run in progress — that is `hud-and-menus`."
---

# The menu system: the shell the game lives inside

Everything between opening the page and having hands on a craft, and
everything the game remembers about the visit before. Five surfaces over one
canvas, and one rule they are all arranged around:

**THE SEA NEVER STOPS — EXCEPT UNDER THE PAUSE CARD.** The engine is stepping
and the renderer is drawing behind every card the app can put up, because
every one of them stands over a run the BOT has. A menu that froze that water
would announce that the game is not running, and it is the first thing to
check after any change here. The pause card is the one exception and the one
that proves the rule: it stands over the PLAYER's own run, and a run that
carried on being ridden while its rider read a menu would cost them the gate
they stopped at. `shell.ts`'s `simulates()` is where that line is drawn, and
`tests/menu_system_test.ts` holds it.

**Checking it: the PICTURE, not `frameMs`.** `window.__SH_COST__.frameMs` is
the obvious probe and it is a bad one — under a software rasterizer it
quantizes to a single value and never moves, so a live loop reads as a dead
one. Take two screenshots of the same patch of sea half a second apart and
compare the bytes.

**Read this skill's lessons first** — `node scripts/skill-lessons.mjs
menu-system --list`. Load **`skill-reflection`** at both ends, **`write-code`**
beside this one, **`hud-and-menus`** for anything drawn over a RUN, and
**`ui-review`** for the fit-and-finish sweep at the reference viewports.

## The five surfaces

| Surface | Covers | Where |
| --- | --- | --- |
| `splash` | The house's name while the first shore is built, then the title and an invitation | `splash-screen.tsx` over the timing in `splash.ts` |
| `menu` | The front door, over a bot-ridden sea | `menu-main.tsx` → `menu-start.tsx` → `menu-craft.tsx`, `menu-options.tsx`, `menu-dev.tsx` |
| `loading` | A run being stood up, paid for in slices | `loading-screen.tsx` over `run-loader.ts` |
| `pause` | The run HELD, reached from the minimap or Escape: how the run has gone, then RESUME, OPTIONS, WATCH REPLAY, MAIN MENU | `menu-pause.tsx` over the frozen frame and the HUD |
| `run` | The player's hands on it, with the HUD over the top | `hud.tsx` (`hud-and-menus`) |

The surfaces and what each one MEANS are `pwa/src/game/shell.ts` — DOM-free,
four predicates, all four held by the root suite; `App.tsx` decides only WHEN
one gives way to the next. **One engine state carries through all five** — the
surface decides who rides it (`botInput` under a card, the input manager under
a run) and whether it is ridden at all. Leaving a run for the front door hands
the same craft back to the bot rather than tearing anything down, which is why
the door comes up over the shore the player was just on.

## Where each piece lives

| Piece | Where |
| --- | --- |
| What the game REMEMBERS, and the versioned storage round it | `pwa/src/game/settings.ts` |
| The head with the way out in it | `pwa/src/game/menu.tsx` |
| THE ROW every setting on every surface is: `StepRow` (a named ladder, with its dealt mark), `FadeRow`, `NumberRow`, `KnobGroup`, `Caption` | `pwa/src/game/menu-knobs.tsx` |
| The craft on a turntable, and what the card bills it at | `pwa/src/game/craft-picker.tsx` + `craft-turntable.ts` (three.js, a dynamic chunk) over `craft-stats.ts` (DOM-free) |
| The seven-second hold on the craft card's turntable, and the flourish that answers it | `pwa/src/game/menu-hold.ts` (the rule and the curve) + `craft-picker.tsx` (the pointer, the clock) + `craft-turntable.ts` (the hull turned by it) |
| Walking a card on the keys | `pwa/src/game/menu-nav.ts` (the DOM half) over `menu-cursor.ts` (the geometry) |
| Sequencing a load into phases | `pwa/src/game/run-loader.ts` — DOM-free; the STEPS are closures built in `App.tsx` |
| Which surface is up, and what follows from it | `pwa/src/game/shell.ts` — DOM-free; `playerRides`, `simulates`, `hudOver`, `canPause` |
| The run held mid-ride: RESUME, OPTIONS, WATCH REPLAY, MAIN MENU — and the OPTIONS panel behind the second | `pwa/src/game/menu-pause.tsx`, reached from `minimap.tsx` and Escape |
| WHICH FIGURES a held run is billed with, and in which order | `pwa/src/game/pause-stats.ts` — DOM-free, read by `tests/menu_system_test.ts` |
| The app's mark, building | `pwa/src/game/mark-wave.tsx` over `app-mark.ts`'s paths |
| THE MARKS the cards are read by | `pwa/src/game/menu-glyphs.tsx` — one 24x24 box per idea, stroked in `currentColor`; `make glyphs` is the contact sheet |
| Every word on every card | `pwa/src/game/strings.ts` (§39.1) — no card carries a literal |
| The chrome | `pwa/src/styles.css`, from `── THE MENU SYSTEM` down |

## The rules that are easy to undo by accident

- **The DOM-free payload split, exactly as `hud-and-menus` states it.** The
  decision is a pure module the root suite reads without a browser
  (`tests/menu_system_test.ts`); the `.tsx` only renders it. `splash.ts`,
  `menu-hold.ts`, `menu-cursor.ts`, `run-loader.ts`, `shell.ts` and
  `settings.ts`'s `mergeSettings` are all on the testable side of that line,
  and a rule moved
  out of one of them into its component is a rule that stops being checked.
- **A ROW CANNOT ASK A QUESTION WHOSE ANSWERS ARE SHAPES.** A ladder works
  because the answer, its pips and its two arrows say the whole choice in a
  row's width; four craft named on one asks a rider to choose between four
  hulls they have never seen, which is the reason the craft is a card of its
  own (`menu-craft.tsx`) rather than a row on the start card — the second of
  the two, with RIDE on it, so the last thing seen before the water is the
  hull. It writes the same `settings.ride.craft` a row would have, so a run
  stood up from it and a run stood up from a `?craft=` link are one run.
- **THE PAUSE CARD FREEZES; NOTHING ELSE DOES.** It is the only surface
  standing over a run the PLAYER has, so `simulates("pause")` is false, the
  frame is rendered with dt 0 and the accumulator is never asked for steps.
  What must NOT happen on the way back is the absence being paid down — hold
  a run for three seconds, resume, and the clock has to move by one frame and
  not by three seconds (§37.2, and the same rule a hidden tab gets).
- **RESUME IS THE CARD'S `data-nav-back` AND ITS `data-nav-focus`.** A card
  opened by a thumb aiming for the minimap must cost one press to leave, and
  the row under it hands the run back to the bot — so Escape, the backdrop and
  the cursor's landing all have to be the way back to the water. Without the
  focus mark the cursor skips RESUME (a way OUT is normally a chevron nobody
  came for) and lands on the first row that is not it.
- **A settings row the app IGNORES is worse than no row.** The player moves
  it, nothing happens, and now nothing else on the page can be trusted
  either. There is no volume fader while `game/audio/` is a placeholder, and
  no bindings while `input.ts` carries a fixed table. Each becomes a row the
  day the thing behind it exists — as the picture rows did, once
  `settings-video.ts` gave the renderer a ladder and `renderer.setVideo` a
  place to read it. The pause card is where this bites hardest: its
  OPTIONS panel stands over a FROZEN run, so every row on it has to apply to
  the frame the player is looking at — which is why `settings.ride.camera`
  reaches the renderer the moment it moves and not only when the next run is
  stood up.
- **ONE SILHOUETTE FOR EVERY SETTING, AND NO ROW EXPLAINS ITSELF.** Name,
  value between two arrows, and under the value either the pips or a fader's
  track (`menu-knobs.tsx`) — a switch is a two-stop ladder and a fader is a
  ladder drawn as a track, so a player learns one row and can read every
  page. **The value stands on ONE line down the whole column**, faders
  included: a row that put its reading beside its control instead of over it
  was the one place the eye had to go looking. The sentences go to the ONE
  caption bar a page owns, which NAMES the row the pointer or the cursor is
  on and then says what it does: a row that carries its own prose is two
  lines of HEIGHT, and a column of them is a card that scrolls on a phone.
- **A PAGE OF ROWS IS FOUND BY ITS GROUPS, AND A GROUP IS FOUND BY ITS MARK.**
  One silhouette for every setting is what makes a page readable and also
  what makes it unscannable — a dozen identical rows is a list to be searched.
  `KnobGroup` takes a `glyph` for that reason: the mark is the only thing in
  the column that is not text, so a rider picks the group without reading. The
  groups are then ordered by what a rider REACHES for, not by subject tidiness
  — the hands first (OPTIONS opens on CONTROLS ▸ KEY BINDINGS), the machine
  last (PICTURE).
- **THE PAUSE CARD CARRIES A PANEL, NOT THE OPTIONS PAGE — AND NOT A STRIP.**
  The sound, the camera, the HUD and the frame-rate counter read perfectly
  well over a held frame; a picture row is judged against a sea that is
  MOVING, and stopping it is the one thing this card does — so those wait for
  the front door. What the four are NOT is rows on the card itself: nine
  people in ten open this card for RESUME, and every knob above that press is
  a knob in the way of it. They live behind one OPTIONS row, which costs the
  card a single line and still does the strip's second job — standing between
  RESUME and the press that ends the run. Each face owns its own
  `data-nav-back` (RESUME on the card, the head's ‹ on the panel) and the
  backdrop presses whichever is up, so the way out is always one press and
  always the same step.
- **The stored blob is merged FIELD BY FIELD and every value is CHECKED**
  against what this build offers (`mergeSettings`). A value off a ladder is
  one the menu has no stop to put the cursor back on, so the player can never
  return to it — `Object.assign` over the whole thing is the bug.
- **A HOLD BELONGS ON SOMETHING A PRESS DOES NOTHING TO, AND IT OWES AN
  ANSWER.** The seven-second hold sat on RACE for a while, and a button whose
  ordinary job is to start a run has to decide whether the finger lifting off
  it was a press — a release that changes the card under the finger raises no
  `click` at all, so a flag held for one waits for a press that never comes
  and eats the next real one. The craft card's TURNTABLE has neither problem:
  nothing presses it, so there is nothing to swallow, and the hull is already
  turning, so the card can answer without drawing anything new. It does —
  `flourishRate` whips it round twice and settles it back (`menu-hold.ts`).
  A hold that fires silently on a surface with nothing to say reads as a
  feature that stopped working, which is how this one came to be reported
  missing.
- **EXACTLY ONE LIT CONTROL PER CARD, and the colour means one thing.** The
  buoy's orange is the way ON; a second orange control on the same surface
  does not double the invitation, it cancels it — the eye is handed a choice
  where it came for an answer, and a player then has to READ the card to find
  out which press was meant. The front door's rule is the general one: the
  colour says how close the press is to water (lit = the way in, the card's
  blue = a way onto water, the foot strip = not water at all), and that is
  one sentence a player never has to be taught. `data-nav-next` follows the
  same rule for the same reason — one way on, or START presses whichever the
  DOM happened to put first.
- **AN ARRIVAL ANIMATION IS `backwards`, NEVER `both` OR `forwards`.** The
  fill has one job: hold an element off screen through its own
  `animation-delay` so a stagger reads as a deal rather than a flicker. A
  FORWARDS fill keeps applying the last keyframe at animation priority after
  the animation has ended, and animation priority outranks the cascade — so
  `:active`'s press transform silently stops working and the card comes up
  beautifully and then never depresses under a thumb. It photographs
  perfectly either way; the only way to catch it is to press the thing and
  measure the box (`previews/` probe, `getBoundingClientRect`).
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
CHROMIUM_PATH=/opt/pw-browsers/chromium make glyphs                     # a mark changed
CHROMIUM_PATH=/opt/pw-browsers/chromium node scripts/screenshot.mjs --surface all
CHROMIUM_PATH=/opt/pw-browsers/chromium make screenshots SCENE=cruise   # the run behind it
npx vitest run tests/menu_system_test.ts
```

`--surface splash,menu,start,craft,gallery,options,keys,developer,pause,pauseOptions` photographs the cards at both
reference viewports; it waits on the card being in the DOM rather than on
`window.__SH_READY__`, which is a RUN's flag. Then LOOK, and run `ui-review`'s
audit at 1280×720 and 390×844.

**A MARK IS JUDGED ON THE SHEET, NEVER ON THE CARD.** A tile shows one
glyph, at one size, over moving water: a silhouette that has gone to mush at
the size a phone draws it comes back looking like a card that is fine. `make
glyphs` draws the whole set at 14, 22 and 40 px over the menu's own plate,
which is where two drafts of a craft in profile died — a wedge with a stick
on it, and the same wedge over a wave, both a horizontal smear at the small
end. What replaced them stands UP out of the water (the buoy), because a
vertical against the wave's horizontal is the thing that survives.

**A CARD THAT OUTGREW THE VIEWPORT PHOTOGRAPHS PERFECTLY.** `.menu-card` is
`max-height: 100%; overflow-y: auto`, so a card a row too tall does not clip,
does not wrap and does not show in any diff — its last control simply sits
below the fold, and the lab shoots the top of it either way. Anything that
adds HEIGHT to a settings card (a group, a heading, a taller row) is measured
rather than looked at: drive both viewports, read `scrollHeight` against
`clientHeight` on `.menu-card-*`, and take the numbers BEFORE the change as
well as after — the phone's OPTIONS and start cards run within twenty pixels
of an 844-tall window, so "it still fits" is not a thing a session can assume.

**A picture is not the machine.** The surfaces can all photograph correctly
while the shell is broken — the hold bug above passed every screenshot. Drive
the real flow before calling a change done: attract card → a press → the
front door → START → the craft card and back → RIDE → the loading card →
the HUD, then Escape into the pause card and Escape out of it again, and the
hold on START twice over (the second press after an unlock is the one that
breaks). The pause card's own version of the trap is that it photographs
identically whether or not the run under it actually stopped: check the clock
and the speedo, held, and check that resuming after three seconds does not
jump the run forward by three seconds. The craft card has its own version of that
trap: the turntable is a DYNAMIC chunk, so a pick taken before it lands has
to be waiting for it — which is why the chosen id rides on the canvas's own
dataset and not only in a ref.

## What the change obliges elsewhere

- A new URL parameter or surface → `docs/configuration.md`, `App.tsx`'s
  header, the reader in `url-params.ts`, and `scripts/screenshot.mjs` if the
  lab should reach it.
- A word on a card → `strings.ts`, never a literal in the component.
- A new setting → `mergeSettings` **and** a case in `tests/menu_system_test.ts`
  for what an older blob does to it.
- Anything the player sees → a `.changes/unreleased/` fragment.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. A settled rule about
what a card may do to the game behind it — or about which half of a surface
belongs on the testable side of the line — belongs in the rules above once it
has held twice.
