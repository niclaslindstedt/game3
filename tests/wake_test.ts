// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WAKE'S SHAPE (pwa/src/game/wake-profile.ts): what the map behind the
// craft carries, by speed and by age. The claims the reference photograph
// makes — a road that outlives its boil, a fan that spreads at Kelvin's
// angle with the SPEED, a crawl that stirs the water and whitens none of
// it — held as arithmetic, since how it LOOKS is `make screenshots`'s.

import { describe, expect, it } from "vitest";

import {
  BOIL_LIFE,
  CRATER_LIFE,
  FAN_HALF_MAX,
  FAN_LIFE,
  KELVIN_TAN,
  RING_LIFE,
  RING_SPEED,
  ROAD_LIFE,
  SPEED_MIN,
  SPLASH_LIFE,
  SPLASH_STATIONS,
  WAKE_HEIGHT,
  fanAt,
  fanHalf,
  roadAt,
  roadHalf,
  roadStrength,
  splashAt,
  splashReach,
  splashStations,
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

describe("the splash", () => {
  const RADIUS = 1.5;
  const DEPTH = 0.3;

  it("knocks a crater that forms over a moment and fills back in", () => {
    const s = wakeSection();
    splashAt(0, RADIUS, 0, 1, DEPTH, 1, s);
    expect(s.down).toBe(0);
    splashAt(0, RADIUS, 0.3, 1, DEPTH, 1, s);
    const formed = s.down;
    expect(formed).toBeGreaterThan(DEPTH * 0.2);
    expect(formed).toBeLessThanOrEqual(DEPTH);
    splashAt(0, RADIUS, 4 * CRATER_LIFE, 1, DEPTH, 1, s);
    expect(s.down).toBeLessThan(formed * 0.1);
    // A bowl: deepest at the centre, nothing of it at the rim.
    splashAt(RADIUS * 0.5, RADIUS, 0.3, 1, DEPTH, 1, s);
    expect(s.down).toBeLessThan(formed);
    expect(s.down).toBeGreaterThan(0);
  });

  it("rolls a ring wave out at its speed, thinning as it goes, laced white", () => {
    const s = wakeSection();
    const crestAt = (age: number) => {
      let best = -1;
      let at = 0;
      for (let r = 0; r < splashReach(RADIUS, age, 1); r += 0.02) {
        splashAt(r, RADIUS, age, 1, DEPTH, 1, s);
        if (s.up > best) {
          best = s.up;
          at = r;
        }
      }
      return { r: at, up: best };
    };
    const early = crestAt(0.5);
    const late = crestAt(1.5);
    expect(late.r - early.r).toBeCloseTo(RING_SPEED, 1);
    expect(late.up).toBeLessThan(early.up);
    expect(early.up).toBeGreaterThan(0);
    expect(early.up).toBeLessThan(WAKE_HEIGHT);
    // A trough drawn in just inside the crest, and foam on the crest itself.
    splashAt(early.r, RADIUS, 0.5, 1, DEPTH, 1, s);
    const crest = { ...s };
    splashAt(early.r - 0.9, RADIUS, 0.5, 1, DEPTH, 1, s);
    expect(s.down).toBeGreaterThan(crest.down);
    expect(crest.foam).toBeGreaterThan(0);
    // …and gone once it has lived its life.
    splashAt(RADIUS + RING_SPEED * (RING_LIFE + 0.1), RADIUS, RING_LIFE + 0.1, 1, DEPTH, 1, s);
    expect(s.up).toBe(0);
  });

  it("is the DETAIL row's: no ring at a ring share of nought, no crater at no depth", () => {
    const s = wakeSection();
    for (let r = 0; r < 8; r += 0.1) {
      splashAt(r, RADIUS, 0.6, 1, DEPTH, 0, s);
      expect(s.up).toBe(0);
      splashAt(r, RADIUS, 0.6, 1, 0, 1, s);
      expect(s.up).toBe(0);
      expect(s.down).toBe(0);
    }
    // The foam patch is there whatever the row says.
    splashAt(0, RADIUS, 0.6, 1, 0, 0, s);
    expect(s.foam).toBeGreaterThan(0);
    expect(splashReach(RADIUS, 0.6, 0)).toBeLessThan(splashReach(RADIUS, 0.6, 1));
  });

  it("feathers to nothing at its reach and is over after its life", () => {
    const s = wakeSection();
    for (const age of [0.1, 1, 2, SPLASH_LIFE - 0.1]) {
      const reach = splashReach(RADIUS, age, 1);
      splashAt(reach, RADIUS, age, 1, DEPTH, 1, s);
      expect(s.cover).toBe(0);
      splashAt(0, RADIUS, age, 1, DEPTH, 1, s);
      expect(s.cover).toBe(1);
      expect(s.foam).toBeGreaterThanOrEqual(0);
      expect(s.foam).toBeLessThanOrEqual(1);
    }
    splashAt(0, RADIUS, SPLASH_LIFE, 1, DEPTH, 1, s);
    expect(s.cover).toBe(0);
    expect(s.foam).toBe(0);
  });

  it("lays its stations ascending from the centre to the reach, on the ring", () => {
    const out = new Float32Array(SPLASH_STATIONS);
    for (const age of [0, 0.4, 1.2, 2.5]) {
      splashStations(RADIUS, age, 1, out);
      expect(out[0]).toBe(0);
      for (let i = 1; i < SPLASH_STATIONS; i++) expect(out[i]).toBeGreaterThanOrEqual(out[i - 1]);
      expect(out[SPLASH_STATIONS - 1]).toBeCloseTo(splashReach(RADIUS, age, 1), 5);
      if (age < RING_LIFE) {
        const crest = RADIUS + RING_SPEED * age;
        expect(Math.min(...Array.from(out, (r) => Math.abs(r - crest)))).toBeLessThan(1e-5);
      }
    }
  });
});
