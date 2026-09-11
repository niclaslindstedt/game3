// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SYNTHETIC level for the rule suites — the §23.8 sequel test: the
// physics, the course, the bot and the simulator are all held to a level
// no generator built, so the whole of the rule suite passes with the
// generator deleted. A flat sea bed at −8 m with a straight shore along x
// at z = 0 and land rising to +5 m behind it; `offshore` is simply z; a
// row of water gates every 100 m along z = 40 running east, one air gate
// with its ramp, and two skerries off the line. Anything that needs a
// GENERATED level calls the generator itself.

import { afterAll, beforeAll } from "vitest";

import {
  createHeightfield,
  fillField,
  type Level,
  type Gate,
  type Solid,
  TUNING,
  type Weather,
} from "@engine";

const CELL = 4;

export type SyntheticOptions = {
  /** Mean wind, m/s at 10 m, and where it blows from (default: off the
   * sea, in against the shore — R12, which the exposure model in
   * `fetch.ts` reads as literally as the generator states it: a synthetic
   * coast with the wind at its back is a synthetic coast with no sea on
   * it). */
  windSpeed?: number;
  windFrom?: number;
  /** Water density, kg/m³ (default brackish 1005). */
  density?: number;
  /** Leave the solids out. */
  noSolids?: boolean;
  /** Extra plan reach to seaward, m (default 400). */
  seaward?: number;
  /** How long the level runs ALONG the shore, m (default 880, from x = −60).
   * The drag strip lengthens it: a craft at a high SPEED CLASS covers more
   * than a kilometre in the seconds it takes to reach its top speed, and a
   * strip it runs off the end of puts it out past the rim in the open
   * ocean's storm, where it is no longer measuring its own hull. */
  plan?: number;
  /** The bed's depth out at sea, m (default 8) — deepen it for a sea the
   * shallows would break. */
  depth?: number;
  /** The air gate's ramp: its angle, rad (default 0.35), and length, m
   * (default 8). The ring moves up with the ramp's lip. */
  rampAngle?: number;
  rampLength?: number;
  /** The sky over it (default clear). */
  weather?: Weather;
};

/** The sea bed: −`depth` m out at sea, rising over the last 40 m to the
 * shore at z = 0, then land climbing to +5 m by 60 m inland and flat
 * beyond. */
export function syntheticGround(z: number, depth = 8): number {
  if (z >= 40) return -depth;
  if (z >= 0) return -depth * (z / 40);
  if (z >= -60) return 5 * (-z / 60);
  return 5;
}

export function syntheticLevel(opts: SyntheticOptions = {}): Level {
  const seaward = opts.seaward ?? 400;
  const bounds = { minX: -60, maxX: -60 + (opts.plan ?? 880), minZ: -120, maxZ: seaward };
  const cols = Math.ceil((bounds.maxX - bounds.minX) / CELL) + 1;
  const rows = Math.ceil((bounds.maxZ - bounds.minZ) / CELL) + 1;
  const ground = createHeightfield(bounds.minX, bounds.minZ, CELL, cols, rows);
  fillField(ground, (_x, z) => syntheticGround(z, opts.depth));
  const offshore = createHeightfield(bounds.minX, bounds.minZ, CELL, cols, rows);
  fillField(offshore, (_x, z) => z);
  const east = Math.PI / 2;
  const gates: Gate[] = [];
  let index = 0;
  for (const x of [100, 200, 300, 400]) {
    gates.push({
      id: `G${index + 1}`,
      index,
      kind: "water",
      x,
      y: 0,
      z: 40,
      heading: east,
      width: 16,
    });
    index += 1;
  }
  const rampAngle = opts.rampAngle ?? 0.35;
  const rampLength = opts.rampLength ?? 8;
  // The ramp stands well past the last buoy so the fastest hull has room
  // to line up on its axis.
  const ramp = {
    id: "R1",
    x: 560,
    z: 40,
    heading: east,
    length: rampLength,
    width: 5,
    angle: rampAngle,
  };
  // The ring stands where a hull that took the ramp at the pace this
  // shore's straights allow (~70 km/h at the lip) passes: twenty metres
  // past the lip and a couple of metres above it.
  gates.push({
    id: `A${index + 1}`,
    index,
    kind: "air",
    x: 560 + rampLength + 20,
    y: 2.2 + rampLength * Math.tan(rampAngle),
    z: 40,
    heading: east,
    width: 7,
    ramp,
  });
  index += 1;
  gates.push({
    id: `G${index + 1}`,
    index,
    kind: "water",
    x: 700,
    y: 0,
    z: 40,
    heading: east,
    width: 16,
  });
  const solids: Solid[] = opts.noSolids
    ? []
    : [
        { id: "S1", kind: "skerry", x: 250, z: 75, r: 4, top: 1.5 },
        { id: "S2", kind: "skerry", x: 350, z: 12, r: 3, top: 0.8 },
      ];
  const path = [{ x: 20, z: 40 }, ...gates.map((g) => ({ x: g.x, z: g.z }))];
  return {
    seed: 1,
    biome: "taiga",
    // A coast: a straight shore with a row of gates along it is the sprint
    // chapter of the rule book (R24), not R29's lap out at sea.
    track: "coast",
    pace: 1,
    bounds,
    ground,
    offshore,
    shore: [
      [
        { x: bounds.minX, z: 0 },
        { x: bounds.maxX, z: 0 },
      ],
    ],
    materialAt: (_x, z) => (z > 0 ? "water" : z > -20 ? "sand" : "bedrock"),
    solids,
    river: [],
    // No river on the synthetic bed, so no current: two one-cell fields of
    // standing water, which is what `flowAt` reads outside a real one.
    flow: {
      vx: createHeightfield(bounds.minX, bounds.minZ, CELL, 2, 2),
      vz: createHeightfield(bounds.minX, bounds.minZ, CELL, 2, 2),
    },
    // Empty water: the synthetic level stages the PHYSICS, and nothing in
    // the physics touches the fauna. A test about the sea life stands its
    // own pods (tests/fauna_test.ts).
    fauna: [],
    course: { gates, path, length: 680, laps: 1, lapGates: gates.length },
    start: { x: 20, z: 40, heading: east },
    wind: { from: opts.windFrom ?? 0, speed: opts.windSpeed ?? 4 },
    water: { density: opts.density ?? 1005, temperature: 14 },
    season: "summer",
    hour: 11,
    // A clear late morning: nothing a physics test stages should be
    // standing under weather it did not ask for.
    weather: opts.weather ?? "clear",
  };
}

/** Pin the SPEED CLASS a suite's runs default to, and put it back afterwards.
 *
 * Some fixtures ride at a THROTTLE rather than to a speed — the camera rod's
 * landing, the rider's springs, a hull righting itself with the throttle
 * held open — and a class that makes the same throttle mean half as much
 * speed again moves what they measure without saying anything about their
 * subject. Those suites pin the class they were written at. It is
 * `TUNING.pump.speedClass` that is pinned, which is the DEFAULT `createGame`
 * falls back to when a caller passes no class of its own; a suite whose
 * subject IS the roster's pace passes one explicitly instead. */
export function pinSpeedClass(k: number): void {
  const was = TUNING.pump.speedClass;
  beforeAll(() => {
    (TUNING.pump as { speedClass: number }).speedClass = k;
  });
  afterAll(() => {
    (TUNING.pump as { speedClass: number }).speedClass = was;
  });
}
