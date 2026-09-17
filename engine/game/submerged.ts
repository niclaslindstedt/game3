// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER UNDER THE WATER — what he still commands once the hull has
// gone under, how long he is given down there, and what brings the hull
// up when his time is out.
//
// A submerged watercraft is not a hull that has stopped being one. It is a
// body carrying two to three times its own weight in buoyancy (the probes
// fill to `displacement`·(1 + `hull.deckShare`) and the catalog's masses
// are a third of that), a pump whose intake is fed BY DEFINITION, and a
// rider whose bars and whose body have just stopped working through air
// and started working through water eight hundred times denser. Riders
// hold one under for seconds at a time and ride it tens of metres, trading
// depth against throttle: too little and it corks straight back out, too
// much and the nose keeps going down. Lean back with the throttle open and
// the jet — still making thrust, and aimed wherever the hull is pointing —
// drives it out of the water. Lean forward and it goes deeper. Which way
// the hull goes is the rider's, the whole time he is under.
//
// So the authority the air gave him (`flight.ts`) does not VANISH the
// moment the hull wets. It CHANGES HANDS. `flight.ts` fades its own out
// with `airShare` and returns at `airShare <= 0`; this fades in over the
// other side of the same crossing, so there is no pose in which the rider
// has been handed nothing. What used to turn a hull with no one steering
// it onto its back was not the water but the SURFACE's own physics still
// running under it: the sponsons' lever and the chines' bank-in, both of
// which plane, banked a submerged hull rising heeled into the sideways
// flow over its bottom until it was inverted. Both fade with the share
// under (`craft.ts`, `hull.ts`), and a hull fully under is then stable in
// pitch and slow in roll, which is what leaves the rider's bars in charge.
//
// THE SPELL (`stepUnder`) is the air's flight bookkeeping on the other side
// of the surface: a latch on the share with a gap between going in and
// coming out, a clock from the moment it went, and the events at either
// end. And THE FLOAT-UP is the rule the whole thing is played under: ten
// seconds on the gas, one second after letting it go, and the hull is
// steered to the surface the right way up whatever the rider is doing
// (`floatUpControl`). That is the rider's way OUT of a dive at any moment
// — let go, and he is up in a second — and it costs him what a capsize
// costs him, because the hull that came up was not ridden up. Surfacing
// under his own hands, upright, before the time is out, is the trick
// (`tricks.ts`).
//
// WHAT IT IS NOT is a hand on the rider's shoulder: `assist.ts` owns those
// and models nothing on purpose. Everything here but the float-up is the
// rider's OWN input reaching the hull through the medium it is actually
// in, and it is off entirely unless he asks for it; the float-up is the
// game's rule, like the capsize's righting, and no dial turns it off.
//
// Nothing here is measured. It is the arcade twin of `flight.leanTorque`
// and the sibling of `stand.hoist`, and it is stated the way `hoist` is —
// as an angular ACCELERATION rather than a torque, so one dial is the same
// correction on every hull across a roster whose pitch inertia runs 165 to
// 490 kg·m². How much of it each rider HAS is the craft's own
// `riderAuthority`, which is why the stand-up (1.5) rides out of a dive
// the touring hull (0.85) drowns in, with no knob of its own.

import { clamp } from "../lib/math.ts";
import { fromEuler, toEuler, unrotate, type Quat, type Vec3 } from "../lib/quat.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";
import type { AeroResult } from "./flight.ts";
import type { CraftState, GameEvent } from "./state.ts";

const S = TUNING.submerged;
const K = TUNING.tuck;

/** HOW FAR UNDER THE HULL IS, 0..1 — the one measure of the submerged
 * regime, and the complement of `flight.ts`'s `airShare` at the far end of
 * the same crossing.
 *
 * It is the PRODUCT of two readings, because neither alone can tell the
 * three cases apart that have to be told apart:
 *
 * - `bottomUnder`, the least-immersed bottom probe. It is 1 only when the
 *   whole bottom is under, which rules out both a hull riding with its bow
 *   in and its transom dry — ordinary head-sea work, and no business of
 *   this module's — and a hull floating INVERTED, whose bottom is in the
 *   air and whose deck must keep every cubic metre of its float.
 * - `deckFill`, how much water is over the deck. On a hull that is the
 *   right way up this is the whole question: a deck awash is a craft going
 *   under, and a deck a hull's depth down is one that has gone.
 *
 * A depth in metres cannot do this job. `submerged` is the DEEPEST probe,
 * so a bow driven a metre in while the stern is dry reads as "under" — and
 * the measurement that matters, whether the hull as a whole has left the
 * surface, is exactly the one it cannot see. Measured at rest the product
 * is zero on every craft, so the whole module is silent until the sea is
 * over the deck. */
export function submergedShare(bottomUnder: number, deckFill: number): number {
  return clamp(bottomUnder, 0, 1) * clamp(deckFill, 0, 1);
}

/** HOW MUCH OF THE DECK'S FLOAT IS LEFT once the hull is under, 0..1 of
 * `hull.deckShare`.
 *
 * The deck probes carry the sealed volume ABOVE the bottom, and they exist
 * so a hull heeled onto its gunwale is righted by it and one all the way
 * over still floats. For those they are right: a capsized hull traps its
 * air under an upturned deck, and that air genuinely floats it.
 *
 * A hull DRIVEN UNDER is the other case, and the same volume is a fiction
 * there. The footwells are open to the sea, the seat is a cushion, and the
 * engine bay is a hatch rather than a tank — so what is over the deck when
 * the deck is a metre down is water, not trapped air. Counting all of it
 * as float makes the cork-out about three times the craft's weight, and a
 * bury that lasts three tenths of a second: the hull thrown back out by
 * buoyancy no submerged watercraft has.
 *
 * So it floods over the same crossing everything else here reads, down to
 * the share that really is sealed. That is what buys the depth AND the
 * seconds under — and it is per-craft for free, because the volume is a
 * fraction of each hull's own `displacement` against each hull's own mass:
 * the stand-up corks out at 2.4 times its weight where the tourer does it
 * at 3.3. NOT gated on attitude, so the inverted float is untouched — at
 * the surface the share is 0 and every deck probe carries its whole
 * volume. */
export function floodedDeck(share: number): number {
  const k = clamp(share, 0, 1);
  return 1 - (1 - S.deckSealed) * k;
}

/** The rider's bars and body against the water, as body-frame torque added
 * to `out`. Nose-up is −x, a right roll (right side down) is −z, a
 * clockwise yaw is +y — `flight.ts`'s conventions, because it is the same
 * rider asking for the same things.
 *
 * Takes the inertia so each dial can be an acceleration. It does NOT take
 * the tuck, where the air's authority does: the spell folds the rider down
 * itself (`craft.ts`), so a cut that read the crouch would take most of
 * his hands away on every dive by rule, and what he works the hull with
 * down there is the bars and the hull's own length rather than his body
 * thrown about. */
export function submergedControl(
  spec: CraftSpec,
  share: number,
  steer: number,
  lean: number,
  I: Vec3,
  out: AeroResult,
): void {
  out.fx = out.fy = out.fz = out.tx = out.ty = out.tz = 0;
  if (share <= 0) return;
  const rider = spec.riderAuthority * share;
  out.tx -= clamp(lean, -1, 1) * S.lean * I.x * rider;
  out.tz -= clamp(steer, -1, 1) * S.roll * I.z * rider;
  out.ty += clamp(steer, -1, 1) * S.yaw * I.y * rider;
}

/** THE FLOAT-UP's hand: the hull's orientation turned toward upright with
 * its nose `riseNose` above the horizon, over the lag `riseLag`, the way
 * the capsize's righting turns a hull the rider is climbing back onto —
 * kinematically, with the body rates zeroed by the caller, and NOT as a
 * torque. A torque was benched first and cannot be made both quick and
 * gentle: the probes' heave drag is quadratic in the rate, so a spring
 * small enough not to throw the hull clear of the water turned an
 * inverted one at 0.8 rad/s and took four seconds, and one big enough to
 * be quick launched it. The linear physics runs on underneath — the
 * buoyancy brings the hull up bow first, and the jet, if the throttle is
 * still open, drives it out.
 *
 * Read and written through the Euler angles, which fold at ±90° of pitch:
 * a hull past vertical reads as a small pitch with the roll at half a
 * turn, and shrinking that roll to nothing is the same half turn taken
 * the other way — the capsize takes the same road, and both arrive. */
export function floatUpPose(q: Quat, dt: number): Quat {
  const e = toEuler(q);
  const a = 1 - Math.exp(-dt / S.riseLag);
  return fromEuler(e.heading, e.pitch + (S.riseNose - e.pitch) * a, e.roll * (1 - a));
}

/** THE RIDER'S BODY IN THE WATER: ½·ρ·C_dA·|v|·v against the hull's
 * velocity through the water, with the tuck's `dragCut` off the area
 * (`TUNING.submerged.riderCdA` says why it is small), acting at the
 * rider's height. Written to `out` as world force and body torque. */
export function riderDrag(
  spec: CraftSpec,
  q: Quat,
  share: number,
  crouch: number,
  density: number,
  rx: number,
  ry: number,
  rz: number,
  out: AeroResult,
): void {
  out.fx = out.fy = out.fz = out.tx = out.ty = out.tz = 0;
  if (share <= 0) return;
  const speed = Math.hypot(rx, ry, rz);
  if (speed <= 0) return;
  const area = S.riderCdA * (1 - K.dragCut * clamp(crouch, 0, 1)) * share;
  const qbar = 0.5 * density * area * speed;
  out.fx = -qbar * rx;
  out.fy = -qbar * ry;
  out.fz = -qbar * rz;
  // r × F with r = (0, riderHeight, 0) in the body frame.
  const f = unrotate(q, { x: out.fx, y: out.fy, z: out.fz });
  out.tx = spec.riderHeight * f.z;
  out.tz = -spec.riderHeight * f.x;
}

/** WHAT THE WATER DOES TO A HULL UNDER IT, summed into `out` for
 * `craft.ts` to add in one place: the rider's bars (`submergedControl`) —
 * withheld while the float-up has the hull, whose turn is kinematic and
 * would fight a torque — and his body's drag (`riderDrag`), which acts
 * whoever is steering. `rx`, `ry`, `rz` are the hull's velocity relative
 * to the water under it; nothing when the hull is not under at all. */
export function underwaterForces(
  spec: CraftSpec,
  c: CraftState,
  share: number,
  steer: number,
  lean: number,
  I: Vec3,
  density: number,
  rx: number,
  ry: number,
  rz: number,
  out: AeroResult,
): void {
  out.fx = out.fy = out.fz = out.tx = out.ty = out.tz = 0;
  if (share <= 0) return;
  const scratch: AeroResult = { fx: 0, fy: 0, fz: 0, tx: 0, ty: 0, tz: 0 };
  if (!c.floatUp) {
    submergedControl(spec, share, steer, lean, I, scratch);
    out.tx += scratch.tx;
    out.ty += scratch.ty;
    out.tz += scratch.tz;
  }
  riderDrag(spec, c.q, share, c.crouch, density, rx, ry, rz, scratch);
  out.fx += scratch.fx;
  out.fy += scratch.fy;
  out.fz += scratch.fz;
  out.tx += scratch.tx;
  out.tz += scratch.tz;
}

/** ONE STEP OF THE FLOAT-UP'S HAND on the craft, at the integration: the
 * rates held at zero, the orientation turned by `floatUpPose`, and the
 * height eased up toward `rest` — where the hull would float on the water
 * over it — over the same lag, never down. The righting's own road to the
 * surface, without the wait on its back: left to its buoyancy alone a hull
 * turned upright five metres down under a storm sea climbed toward a
 * surface that was moving away from it, and a rider given back a hull he
 * could not see the sky from was not given back much. The way along is
 * the physics' and the drag scrubs it. */
export function floatUpStep(c: CraftState, rest: number, dt: number): void {
  c.wx = c.wy = c.wz = 0;
  c.q = floatUpPose(c.q, dt);
  if (c.y < rest) {
    c.y += (rest - c.y) * (1 - Math.exp(-dt / S.riseLag));
    c.vy = Math.max(c.vy, 0);
  }
}

/** ONE STEP OF THE SPELL, run after the craft has been placed and `share`
 * is this step's `submergedShare`. The latch, the clock, the gas clock,
 * the float-up's timer and the two events at the spell's ends are all
 * here, so `craft.ts` reads one answer.
 *
 * `upY` is the hull's own up in the world (positive is the right way up),
 * `throttle` the lever as asked this step. Returns nothing; everything it
 * decides is on `c`, and the events go on `events`. */
export function stepUnder(
  c: CraftState,
  share: number,
  upY: number,
  throttle: number,
  t: number,
  events: GameEvent[],
): void {
  const dt = TUNING.dt;
  const was = c.under;
  if (!was && share >= S.enter) c.under = true;
  else if (was && share < S.leave) c.under = false;

  if (c.under) {
    const before = c.underTime;
    c.underTime += dt;
    if (before < S.counts && c.underTime >= S.counts) {
      events.push({ kind: "submerge", t, depth: c.submergedDepth, speed: c.speed });
    }
    // THE GAS CLOCK runs from the moment the lever is let go and stops the
    // moment it is squeezed again, so a rider can change his mind twice.
    c.gasOff = throttle >= S.gas ? 0 : c.gasOff + dt;
    // Half a step of slack on both clocks: a second is a hundred and
    // twenty steps of a third that is not exact in binary.
    const slack = dt / 2;
    if (!c.floatUp && (c.underTime + slack >= S.hold || c.gasOff + slack >= S.holdIdle)) {
      c.floatUp = true;
      events.push({ kind: "floatUp", t, underTime: c.underTime });
    }
  } else if (was) {
    // OUT. A spell that never reached the line was a wave over the deck
    // and reports nothing; one that did says how it ended. Clean is the
    // rider's own surfacing, UPRIGHT (`uprightDone` — a hull on its ear is
    // not up), with no float-up owed on it.
    const upright = upY >= S.uprightDone;
    if (c.underTime >= S.counts) {
      events.push({ kind: "surface", t, underTime: c.underTime, clean: !c.floatUp && upright });
    }
    // ...AND OUT ON ITS BACK OR ITS EAR IS THE FLOAT-UP'S TOO. A hull
    // nobody steered corks out inverted inside a second — before either
    // clock above can run out — and left there it is a capsize, which is
    // the one end a DIVE is never allowed to have: the water took the hull,
    // so the water gives it back the right way up, and the combo goes with
    // it. One that came out on its side is the same case a second later:
    // the surface would roll it the rest of the way over as often as not,
    // and that capsize would still be a dive's. A dive, though — a spell
    // that counted, or a bow reported buried on this landing — and not a
    // hull that came down on its back off a flip and was pushed under for
    // a few steps by its own slam: that one never went under the water,
    // it landed wrong, and it is the capsize's.
    if (!c.floatUp && !upright && (c.underTime >= S.counts || c.dived)) {
      c.floatUp = true;
      events.push({ kind: "floatUp", t, underTime: c.underTime });
    }
    c.underTime = 0;
    c.gasOff = 0;
  }
  // The float-up's hand lets go only with the hull out AND upright, never
  // at the surface alone: a hull it left on its side there is a capsize.
  // And it is bounded: a hull it has not righted in `holdUp` seconds —
  // wedged, aground, or held under by something — is the capsize's.
  if (c.floatUp) {
    c.floatUpFor += dt;
    if ((!c.under && upY >= S.uprightDone) || c.floatUpFor >= S.holdUp) {
      c.floatUp = false;
      c.floatUpFor = 0;
    }
  }
}
