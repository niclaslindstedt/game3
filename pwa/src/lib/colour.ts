// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// COLOUR ARITHMETIC, in the space light actually adds up in.
//
// Every colour authored in this app is written as an sRGB hex, because that
// is what a designer picks and what a browser shows. sRGB is not linear: the
// value halfway between black and white in it is a mid grey, not half the
// light. So mixing two hexes by averaging their bytes gives an answer that
// is too bright in the middle and, worse, the WRONG HUE — a sunset orange
// half-mixed into a night blue comes back a washed lilac rather than the
// dim brown-purple the two lights actually make.
//
// So the mixes here go out to linear light, mix, and come back. That is
// exactly what three.js does inside `Color.lerp` with colour management on
// (which is its default), and matching it is the point: the sky ladder
// blends its rungs here, hands the renderer a hex, and the renderer turns
// that hex into a `THREE.Color` — one conversion, one convention, and no
// seam where a colour crosses from the model into the scene.
//
// Kept in `lib/` and free of three.js on purpose — a layering choice, not a
// technical one. One module decides what colour the sky is and another draws
// it; keeping the arithmetic on plain numbers is what stops the first from
// quietly becoming a scene, and it means the whole colour model can be
// exercised with nothing standing up but Node.

/** sRGB channel (0..1) → linear light. The exact piecewise transfer
 * function, not the 2.2 approximation: three uses this one, and a sky mixed
 * against a slightly different curve drifts from every material lit by it. */
function toLinear(c: number): number {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}

/** …and back. */
function toSrgb(c: number): number {
  return c < 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** The three linear channels of a packed sRGB hex. Written into a caller's
 * array so a per-vertex loop can mix without allocating. */
export function unpackLinear(hex: number, out: [number, number, number]): [number, number, number] {
  out[0] = toLinear(((hex >> 16) & 0xff) / 255);
  out[1] = toLinear(((hex >> 8) & 0xff) / 255);
  out[2] = toLinear((hex & 0xff) / 255);
  return out;
}

/** Linear channels back to a packed sRGB hex. */
export function packLinear(r: number, g: number, b: number): number {
  const to = (v: number): number => Math.round(clamp01(toSrgb(clamp01(v))) * 255);
  return (to(r) << 16) | (to(g) << 8) | to(b);
}

const A: [number, number, number] = [0, 0, 0];
const B: [number, number, number] = [0, 0, 0];

/** Mix two packed sRGB colours, `t` of the way from `a` to `b`, in linear
 * light. `t` outside 0..1 is clamped: an extrapolated colour is nearly
 * always a bug rather than a highlight, and the callers that DO want to
 * push past white multiply instead (`scaleHex`). */
export function mixHex(a: number, b: number, t: number): number {
  const k = clamp01(t);
  if (k <= 0) return a;
  if (k >= 1) return b;
  unpackLinear(a, A);
  unpackLinear(b, B);
  return packLinear(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
}

/** A colour with `k` times the light in it — a dimming, or a lift toward
 * white that clips where a real exposure clips. */
export function scaleHex(hex: number, k: number): number {
  unpackLinear(hex, A);
  return packLinear(A[0] * k, A[1] * k, A[2] * k);
}

/** HOW MUCH LIGHT a colour is, 0..1 — the Rec. 709 weights on the LINEAR
 * channels, which is what "how bright is this" means for anything being
 * measured against another light rather than mixed with it. */
export function luminance(hex: number): number {
  unpackLinear(hex, A);
  return 0.2126 * A[0] + 0.7152 * A[1] + 0.0722 * A[2];
}
