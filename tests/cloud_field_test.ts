// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOUD CHART, and the noise under it. Two things are held here that a
// screenshot cannot hold:
//
//   THE CHART'S RULES — a clear sky is EMPTY, a weathered one is a deck with
//   its scud under it and the scud hangs under its own base, and the same
//   seed dresses the same sky every time it is ridden.
//
//   THE NOISE, TWICE — `cloud-field.ts` states the field once as GLSL for
//   the dome and the water's mirror and once as TypeScript for the CPU's
//   cloud-over-the-sun. Nothing compiles the GLSL here, so what is checked
//   is that the TypeScript half is a field at all — bounded, smooth, and
//   turning coverage and sharpness into the density rule the shader
//   restates verbatim (`CLOUD_DENSITY_GLSL`).
import { describe, expect, it } from "vitest";

import { generateLevel, skyCover, WEATHER_IDS } from "@engine";

import {
  cloudDensity,
  cloudField,
  cloudUv,
  dressSky,
  fibreAt,
  MAX_LAYERS,
  sunOcclusion,
  type CloudLayer,
} from "../pwa/src/game/cloud-field.ts";
import { skyAt } from "../pwa/src/game/sky.ts";

const LEVEL = { seed: 38, wind: { from: 1.1, speed: 11 } };
/** Where a lid hangs for these tests, m — a real preset's `deck.base`. */
const BASE = 240;

function dress(weather: (typeof WEATHER_IDS)[number], cover = 0.5): CloudLayer[] {
  const lidded = weather !== "clear" && weather !== "high";
  return dressSky(LEVEL, weather, cover, lidded ? BASE : null).layers;
}

describe("what the chart puts over a level", () => {
  it("leaves a clear sky completely empty", () => {
    // The whole point of the row: R19 has a sky for "fair, with something in
    // it" and it is `high`. A token cloud in this one is what made the two
    // read as the same picture.
    expect(dress("clear")).toEqual([]);
  });

  it("gives high cloud two floors at two altitudes", () => {
    const layers = dress("high");
    expect(layers).toHaveLength(2);
    const [low, high] = layers;
    expect(low.genus).toBe("cumulus");
    expect(high.genus === "cirrus" || high.genus === "cirrostratus").toBe(true);
    // Kilometres apart, and moving at different speeds — which is the
    // parallax that separates this sky from the clear one.
    expect(high.altitude - low.altitude).toBeGreaterThan(4000);
    expect(high.drift).not.toBe(low.drift);
    // The veil is the sky; the heaps under it are what it can be read
    // without.
    expect(high.rank).toBeLessThan(low.rank);
  });

  it("hangs a deck with its scud UNDER the base, whatever the base is", () => {
    for (const weather of ["overcast", "rain", "squall"] as const) {
      for (const base of [110, 240, 520]) {
        const layers = dressSky(LEVEL, weather, 0.5, base).layers;
        expect(layers).toHaveLength(2);
        const deck = layers.find((l) => l.deck);
        const scud = layers.find((l) => !l.deck);
        if (!deck || !scud) throw new Error("a lid is a deck and its scud");
        expect(deck.altitude).toBe(base);
        expect(deck.coverage).toBe(1);
        // A share of the base rather than a fixed drop below it: a squall's
        // ceiling comes down to a hundred metres, and a rag ninety metres
        // under that one is at mast height.
        expect(scud.altitude).toBeGreaterThan(base * 0.5);
        expect(scud.altitude).toBeLessThan(base);
        expect(scud.genus).toBe("scud");
        expect(scud.drift).toBeGreaterThan(deck.drift);
      }
    }
  });

  it("tears the scud harder under a squall than under a dry lid", () => {
    const dry = dress("overcast").find((l) => !l.deck);
    const wild = dress("squall").find((l) => !l.deck);
    expect(wild?.drift).toBeGreaterThan(dry?.drift ?? 0);
    expect(wild?.coverage).toBeGreaterThan(dry?.coverage ?? 0);
  });

  it("never stacks more sheets than the sky can draw, and orders them low to high", () => {
    for (const weather of WEATHER_IDS) {
      for (const cover of [0, 0.5, 1]) {
        const layers = dress(weather, cover);
        expect(layers.length).toBeLessThanOrEqual(MAX_LAYERS);
        for (let i = 1; i < layers.length; i++) {
          expect(layers[i].altitude).toBeGreaterThanOrEqual(layers[i - 1].altitude);
        }
      }
    }
  });

  it("dresses the same sky for the same level, every time", () => {
    // Nothing here draws on `Math.random`: a seed ridden twice brings the
    // same clouds back, which is what lets a lab photograph the same moment.
    expect(dress("high")).toEqual(dress("high"));
    const other = dressSky({ seed: 39, wind: { from: 1.1, speed: 11 } }, "high", 0.5, null).layers;
    expect(other).not.toEqual(dress("high"));
  });

  it("hangs the deck where the preset says the ceiling is", () => {
    // The one number the lid's colours and its geometry must agree on: it is
    // passed in from the preset rather than rolled a second time here.
    const level = generateLevel(38);
    const cover = skyCover(level.wind.speed);
    const preset = skyAt(12, 62, "squall", cover);
    if (!preset.deck) throw new Error("a squall has a deck");
    const deck = dressSky(level, "squall", cover, preset.deck.base).layers.find((l) => l.deck);
    expect(deck?.altitude).toBe(preset.deck.base);
  });
});

describe("the field a sheet is cut from", () => {
  it("stays inside the unit range and moves smoothly", () => {
    let lo = 1;
    let hi = 0;
    for (let i = 0; i < 400; i++) {
      const v = cloudField(i * 0.37, i * 0.91, 4);
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThanOrEqual(1);
    // A field, not a hash: a step of a hundredth of a cell barely moves it.
    const a = cloudField(3.2, 1.7, 4);
    const b = cloudField(3.21, 1.7, 4);
    expect(Math.abs(a - b)).toBeLessThan(0.05);
  });

  it("turns coverage into how much of the sky is cloud", () => {
    const share = (coverage: number): number => {
      let on = 0;
      for (let i = 0; i < 2000; i++) {
        const n = cloudField(i * 0.13, i * 0.29, 4);
        on += cloudDensity({ coverage, sharpness: 0.5 }, n);
      }
      return on / 2000;
    };
    expect(share(0.1)).toBeLessThan(share(0.5));
    expect(share(0.5)).toBeLessThan(share(0.95));
    // A coverage of one is a sky with no hole in it.
    expect(share(1)).toBeGreaterThan(0.9);
  });

  it("softens the edge as sharpness falls", () => {
    const edge = (sharpness: number): number => {
      // How far the density takes to walk from nothing to everything.
      let width = 0;
      for (let i = 0; i < 200; i++) {
        const n = 0.4 + i * 0.002;
        const d = cloudDensity({ coverage: 0.5, sharpness }, n);
        if (d > 0.01 && d < 0.99) width++;
      }
      return width;
    };
    expect(edge(0.15)).toBeGreaterThan(edge(0.85));
  });

  it("reads a sheet along the wind, so a streak lies down it", () => {
    const layer = { scale: 100, streak: 4, seed: 0 };
    // A step ALONG the wind moves the sample four times less than the same
    // step across it — which is what a comb is.
    const along = cloudUv(layer, 40, 0, 0, 0, 1, 0);
    const across = cloudUv(layer, 0, 40, 0, 0, 1, 0);
    expect(Math.abs(along[0])).toBeCloseTo(Math.abs(across[1]) / 4, 6);
  });

  it("fades the fibres out toward the rim and leaves them overhead", () => {
    expect(fibreAt(0)).toBe(0);
    expect(fibreAt(0.02)).toBeLessThan(0.1);
    expect(fibreAt(1)).toBe(1);
  });
});

describe("what is between a point and the sun", () => {
  const sheet = dress("high")[0];

  it("shades nothing from under the sheet, or with the sun on the water", () => {
    const above = { x: 0, y: sheet.altitude + 10, z: 0 };
    const sun = { x: 0, y: 0.8, z: 0.6 };
    expect(sunOcclusion(sheet, above.x, above.y, above.z, sun, 0, 0, 1, 0, 4)).toBe(0);
    expect(sunOcclusion(sheet, 0, 0, 0, { x: 0, y: 0, z: 1 }, 0, 0, 1, 0, 4)).toBe(0);
  });

  it("comes and goes as the sheet drifts over the sun", () => {
    const sun = { x: 0, y: 0.8, z: 0.6 };
    let seen = 0;
    let clearSky = 0;
    for (let i = 0; i < 300; i++) {
      const shade = sunOcclusion(sheet, 0, 0, 0, sun, i * 30, 0, 1, 0, 4);
      expect(shade).toBeGreaterThanOrEqual(0);
      expect(shade).toBeLessThanOrEqual(1);
      if (shade > 0.5) seen++;
      if (shade < 0.05) clearSky++;
    }
    // Both happen: the sun goes behind cloud and comes back out.
    expect(seen).toBeGreaterThan(0);
    expect(clearSky).toBeGreaterThan(0);
  });
});
