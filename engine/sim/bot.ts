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
import { fieldGradient, sampleField } from "../lib/heightfield.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { topSpeedOf } from "../game/limits.ts";
import type { CraftInput, GameState } from "../game/state.ts";
import type { Gate } from "../mapgen/types.ts";

export type BotProfile = {
  /** Steering gain on the bearing error, per radian, and the damping on
   * the yaw rate, per rad/s. */
  steerGain: number;
  yawDamp: number;
  /** How far ahead of the ramp's hinge the approach point stands, m, so
   * the craft is lined up along the ramp's axis before it reaches it. */
  rampApproach: number;
  /** Within this distance of the approach point, m, the bot aims along
   * the ramp's heading instead of at a point, and how far ahead of its own
   * station on the axis it then aims, m. */
  rampCommit: number;
  axisAhead: number;
  axisAheadTime: number;
  /** How far short of the axis the pursuit aims per m/s the hull is
   * already closing on it, s — the damping on the line-up. */
  axisSettle: number;
  /** Pitch the bot levels toward in the air, rad (a touch nose-up lands
   * flatter through the slam), and the gains on the error and the rate. */
  airPitch: number;
  airGainP: number;
  airGainD: number;
  /** ...and on the roll, held level with the bars, and on the yaw rate. */
  airRollGain: number;
  airRollDamp: number;
  airYawDamp: number;
  /** How far ahead the bot looks for a rock, m, and how far off the line it
   * moves its aim to miss one, m. */
  lookAhead: number;
  dodge: number;
  /** Bearing error past which the throttle comes off, rad, and how far
   * it comes off. On a jet the thrust IS the steering, so easing for a
   * big correction only makes the correction slower: the knob ships at
   * 1 (no easing) and is here for a craft that would rather scrub speed. */
  easeAngle: number;
  easeTo: number;
  /** How far past a gate's plane, m, the bot stops trying for it and
   * aims at the next, and how long without a gate, s, before it resets. */
  giveUpPast: number;
  giveUpAfter: number;
  /** The pace governor on a ramp run: throttle per m/s of shortfall, and
   * the least throttle it ever holds there. */
  paceGain: number;
  paceFloor: number;
  /** The bearing error, rad, within which the run at a ramp counts as
   * lined up and the pace governor is allowed the throttle. */
  alignedWithin: number;
  /** Water shallower than this, m, at the point the hull reaches in this
   * many seconds, is a shore to turn away from. */
  shoalDepth: number;
  shoalAhead: number;
};

export const RIDER_BOT: BotProfile = {
  steerGain: 2.2,
  yawDamp: 0.4,
  rampApproach: 110,
  rampCommit: 15,
  axisAhead: 14,
  axisAheadTime: 0.35,
  axisSettle: 1,
  airPitch: 0.08,
  airGainP: 2.5,
  airGainD: 0.9,
  airRollGain: 3,
  airRollDamp: 0.6,
  airYawDamp: 1.2,
  lookAhead: 40,
  dodge: 9,
  easeAngle: 0.9,
  easeTo: 1,
  giveUpPast: 6,
  giveUpAfter: 40,
  paceGain: 0.35,
  paceFloor: 0.3,
  alignedWithin: 0.12,
  shoalDepth: 2.5,
  shoalAhead: 2.6,
};

/** The speed to arrive at the ramp's hinge with, m/s, so that the centre
 * of gravity leaves the lip on a ballistic arc through the ring: from the
 * lip at height `lipY + cog.y`, the arc at the ramp's angle has to be at
 * the ring's height `d` metres past the lip, v_lip² = g·d² / (2·cos²a·
 * (lipY + cog.y + d·tan a − ringY)), and the hinge speed pays for the
 * climb up the deck, v² = v_lip² + 2·g·lipY, with a little over for the
 * deck's friction. A ring higher than any arc reaches reads as flat out.
 * A rider judges this by eye; the bot judges it by the same geometry. */
export function launchSpeedFor(gate: Gate, cogY: number, topSpeed: number): number {
  const r = gate.ramp;
  if (!r) return topSpeed;
  const sh = Math.sin(r.heading);
  const ch = Math.cos(r.heading);
  const alongGate = (gate.x - r.x) * sh + (gate.z - r.z) * ch;
  const d = alongGate - r.length;
  if (d <= 0) return topSpeed;
  const lipY = r.length * Math.tan(r.angle);
  const drop = lipY + cogY + d * Math.tan(r.angle) - gate.y;
  if (drop <= 0.05) return topSpeed;
  const cos = Math.cos(r.angle);
  const lip2 = (TUNING.g * d * d) / (2 * cos * cos * drop);
  const v = Math.sqrt(lip2 + 2 * TUNING.g * lipY) * 1.04;
  return clamp(v, 4, topSpeed);
}

/** The point the bot aims at for the next gate: the gate's centre for a
 * water gate; for an air gate, the ramp's approach point until the craft
 * is nearly on it, then a point on the ramp's AXIS a little ahead of the
 * craft's own projection onto it — a pure pursuit that pulls the hull onto
 * the line, where aiming at the far end of the axis would only ever
 * parallel it. `speed` is the pace to hold on the way, m/s, or null for
 * flat out. */
function aimFor(
  gate: Gate,
  x: number,
  z: number,
  vx: number,
  vz: number,
  cogY: number,
  topSpeed: number,
  profile: BotProfile,
): { ax: number; az: number; along: boolean; speed: number | null } {
  if (gate.kind !== "air" || !gate.ramp)
    return { ax: gate.x, az: gate.z, along: false, speed: null };
  const r = gate.ramp;
  const sh = Math.sin(r.heading);
  const ch = Math.cos(r.heading);
  const ax = r.x - sh * profile.rampApproach;
  const az = r.z - ch * profile.rampApproach;
  // The run at the ramp lasts from the approach point to the ring; a
  // craft past the ring is off the axis and goes round again.
  const along = (x - ax) * sh + (z - az) * ch;
  const pastRing = (x - gate.x) * sh + (z - gate.z) * ch > profile.giveUpPast;
  if (along > -profile.rampCommit && !pastRing) {
    // The craft's own station along the axis, then the pursuit point
    // ahead of it — further ahead the faster it is going, so the pull
    // onto the line is a turn the hull can make at that speed.
    const speed = Math.hypot(vx, vz);
    const ahead = Math.max(profile.axisAhead, speed * profile.axisAheadTime);
    const station = (x - r.x) * sh + (z - r.z) * ch + ahead;
    // ...and a little short of the line in the direction the hull is
    // already closing on it, so a nimble hull arrives on the axis rather
    // than swinging through it. The right vector is (cos h, −sin h).
    const closing = vx * ch - vz * sh;
    const offset = -closing * profile.axisSettle;
    return {
      ax: r.x + sh * station + ch * offset,
      az: r.z + ch * station - sh * offset,
      along: true,
      speed: launchSpeedFor(gate, cogY, topSpeed),
    };
  }
  return { ax, az, along: false, speed: null };
}

/** Where to cross a buoy gate that stands before a ramp: the point on the
 * line between its buoys that the ramp's axis passes through (clamped a
 * hull's width inside the buoys), so the craft arrives at the ramp already
 * on its axis with the whole leg to settle. A rider looks two gates ahead;
 * the bot does the same sum. Falls back to the centre when the axis misses
 * the gate's line altogether. */
function throughOnAxis(gate: Gate, next: Gate, margin: number): { ax: number; az: number } {
  const r = next.ramp;
  if (!r) return { ax: gate.x, az: gate.z };
  const sh = Math.sin(r.heading);
  const ch = Math.cos(r.heading);
  const rx = Math.cos(gate.heading);
  const rz = -Math.sin(gate.heading);
  // Solve gate + t·right = ramp + s·axis for t.
  const det = rx * ch - rz * sh;
  if (Math.abs(det) < 1e-6) return { ax: gate.x, az: gate.z };
  const dx = r.x - gate.x;
  const dz = r.z - gate.z;
  const t = (dx * ch - dz * sh) / det;
  const half = Math.max(0, gate.width / 2 - margin);
  const tc = clamp(t, -half, half);
  return { ax: gate.x + rx * tc, az: gate.z + rz * tc };
}

/** How far past a gate's plane a point is, m (negative before it). */
function pastGate(gate: Gate, x: number, z: number): number {
  return (x - gate.x) * Math.sin(gate.heading) + (z - gate.z) * Math.cos(gate.heading);
}

export function botInput(state: GameState, profile: BotProfile = RIDER_BOT): CraftInput {
  const c = state.craft;
  const gates = state.level.course.gates;
  const n = state.progress.nextGate;
  if (state.phase !== "running" || n >= gates.length) {
    return { steer: 0, throttle: 0, lean: 0, reset: false };
  }
  // A gate already BEHIND the craft — a ring sailed over, a buoy passed
  // on the wrong side — is a gate to pay for, not to turn back for: the
  // next one counts it as reached (`course.ts`), so aim there. What no
  // rider does is loop back at speed through a field of skerries. But a
  // craft that has run past BOTH has nothing ahead that counts, and goes
  // back for the nearer one.
  let gate = gates[n];
  const pastNext = pastGate(gate, c.x, c.z) > profile.giveUpPast;
  if (pastNext && n + 1 < gates.length && pastGate(gates[n + 1], c.x, c.z) <= profile.giveUpPast) {
    gate = gates[n + 1];
  }
  const aim = aimFor(gate, c.x, c.z, c.vx, c.vz, c.spec.cog.y, topSpeedOf(c.spec), profile);
  let ax = aim.ax;
  let az = aim.az;
  // A buoy gate with a ramp after it is crossed where the ramp's axis
  // crosses it.
  const after = gates[gate.index + 1];
  if (gate.kind === "water" && after && after.kind === "air" && after.ramp) {
    const through = throughOnAxis(gate, after, c.spec.beam);
    ax = through.ax;
    az = through.az;
  }

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
  // In the air the bars roll the hull, not the course: hold it level for
  // the landing. Right side down is positive roll and positive steer
  // rolls right, so the correction is the roll's opposite.
  // Afloat, the bearing error is damped by the yaw rate the hull already
  // has: a hull coming round at speed is steered less, not more, or it
  // weaves down the straight the way a rider who only looks at the buoy
  // does.
  // On the deck the bars are held straight: a hull steered up a ramp
  // leaves it rolled.
  // In the air the same bars hold the nose too: a yaw rate carried off
  // the lip would otherwise turn the whole flight.
  let steer = c.airborne
    ? clamp(
        -c.roll * profile.airRollGain + c.wz * profile.airRollDamp - c.wy * profile.airYawDamp,
        -1,
        1,
      )
    : c.onRamp
      ? 0
      : clamp(error * profile.steerGain - c.wy * profile.yawDamp, -1, 1);
  // READING THE WATER. Shallows ahead — the bed within `shoalDepth` of the
  // surface at the point the hull will be in `shoalAhead` seconds — turn
  // the bow toward deeper water, gate or no gate: a rider sees the beach
  // coming, and no line through a buoy runs up a shore.
  if (!c.airborne && !c.onRamp) {
    const reach = Math.max(12, c.speed * profile.shoalAhead);
    const px = c.x + Math.sin(c.heading) * reach;
    const pz = c.z + Math.cos(c.heading) * reach;
    if (-sampleField(state.level.ground, px, pz) < profile.shoalDepth) {
      const g = fieldGradient(state.level.offshore, px, pz);
      if (Math.hypot(g.gx, g.gz) > 1e-6) {
        const seaward = Math.atan2(g.gx, g.gz);
        steer = clamp(angleDiff(c.heading, seaward) * profile.steerGain, -1, 1);
      }
    }
  }
  let throttle = 1;
  if (Math.abs(error) > profile.easeAngle) throttle = profile.easeTo;
  // On the run at a ramp, hold the pace the ring asks for — never below
  // what keeps the nozzle steering, since a shut throttle is a hull that
  // will not turn onto the axis.
  // ...and only once lined up: a hull still turning onto the axis needs
  // its thrust more than its pace.
  if (aim.speed !== null && !c.airborne && Math.abs(error) < profile.alignedWithin) {
    throttle = Math.min(
      throttle,
      clamp(profile.paceFloor + (aim.speed - c.speed) * profile.paceGain, profile.paceFloor, 1),
    );
  }

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

  // Stuck — on the ground with no way on, or wedged against a rock it
  // has just hit and cannot get off: go back to the last gate.
  const wedged = c.hitCooldown > 0 && c.speed < 0.8 && !c.airborne;
  // ...or, whatever it is doing, no gate for `giveUpAfter` seconds: a
  // rider that lost does not ride on into the next county. A capsize is
  // not a reset: the engine rights the hull where it lies.
  const p = state.progress;
  const idle = p.time - Math.max(p.lastGatePassedAt, p.lastResetAt) > profile.giveUpAfter;
  const reset = state.t > 2 && ((c.onGround && c.speed < 0.5) || wedged || idle);
  return { steer, throttle, lean, reset };
}
