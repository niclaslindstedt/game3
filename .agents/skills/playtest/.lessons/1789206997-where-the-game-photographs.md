---
title: The far-offshore scenes photograph as snow-covered dunes — the beauty is `offshore`, `swell`, `river` and `birds`, at 8–13° of sun
date: 2026-09-12
scope: pwa/src/game/scenarios.ts, scripts/hero-shots.mjs
concepts: [screenshots, scenarios, atmosphere, sky]
---

Reaching for "show the game looking good" by staging `ocean` or `storm` out
past the rim gives a frame that is nothing but breaking crests: at storm Hs
every face carries whitecap foam, and the foam texture over a warm low sun
reads as SNOW ON DUNES, not water. It looks like a bug in the water and is
not — it is the wrong place to point the camera.

What actually photographs, all verified at seed 38 in summer under `clear`:

| Scene | What the frame gets |
| --- | --- |
| `offshore` | the sun's glitter path on open water, hull in silhouette — the best single frame in the game |
| `swell` | the same light with the shore and the lit gates in it |
| `river` | two taiga banks and the wood reflected between them |
| `birds` | the sun going down behind a wooded skerry, its path to the bow |
| `apex` | the hull through a ring, from `heli` |

Sun elevation is the lever, not the hour: **8–13° above the horizon** keeps
the water's own colour with a gold path across it. Below about 4° everything
in frame goes the same warm beige and the sea stops reading as sea.

Two traps. A scene's `t` RIDES it — `offshore` aims the hull down the sun's
path and three seconds of script turns off it, so a still of a composed
moment wants `t` unset. And `breach` is not a poster: the bull is 14 m abeam
and, from any chase rung, a speck on the horizon.
