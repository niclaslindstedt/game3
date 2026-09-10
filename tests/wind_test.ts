// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The wind held to its three models: the log-law profile (more wind higher
// up, blowing away from where it comes from), the SHELTER field over the
// plan (full strength over open water, a fraction of it behind the land),
// and the Ornstein–Uhlenbeck gust (mean-reverting, bounded, seeded).
import { describe, expect, it } from "vitest";

import { TUNING, createRng, createWind, stepWind, windAt, windSpeedAt } from "@engine";

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
