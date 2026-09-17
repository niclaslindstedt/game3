// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HULL UNDER THE WATER — `TUNING.submerged`, stated here and folded
// into the one tuning object next door under that name, the way the air
// (`defs/flight.ts`), the assist and the sea are: `tuning.ts` has the
// §20.5 cap over it, and this is one subject with one owner
// (`craft-physics`), one module (`game/submerged.ts`), one lab (`make
// ride`) and one page of benches (`docs/riding.md`).
//
// Three things are dialled: what the rider COMMANDS down there, how long
// he is GIVEN before the water takes the hull off him, and what his body
// costs in a medium eight hundred times denser than the one it was in.

/** THE HULL UNDER THE WATER (`submerged.ts`). Every control dial is an
 * angular ACCELERATION, rad/s², at a full input and a full share, the way
 * `stand.hoist` is and for the same reason: the roster's inertia spans
 * three times over, and what this describes is the rider rather than any
 * one hull. Scaled by the craft's own `riderAuthority` on top. */
export const SUBMERGED = {
  /** The regime itself has no threshold to set: it is the product of the
   * hull's own two readings (`submergedShare` — the whole bottom under,
   * times the water over the deck), which is 0 at rest on every craft
   * and 1 only when the hull has left the surface. What is dialled here
   * is what the rider does with it.
   *
   * His pitch: the bars hauled back, with the whole hull as the lever
   * and the water to push it against. Bigger than the air's
   * (`flight.leanTorque` is about 1.7 rad/s² on the skiff) and smaller
   * than a full stand's (`stand.hoist`, 4.6) — he is holding on rather
   * than standing on it, but he is holding on to something solid. This
   * is the dial the trick is made of: nose-down and under, lean back and
   * the jet that was driving him deeper is driving him out. */
  lean: 3.8,
  /** His roll — enough to bring a hull that went in on one chine back
   * level before the surface decides it capsized — and his yaw, which is
   * modest because the nozzle is still working down there and owns most
   * of it. */
  roll: 2.4,
  yaw: 0.6,
  /** How much of the DECK's sealed volume (`hull.deckShare`) is still
   * float once the hull is fully under, 0..1 (`floodedDeck`). The rest
   * of it is the footwells, the seat and the engine bay's hatch, all of
   * which have water over them rather than air under them the moment the
   * deck is a metre down. At 1 the hull is thrown back out by about three
   * times its own weight and a bury lasts three tenths of a second,
   * which is not a dive. */
  deckSealed: 0.3,

  /** THE SPELL: when the hull IS under, as a latch on `submergedShare`
   * with a gap between going in and coming out (`CraftState.under`). It
   * goes under once a quarter of the share is there — the deck half
   * swallowed with the bottom half under, which is a hull stood on its
   * nose with its transom still at the surface as much as one driven
   * flat under — and is out again only once the deck is mostly clear —
   * two lines rather than one because a hull surfacing through a seaway
   * has the water lapping the deck for a second, and one line read twice
   * a wave would cut a ten-second dive into twenty spells and never start
   * the clock below. Measured over the roster on four seeds and a gale
   * with the bot riding: `submergedShare` is over the entry line in under
   * 1.5 % of steps, and no ordinary spell over it lasts half a second
   * (`docs/riding.md`), so green water over the deck is not a dive. */
  enter: 0.25,
  leave: 0.1,
  /** ...and how long a spell has to last, s, to be UNDER TIME at all —
   * `flight.airCounts` for the water: the clock a readout shows, the
   * seconds the score pays and the `submerge` event all start here, so a
   * deck swallowed by one wave is a wave and not a dive. */
  counts: 0.5,

  /** HOW LONG THE RIDER IS GIVEN, s. With the throttle open he is riding
   * it — depth against thrust, tens of metres — and has this long before
   * the water takes the hull off him; with the throttle SHUT he has let
   * it go, and this much later the hull is brought up for him
   * (`floatUp`). The second is the rider's own way out of a dive at any
   * moment, and it costs him the combo the way a capsize does: the hull
   * that comes up was not ridden up. `gas` is where the lever counts as
   * open, 0..1, a dead band for an analogue lever rather than a knob. */
  hold: 10,
  holdIdle: 1,
  gas: 0.1,

  /** THE FLOAT-UP: the hull turned to the surface the right way up once
   * the rider's time is out, with its nose `riseNose` rad above the
   * horizon so it surfaces bow first and lands flat rather than corking
   * out on its back. Turned the way the capsize's righting turns a hull
   * (`floatUpPose`): the orientation itself, over the lag `riseLag`, s,
   * with the body rates held at zero — a torque was benched and could not
   * be both quick and gentle against the water's quadratic grip on a
   * turning hull — and its HEIGHT eased to the surface over the same lag,
   * the righting's own road up: left to its buoyancy a hull turned
   * upright under a storm sea climbed toward a surface moving away from
   * it. The lag is a quarter of a second, so the hull is within a few
   * degrees of upright and at the surface inside a second, which is the
   * capsize's own righting time. It holds until the hull is out AND upright (`up.y`
   * past `uprightDone`), because a hand that let go at the surface left a
   * hull on its side for the capsize to find, and the capsize's own clock
   * waits on it — for at most `holdUp` seconds, after which a hull the
   * hand could not bring up (held under, aground) is the capsize's after
   * all. */
  riseLag: 0.25,
  riseNose: 0.45,
  uprightDone: 0.7,
  holdUp: 4,

  /** THE RIDER'S BODY IN THE WATER, m² of drag area — the one thing the
   * hull's probes cannot see, and the reason a bury is a shove. He is
   * folded down behind the bars the moment the deck goes under
   * (`CraftState.crouch` is driven to 1 by the spell, on the tuck's own
   * lag), and the tuck's `dragCut` comes off this exactly as it comes off
   * `spec.cdA` in the air: a smaller hole in the water for the same
   * reason it is a smaller hole in the air. Quoted small — the sat-up
   * body would be ten times this — because the hull's own drag is
   * already the arcade's and a rider stopped dead by his chest is a dive
   * nobody rides out of. It acts at the rider's height, so it is a
   * nose-up couple as well as a brake, which is the water lifting the
   * bow of a hull going forwards and pushing it down on one going
   * backwards. */
  riderCdA: 0.05,
} as const;
