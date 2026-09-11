---
title: A float whose widest point sits AT the waterline reads as a cone stuck in the sea — give the collar a wall standing clear of the water, and a flat rim in to whatever it carries
date: 2026-09-11
scope: pwa/src/game/gates.ts, pwa/src/game/buoys.ts
concepts: [buoys, gates, marks, silhouette, water, screenshots]
---

A navigation float is built about its own waterline (y = 0) and lifted onto
the wave each frame, so the profile decides how much of it the sea covers.
Two mistakes read identically from the saddle — as a traffic cone painted on
the water rather than as something moored:

- **The widest point at y = 0.** The drum's side disappears and only the
  taper above it survives, so the buoy has no body. Put the widest point
  BELOW the water (−0.16 m on a 0.65 m radius) and carry the wall up to
  +0.30, so roughly half a radius of freeboard stands clear. What reads as
  "moored" is that wall rising out of a wave, not the draft under it.
- **The collar running smoothly into what it carries.** A chamfer of two or
  three profile points from collar radius to cone radius is one continuous
  sweep and the eye reads one cone. Make the rim nearly HORIZONTAL — 0.65 →
  0.63 over 0.08 m of height, then 0.63 → 0.50 over 0.02 — and the step
  reads as a deck.

Judge it at gate range, not from the cockpit: `?scene=gate` stands a run a
standoff back from a water gate, and a clipped capture at
`deviceScaleFactor: 3` is the only way to see whether the rim is there.
A 1280-wide frame at 26 m shows a 30 px shape and every one of these faults
looks fine in it.

Lathe profiles are the cheap way to iterate this — one array of `(r, y)`
pairs, so a re-proportioning is a diff of numbers rather than a rebuild of
meshes.
