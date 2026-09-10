// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW HARD IT IS COMING DOWN — the three numbers everything wet is scaled
// by, all of them read off the wind the engine already seeded rather than
// invented. What is held here is that the DRY skies are exactly dry, that
// the wet ones read their level's own heaviness, and that a downpour takes
// the distance with it.
import { describe, expect, it } from "vitest";

import { TUNING, WEATHER_IDS } from "@engine";

import { fallOf, precipReach, squallOf } from "../pwa/src/game/weather.ts";

describe("how hard a sky rains", () => {
  it("puts nothing at all in the air under a dry sky", () => {
    // Exactly zero, not almost: an overcast lid with a stray drop under it
    // is the fault that makes a rider stop believing any of the weather.
    for (const weather of ["clear", "high", "overcast"] as const) {
      for (const cover of [0, 0.5, 1]) expect(fallOf(weather, cover)).toBe(0);
    }
  });

  it("rains properly the moment it rains at all", () => {
    // Drizzle is not a weather this game has: a level billed as rain that
    // shows a few scratches on the lens is worse than no weather at all.
    expect(fallOf("rain", 0)).toBeGreaterThan(0.5);
    expect(fallOf("rain", 1)).toBeGreaterThan(fallOf("rain", 0));
    // At the same heaviness a squall out-rains rain — the two bands
    // overlap on purpose, so the wettest rain level and the driest squall
    // are the same downpour under two different ceilings.
    for (const cover of [0, 0.5, 1]) {
      expect(fallOf("squall", cover)).toBeGreaterThan(fallOf("rain", cover));
    }
    expect(fallOf("squall", 1)).toBe(1);
  });

  it("never asks for more than a downpour, on any sky at any cover", () => {
    for (const weather of WEATHER_IDS) {
      for (const cover of [-1, 0, 0.5, 1, 2]) {
        const fall = fallOf(weather, cover);
        expect(fall).toBeGreaterThanOrEqual(0);
        expect(fall).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("the squall riding through", () => {
  it("reads the live gust against the band the wind is allowed", () => {
    // A squall IS a gust: the downdraught that carries the water is the
    // downdraught that shoves the hull, so the sheet thickens exactly as the
    // craft is pushed.
    const { gustMin, gustMax } = TUNING.wind;
    expect(squallOf(gustMin)).toBe(0);
    expect(squallOf(gustMax)).toBe(1);
    expect(squallOf((gustMin + gustMax) / 2)).toBeCloseTo(0.5, 6);
    // …and a gust outside the band is still a number the sheet can use.
    expect(squallOf(0)).toBe(0);
    expect(squallOf(9)).toBe(1);
  });
});

describe("how far the view runs through it", () => {
  it("is the whole fog in still air and well short of it in a downpour", () => {
    expect(precipReach(0)).toBe(1);
    expect(precipReach(1)).toBeLessThan(0.7);
    expect(precipReach(1)).toBeGreaterThan(0.4);
    expect(precipReach(0.5)).toBeGreaterThan(precipReach(1));
  });
});
