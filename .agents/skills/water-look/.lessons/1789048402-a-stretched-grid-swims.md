---
title: A water grid whose cells stretch with distance SWIMS with the craft however it snaps — only nested power-of-two rings snapped to the coarsest cell keep every sample on the same point of the sea
date: 2026-09-12
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

THE COROLLARY, found two months later: the snap pins the SAMPLES, and
anything measured from the snapped origin instead steps WITH it. The band
where the near water fades into the far swell was a per-vertex share of the
offset from the origin (`grid.edge`), so the whole ring of it jumped a coarse
cell — 12 m at the design point, about twice a second at 80 km/h — and from a
camera standing off and looking down it read as the water being redrawn under
the rider. Measure that kind of band from the CRAFT (ending at
`reach − snap/2`, the nearest the rim can ever stand to him, so it is still
complete on every side) and it glides while the samples stay pinned. Ask of
any new per-vertex ramp: is this pinned to the sea, or to the grid? The grid
is not a place.
