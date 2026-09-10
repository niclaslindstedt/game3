// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VIEW CHANGE — the lens going from one rung of the ladder to the next.
//
// The camera key walks six views (`CAMERA_MODES` in camera.ts), and two of
// its steps cross between families: off the handlebars onto a boom, and back
// down onto them from over the deck. A CUT is the one edit that tells the
// rider nothing there. Both frames are of the same craft a few metres apart,
// so all a cut communicates is that the picture has been replaced, and the
// rider spends the next wave working out where they are now sitting.
//
// The other steps walk along the boom, where the standoff and the height
// already ease between rigs and most of the hand-over was there anyway. They
// are flown too, because the part that does NOT ease is the AIM: it is read
// straight off the rig's row, so a step along the boom swings the shot a few
// degrees in a single frame — small, and exactly the kind of small that
// reads as the picture flinching.
//
// So the lens GOES there, on the shortest honest path: a straight line from
// where it was standing to where the new rig has stood it, turning as it
// travels, over about a third of a second.
//
// Two things keep it honest:
//
//   BOTH ENDS RIDE THE CRAFT. At 90 km/h the hull covers eight metres inside
//   this move, so a path drawn between two WORLD points is a lens left
//   standing on the water while the craft rides out of the frame. The pose
//   the move starts from is held in the CRAFT's own axes instead — how far
//   behind, how far to the side, how far up, and where it was looking
//   relative to the nose — and rebuilt around the craft every frame. The
//   move is then the same gesture at rest as it is at full throttle.
//
//   IT LANDS ON THE RIG, NOT NEAR IT. The destination is re-read every frame
//   off the pose the arriving rig has already written, so the last flown
//   frame IS the rig's own frame and there is nothing left to catch up. It is
//   also why the rig being landed on is STOOD around the craft rather than
//   eased onto it (`restand` in camera.ts): a destination still travelling is
//   one this move can only chase, and the arrival would be the ease rather
//   than the flight.

import { clamp } from "../lib/util.ts";
import type { CameraPose } from "./camera.ts";

/** How long a move takes, s: this much, plus the span term below. A step
 * along the boom is a couple of metres and the step off the deck-top rig is
 * eighteen, and one fixed beat makes the first a lurch or the second a
 * crawl. Both bounds are short — this is a rider changing their mind about
 * where to sit, not a shot. */
const TIME_MIN = 0.28;
const TIME_MAX = 0.6;
/** Metres of separation that buy a whole second of flight, before the
 * clamp. */
const TIME_SPAN = 30;

/** Where the lens and its aim stood, in the craft's own axes: forward is the
 * nose, right is the craft's right, up is the world's up. Everything the
 * blend needs, and nothing that goes stale when the craft moves. */
type LocalPose = {
  ahead: number;
  aside: number;
  above: number;
  aimAhead: number;
  aimAside: number;
  aimAbove: number;
  fov: number;
  roll: number;
};

/** The craft, as much of it as a hand-over needs. */
export type ChangeCraft = { x: number; y: number; z: number; heading: number };

/** Read a world pose into the craft's frame. */
function localise(pose: CameraPose, craft: ChangeCraft, out: LocalPose): void {
  const fx = Math.sin(craft.heading);
  const fz = Math.cos(craft.heading);
  const dx = pose.x - craft.x;
  const dz = pose.z - craft.z;
  out.ahead = dx * fx + dz * fz;
  out.aside = dx * fz - dz * fx;
  out.above = pose.y - craft.y;
  const ax = pose.aimX - craft.x;
  const az = pose.aimZ - craft.z;
  out.aimAhead = ax * fx + az * fz;
  out.aimAside = ax * fz - az * fx;
  out.aimAbove = pose.aimY - craft.y;
  out.fov = pose.fov;
  out.roll = pose.roll;
}

/** Smoothstep, so the move leaves and arrives at rest: the speeding up and
 * slowing down IS what makes it read as one gesture rather than a slide. */
function ease(t: number): number {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}

export type ViewChange = {
  /** Begin a move from the frame that is on screen. Call it BEFORE the new
   * rig writes anything: the pose captured here is the one the rider is
   * looking at, and `craft` has to be the one that frame was drawn around. */
  start: (pose: CameraPose, craft: ChangeCraft) => void;
  /** Whether the move still owns the frame. */
  flying: () => boolean;
  /** Pull `pose` — which the arriving rig has already written — back toward
   * where the lens came from. On the frame the move ENDS it touches nothing,
   * so there is no pop between the last flown frame and the first driven
   * one. */
  fly: (pose: CameraPose, craft: ChangeCraft, dt: number) => void;
  /** Abandon a move: a cut is wanted instead (a teleport, a restart — there
   * is no framing worth flying across one). */
  cancel: () => void;
};

export function createViewChange(): ViewChange {
  /** How far through the move, 0..1. One means there is no move. */
  let through = 1;
  let span = TIME_MIN;
  const from: LocalPose = {
    ahead: 0,
    aside: 0,
    above: 0,
    aimAhead: 0,
    aimAside: 0,
    aimAbove: 0,
    fov: 60,
    roll: 0,
  };

  return {
    start: (pose, craft) => {
      localise(pose, craft, from);
      through = 0;
      // The length is not known until the destination rig has written its
      // pose, so the first `fly` sets it; until then hold the floor.
      span = TIME_MIN;
    },
    flying: () => through < 1,
    fly: (pose, craft, dt) => {
      if (through >= 1) return;
      // The destination, in the craft's own axes — re-read every frame, so
      // the rig may still be moving under the blend without the arrival
      // drifting.
      const fx = Math.sin(craft.heading);
      const fz = Math.cos(craft.heading);
      const dx = pose.x - craft.x;
      const dz = pose.z - craft.z;
      const ahead = dx * fx + dz * fz;
      const aside = dx * fz - dz * fx;
      const above = pose.y - craft.y;
      const ax = pose.aimX - craft.x;
      const az = pose.aimZ - craft.z;
      const aimAhead = ax * fx + az * fz;
      const aimAside = ax * fz - az * fx;
      const aimAbove = pose.aimY - craft.y;
      if (through === 0) {
        const gap = Math.hypot(ahead - from.ahead, above - from.above, aside - from.aside);
        span = clamp(TIME_MIN + gap / TIME_SPAN, TIME_MIN, TIME_MAX);
      }
      through = Math.min(1, through + dt / span);
      const k = ease(through);
      if (through >= 1) return;
      const mix = (a: number, b: number): number => a + (b - a) * k;
      const eyeAhead = mix(from.ahead, ahead);
      const eyeAside = mix(from.aside, aside);
      const tipAhead = mix(from.aimAhead, aimAhead);
      const tipAside = mix(from.aimAside, aimAside);
      pose.x = craft.x + eyeAhead * fx + eyeAside * fz;
      pose.z = craft.z + eyeAhead * fz - eyeAside * fx;
      pose.y = craft.y + mix(from.above, above);
      pose.aimX = craft.x + tipAhead * fx + tipAside * fz;
      pose.aimZ = craft.z + tipAhead * fz - tipAside * fx;
      pose.aimY = craft.y + mix(from.aimAbove, aimAbove);
      pose.fov = mix(from.fov, pose.fov);
      // The lens's own bank is blended too: the step off a banked nose onto
      // a boom levels the horizon over the move rather than in one frame.
      pose.roll = mix(from.roll, pose.roll);
    },
    cancel: () => {
      through = 1;
    },
  };
}
