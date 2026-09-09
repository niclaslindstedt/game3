// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMERA, as maths. Two rigs, walked with the camera key:
//
//   chase — behind and above the craft, LOW: the Wave Race read, where a
//           swell coming at the hull fills the bottom of the frame and the
//           horizon rides high. It eases with speed (further back, wider
//           lens), looks THROUGH a turn toward where the nose is going,
//           keeps the horizon level whatever the hull is doing (it stands
//           in the world, not on the deck, and its height is sprung so a
//           wave under the craft is not a wave under the lens), and in the
//           air it tracks the flight rather than the water the craft left.
//   nose  — on the craft's own handlebars, looking down the bow. Bolted on,
//           so it goes with the hull — but only partly: the pitch and the
//           roll it carries are DAMPED, because a lens that takes every
//           degree of a hull on chop is a picture nobody can read.
//
// DOM-free and three-free on purpose: this module turns a `GameState` into
// a POSE — an eye, an aim point, a lens and a roll — and `renderer.ts`
// applies it to the three.js camera in four lines. That split is what lets
// the root suite drive the rig through a carve and a launch and hold it to
// the framing rules (tests/camera_test.ts) without a browser.
//
// AXES: the engine's frame (x east, z north, y up, heading 0 = +z growing
// toward +x) maps straight onto three.js's — both right-handed, both y-up
// — so nothing here flips a sign. The one flip in the app is
// `SCREEN_TO_ENGINE` in input-model.ts.

import { angleDiff, rotate, type GameState } from "@engine";

import { clamp } from "../lib/util.ts";

export type CameraMode = "chase" | "nose";
/** The modes the camera key walks, in order. */
export const CAMERA_MODES: readonly CameraMode[] = ["chase", "nose"];

/** Where the lens stands, what it looks at, and how wide it is. `fov` is
 * the DESIGN (landscape) vertical field, deg — the renderer widens it for a
 * narrow viewport with `verticalFovFor`. `roll` is the lens's own bank about
 * its line of sight, rad, right side down positive. */
export type CameraPose = {
  x: number;
  y: number;
  z: number;
  aimX: number;
  aimY: number;
  aimZ: number;
  fov: number;
  roll: number;
};

/** The chase rig, in numbers. */
export const CHASE = {
  /** Standoff behind the craft at a standstill, m, and the metres added per
   * m/s of pace — the boom straining ahead as the pump opens. */
  dist: 5.6,
  distPerSpeed: 0.06,
  /** Height over the craft's SPRUNG height, m, and what pace adds. Low: a
   * jet ski is a metre tall, and a lens two metres over it already looks
   * down on the water it is riding; the swell has to be in the frame as a
   * wall coming at the hull, not a texture under it. */
  height: 1.9,
  heightPerSpeed: 0.012,
  /** How far ahead of the craft the aim point sits, m, and how high over
   * the sprung height. Aiming at the water ahead rather than at the hull is
   * what puts the horizon in the top third and the craft at the bottom. */
  aimAhead: 9,
  aimHeight: 0.45,
  /** Design lens at rest, deg, what a m/s adds, and the ceiling before the
   * sea turns into a tunnel. */
  fov: 60,
  fovPerSpeed: 0.75,
  fovMax: 84,
  /** How briskly the yaw follows the nose, 1/s — the one knob for how heavy
   * the rig is. Halved in the air, so the framing goes loose while the
   * craft is ballistic. */
  followRate: 4.5,
  /** LOOKING THROUGH THE TURN: how far the aim point slides toward the
   * inside per rad/s of yaw rate, m, and the most it may. */
  lookThrough: 3.2,
  lookThroughMax: 4,
  /** How much of the slip angle (travel against nose) the framing carries,
   * 0..1, and the ceiling it eases onto, rad. A hull sliding across the
   * water shows across the frame; past the ceiling the shot would be
   * looking at the hull's flank instead of where it is going. */
  slipWeight: 0.6,
  slipMax: 0.35,
  /** The HEIGHT SPRING: how fast the sprung height follows the craft's own
   * y, 1/s, afloat and in the air. Slow afloat — a wave under the hull is
   * not a wave under the lens — and quick in the air, so a launch is
   * tracked and a fall is followed down. */
  heightFollow: 2.2,
  heightFollowAir: 7,
  /** In the air the aim and the lens climb toward the craft itself, this
   * share of its height over the sprung water line — the flight is the
   * shot, and the shot stays on the craft. */
  airAim: 0.85,
  airLift: 0.4,
  /** The lens never goes under the sea: it is held this far over the
   * surface under it, m. */
  clearance: 0.7,
} as const;

/** The nose rig. */
export const NOSE = {
  /** Where the eye sits on the craft, body metres: over the handlebars,
   * a touch forward of the centre of gravity. */
  up: 0.72,
  forward: 0.35,
  /** How far ahead the aim point sits, m. */
  aimAhead: 12,
  /** How much of the hull's pitch and roll the eye takes, 0..1 — the rest
   * is the rider's neck levelling their head against the deck. */
  pitchShare: 0.45,
  rollShare: 0.35,
  fov: 68,
  fovPerSpeed: 0.5,
  fovMax: 90,
} as const;

/** Wrap-safe angle easing. */
function angleLerp(a: number, b: number, t: number): number {
  return a + angleDiff(a, b) * t;
}

/** Soft ceiling: linear well under `max`, easing onto it, never arriving. */
function soften(v: number, max: number): number {
  return max * Math.tanh(v / max);
}

/** Aspect ratio the fov numbers are tuned against (landscape). */
export const REF_ASPECT = 16 / 9;
/** Vertical fov ceiling on narrow viewports, deg — where hor+ stops before
 * a phone held upright turns into a fisheye. */
export const MAX_VFOV = 108;

/** three.js's fov is VERTICAL, so a fixed number collapses the horizontal
 * field on a phone held upright, and every degree of yaw sweeps three
 * times more of the frame than it does in landscape. Below the reference
 * aspect the HORIZONTAL field is held instead (hor+), capped. */
export function verticalFovFor(designFov: number, aspect: number): number {
  if (!(aspect < REF_ASPECT)) return designFov;
  const halfH = Math.atan(Math.tan((designFov * Math.PI) / 360) * REF_ASPECT);
  return Math.min(MAX_VFOV, (Math.atan(Math.tan(halfH) / aspect) * 360) / Math.PI);
}

export type CameraRig = {
  /** Advance the rig by `dt` seconds of the given state and read the pose.
   * `surfaceY` answers the sea's height under a plan point — the chase
   * lens's floor; the app hands it the engine's `heightAt`. */
  update: (state: GameState, dt: number, surfaceY: (x: number, z: number) => number) => CameraPose;
  /** The pose from the last update. */
  pose: () => CameraPose;
  mode: () => CameraMode;
  setMode: (mode: CameraMode) => void;
  /** Walk to the next mode. */
  cycle: () => CameraMode;
  /** Forget every eased quantity: the next update stands the lens in one
   * frame. For a restart, a reset, a staged moment — there is no framing
   * worth keeping across a teleport. */
  restand: () => void;
};

export function createCameraRig(initial: CameraMode = "chase"): CameraRig {
  let mode: CameraMode = initial;
  let restand = true;
  // The chase rig's eased quantities.
  let yaw = 0;
  let slip = 0;
  let look = 0;
  let sprungY = 0;
  let airY = 0;
  let dist = CHASE.dist;
  let height = CHASE.height;
  let fov = CHASE.fov;
  // The nose rig's.
  let nosePitch = 0;
  let noseRoll = 0;
  let noseFov = NOSE.fov;
  const pose: CameraPose = { x: 0, y: 0, z: 0, aimX: 0, aimY: 0, aimZ: 1, fov: 60, roll: 0 };
  const body = { x: 0, y: 0, z: 0 };

  const chase = (state: GameState, dt: number, surfaceY: (x: number, z: number) => number) => {
    const c = state.craft;
    const ease = (rate: number): number => (restand ? 1 : clamp(rate * dt, 0, 1));
    if (restand) {
      yaw = c.heading;
      slip = 0;
      look = 0;
      sprungY = c.y;
      airY = 0;
    }
    // The yaw follows the nose, loosely in the air. The slip carries the
    // travel direction into the framing while the hull is being carried
    // sideways across the water — never in the air, where the nose and the
    // travel come apart on purpose and the shot's job is the landing.
    const planSpeed = Math.hypot(c.vx, c.vz);
    const travel = planSpeed > 3 ? Math.atan2(c.vx, c.vz) : c.heading;
    const wantSlip = c.airborne ? 0 : soften(angleDiff(c.heading, travel) * CHASE.slipWeight, CHASE.slipMax);
    slip += (wantSlip - slip) * ease(CHASE.followRate);
    yaw = angleLerp(yaw, c.heading, ease(c.airborne ? CHASE.followRate * 0.5 : CHASE.followRate));
    const aimYaw = yaw + slip;

    // The sprung height: the craft's own y, followed slowly afloat and
    // quickly in the air, so a chop is smoothed out and a launch is not.
    sprungY += (c.y - sprungY) * ease(c.airborne ? CHASE.heightFollowAir : CHASE.heightFollow);
    const wantAir = c.airborne ? Math.max(0, c.y - sprungY) : 0;
    airY += (wantAir - airY) * ease(CHASE.heightFollowAir);

    // Pace lives in the standoff and the lens.
    const speed = c.speed;
    dist += (CHASE.dist + speed * CHASE.distPerSpeed - dist) * ease(3);
    height += (CHASE.height + speed * CHASE.heightPerSpeed - height) * ease(3);
    fov += (Math.min(CHASE.fovMax, CHASE.fov + speed * CHASE.fovPerSpeed) - fov) * ease(4);

    // Looking through the turn: the aim slides toward the inside of the
    // turn with the yaw rate. `wy` is the body's rate about its up axis,
    // right-handed, so a positive rate is the nose swinging toward the
    // craft's right — which is where the aim goes.
    look += (clamp(c.wy * CHASE.lookThrough, -CHASE.lookThroughMax, CHASE.lookThroughMax) - look) * ease(4);

    const fx = Math.sin(aimYaw);
    const fz = Math.cos(aimYaw);
    const rx = Math.cos(aimYaw);
    const rz = -Math.sin(aimYaw);
    const bx = Math.sin(yaw);
    const bz = Math.cos(yaw);
    const camX = c.x - bx * dist;
    const camZ = c.z - bz * dist;
    let camY = sprungY + height + airY * CHASE.airLift;
    // The lens never goes under a swell.
    const floor = surfaceY(camX, camZ) + CHASE.clearance;
    if (camY < floor) camY = floor;
    pose.x = camX;
    pose.y = camY;
    pose.z = camZ;
    pose.aimX = c.x + fx * CHASE.aimAhead + rx * look;
    pose.aimY = sprungY + CHASE.aimHeight + airY * CHASE.airAim;
    pose.aimZ = c.z + fz * CHASE.aimAhead + rz * look;
    pose.fov = fov;
    pose.roll = 0;
  };

  const nose = (state: GameState, dt: number) => {
    const c = state.craft;
    const ease = (rate: number): number => (restand ? 1 : clamp(rate * dt, 0, 1));
    body.x = 0;
    body.y = NOSE.up;
    body.z = NOSE.forward;
    const eye = rotate(c.q, body);
    nosePitch += (c.pitch * NOSE.pitchShare - nosePitch) * ease(8);
    noseRoll += (c.roll * NOSE.rollShare - noseRoll) * ease(8);
    noseFov += (Math.min(NOSE.fovMax, NOSE.fov + c.speed * NOSE.fovPerSpeed) - noseFov) * ease(4);
    const cp = Math.cos(nosePitch);
    pose.x = c.x + eye.x;
    pose.y = c.y + eye.y;
    pose.z = c.z + eye.z;
    pose.aimX = pose.x + Math.sin(c.heading) * cp * NOSE.aimAhead;
    pose.aimY = pose.y + Math.sin(nosePitch) * NOSE.aimAhead;
    pose.aimZ = pose.z + Math.cos(c.heading) * cp * NOSE.aimAhead;
    pose.fov = noseFov;
    pose.roll = noseRoll;
  };

  return {
    update: (state, dt, surfaceY) => {
      if (mode === "chase") chase(state, dt, surfaceY);
      else nose(state, dt);
      restand = false;
      return pose;
    },
    pose: () => pose,
    mode: () => mode,
    setMode: (next) => {
      if (next !== mode) {
        mode = next;
        restand = true;
      }
    },
    cycle: () => {
      const i = CAMERA_MODES.indexOf(mode);
      mode = CAMERA_MODES[(i + 1) % CAMERA_MODES.length];
      restand = true;
      return mode;
    },
    restand: () => {
      restand = true;
    },
  };
}
