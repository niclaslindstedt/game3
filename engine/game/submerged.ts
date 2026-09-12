// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDER UNDER THE WATER — what he still commands once the hull has
// gone under, and why he commands anything at all.
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
// drives it out of the water.
//
// So the authority the air gave him (`flight.ts`) does not VANISH the
// moment the hull wets. It CHANGES HANDS. `flight.ts` fades its own out
// with `airShare` and returns at `airShare <= 0`; this fades in over the
// other side of the same crossing, so there is no pose in which the rider
// has been handed nothing — which is what he used to be handed, for
// seconds at a time, every time a bow went in. A hull with no one steering
// it rotates until it is past vertical, and past vertical it used to lose
// its engine and start a capsize timer, so one buried bow cost the run.
//
// WHAT IT IS NOT is a hand on the rider's shoulder: `assist.ts` owns those
// and models nothing on purpose. This is the rider's OWN input reaching
// the hull through the medium it is actually in, and it is off entirely
// unless he asks for it.
//
// Nothing here is measured. It is the arcade twin of `flight.leanTorque`
// and the sibling of `stand.hoist`, and it is stated the way `hoist` is —
// as an angular ACCELERATION rather than a torque, so one dial is the same
// correction on every hull across a roster whose pitch inertia runs 165 to
// 490 kg·m². How much of it each rider HAS is the craft's own
// `riderAuthority`, which is why the stand-up (1.5) rides out of a dive
// the touring hull (0.85) drowns in, with no knob of its own.

import { clamp } from "../lib/math.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";
import type { Vec3 } from "../lib/quat.ts";
import type { AeroResult } from "./flight.ts";

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
 * A depth in metres cannot do this job, which is what it was tried as
 * first. `submerged` is the DEEPEST probe, so a bow driven a metre in
 * while the stern is dry reads as "under" — and the measurement that
 * matters, whether the hull as a whole has left the surface, is exactly
 * the one it cannot see. Measured at rest the product is zero on every
 * craft, so the whole module is silent until the sea is over the deck. */
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
 * as float made the cork-out about three times the craft's weight, which
 * is why a bury lasted three tenths of a second: the hull was being thrown
 * back out by buoyancy no submerged watercraft has.
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
 * Takes the inertia so each dial can be an acceleration; takes `crouch`
 * because a rider folded down behind the bars has as little of himself to
 * throw about under the water as over it (`TUNING.tuck`). */
export function submergedControl(
  spec: CraftSpec,
  share: number,
  steer: number,
  lean: number,
  crouch: number,
  I: Vec3,
  out: AeroResult,
): void {
  out.fx = out.fy = out.fz = out.tx = out.ty = out.tz = 0;
  if (share <= 0) return;
  const rider = spec.riderAuthority * share * (1 - (1 - K.airLeft) * clamp(crouch, 0, 1));
  out.tx -= clamp(lean, -1, 1) * S.lean * I.x * rider;
  out.tz -= clamp(steer, -1, 1) * S.roll * I.z * rider;
  out.ty += clamp(steer, -1, 1) * S.yaw * I.y * rider;
}
