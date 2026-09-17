// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R37 — THE SHEET, AS A RUN MEETS IT. The level carries the ice FIELD
// (`Level.ice`, metres inside the sheet); whether the sheet is THERE is the
// run's season, and this is the one place that question is answered — the
// hull's ground (`ocean.ts`'s `bedAt`), the sea's damping (`water.ts`) and
// everything the renderer draws over the water all ask here.
//
// A run may be ridden in a season the level was not dealt (`createGame`'s
// `season` puts a copy of the level under the run with the season moved),
// which is exactly why the sheet is read off the season at run time rather
// than baked into the ground: the ground is the summer's on every coast, and
// the ice lies on it or does not.

import { sampleField } from "../lib/heightfield.ts";
import { ICE } from "../mapgen/pace.ts";
import type { Level } from "../mapgen/types.ts";

/** Whether the sea is a sheet of ice on this level in the season the run
 * is ridden in — the coast freezes, and it is the coast's winter. */
export function frozen(level: Pick<Level, "ice" | "season">): boolean {
  return level.ice !== null && level.season === ICE.season;
}

/** Metres inside the sheet at a plan point — negative in the channel,
 * positive under the ice — or `-Infinity` when there is no sheet on this
 * run at all, so a caller can ask one question everywhere. Past the level's
 * own grid the field's edge cell holds, which is under the sheet: the pack
 * runs to the horizon. */
export function iceAt(level: Pick<Level, "ice" | "season">, x: number, z: number): number {
  if (!frozen(level)) return -Infinity;
  return sampleField(level.ice as NonNullable<Level["ice"]>, x, z);
}

/** THE SHEET'S TOP over the water at a plan point, m — what the hull
 * grounds on: `ICE.freeboard` under the sheet, sloping down through the
 * brash to the water at the channel's edge, and `-Infinity` in the open
 * channel and on a run with no ice, so `Math.max` against the bed is the
 * whole of the reading. */
export function iceTopAt(level: Pick<Level, "ice" | "season">, x: number, z: number): number {
  const d = iceAt(level, x, z);
  if (d <= -ICE.brash) return -Infinity;
  if (d >= 0) return ICE.freeboard;
  return ICE.freeboard * (1 + d / ICE.brash);
}
