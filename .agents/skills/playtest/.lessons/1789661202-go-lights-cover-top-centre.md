---
title: The GO! lights sit on top of every staged scene, so a TOP-CENTRE readout can only be photographed with `--mode free`
date: 2026-09-17
scope: scripts/screenshot.mjs, pwa/src/game/scenarios.ts
concepts: [screenshots, hud, scenarios, verification]
---

Every `make screenshots SCENE=…` shot is taken at the run clock's zero, and
`snap.go` is true for the first second of any mode with a countdown
(`GO_HOLD` in `snapshot.ts`). The lights are drawn dead centre and as big as
the frame allows, so they land squarely on the AIR CLOCK — a scene staged
precisely to show it (`apex`, which sets `airTime` so the hang does not read
as a hop) comes back with the readout completely hidden, and it looks like
the readout is broken rather than covered.

`ARGS="--mode free"` is the fix: FREE has no countdown, so `go` is false and
the top-centre cluster is in the clear from the first frame. The output is
named `shot-<scene>-free-*`, so a before/after pair keeps its own filenames.

Worth knowing before you conclude a HUD change did not land: check the
picture for a giant orange GO! before checking the code.
