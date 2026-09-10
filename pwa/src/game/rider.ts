// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER, drawn: a low-poly man on the saddle in a wetsuit, a life vest
// and a full-face helmet, a hand on each grip and a boot in each footwell,
// built from the joints rider-pose.ts places. He is judged from BEHIND —
// that is where the chase camera is — so what reads there is what the
// figure spends its triangles on: the back of the vest a clear step
// lighter than the seat under it with two orange straps over the
// shoulders, the helmet's three bands of livery under a peak, muscled
// arms out to the bars, and the orange stripe down the outside of each
// shin where the legs show beside the hull.
//
// THE GIRTHS ARE THE SILHOUETTE. Nothing here is textured and nothing is
// smooth-shaded, so every limb is read from its outline alone: a segment
// lofted as an even taper reads as tubing whatever it is painted, and one
// lofted wide at the joint, wider still at the muscle's belly and narrow
// at the next joint reads as a leg. Each ring below carries an athletic
// man's circumference at that height, halved.
//
// A BODY IS NOT MADE OF TUBES, EITHER. Two things keep the figure off the
// tin man a lofted skeleton lands on by default: enough facets round each
// part that a lit curve reads as a curve rather than as four flat plates
// (`FACETS`), and rings that need not be CENTRED on the bone they hang off
// (`Ring.o`) — the seat of a sitting man is a mass behind his spine, and a
// ring centred on the pelvis' axis can only ever be a box round it.
//
// The figure is RE-EMITTED every frame from the pose — the same shapes in
// the same order into one geometry the builder refreshes in place (the
// colours stay; the positions and the normals are rewritten) — so it is
// one draw call and no skinning, and a joint that moved is a triangle
// that moved. Every dimension is a segment of `BODY` or a proportion
// stated beside the shape it sizes; nothing here decides where a joint
// GOES. Renderer-side: nothing mutates the `GameState`.

import * as THREE from "three";
import type { GameState } from "@engine";

import { Builder, type P } from "../lib/lowpoly.ts";
import type { Cockpit } from "./craft-body.ts";
import {
  BODY,
  REST_READ,
  RIDER_SCALE,
  add,
  createRiderDynamics,
  cross,
  dot,
  length,
  normalize,
  poseRider,
  riderVisible,
  scale,
  sub,
  type RiderPose,
} from "./rider-pose.ts";

/** The kit. Orange is the rider's own — a shade redder than the buoys'
 * so the two never read as one thing — and the vest's back is a mid tone
 * on purpose: at chase range a dark back on a dark saddle is one black
 * patch however well it is modelled. */
const PAINT = {
  skin: 0xc9906a,
  /** The wetsuit: dark, with the lighter panels of a camo print down the
   * outside of the legs. */
  suit: 0x27322d,
  suitLight: 0x4f5e48,
  vest: 0x1d2226,
  vestBack: 0x3d474f,
  /** The straps, the shin guards, the knee pads and the helmet's sweep. */
  orange: 0xe8702a,
  glove: 0x4a5057,
  boot: 0x16191c,
  /** THE HELMET is a racing lid in three tones, stacked bottom to top —
   * a white lower shell, the orange sweep across the middle, a navy crown
   * and peak. The stack is what makes it read: a helmet painted in one
   * dark tone is a head-sized silhouette at chase range and nothing more,
   * however well the shell is shaped. */
  shellLow: 0xeef3f8,
  helmet: 0x1b2a4a,
  /** The goggle port and the chin bar as one dark mass, which is what a
   * full-face's front is from any distance that matters. */
  visor: 0x14181e,
};

/** How many facets each part is lofted with. This is the one dial between
 * a rounded man and the cost of rebuilding him: the figure is re-emitted
 * and its normals recomputed every frame, so a facet is paid for 60 times
 * a second rather than once. Eight is the floor at which a lit limb reads
 * as round from the side; the parts a player looks straight at — the seat,
 * the chest, the helmet — get twelve, and the flat things (a strap, the
 * peak's blade) stay coarse because a curve is not what they are. */
const FACETS = {
  /** The seat gets the most of any part. It is the widest thing on a
   * seated man, it is what the chase camera is nearest to, and it is the
   * one mass with curvature in every direction at once — the count that
   * passes on an arm reads as a chamfered crate here. */
  pelvis: 16,
  torso: 12,
  helmet: 12,
  limb: 10,
  fist: 8,
  strap: 6,
  peak: 4,
} as const;

/** A cross-section along a segment: at `t` of its length, half-axes `w`
 * (toward the segment's `hint` direction) and `d` (across it), with the
 * ring's centre pushed `o` off the segment's own line along that second
 * axis — which for anything hung off the spine (hint = the body's right,
 * axis = its up) is BACKWARD. `o` is what makes a rear rather than a
 * cylinder: the mass of a seated man's hips is behind the line his spine
 * runs down, and no symmetric ring can say so. */
type Ring = { t: number; w: number; d: number; o?: number };

/** A length in the figure's own units: every literal in this file is a
 * dimension of the 1.8 m man `BODY`'s table describes, so it carries
 * `RIDER_SCALE` exactly as a `BODY` segment does. Scaling in one place
 * is what keeps a bigger rider PROPORTIONAL — a skeleton scaled without
 * its girths is a man on stilts, and a helmet scaled without its peak
 * grows a shell the peak no longer fits. */
const k = (v: number): number => v * RIDER_SCALE;

/** A point `a` with its component along the unit `axis` removed, as a
 * unit vector. */
function across(a: P, axis: P): P {
  const p = sub(a, scale(axis, dot(a, axis)));
  if (length(p) < 1e-6) {
    const seed: P = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    return normalize(sub(seed, scale(axis, dot(seed, axis))));
  }
  return normalize(p);
}

/** A segment of the figure: `rings` lofted from `a` to `b`, `n` facets
 * round, the first facet's corner half a step past the `hint` direction
 * so a panel faces it squarely. `paint` is one colour or one per panel —
 * panel k faces the angle (k + 1)·360°/n from the hint toward
 * axis × hint, which `facetPaint` and `legPaint` below are the two ways
 * of reading. The rings turn right-handed about the axis and the caps
 * face away from each other. */
function segment(
  b: Builder,
  a: P,
  to: P,
  hint: P,
  rings: readonly Ring[],
  n: number,
  paint: number | readonly number[],
  caps: [boolean, boolean] = [true, true],
): void {
  const axis = normalize(sub(to, a));
  const u = across(hint, axis);
  const v = cross(axis, u);
  const colours = typeof paint === "number" ? new Array<number>(n).fill(paint) : paint;
  const out: P[][] = rings.map((r) => {
    const o = add(add(a, scale(sub(to, a), r.t)), scale(v, k(r.o ?? 0)));
    const ring: P[] = [];
    for (let j = 0; j < n; j++) {
      const th = ((j + 0.5) / n) * Math.PI * 2;
      const cx = Math.cos(th) * k(r.w);
      const cy = Math.sin(th) * k(r.d);
      ring.push([
        o[0] + u[0] * cx + v[0] * cy,
        o[1] + u[1] * cx + v[1] * cy,
        o[2] + u[2] * cx + v[2] * cy,
      ]);
    }
    return ring;
  });
  b.loft(out, colours, true);
  if (caps[0]) b.cap(out[0], colours[0], true);
  if (caps[1]) b.cap(out[out.length - 1], colours[0], false);
}

/** Paint for a part hung off the spine — hint = the body's right, so a
 * panel's angle runs from the right round toward the BACK. The back arc
 * and the front arc take a third of the circle each and the two sides
 * split the rest, whatever `n` is. */
function facetPaint(n: number, back: number, front: number, side: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const aft = Math.sin(((k + 1) / n) * Math.PI * 2);
    out.push(aft > 0.5 ? back : aft < -0.5 ? front : side);
  }
  return out;
}

/** Paint for a leg — hint = outward, so a panel's angle runs from straight
 * out round toward the front on one leg and toward the back on the other.
 * The choice is made on the OUTWARD component alone, so both legs come out
 * painted alike: the panel facing straight out takes the `stripe`, the two
 * flanking it the print's `light` panels, the inside `dark`. */
function legPaint(n: number, dark: number, light: number, stripe: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < n; k++) {
    const outward = Math.cos(((k + 1) / n) * Math.PI * 2);
    out.push(outward > 0.9 ? stripe : outward > 0.35 ? light : dark);
  }
  return out;
}

/** The whole figure, from its joints. The order is fixed: the per-facet
 * brightness hash is keyed on it, and a refresh keeps the colours. */
function figure(b: Builder, p: RiderPose): void {
  const up = p.torsoUp;
  const right = p.torsoRight;
  const fwd = p.torsoFwd;
  const at = (o: P, dUp: number, dRight: number, dFwd: number): P =>
    add(add(add(o, scale(up, dUp)), scale(right, dRight)), scale(fwd, dFwd));

  // THE SEAT, THE HIPS AND THE SMALL OF THE BACK, as one mass: from under
  // the buttocks on the cushion, up through the widest part of the hips,
  // and on INTO the torso along the lean the torso is holding — one loft,
  // because the alternative leaves a wedge of nothing behind the spine
  // where the vertical pelvis stops and the leaning torso starts, and a
  // chase camera looking down over the rider's back sees straight through
  // it onto the saddle.
  //
  // The rings are pushed aft off that leaning line by `o`, most of it
  // low down: the glutes are the widest thing on a seated man and they
  // are BEHIND him, and that offset is the difference between a rider sat
  // back on a machine and one perched on a post. The bottom ring beds a
  // little INTO the cushion on purpose — a body resting on foam displaces
  // it, and a mass that stops exactly at the surface reads as hovering.
  segment(
    b,
    add(p.pelvis, scale(p.pelvisUp, -(BODY.pelvis + k(0.005)))),
    at(p.pelvis, k(0.22), 0, 0),
    right,
    [
      { t: 0, w: 0.098, d: 0.09, o: 0.03 },
      { t: 0.1, w: 0.14, d: 0.12, o: 0.058 },
      { t: 0.22, w: 0.166, d: 0.138, o: 0.072 },
      { t: 0.36, w: 0.18, d: 0.14, o: 0.06 },
      { t: 0.52, w: 0.18, d: 0.132, o: 0.04 },
      { t: 0.68, w: 0.172, d: 0.12, o: 0.022 },
      { t: 0.84, w: 0.16, d: 0.11, o: 0.01 },
      { t: 1, w: 0.15, d: 0.104 },
    ],
    FACETS.pelvis,
    PAINT.suit,
  );
  // THE TORSO, the vest over it with its back panel lighter and a strap
  // over each shoulder, and the band at its hem covering the join.
  segment(
    b,
    at(p.pelvis, k(0.06), 0, 0),
    at(p.chest, k(0.04), 0, 0),
    right,
    // The V a swimmer's back makes: a waist well inside the ribs, the lats
    // flaring above them to a chest wider than the shoulder joints, so the
    // deltoids stand outside the torso rather than continuing its line.
    [
      { t: 0, w: 0.155, d: 0.108 },
      { t: 0.3, w: 0.178, d: 0.126 },
      { t: 0.58, w: 0.2, d: 0.134 },
      { t: 0.82, w: 0.219, d: 0.135 },
      { t: 1, w: 0.228, d: 0.126 },
    ],
    FACETS.torso,
    facetPaint(FACETS.torso, PAINT.vestBack, PAINT.vest, PAINT.vest),
    [false, true],
  );
  segment(
    b,
    at(p.pelvis, k(0.06), 0, 0),
    at(p.pelvis, k(0.13), 0, 0),
    right,
    [
      { t: 0, w: 0.166, d: 0.118 },
      { t: 1, w: 0.172, d: 0.124 },
    ],
    FACETS.torso,
    PAINT.orange,
    [false, false],
  );
  for (const side of [-1, 1]) {
    segment(
      b,
      at(p.chest, k(0.05), side * k(0.11), k(-0.1)),
      at(p.pelvis, k(0.15), side * k(0.06), k(-0.125)),
      fwd,
      [
        { t: 0, w: 0.022, d: 0.034 },
        { t: 1, w: 0.022, d: 0.032 },
      ],
      FACETS.strap,
      PAINT.orange,
    );
  }

  // THE NECK and THE HELMET: a full-face shell 0.26 m across the ear pads —
  // a real lid's width, so it sits WIDER than the shoulders' line and reads
  // as kit rather than as a head — with the goggle port and the chin bar
  // one dark mass at the front, a peak over it, and its livery in bands up
  // the shell.
  segment(
    b,
    at(p.chest, k(0.02), 0, k(0.02)),
    add(p.neck, scale(up, k(0.03))),
    right,
    [
      { t: 0, w: 0.058, d: 0.052 },
      { t: 1, w: 0.052, d: 0.05 },
    ],
    FACETS.limb,
    PAINT.skin,
    [false, false],
  );
  const headBase = add(p.neck, scale(p.headFwd, k(0.03)));
  const crown = add(headBase, scale(p.headUp, BODY.helmet));
  {
    const axis = p.headUp;
    const u = across(p.headRight, axis);
    const v = cross(axis, u);
    // Lofted band by band rather than through `segment`, because the
    // livery changes UP the shell and a loft paints one colour per panel
    // for its whole length. The dark front is carried up past the port to
    // the brow, where the peak takes over.
    const shell: readonly Ring[] = [
      { t: 0, w: 0.1, d: 0.118 },
      { t: 0.14, w: 0.12, d: 0.14 },
      { t: 0.34, w: 0.13, d: 0.15 },
      { t: 0.56, w: 0.13, d: 0.149 },
      { t: 0.76, w: 0.118, d: 0.136 },
      { t: 0.9, w: 0.098, d: 0.11 },
      { t: 1, w: 0.05, d: 0.058 },
    ];
    const n = FACETS.helmet;
    const white = facetPaint(n, PAINT.shellLow, PAINT.visor, PAINT.shellLow);
    const livery: readonly number[][] = [
      white,
      white,
      facetPaint(n, PAINT.orange, PAINT.visor, PAINT.orange),
      facetPaint(n, PAINT.orange, PAINT.helmet, PAINT.orange),
      facetPaint(n, PAINT.helmet, PAINT.helmet, PAINT.helmet),
      facetPaint(n, PAINT.helmet, PAINT.helmet, PAINT.helmet),
    ];
    const rings: P[][] = shell.map((r) => {
      const o = add(headBase, scale(sub(crown, headBase), r.t));
      const ring: P[] = [];
      for (let j = 0; j < n; j++) {
        const th = ((j + 0.5) / n) * Math.PI * 2;
        const cx = Math.cos(th) * k(r.w);
        const cy = Math.sin(th) * k(r.d);
        ring.push([
          o[0] + u[0] * cx + v[0] * cy,
          o[1] + u[1] * cx + v[1] * cy,
          o[2] + u[2] * cx + v[2] * cy,
        ]);
      }
      return ring;
    });
    for (let i = 0; i < livery.length; i++) b.loft([rings[i], rings[i + 1]], livery[i], true);
    b.cap(rings[0], PAINT.visor, true);
    b.cap(rings[rings.length - 1], PAINT.helmet, false);
  }
  // THE CHIN BAR, jutting forward under the port: the one part of the shell
  // that says full-face from the side, and the reason the front reads as a
  // face guard rather than as a dark stripe.
  segment(
    b,
    add(add(headBase, scale(p.headUp, k(0.04))), scale(p.headFwd, k(0.06))),
    add(add(headBase, scale(p.headUp, k(0.025))), scale(p.headFwd, k(0.185))),
    p.headRight,
    [
      { t: 0, w: 0.09, d: 0.058 },
      { t: 0.45, w: 0.085, d: 0.055 },
      { t: 1, w: 0.062, d: 0.044 },
    ],
    FACETS.limb,
    PAINT.visor,
  );
  // THE PEAK: 0.15 m of blade over the brow, wider than the shell and
  // tilted up off it, thick enough at the root to read as a moulding
  // rather than as a wire when the camera catches it edge-on. Navy over,
  // white under — the underside is what a rider hanging into a turn shows
  // the camera.
  segment(
    b,
    add(add(headBase, scale(p.headUp, k(0.205))), scale(p.headFwd, k(0.1))),
    add(add(headBase, scale(p.headUp, k(0.26))), scale(p.headFwd, k(0.245))),
    p.headRight,
    [
      { t: 0, w: 0.118, d: 0.028 },
      { t: 1, w: 0.078, d: 0.015 },
    ],
    FACETS.peak,
    [PAINT.helmet, PAINT.helmet, PAINT.shellLow, PAINT.helmet],
  );

  // THE ARMS: the vest's shoulder, then bare, the fist round the grip.
  // Every limb here is a WIDE JOINT, a MUSCLE BELLY, then a NARROW JOINT —
  // a monotone taper from shoulder to wrist is a pipe, and a pipe is what
  // reads as a twig at sixty pixels. The belly's place along each segment
  // is the anatomical one (the biceps at mid-humerus, the flexor mass just
  // below the elbow), and the contrast between it and the joint either side
  // is what carries the tone; the absolute girths are an athletic man's
  // circumferences halved.
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const shoulder = p.shoulders[i];
    const elbow = p.elbows[i];
    const wrist = p.wrists[i];
    const hint: P = [side, -0.5, 0];
    const cuff = add(shoulder, scale(sub(elbow, shoulder), 0.24));
    segment(
      b,
      add(shoulder, scale(sub(shoulder, elbow), 0.08)),
      cuff,
      hint,
      // The deltoid cap, broad, into a sleeve hem that grips the arm.
      [
        { t: 0, w: 0.082, d: 0.078 },
        { t: 0.5, w: 0.076, d: 0.072 },
        { t: 1, w: 0.062, d: 0.06 },
      ],
      FACETS.limb,
      PAINT.vest,
      [true, false],
    );
    segment(
      b,
      cuff,
      elbow,
      hint,
      // Biceps and triceps at mid-humerus, then a bony elbow.
      [
        { t: 0, w: 0.058, d: 0.056 },
        { t: 0.42, w: 0.064, d: 0.061 },
        { t: 1, w: 0.046, d: 0.044 },
      ],
      FACETS.limb,
      PAINT.skin,
      [false, true],
    );
    segment(
      b,
      elbow,
      wrist,
      hint,
      // The forearm's flexor mass high, a narrow wrist to set it against.
      [
        { t: 0, w: 0.05, d: 0.048 },
        { t: 0.24, w: 0.058, d: 0.055 },
        { t: 0.62, w: 0.045, d: 0.043 },
        { t: 1, w: 0.032, d: 0.03 },
      ],
      FACETS.limb,
      PAINT.skin,
    );
    const bar = p.bars[i];
    const fist = sub(p.hands[i], scale(normalize(sub(p.hands[i], wrist)), k(0.015)));
    segment(
      b,
      sub(fist, scale(bar, k(0.05))),
      add(fist, scale(bar, k(0.045))),
      sub(wrist, p.hands[i]),
      // The knuckles fullest across the middle of the grip: a glove is a
      // ball round a bar, not a collar on one.
      [
        { t: 0, w: 0.04, d: 0.032 },
        { t: 0.5, w: 0.048, d: 0.038 },
        { t: 1, w: 0.04, d: 0.032 },
      ],
      FACETS.fist,
      PAINT.glove,
    );
  }

  // THE LEGS: the thigh two-tone, an orange pad over the knee, the guard's
  // stripe down the outside of the shin, a boot on the floor. The
  // quadriceps carry their bulk high and shed it hard into the knee, and
  // the calf's belly sits a quarter down the shin and is thicker
  // fore-and-aft than it is across — which is why the shin's `d` outruns
  // its `w` there.
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const hip = p.hips[i];
    const knee = p.knees[i];
    const ankle = p.ankles[i];
    const out: P = [side, 0.2, 0];
    const n = FACETS.limb;
    segment(
      b,
      hip,
      knee,
      out,
      [
        { t: 0, w: 0.102, d: 0.096 },
        { t: 0.32, w: 0.1, d: 0.094 },
        { t: 0.74, w: 0.076, d: 0.073 },
        { t: 1, w: 0.062, d: 0.059 },
      ],
      n,
      legPaint(n, PAINT.suit, PAINT.suitLight, PAINT.suitLight),
    );
    const shin = normalize(sub(ankle, knee));
    segment(
      b,
      sub(knee, scale(shin, k(0.035))),
      add(knee, scale(shin, k(0.05))),
      out,
      [
        { t: 0, w: 0.072, d: 0.07 },
        { t: 1, w: 0.076, d: 0.074 },
      ],
      n,
      PAINT.orange,
    );
    segment(
      b,
      knee,
      ankle,
      out,
      [
        { t: 0, w: 0.064, d: 0.064 },
        { t: 0.26, w: 0.07, d: 0.078 },
        { t: 0.6, w: 0.054, d: 0.058 },
        { t: 1, w: 0.036, d: 0.038 },
      ],
      n,
      legPaint(n, PAINT.suit, PAINT.suitLight, PAINT.orange),
    );
    // THE BOOT: a flat sole on the footwell floor, a rounded upper over it
    // and a cuff up the shin. The sole is the one part of the figure that
    // must be flat — a lofted ring resting on a floor either floats or
    // sinks into it, and a rider whose feet float is the first thing a
    // player sees.
    const floor = p.floors[i];
    const z = ankle[2];
    b.box(
      ankle[0] - k(0.05),
      floor,
      z - k(0.08),
      ankle[0] + k(0.05),
      floor + k(0.028),
      z + BODY.foot - k(0.08),
      PAINT.boot,
    );
    segment(
      b,
      [ankle[0], floor + k(0.075), z - k(0.062)],
      [ankle[0], floor + k(0.048), z + BODY.foot - k(0.09)],
      out,
      [
        { t: 0, w: 0.046, d: 0.048 },
        { t: 0.3, w: 0.052, d: 0.052 },
        { t: 0.72, w: 0.05, d: 0.04 },
        { t: 1, w: 0.038, d: 0.024 },
      ],
      n,
      PAINT.boot,
    );
    segment(
      b,
      add(ankle, scale(shin, k(-0.1))),
      add(ankle, scale(shin, k(0.02))),
      out,
      [
        { t: 0, w: 0.05, d: 0.05 },
        { t: 1, w: 0.048, d: 0.048 },
      ],
      n,
      PAINT.boot,
      [false, false],
    );
  }
}

export type Rider = {
  /** The figure, at the craft's origin: add it to the craft's group and it
   * pitches, rolls and heaves with the hull. */
  mesh: THREE.Mesh;
  /** Draw a given pose — the labs' way in. */
  pose: (p: RiderPose) => void;
  /** Once per engine step: the body's springs. */
  observe: (state: GameState) => void;
  /** Once per frame: pose from the state and redraw. */
  update: (state: GameState) => void;
  reset: () => void;
  dispose: () => void;
};

/** The rider for a cockpit, sat at rest until posed. */
export function createRider(cockpit: Cockpit): Rider {
  const builder = new Builder();
  const dynamics = createRiderDynamics();
  const draw = (p: RiderPose): void => {
    builder.reset();
    figure(builder, p);
  };
  draw(poseRider(cockpit, REST_READ));
  const geometry = builder.geometry();
  // A fixed bound: the figure never leaves the saddle, and a sphere
  // recomputed off every frame's triangles is a sphere computed for
  // nothing.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0.3), 1.6);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geometry, material);

  const pose = (p: RiderPose): void => {
    draw(p);
    builder.refresh(geometry);
  };

  return {
    mesh,
    pose,
    observe: (state) => dynamics.observe(state),
    update: (state) => {
      const visible = riderVisible(state);
      mesh.visible = visible;
      if (visible) pose(poseRider(cockpit, dynamics.read(state)));
    },
    reset: () => dynamics.reset(),
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
