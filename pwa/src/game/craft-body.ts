// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT'S BODY, built from its spec. One parametric low-poly personal
// watercraft, assembled the way the real thing is: a V hull lofted from
// cross-sections that follow the physics' own station tables (its rise,
// its taper, where its chines sit), a rubber rail at the gunwale, a deck
// with a coaming rim, two sunken footwells either side of a pedestal, a
// saddle on the pedestal, a hood swelling ahead of it to the steering pod
// and falling to a raked bow, a boarding platform over the stern, sponsons
// at the aft chine, and the pump housing and nozzle out of the transom.
// No rider — the rider is future work (rider.ts); the saddle and the bars
// are sized for one. The four catalog ids share this builder and differ
// only in the dimensions their spec carries and the paint and proportions
// in craft-styles.ts.
//
// BODY FRAME, the engine's: x is the craft's right, y up, z forward, and
// the ORIGIN IS THE CENTRE OF GRAVITY — `spec.cog` says where that sits
// against the keel and the mid-length, so the mesh is laid out around it
// and the renderer only has to put the group at `craft.x/y/z` with the
// state's quaternion. Everything — the loft, the boxes, the tubes — goes
// into ONE flat-shaded vertex-coloured geometry under one material, so a
// craft is a single draw call.

import * as THREE from "three";
import { TUNING, type CraftSpec } from "@engine";

import type { CraftStyle } from "./craft-styles.ts";

const DEG = Math.PI / 180;
type P = [number, number, number];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep clamped to [0, 1]. */
function smooth(t: number): number {
  const u = t < 0 ? 0 : t > 1 ? 1 : t;
  return u * u * (3 - 2 * u);
}

/** Piecewise-linear read of a table of (x, y) knots, clamped at the ends. */
function table(knots: readonly (readonly [number, number])[], x: number): number {
  if (x <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    if (x <= knots[i][0]) {
      const [x0, y0] = knots[i - 1];
      const [x1, y1] = knots[i];
      return lerp(y0, y1, (x - x0) / (x1 - x0));
    }
  }
  return knots[knots.length - 1][1];
}

/** A pile of coloured triangles, flat-shaded once it is a geometry. Every
 * vertex is its own, so `computeVertexNormals` yields one normal a face
 * and the loft reads as panels. */
class Builder {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];
  private readonly c = new THREE.Color();
  private n = 0;

  tri(a: P, b: P, c: P, color: number): void {
    // A few percent of brightness per facet, hashed off the facet's index
    // so it is the same every build: what keeps one big flat colour from
    // reading as plastic under a light with no texture to break it.
    const jitter = 1 + (((this.n++ * 2654435761) >>> 0) / 4294967296 - 0.5) * 0.08;
    this.c.setHex(color).multiplyScalar(jitter);
    for (const p of [a, b, c]) {
      this.pos.push(p[0], p[1], p[2]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }

  /** Two triangles, wound a→b→c→d seen from the outside. */
  quad(a: P, b: P, c: P, d: P, color: number): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** An axis-aligned box from its two corners. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number): void {
    const a: P = [x0, y0, z0];
    const b: P = [x1, y0, z0];
    const c: P = [x1, y1, z0];
    const d: P = [x0, y1, z0];
    const e: P = [x0, y0, z1];
    const f: P = [x1, y0, z1];
    const g: P = [x1, y1, z1];
    const h: P = [x0, y1, z1];
    this.quad(d, c, b, a, color); // back (-z), seen from behind
    this.quad(e, f, g, h, color); // front (+z)
    this.quad(a, b, f, e, color); // bottom
    this.quad(h, g, c, d, color); // top
    this.quad(e, h, d, a, color); // left (-x)
    this.quad(b, c, g, f, color); // right (+x)
  }

  /** A closed tube from `a` to `b`, `sides` facets round. */
  tube(a: P, b: P, r: number, color: number, sides = 6): void {
    const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const seed = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(seed, d).normalize();
    const v = new THREE.Vector3().crossVectors(d, u);
    const ring = (o: P): P[] => {
      const out: P[] = [];
      for (let k = 0; k < sides; k++) {
        const t = (k / sides) * Math.PI * 2;
        const cx = Math.cos(t) * r;
        const cy = Math.sin(t) * r;
        out.push([
          o[0] + u.x * cx + v.x * cy,
          o[1] + u.y * cx + v.y * cy,
          o[2] + u.z * cx + v.z * cy,
        ]);
      }
      return out;
    };
    const ra = ring(a);
    const rb = ring(b);
    // The ring turns right-handed about the tube's axis, so a→b along the
    // side winds the outside out; the end at `a` fans backward.
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      this.quad(ra[k], ra[k1], rb[k1], rb[k], color);
    }
    this.cap(ra, color, true);
    this.cap(rb, color, false);
  }

  /** A fan over a ring from its first point; `reverse` flips the winding
   * for the end that faces the other way. The ring must be star-shaped
   * from that point. */
  cap(ring: P[], color: number, reverse: boolean): void {
    for (let k = 1; k + 1 < ring.length; k++) {
      if (reverse) this.tri(ring[0], ring[k + 1], ring[k], color);
      else this.tri(ring[0], ring[k], ring[k + 1], color);
    }
  }

  /** Panels between consecutive rings of equal length, `paint[k]` for the
   * panel after point k. Rings that run counter-clockwise seen from astern
   * and advance toward the bow wind every panel's outside out. `closed`
   * joins the last point back to the first. */
  loft(rings: P[][], paint: readonly number[], closed: boolean): void {
    const n = rings[0].length;
    const segs = closed ? n : n - 1;
    for (let i = 0; i + 1 < rings.length; i++) {
      const r0 = rings[i];
      const r1 = rings[i + 1];
      for (let k = 0; k < segs; k++) {
        const k1 = (k + 1) % n;
        this.quad(r0[k], r0[k1], r1[k1], r1[k], paint[k]);
      }
    }
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

/** Mirror a starboard half-ring (its last point on the centreline) into a
 * whole ring that runs starboard → crown → port: counter-clockwise seen
 * from astern, which is the order `loft` and `cap` wind for. A half whose
 * FIRST point is on the centreline too (the keel) shares it; one that
 * starts off-centre (the saddle's base) gets its mirror. */
function mirror(half: P[], sharedFirst: boolean): P[] {
  const ring = half.slice();
  for (let i = half.length - 2; i >= (sharedFirst ? 1 : 0); i--) {
    const [x, y, z] = half[i];
    ring.push([-x, y, z]);
  }
  return ring;
}

/** The paint for a mirrored ring's panels, from the starboard half's. */
function mirrorPaint(half: readonly number[]): number[] {
  return [...half, ...half.slice().reverse()];
}

/** Stations along the hull, transom (0) to bow (1): a pair either side of
 * the pedestal's back wall, a run under the saddle, dense through the
 * hood's swell and the bow's taper. */
const STATIONS = [
  0, 0.05, 0.1, 0.105, 0.2, 0.32, 0.45, 0.56, 0.62, 0.67, 0.72, 0.78, 0.84, 0.9, 0.95, 1,
];
/** Where the boarding platform ends and the pedestal rises. */
const PLATFORM = 0.1;
/** The pedestal's half-width under the saddle, as a share of the beam. */
const PEDESTAL = 0.25;

/** The whole craft, at the origin, ready for a quaternion. */
export function buildCraft(spec: CraftSpec, style: CraftStyle): THREE.Group {
  const { shape } = style;
  const L = spec.length;
  const B = spec.beam;
  const H = spec.height;
  const dead = Math.tan(spec.deadrise * DEG);
  // The spec quotes the CoG `z` ahead of mid-length, so mid-length is at -z.
  const zMid = -spec.cog.z;
  const zTransom = zMid - L / 2;
  const keelY = -spec.cog.y;
  const railY = keelY + H;

  // THE HULL'S LINES, read off the physics' station tables (hull.ts lays
  // its probes on them) and carried past the last station to the tip, so
  // the drawn keel is the keel the probes stand on.
  const hull = TUNING.hull;
  const riseKnots: [number, number][] = [
    [0, 0],
    ...hull.stations.map((s, i): [number, number] => [s, hull.stationRise[i]]),
    [1, 0.62],
  ];
  const taperKnots: [number, number][] = [
    [0, 1],
    ...hull.stations.map((s, i): [number, number] => [s, hull.stationTaper[i]]),
    [1, 0.1],
  ];
  const rise = (s: number) => table(riseKnots, s);
  const taper = (s: number) => table(taperKnots, s);
  /** The sheer: the rail rises toward the bow. */
  const sheerAt = (s: number) => railY + 0.12 * H * s * s;
  /** The deck's bow overhangs the keel's tip: the stem's rake. */
  const rakeAt = (s: number) => shape.bowRake * L * smooth((s - 0.7) / 0.3);

  const railH = 0.09 * H;
  const coamH = 0.08 * H;
  const pedTop = railH + coamH + 0.06 * H;
  const hoodPeak = railH + coamH + shape.hood * H;
  const foreY = railH + coamH + 0.05 * H;
  const seatZone = PLATFORM + shape.seatLength + 0.02;
  const hoodStart = Math.max(0.6, seatZone);
  const hoodTop = hoodStart + 0.12;

  /** Heights over the sheer of the pedestal's top (the hood, forward),
   * and how open the footwells beside it are, at a station. */
  const deckAt = (s: number): { ped: number; open: number; crown: number } => {
    if (s < PLATFORM) return { ped: railH - 0.01, open: 0, crown: 0 };
    const open = 1 - smooth((s - hoodStart) / 0.1);
    let ped: number;
    if (s < hoodStart) ped = pedTop;
    else if (s < hoodTop)
      ped = lerp(pedTop, hoodPeak, smooth((s - hoodStart) / (hoodTop - hoodStart)));
    else if (s < 0.9) ped = lerp(hoodPeak, foreY, smooth((s - hoodTop) / (0.9 - hoodTop)));
    else ped = lerp(foreY, railH + coamH + 0.02 * H, (s - 0.9) / 0.1);
    const crown = lerp(0.14 * H, 0.015 * H, open);
    return { ped, open, crown };
  };

  // ONE CROSS-SECTION: keel, chine, the rail's two edges, the coaming's
  // top, down into the footwell, across its floor to the pedestal, up its
  // wall and over its top to the crown — starboard, then mirrored.
  const ring = (s: number): P[] => {
    const z = zTransom + s * L;
    const rake = rakeAt(s);
    const half = (B / 2) * taper(s);
    const ky = keelY + rise(s) * H;
    const sheer = sheerAt(s);
    const chineX = hull.chineOut * half;
    const chineY = Math.min(ky + chineX * dead, sheer - 0.2 * H);
    const railTop = sheer + railH;
    const coamY = railTop + coamH;
    const footOuter = 0.84 * half;
    const { ped, open, crown } = deckAt(s);
    const pedY = sheer + ped;
    const wellY = s < PLATFORM ? railTop - 0.01 : lerp(coamY, railTop - 0.01, open);
    const pedHalf = s < PLATFORM ? 0 : lerp(footOuter, PEDESTAL * B, open);
    return mirror(
      [
        [0, ky, z],
        [chineX, chineY, z + rake * 0.5],
        [half, sheer, z + rake],
        [half * 1.04, railTop, z + rake],
        [half * 0.92, coamY, z + rake],
        [footOuter, wellY, z + rake],
        [pedHalf, wellY, z + rake],
        [pedHalf * 0.92, pedY, z + rake],
        [pedHalf * 0.5, pedY + crown * 0.75, z + rake],
        [0, pedY + crown, z + rake],
      ],
      true,
    );
  };
  const paint = mirrorPaint([
    style.hull,
    style.topside,
    style.rail,
    style.deck,
    style.deck,
    style.tray,
    style.deck,
    style.deck,
    style.deck,
  ]);

  const b = new Builder();
  const rings = STATIONS.map(ring);
  b.loft(rings, paint, true);
  b.cap(rings[0], style.topside, true);
  b.cap(rings[rings.length - 1], style.deck, false);

  // THE SADDLE on the pedestal: tall at the tail where a passenger sits,
  // a bucket for the rider, rising again ahead of it, its nose dropping
  // to the hood. A stand-up's short pad is the same loft, low.
  const seatZ0 = zTransom + (PLATFORM + 0.02) * L;
  const seatLen = shape.seatLength * L;
  const seatH = shape.seatHeight * H;
  const seatBase = sheerAt(PLATFORM + 0.02) + pedTop - 0.01;
  const seatW = 1.9 * PEDESTAL * B;
  const seatProfile: [number, number][] = [
    [0, 0.94],
    [0.08, 1],
    [0.22, 1],
    [0.38, 0.76],
    [0.7, 0.76],
    [0.86, 0.9],
    [1, 0.5],
  ];
  const seatRings = [0, 0.06, 0.2, 0.36, 0.55, 0.72, 0.86, 0.95, 1].map((t): P[] => {
    const z = seatZ0 + t * seatLen;
    const h = seatH * table(seatProfile, t);
    const w =
      (seatW / 2) *
      (t < 0.08 ? lerp(0.9, 1, t / 0.08) : t > 0.86 ? lerp(1, 0.7, (t - 0.86) / 0.14) : 1);
    return mirror(
      [
        [w, seatBase, z],
        [w * 0.92, seatBase + h * 0.72, z],
        [w * 0.62, seatBase + h, z],
        [0, seatBase + h * 1.04, z],
      ],
      false,
    );
  });
  b.loft(seatRings, mirrorPaint([style.seat, style.seat, style.seatTop]), false);
  b.cap(seatRings[0], style.seat, true);
  b.cap(seatRings[seatRings.length - 1], style.seat, false);
  // The grab handle at the tail of the saddle.
  if (shape.seatLength > 0.2) {
    const hy = seatBase + seatH - 0.02;
    const hz = seatZ0 + 0.04;
    const hx = 0.12 * B;
    b.tube([-hx, hy, hz], [-hx, hy + 0.08, hz], 0.014, style.bar);
    b.tube([hx, hy, hz], [hx, hy + 0.08, hz], 0.014, style.bar);
    b.tube([-hx, hy + 0.08, hz], [hx, hy + 0.08, hz], 0.016, style.grip);
  }

  // THE BOARDING PLATFORM's rubber bumper along the transom's top edge.
  b.box(
    -0.34 * B,
    railY - 0.06,
    zTransom - 0.035,
    0.34 * B,
    railY + railH,
    zTransom + 0.02,
    style.rail,
  );

  // THE SPONSONS: a blade either side at the aft chine, standing out from
  // the topside — what the hull banks against in a turn.
  {
    const chineY = keelY + hull.chineOut * (B / 2) * dead;
    for (const side of [-1, 1]) {
      const inner = side * 0.78 * (B / 2);
      const outer = side * (B / 2 + shape.sponson);
      b.box(
        Math.min(inner, outer),
        chineY - 0.02,
        zTransom + 0.04 * L,
        Math.max(inner, outer),
        chineY + 0.07,
        zTransom + 0.36 * L,
        style.rail,
      );
    }
  }

  // THE PUMP: the housing under the platform out of the transom, the
  // nozzle out of it, and the intake grate under the stern.
  const pumpY = keelY + 0.18 * H;
  b.box(
    -0.12 * B,
    keelY + 0.03 * H,
    zTransom - 0.05,
    0.12 * B,
    keelY + 0.36 * H,
    zTransom + 0.12 * L,
    style.grip,
  );
  // The reboarding step folded up against the transom.
  b.box(
    -0.2 * B,
    keelY + 0.5 * H,
    zTransom - 0.035,
    0.2 * B,
    keelY + 0.58 * H,
    zTransom + 0.01,
    style.rail,
  );
  b.tube([0, pumpY, zTransom - 0.04], [0, pumpY, zTransom - 0.17], 0.055, style.rail, 8);
  b.box(
    -0.1 * B,
    keelY - 0.015,
    zTransom + 0.05 * L,
    0.1 * B,
    keelY + 0.01,
    zTransom + 0.28 * L,
    style.tray,
  );

  // THE STEERING: a pod on the hood's peak, the column raked back out of
  // it, the bars swept back a little with a grip at each end and a pad
  // over the centre, and a mirror on each flank of the hood.
  const sPod = hoodTop;
  const zPod = zTransom + sPod * L + rakeAt(sPod);
  const podBase = sheerAt(sPod) + deckAt(sPod).ped + deckAt(sPod).crown - 0.02;
  const podH = 0.08 * H;
  b.box(-0.14 * B, podBase, zPod - 0.06 * L, 0.14 * B, podBase + podH, zPod + 0.05 * L, style.deck);
  const rakeBack = 22 * DEG;
  const colTop: P = [
    0,
    podBase + podH + shape.column * Math.cos(rakeBack),
    zPod - shape.column * Math.sin(rakeBack),
  ];
  b.tube([0, podBase + podH - 0.02, zPod], colTop, 0.036, style.grip);
  const barW = Math.min(0.72, 0.62 * B);
  for (const side of [-1, 1]) {
    const end: P = [side * (barW / 2), colTop[1] - 0.02, colTop[2] - 0.07];
    b.tube(colTop, end, 0.019, style.bar);
    const gripIn: P = [
      side * (barW / 2 - 0.13),
      lerp(colTop[1], end[1], 0.7),
      lerp(colTop[2], end[2], 0.7),
    ];
    b.tube(gripIn, end, 0.03, style.grip);
  }
  b.box(
    -0.06,
    colTop[1] - 0.03,
    colTop[2] - 0.04,
    0.06,
    colTop[1] + 0.03,
    colTop[2] + 0.04,
    style.grip,
  );
  if (shape.seatLength > 0.2) {
    const sMirror = hoodTop + 0.02;
    const flank = 0.84 * (B / 2) * taper(sMirror);
    const my = sheerAt(sMirror) + deckAt(sMirror).ped - 0.03 * H;
    const mz = zTransom + sMirror * L + rakeAt(sMirror);
    for (const side of [-1, 1]) {
      const root: P = [side * (flank - 0.02), my, mz];
      const head: P = [side * (flank + 0.07), my + 0.06, mz];
      b.tube(root, head, 0.012, style.bar);
      b.box(
        head[0] - 0.045,
        head[1] - 0.03,
        head[2] - 0.045,
        head[0] + 0.045,
        head[1] + 0.03,
        head[2] + 0.045,
        style.deck,
      );
    }
  }

  const group = new THREE.Group();
  group.add(
    new THREE.Mesh(
      b.geometry(),
      new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    ),
  );
  return group;
}
