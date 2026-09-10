---
title: A renderer scatter keyed off a world coordinate must go through `hash2`, never `x % n` — JavaScript's remainder keeps the sign of its dividend
date: 2026-09-10
scope: pwa/src/game/rocks.ts, pwa/src/game/terrain.ts, pwa/src/game/flora-plan.ts
concepts: [rocks, determinism, rendering, hashing]
---

`rocks.ts` derived a rock's yaw, its lean and its grey from `(s.x * 31 + s.z * 17) % 100`.
On this coast half of every level sits at negative x or z, and `%` in JavaScript returns
the sign of the DIVIDEND — so every solid west or south of the origin got the whole range
negated. What was meant as a scatter either side of nothing became a one-sided darkening
and a one-sided lean: erratics all tipped the same way, and every rock in half the level
came out darker than the author ever saw.

`hash2(Math.round(x), Math.round(z), seed)` from `@engine` returns 0..1 for any input and
is what `terrain.ts` and `footprints.ts` already use. There is no case where the modulo
form is right.

Nothing catches this: it is deterministic, it never throws, and a screenshot of the half
of the coast at positive coordinates looks correct. It was found by eye, on a seed whose
course happened to run through the negative quadrant.
