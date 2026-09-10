---
title: A water grid whose cells stretch with distance SWIMS with the craft however it snaps — only nested power-of-two rings snapped to the coarsest cell keep every sample on the same point of the sea
date: 2026-09-10
scope: pwa/src/game/water-grid.ts, pwa/src/game/water-mesh.ts
concepts: [renderer, water-mesh, grid, clipmap, sampling]
---

The near grid followed the craft on a cubic stretch (1.5 m cells at the
hull, 7 m at the rim) with its origin snapped to the CENTRE cell. That pins
the centre cell only: every outer vertex jumps by 1.5 m a snap — a third
of its own 4 m cell — so the interpolated crests, the per-vertex tint and
the foam all slid along under the rider, which read as "the water moves
forward with the craft". No single snap can pin a continuous stretch,
because no one step is a multiple of every cell.

The fix is the geometry clipmap's layout (`water-grid.ts`): a fine core and
square rings each of twice the cell, one lattice, seams fanned onto the fine
midpoint so there is no crack, and the origin snapped to the COARSEST cell
— a multiple of every ring's. `tests/water_grid_test.ts` holds the lattice,
the stitching and the winding without a GPU.

Two things the change bought for free: the same sample budget now falls
where the eye reads a wave (3 m cells at 30–60 m instead of blobs of 2–3
samples per 10 m wind wave — the "chaotic" look was undersampling as much
as shading), and the core has to be sized so the craft, up to half a coarse
cell off centre, still sits on fine water (`video_test` holds it).
