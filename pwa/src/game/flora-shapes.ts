// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLANTS, BUILT. One parametric low-poly builder a form, seven of them
// between the thirteen rows of `flora-defs.ts`, each emitting ONE
// flat-shaded vertex-coloured geometry through the shared `lowpoly`
// Builder — so a species is one instanced draw call, trunk and canopy and
// all, and gets the per-facet brightness jitter that keeps a big flat green
// from reading as plastic.
//
// UNIT CONVENTION: everything is built a metre tall with its foot on y = 0
// and its plan spread taken from the row's own `spread`, so the placer
// scales uniformly by the height it drew and the proportions survive. The
// shapes are seeded off the SPECIES rather than the instance — one birch
// is built and planted a thousand times — and the variety that matters at
// chase range comes from the placer instead: the height, the yaw and a
// tint per instance.
//
// Everything is drawn DOUBLE-SIDED. A blade of grass is a sheet with no
// inside, and a canopy this coarse shows its back faces through its own
// gaps; culling them buys a few percent of fill and costs the shape.

import * as THREE from "three";

import { Builder, type P } from "../lib/lowpoly.ts";
import type { Look } from "./flora-defs.ts";

/** HOW MANY FACETS A ROW IS WORTH. A plant that is never more than a metre
 * and a half tall is a handful of pixels from the saddle and a smudge at
 * the far end of a bay, so it gets a bipyramid where a tree gets a lump —
 * and there are thousands more of the small ones than of the trees, which
 * is exactly the wrong way round to spend a triangle. Derived from the
 * row's own height rather than stated per row: a species that is retuned
 * taller earns its facets on the same edit. */
function facets(look: Look): { sides: number; stacks: number; masses: number } {
  return look.height.max < 1.5
    ? { sides: 5, stacks: 2, masses: 3 }
    : { sides: 6, stacks: 3, masses: 4 };
}

/** A cheap repeatable 0..1 off two integers — the shapes' own wobble, so a
 * canopy is lopsided the same way every time it is built. */
function wob(a: number, b: number): number {
  const h = Math.imul(a * 374761393 + b * 668265263, 1274126177);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/** Two packed hex colours mixed. Done on the bytes rather than through
 * `THREE.Color` because the roster is hex and a shape emits hundreds of
 * these while it builds; the gamma this ignores is the gamma the palette
 * was picked under. */
function mix(a: number, b: number, t: number): number {
  const chan = (shift: number): number =>
    Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * t) & 255;
  return (chan(16) << 16) | (chan(8) << 8) | chan(0);
}

/** A low-poly ellipsoid: `sides` round, `stacks` tall, each ring nudged in
 * and out so a canopy is a lump rather than a ball. Painted from `dark` at
 * its underside to `lit` at its crown, which is the whole of the lighting a
 * flat-shaded canopy gets from a sky it cannot see. */
function blob(
  b: Builder,
  cx: number,
  cy: number,
  cz: number,
  rx: number,
  ry: number,
  rz: number,
  lit: number,
  dark: number,
  seed: number,
  sides = 6,
  stacks = 3,
): void {
  const rings: P[][] = [];
  for (let s = 1; s < stacks; s++) {
    const phi = (s / stacks) * Math.PI;
    const y = -Math.cos(phi);
    const rad = Math.sin(phi);
    const ring: P[] = [];
    for (let k = 0; k < sides; k++) {
      const t = (k / sides) * Math.PI * 2;
      const w = 0.78 + wob(seed + s * 31, k) * 0.44;
      ring.push([cx + Math.sin(t) * rad * rx * w, cy + y * ry, cz + Math.cos(t) * rad * rz * w]);
    }
    rings.push(ring);
  }
  const shade = (y: number): number => mix(dark, lit, Math.min(1, Math.max(0, y * 0.5 + 0.62)));
  for (let i = 0; i + 1 < rings.length; i++) {
    const lo = rings[i];
    const hi = rings[i + 1];
    const paint = shade((i + 1) / (stacks - 1) - 0.5);
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      b.quad(lo[k], lo[k1], hi[k1], hi[k], paint);
    }
  }
  const foot: P = [cx, cy - ry, cz];
  const crown: P = [cx, cy + ry, cz];
  const first = rings[0];
  const last = rings[rings.length - 1];
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    b.tri(foot, first[k1], first[k], shade(-0.5));
    b.tri(crown, last[k], last[k1], shade(0.5));
  }
}

/** A cone standing on its base — a spruce's bough tier. */
function cone(
  b: Builder,
  cx: number,
  y0: number,
  cz: number,
  r: number,
  h: number,
  lit: number,
  dark: number,
  seed: number,
  sides = 6,
): void {
  const ring: P[] = [];
  for (let k = 0; k < sides; k++) {
    const t = (k / sides) * Math.PI * 2;
    const w = 0.82 + wob(seed, k) * 0.36;
    ring.push([cx + Math.sin(t) * r * w, y0, cz + Math.cos(t) * r * w]);
  }
  const apex: P = [cx, y0 + h, cz];
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    b.tri(ring[k], ring[k1], apex, mix(dark, lit, 0.35 + wob(seed + 7, k) * 0.5));
    b.tri(ring[k1], ring[k], [cx, y0, cz], dark);
  }
}

/** A STEM: a tapered tube from `(x0, y0, z0)` leaning to a top, drawn with
 * as few sides as still reads round. Used for every trunk and bough. */
function stem(
  b: Builder,
  x0: number,
  z0: number,
  y0: number,
  x1: number,
  z1: number,
  y1: number,
  r0: number,
  r1: number,
  lower: number,
  upper: number,
  sides = 5,
): void {
  const lo: P[] = [];
  const hi: P[] = [];
  for (let k = 0; k < sides; k++) {
    const t = (k / sides) * Math.PI * 2;
    lo.push([x0 + Math.sin(t) * r0, y0, z0 + Math.cos(t) * r0]);
    hi.push([x1 + Math.sin(t) * r1, y1, z1 + Math.cos(t) * r1]);
  }
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    b.quad(lo[k], lo[k1], hi[k1], hi[k], mix(lower, upper, k / sides));
  }
}

/** A BLADE: a sheet rising from the ground, bending away from vertical as
 * it goes and narrowing to nothing at its tip. Three panels, so the bend
 * reads as a curve rather than as a fold — this is the grass, the sedge and
 * the reed's stem, and the only difference between them is how far it bends
 * and where the colour changes. */
function blade(
  b: Builder,
  x0: number,
  z0: number,
  y0: number,
  yaw: number,
  h: number,
  half: number,
  bend: number,
  lower: number,
  upper: number,
  tipFrom: number,
): void {
  const dx = Math.sin(yaw);
  const dz = Math.cos(yaw);
  // Across the blade, so the sheet faces the way it leans.
  const ax = Math.cos(yaw);
  const az = -Math.sin(yaw);
  const knot = (t: number): { l: P; r: P } => {
    const y = y0 + h * t;
    const out = bend * h * t * t;
    const w = half * Math.pow(1 - t, 0.55);
    const cxp = x0 + dx * out;
    const czp = z0 + dz * out;
    return {
      l: [cxp - ax * w, y, czp - az * w],
      r: [cxp + ax * w, y, czp + az * w],
    };
  };
  const ts = [0, 0.42, 0.76, 1];
  for (let i = 0; i + 1 < ts.length; i++) {
    const a = knot(ts[i]);
    const c = knot(ts[i + 1]);
    const paint = ts[i + 1] > tipFrom ? upper : mix(lower, upper, ts[i]);
    if (i + 2 === ts.length) {
      // The tip has closed to a point, so the last panel is one triangle.
      b.tri(a.l, a.r, c.l, paint);
    } else {
      b.quad(a.l, a.r, c.r, c.l, paint);
    }
  }
}

/** A clump of blades on a small disc — one instance of grass, sedge or
 * reed is a TUFT rather than a stem, which is what lets a few thousand
 * instances read as a meadow. */
function clump(b: Builder, look: Look, straight: boolean, seed: number): void {
  const r = look.spread * 0.5;
  for (let i = 0; i < look.stems; i++) {
    const a = wob(seed, i) * Math.PI * 2;
    const d = Math.sqrt(wob(seed + 1, i)) * r * 0.92;
    // A reed bed stands level along its top and a tussock does not, so the
    // stems of the one vary far less in length than the blades of the
    // other.
    // …and the reed's stem stops at 0.77 so that its plume, three tenths of
    // the stem again, tops out at the unit height the placer scales by.
    const h = straight ? 0.54 + wob(seed + 2, i) * 0.23 : 0.5 + wob(seed + 2, i) * 0.5;
    const yaw = a + (wob(seed + 3, i) - 0.5) * 1.2;
    const bend = straight ? 0.04 + wob(seed + 4, i) * 0.06 : 0.16 + wob(seed + 4, i) * 0.42;
    const x0 = Math.sin(a) * d;
    const z0 = Math.cos(a) * d;
    blade(
      b,
      x0,
      z0,
      0,
      yaw,
      h,
      look.spread * (straight ? 0.042 : 0.062),
      bend,
      look.leafDark,
      straight ? look.leafLit : mix(look.leafDark, look.leafLit, 0.85),
      straight ? 0.7 : 0.99,
    );
    if (!straight) continue;
    // THE PLUME, stood on that stem's own tip: a reed bed's whole upper
    // surface, and the one part of it that is not straw.
    blade(
      b,
      x0 + Math.sin(yaw) * bend * h,
      z0 + Math.cos(yaw) * bend * h,
      h,
      yaw,
      h * 0.3,
      look.spread * 0.038,
      bend * 1.6,
      look.stemHigh ?? look.leafDark,
      look.stemHigh ?? look.leafDark,
      0.99,
    );
  }
}

/** The geometry for one species, a metre tall with its foot at the origin. */
export function buildFlora(look: Look, seed: number): THREE.BufferGeometry {
  const b = new Builder();
  const s = look.spread;
  switch (look.form) {
    case "pine": {
      // The bare trunk, and the copper reach above the shade.
      stem(b, 0, 0, 0, 0, 0, look.bare, 0.018, 0.012, look.stem, look.stem);
      stem(b, 0, 0, look.bare, 0, 0, 0.96, 0.012, 0.005, look.stem, look.stemHigh ?? look.stem);
      // A broad, flat, high crown in three lopsided plates: a mature Scots
      // pine is an umbrella, not a cone, and that silhouette against the
      // sky is what it is recognised by.
      for (let i = 0; i < 3; i++) {
        const t = i / 2;
        const y = look.bare + (0.98 - look.bare) * (0.3 + t * 0.56);
        const r = s * 0.56 * (1 - t * 0.34);
        blob(
          b,
          (wob(seed, i) - 0.5) * s * 0.28,
          y,
          (wob(seed + 5, i) - 0.5) * s * 0.28,
          r,
          r * 0.5,
          r * 0.92,
          look.leafLit,
          look.leafDark,
          seed + i * 13,
        );
      }
      break;
    }
    case "spire": {
      stem(b, 0, 0, 0, 0, 0, 0.28, 0.018, 0.011, look.stem, look.stem);
      // Four tiers, each starting inside the one below it so the boughs
      // overlap the way a spruce's do, running to a leader at the top.
      for (let i = 0; i < 4; i++) {
        const t = i / 3;
        cone(
          b,
          0,
          look.bare + (0.86 - look.bare) * t,
          0,
          s * 0.5 * (1 - t * 0.72),
          (0.34 - t * 0.06) * (1 - t * 0.3),
          look.leafLit,
          look.leafDark,
          seed + i * 17,
        );
      }
      break;
    }
    case "broadleaf": {
      // The canopy fills everything above `bare` — that is what the field
      // means — so its centre and its half-height come straight off it and
      // a tree is never a blob hovering over a stick.
      const mid = (look.bare + 1) / 2;
      const rise = (1 - look.bare) / 2;
      const thin = Math.pow(look.stems, 0.3);
      for (let i = 0; i < look.stems; i++) {
        // Multi-stemmed species lean their trunks apart out of one stool.
        const a = (i / look.stems) * Math.PI * 2 + seed;
        const out = look.stems > 1 ? s * 0.2 : 0;
        stem(
          b,
          0,
          0,
          0,
          Math.sin(a) * out,
          Math.cos(a) * out,
          mid,
          0.026 / thin,
          0.015 / thin,
          look.stem,
          look.stemHigh ?? look.stem,
        );
      }
      // A CLUSTER, NOT A BALL. One lump on a stick is a lollipop, and at
      // six facets a round the eye reads any single lump as a sphere
      // whatever it is scaled to; four overlapping masses at different
      // heights read as a crown with an outline. They span everything
      // above `bare`, which is what the field promises.
      const lumps = 4;
      for (let i = 0; i < lumps; i++) {
        const first = i === 0;
        const a = (i / lumps) * Math.PI * 2 + seed * 1.7;
        const d = first ? 0 : s * (0.2 + wob(seed + 11, i) * 0.14);
        const y = mid + (first ? -rise * 0.12 : (wob(seed + 13, i) - 0.35) * rise * 1.1);
        const r = s * (first ? 0.34 : 0.24 + wob(seed + 17, i) * 0.1);
        blob(
          b,
          Math.sin(a) * d,
          y,
          Math.cos(a) * d,
          r / thin,
          (first ? rise * 0.94 : rise * 0.6) / Math.pow(look.stems, 0.16),
          (r * 0.94) / thin,
          look.leafLit,
          look.leafDark,
          seed + i * 23,
        );
      }
      break;
    }
    case "bush": {
      if (look.bare > 0.02) {
        stem(b, 0, 0, 0, 0, 0, look.bare * 1.6, 0.022, 0.014, look.stem, look.stem);
      }
      // Three masses on a small disc: with a narrow spread they stack into
      // a juniper's column, with a wide one they spread into a willow's
      // dome or a heather mat.
      const { sides, stacks, masses } = facets(look);
      for (let i = 0; i < masses; i++) {
        const t = i / (masses - 1);
        const a = wob(seed, i) * Math.PI * 2;
        const d = wob(seed + 2, i) * s * 0.3;
        const y = 0.26 + t * 0.54 + (wob(seed + 4, i) - 0.5) * 0.12;
        const r = s * 0.34 * (0.78 + wob(seed + 6, i) * 0.44) * (1 - t * 0.3);
        blob(
          b,
          Math.sin(a) * d,
          y,
          Math.cos(a) * d,
          r,
          Math.min(r * 1.4, 0.3),
          r * 0.94,
          look.leafLit,
          look.leafDark,
          seed + i * 29,
          sides,
          stacks,
        );
      }
      break;
    }
    case "tuft":
      clump(b, look, false, seed);
      break;
    case "reed":
      clump(b, look, true, seed);
      break;
    case "stone":
      // A cobble: one squashed lump, buried to its waist by the placer.
      blob(b, 0, 0.5, 0, s * 0.5, 0.5, s * 0.44, look.leafLit, look.leafDark, seed, 5, 3);
      break;
  }
  return b.geometry();
}

/** The one material every species shares. Double-sided, because a blade
 * has no inside and a canopy this coarse shows its own back faces. */
export function floraMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
  });
}
