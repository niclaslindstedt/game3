---
title: A night sea is lit by ONE key that used to be the sun, and a lamp the water reads off the very spotlight the hull is lit by
date: 2026-09-10
scope: pwa/src/game/sky.ts, pwa/src/game/daylight.ts, pwa/src/game/craft-lamps.ts, pwa/src/game/water-shader.ts, pwa/src/game/environment.ts
concepts: [night, moon, lamps, sky, water, seasons]
---

Time passing (an hour of sun a minute, `sunHourAt`) turned the sky from a
thing built once per level into a thing asked every frame, and three
choices kept that cheap and honest:

**The moon is not a second light; it is the KEY handing over.** Through
the civil twilight (`MOON_TAKES_OVER`, −3° to −9° of sun) the preset's
`sunElevation`/`sunAzimuth` slide from the sun's afterglow to the full
moon opposite it (`moonAt`), and the disc, the halo, the glint's road on
the water and the cloud occlusion all follow that one key for free —
`sunUp`/`sunBearing` stay the REAL sun for anything at altitude (`litAt`).
Nothing downstream learned a moon exists.

**The season is the declination, and nothing else about the sun.** What a
NIGHT is at 62°N is a fact about the date (astronomical dark is impossible
from late April to mid-August), so "make the night realistic" was one
table (`DECLINATION`, `engine/lib/solar.ts`) dated to the meteorological
seasons' middle days ON THIS COAST, with winter dated to November because
the sea is ice from December to May. Everything the season does to the AIR
(`TAIGA_SEASONS`) is a cast shown in proportion to `daytime`, so midnight
is the same dark in every season — which is what the test holds.

**The lamp is one spotlight under the hull's quaternion, and the water
reads THAT light.** `applyLamp` copies the SpotLight's world place, aim,
colour × intensity, cone cosines and reach into the water shader, which
mirrors three's own spot attenuation — so the pool on the sea is the pool
on the buoy beside it without a second lamp definition. Hidden by day
(three recompiles lit materials per visible light; the one recompile is
paid at dusk), scaled by `1 − dayLight` because a lamp at sunset is a
lamp nobody can see. The buoys light their own caps with an EMISSIVE
rather than lights: forty marks are forty lamps, and a mark's light only
has to be seen.
