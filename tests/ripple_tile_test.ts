// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND'S CAPILLARY SKIN, held to the two faults that make a sea read as
// woven cloth rather than as water. How it LOOKS is judged by looking
// (`make screenshots`, zoomed); what is asserted here is that the tile
// WRAPS — a field that steps at its own edge puts a ridge of slope down the
// seam, and the tile repeats every couple of metres, so that ridge is a hard
// grid drawn across the whole sea — and that NOTHING RUNS AWAY WITH THE
// ENERGY, because two dominant components crossing are an interference
// lattice, which is the weave itself.
//
// Both numbers below discriminate: the construction these replace measured
// 1.90× on the seam and 8.2% on the loudest component.
import { describe, expect, it } from "vitest";

import {
  RIPPLE_RMS_SLOPE,
  RIPPLE_SIZE,
  rippleField,
  rippleNormals,
} from "../pwa/src/game/ripple-tile.ts";
import { fft2 } from "../pwa/src/lib/fft.ts";

const N = RIPPLE_SIZE;

/** The mean slope magnitude carried by each column of the tile, and by each
 * row — the measure a seam shows up in, because a step in the height field
 * lands on the one line of texels that straddles it. */
function lines(sx: Float32Array, sz: Float32Array): { column: Float64Array; row: Float64Array } {
  const column = new Float64Array(N);
  const row = new Float64Array(N);
  for (let z = 0; z < N; z++) {
    for (let x = 0; x < N; x++) {
      const m = Math.hypot(sx[z * N + x], sz[z * N + x]) / N;
      column[x] += m;
      row[z] += m;
    }
  }
  return { column, row };
}

const mean = (f: Float64Array): number => f.reduce((a, b) => a + b, 0) / f.length;

describe("the ripple tile", () => {
  const { sx, sz } = rippleField();

  it("is built once and handed back", () => {
    expect(rippleField().sx).toBe(sx);
  });

  it("is normalised to the slope it says it is built at", () => {
    let sum = 0;
    for (let i = 0; i < sx.length; i++) sum += sx[i] * sx[i] + sz[i] * sz[i];
    expect(Math.sqrt(sum / sx.length)).toBeCloseTo(RIPPLE_RMS_SLOPE, 6);
  });

  it("wraps: the seam carries no more slope than any other line of the tile", () => {
    const { column, row } = lines(sx, sz);
    expect(column[0] / mean(column), "the column the tile wraps on").toBeLessThan(1.2);
    expect(row[0] / mean(row), "the row the tile wraps on").toBeLessThan(1.2);
  });

  it("has no favourite wavelength: no one component carries the sea", () => {
    const re = new Float64Array(N * N);
    const im = new Float64Array(N * N);
    re.set(sz);
    fft2(re, im, N, -1);
    let total = 0;
    let peak = 0;
    for (let i = 0; i < re.length; i++) {
      const power = re[i] * re[i] + im[i] * im[i];
      total += power;
      if (power > peak) peak = power;
    }
    expect(peak / total).toBeLessThan(0.04);
  });

  it("lays its crests across the wind", () => {
    // The spreading is about the tile's z, which the shader lays downwind,
    // so the surface tilts mostly ALONG the wind — the same asymmetry Cox
    // and Munk measured and the glint's lobe is shaped by.
    const rms = (f: Float32Array): number => Math.sqrt(f.reduce((a, v) => a + v * v, 0) / f.length);
    expect(rms(sz)).toBeGreaterThan(rms(sx) * 1.3);
  });

  it("packs a unit normal into every texel", () => {
    const data = rippleNormals();
    expect(data.length).toBe(N * N * 4);
    // A stride that shares no factor with the row length, so the walk
    // crosses the tile rather than reading one column of it.
    for (let i = 0; i < data.length; i += 4 * 977) {
      const nx = (data[i] / 255) * 2 - 1;
      const nz = (data[i + 1] / 255) * 2 - 1;
      const ny = data[i + 2] / 255;
      expect(Math.hypot(nx, ny, nz)).toBeCloseTo(1, 2);
      expect(data[i + 3]).toBe(255);
    }
  });
});
