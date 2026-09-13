// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STROKES — the two controls in this game that are read off the SHAPE
// of their input rather than its value, and the only two that answer to
// being TAPPED. THE PUMP is the bars hauled BACK, and it buys rotation
// nose-over-tail; THE WHIP is the bars thrown OVER, and it buys rotation
// about the hull's own length. One is a flip and the other is a roll, and
// under the skin they are one mechanism read twice.
//
// Both are bookkeeping on an input rather than a force, which is why they
// live here and not in `flight.ts`: a stroke is EARNED by carrying the
// input across a gate near the top of its own axis, and SPENT as an
// angular impulse the same step, on a hull that is flying. One input, both
// of the things a rider does with it — hold it across the gate up a deck
// and the hull takes one stroke as it comes off the lip, then WORK it, and
// it takes one a tap. That is how a flip and a roll come round off a ramp
// no craft could carry one off in a single pull.
//
// A STROKE IS ALL OR NOTHING, AND IT LIVES AT THE TOP OF THE AXIS. Below
// the gate (`flight.pumpGate`, `.whipGate`) a lean is TRIM and a steer is
// steering: they buy the hold's own torque (`flight.ts`) and not a turn of
// the hull. At or past it, every fresh crossing is one whole impulse. That
// line is the whole of what keeps the trick out of the ride, and it is
// drawn where it is because a rider crossing a real sea trims constantly —
// a touch back over a crest, a touch forward down its face, a touch of
// lock to hold a line — and a threshold set anywhere a trim lives cannot
// tell the two apart. Maxing an axis is a thing nobody does by accident;
// leaning a tad is a thing everybody does every second.
//
// YOU CANNOT START A TRICK ON THE WAY DOWN. The FIRST stroke of a flight
// is only spent by a hull that is still going UP, because a rider leaning
// back as he falls is a rider reaching for his landing and must not be
// handed a flip for it. Once he has committed to one going up he IS
// committed (`CraftState.tricking`), and every stroke after it is his to
// throw whichever way the hull is going — which is what lets a flip
// started off the lip be worked the whole way down to the water.
//
// A DECK, AND NOT A CREST. The hold carried across the gate is paid at a
// RAMP's lip and nowhere else, and the difference is the whole of `armed`:
// a rider crossing a real sea has the bars over for most of it, and the
// water drops out from under him at the top of every second wave. Paying
// the lock he was already carrying bought him most of a barrel roll off a
// crest he did not jump. So the crossing is ARMED against whatever the
// water was left with: off a crest the line he was riding was crossed down
// there and is worth nothing up here, and a stroke is something he STARTS
// — a tap, or the bars carried over the gate — once the hull is already up.
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

/** Spend one whole stroke on the pitch rate, nose-up (−wx), out of what is
 * left of this flight's budget. `authority` is the craft's own
 * `riderAuthority` and `ix` its pitch inertia — the two numbers that make
 * the same haul worth five times as much on a stand-up as on a tourer.
 *
 * Every haul latches `tricking`: the flight this landed on is a trick from
 * here to the water, whichever way the hull is going by then. */
function haul(c: CraftState, authority: number, ix: number): void {
  const room = Math.max(F.pumpCeiling * authority - c.pumped, 0);
  const rate = Math.min((F.pump * authority) / ix, room);
  if (rate <= 0) return;
  c.wx -= rate;
  c.pumped += rate;
  c.yank = 1;
  c.tricking = true;
}

/** ...and the same on the ROLL rate, `side` down (+1 is the bars over to
 * the right, and a right-side-down roll is −z — `flight.ts` owns the
 * convention). `iz` is the roll inertia, the smallest of the three, which
 * is why the same impulse starts four times the rate here — and why the
 * air's damping takes it away again just as fast (`defs/flight.ts`). */
function throwOver(c: CraftState, authority: number, iz: number, side: number): void {
  if (side === 0) return;
  const room = Math.max(F.whipCeiling * authority - c.whipped, 0);
  const rate = Math.min((F.whip * authority) / iz, room);
  if (rate <= 0) return;
  c.wz -= side * rate;
  c.whipped += rate;
  c.whip = side;
  c.tricking = true;
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
 * - And not a hull DROPPING off a crest, which is the `launchVy` clause: a
 *   rider leaning back through a head sea is levelling, not pumping, and
 *   the bot's own levelling PD asks for exactly that.
 *
 * `rising` is the hull still going UP this step, and it is what the FIRST
 * stroke of a flight needs on top of all that — the rule stated at the head
 * of this file. `launchVy` says the flight BEGAN going up, which a flight
 * past its apex still satisfies; this says the rider is asking NOW, while
 * there is still something to ask for.
 *
 * Let the input go before the line and the stroke goes with it: a touch of
 * lean off a lip is not a flip, and a touch of lock is not a roll.
 *
 * `onDeck` is the other half of the gate, and it decides what the flight
 * INHERITS rather than what it may spend. A hull riding a ramp is a rider
 * setting a trick up, so its crossings are cleared and the hold he carried
 * up the deck is one stroke at the lip. A hull on the water is a rider
 * RIDING, so a crossing he is already over is marked as made and the same
 * hold off a crest is worth nothing. Between the two — airborne, but short
 * of the line above — nothing is written at all: that reading was taken at
 * the last contact and re-arming inside a flight would take a rider's own
 * throw off him a fifth of a second after he made it. */
export function stepStrokes(
  c: CraftState,
  spec: CraftSpec,
  I: Vec3,
  input: CraftInput,
  flying: boolean,
  onDeck: boolean,
  rising: boolean,
): void {
  // Whether this step gets to say what the next flight starts from: the hull
  // has something under it, so whatever the rider is holding is technique for
  // the water rather than a stroke in the air. Read off `CraftState.airborne`,
  // which `craft.ts` has already settled for this step, and only ever read
  // below where the hull is not flying — `flying` implies `airborne`, so the
  // two are never both true.
  const armed = !c.airborne;
  // Whether a stroke may be STARTED at all: going up, or already committed
  // to a trick that was. Both axes read the one answer, so a flip opened off
  // the lip leaves the rider free to throw a roll into it on the way down.
  const may = c.tricking || rising;
  if (!flying) {
    // Nothing is hauled against the water or a deck: every flight starts
    // both budgets fresh, and starts as no trick at all.
    c.pumped = 0;
    c.whipped = 0;
    c.tricking = false;
  }

  // THE PUMP, on the lean-back half of the lean axis. Pulling only: a rider
  // standing on the hull has nothing to push the nose down against.
  const back = Math.max(clamp(input.lean, -1, 1), 0);
  if (!flying) {
    if (armed) c.pumpCrossed = !onDeck && back > F.pumpGate;
  } else if (back <= F.pumpGate) {
    // Back to trim, so the next time the bars come across the gate it is a
    // fresh haul. This is also why a key HELD is one haul: the crossing it
    // made is never un-made while it is held.
    c.pumpCrossed = false;
  } else if (!c.pumpCrossed && may && c.yank <= F.pumpReady) {
    // A FRESH HAUL, worth the whole of `pump` out of what the flight has
    // left. That is the version a player can read off the hull — tap, it
    // turns faster; tap, it turns faster again; tap, and nothing more
    // happens, because the budget is spent.
    haul(c, spec.riderAuthority, I.x);
    c.pumpCrossed = true;
  }

  // THE WHIP, on the steer axis, with a SIDE in front of it. Its gate is
  // its own (`flight.whipGate`) and higher than the pump's, because the
  // bars are in the rider's hands all the way down a straight and a
  // sideways throw has to be unmistakably a throw.
  const steer = clamp(input.steer, -1, 1);
  const side = steer > 0 ? 1 : steer < 0 ? -1 : 0;
  const over = Math.abs(steer);
  if (!flying) {
    if (armed) {
      c.whipCrossed = !onDeck && over > F.whipGate;
      c.whipSide = onDeck ? 0 : side;
    }
  } else if (side !== 0 && c.whipSide !== 0 && side !== c.whipSide) {
    // THE BARS HAVE CROSSED THE CENTRE. Whatever throw was running is over
    // — his hands and his weight went with them — and the other side starts
    // uncrossed. It is what lets a rider stop a roll he has started and
    // open one the other way, out of the same budget; and it is read here
    // rather than left to the gate below because a thumb that leaves the
    // glass hard over one way and lands hard over the other crosses the
    // centre in ONE step, without ever being read down at trim.
    c.whipSide = side;
    c.whipCrossed = false;
  } else if (over <= F.whipGate) {
    c.whipCrossed = false;
  } else if (!c.whipCrossed && may && Math.abs(c.whip) <= F.pumpReady) {
    throwOver(c, spec.riderAuthority, I.z, side);
    c.whipSide = side;
    c.whipCrossed = true;
  }
}
