// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The wave field held to the theory it is built from: the dispersion
// relation in both limits, the shoaling coefficient's growth over a rising
// bed, the fetch law, R28's two bands (the ocean's sea reaching the shore
// and stopping at the land, the local wind's chop filling what it cannot
// reach), R27's current, McCowan's breaking cap in the shallows, bounded
// heights everywhere, and purity — the same point at the same time is the
// same surface.
import { describe, expect, it } from "vitest";

import {
  NEUTRAL_INPUT,
  TUNING,
  LEVEL_RULES as R,
  createGame,
  createSea,
  createShelter,
  fetchHeight,
  fetchPeriod,
  heightAt,
  periodForHeight,
  placeRun,
  bedAt,
  sampleField,
  sampleFieldGradient,
  CRAFT,
  jumpableHs,
  STORM_CEILING,
  topSpeedOf,
  stormAt,
  seaShares,
  seaSummary,
  shoaling,
  step,
  surfaceAt,
  wavenumber,
} from "@engine";

import { LEVEL_SEEDS, levelFor } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const G = TUNING.g;

/** The height the sea ACTUALLY delivers along a row of the synthetic
 * coast over twenty seconds, m — Hs = 4·√(mean η²) over the row and the
 * window, as against the height the spectrum is quoted at.
 *
 * A row rather than a point, and the ROOT MEAN SQUARE rather than the
 * biggest crest to the deepest trough, because both are draws from the
 * superposition: the extreme is one lucky instant of one of them, and it
 * moves by a fifth between seeds whose seas are identical to three
 * figures. */
function delivered(
  sea: Parameters<typeof heightAt>[0],
  level: Parameters<typeof heightAt>[1],
  z: number,
): number {
  let sum = 0;
  let n = 0;
  for (let i = 0; i < 12; i++) {
    const x = 100 + i * 40;
    for (let t = 0; t < 20; t += 0.05) {
      const h = heightAt(sea, level, x, z, t);
      sum += h * h;
      n++;
    }
  }
  return 4 * Math.sqrt(sum / n);
}

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

  it("carries the ocean's own sea all the way in against the shore", () => {
    const level = syntheticLevel({ windSpeed: 6 });
    const sea = createSea(level, 1);
    // R12's wind blows in off the water, so every point of this coast has
    // the open sea upwind of it — including the water a few metres off the
    // beach. The quoted sea therefore stands from the seaward bound right
    // in to the shallows rather than fading toward the land.
    for (const z of [300, 120, 40, 12]) {
      expect(seaShares(sea, 400, z).ocean, `${z} m out`).toBeGreaterThan(0.95);
    }
    const near = seaSummary(sea, 400, 30);
    const far = seaSummary(sea, 400, 300);
    expect(near.Hs).toBeCloseTo(far.Hs, 1);
    // The lightest wind the rule book draws, over the game's fetch and
    // through `sea.heightScale`: a sea that stands against a three-metre
    // hull, not a millpond. (The law alone grows 0.75 m here; the dial is
    // what puts the water in the world.)
    expect(far.Hs).toBeGreaterThan(1.0);
    expect(far.Hs).toBeLessThan(1.8);
    expect(far.Tp).toBeGreaterThan(2.5);
    expect(far.Tp).toBeLessThan(6);
    // ...and what actually ARRIVES does not fade coming in: the bed rises
    // under it, so linear shoaling holds it up (a little, over a slope
    // this gentle) right until the depth is what clips it — which is the
    // breaking cap's own test below, not this one's.
    //
    // It does not arrive WHOLE, and should not: the spread fans the band
    // about the wind, and a component crossing this shore obliquely
    // refracts as it comes in, so its energy is spread along the beach
    // rather than concentrated up the slope the way a shore-normal ray's
    // is. Measured over eight seeds of this coast, the sea sixteen metres
    // out is 0.84–1.02 of the sea three hundred metres out.
    const offshore = delivered(sea, level, 300);
    expect(delivered(sea, level, 40)).toBeGreaterThan(offshore * 0.85);
    expect(delivered(sea, level, 16)).toBeGreaterThan(offshore * 0.85);
  });

  it("a stronger wind is a bigger sea", () => {
    const breeze = createSea(syntheticLevel({ windSpeed: 6 }), 1);
    const gale = createSea(syntheticLevel({ windSpeed: 14 }), 1);
    expect(seaSummary(gale, 400, 200).Hs).toBeGreaterThan(seaSummary(breeze, 400, 200).Hs * 2);
    expect(seaSummary(gale, 400, 200).Hs).toBeGreaterThan(1.4);
  });

  it("a sea quoted by its height keeps that height at the course and a period to match", () => {
    const level = syntheticLevel({ windSpeed: 0 });
    const sea = createSea(level, 1, level.wind, { hs: 2 });
    // A quoted sea is the OCEAN's, so it stands wherever the ocean can be
    // seen — which on an open coast is everywhere in the water.
    expect(seaSummary(sea, 400, 40).Hs).toBeCloseTo(2, 3);
    expect(seaSummary(sea, 400, 300).Hs).toBeCloseTo(2, 3);
    expect(sea.tp).toBeCloseTo(periodForHeight(2), 6);
    // `sea.steepness` is the arcade dial, above nature's own: a quoted
    // two-metre sea is a short, steep one — a three-second wave about
    // seventeen metres long — not the five-or-six-second swell Toba's
    // mature sea would give it.
    expect(sea.tp).toBeGreaterThan(3);
    expect(sea.tp).toBeLessThan(4);
    const given = createSea(level, 1, level.wind, { hs: 2, tp: 9 });
    expect(given.tp).toBe(9);
    // With a wind under it the quoted height is still the quote: the wind
    // only decides the CHOP that rides where the swell cannot reach.
    const windy = createSea(syntheticLevel({ windSpeed: 8 }), 1, undefined, { hs: 1 });
    expect(seaSummary(windy, 400, 40).Hs).toBeCloseTo(1, 1);
    expect(seaSummary(windy, 400, 300).Hs).toBeCloseTo(1, 1);
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
    // Every component at its own deep amplitude and all of them cresting
    // at once — the superposition that essentially never happens. Both
    // bands, since a point out here is dealt a share of each and the two
    // partition rather than add. Shoaling can lift a component past its
    // deep amplitude; the cap on the sum is McCowan's, tested below.
    let bound = 0;
    for (const c of sea.components) bound += c.amp;
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

  it("the components travel with the wind, fanned about it", () => {
    // Every one within the widest fan the spread law allows, the energy
    // running the wind's own way on average — and actually FANNED: a band
    // whose components all point one way is a corduroy of parallel crests,
    // which is what the sea looked like while the heading was drawn flat
    // and the cos² spread was taken out of the component's ENERGY instead.
    const toward = level.wind.from + Math.PI;
    let sx = 0;
    let sz = 0;
    let weight = 0;
    let widest = 0;
    for (const c of sea.components) {
      const dir = Math.atan2(c.dirX, c.dirZ);
      let d = dir - toward;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      expect(Math.abs(d)).toBeLessThanOrEqual(TUNING.sea.spreadMax + 1e-9);
      widest = Math.max(widest, Math.abs(d));
      const w = c.amp * c.amp;
      sx += w * Math.sin(d);
      sz += w * Math.cos(d);
      weight += w;
    }
    // The spread the energy actually stands at, not the one it was drawn
    // from: acos of the resultant's length (Mardia's circular dispersion).
    // It is a THIRD of the nominal half-width and that is the number to
    // read the dial by — eight strata of a cos² fan, weighted by the
    // energy the spectrum gives each, come out narrower than the fan.
    const spread = Math.acos(Math.min(1, Math.hypot(sx, sz) / weight));
    expect(spread).toBeGreaterThan(0.1);
    expect(spread).toBeLessThan(TUNING.sea.spread);
    expect(widest).toBeGreaterThan(TUNING.sea.spread);
  });

  it("runs the energy the wind's own way on average, over the corpus", () => {
    // One level's eight strata are one DRAW: its energy-weighted heading
    // sits a few degrees off the wind, either way, and which way is the
    // seed's business. What has to hold is the expectation — so this is
    // asked of the corpus, not of a seed. Asked of one it was ±5°, which
    // is a bar that passes or fails on the draw.
    let sum = 0;
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      const sea = createSea(level, seed);
      const toward = level.wind.from + Math.PI;
      let sx = 0;
      let sz = 0;
      for (const c of sea.components) {
        let d = Math.atan2(c.dirX, c.dirZ) - toward;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        const w = c.amp * c.amp;
        sx += w * Math.sin(d);
        sz += w * Math.cos(d);
      }
      sum += Math.atan2(sx, sz);
    }
    expect(Math.abs(sum / LEVEL_SEEDS.length)).toBeLessThan(0.05);
  });

  it("fans the short waves wider than the peak", () => {
    // Mitsuyasu et al. (1975): the spreading parameter peaks at f_p, so
    // the FAN is narrowest there and opens both ways — which is why open
    // water reads as texture riding on order rather than as one corduroy.
    const toward = level.wind.from + Math.PI;
    const off = (c: (typeof sea.components)[number]): number => {
      let d = Math.atan2(c.dirX, c.dirZ) - toward;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      return Math.abs(d);
    };
    // Split at the band's own MIDDLE component rather than at a multiple
    // of the peak: `sliceMix` crowds the slices onto the peak, so where
    // the components actually sit is the cut's business and not a number
    // this case should restate.
    const ocean = sea.components
      .filter((c) => c.band === "ocean")
      .sort((a, b) => a.omega - b.omega);
    const half = ocean.length >> 1;
    const mean = (cs: typeof ocean): number => cs.reduce((s, c) => s + off(c), 0) / cs.length;
    expect(half).toBeGreaterThan(2);
    expect(mean(ocean.slice(half))).toBeGreaterThan(mean(ocean.slice(0, half)));
  });

  it("spreads a band's energy over its components rather than lumping it", () => {
    // The trap this holds shut: while the heading was drawn flat and the
    // cos² spread weighted the component's ENERGY, a component that landed
    // at the edge of the fan was handed nearly none of it and its
    // neighbours took the whole sea — so a band of sixteen could arrive as
    // two or three waves, and the survivor could be steeper than any wave
    // stands. Over the corpus the worst share was two thirds of a band and
    // the worst component a·k 0.63, past Michell's 0.44 breaking limit.
    for (const seed of LEVEL_SEEDS.slice(0, 4)) {
      const sea = createSea(levelFor(seed), seed);
      for (const band of sea.bands) {
        const cs = [...band.at].map((i) => sea.components[i]);
        const energy = cs.reduce((s, c) => s + c.amp * c.amp, 0);
        if (energy <= 0) continue;
        const where = `seed ${seed} ${band.kind} band`;
        const top = Math.max(...cs.map((c) => (c.amp * c.amp) / energy));
        expect(top, `${where} biggest share`).toBeLessThan(0.65);
        expect(Math.max(...cs.map((c) => c.amp * c.k0)), `${where} steepest`).toBeLessThan(0.3);
      }
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

describe("the phase field", () => {
  const grad = new Float64Array(3);
  /** Where the OCEAN band's components sit in the sorted list — the ones
   * that carry a phase field at all. */
  const oceanBand = (sea: ReturnType<typeof createSea>): number[] =>
    sea.components.flatMap((c, i) => (c.band === "ocean" ? [i] : []));
  /** The length the field carries at a point against the depth's own:
   * |∇φ| / k(d), 1 where the eikonal holds. */
  const lengthRatio = (
    sea: ReturnType<typeof createSea>,
    ground: Parameters<typeof sampleField>[0],
    i: number,
    x: number,
    z: number,
  ): number => {
    const c = sea.components[i];
    if (!c.phaseField) throw new Error("an ocean component carries a field");
    sampleFieldGradient(c.phaseField, x, z, grad);
    return Math.hypot(grad[1], grad[2]) / wavenumber(c.omega, -sampleField(ground, x, z));
  };

  it("carries the depth's own wavelength wherever the sea stands", () => {
    // The bug this holds shut: a phase integrated along one heading carries
    // every shoal's delay downwind as an offset between neighbouring paths,
    // and the offset's lateral gradient read as a swell three to seven
    // times too short, crawling sideways, at seven of seed 41's ten gates.
    for (const seed of LEVEL_SEEDS.slice(0, 4)) {
      const level = levelFor(seed);
      const sea = createSea(level, seed);
      const g = level.ground;
      for (const gate of level.course.gates) {
        for (const i of oceanBand(sea)) {
          const ratio = lengthRatio(sea, g, i, gate.x, gate.z);
          expect(ratio, `seed ${seed} gate (${gate.x}, ${gate.z}) component ${i}`).toBeGreaterThan(
            0.9,
          );
          expect(ratio, `seed ${seed} gate (${gate.x}, ${gate.z}) component ${i}`).toBeLessThan(
            1.15,
          );
        }
      }
      // ...and over the exposed water at large, to within the creases where
      // two arrivals meet in a lee.
      let samples = 0;
      let held = 0;
      for (let r = 1; r < g.rows - 1; r += 4) {
        for (let c = 1; c < g.cols - 1; c += 4) {
          const x = g.originX + c * g.cell;
          const z = g.originZ + r * g.cell;
          if (-sampleField(g, x, z) < 2 || sampleField(sea.shelter.exposure, x, z) < 0.05) continue;
          for (const i of oceanBand(sea)) {
            const ratio = lengthRatio(sea, g, i, x, z);
            samples++;
            if (ratio > 0.8 && ratio < 1.25) held++;
          }
        }
      }
      expect(samples, `seed ${seed}`).toBeGreaterThan(1000);
      expect(held / samples, `seed ${seed}`).toBeGreaterThan(0.995);
    }
  });

  it("turns the crests toward the shore as they come in", () => {
    // An oblique sea on the synthetic shore: the wind blows in from the
    // south-west, so the waves travel north-east — toward the shore at
    // z = 0 and along it. Snell's law falls out of the eikonal: k·sin θ
    // along the shore is conserved, k grows over the rising bed, so the
    // angle to the shore's normal closes — by about 10° for the longest
    // component, which feels 10 m of water, and by nothing for the
    // shortest, which does not. The bed is deepened to 40 m so the water
    // at the rim is deep for every component: the field is fed the
    // deep-water plane wave there, and a rim a wave can feel the bottom
    // of would refract it at the rim itself.
    const level = syntheticLevel({ windSpeed: 8, windFrom: -Math.PI / 4, depth: 40 });
    const sea = createSea(level, 1);
    const x = 400;
    const deepZ = 300;
    const shallowZ = 10;
    const depthAt = (z: number): number => -sampleField(level.ground, x, z);
    const angleToNormal = (i: number, z: number): number => {
      const c = sea.components[i];
      if (!c.phaseField) throw new Error("an ocean component carries a field");
      sampleFieldGradient(c.phaseField, x, z, grad);
      // The shore's inward normal is −z.
      return Math.acos(-grad[2] / Math.hypot(grad[1], grad[2]));
    };
    let mostTurned = 0;
    for (const i of oceanBand(sea)) {
      const c = sea.components[i];
      // Out in the flat 40 m the field IS the plane wave: the gradient points
      // the component's own way and has its own length.
      sampleFieldGradient(c.phaseField!, x, deepZ, grad);
      const along = (grad[1] * c.dirX + grad[2] * c.dirZ) / Math.hypot(grad[1], grad[2]);
      expect(along, `component ${i} heading`).toBeGreaterThan(Math.cos(0.02));
      expect(lengthRatio(sea, level.ground, i, x, deepZ), `component ${i} deep`).toBeCloseTo(1, 1);
      // In 10 m of water the same component has shortened and turned in
      // by Snell's law. The length's band is wider here because the bed
      // climbs a metre a metre: k changes by a twentieth across one cell,
      // and the bilinear gradient read inside a cell is that cell's mean.
      const shallowRatio = lengthRatio(sea, level.ground, i, x, shallowZ);
      expect(shallowRatio, `component ${i} shallow`).toBeGreaterThan(0.85);
      expect(shallowRatio, `component ${i} shallow`).toBeLessThan(1.15);
      const deep = angleToNormal(i, deepZ);
      const shallow = angleToNormal(i, shallowZ);
      const snell =
        (Math.sin(deep) * wavenumber(c.omega, depthAt(deepZ))) /
        wavenumber(c.omega, depthAt(shallowZ));
      // Snell's TURN, not a fixed slice of a sine: the swept field turns
      // every component the way the law says and by at least as much,
      // overshooting it by about half again on the components that turn
      // appreciably and never by more than double. The overshoot is the
      // discretisation, and it is measurable: out in 30 m of water the
      // field lands on Snell to three decimals, and it is the shallow
      // station — where the bed climbs fastest, so the bilinear gradient
      // inside a cell is that cell's mean over a real range of depths —
      // that runs long.
      const turn = Math.sin(deep) - snell;
      const turned = Math.sin(deep) - Math.sin(shallow);
      expect(turned, `component ${i} obeys Snell`).toBeGreaterThan(turn - 1e-3);
      expect(turned, `component ${i} obeys Snell`).toBeLessThan(turn * 2 + 0.01);
      expect(shallow, `component ${i} never turns away`).toBeLessThanOrEqual(deep + 0.02);
      mostTurned = Math.max(mostTurned, deep - shallow);
    }
    // ...and by enough to SEE, which is a smaller angle than it was: the
    // fan is 26° about the wind rather than 34°, so the most oblique
    // component arrives at 71° to this shore's normal rather than 79°, and
    // how much a ray turns goes with how obliquely it came in. Measured
    // over eight seeds of this coast, the most-turned component swings
    // 6.5°–12.7°; seed 1's is 10.4°.
    expect(mostTurned).toBeGreaterThan(0.1);
  });
});

describe("R28 — two kinds of water", () => {
  it("gives the river the wind's chop and none of the ocean's sea", () => {
    for (const seed of LEVEL_SEEDS.slice(0, 4)) {
      const level = levelFor(seed);
      const sea = createSea(level, seed);
      const where = `seed ${seed}`;
      // The race is out in it: the sea the level is quoted at stands over
      // the open stretch of the course.
      const open = level.course.gates.map((g) => seaShares(sea, g.x, g.z).ocean);
      expect(Math.max(...open), where).toBeGreaterThan(0.9);
      // The river is not. Land has closed round it by a third of the way
      // up, and what is left is the local band: short, small, and the
      // wind's own doing.
      const river = level.river;
      const up = river[Math.round(river.length * 0.4)];
      const head = river[river.length - 1];
      for (const p of [up, head]) {
        expect(seaShares(sea, p.x, p.z).ocean, where).toBeLessThan(0.05);
      }
      expect(seaSummary(sea, up.x, up.z).Hs, where).toBeLessThan(sea.hsRef * 0.25);
      expect(seaSummary(sea, head.x, head.z).Tp, where).toBeCloseTo(sea.localTp, 6);
      expect(sea.localTp, where).toBeLessThan(sea.tp);
    }
  });

  it("leaves the mean wind out at sea and takes most of it off a river", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    const shelter = createShelter(level);
    const at = (p: { x: number; z: number }): number => sampleField(shelter.shelter, p.x, p.z);
    const gates = level.course.gates.map(at);
    expect(Math.max(...gates)).toBeGreaterThan(0.95);
    const head = level.river[level.river.length - 1];
    expect(at(head)).toBeLessThan(0.45);
    expect(at(head)).toBeGreaterThanOrEqual(TUNING.wind.shelter);
  });
});

describe("R27 — the river runs", () => {
  it("carries its discharge down the channel, quickening as the banks close", () => {
    for (const seed of LEVEL_SEEDS.slice(0, 4)) {
      const level = levelFor(seed);
      // Read on a level with the wind taken out of it, so the whole of
      // what the water is doing is the current and none of it is orbital.
      const sea = createSea(level, seed, { from: level.wind.from, speed: 0 });
      const river = level.river;
      const speedAt = (p: { x: number; z: number }): number => {
        const s = surfaceAt(sea, level, p.x, p.z, 0);
        return Math.hypot(s.vx, s.vz);
      };
      const mouth = speedAt(river[0]);
      const narrow = speedAt(river[Math.round(river.length * 0.75)]);
      // Slow across the wide, deep reach at the mouth; quicker where the
      // banks have closed in, because the same volume has to fit through.
      expect(mouth, `seed ${seed}`).toBeGreaterThan(0.1);
      expect(narrow, `seed ${seed}`).toBeGreaterThan(mouth * 1.3);
      expect(narrow, `seed ${seed}`).toBeLessThan(1.5 * R.flow.max);
    }
  });

  it("runs the water DOWN the river, out toward the mouth", () => {
    const seed = LEVEL_SEEDS[1];
    const level = levelFor(seed);
    const sea = createSea(level, seed, { from: level.wind.from, speed: 0 });
    const river = level.river;
    const i = Math.round(river.length * 0.5);
    const s = surfaceAt(sea, level, river[i].x, river[i].z, 0);
    // Downstream is the way the line was drawn UP, reversed.
    const dx = river[i - 1].x - river[i + 1].x;
    const dz = river[i - 1].z - river[i + 1].z;
    const len = Math.hypot(dx, dz);
    expect((s.vx * dx + s.vz * dz) / len).toBeGreaterThan(0.2);
  });

  it("is still water out on the course, where there is no river", () => {
    const seed = LEVEL_SEEDS[2];
    const level = levelFor(seed);
    // A calm sea has no orbital velocity either, so the whole reading at a
    // gate far from the mouth is what the current is: nothing.
    const still = createSea(level, seed, { from: level.wind.from, speed: 0 });
    for (const g of level.course.gates) {
      const river = level.river[0];
      if (Math.hypot(g.x - river.x, g.z - river.z) < 300) continue;
      const s = surfaceAt(still, level, g.x, g.z, 0);
      expect(Math.hypot(s.vx, s.vz), g.id).toBeLessThan(1e-6);
    }
  });
});

describe("the open ocean past the rim", () => {
  // A deep synthetic coast: the shore at z = 0, the water running out to
  // the level's own edge at z = `seaward`, and past that the open ocean
  // (`ocean.ts`). Everything here is measured along +z, so how far past the
  // rim a point is is just `z − seaward`.
  const SEAWARD = 400;
  const level = syntheticLevel({ windSpeed: 10, depth: 40, seaward: SEAWARD });
  const sea = createSea(level, 5);
  const O = TUNING.sea.open;
  const out = (past: number): number => SEAWARD + past;

  it("builds the whole way out and stops at the storm it was dealt", () => {
    let last = 0;
    for (let past = 0; past <= O.reach * 1.5; past += O.reach / 50) {
      const { Hs } = seaSummary(sea, 400, out(past));
      // Never a dip: the handover from the coast's spectrum to the storm's
      // has to carry the height across, not cross through a calm belt.
      expect(Hs, `${past} m past the rim`).toBeGreaterThanOrEqual(last - 1e-9);
      last = Hs;
    }
    expect(seaSummary(sea, 400, out(0)).Hs).toBeCloseTo(sea.hsRef, 6);
    expect(seaSummary(sea, 400, out(O.reach)).Hs).toBeCloseTo(sea.openHs, 6);
    // ...and a ceiling past it, however far a rider holds the throttle open.
    expect(seaSummary(sea, 400, out(O.reach * 40)).Hs).toBeCloseTo(sea.openHs, 6);
  });

  it("deals a storm in the top of what the fastest craft can still jump", () => {
    // The ocean is not the same every ride: each seed draws its storm over
    // the top `vary` of the ceiling, so the biggest is rare — and NOTHING
    // anywhere quotes a height, so a speed class moves the whole band.
    const heights = new Set<number>();
    for (let seed = 0; seed < 60; seed++) {
      const its = createSea(level, seed);
      expect(its.openHs, `seed ${seed}`).toBeGreaterThanOrEqual(STORM_CEILING * O.vary - 1e-9);
      expect(its.openHs, `seed ${seed}`).toBeLessThanOrEqual(STORM_CEILING + 1e-9);
      heights.add(Math.round(its.openHs * 100));
    }
    // ...and it really varies rather than landing on one number.
    expect(heights.size).toBeGreaterThan(40);
  });

  it("sizes the ceiling off the fastest craft, as the square of its speed", () => {
    // The whole point: the biggest sea is the biggest a craft can fly over
    // the rim of and down to the floor of, so it is a function of the top
    // speed and of nothing else. Doubling the speed quadruples it.
    expect(STORM_CEILING).toBeCloseTo(jumpableHs(Math.max(...CRAFT.map(topSpeedOf))), 9);
    expect(jumpableHs(40)).toBeCloseTo(4 * jumpableHs(20), 9);
    expect(jumpableHs(0)).toBe(0);
    // ...and a flight at that speed spans exactly the wave's crest-to-trough
    // run, which is what "can still jump it" means (`ocean.ts`).
    for (const v of [20, 30, 45, 60]) {
      const hs = jumpableHs(v);
      const width = hs / (2 * TUNING.sea.steepness);
      const face = Math.atan(Math.PI * TUNING.sea.steepness);
      const vy = v * Math.sin(face);
      const flight = (vy + Math.sqrt(vy * vy + 2 * TUNING.g * hs)) / TUNING.g;
      expect(v * Math.cos(face) * flight, `${v} m/s`).toBeCloseTo(width, 6);
    }
  });

  it("keeps the bed ahead of the sea, so nothing clips the storm", () => {
    // Also the guard on the speed class: raise it far enough and the ceiling
    // outgrows this bed, and this fails rather than quietly clipping.
    expect(STORM_CEILING / TUNING.sea.breakingHs).toBeLessThan(O.depth);
    for (let past = 0; past <= O.reach; past += O.reach / 200) {
      const z = out(past);
      const depth = -bedAt(level, 400, z);
      const { Hs } = seaSummary(sea, 400, z);
      expect(Hs, `${past} m past the rim`).toBeLessThan(TUNING.sea.breakingHs * depth);
    }
    expect(-bedAt(level, 400, out(O.reach))).toBeCloseTo(O.depth, 6);
  });

  it("leaves the level's own water exactly as it was", () => {
    // Inside the bounds the storm's ramp is 0, so the open band is skipped
    // and every share is the one the coast always had.
    for (let z = 20; z <= SEAWARD; z += 20) {
      expect(stormAt(level.bounds, 400, z), `${z} m out`).toBe(0);
      expect(seaShares(sea, 400, z).open, `${z} m out`).toBe(0);
    }
  });

  it("carries the waves on travelling past the rim instead of freezing them", () => {
    // The bug this holds shut: the phase field is a grid, its sampler
    // clamps, and a clamped gradient is a wave vector of nothing — the sea
    // outside the level heaving in one place with no crest going anywhere.
    // Two points a fraction of a wavelength apart along the outward axis
    // must not read the same surface, and the crest must move with t.
    const z = out(O.reach * 0.3);
    const a = heightAt(sea, level, 400, z, 0);
    const b = heightAt(sea, level, 400, z + 12, 0);
    expect(Math.abs(a - b)).toBeGreaterThan(0.05);
    const later = heightAt(sea, level, 400, z, 1.7);
    expect(Math.abs(a - later)).toBeGreaterThan(0.05);
  });

  it("meets the level's own sea at the rim without a step in it", () => {
    // The open band is 0 at the rim and the ocean band's phase is carried
    // on outward from the plane wave the field was seeded with there, so
    // crossing the rim is not an event.
    //
    // Measured as CONTINUITY, not as "the smallest step": sample the one
    // step that straddles the rim at finer and finer resolution, and it has
    // to shrink in proportion. A smooth surface halves its step when the
    // step halves; a discontinuity keeps whatever it jumps by however
    // closely you look, which is exactly the fault this guards. Asking
    // instead that the rim be no steeper than its neighbours says nothing —
    // the rim is as likely as any other point to be on the steep part of a
    // wave, and on this seed at t = 0 it is.
    for (const t of [0, 3.5, 11]) {
      const at = (step: number): number =>
        Math.abs(
          heightAt(sea, level, 400, SEAWARD + step, t) - heightAt(sea, level, 400, SEAWARD, t),
        );
      const coarse = at(0.25);
      const fine = at(0.0025);
      expect(fine, `t ${t}`).toBeLessThan(coarse / 50);
    }
  });

  it("is finite and level everywhere out there", () => {
    const cap = STORM_CEILING * 4;
    for (let i = 0; i < 500; i++) {
      const x = 100 + (i % 25) * 30;
      const z = out((O.reach * 1.5 * Math.floor(i / 25)) / 20);
      const s = surfaceAt(sea, level, x, z, i * 0.37);
      for (const v of Object.values(s)) expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(s.height), `(${x}, ${z})`).toBeLessThan(cap);
      expect(s.ny).toBeGreaterThan(0.3);
    }
  });

  it("has no storm out at sea on a level with no wind", () => {
    const calm = createSea(syntheticLevel({ windSpeed: 0, depth: 40, seaward: SEAWARD }), 5);
    expect(calm.openHs).toBe(0);
    expect(seaSummary(calm, 400, out(O.reach * 2)).Hs).toBe(0);
    expect(heightAt(calm, level, 400, out(O.reach * 2), 4)).toBe(0);
  });
});

describe("the storm", () => {
  // A twenty-metre sea over deep water: the ceiling the model is sized
  // to carry. Nothing caps it but the depth (McCowan) and the fully
  // developed law, and the hull rides it without a number going wrong.
  const level = syntheticLevel({ windSpeed: 0, depth: 60, seaward: 1600 });
  const sea = createSea(level, 3, level.wind, { hs: 20 });

  it("stands twenty metres of significant height with a period that makes a wall", () => {
    expect(seaSummary(sea, 400, 800).Hs).toBeCloseTo(20, 3);
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
