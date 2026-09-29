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
// craft is a single draw call. What each part is FINISHED in — gel coat,
// rubber, vinyl, chrome — rides the vertices too (`FINISH`, through the
// builder's pen), and the material (craft-surface.ts) puts the sun and the
// sky on the parts that are polished and leaves the rubber dead.

import * as THREE from "three";
import { TUNING, type CraftSpec } from "@engine";

import { Builder, mirror, mirrorPaint, type P } from "../lib/lowpoly.ts";
import type { CraftStyle } from "./craft-styles.ts";
import { FINISH, craftSurface } from "./craft-surface.ts";

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
  0, 0.05, 0.1, 0.105, 0.2, 0.32, 0.45, 0.5, 0.53, 0.56, 0.62, 0.67, 0.72, 0.78, 0.84, 0.9, 0.95, 1,
];
/** Where the boarding platform ends and the pedestal rises. */
const PLATFORM = 0.1;
/** How far the footwell floor must stay above the chine, as a share of the
 * hull depth: a floor drawn any lower pokes out through the topside. How
 * DEEP each craft's wells are is `shape.well`, because a runabout's are
 * trays you sit over and a stand-up's is an open deck you stand in. */
const WELL_OVER_CHINE = 0.08;
/** The saddle's height along it, as a share of its full height: tall at
 * the tail where a passenger sits, a bucket for the rider, rising again
 * ahead of it (the hump his knees grip), its nose dropping to the hood. */
const SEAT_PROFILE: [number, number][] = [
  [0, 0.94],
  [0.08, 1],
  [0.22, 1],
  [0.38, 0.76],
  [0.7, 0.76],
  [0.86, 0.9],
  [1, 0.5],
];
/** Where along the saddle a rider's pelvis sits — at the FORWARD end of
 * the bucket, which is where a solo rider sits and the rear third of the
 * saddle is the passenger's — and how far forward it may slide onto the
 * rise the knees grip when the bars are a long reach. Every centimetre
 * back from here is a centimetre further to stretch to the bars. */
const SEAT_AT = 0.7;
const SEAT_FORWARD = 0.9;
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
  /** The pedestal's half-width under the saddle, m. */
  pedHalf: number;
  seatW: number;
  wellFloorAt: (s: number) => number;
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

  // THE TRIM ON THE GUNWALE — the rubber rail and the coaming's lip — and
  // THE DECK'S OWN HEIGHTS, which are measured over the SHEER and not off
  // that trim. Keeping them apart matters because the trim is the WALL a
  // player sees from the side: the sheer plus the trim is how tall the
  // craft looks against the man on it, and a stack of trim as deep as a
  // hand turns a 3 m runabout into a small boat and its 1.8 m rider into
  // a child. On the real machine the gunwale IS about the sheer line,
  // with a rubber rail and a lip on it and nothing more.
  const railH = 0.045 * H;
  const coamH = 0.03 * H;
  const pedTop = 0.19 * H;
  const hoodPeak = (0.17 + shape.hood) * H;
  const foreY = 0.22 * H;
  const seatZone = PLATFORM + shape.seatLength + 0.02;
  const hoodStart = Math.max(0.5, seatZone);
  const hoodTop = hoodStart + 0.1;

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
  const pedHalf = shape.pedestal * B;
  const seatW = 1.9 * pedHalf;
  /** The footwell floor at a station, stated ONCE: the loft draws this
   * line and `cockpitOf` stands the rider's boots on it, so neither can
   * drift into the other's deck. */
  const wellFloorAt = (s: number): number => {
    const half = (B / 2) * taper(s);
    const sheer = sheerAt(s);
    const chineY = Math.min(keelY + rise(s) * H + hull.chineOut * half * dead, sheer - 0.2 * H);
    return Math.max(sheer - shape.well * H, chineY + WELL_OVER_CHINE * H);
  };

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
    pedHalf,
    seatW,
    wellFloorAt,
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
    return l.wellFloorAt(s);
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
      inner: l.pedHalf,
      outer: 0.84 * (B / 2) * l.taper(sMid),
      z0: zTransom + PLATFORM * L,
      z1: zTransom + l.hoodStart * L,
    },
  };
}

/** THE COCKPIT'S OPENING, in the body frame — the one thing about the hull
 * THE SEA has to be told, because the water is a grid that knows nothing
 * stands on it and the wells are a tray sunk to within a few centimetres of
 * the rest waterline. A wave a hand high then draws straight through the
 * footwell floor and the water stands INSIDE the hull with the gunwale dry
 * either side of it, which is the one way water gets into a boat that never
 * happens. Cut to the RAIL rather than to the coaming's lip: over the rail
 * the sea is coming in over the side, which is a real thing a wave does and
 * is left alone.
 *
 * The wall of it is THE HULL'S OWN SKIN, read at the two ends of the opening
 * and ruled between them, because that is the one line that is outside every
 * part of the well (so no water is left standing in a footwell) and inside
 * the topside at every station (so no notch is ever cut out of the sea
 * beside the hull). Both are millimetres at the ends; the hull tapers by a
 * fifteenth over the opening, and a single width for the whole of it misses
 * by a centimetre at the middle. */
export type WellCut = {
  /** The opening's reach fore and aft, body metres from the cog: the
   * pedestal's back wall to where the hood has closed over the wells. */
  z0: number;
  z1: number;
  /** The band the sea is cut over — the lowest of the wells' floors up to
   * the rail's top. */
  floorY: number;
  rimY: number;
  /** The skin at those two heights, as a half-width, at the aft end of the
   * opening and at the fore end. */
  xFloorAft: number;
  xRimAft: number;
  xFloorFore: number;
  xRimFore: number;
};

/** How many stations the band is read over. The floor and the rail both
 * climb toward the bow, and the cut is taken at the LOWEST of each. */
const CUT_STATIONS = 24;

export function wellCutOf(spec: CraftSpec, style: CraftStyle): WellCut {
  const l = layout(spec, style);
  const { B, H, L, zTransom } = l;
  let floorY = Infinity;
  let rimY = Infinity;
  for (let i = 0; i <= CUT_STATIONS; i++) {
    const s = lerp(PLATFORM, l.hoodTop, i / CUT_STATIONS);
    floorY = Math.min(floorY, l.wellFloorAt(s));
    rimY = Math.min(rimY, l.sheerAt(s) + l.railH);
  }
  /** The section at a station, the way `ring` lofts it — the chine out on
   * the deadrise and the topside straight up to the sheer — read at a
   * height, and the sheer's own half-beam over it. */
  const skinAt = (s: number, y: number): number => {
    const half = (B / 2) * l.taper(s);
    const sheer = l.sheerAt(s);
    const chineX = TUNING.hull.chineOut * half;
    const chineY = Math.min(l.keelY + l.rise(s) * H + chineX * l.dead, sheer - 0.2 * H);
    const t = (y - chineY) / (sheer - chineY);
    return chineX + (half - chineX) * (t < 0 ? 0 : t > 1 ? 1 : t);
  };
  return {
    z0: zTransom + PLATFORM * L,
    z1: zTransom + l.hoodTop * L,
    floorY,
    rimY,
    xFloorAft: skinAt(PLATFORM, floorY),
    xRimAft: skinAt(PLATFORM, rimY),
    xFloorFore: skinAt(l.hoodTop, floorY),
    xRimFore: skinAt(l.hoodTop, rimY),
  };
}

/** WHERE THE LAMP IS MOUNTED, in the body frame: on the hood's crown a
 * little short of the bow, where the deck is still high enough to throw a
 * beam over the nose, and the two sidelights either side of it at the
 * rail. Derived off the same layout the loft draws, so a restyle that moves
 * the hood moves the lamp with it. */
/** THE DECK'S TOP AT A FORE-AFT POSITION, body metres from the cog — how
 * high the crowned centreline stands at `z`, which is the highest the deck
 * gets across the beam and so the line anything stood on it has to clear.
 *
 * It exists because the two cameras bolted to the craft are NOT placeable at
 * a fixed height from the cog. The roster's hulls differ by a quarter of a
 * metre in deck height at the same station, so one hand-authored offset that
 * sits nicely over the skiff's foredeck is UNDER the otter's — and a lens
 * inside a closed hull sees the sea straight through it, because the near
 * plane cuts the deck open and the mesh has no back faces to close it again.
 * `camera.ts` stands its eye rigs on this rather than on a constant.
 *
 * The hull's own parameter runs transom (0) to bow (1) and `z` grows with it
 * monotonically, so the station is recovered by bisection — a few dozen
 * evaluations, once per craft, rather than a second copy of the stem's rake
 * living somewhere it can drift from this one. */
export function deckOf(spec: CraftSpec, style: CraftStyle, z: number): number {
  const l = layout(spec, style);
  const zAt = (s: number): number => l.zTransom + s * l.L + l.rakeAt(s) * 0.5;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2;
    if (zAt(mid) < z) lo = mid;
    else hi = mid;
  }
  const s = (lo + hi) / 2;
  const deck = l.deckAt(s);
  return l.sheerAt(s) + deck.ped + deck.crown;
}

export function lampOf(
  spec: CraftSpec,
  style: CraftStyle,
): { x: number; y: number; z: number; side: number } {
  const l = layout(spec, style);
  const s = 0.9;
  return {
    x: 0,
    y: l.sheerAt(s) + l.deckAt(s).ped + 0.02 * l.H,
    z: l.zTransom + s * l.L + l.rakeAt(s) * 0.5,
    side: (l.B / 2) * l.taper(s) * 0.92,
  };
}

/** ONE STATION'S CROSS-SECTION, as the loft lays it — the keel, the chine,
 * the sheer, the rail's top, the coaming, the footwell's floor between its
 * outer wall and the pedestal, the pedestal's top and the crown — stated
 * once, for the builder's rings and for the modelled hull `craftLines`
 * hands Blender, so the two stand on the same lines. */
export type Section = {
  s: number;
  z: number;
  /** How far the deck's points stand forward of the keel's, m. */
  rake: number;
  half: number;
  keelY: number;
  chineX: number;
  chineY: number;
  sheer: number;
  railTop: number;
  coamY: number;
  footOuter: number;
  wellY: number;
  pedHalf: number;
  pedY: number;
  crown: number;
  /** How open the footwells are here, 0 (the hood closed over them) to 1. */
  open: number;
};

function sectionOf(l: Layout, s: number): Section {
  const half = (l.B / 2) * l.taper(s);
  const keelY = l.keelY + l.rise(s) * l.H;
  const sheer = l.sheerAt(s);
  const chineX = TUNING.hull.chineOut * half;
  const railTop = sheer + l.railH;
  const coamY = railTop + l.coamH;
  const footOuter = 0.84 * half;
  const { ped, open, crown } = l.deckAt(s);
  return {
    s,
    z: l.zTransom + s * l.L,
    rake: l.rakeAt(s),
    half,
    keelY,
    chineX,
    chineY: Math.min(keelY + chineX * l.dead, sheer - 0.2 * l.H),
    sheer,
    railTop,
    coamY,
    footOuter,
    wellY: s < PLATFORM ? railTop - 0.01 : lerp(coamY, l.wellFloorAt(s), open),
    pedHalf: s < PLATFORM ? 0 : lerp(footOuter, l.pedHalf, open),
    pedY: sheer + ped,
    crown,
    open,
  };
}

/** A box as its two corners, and a tube as its two ends and radius. */
type Box = [number, number, number, number, number, number];
type Tube = { a: P; b: P; r: number };

/** EVERYTHING BOLTED ON: the parts the builder draws off the layout, as
 * boxes and tubes, stated once — the builder draws them and `craftLines`
 * hands them to Blender to model. */
function fittingsOf(l: Layout, style: CraftStyle) {
  const { shape } = style;
  const { L, B, H, dead, zTransom, keelY, railY, railH, sheerAt, deckAt, taper, rakeAt } = l;
  const { seatZ0, seatH, seatBase, zPod, podBase, podH, colTop, hoodTop } = l;
  const hull = TUNING.hull;
  const runabout = shape.seatLength > 0.2;
  const handle = runabout
    ? (() => {
        const hy = seatBase + seatH - 0.02;
        const hz = seatZ0 + 0.04;
        const hx = 0.12 * B;
        return {
          posts: [-hx, hx].map((x): Tube => ({ a: [x, hy, hz], b: [x, hy + 0.08, hz], r: 0.014 })),
          bar: { a: [-hx, hy + 0.08, hz], b: [hx, hy + 0.08, hz], r: 0.016 } as Tube,
        };
      })()
    : null;
  const chineY = keelY + hull.chineOut * (B / 2) * dead;
  const sponsons = [-1, 1].map((side): Box => {
    const inner = side * 0.78 * (B / 2);
    const outer = side * (B / 2 + shape.sponson);
    return [
      Math.min(inner, outer),
      chineY - 0.02,
      zTransom + 0.04 * L,
      Math.max(inner, outer),
      chineY + 0.07,
      zTransom + 0.36 * L,
    ];
  });
  const pumpY = keelY + 0.18 * H;
  const bars = ([-1, 1] as const).map((side) => {
    const { end } = barOf(l, side);
    const gripIn: P = [
      side * (l.barW / 2 - 0.13),
      lerp(colTop[1], end[1], 0.7),
      lerp(colTop[2], end[2], 0.7),
    ];
    return { bar: { a: colTop, b: end, r: 0.019 } as Tube, grip: { a: gripIn, b: end, r: 0.03 } };
  });
  const mirrors = runabout
    ? (() => {
        const sMirror = hoodTop + 0.02;
        const flank = 0.84 * (B / 2) * taper(sMirror);
        const my = sheerAt(sMirror) + deckAt(sMirror).ped - 0.03 * H;
        const mz = zTransom + sMirror * L + rakeAt(sMirror);
        return [-1, 1].map((side) => {
          const head: P = [side * (flank + 0.07), my + 0.06, mz];
          return {
            stalk: { a: [side * (flank - 0.02), my, mz], b: head, r: 0.012 } as Tube,
            head: [
              head[0] - 0.045,
              head[1] - 0.03,
              head[2] - 0.045,
              head[0] + 0.045,
              head[1] + 0.03,
              head[2] + 0.045,
            ] as Box,
          };
        });
      })()
    : [];
  return {
    handle,
    bumper: [
      -0.34 * B,
      railY - 0.06,
      zTransom - 0.035,
      0.34 * B,
      railY + railH,
      zTransom + 0.02,
    ] as Box,
    sponsons,
    pump: [
      -0.12 * B,
      keelY + 0.03 * H,
      zTransom - 0.05,
      0.12 * B,
      keelY + 0.36 * H,
      zTransom + 0.12 * L,
    ] as Box,
    step: [
      -0.2 * B,
      keelY + 0.5 * H,
      zTransom - 0.035,
      0.2 * B,
      keelY + 0.58 * H,
      zTransom + 0.01,
    ] as Box,
    nozzle: { a: [0, pumpY, zTransom - 0.04], b: [0, pumpY, zTransom - 0.17], r: 0.055 } as Tube,
    grate: [
      -0.1 * B,
      keelY - 0.015,
      zTransom + 0.05 * L,
      0.1 * B,
      keelY + 0.01,
      zTransom + 0.28 * L,
    ] as Box,
    pod: [-0.14 * B, podBase, zPod - 0.06 * L, 0.14 * B, podBase + podH, zPod + 0.05 * L] as Box,
    column: { a: [0, podBase + podH - 0.02, zPod], b: colTop, r: 0.036 } as Tube,
    bars,
    pad: [
      -0.06,
      colTop[1] - 0.03,
      colTop[2] - 0.04,
      0.06,
      colTop[1] + 0.03,
      colTop[2] + 0.04,
    ] as Box,
    mirrors,
  };
}

/** The saddle's rings, tail to nose, as the builder lofts them. */
function seatRingsOf(l: Layout): P[][] {
  const { seatZ0, seatLen, seatH, seatBase, seatW } = l;
  return [0, 0.06, 0.2, 0.36, 0.55, 0.72, 0.86, 0.95, 1].map((t): P[] => {
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
}

/** THE CRAFT'S LINES AS DATA — what `make blender` hands the modelled hull
 * (`scripts/blender/craft.py`), off the very layout the builder draws: the
 * cross-section at `count` stations transom to bow (and at the builder's
 * own, where the pedestal's back wall steps), the saddle and its profile,
 * every fitting, the lamp's mount, the cockpit the rider is stood on and
 * the opening the sea is cut out of. Plain numbers, so a JSON file carries
 * them and a model stands on the physics' lines to the millimetre. */
export function craftLines(spec: CraftSpec, style: CraftStyle, count = 48) {
  const l = layout(spec, style);
  const at = new Set<number>(STATIONS);
  for (let i = 0; i <= count; i++) at.add(i / count);
  const stations = [...at].sort((a, b) => a - b);
  const cockpit = cockpitOf(spec, style);
  const { floorAt, ...wells } = cockpit.wells;
  const floor = Array.from({ length: 17 }, (_, i) => {
    const z = lerp(wells.z0, wells.z1, i / 16);
    return [z, floorAt(z)];
  });
  return {
    dims: {
      L: l.L,
      B: l.B,
      H: l.H,
      deadrise: spec.deadrise,
      zTransom: l.zTransom,
      keelY: l.keelY,
      railY: l.railY,
      railH: l.railH,
      coamH: l.coamH,
      platform: PLATFORM,
      hoodStart: l.hoodStart,
      hoodTop: l.hoodTop,
    },
    sections: stations.map((s) => sectionOf(l, s)),
    seat: {
      rings: seatRingsOf(l),
      z0: l.seatZ0,
      length: l.seatLen,
      height: l.seatH,
      base: l.seatBase,
      width: l.seatW,
      profile: SEAT_PROFILE,
    },
    fittings: fittingsOf(l, style),
    lamp: lampOf(spec, style),
    cockpit: { ...cockpit, wells: { ...wells, floor } },
    wellCut: wellCutOf(spec, style),
    pump: {
      nozzleDiameter: spec.nozzleDiameter,
      nozzleAngle: spec.nozzleAngle,
      trimRange: spec.trimRange,
      bucket: spec.bucket.reverse > 0,
    },
  };
}

export type CraftLines = ReturnType<typeof craftLines>;

/** The whole craft, at the origin, ready for a quaternion. `surface` is the
 * material it is drawn with — the renderer hands in the one it shares with
 * the rider, on the sky's own uniforms; anything with no sky to reflect
 * takes a plain one. */
export function buildCraft(
  spec: CraftSpec,
  style: CraftStyle,
  surface: THREE.Material = craftSurface(),
): THREE.Group {
  const l = layout(spec, style);
  const f = fittingsOf(l, style);

  // ONE CROSS-SECTION: keel, chine, the rail's two edges, the coaming's
  // top, down into the footwell, across its floor to the pedestal, up its
  // wall and over its top to the crown — starboard, then mirrored.
  const ring = (s: number): P[] => {
    const c = sectionOf(l, s);
    const z = c.z;
    const rake = c.rake;
    return mirror(
      [
        [0, c.keelY, z],
        [c.chineX, c.chineY, z + rake * 0.5],
        [c.half, c.sheer, z + rake],
        [c.half * 1.04, c.railTop, z + rake],
        [c.half * 0.92, c.coamY, z + rake],
        [c.footOuter, c.wellY, z + rake],
        [c.pedHalf, c.wellY, z + rake],
        [c.pedHalf * 0.92, c.pedY, z + rake],
        [c.pedHalf * 0.5, c.pedY + c.crown * 0.75, z + rake],
        [0, c.pedY + c.crown, z + rake],
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
  // …and what each panel is finished in: the shell's gel coat up to the
  // rail, the rail's rubber, the deck's paint, the well's mat.
  const finish = mirrorPaint([
    FINISH.gelcoat,
    FINISH.gelcoat,
    FINISH.rubber,
    FINISH.paint,
    FINISH.paint,
    FINISH.mat,
    FINISH.paint,
    FINISH.paint,
    FINISH.paint,
  ]);

  const b = new Builder();
  const rings = STATIONS.map(ring);
  b.loft(rings, paint, true, finish);
  b.finish = FINISH.gelcoat;
  b.cap(rings[0], style.topside, true);
  b.finish = FINISH.paint;
  b.cap(rings[rings.length - 1], style.deck, false);

  // THE SADDLE on the pedestal, lofted along SEAT_PROFILE. A stand-up's
  // short pad is the same loft, low.
  const seatRings = seatRingsOf(l);
  b.finish = FINISH.vinyl;
  b.loft(seatRings, mirrorPaint([style.seat, style.seat, style.seatTop]), false);
  b.cap(seatRings[0], style.seat, true);
  b.cap(seatRings[seatRings.length - 1], style.seat, false);
  const tube = (t: Tube, colour: number, sides?: number) => b.tube(t.a, t.b, t.r, colour, sides);
  const box = (x: Box, colour: number) => b.box(...x, colour);
  // The grab handle at the tail of the saddle.
  if (f.handle) {
    b.finish = FINISH.chrome;
    for (const post of f.handle.posts) tube(post, style.bar);
    b.finish = FINISH.rubber;
    tube(f.handle.bar, style.grip);
  }

  // THE BOARDING PLATFORM's rubber bumper along the transom's top edge.
  b.finish = FINISH.rubber;
  box(f.bumper, style.rail);

  // THE SPONSONS: a blade either side at the aft chine, standing out from
  // the topside — what the hull banks against in a turn.
  b.finish = FINISH.moulding;
  for (const s of f.sponsons) box(s, style.rail);

  // THE PUMP: the housing under the platform out of the transom, the
  // nozzle out of it, and the intake grate under the stern.
  box(f.pump, style.grip);
  // The reboarding step folded up against the transom.
  b.finish = FINISH.rubber;
  box(f.step, style.rail);
  b.finish = FINISH.moulding;
  tube(f.nozzle, style.rail, 8);
  b.finish = FINISH.mat;
  box(f.grate, style.tray);

  // THE STEERING: a pod on the hood's peak, the column raked back out of
  // it, the bars swept back a little with a grip at each end and a pad
  // over the centre, and a mirror on each flank of the hood.
  b.finish = FINISH.paint;
  box(f.pod, style.deck);
  b.finish = FINISH.moulding;
  tube(f.column, style.grip);
  for (const bar of f.bars) {
    b.finish = FINISH.chrome;
    tube(bar.bar, style.bar);
    b.finish = FINISH.rubber;
    tube(bar.grip, style.grip);
  }
  box(f.pad, style.grip);
  for (const m of f.mirrors) {
    b.finish = FINISH.chrome;
    tube(m.stalk, style.bar);
    b.finish = FINISH.moulding;
    box(m.head, style.deck);
  }

  const group = new THREE.Group();
  group.add(new THREE.Mesh(b.geometry(), surface));
  return group;
}
