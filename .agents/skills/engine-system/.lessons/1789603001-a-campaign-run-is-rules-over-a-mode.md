---
title: A run stood up from a TABLE is the mode's rules with two overridden, never a fifth mode — and a switch the field needs is a `RunRules` field gating one call in `step()`
date: 2026-09-16
scope: engine/game/defs/modes.ts, engine/game/step.ts, engine/game/rivals.ts, pwa/src/game/campaign.ts
concepts: [modes, rules, rivals, contact, standings, campaign]
---

The campaign wanted a race with the field on it and a tricks run with the
field on it, and in both nobody may be leaned on. Neither is a mode: a
campaign level names `race` or `tricks` and `createGame` takes
`rules: { rivals: RACE.rivals, contact: false }` over it. That kept
"nothing below the app branches on a mode's name" true, moved no sim
digest (`OPEN_RULES` gained `contact: true` and has no rivals to clip), and
cost the engine one field and one `if` — `clipRiders` is called from
`step()` only when `state.rules.contact` holds.

Two things fell out that a later system will want:

- A field on a run with the COURSE OFF needs its own ordering. `ahead()`
  in `rivals.ts` reads the banked score when `!rules.course`, so
  `racePlace` is the live standing on a tricks run too and the HUD's
  PLACE readout works unchanged. The buzzer ends the run for everybody
  at once, so there is no "home first" to read there.
- A results sheet needs the WHOLE field, not the player's row.
  `fieldOrder(state)` is the same `ahead()` sort over every run, with
  `null` where the player stands; the app files everybody off it the
  moment the player finishes, since a race's stragglers are not waited
  for. It is read AFTER `step()` returns (the rivals' combos close in the
  same step, after `stepRun`), so it must not be baked into the `timeUp`
  event, which fires before they have.
