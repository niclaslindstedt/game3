---
title: The wake map's relief is only what stands INSIDE the hull's footprint — the V's arms, a splash's ring and a bob's ring are the engine's wash, and a copy in the map draws the same wave twice
date: 2026-09-16
scope: pwa/src/game/wake-profile.ts, pwa/src/game/wake-bob.ts, pwa/src/game/wake.ts
concepts: [wake, relief, wash, foam, churn, render-target]
---

Since the wash (`engine/game/wash.ts`) the water the craft leaves is real
— `surfaceAt` carries it, the grid is displaced by it, the probes read it.
The map's relief channels were retired for everything the wash owns: the
stern wave's ARMS (which were 0.2 m of visual crest against a physical few
centimetres — the eye would have been shown a wave the hull could not feel),
the splash's RING and the bob's RING. What the map still moves is the
relief the wash excludes by construction — inside the birth radius: the
transom's hollow, the apex mound, a landing's crater. The WHITE and the
CHURN stay on the map and ride at the wash's own group speed (`WASH_GROUP`
imported from `@engine`), so the lace sits on the water that is moving.
Before adding relief to the map, ask whether the engine's field already
carries that wave; if it does, the map gets the white and nothing else.
