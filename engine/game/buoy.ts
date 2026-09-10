// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R31 — THE LIGHT ON A ROUNDING BUOY, and what it is worth at a moment.
//
// A lit navigation buoy does not glow: it FLASHES, on a character its chart
// quotes — `Fl(3) 8s` is three flashes in a group and a group every eight
// seconds — and the character is what tells one buoy from the next in the
// dark. That is the whole job here. A rider coming back in off the ocean
// leg picks the corner out of a black sea by counting the flashes, and two
// marks that blinked alike would be two marks nobody could tell apart.
//
// PURE, like the sea's surface and the sea life's pose. The lamp is a
// function of the level's own clock (`state.t`) and the character the
// generator drew, so nothing about it is stepped, nothing is stored, and a
// run replays the light it was ridden under exactly. The renderer asks this
// once per buoy per frame and does nothing else with it.
//
// The SHAPE of one flash is a lamp's, not a switch's: a real lens comes up
// and dies away over a tenth of a second, and a square wave at 60 frames a
// second strobes and aliases into a mess at distance. So the edges are
// raised cosines and the middle is full.

import type { BuoyLight } from "../mapgen/types.ts";

/** How long one flash is LIT, s — a chart's own "flash", the part of the
 * character a rider actually counts. */
const FLASH = 0.55;
/** …and the dark between two flashes of one group, s. Shorter than the
 * flash, so a group of three reads as three and not as three lights. */
const GAP = 0.5;
/** How long the lamp takes to come up and to die away, s. */
const EDGE = 0.09;

/** One flash slot: lit, then dark, before the next flash of the group. */
const SLOT = FLASH + GAP;

/** R31 — how bright a buoy's lamp is at a moment, 0..1. `t` is the level's
 * own clock; a buoy with no light (every solid that is not a buoy) is
 * dark. */
export function buoyLightAt(light: BuoyLight | undefined, t: number): number {
  if (!light) return 0;
  const period = light.period;
  const at = (((t + light.phase) % period) + period) % period;
  const group = light.flashes * SLOT;
  if (at >= group) return 0;
  const inSlot = at % SLOT;
  if (inSlot >= FLASH) return 0;
  // Full through the middle, and a raised cosine over `EDGE` at each end.
  const rise = inSlot < EDGE ? inSlot / EDGE : 1;
  const fall = inSlot > FLASH - EDGE ? (FLASH - inSlot) / EDGE : 1;
  const edge = Math.min(rise, fall);
  return 0.5 - 0.5 * Math.cos(Math.PI * edge);
}

/** R31 — the character as a chart writes it: `Fl 6s`, `Fl(3) 8s`. What
 * `make level` prints beside a buoy and what a caption would read. */
export function buoyLightName(light: BuoyLight | undefined): string {
  if (!light) return "unlit";
  const group = light.flashes > 1 ? `Fl(${light.flashes})` : "Fl";
  return `${group} ${light.period.toFixed(1)}s`;
}
