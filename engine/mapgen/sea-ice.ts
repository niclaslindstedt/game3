// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R37 — THE ICE FIELD: how far inside the winter's sheet every cell of a
// freezing coast stands, laid off the finished course.
//
// The sheet covers the whole level and the channel is the one hole in it,
// so the field is the DISTANCE FROM THE CHANNEL, signed: negative in the
// open water the icebreaker left, zero at the sheet's edge, positive under
// the ice and clamped at `ICE.measured` beyond, where every cell reads the
// same and a bilinear sample has nothing to turn into a NaN. Stamped the
// way the basin stamps its offshore field — a disc per sample of the line,
// nearest sample wins — because the question is the same one: how far is
// this cell from the nearest bit of water it is owed.
//
// Laid AFTER the search, from nothing the seeded stream draws, and read at
// run time against the run's season (`engine/game/ice.ts`): a coast that
// freezes is the same shore in every season, and no seed re-rolls for the
// sheet existing.

import { createHeightfield, type Heightfield } from "../lib/heightfield.ts";
import { ICE } from "./pace.ts";
import type { Vec2 } from "./types.ts";

/** How finely the line is resampled when it is stamped, m — the basin's own
 * fine step, and for its reason: a stamp reads the distance to a POINT, so
 * half a step is the most it can overstate, and at five metres that is a
 * couple of metres at the channel's edge, where the brash is six wide. */
const STEP = 5;

/**
 * The ice field for a course whose racing line is `path` (start first): a
 * channel `ICE.channel` either side of the line, a turning basin `ICE.basin`
 * across at each end, on a grid `like` (the level's own ground field, whose
 * origin, cell and extent it copies).
 */
export function layIce(path: readonly Vec2[], like: Heightfield): Heightfield {
  const { originX, originZ, cell, cols, rows } = like;
  const field = createHeightfield(originX, originZ, cell, cols, rows);
  const far = ICE.measured;
  const near = field.data;
  near.fill(far);
  const stamp = (x: number, z: number, half: number): void => {
    // Every cell within `half + far` of the sample is within the field's
    // reach; past that the clamp already holds.
    const reach = half + far;
    const r0 = Math.max(0, Math.ceil((z - reach - originZ) / cell));
    const r1 = Math.min(rows - 1, Math.floor((z + reach - originZ) / cell));
    for (let r = r0; r <= r1; r++) {
      const dz = originZ + r * cell - z;
      const span = Math.sqrt(Math.max(0, reach * reach - dz * dz));
      const c0 = Math.max(0, Math.ceil((x - span - originX) / cell));
      const c1 = Math.min(cols - 1, Math.floor((x + span - originX) / cell));
      const row = r * cols;
      for (let c = c0; c <= c1; c++) {
        const dx = originX + c * cell - x;
        const d = Math.hypot(dx, dz) - half;
        if (d < near[row + c]) near[row + c] = d;
      }
    }
  };
  if (path.length === 0) return field;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.max(1, Math.ceil(len / STEP));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      stamp(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, ICE.channel);
    }
  }
  const last = path[path.length - 1];
  stamp(last.x, last.z, ICE.channel);
  // The turning basins: where the ship came round at either end.
  stamp(path[0].x, path[0].z, ICE.basin / 2);
  stamp(last.x, last.z, ICE.basin / 2);
  return field;
}
