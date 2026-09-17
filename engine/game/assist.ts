// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARCADE'S HAND — the help the rider is given, and the three places it
// is allowed to touch the craft.
//
// Nothing here is a model of anything. Every number is argued against the
// feel (`TUNING.assist`). Two hands are DIALS a difficulty setting moves:
// `GameState.assist` for the air and `GameState.rampAssist` for the deck,
// each 0..1, each read and never written during a run. The following-sea
// hand is part of the core ride and does not move with difficulty.
//
// - THE AIR (`landingAssist`): a predicted attitude at splashdown, and a
//   torque toward the one the hull ought to land at when the prediction
//   says it will not.
// - THE RAMP (`rampAssist`): a hull on a four-metre deck is a sled on wet
//   plastic with no keel in the water and no nozzle to steer with, so
//   whatever sideways way it climbed aboard with carries it off a flank.
//   The hand takes some of that slide out and turns the bow up the deck.
// - THE FOLLOWING SEA (`followingSeaAssist`): a wave overtaking a planing
//   hull can swallow its bow before any physical lift has a useful angle to
//   work through. The hand pitches that bow clear while it is being caught.
//
// THE AIR AND RAMP FOLD AWAY UNDER THE RIDER'S OWN HAND, and that is what
// keeps either from reading as a rail the game is on: `flown` — the lean,
// and a yank of the pump still fading — retires the air's hand in
// proportion, `steer` the ramp's. The following-sea hand likewise leaves
// an airborne hull alone when the rider is deliberately flying it, and a
// wet hull when he leans forward to put the bow under on purpose.

import { integrate, rotate, unrotate, type Quat } from "../lib/quat.ts";
import { angleDiff, clamp } from "../lib/math.ts";
import type { Ramp } from "../mapgen/types.ts";
import { onRampDeck } from "./collision.ts";
import { TUNING } from "./defs/tuning.ts";
import type { AeroResult } from "./flight.ts";

const A = TUNING.assist.air;
const R = TUNING.assist.ramp;
const F = TUNING.assist.following;
const G = 9.81;

/** THE FOLLOWING SEA'S HAND: keep an overtaking wave from swallowing the
 * bow of a hull that is already riding on it.
 *
 * Head seas make their own answer: the bow meets the wave face, its bottom
 * earns pressure lift, and the entering probes slam upward. Running WITH a
 * wave takes those two cues away just when the crest catches the transom and
 * drives the bow into the face ahead. The physical model then reacts only
 * after the section is buried, when its drag has already taken the speed and
 * the rider's control with it. This is the intentionally arcade counterpart:
 * a pitch-up acceleration as the bow goes in, before the deck follows.
 *
 * The hull must be making way and aligned with the sea's travel. Once wet,
 * the bow must also be deeper than the transom and past the immersion an
 * ordinary planing forefoot carries; a hull wholly under keeps the hand until
 * it has broken the surface again. While dry, only a nose-down bow inside the
 * last metre before re-entry qualifies, and the rider's own air input retires
 * it. The result is body-x torque, N·m; nose-up is negative x. */
export function followingSeaAssist(
  q: Quat,
  wx: number,
  forwardSpeed: number,
  windFrom: number,
  bowDepth: number,
  transomDepth: number,
  under: number,
  airborne: boolean,
  flown: number,
  lean: number,
  ix: number,
  out: AeroResult,
): void {
  out.fx = 0;
  out.fy = 0;
  out.fz = 0;
  out.tx = 0;
  out.ty = 0;
  out.tz = 0;
  if (forwardSpeed <= 0) return;

  const nose = rotate(q, { x: 0, y: 0, z: 1 });
  const horizontal = Math.hypot(nose.x, nose.z);
  if (horizontal < 1e-6) return;
  // Waves travel WITH the wind; `windFrom` is where that wind came from.
  const travel = windFrom + Math.PI;
  const aligned = (nose.x * Math.sin(travel) + nose.z * Math.cos(travel)) / horizontal;
  const withSea = clamp((aligned - F.align) / (1 - F.align), 0, 1);
  const pace = clamp(forwardSpeed / F.pace, 0, 1);
  if (withSea <= 0 || pace <= 0) return;

  const bowWet = clamp((bowDepth - F.begin) / (F.full - F.begin), 0, 1);
  const bowFirst = clamp((bowDepth - transomDepth) / F.difference, 0, 1);
  const pitch = Math.atan2(nose.y, horizontal);
  const approaching = airborne
    ? clamp((F.airReach + bowDepth) / F.airReach, 0, 1) *
      clamp((F.landPitch - pitch) / F.pitchBand, 0, 1) *
      (1 - clamp(Math.abs(flown), 0, 1))
    : 0;
  const caught = Math.max(bowWet * bowFirst, clamp(under / F.under, 0, 1), approaching);
  if (caught <= 0) return;

  const gain = withSea * pace * caught;
  // Full forward lean is a dive request. The hand prevents the wave from
  // choosing that line for the rider; it must not prevent him choosing it.
  const yielded = 1 - clamp(-lean, 0, 1);
  const noseDown = Math.max(0, wx);
  out.tx = -(F.right + F.damp * noseDown) * ix * gain * yielded;
}

/** How long, s, until the keel reaches the water, from `height` m above it
 * falling at `vy` m/s (up positive) under gravity alone. The air's drag is
 * left out on purpose: over the tenths of a second this is read across it
 * moves the answer by percent, and a closed form is what lets the attitude
 * be predicted rather than stepped. Already in the water is 0, and a climb
 * that never comes down (there is none, but the algebra allows it) is
 * `Infinity`. */
export function timeToWater(height: number, vy: number): number {
  if (height <= 0) return 0;
  const disc = vy * vy + 2 * G * height;
  if (disc <= 0) return Infinity;
  return (vy + Math.sqrt(disc)) / G;
}

/** THE AIR'S HAND: the last `window` seconds before the water.
 *
 * The whole mechanism is one question asked every step — WHERE WILL THIS
 * HULL BE POINTING WHEN IT HITS? — and it is answered by turning the
 * craft's own attitude forward at the rate it is already turning at. When
 * the answer is a landing the rider rides away from, the assist adds
 * nothing at all: a clean jump never feels it, and a backflip that is
 * going to come round completes untouched. When the answer is a hull
 * arriving on its side or on its nose, a torque is added toward the
 * attitude it ought to land at, growing as the water closes.
 *
 * Predicting FIRST is what makes it flip-safe, and it is the reason this
 * is not simply a spring toward level. A hull three-quarters of the way
 * through a flip is a long way from level RIGHT NOW and a short way from
 * it at splashdown, so the shortest correction from the PREDICTED
 * attitude carries the rotation on round and finishes it; the same spring
 * read off the present attitude would unwind the flip into the water.
 *
 * The assist owns pitch and roll and never heading: a hand that yawed the
 * craft would be steering it, and where the rider is pointing is the
 * rider's.
 *
 * AND THE AIR IS THE RIDER'S BEFORE IT IS THE ARCADE'S. `flown` is how
 * much of this flight the rider is flying himself, 0..1, and it folds the
 * hand away in proportion: a rider working the bars — winding a flip round,
 * or stuffing the nose because that is what he meant to do — gets no help
 * and no interference, and the hand is there for the rider who is not
 * flying it. It has to come off the INPUT rather than off the rotation,
 * because a hull half way through a flip is genuinely predicted to land on
 * its head and only the rider knows that is on purpose. `craft.ts` is where
 * it is read: the lean either way it is held, and a yank of the pump still
 * fading, so the gaps in a tapped flip do not let the hand back in.
 *
 * `strength` and `window` are the run's two dials (`GameState.assist`,
 * `.assistWindow`): how hard the hand catches and how late it arrives. At
 * 0 on either, nothing here runs and the hull lands wherever the physics
 * threw it. Torque comes back in the BODY frame, N·m, and is added to the
 * step's own. */
export function landingAssist(
  q: Quat,
  wx: number,
  wy: number,
  wz: number,
  ix: number,
  iy: number,
  iz: number,
  airTime: number,
  height: number,
  vy: number,
  flown: number,
  strength: number,
  window: number,
  out: AeroResult,
): void {
  out.fx = 0;
  out.fy = 0;
  out.fz = 0;
  out.tx = 0;
  out.ty = 0;
  out.tz = 0;
  const dial = clamp(strength, 0, 1) * (1 - clamp(Math.abs(flown), 0, 1));
  if (dial <= 0) return;
  // A CHOP HOP IS NOT A JUMP, and the line is the one the launch event is
  // already read against (`flight.minAir`). At speed in a head sea the
  // hull is clear of the water a fifth of the steps, in skips of a few
  // hundredths each, and every one of them is inside the window and hard
  // up against it — so an assist that did not ask this would be a pitch
  // damper permanently fitted to the ride, and the drumroll of a head sea
  // is the sensation this game is FOR. It waits for a real flight.
  if (airTime < TUNING.flight.minAir) return;
  const tti = timeToWater(height, vy);
  if (!(tti < window)) return;

  // Where the hull will be pointing when it arrives: its attitude turned
  // forward at the rate it is turning now. `integrate` is the same
  // quaternion step `craft.ts` advances the body with, taken in one jump
  // of `tti` instead of a step of `dt`.
  const arriving = integrate(q, wx, wy, wz, tti);
  // World-up seen from the arriving hull, against where a hull that is
  // landing well sees it: dead level but for `landPitch` of bow lift,
  // which in the body frame leans world-up toward the bow by that much.
  const upB = unrotate(arriving, { x: 0, y: 1, z: 0 });
  const dy = Math.cos(A.landPitch);
  const dz = Math.sin(A.landPitch);
  // The shortest turn from where it will be to where it should be: the
  // axis is the cross product upB × (0, dy, dz), the angle the one
  // between them.
  const ax = upB.y * dz - upB.z * dy;
  const ay = -upB.x * dz;
  const az = upB.x * dy;
  const sin = Math.hypot(ax, ay, az);
  if (sin < 1e-6) return;
  const angle = Math.atan2(sin, upB.y * dy + upB.z * dz);
  // Split that one turn back into the two axes the hull actually answers
  // on — the yaw component is dropped rather than applied, because where
  // the rider is pointing is the rider's — and read each against its own
  // tolerance. Signed, so each keeps the direction it has to turn.
  const pitchErr = past((angle * ax) / sin, A.pitchTolerance);
  const rollRaw = (angle * az) / sin;
  const rollErr = past(rollRaw, A.rollTolerance);
  // THE HAND HAS A REACH IN ROLL, and past it the hull belongs to the
  // water. What a rider has to catch a landing with is trim — his weight
  // into a footwell, a shove on the bars — and none of that brings a hull
  // back from its beam ends in the air. The spring is the same spring
  // inside the bank he rides away from and is gone by `rollReach`, so a
  // hull thrown further over than he can hold arrives on its side still
  // carrying the rate it earned, and its own righting arm decides the rest
  // (`hull.ts`: the deck probes put that arm through zero at about 90°).
  //
  // The PITCH half keeps its full reach. A nose held up IS what a rider's
  // weight does, and a hull that comes down on its nose has the submerged
  // spell waiting for it (`submerged.ts`) rather than a capsize.
  const reach = clamp((A.rollReach - Math.abs(rollRaw)) / (A.rollReach - A.rollHold), 0, 1);
  const rollHand = rollErr * reach;
  if (pitchErr === 0 && rollHand === 0) return;

  // Past the tolerance the torque grows from zero, so nothing steps as a
  // flight crosses the line between "fine" and "caught", and it grows
  // again as the water closes — the hand tightens rather than grabbing.
  const urgency = 1 - tti / window;
  const gain = dial * urgency;
  // NEGATED, and that is the whole sign of this term: `ax`/`az` is the
  // axis that turns the VECTOR onto its target, and a body turned
  // right-handed about an axis sees a fixed world direction swing the
  // other way round it. Turning the hull the way the cross product points
  // drives world-up further from where it should be, which is a hull the
  // assist puts in upside down.
  const right = A.right * gain;
  out.tx = -pitchErr * right * ix;
  out.tz = -rollHand * right * iz;
  // ...and the rate is damped on the same schedule, so the hull arrives
  // settled instead of swinging through the attitude it was aimed at.
  // Damped flat rather than in proportion to the error, because the rate
  // IS the error here: what wrings a landing out of a flight is the plate
  // winding the nose up over the whole hang, and by the time the attitude
  // has left the band the rate is what has to be taken out of it. It
  // costs a clean flight nothing, the assist having already returned.
  const damp = A.damp * gain;
  out.tx -= damp * wx * ix;
  out.ty -= damp * wy * iy;
  // ...and the roll rate is damped only as far as the hand still reaches.
  // Damping a rate it has let go of the attitude of is the same save by
  // another route: it costs the hull the roll it is going over on while
  // claiming to have stood down.
  out.tz -= damp * wz * iz * reach;
}

/** THE RAMP'S HAND: the run up a deck four metres wide.
 *
 * A hull on a ramp has nothing in the water. No keel to bite, no nozzle
 * to steer with, and `contact.rampFriction` under it — so the sideways
 * way it climbed aboard with is the sideways way it leaves with, and a
 * couple of degrees off the axis at the hinge is a chine over the edge
 * before the lip. That is a jump lost to a line the rider could not see
 * he had not made.
 *
 * Three terms, and only ONE of them knows where the middle of the deck is:
 *
 * - THE DECK HOLDS. `grip` takes the sideways slide out the way a keel in
 *   the water would — a damper on the across velocity and nothing else,
 *   so a hull tracking straight anywhere on the deck feels no force at
 *   all, and one sliding off finds the slide fading rather than a wall.
 * - THE BOW COMES ROUND. `align` turns the hull toward the ramp's axis
 *   past a dead band of `aim`, with `damp` on the yaw rate so it arrives
 *   settled: the rider who aimed roughly right leaves the lip pointing
 *   straight, which is most of what following through IS.
 * - THE CAMBER. `centre` is the one that knows, which is why it is kept
 *   small and kept OUT of the middle: nothing inside `free` of the
 *   half-width, growing from zero at that line to its full figure at the
 *   flank. A rider down the centre of the deck feels nothing because
 *   there is nothing to feel; a rider on his way off the side gets a
 *   nudge that reads as a deck that is not flat. Aim it at the centreline
 *   from anywhere and the hull would swim to the middle of every ramp
 *   like a ball in a gutter, which is the one thing this must never read
 *   as.
 *
 * Everything here fades with `carry` — how fast the hull is actually
 * going UP the deck, against `pace`. A hull stopped on a ramp, sliding
 * back down one, or crossing it broadside has no help at all: the hand is
 * for following a jump through, and a hand that moved a hull that was not
 * going anywhere would be the gutter again.
 *
 * Force and torque both come back in the WORLD frame, N and N·m, and the
 * torque is about the VERTICAL and nothing else: bringing a bow round in
 * the plan is a turn about world-up, and the deck itself owns the pitch
 * and the roll of a hull lying on it. */
export function rampAssist(
  ramp: Ramp,
  q: Quat,
  x: number,
  z: number,
  vx: number,
  vz: number,
  wx: number,
  wy: number,
  wz: number,
  mass: number,
  iy: number,
  steer: number,
  strength: number,
  out: AeroResult,
): void {
  out.fx = 0;
  out.fy = 0;
  out.fz = 0;
  out.tx = 0;
  out.ty = 0;
  out.tz = 0;
  const dial = clamp(strength, 0, 1) * (1 - clamp(Math.abs(steer), 0, 1));
  if (dial <= 0) return;
  const at = onRampDeck(ramp, x, z);
  if (!at) return;
  const sh = Math.sin(ramp.heading);
  const ch = Math.cos(ramp.heading);
  // The deck's own axes: `along` is up the ramp and `across` is ninety
  // degrees clockwise of it — the pair `onRampDeck` measures a plan point
  // in, so the sign of `at.across` and the sign here agree.
  const vAlong = vx * sh + vz * ch;
  const vAcross = vx * ch - vz * sh;
  const carry = clamp(vAlong / R.pace, 0, 1);
  if (carry <= 0) return;
  const gain = dial * carry;

  // The slide, damped; and past `free` of the way out, the camber. Both
  // are accelerations, and `most` is the ceiling over their sum — a hull
  // that arrived sideways off a wave is a hull the deck cannot save, and
  // the hand must not turn into a wall trying.
  const half = ramp.width / 2;
  const edge = half * (1 - R.free);
  const beyond = edge > 1e-3 ? clamp(past(at.across, half * R.free) / edge, -1, 1) : 0;
  const lateral = clamp(-R.grip * vAcross - R.centre * beyond, -R.most, R.most) * gain * mass;
  out.fx = lateral * ch;
  out.fz = -lateral * sh;

  // The bow, brought round to the deck's axis — clockwise from above is
  // +y, which is the sense `angleDiff` answers in. Read off the hull's
  // own forward rather than the step's heading, which is a reading taken
  // at the END of a step; a hull stood on its nose has no plan heading
  // worth reading and is left to the deck.
  const fwd = rotate(q, { x: 0, y: 0, z: 1 });
  if (Math.hypot(fwd.x, fwd.z) >= 0.2) {
    const err = past(angleDiff(Math.atan2(fwd.x, fwd.z), ramp.heading), R.aim);
    // The rate damped is the one this torque acts on: how fast the hull
    // is turning about the VERTICAL, which on a deck standing at twenty
    // degrees is not the body's own yaw rate.
    const yawRate = rotate(q, { x: wx, y: wy, z: wz }).y;
    out.ty = (err * R.align - yawRate * R.damp) * gain * iy;
  }
}

/** How far `angle` reaches past `tolerance`, keeping its sign, and 0 while
 * it is inside — the dead band every axis of the assist is read through. */
function past(angle: number, tolerance: number): number {
  const over = Math.abs(angle) - tolerance;
  return over <= 0 ? 0 : Math.sign(angle) * over;
}
