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
  createGame,
  windAt,
  windFromQuarter,
  windQuarter,
  windSpeedAt,
  LEVEL_RULES,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** A right angle, which is the quarter "along the shore" stands at. */
const HALF_PI = Math.PI / 2;

/** Within `share` of what was asked for. The wind carries an eddy field
 * over the whole plan (`TUNING.wind.eddyScale`), so the MEAN wind is what
 * an average of enough places comes to and never what one of them reads —
 * and an average over any finite patch still has a percent or two of the
 * field left on it. Every case below that is about the mean rather than
 * about the turbulence is held this way. */
function near(got: number, want: number, share = 0.05): void {
  expect(got).toBeGreaterThan(want * (1 - share));
  expect(got).toBeLessThan(want * (1 + share));
}

describe("the wind profile", () => {
  const level = syntheticLevel({ windSpeed: 8 });
  const wind = createWind(level);
  // Well out on the open water of the synthetic coast, where R12's wind
  // has crossed nothing but sea and the shelter is one.
  const OUT = { x: 400, z: 320 };

  // THE MEAN IS A MEAN. The wind carries an eddy field on top of it, so no
  // one point reads the level's number and asking a single one whether it
  // does is asking the wrong question; what has to hold is that a patch of
  // sea AVERAGES to it.
  const patch = (fn: (x: number, z: number) => number, step = 7, n = 90): number[] => {
    const out: number[] = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) out.push(fn(OUT.x + i * step, OUT.z + j * step));
    return out;
  };
  const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
  const spread = (a: number[]): number => {
    const m = mean(a);
    return Math.sqrt(mean(a.map((v) => (v - m) ** 2)));
  };

  it("averages to the level's mean at the reference height, out at sea", () => {
    const over = patch((x, z) => windSpeedAt(wind, TUNING.wind.referenceHeight, x, z));
    near(mean(over), 8, 0.03);
  });

  it("carries the quoted turbulence intensity as a field over the plan", () => {
    const over = patch((x, z) => windSpeedAt(wind, TUNING.wind.referenceHeight, x, z));
    // The level-wide gust is 1 on a wind nothing has stepped, so what is
    // left over a patch is the eddy field's own share of the variance
    // (`squallShare`) — and that share is what it has to deliver.
    const want = TUNING.wind.intensity * Math.sqrt(1 - TUNING.wind.squallShare);
    expect(spread(over) / mean(over)).toBeGreaterThan(want * 0.8);
    expect(spread(over) / mean(over)).toBeLessThan(want * 1.25);
  });

  it("hands two places a few metres apart nearly, but not quite, the same wind", () => {
    // What a start grid is made of: the hull in the next lane is in the
    // same weather and not in the same eddy (`TUNING.wind.eddyScale` and
    // the octaves under it). Correlated close in, gone by level range.
    const at = (x: number, z: number): number =>
      windSpeedAt(wind, TUNING.wind.referenceHeight, x, z);
    const corr = (sep: number): number => {
      const a = patch((x, z) => at(x, z));
      const b = patch((x, z) => at(x + sep, z));
      const ma = mean(a);
      const mb = mean(b);
      let cov = 0;
      for (let i = 0; i < a.length; i++) cov += (a[i] - ma) * (b[i] - mb);
      return cov / a.length / (spread(a) * spread(b));
    };
    expect(corr(4)).toBeGreaterThan(0.7);
    expect(corr(4)).toBeLessThan(0.99);
    expect(corr(30)).toBeLessThan(corr(4));
    expect(corr(TUNING.wind.eddyScale * 2)).toBeLessThan(0.3);
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
    expect(v.vz).toBeLessThan(-6);
    expect(Math.abs(v.vx)).toBeLessThan(1.5);
    const east = createWind(syntheticLevel({ windSpeed: 5, windFrom: Math.PI / 2 }));
    const e = windAt(east, 10, OUT.x, OUT.z);
    expect(e.vx).toBeLessThan(-4);
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
  // ALONG the shore rather than at one point on it: the storm's ramp, the
  // shelter and the tornado are all functions of how far out a rider is and
  // vary barely at all across a few hundred metres of x, while the eddy
  // field varies over metres (`TUNING.wind.eddyScale` and the octaves under
  // it). So a line average in x is the MEAN wind at that distance with the
  // turbulence taken off, which is the thing every case below is about.
  const across = (
    air: ReturnType<typeof createWind>,
    z: number,
    y: number = TUNING.wind.referenceHeight,
  ): number => {
    let sum = 0;
    const n = 81;
    for (let i = 0; i < n; i++) sum += windSpeedAt(air, y, 400 + (i - (n - 1) / 2) * 9, z);
    return sum / n;
  };
  const at = (past: number): number => across(wind, SEAWARD + past);

  it("freshens into the storm the further out a rider holds the throttle open", () => {
    near(at(0), 8);
    // In FIFTHS of the ramp, and never falling by more than the field.
    // A line average still carries a few percent of the eddy field, and the
    // ramp is an S: over a twentieth of the reach its own rise is smaller
    // than that near the rim, and at the top it has reached its ceiling and
    // there is no rise left at all. So the sweep is coarse enough that the
    // climb is an order above the turbulence where there IS a climb, and
    // the plateau is held to not falling THROUGH the turbulence.
    let last = 0;
    for (let past = 0; past <= O.reach; past += O.reach / 5) {
      expect(at(past), `${past} m past the rim`).toBeGreaterThan(last * 0.97);
      last = at(past);
    }
    expect(at(O.reach)).toBeGreaterThan(at(0) * 2);
    near(at(O.reach), O.wind);
    // ...and it is a ceiling, not a ramp that runs away. Read short of
    // `TORNADO_EDGE`, because past THAT edge the wind climbs again and for a
    // different reason: the storm has stopped building and the tornado has
    // started (`tornado.ts`), which `tests/tornado_test.ts` owns.
    near(at(TORNADO_EDGE - 1), O.wind);
  });

  it("opens the coast's own shelter out as the coast falls astern", () => {
    // A point BEHIND the land reads the shelter floor at the rim and the
    // full storm far out: the weather out at sea is the same whichever rim
    // a rider left the level by.
    const ashore = createWind(syntheticLevel({ windSpeed: 8, seaward: SEAWARD }));
    const sheltered = across(ashore, -110);
    expect(sheltered).toBeLessThan(8 * 0.6);
    const far = across(ashore, ashore.bounds.minZ - O.reach);
    near(far, O.wind);
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
    near(across(calm, far), tornadoBlow(TUNING.pump.speedClass));
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

describe("the wind's quarter, against the coast rather than the compass", () => {
  // The two halves of one relation (`windQuarter` / `windFromQuarter`): an
  // absolute heading read against the way the open sea lies, and back again.
  // FREE's own row is written in this angle, and so is the mark under it, so
  // a drift between the two would put a card's reading and the water it
  // describes on different quarters.
  const level = syntheticLevel({ windSpeed: 8 });

  it("reads dead onshore as zero, and comes back to the heading it started at", () => {
    // The bench's shore is the line z = 0 with the water in +z, so the sea
    // lies along heading 0 and a wind blowing straight in off it is 0.
    expect(level.seaHeading).toBe(0);
    expect(windQuarter(level, level.seaHeading)).toBeCloseTo(0, 12);
    for (const quarter of [0, 0.4, HALF_PI, 2.6, -0.4, -HALF_PI, -2.6]) {
      expect(windQuarter(level, windFromQuarter(level, quarter))).toBeCloseTo(quarter, 12);
    }
  });

  it("wraps the absolute heading and keeps the quarter inside half a turn", () => {
    // `windFromQuarter` feeds a `Wind.from`, which every other reader takes
    // as an ordinary heading, so it is wrapped to 0..2π rather than handed on
    // negative; the quarter that comes back is signed, so a rider can tell
    // one side of the shore from the other.
    const behind = windFromQuarter(level, -Math.PI / 2);
    expect(behind).toBeGreaterThan(0);
    expect(behind).toBeLessThan(Math.PI * 2);
    expect(windQuarter(level, behind)).toBeCloseTo(-Math.PI / 2, 12);
    expect(Math.abs(windQuarter(level, 3.9))).toBeLessThanOrEqual(Math.PI);
  });

  it("is what a run asks for when it asks for a quarter", () => {
    // `createGame`'s own option, which is the whole point of the pair: the
    // app cannot add the coast's bearing itself, because the level it would
    // add it to is built inside the call.
    const out = createGame({ seed: 1, level, windQuarter: Math.PI, windSpeed: 11, quiet: true });
    expect(windQuarter(out.level, out.wind.meanFrom)).toBeCloseTo(Math.PI, 6);
    expect(out.wind.meanSpeed).toBe(11);
    // A speed with no quarter beside it leaves the level's own quarter alone,
    // which is the behaviour the developer's WIND row has always had.
    const same = createGame({ seed: 1, level, windSpeed: 11, quiet: true });
    expect(same.wind.meanFrom).toBe(level.wind.from);
  });

  it("is dealt within R12's own band on a generated shore", () => {
    // The rule the published heading exists to be read against: the wind
    // always has the open water at its back, so every seed's quarter is
    // inside `R.wind.seaward` of dead onshore.
    for (const seed of LEVEL_SEEDS) {
      const dealt = levelFor(seed);
      expect(Math.abs(windQuarter(dealt, dealt.wind.from))).toBeLessThanOrEqual(
        LEVEL_RULES.wind.seaward + 1e-9,
      );
    }
  });
});
