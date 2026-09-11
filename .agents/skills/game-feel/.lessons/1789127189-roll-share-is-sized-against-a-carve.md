---
title: An on-craft lens's roll share is sized against the CARVE the hull actually holds (20°, peaking 37°), never against MAX_LEAN — a tilting horizon is what reads as motion sickness
date: 2026-09-11
scope: pwa/src/game/camera-rigs.ts
concepts: [camera, framing, carve, roll, comfort]
---

Reported as "the second closest camera tilts too much when turning, you get
dizzy". `MAX_LEAN` is a full radian, which makes a share look small — 0.35
reads as "a third of the lean" — but the ceiling is not what the hull does.
`make ride SCENARIO=carve` prints the roll column: a hull held on the pump sits
at **20°** and peaks near **37°**. So `nose` at 0.35 was tilting the horizon 7°
in every held turn and 13° in a hard one, and `bow` at 0.5 was reaching 18°.

Size the share off that measurement, not off the ceiling. Under ~5° at the
sustained carve is where the frame reads as a hull leaning; past it the picture
reads as the room being tipped. `nose` 0.16 and `bow` 0.25 (≈3° and ≈5°
sustained) fixed the complaint while still showing the bank — the DECK visibly
banks in frame even with the horizon near level, which is the whole point: the
lean is legible on the hull, and the horizon is the line the rider balances
against.

Pitch is not the same question and does not want the same cut. A pitching lens
reads as the sea rising and falling, which is the sensation the game is for;
only ROLL turns the horizon, and the horizon is the one thing in the picture a
rider's inner ear argues with.

`tests/camera_test.ts` now holds both shares to a ceiling in degrees-at-a-carve
rather than to the bare number, so the next session that reaches for the knob
gets told what it is being sized against.
