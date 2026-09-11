// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRANSFORM the ripple tile is built through. A wrong FFT does not
// throw and does not look obviously wrong — it hands back a field with the
// wrong spectrum, which comes out as a sea that is subtly too smooth or too
// busy and nothing to point at. So it is held against the two things that
// pin it exactly: a round trip returns what went in, and one known
// component lands on one known cell.
import { describe, expect, it } from "vitest";

import { fft2 } from "../pwa/src/lib/fft.ts";

describe("the two-dimensional transform", () => {
  it("returns what went in, scaled by the cell count", () => {
    const n = 32;
    const re = new Float64Array(n * n);
    const im = new Float64Array(n * n);
    // An arbitrary field with no symmetry to flatter the transform.
    for (let i = 0; i < n * n; i++) {
      re[i] = Math.sin(i * 1.7) + 0.3 * Math.cos(i * 0.31);
      im[i] = Math.cos(i * 2.3);
    }
    const wasRe = Float64Array.from(re);
    const wasIm = Float64Array.from(im);
    fft2(re, im, n, -1);
    fft2(re, im, n, 1);
    // Neither direction is scaled, so a round trip multiplies by n².
    for (let i = 0; i < n * n; i++) {
      expect(re[i] / (n * n)).toBeCloseTo(wasRe[i], 9);
      expect(im[i] / (n * n)).toBeCloseTo(wasIm[i], 9);
    }
  });

  it("puts one component on one cell", () => {
    const n = 16;
    const re = new Float64Array(n * n);
    const im = new Float64Array(n * n);
    // Three cycles along x, two along z.
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        re[z * n + x] = Math.cos((2 * Math.PI * (3 * x + 2 * z)) / n);
      }
    }
    fft2(re, im, n, -1);
    const power = (x: number, z: number): number => {
      const i = ((z + n) % n) * n + ((x + n) % n);
      return re[i] * re[i] + im[i] * im[i];
    };
    // A real cosine is half at +k and half at −k, and nothing anywhere else.
    const half = ((n * n) / 2) ** 2;
    expect(power(3, 2)).toBeCloseTo(half, 3);
    expect(power(-3, -2)).toBeCloseTo(half, 3);
    let elsewhere = 0;
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        if ((x === 3 && z === 2) || (x === n - 3 && z === n - 2)) continue;
        elsewhere += power(x, z);
      }
    }
    expect(elsewhere / half).toBeLessThan(1e-12);
  });
});
