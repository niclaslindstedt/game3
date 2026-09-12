---
title: A bench that RE-IMPLEMENTS a force to decompose it will disagree with the engine and hand you a confident wrong conclusion
date: 2026-09-12
scope: engine/game/hull.ts, engine/game/craft.ts
concepts: [measurement, bench, drag, forces, tooling]
---

To find which drag term dominated a following sea I rebuilt `hullForces`'s
per-probe longitudinal loop in a scratch script and summed the terms
separately. It reported the displacement-mode form drag at 0.84 kN — a major
term — and I spent a round designing a fade for it.

It is zero. `craft.ts` does not pass `c.planing` as `planingShare`; it passes
`max(c.planing, a linear C_v ramp)`, so past the hump the fade is already
complete. My copy read `c.planing`, which collapses on a wave even at planing
speed, and so invented a force the engine never applies.

Two rules from it:

- **Read the engine's OWN breakdown before writing your own.** `HullResult`
  already reports `buoyancy`, `planingLift`, `bank`, `bowLift`, `heave` and
  `slam` — the ride lab's vertical budget. Extend that when a term is missing
  rather than re-deriving the loop beside it.
- **When you must re-implement, pass exactly what the caller passes.** Check
  the call site, not the signature: the argument name (`planingShare`) said
  what I assumed and the call site said otherwise.

The tell is a term that is large in your decomposition and invisible in the
craft's behaviour. If bounding or fading it changes nothing in a real run, you
are measuring your own copy.
