// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STROKES — the two controls in this game that are read off the SHAPE
// of their input rather than its value, and the only two that answer to
// being TAPPED. THE PUMP is the bars hauled BACK, and it buys rotation
// nose-over-tail; THE WHIP is the bars thrown OVER, and it buys rotation
// about the hull's own length. One is a flip and the other is a roll, and
// under the skin they are one mechanism read twice.
//
// Both are bookkeeping on an input rather than a force, which is why they
// live here and not in `flight.ts`: every rise of the input `rise` above
// its own low-water mark EARNS a stroke, and a stroke is SPENT as an
// angular impulse once the hull is flying with the input still committed.
// One input, both of the things a rider does with it — hold it up a deck
// and the hull takes one stroke as it comes off the lip (the mark only ever
// rises while the input does, so a hold cannot clear the rise twice), then
// WORK it, and it takes one a tap. That is how a flip and a roll come round
// off a ramp no craft could carry one off in a single pull.
//
// A DECK, AND NOT A CREST. That hold is paid at a RAMP's lip and nowhere
// else, and the difference is the whole of `armed`: a rider crossing a real
// sea has the bars over for most of it, and the water drops out from under
// him at the top of every second wave. Paying the lock he was already
// carrying bought him most of a barrel roll off a crest he did not jump —
// measured, holding one turn across an Hs 3 m sea: 3–6 throws and 0.98 of a
// revolution on the runabout, and the lean-back a rider trims a head sea
// with was worth 1.4 nose-over-tail. Neither is a trick he asked for, and
// both take the landing assist away with them (`craft.ts`'s `flown`), so
// what a held turn actually reads as is a craft that spins when the rider
// leaves a wave. So the mark is ARMED against whatever the water was left
// with: off a crest the line he was riding buys nothing, and a stroke is
// something he STARTS — a tap, or the bars shoved further over than he was
// carrying them — once the hull is already up.
//
// THE DEAD BAND AND THE CEILING are what keep the trick out of the ride,
// and both were measured rather than assumed (`strokeDepth`). Ordinary
// technique asks for small amounts of both inputs in the air all the time —
// a rider levelling a hull for its landing leans back and steers, and so
// does the bot's own levelling PD — and a control that paid those in full
// would flip and roll a craft by accident. `make sim` priced exactly that
// mistake on the pitch axis at 4–7 km/h of pace and a fifth of the gates.
//
// WHAT SEPARATES THE TWO is the axis. The roll axis is the small one — a
// hull is four times easier to turn about its length than about its beam —
// but the air damps all three off one coefficient, so over a quarter of the
// inertia it bleeds a roll away four times as fast, and the two very nearly
// cancel: the whip is quoted at the same impulse as the pump, and
// `defs/flight.ts` carries the measurement. What the whip has that the pump
// has not is a SIDE: the bars crossing the centre end the stroke that was
// running, because a rider who has thrown his weight the other way is not a
// rider whose weight is still out there.
//
// Nothing here is random and nothing reads a clock: a run replays to the
// same rotation.

import { clamp } from "../lib/math.ts";
import type { Vec3 } from "../lib/quat.ts";
import type { CraftSpec } from "./defs/craft.ts";
import { TUNING } from "./defs/tuning.ts";
import type { CraftInput, CraftState } from "./state.ts";

const F = TUNING.flight;

/** HOW DEEP A STROKE IS, 0..1, for one whose peak is `peak` against a
 * threshold of `rise` — what it is worth against the whole of the impulse.
 *
 * A DEAD BAND AND A CEILING, and both earn their keep. A stroke that only
 * just clears `rise` is a FLICK, and a rider flicking the bars to trim his
 * nose or hold a wing up must not be handed a trick's worth of rotation:
 * the bot's own levelling loop asks for 0.22 of lean two or three times a
 * run, and paying those in full cost `make sim` 4–7 km/h of pace and a
 * fifth of its gates. Twice the threshold is a whole stroke, and past that
 * a harder pull is not a bigger one — which is what keeps a key held down
 * (1) worth exactly the committed pull it has always been, while a key
 * worked at 2–8 Hz peaks at 0.51–0.75 on the app's own input ramps and so
 * counts as a whole stroke too. */
export function strokeDepth(peak: number, rise: number): number {
  return clamp((peak - rise) / rise, 0, 1);
}

/** Spend `share` of a stroke on the pitch rate, nose-up (−wx), out of what
 * is left of this flight's budget. `authority` is the craft's own
 * `riderAuthority` and `ix` its pitch inertia — the two numbers that make
 * the same haul worth five times as much on a stand-up as on a tourer. */
function haul(c: CraftState, authority: number, ix: number, share: number): void {
  if (share <= 0) return;
  const room = Math.max(F.pumpCeiling * authority - c.pumped, 0);
  const rate = Math.min((F.pump * authority * share) / ix, room);
  if (rate <= 0) return;
  c.wx -= rate;
  c.pumped += rate;
  c.yank = 1;
}

/** ...and the same on the ROLL rate, `side` down (+1 is the bars over to
 * the right, and a right-side-down roll is −z — `flight.ts` owns the
 * convention). `iz` is the roll inertia, the smallest of the three, which
 * is why the same impulse starts four times the rate here — and why the
 * air's damping takes it away again just as fast (`defs/flight.ts`). */
function throwOver(
  c: CraftState,
  authority: number,
  iz: number,
  share: number,
  side: number,
): void {
  if (share <= 0 || side === 0) return;
  const room = Math.max(F.whipCeiling * authority - c.whipped, 0);
  const rate = Math.min((F.whip * authority * share) / iz, room);
  if (rate <= 0) return;
  c.wz -= side * rate;
  c.whipped += rate;
  c.whip = side;
}

/** One step of both stroke detectors, run after the hull has been placed
 * and the flight bookkeeping is current.
 *
 * `flying` is the one gate both read, and every clause of it was measured
 * rather than assumed. It is a hull that LEFT the water going up
 * (`flight.launchVy`, the line the launch event is read against) with THE
 * DECK BEHIND IT and `flight.minAir` past that:
 *
 * - Not merely "out of the water". A hull leaving a lip lifts a probe clear
 *   while the deck still has it, and spending a stroke on that step cost
 *   the big ramp's backflip a third of its rotation.
 * - Not merely airborne over a ramp. A hull CROSSING a deck hops off it and
 *   back, which the flight bookkeeping reports as a launch and a landing of
 *   its own; a stroke there pitched the hull up before it reached the lip
 *   it was aimed at, and cost `make ride`'s backflip 0.4 s of hang.
 * - And not a hull DROPPING off a crest, which is the `launchVy` clause and
 *   the one that matters most: a rider leaning back through a head sea is
 *   levelling, not pumping, and the bot's own levelling PD asks for exactly
 *   that. Without it the bot was handed 2.8–5.5 rad/s of nose-up it never
 *   asked for, two or three times a run, and `make sim` lost 4–7 km/h of
 *   pace and a fifth of its gates across the roster.
 *
 * Let the input go before the line and the stroke goes with it: a touch of
 * lean off a lip is not a flip, and a touch of lock is not a roll.
 *
 * `onDeck` is the other half of the gate, and it decides what the flight
 * INHERITS rather than what it may spend. A hull riding a ramp is a rider
 * setting a trick up, so its marks are zeroed and the hold he carried up
 * the deck is one stroke at the lip. A hull on the water is a rider RIDING,
 * so its marks are armed at whatever he is holding and the same hold off a
 * crest is worth nothing. Between the two — airborne, but short of the line
 * above — nothing is written at all: that reading was taken at the last
 * contact and re-arming inside a flight would take a rider's own throw off
 * him a fifth of a second after he made it. */
export function stepStrokes(
  c: CraftState,
  spec: CraftSpec,
  I: Vec3,
  input: CraftInput,
  flying: boolean,
  onDeck: boolean,
): void {
  // Whether this step gets to say what the next flight starts from: the hull
  // has something under it, so whatever the rider is holding is technique for
  // the water rather than a stroke in the air. Read off `CraftState.airborne`,
  // which `craft.ts` has already settled for this step, and only ever read
  // below where the hull is not flying — `flying` implies `airborne`, so the
  // two are never both true.
  const armed = !c.airborne;

  // THE PUMP, on the lean-back half of the lean axis. Pulling only: a rider
  // standing on the hull has nothing to push the nose down against.
  const back = Math.max(clamp(input.lean, -1, 1), 0);
  if (!flying) {
    // Nothing is hauled against the water or a deck, and every flight
    // starts the budget fresh.
    c.pumped = 0;
    if (armed) {
      // A DECK starts from nothing, which is what makes a lean held back up
      // it worth a haul AT the lip: the first flying step reads the whole of
      // it as one rise. THE WATER starts from where the rider's hands
      // already are, so the same lean off a crest reads as no rise at all.
      c.pumpMark = onDeck ? 0 : back;
      c.pumpRising = false;
    }
  } else if (c.pumpRising) {
    // Up the stroke: a peak that has grown is a haul that is still being
    // pulled, and it is paid for as it grows. The first sign of the bars
    // coming back turns the stroke over. A mark that only ever rose is why
    // a key HELD down is one haul however long it is held.
    if (back > c.pumpMark) {
      haul(
        c,
        spec.riderAuthority,
        I.x,
        strokeDepth(back, F.pumpRise) - strokeDepth(c.pumpMark, F.pumpRise),
      );
      c.pumpMark = back;
    } else if (back < c.pumpMark) {
      c.pumpRising = false;
      c.pumpMark = back;
    }
  } else if (back >= c.pumpMark + F.pumpRise && c.yank <= F.pumpReady) {
    // A FRESH HAUL, worth what it is DEEP — see `strokeDepth`. Every one is
    // paid out of the flight's budget, so the rate steps up a tap at a time
    // until the rider has spent what one flight's worth of him is and the
    // last tap is worth whatever was left. That is the version a player can
    // read off the hull — tap, it turns faster; tap, it turns faster again;
    // tap, and nothing more happens.
    haul(c, spec.riderAuthority, I.x, strokeDepth(back, F.pumpRise));
    c.pumpRising = true;
    c.pumpMark = back;
  } else if (back < c.pumpMark) {
    c.pumpMark = back;
  }

  // THE WHIP, on the steer axis, and the same six branches with a SIDE in
  // front of them. The threshold is its own (`flight.whipRise`) and larger
  // than the pump's, because the bars are in the rider's hands all the way
  // down a straight and a sideways throw has to be unmistakably a throw.
  const steer = clamp(input.steer, -1, 1);
  const side = steer > 0 ? 1 : steer < 0 ? -1 : 0;
  const over = Math.abs(steer);
  if (!flying) {
    c.whipped = 0;
    if (armed) {
      c.whipMark = onDeck ? 0 : over;
      c.whipRising = false;
      c.whipSide = onDeck ? 0 : side;
    }
  } else if (side !== 0 && c.whipSide !== 0 && side !== c.whipSide) {
    // THE BARS HAVE CROSSED THE CENTRE. Whatever throw was running is over
    // — his hands and his weight went with them — and a fresh stroke starts
    // from where the new side is now, which at a crossing is next to
    // nothing. It is what lets a rider stop a roll he has started and open
    // one the other way, out of the same budget.
    c.whipSide = side;
    c.whipMark = over;
    c.whipRising = false;
  } else if (c.whipRising) {
    if (over > c.whipMark) {
      throwOver(
        c,
        spec.riderAuthority,
        I.z,
        strokeDepth(over, F.whipRise) - strokeDepth(c.whipMark, F.whipRise),
        c.whipSide,
      );
      c.whipMark = over;
    } else if (over < c.whipMark) {
      c.whipRising = false;
      c.whipMark = over;
    }
  } else if (over >= c.whipMark + F.whipRise && Math.abs(c.whip) <= F.pumpReady) {
    throwOver(c, spec.riderAuthority, I.z, strokeDepth(over, F.whipRise), side);
    c.whipSide = side;
    c.whipRising = true;
    c.whipMark = over;
  } else if (over < c.whipMark) {
    c.whipMark = over;
  }
}
