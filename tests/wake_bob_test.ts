// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOB (pwa/src/game/wake-bob.ts): the rings a hull radiates while it
// lies in a seaway doing nothing. The claims — a flat calm is silent, a
// plunge is paid once at its turn, the ring rolls out and thins, and no
// part of it is ever white — held as arithmetic; how it LOOKS is
// `make screenshots SCENE=drift`'s. The last case rides a real craft on a
// real sea, because the reading the whole feature hangs on is one the
// engine has to actually produce.

import { describe, expect, it } from "vitest";

import { NEUTRAL_INPUT, createGame, heightAt, placeRun, step, TUNING } from "@engine";

import {
  BOB_FULL,
  BOB_GAP,
  BOB_LIFE,
  BOB_MIN,
  BOB_PACE_GONE,
  BOB_SETTLE,
  BOB_SPEED,
  BOB_STATIONS,
  BOB_WIDTH,
  bobAt,
  bobBirth,
  bobReach,
  bobReading,
  bobStations,
  bobStep,
} from "../pwa/src/game/wake-bob.ts";
import { WAKE_HEIGHT } from "../pwa/src/game/wake-profile.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const section = { foam: 0, churn: 0, up: 0, down: 0, cover: 0 };

/** Drive a reading through a scripted heave, `under` m per step, and
 * collect every ring it buys as `[t, strength]`. */
function heave(unders: number[], dt = TUNING.dt, pace = 0): [number, number][] {
  const bob = bobReading();
  const rings: [number, number][] = [];
  for (let i = 0; i < unders.length; i++) {
    const t = i * dt;
    const s = bobStep(bob, unders[i], t, pace, true);
    if (s > 0) rings.push([t, s]);
  }
  return rings;
}

/** A sawtooth: `n` plunges of `depth` m, each over `steps` steps down and
 * the same back up. */
function sawtooth(n: number, depth: number, steps: number): number[] {
  const out: number[] = [0];
  for (let k = 0; k < n; k++) {
    for (let i = 1; i <= steps; i++) out.push((depth * i) / steps);
    for (let i = steps - 1; i >= 0; i--) out.push((depth * i) / steps);
  }
  return out;
}

describe("the bob's reading", () => {
  it("is silent on a hull that never moves against the water", () => {
    expect(heave(new Array(600).fill(0.31))).toHaveLength(0);
  });

  it("pays nothing for a plunge under the floor", () => {
    expect(heave(sawtooth(4, BOB_MIN * 0.8, 40))).toHaveLength(0);
  });

  it("pays a plunge deep enough, once, at the step the heave turns", () => {
    // One plunge over 40 steps down, 40 back up: one ring, born on the
    // first rising step and never again on the way up.
    const dt = TUNING.dt;
    const rings = heave(sawtooth(1, BOB_FULL, 40), dt);
    expect(rings).toHaveLength(1);
    expect(rings[0][0]).toBeCloseTo(41 * dt, 6);
    expect(rings[0][1]).toBeCloseTo(1, 6);
  });

  it("scales the ring between the floor and a full plunge", () => {
    const mid = heave(sawtooth(1, (BOB_MIN + BOB_FULL) / 2, 40));
    expect(mid).toHaveLength(1);
    expect(mid[0][1]).toBeGreaterThan(0.4);
    expect(mid[0][1]).toBeLessThan(0.6);
  });

  it("holds the next ring off for BOB_GAP", () => {
    // Plunges every quarter of a second — well inside the gap — so only
    // every other one or fewer is paid, and no two are born inside it.
    const dt = TUNING.dt;
    const steps = Math.round(0.12 / dt);
    const rings = heave(sawtooth(12, BOB_FULL, steps), dt);
    expect(rings.length).toBeGreaterThan(1);
    for (let i = 1; i < rings.length; i++) {
      expect(rings[i][0] - rings[i - 1][0]).toBeGreaterThanOrEqual(BOB_GAP - 1e-9);
    }
  });

  it("folds away as the hull picks up way", () => {
    const still = heave(sawtooth(1, BOB_FULL, 40), TUNING.dt, 0);
    const half = heave(sawtooth(1, BOB_FULL, 40), TUNING.dt, BOB_PACE_GONE / 2);
    expect(half[0][1]).toBeCloseTo(still[0][1] / 2, 6);
    expect(heave(sawtooth(1, BOB_FULL, 40), TUNING.dt, BOB_PACE_GONE)).toHaveLength(0);
  });

  it("stays quiet while a hull is still arriving — that water is the splash's", () => {
    // `lying` is false for `BOB_SETTLE` after a landing, so the deep sink
    // of the arrival itself never buys a ring on top of the splash's own
    // crater and ring wave.
    const bob = bobReading();
    for (let i = 1; i <= 40; i++) bobStep(bob, (BOB_FULL * 4 * i) / 40, i * TUNING.dt, 0, false);
    expect(bobStep(bob, 0, 1, 0, false)).toBe(0);
    expect(BOB_SETTLE).toBeGreaterThan(0);
  });

  it("disarms in the air, and pays nothing for the flight", () => {
    const bob = bobReading();
    // Sinking, then gone: the plunge in hand is dropped, not banked.
    for (let i = 1; i <= 40; i++) bobStep(bob, (BOB_FULL * i) / 40, i * TUNING.dt, 0, true);
    expect(bobStep(bob, 0, 1, 0, false)).toBe(0);
    // Back in the water two metres higher: the first step only re-primes.
    expect(bobStep(bob, -2, 1.1, 0, true)).toBe(0);
    expect(bobStep(bob, -2, 1.2, 0, true)).toBe(0);
  });
});

describe("the bob's ring", () => {
  it("is never white", () => {
    for (const age of [0, 0.4, 1, 2, 3]) {
      for (let r = 0; r < 14; r += 0.25) {
        bobAt(r, 1.6, age, 1, 1, section);
        expect(section.foam).toBe(0);
      }
    }
  });

  it("rolls its crest out at BOB_SPEED", () => {
    const radius = 1.6;
    for (const age of [0.5, 1.5, 2.5]) {
      let best = -1;
      let at = 0;
      for (let r = 0; r < 20; r += 0.02) {
        bobAt(r, radius, age, 1, 1, section);
        const up = section.up * section.cover;
        if (up > best) {
          best = up;
          at = r;
        }
      }
      expect(at).toBeCloseTo(radius + BOB_SPEED * age, 1);
    }
  });

  it("thins as it goes and is gone by BOB_LIFE", () => {
    const peak = (age: number) => {
      let best = 0;
      for (let r = 0; r < 24; r += 0.05) {
        bobAt(r, 1.6, age, 1, 1, section);
        best = Math.max(best, section.up * section.cover);
      }
      return best;
    };
    expect(peak(1.2)).toBeGreaterThan(peak(2.4));
    expect(peak(2.4)).toBeGreaterThan(0);
    expect(peak(BOB_LIFE)).toBe(0);
    bobAt(3, 1.6, BOB_LIFE + 0.1, 1, 1, section);
    expect(section.cover).toBe(0);
  });

  it("draws a trough inside its crest", () => {
    const age = 1;
    const rc = 1.6 + BOB_SPEED * age;
    bobAt(rc, 1.6, age, 1, 1, section);
    const crest = section.up;
    bobAt(rc - (BOB_WIDTH / 2) * 1.15, 1.6, age, 1, 1, section);
    expect(section.down).toBeGreaterThan(crest * 0.4);
  });

  it("puts nothing inside the waterline it was born on", () => {
    bobAt(0, 1.6, 0.05, 1, 1, section);
    expect(section.cover).toBe(0);
  });

  it("is wide enough for the water grid to read — the relief blur is ~2 m", () => {
    expect(BOB_WIDTH).toBeGreaterThanOrEqual(3);
  });

  it("keeps its churn when the DETAIL row takes its relief away", () => {
    const age = 1;
    const rc = 1.6 + BOB_SPEED * age;
    bobAt(rc, 1.6, age, 1, 0, section);
    expect(section.up).toBe(0);
    expect(section.churn).toBeGreaterThan(0.1);
  });

  it("never asks for more height than the map's bytes carry", () => {
    for (let r = 0; r < 20; r += 0.05) {
      bobAt(r, 1.2, 0.3, 1, 1, section);
      expect(section.up).toBeLessThanOrEqual(WAKE_HEIGHT);
      expect(section.down).toBeLessThanOrEqual(WAKE_HEIGHT);
    }
  });
});

describe("the bob's stations", () => {
  const out = new Float32Array(BOB_STATIONS);

  it("ascend from the centre to the reach", () => {
    for (const age of [0, 0.3, 1.4, 3]) {
      bobStations(1.6, age, out);
      expect(out[0]).toBe(0);
      for (let i = 1; i < BOB_STATIONS; i++) expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
      expect(out[BOB_STATIONS - 1]).toBeCloseTo(bobReach(1.6, age), 6);
    }
  });

  it("bracket the crest, so a metre-wide wave is a vertex and not a gap", () => {
    bobStations(1.6, 1.2, out);
    const rc = 1.6 + BOB_SPEED * 1.2;
    expect(Math.min(...Array.from(out).map((r) => Math.abs(r - rc)))).toBeLessThan(0.01);
  });
});

describe("a craft lying in a real sea", () => {
  /** Stand a craft at rest offshore on the synthetic coast and count the
   * rings its own heave buys over `seconds`. */
  function ringsAtRest(windSpeed: number, seconds: number): number {
    const level = syntheticLevel({ windSpeed, swell: windSpeed > 0 ? 1.5 : 0 });
    const state = createGame({ seed: 7, craft: "skiff", level, quiet: true });
    placeRun(state, { x: 300, z: 220, heading: 0 });
    const bob = bobReading();
    let rings = 0;
    const steps = Math.round(seconds / TUNING.dt);
    for (let i = 0; i < steps; i++) {
      step(state, NEUTRAL_INPUT);
      const c = state.craft;
      const under = heightAt(state.sea, state.level, c.x, c.z, state.t) - c.y;
      const afloat = !c.airborne && c.wetted > 0.05;
      if (bobStep(bob, under, state.t, Math.hypot(c.vx, c.vz), afloat) > 0) rings++;
    }
    return rings;
  }

  it("radiates nothing on a flat calm", () => {
    expect(ringsAtRest(0, 12)).toBe(0);
  });

  it("radiates a train of rings in a seaway", () => {
    // Five seconds of settling, then a dozen more: a hull heaving on a
    // real sea buys rings, and the gap keeps them a train rather than a
    // smear.
    const rings = ringsAtRest(9, 17);
    expect(rings).toBeGreaterThan(2);
    expect(rings).toBeLessThan(17 / BOB_GAP);
  });

  it("puts the ring outside the hull's own waterline", () => {
    const state = createGame({ seed: 7, craft: "skiff", quiet: true, level: syntheticLevel({}) });
    const spec = state.craft.spec;
    const radius = bobBirth(spec.length, spec.beam);
    expect(radius).toBeGreaterThan(spec.beam / 2);
    expect(radius).toBeGreaterThan(spec.length / 2);
  });
});
