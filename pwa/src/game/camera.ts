// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMERA, as maths. Six rigs, walked with the camera key as ONE LADDER
// from the handlebars backwards (the ids and the order are `CAMERA_MODES`):
//
//   bow   — out on the foredeck ahead of everything: no hull in the frame,
//           the sea a metre under the lens.
//   nose  — on the craft's own handlebars, looking over the bar and the
//           hood. Both are bolted on, so they go with the hull — but only
//           partly: the pitch and the roll they carry are DAMPED, because a
//           lens that takes every degree of a hull on chop is a picture
//           nobody can read.
//   close — a boom over the transom: the wake fills the bottom of the frame
//           and a wave arriving is a wall.
//   chase — behind and above the craft, LOW: the 90s jetski-racer read,
//           where a swell coming at the hull fills the bottom of the frame
//           and the horizon rides high. THE REFERENCE the other four are
//           moved from.
//   far   — stood back and a little higher: less drama, more warning.
//   heli  — the shot a chase helicopter would fly, and the furthest back the
//           ladder goes. There is no view from over the deck: straight down
//           on a sea is a MAP, and a map of water shows no waves at all —
//           the swell only reads as a swell from a lens that is looking
//           across it.
//
// The four outside rigs are ONE rig with different proportions — one table
// of numbers (`camera-rigs.ts`), one update function — so an angle is a row
// rather than another camera to maintain. They ease with speed, look THROUGH
// a turn toward where the nose is going, swing to the outside of a carve,
// keep the horizon level whatever the hull is doing (they stand in the
// world, not on the deck, and their height is sprung so a wave under the
// craft is not a wave under the lens), and in the air they hang the boom
// along the FLIGHT PATH rather than along the horizontal — its length
// unchanged, so the hull is the same size off a ramp as it was on the water.
//
// WALKING THE LADDER IS A MOVE, NEVER A CUT: the lens is flown from where it
// was standing to where the new rig has stood it (`camera-change.ts`).
//
// DOM-free and three-free on purpose: this module turns a `GameState` into
// a POSE — an eye, an aim point, a lens and a roll — and `renderer.ts`
// applies it to the three.js camera in four lines. That split is what lets
// the root suite drive every rig through a carve and a launch and hold it to
// the framing rules (tests/camera_test.ts) without a browser.
//
// AXES: the engine's frame (x east, z north, y up, heading 0 = +z growing
// toward +x) maps straight onto three.js's — both right-handed, both y-up
// — so nothing here flips a sign. The one flip in the app is
// `SCREEN_TO_ENGINE` in input-model.ts.

import { angleDiff, rotate, type GameState } from "@engine";

import { clamp } from "../lib/util.ts";
import { createViewChange } from "./camera-change.ts";
import {
  CHASE_RIGS,
  EYE_RIGS,
  type ChaseCamera,
  type EyeCamera,
  type EyeRig,
} from "./camera-rigs.ts";

export type CameraMode = EyeCamera | ChaseCamera;
/** The modes the camera key walks, in the order it walks them — the same
 * handlebars-backwards ladder the options card lists, so the key and the
 * setting never disagree about what "the next camera" means. */
export const CAMERA_MODES: readonly CameraMode[] = ["bow", "nose", "close", "chase", "far", "heli"];

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

/** Clearance the flown hand-over is never allowed under, m — modest, because
 * both ends of a move are already standing clear of the sea and all this has
 * to do is keep the middle of a long step out of a swell. */
const CHANGE_CLEARANCE = 0.4;

export type CameraRig = {
  /** Advance the rig by `dt` seconds of the given state and read the pose.
   * `surfaceY` answers the sea's height under a plan point — the outside
   * lenses' floor; the app hands it the engine's `heightAt`. */
  update: (state: GameState, dt: number, surfaceY: (x: number, z: number) => number) => CameraPose;
  /** The pose from the last update. */
  pose: () => CameraPose;
  mode: () => CameraMode;
  setMode: (mode: CameraMode) => void;
  /** Walk to the next mode. */
  cycle: () => CameraMode;
  /** Forget every eased quantity: the next update stands the lens in one
   * frame. For a restart, a reset, a staged moment — there is no framing
   * worth keeping across a teleport, and none worth FLYING across one, so
   * this abandons a hand-over in flight too. */
  restand: () => void;
};

export function createCameraRig(initial: CameraMode = "chase"): CameraRig {
  let mode: CameraMode = initial;
  let restand = true;
  const change = createViewChange();
  // The outside rigs' eased quantities.
  let yaw = 0;
  let slip = 0;
  let look = 0;
  let swing = 0;
  let swingV = 0;
  let sprungY = 0;
  let airY = 0;
  let dist = CHASE_RIGS.chase.dist;
  let height = CHASE_RIGS.chase.height;
  let fov = CHASE_RIGS.chase.fov;
  // The bolted-on rigs'.
  let nosePitch = 0;
  let noseRoll = 0;
  let noseFov = EYE_RIGS.nose.fov;
  const pose: CameraPose = { x: 0, y: 0, z: 0, aimX: 0, aimY: 0, aimZ: 1, fov: 60, roll: 0 };
  const body = { x: 0, y: 0, z: 0 };
  /** The craft the pose on screen was drawn around — what a hand-over holds
   * its departure against, so the move rides the craft rather than being
   * left standing on the water. `drawn` stays false until the first frame:
   * there is nothing to fly away from before one has been drawn. */
  const shown = { x: 0, y: 0, z: 0, heading: 0 };
  let drawn = false;

  const chase = (
    rig: (typeof CHASE_RIGS)[ChaseCamera],
    state: GameState,
    dt: number,
    surfaceY: (x: number, z: number) => number,
  ): void => {
    const c = state.craft;
    const ease = (rate: number): number => (restand ? 1 : clamp(rate * dt, 0, 1));
    if (restand) {
      yaw = c.heading;
      slip = 0;
      look = 0;
      swing = 0;
      swingV = 0;
      sprungY = c.y;
      airY = 0;
    }
    // The yaw follows the nose, loosely in the air. The slip carries the
    // travel direction into the framing while the hull is being carried
    // sideways across the water — never in the air, where the nose and the
    // travel come apart on purpose and the shot's job is the landing.
    const planSpeed = Math.hypot(c.vx, c.vz);
    const travel = planSpeed > 3 ? Math.atan2(c.vx, c.vz) : c.heading;
    const wantSlip = c.airborne
      ? 0
      : soften(angleDiff(c.heading, travel) * rig.slipWeight, rig.slipMax);
    slip += (wantSlip - slip) * ease(rig.followRate);
    yaw = angleLerp(yaw, c.heading, ease(c.airborne ? rig.followRate * 0.5 : rig.followRate));
    const aimYaw = yaw + slip;

    // The sprung height: the craft's own y, followed slowly afloat and
    // quickly in the air, so a chop is smoothed out and a launch is not.
    sprungY += (c.y - sprungY) * ease(c.airborne ? rig.heightFollowAir : rig.heightFollow);
    const wantAir = c.airborne ? Math.max(0, c.y - sprungY) : 0;
    airY += (wantAir - airY) * ease(rig.heightFollowAir);

    // Pace lives in the standoff, the height and the lens.
    const speed = c.speed;
    dist += (rig.dist + speed * rig.distPerSpeed - dist) * ease(3);
    height += (rig.height + speed * rig.heightPerSpeed - height) * ease(3);
    fov += (Math.min(rig.fovMax, rig.fov + speed * rig.fovPerSpeed) - fov) * ease(4);

    // Looking through the turn: the aim slides toward the inside of the
    // turn with the yaw rate. `wy` is the body's rate about its up axis,
    // right-handed, so a positive rate is the nose swinging toward the
    // craft's right — which is where the aim goes, and the OPPOSITE of where
    // the lens itself swings.
    look +=
      (clamp(c.wy * rig.lookThrough, -rig.lookThroughMax, rig.lookThroughMax) - look) * ease(4);
    // The swing is a sprung mass rather than an ease: under a damping ratio
    // of 1 it overshoots the new framing and settles back into it, which is
    // what makes a distant lens read as flown. Semi-implicit Euler, which is
    // stable at the frame rates a browser actually hands over.
    const wantSwing = clamp(-c.wy * rig.swing, -rig.swingMax, rig.swingMax);
    if (restand) {
      swing = wantSwing;
      swingV = 0;
    } else {
      const w = rig.swingFreq;
      swingV += (w * w * (wantSwing - swing) - 2 * rig.swingDamp * w * swingV) * dt;
      swing += swingV * dt;
    }

    const fx = Math.sin(aimYaw);
    const fz = Math.cos(aimYaw);
    const rx = Math.cos(aimYaw);
    const rz = -Math.sin(aimYaw);
    // THE ROD: one rod behind and above the craft, `dist` back and `height`
    // up. Off the water it is turned AS A WHOLE onto the flight path — down
    // under a craft coming off a lip, up over one that is falling — and a
    // rotation does not change a length, so the hull is exactly as big in
    // the frame off a ramp as it was on the water before it. `gamma` is the
    // flight path's angle, damped by the rig's share of the read: the
    // divisor's floor keeps a craft dropping straight down from tipping the
    // rod through the vertical.
    const bx = Math.sin(yaw);
    const bz = Math.cos(yaw);
    const gamma = c.airborne ? Math.atan2(c.vy, Math.max(planSpeed, 1)) * rig.flight : 0;
    const cg = Math.cos(gamma);
    const sg = Math.sin(gamma);
    const rodBack = dist * cg + height * sg;
    const rodUp = height * cg - dist * sg;
    const camX = c.x - bx * rodBack + rx * swing;
    const camZ = c.z - bz * rodBack + rz * swing;
    let camY = sprungY + rodUp + airY * rig.airLift;
    // The lens never goes under a swell.
    const floor = surfaceY(camX, camZ) + rig.clearance;
    if (camY < floor) camY = floor;
    pose.x = camX;
    pose.y = camY;
    pose.z = camZ;
    pose.aimX = c.x + fx * rig.aimAhead + rx * look;
    pose.aimY = sprungY + rig.aimHeight + airY * rig.airAim;
    pose.aimZ = c.z + fz * rig.aimAhead + rz * look;
    pose.fov = fov;
    pose.roll = 0;
  };

  const eye = (rig: EyeRig, state: GameState, dt: number): void => {
    const c = state.craft;
    const ease = (rate: number): number => (restand ? 1 : clamp(rate * dt, 0, 1));
    body.x = 0;
    body.y = rig.up;
    body.z = rig.forward;
    const at = rotate(c.q, body);
    nosePitch += (c.pitch * rig.pitchShare - nosePitch) * ease(8);
    noseRoll += (c.roll * rig.rollShare - noseRoll) * ease(8);
    noseFov += (Math.min(rig.fovMax, rig.fov + c.speed * rig.fovPerSpeed) - noseFov) * ease(4);
    const cp = Math.cos(nosePitch);
    pose.x = c.x + at.x;
    pose.y = c.y + at.y;
    pose.z = c.z + at.z;
    pose.aimX = pose.x + Math.sin(c.heading) * cp * rig.aimAhead;
    pose.aimY = pose.y + Math.sin(nosePitch) * rig.aimAhead;
    pose.aimZ = pose.z + Math.cos(c.heading) * cp * rig.aimAhead;
    pose.fov = noseFov;
    pose.roll = noseRoll;
  };

  /** Walking the ladder: the frame that is on screen becomes the departure,
   * and the rig being arrived at is STOOD around the craft rather than eased
   * onto it — a destination still travelling is one the hand-over can only
   * chase. */
  const walkTo = (next: CameraMode): void => {
    if (next === mode) return;
    if (drawn) change.start(pose, shown);
    mode = next;
    restand = true;
  };

  return {
    update: (state, dt, surfaceY) => {
      if (mode === "bow" || mode === "nose") eye(EYE_RIGS[mode], state, dt);
      else chase(CHASE_RIGS[mode], state, dt, surfaceY);
      if (change.flying()) {
        change.fly(pose, state.craft, dt);
        const floor = surfaceY(pose.x, pose.z) + CHANGE_CLEARANCE;
        if (pose.y < floor) pose.y = floor;
      }
      restand = false;
      const c = state.craft;
      shown.x = c.x;
      shown.y = c.y;
      shown.z = c.z;
      shown.heading = c.heading;
      drawn = true;
      return pose;
    },
    pose: () => pose,
    mode: () => mode,
    setMode: walkTo,
    cycle: () => {
      const i = CAMERA_MODES.indexOf(mode);
      walkTo(CAMERA_MODES[(i + 1) % CAMERA_MODES.length]);
      return mode;
    },
    restand: () => {
      restand = true;
      change.cancel();
    },
  };
}
