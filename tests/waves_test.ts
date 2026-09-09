// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The wave field held to the theory it is built from: the dispersion
// relation in both limits, the shoaling coefficient's growth over a rising
// bed, the fetch law's growth to seaward, McCowan's breaking cap in the
// shallows, bounded heights everywhere, and purity — the same point at the
// same time is the same surface.
import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  TUNING,
  createGame,
  createSea,
  fetchGrowth,
  fetchHeight,
  fetchPeriod,
  heightAt,
  periodForHeight,
  placeRun,
  seaSummary,
  shoaling,
  step,
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
    // The sea is quoted at the course (the gates stand 40 m out on the
    // synthetic level): under the quote inshore, past it to seaward.
    expect(fetchGrowth(sea, 300)).toBeGreaterThan(1);
    expect(fetchGrowth(sea, 10)).toBeLessThan(1);
    const near = seaSummary(sea, 30);
    const far = seaSummary(sea, 300);
    expect(far.Hs).toBeGreaterThan(near.Hs * 1.25);
    // The lightest wind the rule book draws, over the game's fetch and
    // through `sea.heightScale`: near a metre at the shore and half as
    // much again at the bound — a sea that stands against a three-metre
    // hull, not a millpond. (The law alone grows 0.53/0.75 m here; the
    // dial is what puts the water in the world.)
    expect(near.Hs).toBeGreaterThan(0.8);
    expect(far.Hs).toBeGreaterThan(1.1);
    expect(far.Hs).toBeLessThan(1.8);
    expect(far.Tp).toBeGreaterThan(2.5);
    expect(far.Tp).toBeLessThan(6);
  });

  it("a stronger wind is a bigger sea", () => {
    const breeze = createSea(syntheticLevel({ windSpeed: 6 }), 1);
    const gale = createSea(syntheticLevel({ windSpeed: 14 }), 1);
    expect(seaSummary(gale, 200).Hs).toBeGreaterThan(seaSummary(breeze, 200).Hs * 2);
    expect(seaSummary(gale, 200).Hs).toBeGreaterThan(1.4);
  });

  it("a sea quoted by its height keeps that height at the course and a period to match", () => {
    const level = syntheticLevel({ windSpeed: 0 });
    const sea = createSea(level, 1, level.wind, { hs: 2 });
    // No wind to grow it: the quoted sea is uniform.
    expect(seaSummary(sea, 40).Hs).toBeCloseTo(2, 6);
    expect(seaSummary(sea, 400).Hs).toBeCloseTo(2, 6);
    expect(sea.tp).toBeCloseTo(periodForHeight(2), 6);
    // `sea.steepness` is the arcade dial, above nature's own: a quoted
    // two-metre sea is a short, steep one — a three-second wave about
    // seventeen metres long — not the five-or-six-second swell Toba's
    // mature sea would give it.
    expect(sea.tp).toBeGreaterThan(3);
    expect(sea.tp).toBeLessThan(4);
    const given = createSea(level, 1, level.wind, { hs: 2, tp: 9 });
    expect(given.tp).toBe(9);
    // With a wind under it the quoted height still grows to seaward.
    const windy = createSea(syntheticLevel({ windSpeed: 8 }), 1, undefined, { hs: 1 });
    expect(seaSummary(windy, 40).Hs).toBeCloseTo(1, 1);
    expect(seaSummary(windy, 300).Hs).toBeGreaterThan(1.1);
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
    // The amplitudes are quoted at the course; the sweep runs out to
    // z = 390, where the fetch has grown them. Shoaling can lift a
    // component past its deep amplitude too; the cap on the sum is
    // McCowan's, tested below. Out at sea the grown deep bound holds.
    bound *= fetchGrowth(sea, 390);
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
    expect(Math.abs(s.height)).toBeLessThan(0.1);
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

  it("sums only the longest components when asked, off the same field", () => {
    const full = surfaceAt(sea, level, 300, 250, 2);
    const none = surfaceAt(sea, level, 300, 250, 2, undefined, 0);
    expect(none.height).toBe(0);
    expect(none.ny).toBe(1);
    const all = surfaceAt(sea, level, 300, 250, 2, undefined, sea.components.length);
    expect(all).toEqual(full);
    // The first component is the longest.
    for (let i = 1; i < sea.components.length; i++)
      expect(sea.components[i].k0).toBeGreaterThan(sea.components[i - 1].k0);
  });
});

describe("the storm", () => {
  // A twenty-metre sea over deep water: the ceiling the model is sized
  // to carry. Nothing caps it but the depth (McCowan) and the fully
  // developed law, and the hull rides it without a number going wrong.
  const level = syntheticLevel({ windSpeed: 0, depth: 60, seaward: 1600 });
  const sea = createSea(level, 3, level.wind, { hs: 20 });

  it("stands twenty metres of significant height with a period that makes a wall", () => {
    expect(seaSummary(sea, 800).Hs).toBeCloseTo(20, 6);
    // A REAL twenty-metre sea is a five-hundred-metre swell with a
    // ten-degree face — at sea you feel it and from a boat you cannot see
    // it. The dial buys a young storm sea instead: near twelve seconds
    // and under half that length, a face you have to climb. It stays
    // clear of Michell's 1/7 all the same, or the whole sea sits on the
    // point of breaking and the renderer paints every face white.
    expect(sea.tp).toBeGreaterThan(9);
    expect(sea.tp).toBeLessThan(14);
    const lambda = (TUNING.g * sea.tp * sea.tp) / (2 * Math.PI);
    expect(lambda).toBeLessThan(250);
    expect(20 / lambda).toBeLessThan(1 / 7);
    let bound = 0;
    for (const c of sea.components) bound += c.amp;
    let max = 0;
    for (let i = 0; i < 600; i++) {
      const x = 100 + (i % 30) * 20;
      const z = 400 + Math.floor(i / 30) * 40;
      const s = surfaceAt(sea, level, x, z, i * 0.41);
      for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true);
      expect(s.ny).toBeGreaterThan(0.5);
      max = Math.max(max, Math.abs(s.height));
    }
    // A sixty-metre bed lets it stand: the tallest crest over the sweep is
    // well past a house and under the summed amplitudes.
    expect(max).toBeGreaterThan(8);
    expect(max).toBeLessThanOrEqual(bound * 1.05);
    expect(max).toBeLessThanOrEqual((0.78 * 60) / 2 + 1e-6);
  });

  it("the hull rides it: ten seconds flat out, every reading finite and bounded", () => {
    const state = createGame({ seed: 3, level, sea: { hs: 20 }, quiet: true });
    placeRun(state, { x: 400, z: 800, heading: Math.PI, speed: 18 });
    let lowest = Infinity;
    let highest = -Infinity;
    for (let i = 0; i < 1200; i++) {
      step(state, { ...NEUTRAL_INPUT, throttle: 1 });
      const c = state.craft;
      for (const v of [c.x, c.y, c.z, c.vx, c.vy, c.vz, c.wx, c.wy, c.wz, c.pitch, c.roll])
        expect(Number.isFinite(v)).toBe(true);
      lowest = Math.min(lowest, c.y);
      highest = Math.max(highest, c.y);
      expect(c.speed).toBeLessThanOrEqual(TUNING.hull.maxSpeed);
    }
    // It rode the swell: several metres of heave, never through the bed.
    expect(highest - lowest).toBeGreaterThan(4);
    expect(lowest).toBeGreaterThan(-30);
  });
});
