---
title: A staged scene runs ZERO physics steps unless `--t` asks for some, so anything the engine only fills DURING a step is missing from the still — and reads as a broken feature
date: 2026-09-13
scope: scripts/screenshot.mjs, pwa/src/App.tsx, engine/game/place.ts
concepts: [screenshots, scenarios, pre-roll, verification]
---

`App.tsx`'s `stand()` places the craft and then runs `params.t * physicsHz`
steps — and `--t` defaults to the scene's own, which for most scenes is
nothing. So a still of `SCENE=apex` is a craft standing at the apex having
never been stepped.

What that costs is invisible until it bites: every field the engine writes
during `step` rather than at the placement is at its initial value in the
picture. A run record, a `progress` total, a high-water mark — all absent,
and the photograph looks exactly like a feature that does not work. The
altimeter's peak tick was chased as a CSS bug for a while on this.

Two fixes, and they are not alternatives:

- `--t 1.6` rides the scene on from where it was stood, which is also how
  you photograph the AFTER of a moment (the landing past the apex, the
  marker home with the tick still standing).
- If the reading is a derived one a staged moment genuinely has, seed it in
  `placeRun` beside `speed` and `way` — `place.ts` already states the rule:
  a readout a placement leaves stale is one the first frame has to catch up
  on, and a frozen frame never takes that step at all.

And when the question is "is this element where I think it is" rather than
"how does it look", do not crop the PNG: a `getBoundingClientRect` /
`getComputedStyle` probe over `pwa/dist` answers exactly, in seconds.
