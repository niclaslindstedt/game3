// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The bot rider — a deterministic player stand-in that reads the same
// GameState the HUD reads and produces the same CraftInput a thumb
// produces. It aims at the next gate (or at the ramp's axis for an air
// gate), rides flat out, leans back on the ramp, levels in the air, and
// steers round a rock in its way. It must never reach into the physics'
// internals: everything it knows it reads off the state and `limits.ts`.
// Used by the simulation harness, the balance CLI and the tests.

import { angleDiff, clamp } from "../lib/math.ts";
import { onRampDeck, solidNear } from "../game/collision.ts";
import type { CraftInput, GameState } from "../game/state.ts";
import type { Gate } from "../mapgen/types.ts";

export type BotProfile = {
  /** Steering gain on the bearing error, per radian. */
  steerGain: number;
  /** How far ahead of the ramp's hinge the approach point stands, m, so
   * the craft is lined up along the ramp's axis before it reaches it. */
  rampApproach: number;
  /** Within this distance of the approach point, m, the bot aims along
   * the ramp's heading instead of at a point. */
  rampCommit: number;
  /** Pitch the bot levels toward in the air, rad (a touch nose-up lands
   * flatter through the slam), and the gains on the error and the rate. */
  airPitch: number;
  airGainP: number;
  airGainD: number;
  /** How far ahead the bot looks for a rock, m, and how far off the line it
   * moves its aim to miss one, m. */
  lookAhead: number;
  dodge: number;
  /** Bearing error past which the throttle comes off a little, rad, and
   * how far off it comes. */
  easeAngle: number;
  easeTo: number;
};

export const RIDER_BOT: BotProfile = {
  steerGain: 2.2,
  rampApproach: 45,
  rampCommit: 12,
  airPitch: 0.08,
  airGainP: 2.5,
  airGainD: 0.9,
  lookAhead: 40,
  dodge: 9,
  easeAngle: 0.9,
  easeTo: 0.55,
};

/** The point the bot aims at for the next gate: the gate's centre for a
 * water gate; for an air gate, the ramp's approach point until the craft
 * is nearly on it, then straight along the ramp. */
function aimFor(gate: Gate, x: number, z: number, profile: BotProfile): { ax: number; az: number; along: boolean } {
  if (gate.kind !== "air" || !gate.ramp) return { ax: gate.x, az: gate.z, along: false };
  const r = gate.ramp;
  const sh = Math.sin(r.heading);
  const ch = Math.cos(r.heading);
  const ax = r.x - sh * profile.rampApproach;
  const az = r.z - ch * profile.rampApproach;
  // Past the approach point (or within reach of it), commit to the axis.
  const along = (x - ax) * sh + (z - az) * ch;
  if (along > -profile.rampCommit) return { ax: r.x + sh * 200, az: r.z + ch * 200, along: true };
  return { ax, az, along: false };
}

export function botInput(state: GameState, profile: BotProfile = RIDER_BOT): CraftInput {
  const c = state.craft;
  const gates = state.level.course.gates;
  const n = state.progress.nextGate;
  if (state.phase !== "running" || n >= gates.length) {
    return { steer: 0, throttle: 0, lean: 0, reset: false };
  }
  const gate = gates[n];
  const aim = aimFor(gate, c.x, c.z, profile);
  let ax = aim.ax;
  let az = aim.az;

  // A rock between here and there: move the aim off it, to whichever
  // side the rock is not on.
  if (!aim.along) {
    const dx = ax - c.x;
    const dz = az - c.z;
    const dist = Math.hypot(dx, dz) || 1;
    const ux = dx / dist;
    const uz = dz / dist;
    const reach = Math.min(profile.lookAhead, dist);
    for (let s = 6; s <= reach; s += 6) {
      const px = c.x + ux * s;
      const pz = c.z + uz * s;
      const rock = solidNear(state.level, px, pz, c.spec.beam);
      if (!rock) continue;
      // Which side of the line the rock's centre is on: cross product.
      const side = Math.sign((rock.x - c.x) * uz - (rock.z - c.z) * ux) || 1;
      // Aim past it on the other side: the right vector is (uz, −ux).
      ax = px - uz * side * (rock.r + profile.dodge);
      az = pz + ux * side * (rock.r + profile.dodge);
      break;
    }
  }

  const bearing = Math.atan2(ax - c.x, az - c.z);
  const error = angleDiff(c.heading, bearing);
  const steer = clamp(error * profile.steerGain, -1, 1);
  let throttle = 1;
  if (Math.abs(error) > profile.easeAngle) throttle = profile.easeTo;

  let lean = 0;
  if (c.airborne) {
    // Level for the landing: nose-up rate is −wx.
    const pitchRate = -c.wx;
    lean = clamp(
      (profile.airPitch - c.pitch) * profile.airGainP - pitchRate * profile.airGainD,
      -1,
      1,
    );
  } else if (c.onRamp) {
    lean = 1;
  } else if (gate.kind === "air" && gate.ramp && onRampDeck(gate.ramp, c.x, c.z)) {
    lean = 1;
  }

  // Stuck on the ground with no way on: go back to the last gate.
  const reset = c.onGround && c.speed < 0.5 && state.t > 2;
  return { steer, throttle, lean, reset };
}
