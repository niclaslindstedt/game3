// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R35 — THE TRICK FIELD: the line of ramps a level built for a TRICKS run
// carries beside its course, and the reason that run is not just the race
// with the buoys switched off.
//
// A tricks run has no gates to take, no finish to cross and no rivals; what
// it has is a clock running down and a score running up, and the only thing
// on a shore that buys either is a lip. The race course offers R7's two or
// three air gates in a couple of kilometres, which is a jump about every
// forty seconds — four of them in a two-minute run, and the rest of it spent
// riding between them. So a tricks level gets a FIELD instead: ramps laid
// the length of the racing line, one every `trickStride` metres, which is
// exactly as often as the catalog's most road-hungry hull can get back up to
// speed (`pace.ts` states the rule and derives the number).
//
// NONE OF THEM IS A GATE, and that is the other half of R35. A ring is a
// CHECKPOINT — `markLamp` lights the one being ridden at, `stepCourse`
// charges for a miss — and a run with no course to count has nothing to
// check. What is left when the ring goes is the thing the ramp was always
// for: the lip, the air, and whatever the rider does in it.
//
// THE FIELD IS LAID ON THE FINISHED LINE, not searched for. The route (R24)
// was drawn first and the water cut around it, so every metre of the course
// path already stands over water R5 will float a hull on; what is left is to
// walk it at a fixed stride and ask, at each station, whether a deck and its
// run-up actually fit there. A station that does not fit is SKIPPED rather
// than nudged — nudging is how a field ends up with two ramps 30 m apart at
// the one place the coast is awkward, and a gap in the line reads as a
// stretch of open water while a pair reads as a bug.
//
// AND IT IS LAID TWICE: OUT, AND BACK. A race course is a thing with an end
// on it, and a tricks run is a CLOCK — two minutes at the pace R35 spaces
// the field for is most of two kilometres, which is the whole of a coast
// course, so a field laid one way would run out under the rider halfway
// through the shortest run there is. So the second pass walks the same line
// the other way, half a stride out of step with the first: a ramp faces the
// way it is climbed, so an outbound deck is not a deck to a rider coming
// home, and the two passes interleave into a shuttle down the shore and back
// up it rather than into a line at half the stride. A rider going either way
// meets a lip every `trickStride` metres, which is the rule; what the second
// pass buys is that they never stop meeting them.

import { angleDiff } from "../lib/math.ts";
import { sampleField, type Heightfield } from "../lib/heightfield.ts";
import { cumulative, pointAlong } from "./course.ts";
import { rulesAtPace, trickStride } from "./pace.ts";
import { solidBerth } from "./rules.ts";
import type { Ramp, Solid, Vec2, Wind } from "./types.ts";

/** What laying the field has to be able to ask about the water. The two
 * fields are the ones the compiler has already baked, so this is a read of
 * grids rather than the analytic shore the course search worked on. */
export type FieldWater = {
  readonly ground: Heightfield;
  readonly offshore: Heightfield;
  readonly solids: readonly Solid[];
};

/** How much of R9's run-up a TRICK ramp is given, as a share of the race
 * course's.
 *
 * A race ramp's run-up is the straight, deep, empty water R9 demands before
 * a hinge so that a rider can line the jump up and arrive at R18's design
 * lip speed. A trick ramp asks for less of it, and the difference is what
 * R35's stride already bought: the rider has had the whole stride to get
 * back to speed, so what the water before the hinge has to be is CLEAR and
 * DEEP rather than long. Demanding the full run-up as well would be asking
 * the same metres to be empty twice and would thin the field out on exactly
 * the stretches — a bend, a skerry field — where a jump is worth having.
 */
const RUN_UP_SHARE = 0.45;

/** How far off the beam a trick ramp's approach may lie, as a multiple of
 * R9's band for a race ramp.
 *
 * R9 holds a race ramp close to beam-on because a ring has to be THREADED:
 * a hull that stuffs its bow in a head sea arrives under the arc the ring
 * stands on and the gate is missed. A trick ramp has nothing to thread, so
 * a lip taken a little into the sea is a jump that goes a little shorter
 * rather than a jump that fails — and holding the whole field to the race
 * band would leave the legs that run up and down the sea bare.
 */
const BEAM_WIDEN = 3;

/** A trick ramp's deck, as a share of the way through R8's length band. The
 * field is one vocabulary rather than a draw per station: a rider learns
 * what a lip does in the first minute of a run and then reads the shore
 * instead of each ramp, which is the whole difference between a trick field
 * and an obstacle course. Mid-band on both, so the deck is the one R8 draws
 * when it is not drawing an extreme. */
const DECK = 0.5;

/** THE FIELD'S OWN GEOMETRY, stated once: the deck every trick ramp is
 * built to, and how far past its hinge a ramp's business runs — the deck,
 * then R7's clear water to come down in.
 *
 * Exported because the ANALYSIS re-checks the field against it
 * (`analysis/air.ts`'s R35 checks) and a check reading a `reach` a metre off
 * the one the field was laid to is a check that fails every level the layer
 * was happy with. */
export function trickDeck(
  pace: number,
  rampWidth: number,
): { length: number; angle: number; reach: number } {
  const R = rulesAtPace(pace, rampWidth);
  const length = R.ramp.length.min + DECK * (R.ramp.length.max - R.ramp.length.min);
  const angle = R.ramp.angle.min + DECK * (R.ramp.angle.max - R.ramp.angle.min);
  return { length, angle, reach: length + R.air.landing };
}

/** How far off a ramp's own heading the NEXT lip may lie and still be the
 * next lip, rad. Sixty degrees: a deck further round than that is on
 * another leg of the line rather than down this one, and a rider who wanted
 * it would be turning round for it rather than arriving at it. */
const AHEAD = Math.PI / 3;

/** Whether `b` is the lip the rider coming off `a` ARRIVES at next — which
 * is the only pair R35's stride is about.
 *
 * Two conditions, and both are the rule read literally. `b` has to be
 * AHEAD of `a`, inside a cone about `a`'s own heading, because a deck
 * abeam is not a deck the landing runs on to; and it has to FACE near
 * enough `a`'s way to be climbed without turning round, because the field
 * is laid out and back and the return pass's decks are not this rider's.
 *
 * Asymmetric on purpose: "the next lip along" is a direction, and a pair
 * that fails one way round may well be a pair the other way. Stated here
 * and read by the analysis for `trickDeck`'s reason. */
export function nextAfter(a: Ramp, b: Ramp): boolean {
  if (Math.abs(angleDiff(a.heading, b.heading)) > Math.PI / 2) return false;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const off = Math.hypot(dx, dz);
  if (off <= 0) return true;
  const along = (dx * Math.sin(a.heading) + dz * Math.cos(a.heading)) / off;
  return along >= Math.cos(AHEAD);
}

/** Where the field's ramps stand on a level whose line is `path`.
 *
 * Walks the line from `stride` metres in — the first stride is the rider's
 * own run-up off the start — and stands a ramp at every station the water
 * can carry one, hinged on the line and headed the way the line runs. The
 * result is in course order, which is the order a rider meets them.
 *
 * `taken` is the race course's own ramps: a trick ramp is never stood on top
 * of one, because a level built for a tricks run still carries the course it
 * was generated as, and two decks in the same water is one deck with a step
 * in it.
 */
export function layTrickField(
  path: readonly Vec2[],
  length: number,
  water: FieldWater,
  wind: Wind,
  pace: number,
  rampWidth: number,
  taken: readonly Ramp[],
): Ramp[] {
  const R = rulesAtPace(pace, rampWidth);
  const stride = trickStride(pace);
  const { length: deckLength, angle: deckAngle, reach } = trickDeck(pace, rampWidth);
  const runUp = R.ramp.runUp * RUN_UP_SHARE;
  const beam = R.ramp.beam * BEAM_WIDEN;
  // R9 — the waves travel the way the wind blows TO, and a lip is worth
  // taking across them rather than into them.
  const waveHeading = wind.from + Math.PI;
  // R6's keep-out for a deck: half its width, plus the margin a solid is
  // given from any part of the course.
  const flank = R.ramp.width / 2 + R.course.solidMargin;
  const cum = cumulative(path);
  const out: Ramp[] = [];

  const deepEnough = (x: number, z: number): boolean =>
    -sampleField(water.ground, x, z) >= R.ramp.runUpDepth;
  /** Nothing standing in the deck or in the water the rider crosses to
   * reach it. The berth grows with the rock, exactly as R6 gives it. */
  const clear = (a: Vec2, b: Vec2): boolean => {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    if (len <= 0) return false;
    for (const s of water.solids) {
      const t = Math.min(1, Math.max(0, ((s.x - a.x) * dx + (s.z - a.z) * dz) / (len * len)));
      const off = Math.hypot(s.x - (a.x + dx * t), s.z - (a.z + dz * t));
      if (off < flank + solidBerth(s.r)) return false;
    }
    return true;
  };

  /** One ramp at the station `at` metres along the line, climbed in the
   * direction `sense` (+1 down the line, −1 back up it) — or null where the
   * water there cannot carry one.
   *
   * `from` is where the rider's approach starts and `to` where the landing
   * ends, both measured the way they will RIDE, so the whole check reads the
   * same on both passes and the chord between them is the heading the deck
   * is actually met at rather than the line's tangent at the hinge. */
  const stand = (at: number, sense: 1 | -1): Ramp | null => {
    const span = (d: number): number => Math.min(length, Math.max(0, at + sense * d));
    const hinge = pointAlong(path, cum, at);
    const from = pointAlong(path, cum, span(-runUp));
    const to = pointAlong(path, cum, span(reach));
    const heading = Math.atan2(to.x - from.x, to.z - from.z);
    const off = Math.abs(angleDiff(waveHeading, heading));
    if (Math.abs(off - Math.PI / 2) > beam) return null;
    // The deck runs from the hinge along the heading — the straight line the
    // hull climbs, not the curve the path takes.
    const lip = {
      x: hinge.x + Math.sin(heading) * deckLength,
      z: hinge.z + Math.cos(heading) * deckLength,
    };
    if (!deepEnough(from.x, from.z) || !deepEnough(hinge.x, hinge.z)) return null;
    if (!deepEnough(lip.x, lip.z) || !deepEnough(to.x, to.z)) return null;
    if (!clear(from, to)) return null;
    const stood: Ramp = {
      id: "",
      x: hinge.x,
      z: hinge.z,
      heading,
      length: deckLength,
      width: R.ramp.width,
      angle: deckAngle,
    };
    // TWO WAYS A DECK MAY NOT STAND WHERE ANOTHER ALREADY DOES, and the
    // second is the rule itself rather than a geometry check.
    //
    // `reach` is how far a ramp's own business runs past its hinge — the
    // deck, then the water to come down in — so that much clear water is
    // what one has to be given whichever way it faces: two lips inside it
    // are one lip with a step in it.
    //
    // And a deck the rider MEETS THE SAME WAY (`sameWay`) has to be a whole
    // stride off, because that gap is what R35 is: a lip reached before the
    // hull is back up to speed is the jump the rule exists to prevent. The
    // two passes interleave at half a stride and are exempt by facing each
    // other — but only where the line is straight, and a bend can swing a
    // return chord back inside a right angle of an outbound one. That is a
    // real crowding rather than a measuring error, so it is refused here
    // and the analysis re-checks it.
    const clash = (r: Ramp): boolean => {
      const off = Math.hypot(r.x - hinge.x, r.z - hinge.z);
      if (off < reach) return true;
      // Either order: a deck this one would be reached too soon after, and
      // one that would be reached too soon after this one.
      return off < stride && (nextAfter(r, stood) || nextAfter(stood, r));
    };
    if (taken.some(clash) || out.some(clash)) return null;
    return stood;
  };

  // OUT: from one stride in — the first stride is the rider's own run-up off
  // the start — to the last station with room for a deck and a landing.
  for (let at = stride; at + reach <= length; at += stride) {
    const ramp = stand(at, 1);
    if (ramp) out.push(ramp);
  }
  // BACK: the same line the other way. The stations are half a stride out of
  // step with the OUTBOUND grid rather than with the far end of the line —
  // phasing them off the end puts the first one wherever the course's length
  // happens to land, which on a course an exact number of strides long is on
  // top of an outbound deck. Walked from the far end down, so the list still
  // reads in the order a rider riding the shuttle meets them.
  const backFrom = Math.floor((length - runUp) / stride - 0.5) * stride + stride / 2;
  for (let at = backFrom; at - reach >= 0; at -= stride) {
    const ramp = stand(at, -1);
    if (ramp) out.push(ramp);
  }
  return out.map((r, i) => ({ ...r, id: `trick-${i + 1}` }));
}
