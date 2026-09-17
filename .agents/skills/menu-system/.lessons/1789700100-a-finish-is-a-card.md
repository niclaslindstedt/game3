---
title: The plate over a finished run is a CARD, not a readout — and a headless finish costs minutes of wall clock, so drive the buzzer and inject the markup for the look
date: 2026-09-17
scope: pwa/src/game/hud-result.tsx, pwa/src/game/hud.tsx, pwa/src/App.tsx, pwa/src/game/run-surfaces.ts
concepts: [finish, result, pause, layout, verification, viewports]
---

A finished run COASTS: `run.ts` hands the craft `NEUTRAL_INPUT` from the line
or the buzzer on, so the throttle, the bars and the reset all stop answering.
That is the run being over — but with only a figure on the plate, it was
REPORTED AS A FREEZE, twice: nothing on screen said the run had ended and
nothing on it could be pressed. Anything the app puts up at a moment the
controls stop answering owes the player a way on, as a press, not as a note.

Three things followed from taking that seriously:

- **The ways on are `run-surfaces.ts`'s, all three.** RIDE AGAIN went in
  beside WATCH and MENU rather than staying a closure in `run-actions.ts`'s
  world, so the plate presses the very line the B key presses and the pause
  card's rows press. A surface that grew its own restart would be the second
  button `run-actions.ts`'s header forbids.
- **It is not a readout, so it is not inside `settings.hud.on`.** The replay
  bar and the new-build notice were already outside it for the same reason;
  three statements of one rule is a restatement, so state it once over all
  three layers and let each carry a pointer.
- **`.hud-card`'s `border` SHORTHAND is declared LATER in styles.css than
  `.hud-result-record`'s `border-color`.** At equal specificity the later rule
  wins, so the gold rim a new record earns had never painted a single card.
  Qualify it (`.hud-card.hud-result-record`). Check any `.hud-*` modifier that
  sets one longhand of a shorthand the base class sets.

**VERIFYING A FINISH IS THE HARD PART.** There is no `?finished=1`, and
headless Chromium on swiftshader runs the engine at a fraction of real time —
2.6 s of run clock per 30 s of wall at the default picture. Two things make it
tractable:

- The **tricks buzzer** is the only finish inside a few minutes:
  `?start=1&mode=tricks&minutes=2` plus the picture wound all the way down
  (`water=low&res=low&detail=low&distance=low&see=0&fps=max`) gets ~58% of real
  time, so 120 s of run is ~3.5 min of waiting. Two pages in one browser
  (`Promise.all`) tests two presses for the price of one wait. That is how the
  plate going up, RIDE AGAIN standing a fresh run and MAIN MENU reaching the
  front door were each confirmed rather than assumed.
- For the LOOK alone, do not wait at all: load any run and
  `insertAdjacentHTML` the card's own markup into the page. The real
  stylesheet lays it out, `boundingBox()` gives the gutter in pixels, and all
  three reference viewports cost one minute instead of twelve.
