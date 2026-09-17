---
title: App.tsx sits ON the 1000-line cap, so any feature that touches the frame loop has to extract first — and the repo's shape for that is a factory over App's own closures
date: 2026-09-17
scope: pwa/src/App.tsx, pwa/src/game/run-surfaces.ts, pwa/src/game/run-actions.ts, pwa/src/game/shot-request.ts
concepts: [file-size, refactor, app, factories]
---

`App.tsx` was 992 lines before this session's feature and the cap is 1000
(`tests/file_size_test.ts`). A feature that adds state, a branch in
`inputFor`, a branch in `stepOnce`, a rate in the frame and two buttons in the
render is ~40 lines at its most frugal — so the work is not "write it
compactly", it is "extract something real first".

`§20.5.1`'s `game-spec:allow-large-file:` marker exists, but taking it for
`App.tsx` is the wrong call: the cap is a size smell and this file genuinely
has coherent pieces in it.

Three extractions that came out clean, each a **factory over App's own
closures** — the `run-settle.ts` / `app-load.ts` shape, where the module owns
the DECISIONS and the app hands over the handful of things only the loop has:

- `run-surfaces.ts` — the five ways a run is left and come back to (pause,
  resume, watch it back, front door, abandon a load). ~60 lines out.
- `run-actions.ts` — what each SURFACE does to a press, whoever pressed it (a
  key, a thumb, a menu-bar row). ~45 lines out.
- `shot-request.ts` — the shutter, whose two halves cannot happen in the same
  moment (claim the clipboard at the press, lift the pixels at the frame).
  ~45 lines out.

Each is a subject somebody could look for by name, which is the test for
whether an extraction is real or is just moving lines. Type the ref off the
extracted module (`useRef<RunSurfaces>`) rather than restating the shape.
