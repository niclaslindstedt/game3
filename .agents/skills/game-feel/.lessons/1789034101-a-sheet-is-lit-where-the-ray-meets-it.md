---
title: A cloud drawn as a SHEET must take its light at the ray's own elevation; a fixed elevation is a billboard's habit and it flattens a squall into a pale veil
date: 2026-09-10
scope: pwa/src/game/sky-glsl.ts, pwa/src/game/cloud-field.ts
concepts: [sky, clouds, weather, shader, scud]
---

When scud was a ring of sphere clusters it was an OBJECT at a known height, so
one lit tone read off the ceiling's rim band (`deckToneAt(deck, 0.045)`) was
right for all of it. Ported to a noise sheet the same constant is wrong
everywhere but one elevation: the sheet is a plane, the ray meets it at a
different place in the sky each pixel, and a fixed tone paints a uniform pale
veil over the whole dome — a squall's ceiling stops being black and the row
loses the one thing that makes it dangerous.

The rule for anything hung under a ceiling: read the ceiling's own gradient at
the RAY's elevation (`rim = 1 − elev/RIM_BAND`) and darken from there. Near the
skyline the rag then stands against the lit strip and reads dark; thirty
degrees up it is a slightly darker patch of the same near-black underside,
which is exactly what a photograph of a gust front shows. The same variable
the deck's own tone runs on is the one the things beneath it run on.
