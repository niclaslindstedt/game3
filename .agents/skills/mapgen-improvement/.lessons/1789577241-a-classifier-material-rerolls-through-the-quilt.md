---
title: A new SURFACE re-rolls seeds through R21 even when no draw moved — the quilt walk reads the classifier, so attribute a moved digest to the rejection log before blaming the stream
date: 2026-09-16
scope: engine/analysis/coast.ts, engine/mapgen/compile.ts, engine/mapgen/basin.ts
concepts: [determinism, analysis, r21, surface, river, digests]
---

Adding the `bank` surface drew nothing new off the rng, and three of the
twelve taiga corpus seeds still came out as different levels. The cause was
the analyzer, not the generator: R21's quilt walk used to read a river's
sandy banks as an unbroken run of coast (`1360 m of unbroken sand` on seed
1's attempt 8), and once a bank is a break in the quilt that attempt PASSES,
so the seed ships an earlier attempt. The "no taiga seed re-rolls" invariant
is a promise about a biome ROW change; a change to what the analysis SEES is
a rule change and re-rolls like one, and the PR has to say so.

Attribute it before deciding: digest the corpus on `origin/main` (a
`git worktree` with `node_modules` symlinked) and on the branch, and for a
seed that moved, run `generateLevel` under `setOutputSink` on both trees and
diff the per-attempt rejection lines. The first attempt whose reason differs
is the cause, and "rejected before, accepted now" is the tell that a check
changed its reading rather than the stream its draws.
