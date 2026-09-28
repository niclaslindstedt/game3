// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUN'S CLOCK. The engine has one clock, `state.t`, and nothing in the
// simulation ever looks at the sun — the sea is a function of `t` and the
// hull is a function of the sea. But the hour a run has REACHED is a fact
// about the run, and it is stated here so that everything which reads the
// sun off it (the sky, the HUD's clock, the lamps) reads the same hour.
//
// ONE MINUTE OF RIDING IS ONE HOUR OF SUN. A run is a couple of minutes, and
// a sun that climbed a third of a degree in that time would be a sun that
// never moved; at sixty to one a run started at sunset rides into the
// twilight, the dark comes down, the moon comes up over the sea, and
// twenty-four minutes on the water is the whole of a day and a night.

import type { Level } from "../mapgen/types.ts";

/** How fast the sun's clock runs against the run clock: seconds of riding
 * per hour of sun. */
export const SUN_SECONDS_PER_HOUR = 60;

/** The hour on the sun's clock at run time `t`, 0..24 — the hour the level
 * was dealt (R13), run on at `SUN_SECONDS_PER_HOUR`. */
export function sunHourAt(level: Pick<Level, "hour">, t: number): number {
  const h = (level.hour + t / SUN_SECONDS_PER_HOUR) % 24;
  return h < 0 ? h + 24 : h;
}
