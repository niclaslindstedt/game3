// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAKE'S SHAPE (pwa/src/game/wake-profile.ts): what the map behind the
// craft carries, by speed and by age. The claims the reference photograph
// makes — a road that outlives its boil, a fan that spreads at Kelvin's
// angle with the SPEED, a crawl that stirs the water and whitens none of
// it — held as arithmetic, since how it LOOKS is `make screenshots`'s.

import { describe, expect, it } from "vitest";

import {
  BOIL_LIFE,
  FAN_HALF_MAX,
  FAN_LIFE,
  KELVIN_TAN,
  ROAD_LIFE,
  SPEED_MIN,
  WAKE_HEIGHT,
  fanAt,
  fanHalf,
  roadAt,
  roadHalf,
  roadStrength,
  wakeSection,
  washOf,
} from "../pwa/src/game/wake-profile.ts";

const BEAM = 1.2;

describe("the road", () => {
  it("is white only once the pump is churning at pace, and whiter on the throttle", () => {
    expect(roadStrength(SPEED_MIN - 0.5, 1)).toBe(0);
    expect(roadStrength(20, 1)).toBeGreaterThan(roadStrength(20, 0));
    expect(roadStrength(20, 0)).toBeGreaterThan(0);
    expect(roadStrength(20, 1)).toBeLessThanOrEqual(1);
  });

  it("is widest at the transom — the boil — and necks in behind it", () => {
    const transom = roadHalf(BEAM, 15, 0);
    const behind = roadHalf(BEAM, 15, 3 * BOIL_LIFE);
    expect(transom).toBeGreaterThan(behind * 1.4);
    // …then spreads, slowly, with age.
    expect(roadHalf(BEAM, 15, ROAD_LIFE)).toBeGreaterThan(behind);
  });

  it("outlives its boil and fades into nothing, never negative", () => {
    const s = wakeSection();
    roadAt(0, 0.3, 15, 1, s);
    const fresh = { ...s };
    roadAt(0, 2 * BOIL_LIFE, 15, 1, s);
    const settled = { ...s };
    expect(settled.foam).toBeGreaterThan(0.3);
    expect(settled.churn).toBeLessThan(fresh.churn);
    expect(settled.down).toBeLessThan(fresh.down);
    roadAt(0, ROAD_LIFE + 0.01, 15, 1, s);
    expect(s.cover).toBe(0);
    for (const age of [0, 1, 3, 5.9]) {
      roadAt(0, age, 15, 1, s);
      expect(s.foam).toBeGreaterThanOrEqual(0);
      expect(s.foam).toBeLessThanOrEqual(1);
    }
  });

  it("feathers to nothing at its edge and hollows the water at its middle", () => {
    const s = wakeSection();
    roadAt(1, 0.2, 15, 1, s);
    expect(s.cover).toBe(0);
    roadAt(0, 0.2, 15, 1, s);
    expect(s.cover).toBe(1);
    expect(s.down).toBeGreaterThan(0);
    expect(s.down).toBeLessThan(WAKE_HEIGHT);
    expect(s.up).toBe(0);
  });

  it("forms its hollow over a moment rather than at a step", () => {
    // The relief the surface is moved by rises in: nothing at the instant
    // the transom passes, most of the way in a quarter second, so no vertex
    // drops its whole depth between one frame and the next.
    const s = wakeSection();
    roadAt(0, 0, 15, 1, s);
    expect(s.down).toBe(0);
    roadAt(0, 0.05, 15, 1, s);
    const early = s.down;
    roadAt(0, 0.3, 15, 1, s);
    expect(early).toBeGreaterThan(0);
    expect(s.down).toBeGreaterThan(early * 3);
  });
});

describe("the fan", () => {
  it("spreads at Kelvin's angle with the speed, up to a cap", () => {
    const slow = fanHalf(BEAM, 5, 2);
    const fast = fanHalf(BEAM, 15, 2);
    expect(fast - slow).toBeCloseTo(10 * 2 * KELVIN_TAN, 5);
    expect(fanHalf(BEAM, 30, FAN_LIFE)).toBe(FAN_HALF_MAX);
  });

  it("is aerated water with a bow wave along its edge, paler than the road", () => {
    const s = wakeSection();
    fanAt(0.85, 0.5, 15, 1, s);
    const edge = { ...s };
    fanAt(0.55, 0.5, 15, 1, s);
    const behind = { ...s };
    fanAt(0.1, 0.5, 15, 1, s);
    const inside = { ...s };
    // The crest on the edge, the trough drawn in just inside it, flat water
    // toward the road: a wave, which is what the surface is pushed by.
    expect(edge.up).toBeGreaterThan(inside.up);
    expect(edge.down).toBe(0);
    expect(behind.down).toBeGreaterThan(0);
    expect(behind.up).toBe(0);
    expect(inside.down).toBe(0);
    expect(edge.foam).toBeGreaterThan(inside.foam);
    expect(edge.foam).toBeLessThan(0.5);
    roadAt(0, 0.5, 15, 1, s);
    expect(s.foam).toBeGreaterThan(edge.foam);
    fanAt(1, 0.5, 15, 1, s);
    expect(s.cover).toBe(0);
    fanAt(0, FAN_LIFE + 0.01, 15, 1, s);
    expect(s.cover).toBe(0);
  });

  it("is stirred, not whitened, by a crawl", () => {
    const s = wakeSection();
    const crawl = SPEED_MIN - 0.5;
    expect(washOf(crawl)).toBeGreaterThan(0);
    fanAt(0.85, 0.3, crawl, roadStrength(crawl, 1), s);
    expect(s.foam).toBe(0);
    expect(s.churn).toBeGreaterThan(0);
    expect(s.up).toBeGreaterThan(0);
    // …and a craft on the plane stirs it harder and throws a far taller
    // bow wave — the wave grows with the square of the wash.
    const stirred = s.churn;
    const lifted = s.up;
    fanAt(0.85, 0.3, 15, roadStrength(15, 1), s);
    expect(s.churn).toBeGreaterThan(stirred);
    expect(s.up).toBeGreaterThan(lifted * 4);
    expect(s.foam).toBeGreaterThan(0);
  });
});
