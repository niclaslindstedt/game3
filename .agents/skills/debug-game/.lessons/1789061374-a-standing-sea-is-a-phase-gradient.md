---
title: "The waves stand still" is a phase-gradient bug — measure |∇φ| against k(d) per component over ten seeds, then bucket the bad cells by what stands upwind
date: 2026-09-10
scope: engine/game/water.ts
concepts: [water, phase, repro, corpus]
---

A report that the sea "just stands there" or moves sideways at a river mouth
is not a renderer bug and not a wind bug: a component's crest speed is
ω / |∇φ| along its heading, so a crest that stands or crawls is a spatial
phase whose gradient is several times the wavenumber the depth allows. Do
not stage a scene for it. Build the seed, and for every ocean component
finite-difference (or `sampleFieldGradient`) the phase field at every gate
and over a coarse grid of the exposed water: print |∇φ| / k(d) and the angle
off the component's heading. Seven of seed 41's ten gates read 3–19× and
75–87° — the screenshot in the report, in numbers, in two seconds.

Then bucket the bad cells by what lies upwind of them within 60 m — land,
shallow water, deep water. It was that bucket table that said the land fix
was not the fix: 16% of cells with nothing but deep water upwind were still
wrong, so the offset was travelling from far upwind and the scheme itself was
the bug, not one of its inputs. A fix that only moves the worst-case column
(37× → 13×) while the share of bad water stays put has fixed a symptom.
