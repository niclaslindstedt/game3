// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// OPEN-WATER STAGING — the shore-relative placements shared by scenarios
// that need water farther out than a gate or the start line provides.

import { fieldGradient, sampleField, type Level } from "@engine";

/** The unit vector pointing out to sea at a plan point — up the `offshore`
 * distance field. */
export function seawardAt(level: Level, x: number, z: number): { x: number; z: number } {
  const { gx, gz } = fieldGradient(level.offshore, x, z);
  const n = Math.hypot(gx, gz);
  if (n < 1e-6) return { x: 0, z: 1 };
  return { x: gx / n, z: gz / n };
}

/**
 * A point `metres` out to sea of (x, z) — or as far out as the water goes,
 * whichever comes first.
 *
 * A level is a BASIN (R15): a channel has a far bank, and forty metres
 * seaward of a gate in one can be dry land. Every staged moment that wants
 * "further out" wants the water farther out, so the walk follows the
 * offshore gradient and stops where the water stops getting deeper.
 */
export function outToSea(
  level: Level,
  x: number,
  z: number,
  metres: number,
): { x: number; z: number } {
  const STEP = 4;
  let at = { x, z };
  let best = sampleField(level.offshore, x, z);
  for (let d = STEP; d <= metres; d += STEP) {
    const sea = seawardAt(level, at.x, at.z);
    const next = { x: at.x + sea.x * STEP, z: at.z + sea.z * STEP };
    const off = sampleField(level.offshore, next.x, next.z);
    if (off < best) break;
    best = off;
    at = next;
  }
  return at;
}
