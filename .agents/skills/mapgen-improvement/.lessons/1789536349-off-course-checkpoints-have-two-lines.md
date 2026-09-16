---
title: An off-course buoy has a natural line and a ridden line, and each rule must measure the right one
date: 2026-09-16
scope: engine/mapgen/circuit.ts, engine/mapgen/course.ts, engine/analysis/circuit.ts, engine/analysis/index.ts
concepts: [gates, scoring, circuits, geometry]
---

A single-buoy checkpoint outside a circuit bend deliberately separates the generated lap from the route the rider must take. Placement rules such as standoff, outside/inside winding, and detour measure against the natural lap; checkpoint spacing and gate-to-gate cornering measure `gatePassPoint`, not the buoy centre or its projection onto that lap. The close turn at the buoy is intentional rounding and must not be rejected as an accidental R34 kink. Mixing those two geometries either puts the buoy on the ordinary racing line or makes every genuine excursion fail analysis.
