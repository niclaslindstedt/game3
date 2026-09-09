// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER, drawn: a low-poly man on the saddle in a wetsuit, a life vest
// and a full-face helmet, a hand on each grip and a boot in each footwell,
// built from the joints rider-pose.ts places. He is judged from BEHIND —
// that is where the chase camera is — so what reads there is what the
// figure spends its triangles on: the back of the vest a clear step
// lighter than the seat under it with two orange straps over the
// shoulders, the helmet's orange crown, bare arms out to the bars, and
// the orange stripe down the outside of each shin where the legs show
// beside the hull.
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
  /** The straps, the shin guards, the knee pads, the helmet's crown and
   * its peak. */
  orange: 0xe8702a,
  glove: 0x4a5057,
  boot: 0x16191c,
  helmet: 0x101315,
  visor: 0x2c3238,
};

/** A cross-section along a segment: at `t` of its length, half-axes `w`
 * (toward the segment's `hint` direction) and `d` (across it). */
type Ring = { t: number; w: number; d: number };

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
 * axis × hint, so for a torso whose hint is its right, panels 0–2 of
 * eight are the back and 4–6 the front. The rings turn right-handed about
 * the axis and the caps face away from each other. */
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
    const o = add(a, scale(sub(to, a), r.t));
    const ring: P[] = [];
    for (let k = 0; k < n; k++) {
      const th = ((k + 0.5) / n) * Math.PI * 2;
      const cx = Math.cos(th) * r.w;
      const cy = Math.sin(th) * r.d;
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

/** Eight panels: the back three, a side, the front three, a side. */
function torsoPaint(back: number, front: number, side: number): number[] {
  return [back, back, back, side, front, front, front, side];
}

/** The whole figure, from its joints. The order is fixed: the per-facet
 * brightness hash is keyed on it, and a refresh keeps the colours. */
function figure(b: Builder, p: RiderPose): void {
  const up = p.torsoUp;
  const right = p.torsoRight;
  const fwd = p.torsoFwd;
  const at = (o: P, dUp: number, dRight: number, dFwd: number): P =>
    add(add(add(o, scale(up, dUp)), scale(right, dRight)), scale(fwd, dFwd));

  // THE PELVIS — upright on the seat whatever the torso does, so it sits
  // ON the saddle rather than tipping off its front — and THE TORSO, the
  // vest over it with its back panel lighter and a strap over each
  // shoulder, and the band at its hem covering the join.
  segment(
    b,
    add(p.pelvis, scale(p.pelvisUp, -(BODY.pelvis - 0.01))),
    add(p.pelvis, scale(p.pelvisUp, 0.07)),
    right,
    [
      { t: 0, w: 0.15, d: 0.1 },
      { t: 1, w: 0.165, d: 0.115 },
    ],
    8,
    PAINT.suit,
  );
  segment(
    b,
    at(p.pelvis, 0.06, 0, 0),
    at(p.chest, 0.04, 0, 0),
    right,
    [
      { t: 0, w: 0.16, d: 0.11 },
      { t: 0.5, w: 0.175, d: 0.125 },
      { t: 1, w: 0.215, d: 0.125 },
    ],
    8,
    torsoPaint(PAINT.vestBack, PAINT.vest, PAINT.vest),
    [false, true],
  );
  segment(
    b,
    at(p.pelvis, 0.06, 0, 0),
    at(p.pelvis, 0.13, 0, 0),
    right,
    [
      { t: 0, w: 0.172, d: 0.122 },
      { t: 1, w: 0.176, d: 0.128 },
    ],
    8,
    PAINT.orange,
    [false, false],
  );
  for (const side of [-1, 1]) {
    segment(
      b,
      at(p.chest, 0.05, side * 0.11, -0.1),
      at(p.pelvis, 0.15, side * 0.06, -0.125),
      fwd,
      [
        { t: 0, w: 0.02, d: 0.032 },
        { t: 1, w: 0.02, d: 0.03 },
      ],
      4,
      PAINT.orange,
    );
  }

  // THE NECK and THE HELMET: a full-face shell, its visor and chin bar the
  // front, its crown orange, a peak over the visor.
  segment(
    b,
    at(p.chest, 0.02, 0, 0.02),
    add(p.neck, scale(up, 0.03)),
    right,
    [
      { t: 0, w: 0.055, d: 0.05 },
      { t: 1, w: 0.05, d: 0.05 },
    ],
    6,
    PAINT.skin,
    [false, false],
  );
  const headBase = add(p.neck, scale(p.headFwd, 0.03));
  const crown = add(headBase, scale(p.headUp, BODY.helmet));
  {
    const axis = p.headUp;
    const u = across(p.headRight, axis);
    const v = cross(axis, u);
    // Lofted by hand so the crown's cap can be its own colour.
    const rings: P[][] = [
      { t: 0, w: 0.085, d: 0.1 },
      { t: 0.3, w: 0.105, d: 0.125 },
      { t: 0.72, w: 0.1, d: 0.12 },
      { t: 1, w: 0.045, d: 0.06 },
    ].map((r) => {
      const o = add(headBase, scale(sub(crown, headBase), r.t));
      const ring: P[] = [];
      for (let k = 0; k < 8; k++) {
        const th = ((k + 0.5) / 8) * Math.PI * 2;
        const cx = Math.cos(th) * r.w;
        const cy = Math.sin(th) * r.d;
        ring.push([
          o[0] + u[0] * cx + v[0] * cy,
          o[1] + u[1] * cx + v[1] * cy,
          o[2] + u[2] * cx + v[2] * cy,
        ]);
      }
      return ring;
    });
    b.loft(rings, torsoPaint(PAINT.helmet, PAINT.visor, PAINT.helmet), true);
    b.cap(rings[0], PAINT.helmet, true);
    b.cap(rings[rings.length - 1], PAINT.orange, false);
  }
  segment(
    b,
    add(add(headBase, scale(p.headUp, 0.17)), scale(p.headFwd, 0.09)),
    add(add(headBase, scale(p.headUp, 0.22)), scale(p.headFwd, 0.16)),
    p.headRight,
    [
      { t: 0, w: 0.1, d: 0.018 },
      { t: 1, w: 0.07, d: 0.014 },
    ],
    4,
    PAINT.orange,
  );

  // THE ARMS: the vest's shoulder, then bare, the fist round the grip.
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
      [
        { t: 0, w: 0.075, d: 0.07 },
        { t: 1, w: 0.066, d: 0.062 },
      ],
      6,
      PAINT.vest,
      [true, false],
    );
    segment(
      b,
      cuff,
      elbow,
      hint,
      [
        { t: 0, w: 0.06, d: 0.058 },
        { t: 1, w: 0.05, d: 0.048 },
      ],
      6,
      PAINT.skin,
      [false, true],
    );
    segment(
      b,
      elbow,
      wrist,
      hint,
      [
        { t: 0, w: 0.052, d: 0.05 },
        { t: 0.35, w: 0.05, d: 0.048 },
        { t: 1, w: 0.04, d: 0.038 },
      ],
      6,
      PAINT.skin,
    );
    const bar = p.bars[i];
    const fist = sub(p.hands[i], scale(normalize(sub(p.hands[i], wrist)), 0.015));
    segment(
      b,
      sub(fist, scale(bar, 0.045)),
      add(fist, scale(bar, 0.045)),
      sub(wrist, p.hands[i]),
      [
        { t: 0, w: 0.045, d: 0.035 },
        { t: 1, w: 0.045, d: 0.035 },
      ],
      4,
      PAINT.glove,
    );
  }

  // THE LEGS: the thigh two-tone, an orange pad over the knee, the guard's
  // stripe down the outside of the shin, a boot on the floor.
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? -1 : 1;
    const hip = p.hips[i];
    const knee = p.knees[i];
    const ankle = p.ankles[i];
    const out: P = [side, 0.2, 0];
    segment(
      b,
      hip,
      knee,
      out,
      [
        { t: 0, w: 0.085, d: 0.08 },
        { t: 0.75, w: 0.075, d: 0.072 },
        { t: 1, w: 0.062, d: 0.06 },
      ],
      6,
      [PAINT.suitLight, PAINT.suit, PAINT.suit, PAINT.suit, PAINT.suitLight, PAINT.suitLight],
    );
    const shin = normalize(sub(ankle, knee));
    segment(
      b,
      sub(knee, scale(shin, 0.035)),
      add(knee, scale(shin, 0.05)),
      out,
      [
        { t: 0, w: 0.068, d: 0.066 },
        { t: 1, w: 0.072, d: 0.07 },
      ],
      6,
      PAINT.orange,
    );
    segment(
      b,
      knee,
      ankle,
      out,
      [
        { t: 0, w: 0.07, d: 0.068 },
        { t: 0.3, w: 0.067, d: 0.066 },
        { t: 1, w: 0.05, d: 0.048 },
      ],
      6,
      [PAINT.suitLight, PAINT.suit, PAINT.suit, PAINT.suit, PAINT.suitLight, PAINT.orange],
    );
    const floor = p.floors[i];
    b.box(
      ankle[0] - 0.05,
      floor,
      ankle[2] - 0.07,
      ankle[0] + 0.05,
      floor + 0.11,
      ankle[2] + BODY.foot - 0.07,
      PAINT.boot,
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
