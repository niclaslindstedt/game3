// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The wave field held to the theory it is built from: the dispersion
// relation in both limits, the shoaling coefficient's growth over a rising
// bed, the fetch law's growth to seaward, McCowan's breaking cap in the
// shallows, bounded heights everywhere, and purity — the same point at the
// same time is the same surface.
import { describe, expect, it } from "vitest";

import {
  TUNING,
  createSea,
  fetchGrowth,
  fetchHeight,
  fetchPeriod,
  heightAt,
  seaSummary,
  shoaling,
  surfaceAt,
  wavenumber,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const G = TUNING.g;

describe("dispersion", () => {
  it("reads deep water as ω² = g·k", () => {
    const omega = 2;
    const k = wavenumber(omega, 200);
    expect(k).toBeCloseTo((omega * omega) / G, 3);
  });

  it("reads shallow water as ω = k·√(g·d)", () => {
    const omega = 0.6;
    const d = 0.5;
    const k = wavenumber(omega, d);
    expect(k).toBeCloseTo(omega / Math.sqrt(G * d), 1);
  });

  it("shortens a wave as the bed rises", () => {
    const omega = 1.5;
    expect(wavenumber(omega, 2)).toBeGreaterThan(wavenumber(omega, 8));
    expect(wavenumber(omega, 8)).toBeGreaterThan(wavenumber(omega, 30) * 0.999);
  });

  it("satisfies ω² = g·k·tanh(k·d) to a couple of per cent everywhere", () => {
    for (const omega of [0.7, 1.2, 2.5]) {
      for (const d of [0.4, 1, 3, 10, 30]) {
        const k = wavenumber(omega, d);
        const lhs = omega * omega;
        const rhs = G * k * Math.tanh(k * d);
        expect(Math.abs(lhs - rhs) / lhs, `ω=${omega} d=${d}`).toBeLessThan(0.03);
      }
    }
  });
});

describe("shoaling and fetch", () => {
  it("the shoaling coefficient is one in deep water and grows in the shallows", () => {
    const omega = 1;
    const deep = shoaling(omega, wavenumber(omega, 40), 40);
    const shallow = shoaling(omega, wavenumber(omega, 0.5), 0.5);
    expect(deep).toBeCloseTo(1, 2);
    expect(shallow).toBeGreaterThan(1.3);
  });

  it("the fetch law grows with fetch and wind and caps at the developed sea", () => {
    expect(fetchHeight(8, 5000)).toBeGreaterThan(fetchHeight(8, 1000));
    expect(fetchHeight(12, 5000)).toBeGreaterThan(fetchHeight(8, 5000));
    expect(fetchHeight(8, 1e7)).toBeCloseTo((0.21 * 64) / G, 3);
    expect(fetchPeriod(8, 5000)).toBeGreaterThan(fetchPeriod(8, 1000));
    expect(fetchHeight(0, 5000)).toBe(0);
  });

  it("the chop builds riding out to sea", () => {
    const level = syntheticLevel({ windSpeed: 6 });
    const sea = createSea(level, 1);
    expect(fetchGrowth(sea, 300)).toBeGreaterThan(fetchGrowth(sea, 30));
    expect(fetchGrowth(sea, 300)).toBeLessThanOrEqual(1);
    const near = seaSummary(sea, 30);
    const far = seaSummary(sea, 300);
    expect(far.Hs).toBeGreaterThan(near.Hs * 1.3);
    // A 6 m/s breeze over the game's fetch: a chop, not a swell and not a
    // millpond.
    expect(far.Hs).toBeGreaterThan(0.2);
    expect(far.Hs).toBeLessThan(1.2);
    expect(far.Tp).toBeGreaterThan(1.5);
    expect(far.Tp).toBeLessThan(6);
  });

  it("a stronger wind is a bigger sea", () => {
    const calm = createSea(syntheticLevel({ windSpeed: 3 }), 1);
    const gale = createSea(syntheticLevel({ windSpeed: 12 }), 1);
    expect(seaSummary(gale, 200).Hs).toBeGreaterThan(seaSummary(calm, 200).Hs * 3);
  });
});

describe("the surface", () => {
  const level = syntheticLevel({ windSpeed: 9 });
  const sea = createSea(level, 42);

  it("is pure: the same point and time twice is the same surface", () => {
    const a = surfaceAt(sea, level, 123.4, 210.7, 5.25);
    const b = surfaceAt(sea, level, 123.4, 210.7, 5.25);
    expect(a).toEqual(b);
    // And nothing in between advanced it.
    surfaceAt(sea, level, 50, 50, 99);
    expect(surfaceAt(sea, level, 123.4, 210.7, 5.25)).toEqual(a);
  });

  it("heights stay within the summed amplitudes everywhere", () => {
    let bound = 0;
    for (const c of sea.components) bound += c.amp;
    // Shoaling can lift a component past its deep amplitude; the cap on
    // the sum is McCowan's, tested below. Out at sea the deep bound holds.
    let max = 0;
    for (let i = 0; i < 400; i++) {
      const x = 100 + (i % 20) * 30;
      const z = 200 + Math.floor(i / 20) * 10;
      const h = Math.abs(heightAt(sea, level, x, z, i * 0.37));
      if (h > max) max = h;
    }
    expect(max).toBeLessThanOrEqual(bound * 1.05);
    expect(max).toBeGreaterThan(0.05);
  });

  it("breaks at McCowan's limit in the shallows", () => {
    // z = 4 m is 0.8 m of water on the synthetic slope.
    for (let i = 0; i < 200; i++) {
      const s = surfaceAt(sea, level, 50 + i * 3, 4, i * 0.21);
      expect(Math.abs(s.height)).toBeLessThanOrEqual((0.78 * 0.8) / 2 + 1e-6);
    }
  });

  it("is flat on the land and finite everywhere", () => {
    const s = surfaceAt(sea, level, 100, -50, 3);
    expect(Math.abs(s.height)).toBeLessThan(0.07);
    for (const [x, z] of [
      [-60, -120],
      [760, 400],
      [0, 0],
      [400, 40],
    ]) {
      const p = surfaceAt(sea, level, x, z, 12.5);
      for (const v of Object.values(p)) expect(Number.isFinite(v)).toBe(true);
      expect(Math.hypot(p.nx, p.ny, p.nz)).toBeCloseTo(1, 6);
      expect(p.ny).toBeGreaterThan(0.5);
    }
  });

  it("carries an orbital velocity that scales with the height and the frequency", () => {
    let maxV = 0;
    let maxH = 0;
    for (let i = 0; i < 300; i++) {
      const s = surfaceAt(sea, level, 300, 250, i * 0.05);
      maxV = Math.max(maxV, Math.hypot(s.vx, s.vz));
      maxH = Math.max(maxH, Math.abs(s.height));
    }
    // Deep water: u ≈ a·ω, and ω is a couple of rad/s for this chop.
    expect(maxV).toBeGreaterThan(maxH * 0.8);
    expect(maxV).toBeLessThan(maxH * 8);
  });

  it("the components travel with the wind", () => {
    const toward = level.wind.from + Math.PI;
    for (const c of sea.components) {
      const dir = Math.atan2(c.dirX, c.dirZ);
      let d = dir - toward;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      expect(Math.abs(d)).toBeLessThanOrEqual(TUNING.sea.spread + 1e-9);
    }
  });

  it("a wave crest moves: the surface at a fixed point changes with time", () => {
    const h0 = heightAt(sea, level, 300, 250, 0);
    const h1 = heightAt(sea, level, 300, 250, 0.8);
    expect(h0).not.toBeCloseTo(h1, 3);
  });
});
