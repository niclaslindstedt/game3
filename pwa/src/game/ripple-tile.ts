// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WIND'S CAPILLARY SKIN, as a tile — the short chop that is too fine for
// any grid to carry, built once at start-up as a repeating field of SLOPES
// and read by `water-shader.ts` at two scales.
//
// Three-free on purpose, so `tests/ripple_tile_test.ts` can read the whole
// field: everything that decides what a ripple LOOKS like is here, and the
// shader only decides how hard to read it.
//
// WHY A SPECTRUM RATHER THAN A LIST OF WAVES. A handful of directional sines
// is a handful of directional sines: the two with the most amplitude cross
// into a regular interference lattice, and a lattice on water reads as woven
// cloth rather than as a sea. Noise laid over the top does not break it,
// because the lattice is the part with the energy in it.
//
// So the field is drawn the way a sea surface actually is (Tessendorf 2001,
// "Simulating Ocean Water" §4): fill the WAVENUMBER plane with the sea's own
// spectrum, put a Gaussian draw and an INDEPENDENT RANDOM PHASE on every
// component, and transform the whole plane at once. Nothing dominates,
// nothing lines up, and the result is disorder with a direction in it, which
// is what a wind-blown surface is. It also wraps for free — every component
// has a whole number of cycles across the tile — where a value noise whose
// hash does not repeat leaves a step at the tile's edge, and a step in a
// height field is a ridge of slope down the seam that draws a hard grid on
// the sea at the tile's own spacing.
//
// THE SPECTRUM is Phillips' saturation range (1958): the two-dimensional
// wavenumber spectrum of a wind sea in equilibrium goes as k⁻⁴, so the
// omnidirectional spectrum goes as k⁻³ and the SLOPE spectrum as k⁻¹ — equal
// slope variance in every octave. That is the reason a sea looks like a sea
// at every scale you can resolve it at, and the reason this tile must not be
// allowed a favourite wavelength.
//
// HOW MUCH slope the tile carries is not decided here: the field is
// normalised to `RIPPLE_RMS_SLOPE` and the shader scales it to the share of
// Cox and Munk's slope variance the tile is answerable for at this wind.

import { createRng } from "@engine";

import { fft2 } from "../lib/fft.ts";

/** The tile: texels a side, and the edge of the FINE layer in metres. The
 * coarse layer is the same tile at `RIPPLE_COARSE` times that edge, turned
 * off the wind and scrolled slower, so the two never line up. */
export const RIPPLE_SIZE = 256;
export const RIPPLE_METRES = 2.4;
export const RIPPLE_COARSE = 3.7;

/** The RMS slope the field is normalised to — the SHAPE the tile is built
 * at. Stated here rather than in the shader so the tile is the one place a
 * ripple has a shape; the strength it is read at comes from the wind. */
export const RIPPLE_RMS_SLOPE = 0.22;

/** The band of ripples the tile carries, m — wavelengths, so the band is
 * physical and cannot drift when the tile's footprint moves. The long end is
 * where the water grid's own cells take over (the near grid's cell is about
 * a metre); the short end is a few texels of the tile, past which a
 * component is under a texel and comes back as aliasing rather than as
 * chop. Capillary and short gravity waves, which is exactly the band no
 * mesh can afford. */
const LONGEST = 0.8;
const SHORTEST = 0.035;

/** How tightly the ripples lie across the wind: the exponent of a cos^2s
 * spreading about the downwind axis. Two is a wind skin whose crests have a
 * clear direction and still a spread of them — nought is an isotropic
 * scatter with no wind in it, and a much higher number is a corrugation. */
const SPREAD = 2;

/** The seed the phases are drawn from. Fixed, so every build of the app
 * makes the same sea and two screenshots of one scene can be compared. */
const SEED = 0x5eaf00d;

export type RippleField = {
  /** Slope of the surface along x and along z, one per texel, row-major.
   * Normalised so that √(mean(sx² + sz²)) is `RIPPLE_RMS_SLOPE`. */
  sx: Float32Array;
  sz: Float32Array;
};

let field: RippleField | null = null;

/**
 * THE TILE'S SLOPES — built once and kept.
 *
 * The height field comes out of the spectrum above; the slopes come off it
 * by central differences ON THE TORUS, so the pair that straddles the tile's
 * edge is as honest as any pair inside it.
 */
export function rippleField(): RippleField {
  if (field) return field;
  const n = RIPPLE_SIZE;
  const rng = createRng(SEED);
  const re = new Float64Array(n * n);
  const im = new Float64Array(n * n);

  // The band, in whole cycles across the tile.
  const lowCycles = RIPPLE_METRES / LONGEST;
  const highCycles = RIPPLE_METRES / SHORTEST;

  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      // Signed wavenumbers: the second half of each axis is the negative
      // frequencies, which is how a transform holds them.
      const kx = i <= n / 2 ? i : i - n;
      const kz = j <= n / 2 ? j : j - n;
      const k = Math.hypot(kx, kz);
      if (k < lowCycles || k > highCycles) continue;
      // Phillips: amplitude ∝ k⁻², with a cos^2s spreading about the
      // downwind axis (the tile's z, which the shader lays downwind) and
      // both ends of the band rolled off — a band with hard edges rings,
      // and a component sitting on the tile's longest or shortest
      // wavelength is the favourite this whole construction exists to
      // avoid.
      const spread = Math.pow(Math.max(0, kz / k), 2 * SPREAD);
      const low = 1 - Math.exp(-4 * Math.pow(k / lowCycles - 1, 2));
      const high = Math.exp(-3 * Math.pow(k / highCycles, 4));
      const amp = Math.sqrt((spread * low * high) / (k * k * k * k));
      // Box–Muller: a Gaussian draw on the amplitude and a uniform phase,
      // which together are a Gaussian sea surface. The coefficients at k
      // and −k are drawn independently and the REAL PART of the transform
      // is taken below; that is the same real Gaussian field a
      // conjugate-symmetric fill would give, for half the bookkeeping.
      const u1 = Math.max(1e-9, rng.next());
      const gauss = amp * Math.sqrt(-2 * Math.log(u1));
      const phase = 2 * Math.PI * rng.next();
      re[j * n + i] = gauss * Math.cos(phase);
      im[j * n + i] = gauss * Math.sin(phase);
    }
  }
  fft2(re, im, n, 1);

  const sx = new Float32Array(n * n);
  const sz = new Float32Array(n * n);
  let sum = 0;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      sx[i] = (re[y * n + ((x + 1) % n)] - re[y * n + ((x + n - 1) % n)]) / 2;
      sz[i] = (re[((y + 1) % n) * n + x] - re[((y + n - 1) % n) * n + x]) / 2;
      sum += sx[i] * sx[i] + sz[i] * sz[i];
    }
  }
  const gain = RIPPLE_RMS_SLOPE / Math.sqrt(sum / (n * n));
  for (let i = 0; i < n * n; i++) {
    sx[i] *= gain;
    sz[i] *= gain;
  }
  field = { sx, sz };
  return field;
}

/**
 * THE TILE AS A NORMAL MAP: the slopes packed the way the shader reads them
 * — the normal's x in red and its z in green, its y in blue, each from a
 * signed value into a byte. RGBA, `RIPPLE_SIZE` a side.
 *
 * The sign is flipped on the way in: a height field's normal is
 * (−∂h/∂x, 1, −∂h/∂z).
 */
export function rippleNormals(): Uint8Array {
  const { sx, sz } = rippleField();
  const data = new Uint8Array(sx.length * 4);
  for (let i = 0; i < sx.length; i++) {
    const nx = -sx[i];
    const nz = -sz[i];
    const inv = 1 / Math.hypot(nx, 1, nz);
    data[i * 4] = Math.round((nx * inv * 0.5 + 0.5) * 255);
    data[i * 4 + 1] = Math.round((nz * inv * 0.5 + 0.5) * 255);
    data[i * 4 + 2] = Math.round(inv * 255);
    data[i * 4 + 3] = 255;
  }
  return data;
}
