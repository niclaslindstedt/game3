// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DISCRETE FOURIER TRANSFORM, in two dimensions — the generic pool's,
// with nothing of this game in it.
//
// What it is here for: building a repeating texture from a SPECTRUM rather
// than from a sum of waves somebody chose by hand. A handful of sines is a
// handful of sines, and two of them crossing is an interference lattice that
// reads as woven cloth; a field transformed out of its whole spectrum with a
// random phase on every component is disorder with a direction in it, which
// is what a wind-blown surface actually looks like. The transform also makes
// the result WRAP by construction — every component has a whole number of
// cycles across the grid — which is what a tile has to do.
//
// Cooley and Tukey's radix-2 decimation in time, iterative, in place. The
// grid must be a power of two a side; at 256² a pass is a few milliseconds,
// which is a texture built once at start-up.

/** One in-place transform of length `n` (a power of two) over `re`/`im`.
 * `sign` is −1 for the forward transform and +1 for the inverse, which is
 * left UNSCALED — the caller normalises, and every caller here scales its
 * result to a measured RMS anyway. */
function fft1(re: Float64Array, im: Float64Array, n: number, sign: number): void {
  // Bit-reversal permutation, counted rather than computed per index.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i];
      re[i] = re[j];
      re[j] = t;
      t = im[i];
      im[i] = im[j];
      im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const angle = (sign * 2 * Math.PI) / len;
    const wr = Math.cos(angle);
    const wi = Math.sin(angle);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      // The twiddle is stepped by repeated multiplication rather than a
      // cosine per butterfly. Its error grows as sqrt(len), which at 256 is
      // a few parts in 10^14 — far under a texel of an 8-bit normal map.
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k;
        const b = a + half;
        const ur = re[a];
        const ui = im[a];
        const vr = re[b] * cr - im[b] * ci;
        const vi = re[b] * ci + im[b] * cr;
        re[a] = ur + vr;
        im[a] = ui + vi;
        re[b] = ur - vr;
        im[b] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/**
 * The two-dimensional transform of an `n`×`n` grid held row-major in
 * `re`/`im`, in place: every row, then every column. `sign` is −1 forward
 * and +1 inverse; neither is scaled.
 *
 * `n` must be a power of two.
 */
export function fft2(re: Float64Array, im: Float64Array, n: number, sign: number): void {
  const row = new Float64Array(n);
  const rowIm = new Float64Array(n);
  for (let y = 0; y < n; y++) {
    const o = y * n;
    for (let x = 0; x < n; x++) {
      row[x] = re[o + x];
      rowIm[x] = im[o + x];
    }
    fft1(row, rowIm, n, sign);
    for (let x = 0; x < n; x++) {
      re[o + x] = row[x];
      im[o + x] = rowIm[x];
    }
  }
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      row[y] = re[y * n + x];
      rowIm[y] = im[y * n + x];
    }
    fft1(row, rowIm, n, sign);
    for (let y = 0; y < n; y++) {
      re[y * n + x] = row[y];
      im[y * n + x] = rowIm[y];
    }
  }
}
