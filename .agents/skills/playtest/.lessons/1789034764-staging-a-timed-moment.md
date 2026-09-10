---
title: A still is captured where the run is STOOD, not at the end of the scenario's script — so stage a timed moment with `RunMoment.clock`, and never point the craft straight at the subject
date: 2026-09-10
scope: pwa/src/game/scenarios.ts, engine/game/place.ts, scripts/screenshot.mjs
concepts: [screenshots, scenarios, camera, fauna]
---

Three separate rounds were lost photographing an event that happens on its
own schedule (a dolphin breaching once a minute). Each has a one-line fix:

- **`scenario.seconds` is not when the shot is taken.** `App.tsx`'s
  `stand()` rides `params.t` seconds — the URL's `t`, default 0 — and then
  freezes; `seconds` is the hand-over length and the ride lab's strip, and
  the screenshot tool never passes it. Leaving the craft to WAIT for the
  moment also fails on its own: NEUTRAL input for twenty seconds is a hull
  the wind has carried out of its own frame. Set `RunMoment.clock` instead
  — it winds `state.t` (the sea, the wind, the sea life) before anything
  reads a height, so the moment is stood at, not waited for.
- **The chase camera puts the rider's back in the middle of the picture.**
  Anything the craft is pointed straight at appears behind his shoulders
  and is simply not in the shot. Swing the aim a few degrees off, or stand
  a few metres to one side of the subject's track.
- **An arc seen end-on is a dot.** Standing on the subject's own track
  looking back down it shows a 2.7 m dolphin as its 0.6 m cross-section,
  which reads as a grey blob and cost two rounds of "why is it so far
  away". Stand ABEAM. And photograph a ballistic arc on the way UP, not at
  the apex where the vertical speed is zero and the animal is level: half
  way up it is nose-high at fifty-odd degrees, which is the attitude that
  says leap.

When a subject cannot be found in a frame, dump its distance and height
from inside the update loop with `console.warn` — the tool relays warnings
(not `console.log`) — before guessing at pixels.
