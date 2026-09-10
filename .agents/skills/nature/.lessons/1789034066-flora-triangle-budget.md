---
title: Break a scatter's cost down per species with a Node script over `planFlora` + `buildFlora` — `make profile` gives one frame total and cannot say which row is eating it
date: 2026-09-10
scope: pwa/src/game/flora-defs.ts, pwa/src/game/flora-plan.ts
concepts: [flora, rendering, tooling]
---

The cover is the biggest single block of geometry in the frame — adding the full roster
took the chase view from 282k triangles to about 1.6M — and `make profile` reports only
that total. What tells you where it went is a throwaway script under the repo root
(`aliasEngine("/home/user/game3")`, then `planFlora(level, scale)` and
`buildFlora(look, seed).getAttribute("position").count / 3`) printing instances and
triangles per row.

Run that way, the answer was not the trees: a 30 cm heather bush was getting the same
24-facet lump as a 15 m spruce, and there were 5500 of them. Deriving the facet count
from `look.height.max` took 400k triangles a frame off with no visible change at all.

Two notes on running it. The script must live in the repo root, not in a temp directory —
`three` resolves from `node_modules` relative to the importer. And a per-species
breakdown is worth reaching for BEFORE cutting density or shares: those are looks
decisions, and spending them on a cost problem the geometry caused is the wrong trade.
