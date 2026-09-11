// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The wind held to its three models: the log-law profile (more wind higher
// up, blowing away from where it comes from), the SHELTER field over the
// plan (full strength over open water, a fraction of it behind the land),
// and the Ornstein–Uhlenbeck gust (mean-reverting, bounded, seeded).
import { describe, expect, it } from "vitest";

import {
  TORNADO_EDGE,
  TUNING,
  createRng,
  createWind,
  stepWind,
  tornadoBand,
  tornadoBlow,
  windAt,
  windSpeedAt,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

describe("the wind profile", () => {
  const level = syntheticLevel({ windSpeed: 8 });
  const wind = createWind(level);
  // Well out on the open water of the synthetic coast, where R12's wind
  // has crossed nothing but sea and the shelter is one.
  const OUT = { x: 400, z: 320 };

  it("reads the level's mean at the reference height, out at sea", () => {
    expect(windSpeedAt(wind, TUNING.wind.referenceHeight, OUT.x, OUT.z)).toBeCloseTo(8, 3);
  });

  it("grows with height and never reads negative near the surface", () => {
    const at = (y: number): number => windSpeedAt(wind, y, OUT.x, OUT.z);
    expect(at(1)).toBeLessThan(at(10));
    expect(at(10)).toBeLessThan(at(30));
    expect(at(0)).toBeGreaterThan(0);
    expect(at(-2)).toBe(at(0));
  });

  it("blows toward the opposite of where it comes from", () => {
    // From the north (heading 0, +z — the sea on this coast) means blowing
    // toward −z, in against the shore.
    const v = windAt(wind, 10, OUT.x, OUT.z);
    expect(v.vz).toBeLessThan(-7);
    expect(Math.abs(v.vx)).toBeLessThan(0.5);
    const east = createWind(syntheticLevel({ windSpeed: 5, windFrom: Math.PI / 2 }));
    const e = windAt(east, 10, OUT.x, OUT.z);
    expect(e.vx).toBeLessThan(-4.5);
  });

  it("drops over the land behind the shore, and never below its floor", () => {
    const ashore = windSpeedAt(wind, 2, 400, -80);
    const afloat = windSpeedAt(wind, 2, 400, 320);
    expect(ashore).toBeLessThan(afloat * 0.6);
    expect(ashore).toBeGreaterThan(afloat * TUNING.wind.shelter * 0.99);
  });
});

describe("the wind past the level's rim", () => {
  // The storm out at sea (`ocean.ts`). The synthetic coast's water runs out
  // to z = 400 and the open ocean is everything past it.
  const SEAWARD = 400;
  const level = syntheticLevel({ windSpeed: 8, depth: 40, seaward: SEAWARD });
  const wind = createWind(level);
  const O = TUNING.sea.open;
  const at = (past: number): number =>
    windSpeedAt(wind, TUNING.wind.referenceHeight, 400, SEAWARD + past);

  it("freshens into the storm the further out a rider holds the throttle open", () => {
    expect(at(0)).toBeCloseTo(8, 3);
    let last = 0;
    for (let past = 0; past <= O.reach; past += O.reach / 20) {
      expect(at(past), `${past} m past the rim`).toBeGreaterThanOrEqual(last - 1e-9);
      last = at(past);
    }
    expect(at(O.reach)).toBeCloseTo(O.wind, 3);
    // ...and it is a ceiling, not a ramp that runs away. Read short of
    // `TORNADO_EDGE`, because past THAT edge the wind climbs again and for a
    // different reason: the storm has stopped building and the tornado has
    // started (`tornado.ts`), which `tests/tornado_test.ts` owns.
    expect(at(TORNADO_EDGE - 1)).toBeCloseTo(O.wind, 3);
  });

  it("opens the coast's own shelter out as the coast falls astern", () => {
    // A point BEHIND the land reads the shelter floor at the rim and the
    // full storm far out: the weather out at sea is the same whichever rim
    // a rider left the level by.
    const ashore = createWind(syntheticLevel({ windSpeed: 8, seaward: SEAWARD }));
    const sheltered = windSpeedAt(ashore, TUNING.wind.referenceHeight, 400, -110);
    expect(sheltered).toBeLessThan(8 * 0.6);
    const far = windSpeedAt(ashore, TUNING.wind.referenceHeight, 400, ashore.bounds.minZ - O.reach);
    expect(far).toBeCloseTo(O.wind, 3);
  });

  it("leaves a calm level's STORM calm, however far out it is ridden", () => {
    const calm = createWind(syntheticLevel({ windSpeed: 0, seaward: SEAWARD }));
    expect(windSpeedAt(calm, 10, 400, SEAWARD + O.reach)).toBe(0);
    expect(windSpeedAt(calm, 10, 400, SEAWARD + TORNADO_EDGE - 1)).toBe(0);
  });

  it("...but stands the tornado there all the same", () => {
    // The storm out at sea is GROWN by the level's own wind, so a calm level
    // has none of it. The tornado is not: it is the edge of the built world
    // rather than weather this coast made, and a calm seed that let a rider
    // ride to infinity would be a calm seed with no edge at all.
    const calm = createWind(syntheticLevel({ windSpeed: 0, seaward: SEAWARD }));
    const far = SEAWARD + TORNADO_EDGE + tornadoBand(TUNING.pump.speedClass);
    expect(windSpeedAt(calm, TUNING.wind.referenceHeight, 400, far)).toBeCloseTo(
      tornadoBlow(TUNING.pump.speedClass),
      3,
    );
  });
});

describe("the gusts", () => {
  it("stay within their bounds and revert to the mean", () => {
    const level = syntheticLevel({ windSpeed: 8 });
    const wind = createWind(level);
    const rng = createRng(11);
    let sum = 0;
    let n = 0;
    let min = 1;
    let max = 1;
    for (let i = 0; i < 120 * 300; i++) {
      stepWind(wind, rng, TUNING.dt);
      sum += wind.gust;
      n += 1;
      if (wind.gust < min) min = wind.gust;
      if (wind.gust > max) max = wind.gust;
    }
    expect(min).toBeGreaterThanOrEqual(TUNING.wind.gustMin);
    expect(max).toBeLessThanOrEqual(TUNING.wind.gustMax);
    // Five minutes of gusts average to the mean within a few per cent.
    expect(sum / n).toBeGreaterThan(0.93);
    expect(sum / n).toBeLessThan(1.07);
    // ...and actually gust: the field is not a constant.
    expect(max - min).toBeGreaterThan(0.15);
  });

  it("are the same gusts from the same seed", () => {
    const level = syntheticLevel({ windSpeed: 8 });
    const runs = [0, 1].map(() => {
      const wind = createWind(level);
      const rng = createRng(99);
      const trace: number[] = [];
      for (let i = 0; i < 1200; i++) {
        stepWind(wind, rng, TUNING.dt);
        if (i % 100 === 0) trace.push(wind.gust, wind.veer);
      }
      return trace;
    });
    expect(runs[0]).toEqual(runs[1]);
  });

  it("veer a little, never a lot", () => {
    const wind = createWind(syntheticLevel({ windSpeed: 8 }));
    const rng = createRng(4);
    let maxVeer = 0;
    for (let i = 0; i < 120 * 120; i++) {
      stepWind(wind, rng, TUNING.dt);
      maxVeer = Math.max(maxVeer, Math.abs(wind.veer));
    }
    expect(maxVeer).toBeLessThanOrEqual(3 * TUNING.wind.veer);
    expect(maxVeer).toBeGreaterThan(0.02);
  });
});
