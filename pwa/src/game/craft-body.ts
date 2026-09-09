// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT'S BODY, built from its spec. One parametric low-poly personal
// watercraft, assembled the way the real thing is: a V hull lofted from
// cross-sections that follow the physics' own station tables (its rise,
// its taper, where its chines sit), a rubber rail at the gunwale, a deck
// with a coaming rim, two sunken footwells either side of a pedestal, a
// saddle on the pedestal, a hood swelling ahead of it to the steering pod
// and falling to a raked bow, a boarding platform over the stern, sponsons
// at the aft chine, and the pump housing and nozzle out of the transom.
// The four catalog ids share this builder and differ only in the
// dimensions their spec carries and the paint and proportions in
// craft-styles.ts. The rider is rider.ts's, stood on this deck through
// `cockpitOf` — the saddle's bucket, the grips and the footwells as the
// builder actually placed them, so a hand is on the grip that is drawn.
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

import { Builder, mirror, mirrorPaint, type P } from "../lib/lowpoly.ts";
import type { CraftStyle } from "./craft-styles.ts";

const DEG = Math.PI / 180;

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
/** The saddle's height along it, as a share of its full height: tall at
 * the tail where a passenger sits, a bucket for the rider, rising again
 * ahead of it, its nose dropping to the hood. */
const SEAT_PROFILE: [number, number][] = [
  [0, 0.94],
  [0.08, 1],
  [0.22, 1],
  [0.38, 0.76],
  [0.7, 0.76],
  [0.86, 0.9],
  [1, 0.5],
];
/** Where along the saddle a rider's pelvis sits — toward the forward end
 * of the bucket — and how far forward it may slide onto the rise the
 * knees grip when the bars are a long reach. */
const SEAT_AT = 0.64;
const SEAT_FORWARD = 0.72;
/** The steering column's rake back from the pod, rad. */
const RAKE_BACK = 22 * DEG;

/** Everything the builder derives from the row and the style before it
 * draws a triangle, stated once: the loft reads it, and so does
 * `cockpitOf`, so the rider is stood on the deck that is drawn. */
type Layout = {
  L: number;
  B: number;
  H: number;
  dead: number;
  zTransom: number;
  keelY: number;
  railY: number;
  rise: (s: number) => number;
  taper: (s: number) => number;
  sheerAt: (s: number) => number;
  rakeAt: (s: number) => number;
  railH: number;
  coamH: number;
  pedTop: number;
  hoodStart: number;
  hoodTop: number;
  deckAt: (s: number) => { ped: number; open: number; crown: number };
  seatZ0: number;
  seatLen: number;
  seatH: number;
  seatBase: number;
  seatW: number;
  zPod: number;
  podBase: number;
  podH: number;
  colTop: P;
  barW: number;
};

function layout(spec: CraftSpec, style: CraftStyle): Layout {
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

  const seatZ0 = zTransom + (PLATFORM + 0.02) * L;
  const seatLen = shape.seatLength * L;
  const seatH = shape.seatHeight * H;
  const seatBase = sheerAt(PLATFORM + 0.02) + pedTop - 0.01;
  const seatW = 1.9 * PEDESTAL * B;

  const sPod = hoodTop;
  const zPod = zTransom + sPod * L + rakeAt(sPod);
  const podBase = sheerAt(sPod) + deckAt(sPod).ped + deckAt(sPod).crown - 0.02;
  const podH = 0.08 * H;
  const colTop: P = [
    0,
    podBase + podH + shape.column * Math.cos(RAKE_BACK),
    zPod - shape.column * Math.sin(RAKE_BACK),
  ];
  const barW = Math.min(0.72, 0.62 * B);

  return {
    L,
    B,
    H,
    dead,
    zTransom,
    keelY,
    railY,
    rise,
    taper,
    sheerAt,
    rakeAt,
    railH,
    coamH,
    pedTop,
    hoodStart,
    hoodTop,
    deckAt,
    seatZ0,
    seatLen,
    seatH,
    seatBase,
    seatW,
    zPod,
    podBase,
    podH,
    colTop,
    barW,
  };
}

/** The outer end of one bar, and where its grip is centred. */
function barOf(l: Layout, side: -1 | 1): { end: P; grip: P } {
  const end: P = [side * (l.barW / 2), l.colTop[1] - 0.02, l.colTop[2] - 0.07];
  const gripIn: P = [
    side * (l.barW / 2 - 0.13),
    lerp(l.colTop[1], end[1], 0.7),
    lerp(l.colTop[2], end[2], 0.7),
  ];
  const grip: P = [(gripIn[0] + end[0]) / 2, (gripIn[1] + end[1]) / 2, (gripIn[2] + end[2]) / 2];
  return { end, grip };
}

/** What the rider is stood on, in the body frame: the deck as the builder
 * placed it, so the pose in rider-pose.ts reaches the grips that are
 * drawn and the feet stand on the floor that is. */
export type Cockpit = {
  /** A stand-up: the rider stands in the tray rather than sitting. */
  standUp: boolean;
  /** Where a seated rider's pelvis goes — the top of the saddle's bucket
   * toward its forward end — how far forward it may slide from there
   * for a long reach to the bars, and the saddle's half-width. */
  seat: { y: number; z: number; zMax: number; halfWidth: number };
  /** The RIGHT grip's centre, and the bar's direction through it, outward;
   * the left grip is its mirror in x. */
  grip: { x: number; y: number; z: number; dx: number; dy: number; dz: number };
  /** The footwells: the floor's height at a plan `z` along them, their
   * walls (the pedestal's flank and the outer edge, as |x|), and their
   * reach fore and aft. */
  wells: { floorAt: (z: number) => number; inner: number; outer: number; z0: number; z1: number };
};

export function cockpitOf(spec: CraftSpec, style: CraftStyle): Cockpit {
  const l = layout(spec, style);
  const { L, B, zTransom } = l;
  const bucketH = l.seatH * table(SEAT_PROFILE, SEAT_AT);
  const { end, grip } = barOf(l, 1);
  const dir = new THREE.Vector3(
    end[0] - l.colTop[0],
    end[1] - l.colTop[1],
    end[2] - l.colTop[2],
  ).normalize();
  const sMid = (PLATFORM + l.hoodStart) / 2;
  const floorAt = (z: number): number => {
    const s = Math.min(l.hoodStart, Math.max(PLATFORM, (z - zTransom) / L));
    return l.sheerAt(s) + l.railH - 0.01;
  };
  return {
    standUp: style.shape.seatLength <= 0.2,
    seat: {
      y: l.seatBase + bucketH * 1.04,
      z: l.seatZ0 + SEAT_AT * l.seatLen,
      zMax: l.seatZ0 + SEAT_FORWARD * l.seatLen,
      halfWidth: l.seatW / 2,
    },
    grip: { x: grip[0], y: grip[1], z: grip[2], dx: dir.x, dy: dir.y, dz: dir.z },
    wells: {
      floorAt,
      inner: PEDESTAL * B,
      outer: 0.84 * (B / 2) * l.taper(sMid),
      z0: zTransom + PLATFORM * L,
      z1: zTransom + l.hoodStart * L,
    },
  };
}

/** The whole craft, at the origin, ready for a quaternion. */
export function buildCraft(spec: CraftSpec, style: CraftStyle): THREE.Group {
  const { shape } = style;
  const l = layout(spec, style);
  const { L, B, H, dead, zTransom, keelY, railY, rise, taper, sheerAt, rakeAt } = l;
  const { railH, coamH, hoodTop, deckAt } = l;
  const hull = TUNING.hull;

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

  // THE SADDLE on the pedestal, lofted along SEAT_PROFILE. A stand-up's
  // short pad is the same loft, low.
  const { seatZ0, seatLen, seatH, seatBase, seatW } = l;
  const seatRings = [0, 0.06, 0.2, 0.36, 0.55, 0.72, 0.86, 0.95, 1].map((t): P[] => {
    const z = seatZ0 + t * seatLen;
    const h = seatH * table(SEAT_PROFILE, t);
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
  const { zPod, podBase, podH, colTop } = l;
  b.box(-0.14 * B, podBase, zPod - 0.06 * L, 0.14 * B, podBase + podH, zPod + 0.05 * L, style.deck);
  b.tube([0, podBase + podH - 0.02, zPod], colTop, 0.036, style.grip);
  for (const side of [-1, 1] as const) {
    const { end } = barOf(l, side);
    b.tube(colTop, end, 0.019, style.bar);
    const gripIn: P = [
      side * (l.barW / 2 - 0.13),
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
