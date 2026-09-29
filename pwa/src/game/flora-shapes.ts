// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLANTS, BUILT. One parametric low-poly builder a form, nine of them
// across the two rosters of `flora-defs.ts`, each emitting ONE
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
import { TREE_SHAPE } from "./tree-variants.ts";
import { UNDER_SHAPE } from "./undergrowth-variants.ts";

/** HOW MANY FACETS A ROW IS WORTH. A plant that is never more than a metre
 * and a half tall is a handful of pixels from the saddle and a smudge at
 * the far end of a bay, so it gets a bipyramid where a tree gets a lump —
 * and there are thousands more of the small ones than of the trees, which
 * is exactly the wrong way round to spend a triangle. Derived from the
 * row's own height rather than stated per row: a species that is retuned
 * taller earns its facets on the same edit. */
function facets(look: Look): { sides: number; stacks: number; masses: number } {
  const B = UNDER_SHAPE.bush;
  return B.facets[look.height.max < B.small ? 0 : 1];
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

/** A FROND: a palm's leaf, going OUT from the crown and arching DOWN under
 * its own weight — the one curve `blade` cannot make, since a blade rises.
 * Four panels along it, widest a third of the way out and closing to a
 * tip; painted dark at the stalk and lit toward the end, where the sun is. */
function frond(
  b: Builder,
  x0: number,
  y0: number,
  z0: number,
  yaw: number,
  reach: number,
  droop: number,
  half: number,
  lower: number,
  upper: number,
): void {
  const dx = Math.sin(yaw);
  const dz = Math.cos(yaw);
  const ax = Math.cos(yaw);
  const az = -Math.sin(yaw);
  const knot = (t: number): { l: P; r: P } => {
    const out = reach * t;
    // Up a little off the crown, then down as the square of the reach.
    const y = y0 + reach * 0.3 * t * (1 - t) * 2 - droop * t * t;
    const w = half * (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, t * 1.15)));
    const cx = x0 + dx * out;
    const cz = z0 + dz * out;
    return {
      l: [cx - ax * w, y, cz - az * w],
      r: [cx + ax * w, y, cz + az * w],
    };
  };
  const ts = [0, 0.3, 0.6, 0.85, 1];
  for (let i = 0; i + 1 < ts.length; i++) {
    const a = knot(ts[i]);
    const c = knot(ts[i + 1]);
    const paint = mix(lower, upper, ts[i + 1]);
    if (i + 2 === ts.length) b.tri(a.l, a.r, c.l, paint);
    else b.quad(a.l, a.r, c.r, c.l, paint);
  }
}

/** A clump of blades on a small disc — one instance of grass, sedge or
 * reed is a TUFT rather than a stem, which is what lets a few thousand
 * instances read as a meadow. */
function clump(b: Builder, look: Look, straight: boolean, seed: number): void {
  // The numbers are `UNDER_SHAPE`'s, which the modelled undergrowth is
  // built from too. A reed bed stands level along its top and a tussock
  // does not, so the stems of the one vary far less in length than the
  // blades of the other — and the reed's stem stops short so that its
  // plume, three tenths of the stem again, tops out at the unit height the
  // placer scales by.
  const T = UNDER_SHAPE.tuft;
  const R = UNDER_SHAPE.reed;
  const S = straight ? R : T;
  const r = look.spread * 0.5;
  for (let i = 0; i < look.stems; i++) {
    const a = wob(seed, i) * Math.PI * 2;
    const d = Math.sqrt(wob(seed + 1, i)) * r * S.disc;
    const h = S.height[0] + wob(seed + 2, i) * S.height[1];
    const yaw = a + (wob(seed + 3, i) - 0.5) * S.yaw;
    const bend = S.bend[0] + wob(seed + 4, i) * S.bend[1];
    const x0 = Math.sin(a) * d;
    const z0 = Math.cos(a) * d;
    blade(
      b,
      x0,
      z0,
      0,
      yaw,
      h,
      look.spread * S.half,
      bend,
      look.leafDark,
      straight ? look.leafLit : mix(look.leafDark, look.leafLit, T.lit),
      S.tipFrom,
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
      h * R.plume.tall,
      look.spread * R.plume.half,
      bend * R.plume.bend,
      look.stemHigh ?? look.leafDark,
      look.stemHigh ?? look.leafDark,
      T.tipFrom,
    );
  }
}

/** The geometry for one species, a metre tall with its foot at the origin. */
export function buildFlora(look: Look, seed: number): THREE.BufferGeometry {
  const b = new Builder();
  const s = look.spread;
  switch (look.form) {
    case "pine": {
      const P = TREE_SHAPE.pine;
      // The bare trunk, and the copper reach above the shade.
      stem(b, 0, 0, 0, 0, 0, look.bare, P.stem[0], P.stem[1], look.stem, look.stem);
      stem(
        b,
        0,
        0,
        look.bare,
        0,
        0,
        P.leader,
        P.upper[0],
        P.upper[1],
        look.stem,
        look.stemHigh ?? look.stem,
      );
      // A broad, flat, high crown in three lopsided plates: a mature Scots
      // pine is an umbrella, not a cone, and that silhouette against the
      // sky is what it is recognised by.
      for (let i = 0; i < P.plates; i++) {
        const t = i / (P.plates - 1);
        const y = look.bare + (P.ceiling - look.bare) * (P.low + t * P.span);
        const r = s * P.radius * (1 - t * P.narrow);
        blob(
          b,
          (wob(seed, i) - 0.5) * s * P.drift,
          y,
          (wob(seed + 5, i) - 0.5) * s * P.drift,
          r,
          r * P.squash,
          r * P.depth,
          look.leafLit,
          look.leafDark,
          seed + i * 13,
        );
      }
      break;
    }
    case "spire": {
      const P = TREE_SHAPE.spire;
      stem(b, 0, 0, 0, 0, 0, P.trunk, P.stem[0], P.stem[1], look.stem, look.stem);
      // Four tiers, each starting inside the one below it so the boughs
      // overlap the way a spruce's do, running to a leader at the top.
      for (let i = 0; i < P.tiers; i++) {
        const t = i / (P.tiers - 1);
        cone(
          b,
          0,
          look.bare + (P.ceiling - look.bare) * t,
          0,
          s * P.radius * (1 - t * P.narrow),
          (P.rise - t * P.shorten) * (1 - t * P.squat),
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
      const P = TREE_SHAPE.broadleaf;
      const mid = (look.bare + 1) / 2;
      const rise = (1 - look.bare) / 2;
      const thin = Math.pow(look.stems, P.thin);
      for (let i = 0; i < look.stems; i++) {
        // Multi-stemmed species lean their trunks apart out of one stool.
        const a = (i / look.stems) * Math.PI * 2 + seed;
        const out = look.stems > 1 ? s * P.splay : 0;
        stem(
          b,
          0,
          0,
          0,
          Math.sin(a) * out,
          Math.cos(a) * out,
          mid,
          P.stem[0] / thin,
          P.stem[1] / thin,
          look.stem,
          look.stemHigh ?? look.stem,
        );
      }
      // A CLUSTER, NOT A BALL. One lump on a stick is a lollipop, and at
      // six facets a round the eye reads any single lump as a sphere
      // whatever it is scaled to; four overlapping masses at different
      // heights read as a crown with an outline. They span everything
      // above `bare`, which is what the field promises.
      const lumps = P.lumps;
      for (let i = 0; i < lumps; i++) {
        const first = i === 0;
        const a = (i / lumps) * Math.PI * 2 + seed * 1.7;
        const d = first ? 0 : s * (P.reach + wob(seed + 11, i) * P.reachVary);
        const y = mid + (first ? -rise * 0.12 : (wob(seed + 13, i) - 0.35) * rise * 1.1);
        const r = s * (first ? P.core : P.lump + wob(seed + 17, i) * P.lumpVary);
        blob(
          b,
          Math.sin(a) * d,
          y,
          Math.cos(a) * d,
          r / thin,
          (first ? rise * P.coreRise : rise * P.lumpRise) / Math.pow(look.stems, P.stack),
          (r * 0.94) / thin,
          look.leafLit,
          look.leafDark,
          seed + i * 23,
        );
      }
      break;
    }
    case "bush": {
      const B = UNDER_SHAPE.bush;
      if (look.bare > B.stem.gate) {
        stem(
          b,
          0,
          0,
          0,
          0,
          0,
          look.bare * B.stem.tall,
          B.stem.r[0],
          B.stem.r[1],
          look.stem,
          look.stem,
        );
      }
      // Three masses on a small disc: with a narrow spread they stack into
      // a juniper's column, with a wide one they spread into a willow's
      // dome or a heather mat.
      const { sides, stacks, masses } = facets(look);
      for (let i = 0; i < masses; i++) {
        const t = i / (masses - 1);
        const a = wob(seed, i) * Math.PI * 2;
        const d = wob(seed + 2, i) * s * B.drift;
        const y = B.low + t * B.span + (wob(seed + 4, i) - 0.5) * B.jog;
        const r = s * B.radius * (B.vary[0] + wob(seed + 6, i) * B.vary[1]) * (1 - t * B.narrow);
        blob(
          b,
          Math.sin(a) * d,
          y,
          Math.cos(a) * d,
          r,
          Math.min(r * B.tall, B.cap),
          r * B.depth,
          look.leafLit,
          look.leafDark,
          seed + i * 29,
          sides,
          stacks,
        );
      }
      break;
    }
    case "palm": {
      // THE TRUNK leans a little off plumb — every palm on a beach does —
      // and thins toward the crown; two stems so the lean is a curve.
      const P = TREE_SHAPE.palm;
      const leanX = (wob(seed, 1) - 0.5) * s * P.lean;
      const leanZ = (wob(seed, 2) - 0.5) * s * P.lean;
      const knee = look.bare * P.knee;
      stem(
        b,
        0,
        0,
        0,
        leanX * 0.45,
        leanZ * 0.45,
        knee,
        P.stem[0],
        P.stem[1],
        look.stem,
        look.stem,
      );
      stem(
        b,
        leanX * 0.45,
        leanZ * 0.45,
        knee,
        leanX,
        leanZ,
        look.bare,
        P.stem[1],
        P.stem[2],
        look.stem,
        look.stemHigh ?? look.stem,
      );
      // The bud the fronds come out of.
      blob(
        b,
        leanX,
        look.bare + 0.03,
        leanZ,
        P.bud,
        P.bud,
        P.bud,
        look.leafDark,
        look.leafDark,
        seed,
        5,
        2,
      );
      // THE CROWN: `stems` fronds radiating from the bud, each reaching
      // `spread` out and drooping under its own weight — more of them and
      // shorter is a fan palm's round head, fewer and longer a coconut's.
      for (let i = 0; i < look.stems; i++) {
        const a = (i / look.stems) * Math.PI * 2 + (wob(seed + 3, i) - 0.5) * 0.5;
        const reach = s * P.reach * (P.reachVary[0] + wob(seed + 5, i) * P.reachVary[1]);
        const droop = reach * (P.droop[0] + wob(seed + 4, i) * P.droop[1]);
        frond(
          b,
          leanX,
          look.bare + 0.02,
          leanZ,
          a,
          reach,
          droop,
          s * P.width,
          look.leafDark,
          look.leafLit,
        );
      }
      break;
    }
    case "mangrove": {
      // THE PROP ROOTS: `stems` arches from a ring on the ground, up and in
      // to the trunk's foot at `bare`, each in two straight legs so the arch
      // reads. The tangle of them is the whole waterline silhouette.
      const P = TREE_SHAPE.mangrove;
      const ring = s * P.ring;
      for (let i = 0; i < look.stems; i++) {
        const a = (i / look.stems) * Math.PI * 2 + (wob(seed, i) - 0.5) * 0.5;
        const d = ring * (P.spread[0] + wob(seed + 1, i) * P.spread[1]);
        const x0 = Math.sin(a) * d;
        const z0 = Math.cos(a) * d;
        const mx = x0 * P.inset[0];
        const mz = z0 * P.inset[0];
        const my = look.bare * (P.knee[0] + wob(seed + 2, i) * P.knee[1]);
        stem(b, x0, z0, 0, mx, mz, my, P.root[0], P.root[1], look.stem, look.stem, 4);
        stem(
          b,
          mx,
          mz,
          my,
          x0 * P.inset[1],
          z0 * P.inset[1],
          look.bare,
          P.root[1],
          P.root[2],
          look.stem,
          look.stem,
          4,
        );
      }
      // A short trunk into the canopy's underside.
      stem(
        b,
        0,
        0,
        look.bare * P.trunk.from,
        0,
        0,
        look.bare + P.trunk.over,
        P.trunk.r[0],
        P.trunk.r[1],
        look.stem,
        look.stem,
      );
      // THE DOME, spanning everything above `bare`: one mass and two
      // shoulders, so a stand of them reads as a hedge with a lumpy top.
      const mid = (look.bare + 1) / 2;
      const rise = (1 - look.bare) / 2;
      blob(b, 0, mid, 0, s * P.dome, rise, s * P.dome, look.leafLit, look.leafDark, seed);
      for (let i = 0; i < P.shoulders; i++) {
        const a = wob(seed + 13, i) * Math.PI * 2;
        const d = s * P.shoulderAt;
        blob(
          b,
          Math.sin(a) * d,
          mid - rise * 0.15,
          Math.cos(a) * d,
          s * P.shoulder,
          rise * P.shoulderRise,
          s * P.shoulder,
          look.leafLit,
          look.leafDark,
          seed + 17 + i * 5,
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
    case "stone": {
      // A cobble: one squashed lump, buried to its waist by the placer.
      const S = UNDER_SHAPE.stone;
      blob(
        b,
        0,
        S.at,
        0,
        s * S.rx,
        S.ry,
        s * S.rz,
        look.leafLit,
        look.leafDark,
        seed,
        S.sides,
        S.stacks,
      );
      break;
    }
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
