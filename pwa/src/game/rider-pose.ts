// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER, as maths: where every joint of the figure on the saddle is,
// in the craft's body frame, given the deck it is stood on (`Cockpit`,
// from the craft builder) and a handful of readings off the engine. No
// three.js and no DOM, so the root suite can hold the pose to its rules
// — the hands on the grips that are drawn, the feet on the footwell
// floor, the torso leaning the way the inputs say — without a browser;
// rider.ts turns the joints into triangles.
//
// HOW THE FIGURE IS POSED. The pelvis goes on the seat (or, on a stand-up,
// over the tray at a crouch); the torso leans forward from it by an angle
// the throttle, the pace and the rider's own lean decide, and rolls into a
// turn; the hands are ON THE GRIPS, always, so each arm is solved back
// from its grip to its shoulder (two-bone IK, the elbow out and down), and
// if the shoulders cannot reach, the torso leans further until they can —
// which is why a rider leaning back sits with straight arms, the way a
// real one does. The feet stand in the footwells and the knees are solved
// the same way, up and out. The head follows the torso only partly and
// turns into the turn.
//
// WHAT MOVES IT. Everything deliberate is a `CraftState` field the engine
// wrote — `riderAft` and `riderRight` are where the engine has put the
// rider's MASS, so the drawn lean is the lean the physics is feeling, and
// `throttleEff` and `speed` say how far into the wind to tuck. Everything
// involuntary is the body as a mass on springs (`createRiderDynamics`):
// the torso swings back when the pump opens and forward when a rock is
// hit, lags the hull's pitching and rolling by a share, compresses when
// the hull slams up under it and rises off the seat when the hull falls
// away in the air — each a damped spring at a human's own postural
// frequency, driven by the hull's accelerations, stepped once per engine
// step so a scene pre-rolled for a screenshot shows the same body.
//
// SIGNS. The engine's body rates are right-handed about the craft's right
// and forward axes, so the hull's nose-up pitch rate is −wx and its
// right-side-down roll rate is −wz. `lean` is the torso's pitch FORWARD
// from the vertical; `roll` is right-side-down.

import { TUNING, topSpeedOf, type CraftSpec, type GameState } from "@engine";

import { clamp } from "../lib/util.ts";
import type { Cockpit } from "./craft-body.ts";

export type P = [number, number, number];

/** The figure's dimensions, m: a man of about 1.8 m, the segments the way
 * an anthropometric table gives them for one. The rider's mass and where
 * it sits are the spec's (`riderMass`, `riderHeight`), not these. */
export const BODY = {
  /** The hip joints either side of the pelvis' centre. */
  hipHalf: 0.1,
  /** The pelvis' centre over the seat's surface when sat. */
  pelvis: 0.1,
  /** Pelvis centre to shoulder centre, along the spine. */
  torso: 0.5,
  shoulderHalf: 0.21,
  /** Shoulder centre to the helmet's base, and the helmet's height. */
  neck: 0.07,
  helmet: 0.28,
  upperArm: 0.31,
  /** Elbow to the fist's centre on the grip, and how far short of the
   * grip the wrist is. */
  forearm: 0.33,
  fist: 0.06,
  thigh: 0.44,
  shin: 0.42,
  foot: 0.25,
  /** The ankle over the floor the boot stands on. */
  sole: 0.05,
} as const;

/** The stance, in numbers. */
export const STANCE = {
  /** The torso's lean forward from the vertical, rad, sat at idle and
   * stood at idle; what opening the throttle adds; what pace adds at top
   * speed. The reach to the grips may push any of these further. */
  seatedLean: 0.72,
  standingLean: 0.82,
  throttleLean: 0.22,
  paceLean: 0.16,
  leanMin: -0.2,
  leanMax: 1.22,
  /** THE RIDER'S LEAN (`riderAft`, m): the pelvis slides along the seat
   * by this share of it, and the torso pitches by this much per metre —
   * the rest of the mass shift is the arms straightening. */
  slideAft: 0.25,
  leanPerMetre: 1.2,
  /** THE TURN (`riderRight`, m): the pelvis slides sideways by this share,
   * the torso rolls into it by this much per metre, and the head turns
   * through it by this much per metre. */
  slideRight: 0.7,
  rollPerMetre: 1.8,
  headTurnPerMetre: 1.8,
  /** THE FEET, sat: ahead of the pelvis, m, and out from the pedestal's
   * flank into the footwell, m. */
  feetAhead: 0.32,
  feetOut: 0.12,
  /** STANDING: where along the tray the feet go (a share of its length),
   * how far behind the ankles the pelvis hangs, m, and the crouch — the
   * standing height as a share of the legs' length — and what the
   * throttle takes off it. */
  standAt: 0.5,
  standBack: 0.12,
  crouch: 0.78,
  crouchThrottle: 0.08,
  /** THE HEAD: how much of the torso's lean it follows (the rest is the
   * neck looking up), and the up-look on top of that, rad. */
  headFollow: 0.3,
  headUp: 0.15,
  /** THE CRUSH (m, from the dynamics): a compression folds the torso by
   * this much per metre; an extension lifts the pelvis off the seat by
   * its full amount. */
  foldPerCrush: 2,
} as const;

/** The body on its springs. Each spring is stated by its natural frequency
 * and its SUSTAINED response — what a steady 1 m/s² does to it — so the
 * gains read as postures rather than as stiffnesses. */
export const DYNAMICS = {
  /** Natural frequencies, Hz — a human's postural response is a hair over
   * a hertz — and the damping ratio, a little under critical. */
  pitchHz: 1.3,
  rollHz: 1.6,
  crushHz: 2,
  zeta: 0.55,
  /** The torso's swing BACK per m/s² of surge, rad, sustained. */
  bobPerSurge: 0.03,
  /** The body's compression per m/s² of the hull accelerating up under
   * it, m, sustained — which in free fall is a rise of 0.08 m off the
   * seat. */
  crushPerAccel: 0.008,
  /** What share of a CHANGE in the hull's pitch and roll rate the torso
   * fails to follow — the lag that makes a wave taken at speed read in
   * the body. */
  followShare: 0.5,
  /** A solid hit: the lurch forward, rad/s per m/s of closing speed, and
   * its ceiling; the ground is gentler. */
  hitLurch: 0.15,
  hitLurchMax: 2.5,
  groundLurch: 0.08,
  groundLurchMax: 1.2,
  /** The clamps: where the body bottoms out. */
  bobMax: 0.5,
  swayMax: 0.4,
  crushMin: -0.1,
  crushMax: 0.16,
} as const;

/** What the pose is built from — the engine's readings, and the springs'. */
export type RiderRead = {
  /** `riderAft` and `riderRight`, m. */
  aft: number;
  right: number;
  /** `throttleEff`, 0..1, and the speed as a share of the top speed. */
  throttle: number;
  pace: number;
  airborne: boolean;
  /** The springs: the torso's pitch forward and roll right relative to the
   * stance, rad, and the body's compression, m. */
  bob: number;
  sway: number;
  crush: number;
};

/** A rider sat still at idle. */
export const REST_READ: RiderRead = {
  aft: 0,
  right: 0,
  throttle: 0,
  pace: 0,
  airborne: false,
  bob: 0,
  sway: 0,
  crush: 0,
};

/** Every joint, body frame, m. Pairs are [left, right]. */
export type RiderPose = {
  pelvis: P;
  /** The pelvis' own up: it rolls with the torso but does not pitch —
   * it is sat on the seat. */
  pelvisUp: P;
  torsoUp: P;
  torsoRight: P;
  torsoFwd: P;
  /** The shoulder centre. */
  chest: P;
  shoulders: [P, P];
  elbows: [P, P];
  wrists: [P, P];
  /** The fists' centres: the grips. */
  hands: [P, P];
  /** The bar's direction through each grip, outward. */
  bars: [P, P];
  hips: [P, P];
  knees: [P, P];
  ankles: [P, P];
  /** The floor under each foot. */
  floors: [number, number];
  /** The helmet's base, and the head's frame. */
  neck: P;
  headUp: P;
  headRight: P;
  headFwd: P;
  /** The torso's lean forward from the vertical, rad, as posed. */
  lean: number;
};

export const add = (a: P, b: P): P => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: P, b: P): P => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: P, s: number): P => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: P, b: P): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: P, b: P): P => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a: P): number => Math.hypot(a[0], a[1], a[2]);
export function normalize(a: P): P {
  const l = length(a);
  return l > 1e-9 ? scale(a, 1 / l) : [0, 1, 0];
}
/** `a` with its component along the unit `axis` removed, normalized. */
function perpendicular(a: P, axis: P): P {
  const p = sub(a, scale(axis, dot(a, axis)));
  if (length(p) < 1e-6) {
    const seed: P = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    return normalize(sub(seed, scale(axis, dot(seed, axis))));
  }
  return normalize(p);
}

/** Two-bone IK: the middle joint of a limb of lengths `l1`, `l2` rooted at
 * `a` reaching for `t`, bending toward `pole`. A target out of reach is
 * pulled in to the limb's length along the line — the limb is then
 * straight and `end` is where it got to. */
export function solveLimb(a: P, t: P, l1: number, l2: number, pole: P): { mid: P; end: P } {
  const d = sub(t, a);
  const dist = length(d);
  const dir: P = dist > 1e-6 ? scale(d, 1 / dist) : [0, -1, 0];
  const reach = clamp(dist, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  const end = add(a, scale(dir, reach));
  const cosA = clamp((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach), -1, 1);
  const sinA = Math.sqrt(1 - cosA * cosA);
  const perp = perpendicular(pole, dir);
  const mid = add(a, add(scale(dir, l1 * cosA), scale(perp, l1 * sinA)));
  return { mid, end };
}

const SIDES: readonly (-1 | 1)[] = [-1, 1];

/** The pose, from the deck and the readings. */
export function poseRider(cockpit: Cockpit, read: RiderRead): RiderPose {
  const { seat, grip, wells, standUp } = cockpit;
  const roll = STANCE.rollPerMetre * read.right + read.sway;
  const fold = STANCE.foldPerCrush * Math.max(0, read.crush);
  const rise = Math.max(0, -read.crush);
  let lean =
    (standUp ? STANCE.standingLean : STANCE.seatedLean) +
    STANCE.throttleLean * read.throttle +
    STANCE.paceLean * read.pace -
    STANCE.leanPerMetre * read.aft +
    read.bob +
    fold;
  lean = clamp(lean, STANCE.leanMin, STANCE.leanMax);

  // THE PELVIS: on the seat, or over the tray at a crouch.
  let pelvis: P;
  let ankleZ: number;
  if (standUp) {
    ankleZ = wells.z0 + STANCE.standAt * (wells.z1 - wells.z0);
    const legs = BODY.thigh + BODY.shin;
    const stand = clamp(
      legs * (STANCE.crouch - STANCE.crouchThrottle * read.throttle) - read.crush,
      legs * 0.5,
      legs * 0.97,
    );
    pelvis = [
      STANCE.slideRight * read.right,
      wells.floorAt(ankleZ) + stand,
      ankleZ - STANCE.standBack - STANCE.slideAft * read.aft,
    ];
  } else {
    pelvis = [
      STANCE.slideRight * read.right,
      seat.y + BODY.pelvis + rise,
      seat.z - STANCE.slideAft * read.aft,
    ];
  }

  // THE TORSO'S FRAME, and the reach: lean further until both shoulders
  // can reach their grips, and when the torso is as far forward as it
  // goes, slide the pelvis up the bucket toward the bars.
  const hands: [P, P] = [
    [-grip.x, grip.y, grip.z],
    [grip.x, grip.y, grip.z],
  ];
  const reach = BODY.upperArm + BODY.forearm - 0.005;
  let torsoUp: P = [0, 1, 0];
  let torsoRight: P = [1, 0, 0];
  let chest: P = pelvis;
  let shoulders: [P, P] = [pelvis, pelvis];
  for (let i = 0; i < 40; i++) {
    const cl = Math.cos(lean);
    const sl = Math.sin(lean);
    const cr = Math.cos(roll);
    const sr = Math.sin(roll);
    torsoUp = [cl * sr, cl * cr, sl];
    torsoRight = [cr, -sr, 0];
    chest = add(pelvis, scale(torsoUp, BODY.torso));
    shoulders = [
      sub(chest, scale(torsoRight, BODY.shoulderHalf)),
      add(chest, scale(torsoRight, BODY.shoulderHalf)),
    ];
    const short =
      length(sub(hands[0], shoulders[0])) > reach || length(sub(hands[1], shoulders[1])) > reach;
    if (!short) break;
    if (lean < STANCE.leanMax) lean = Math.min(STANCE.leanMax, lean + 0.03);
    else if (!standUp && pelvis[2] < seat.zMax) pelvis[2] = Math.min(seat.zMax, pelvis[2] + 0.02);
    else break;
  }
  const torsoFwd = cross(torsoRight, torsoUp);
  const pelvisUp: P = [Math.sin(roll), Math.cos(roll), 0];
  if (!standUp) ankleZ = clamp(pelvis[2] + STANCE.feetAhead, wells.z0 + 0.15, wells.z1 - 0.25);

  // THE ARMS, solved back from the grips: the elbows out and down.
  const elbows: [P, P] = [pelvis, pelvis];
  const wrists: [P, P] = [pelvis, pelvis];
  const bars: [P, P] = [
    [-grip.dx, grip.dy, grip.dz],
    [grip.dx, grip.dy, grip.dz],
  ];
  SIDES.forEach((side, i) => {
    const pole: P = [side * 1, -0.6, -0.25];
    const { mid } = solveLimb(shoulders[i], hands[i], BODY.upperArm, BODY.forearm, pole);
    elbows[i] = mid;
    wrists[i] = sub(hands[i], scale(normalize(sub(hands[i], mid)), BODY.fist));
  });

  // THE LEGS: the feet in the footwells, the knees up and out.
  const hips: [P, P] = [
    [pelvis[0] - BODY.hipHalf, pelvis[1], pelvis[2]],
    [pelvis[0] + BODY.hipHalf, pelvis[1], pelvis[2]],
  ];
  const knees: [P, P] = [pelvis, pelvis];
  const ankles: [P, P] = [pelvis, pelvis];
  const floors: [number, number] = [0, 0];
  SIDES.forEach((side, i) => {
    const floor = wells.floorAt(ankleZ);
    floors[i] = floor;
    ankles[i] = [side * (wells.inner + STANCE.feetOut), floor + BODY.sole, ankleZ];
    // Sat, the knees come up beside the saddle and grip it; stood, they
    // point forward.
    const pole: P = standUp ? [side * 0.15, 0.2, 1] : [side * 0.35, 0.8, 0.45];
    knees[i] = solveLimb(hips[i], ankles[i], BODY.thigh, BODY.shin, pole).mid;
  });

  // THE HEAD: on the neck, pitched back up toward the horizon, turned
  // into the turn.
  const neck = add(chest, scale(torsoUp, BODY.neck));
  const headPitch = STANCE.headFollow * lean - STANCE.headUp;
  const yaw = STANCE.headTurnPerMetre * read.right;
  const headUp: P = [
    Math.cos(headPitch) * Math.sin(roll),
    Math.cos(headPitch) * Math.cos(roll),
    Math.sin(headPitch),
  ];
  const headFwd = perpendicular([Math.sin(yaw), 0, Math.cos(yaw)], headUp);
  const headRight = cross(headUp, headFwd);

  return {
    pelvis,
    pelvisUp,
    torsoUp,
    torsoRight,
    torsoFwd,
    chest,
    shoulders,
    elbows,
    wrists,
    hands,
    bars,
    hips,
    knees,
    ankles,
    floors,
    neck,
    headUp,
    headRight,
    headFwd,
    lean,
  };
}

/** Whether the rider is on the craft at all: not while the hull lies on
 * its back or is being righted — the rider is in the water beside it,
 * and nothing draws that yet. */
export function riderVisible(state: GameState): boolean {
  const c = state.craft;
  return !(c.righting > 0 || c.capsizedFor > 0);
}

export type RiderDynamics = {
  /** Once per engine step: advance the springs by the engine's own dt. */
  observe: (state: GameState) => void;
  /** The readings the pose is built from, as of the last step. */
  read: (state: GameState) => RiderRead;
  reset: () => void;
};

/** The body on its springs, driven by the hull's accelerations. */
export function createRiderDynamics(): RiderDynamics {
  const dt = TUNING.dt;
  let bob = 0;
  let bobV = 0;
  let sway = 0;
  let swayV = 0;
  let crush = 0;
  let crushV = 0;
  let primed = false;
  let pVy = 0;
  let pSpeed = 0;
  let pWx = 0;
  let pWz = 0;
  let topFor: CraftSpec | null = null;
  let top = 1;

  const omega = (hz: number) => 2 * Math.PI * hz;
  /** One semi-implicit step of a damped spring: the new velocity. */
  const spring = (x: number, v: number, hz: number, drive: number): number => {
    const w = omega(hz);
    return v + (-w * w * x - 2 * DYNAMICS.zeta * w * v + drive) * dt;
  };

  const reset = (): void => {
    bob = bobV = sway = swayV = crush = crushV = 0;
    primed = false;
  };

  const observe = (state: GameState): void => {
    const c = state.craft;
    for (const e of state.events) {
      if (e.kind === "reset") reset();
      else if (e.kind === "hit")
        bobV += Math.min(DYNAMICS.hitLurchMax, DYNAMICS.hitLurch * e.speed);
      else if (e.kind === "ground")
        bobV += Math.min(DYNAMICS.groundLurchMax, DYNAMICS.groundLurch * e.speed);
    }
    if (!primed) {
      pVy = c.vy;
      pSpeed = c.speed;
      pWx = c.wx;
      pWz = c.wz;
      primed = true;
      return;
    }
    const ay = (c.vy - pVy) / dt;
    const surge = (c.speed - pSpeed) / dt;
    const pitchAcc = (c.wx - pWx) / dt;
    const rollAcc = (c.wz - pWz) / dt;
    pVy = c.vy;
    pSpeed = c.speed;
    pWx = c.wx;
    pWz = c.wz;

    const wp = omega(DYNAMICS.pitchHz);
    const wc = omega(DYNAMICS.crushHz);
    bobV = spring(
      bob,
      bobV,
      DYNAMICS.pitchHz,
      -DYNAMICS.bobPerSurge * wp * wp * surge - DYNAMICS.followShare * pitchAcc,
    );
    swayV = spring(sway, swayV, DYNAMICS.rollHz, DYNAMICS.followShare * rollAcc);
    crushV = spring(crush, crushV, DYNAMICS.crushHz, DYNAMICS.crushPerAccel * wc * wc * ay);
    bob += bobV * dt;
    sway += swayV * dt;
    crush += crushV * dt;
    if (Math.abs(bob) > DYNAMICS.bobMax) {
      bob = Math.sign(bob) * DYNAMICS.bobMax;
      bobV = 0;
    }
    if (Math.abs(sway) > DYNAMICS.swayMax) {
      sway = Math.sign(sway) * DYNAMICS.swayMax;
      swayV = 0;
    }
    if (crush < DYNAMICS.crushMin) {
      crush = DYNAMICS.crushMin;
      crushV = 0;
    } else if (crush > DYNAMICS.crushMax) {
      crush = DYNAMICS.crushMax;
      crushV = 0;
    }
  };

  const read = (state: GameState): RiderRead => {
    const c = state.craft;
    if (c.spec !== topFor) {
      topFor = c.spec;
      top = topSpeedOf(c.spec);
    }
    return {
      aft: c.riderAft,
      right: c.riderRight,
      throttle: c.throttleEff,
      pace: clamp(c.speed / top, 0, 1),
      airborne: c.airborne,
      bob,
      sway,
      crush,
    };
  };

  return { observe, read, reset };
}
