---
title: To find what a DETAIL lever costs in a frame, profile two stops of it and read the SLOPE — `make profile` never breaks one frame down
date: 2026-09-11
scope: scripts/profile-render.mjs, pwa/src/game/settings-video.ts
concepts: [profiling, tooling, performance, video]
---

`make profile` prints one triangle total a scene and nothing about where it went, and
adding per-object instrumentation to the renderer to answer that is a change you then
have to take back out. The cheap answer is to run the same scene at two stops of the
row you suspect and divide:

```sh
for d in low medium high; do npm run profile -- --scene cruise --window 4 --detail $d; done
```

`FLORA_SCALE` is 0.4 / 1 / 1.6, so medium→high is +0.6 of the cover: 1.36M → 1.93M put
the whole cover at about 940k of a 1.36M frame, which is the number that said the cull
and not the sky was worth a session. The same trick reads any row whose lever is a
scalar multiplier.

Two notes. `make build` FIRST and after every edit — the profiler drives the built
site, and a stale `dist/` profiles the last change while reading like a result. And
the `fps` column is a software rasteriser and moves 2× between identical runs; judge
on `draws` and `tris`, which are exact.
