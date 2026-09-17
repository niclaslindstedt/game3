// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCORE — what a rider is paid for the parts of a run the clock does
// not measure. Time is the race; this is the other game on the same water,
// and it is the arcade skating one: points TICK while a trick is being
// held, every element won raises a MULTIPLIER over the whole run of them,
// and nothing is yours until you are back on the water with the craft under
// you. Fall off it and the lot goes.
//
// WHAT IS SCORED, because these are what a rider can reach: the time the
// hull spends off the water, the revolutions it turns nose-over-tail while
// it is up there (THE PUMP throws one: `TUNING.flight.pump`), the
// revolutions it turns about its own length (THE WHIP: `TUNING.flight.whip`)
// and the CORKSCREW of having both come round in one flight, the flight
// itself as an element beside any of them, THE TIME IT SPENDS UNDER THE
// WATER (`submerged.ts`), which is the air's mirror on the other side of
// the surface and paid by the same rule, with the SUBMARINE the element a
// clean surfacing wins — and the two a rider turns without leaving the
// surface at all: the top of a wave HELD and run along (`wave-ride.ts`),
// and the hull LAID OVER and brought back up. A hull on its tail and a
// trick taken off a buoy are the same machinery with another term in it —
// `TrickState` is shaped for them and this module is where they land.
//
// THE EIGHT RULES, and the reason each is the shape it is:
//
// 1. AIR TIME PAYS BY THE SECOND, AT A RATE THAT RISES WITH THE FLIGHT.
//    The rate is logarithmic in how long the hull has been up
//    (`airPointsPerSecond`), so every further second is worth more than the
//    one before it while the rate itself never runs away. A flight's whole
//    purse is that rate integrated, which makes it grow rather faster than
//    the flight does: half a second is worth almost nothing, one second is
//    a jump, and the twenty a rider gets thrown for by the open ocean is a
//    hundred times the one — which is the point. A rider who clears a
//    two-metre chop is not doing what a rider going over the top of a storm
//    sea is doing, and a score that paid them per second alike would say
//    they were.
//
// 2. A REVOLUTION RAISES THE MULTIPLIER, AND THE NEXT ONE RAISES IT MORE.
//    The first backflip of a flight is worth one step of multiplier and
//    `flipPoints` of base; the second is worth two steps and twice the
//    base; the third, three and three times. So a single is ×2 and a double
//    is ×4 rather than ×3 — a double backflip is not two backflips, it is a
//    much harder trick that happens to be measured in revolutions, and the
//    ladder has to say so or nobody will ever go for the second one. A
//    revolution about the hull's LENGTH — the side spin — climbs the same
//    ladder off `rollPoints`, and climbs it separately: the two axes are
//    counted apart, so a flip with a roll in it is two first revolutions
//    (×3) and not one second one.
//
// 3. ...AND SO DOES THE AIR THEY WERE TURNED IN, ONCE SOMETHING WAS TURNED
//    IN IT. A flight past `airElement` is an element of the combo like any
//    other and worth one step — but it is only ever CREDITED beside a
//    trick, and only once per combo. Both halves of that are load-bearing.
//    Credit it on its own and every jump on the course reads ×2, which is a
//    multiplier that has stopped saying anything; credit it per flight and a
//    rider could climb the ladder by hopping off crests. Paid this way it
//    says the thing worth saying: a trick turned in real air is worth more
//    than the same trick scraped off a wave. It adds NO base — the air is
//    already paid by the second, and paying it twice would be the same
//    seconds bought at two prices.
//
// 4. NOTHING IS BANKED UNTIL THE COMBO CLOSES. The base and the multiplier
//    ride together for as long as the rider keeps the run alive: while the
//    hull is up, while it is UNDER, and for `linkWindow` seconds after it
//    is back on the water, so one landing straight into the next launch is
//    ONE combo at one multiplier rather than two small ones. The window
//    running out banks `base × mult` into the run's score. Going over the
//    bars — a capsize, the water bringing the hull up for him (the
//    float-up), or the rider putting himself back at a gate — banks
//    nothing at all.
//
// 5. THE WATER PAYS LIKE THE AIR, AND A CLEAN SURFACING IS A TRICK. A hull
//    under the water (`CraftState.under`) ticks the same by-the-second
//    rate the air does, on its own clock, from the same half-second line
//    (`submerged.counts`) — a deck swallowed by a wave is a wave. Come back
//    out UNDER THE RIDER — the right way up, before the float-up has to
//    bring it up — after `diveElement` of it, and that is the SUBMARINE:
//    one step of multiplier and nothing on the base, because the seconds
//    are already paid, exactly as the air's rung is. Unlike the air it is
//    credited on its own, because a hull that came up clean was RIDDEN up
//    and a plain jump is not ridden. It SELLS THE AIR too: a flight that
//    ends in a dive keeps its rung in hand through the water, so a jump
//    dived into and ridden back out of is the air and the submarine in one
//    combo. A bow merely buried on a landing (`dive`) is no longer a bail:
//    it is the start of something, or it is nothing, and the float-up says
//    which.
//
// 6. BOTH AXES IN ONE FLIGHT ARE A THIRD THING: THE CORKSCREW. Won the
//    moment the second of the two comes round, whichever order they came
//    in, for `corkscrewPoints` of base and one step — and once per flight,
//    so a combo that corks two linked flights is paid for both. The
//    revolutions are already paid at their own index; what this prices is
//    the COMBINATION, which is what makes it different from the same two
//    turns taken off two waves in a row. It lands between the two turns and
//    a double of either: 5 400 against 3 100 and 7 300.
//
// 7. THE TOP OF A WAVE IS PAID THE WAY THE AIR IS, and for the air's
//    reason: it is a moment HELD rather than a thing done, so it ticks
//    (`wavePointsPerSecond`, the air's curve at a quieter rate) and past
//    `waveElement` it is an element in its own right. What counts as being
//    on the crest is `wave-ride.ts`'s and stated once there — a wave with a
//    metre in it, the hull in the top tenth of it, and the rider making
//    way. Like the submarine and unlike the air, the element stands ALONE:
//    every ramp on the course hands a rider a flight and nothing anywhere
//    hands him a crest.
//
// 8. A LAYDOWN IS THE ONE ELEMENT THAT NEEDS NEITHER AIR NOR A WAVE — the
//    hull heeled past `laydownAngle` and brought back level, won on the way
//    back up. It is priced under a revolution because the hull never passes
//    its own beam ends, and it is bounded at `laydownOver` because past
//    there the rider is not laying it down, he is going over.
//
// The engine only ever says what happened: `trick`, `combo` and `bail`
// events carry the beat a presentation pulses on, and `TrickState` carries
// the numbers and the ELEMENT LIST it reads. No word for any of it is here
// — the names live in the one table every line the player reads comes from
// (`pwa/src/game/strings.ts`). Nothing here draws, and nothing here is
// random: a run replays to the same score.

import { TUNING } from "./defs/tuning.ts";
import type { GameEvent, GameState, TrickKind, TrickState } from "./state.ts";
import { ridingCrest, underWay, waveUnder, type WaveUnder } from "./wave-ride.ts";

const T = TUNING.tricks;
const TAU = Math.PI * 2;

/** What a second of air is worth `seconds` into a flight, points/s.
 *
 * `log2(1 + t/knee)`: worth `airRate` a second at one knee in, half again
 * that at three knees, and about four and a half times it at the twenty
 * seconds only the open ocean and the tornado deal. The knee is the unit
 * the whole curve is quoted in, so moving it moves where "an ordinary jump"
 * sits without changing the shape of the ladder above it.
 *
 * Under `TUNING.flight.airCounts` this is never asked: a hull skipping off
 * a crest did not go anywhere (`craft.ts` says why the line is there), and
 * a score that paid for it would tick all the way through a head sea. */
export function airPointsPerSecond(seconds: number): number {
  return T.airRate * Math.log2(1 + Math.max(0, seconds) / T.airKnee);
}

/** ...and what a second on the top of a wave is worth `seconds` into the
 * ride, points/s. The air's own curve at the crest ride's own rate, and
 * deliberately so: the two are the same KIND of thing — a moment HELD
 * rather than a thing done — so a rider reads one ladder and not two, and
 * the only claim the lower rate makes is that a crest is the quieter of the
 * two moments. (The water under the surface is paid at the air's own rate
 * rather than this one, because being under is the air's mirror — rule 5.) */
export function wavePointsPerSecond(seconds: number): number {
  return T.waveRate * Math.log2(1 + Math.max(0, seconds) / T.waveKnee);
}

export function freshTricks(): TrickState {
  return {
    score: 0,
    base: 0,
    mult: 1,
    link: 0,
    rotation: 0,
    spins: 0,
    roll: 0,
    rolls: 0,
    aired: false,
    airPaid: false,
    corked: false,
    riding: false,
    rideTime: 0,
    waved: false,
    heeled: 0,
    parts: [],
    flight: 0,
    last: 0,
    lastAt: 0,
    lastBailed: false,
    lastParts: [],
  };
}

/** AN ELEMENT WON. Everything a trick does to the combo is here, so the two
 * axes and the air cannot drift apart: the air's own rung is taken first
 * (rule 3, and taking it first is what makes the flashed line read in the
 * order the rider earned it), then the element's base and its step, then
 * the beat.
 *
 * `spins` is which revolution of this flight it was, and it is the whole of
 * the ladder: N times the base and N steps of multiplier. */
function win(
  state: GameState,
  events: GameEvent[],
  kind: TrickKind,
  spins: number,
  points: number,
): void {
  const k = state.tricks;
  if (k.aired && !k.airPaid) {
    k.airPaid = true;
    k.mult += 1;
    k.parts.push({ kind: "air", spins: 1, flight: k.flight });
    events.push({ kind: "trick", t: state.t, trick: "air", spins: 1, points: 0, mult: k.mult });
  }
  k.base += points;
  k.mult += spins;
  // AN ELEMENT WON IS THE COMBO IN PLAY, wherever it was won. Set here
  // rather than by each caller because an element that opened no window
  // would bank on the next step: the laydown is turned on the water, where
  // nothing else is holding the combo up.
  k.link = T.linkWindow;
  k.parts.push({ kind, spins, flight: k.flight });
  events.push({ kind: "trick", t: state.t, trick: kind, spins, points, mult: k.mult });
}

/** Close the combo and pay it into the run's score. */
function bank(state: GameState, events: GameEvent[]): void {
  const k = state.tricks;
  const points = Math.round(k.base * k.mult);
  events.push({ kind: "combo", t: state.t, points, base: Math.round(k.base), mult: k.mult });
  k.score += points;
  k.last = points;
  k.lastAt = state.t;
  k.lastBailed = false;
  k.lastParts = k.parts;
  k.parts = [];
  k.flight = 0;
  k.base = 0;
  k.mult = 1;
  k.link = 0;
  k.airPaid = false;
}

/** Drop the combo on the floor: the rider went over the bars, or put
 * himself back at a gate. The run's banked score is untouched — it was
 * already paid — and only what was still riding on this combo is lost. */
function bail(state: GameState, events: GameEvent[]): void {
  const k = state.tricks;
  const lost = Math.round(k.base * k.mult);
  if (lost > 0) {
    events.push({ kind: "bail", t: state.t, lost });
    k.last = lost;
    k.lastAt = state.t;
    k.lastBailed = true;
    k.lastParts = k.parts;
  }
  k.parts = [];
  k.flight = 0;
  k.base = 0;
  k.mult = 1;
  k.link = 0;
  k.rotation = 0;
  k.spins = 0;
  k.roll = 0;
  k.rolls = 0;
  k.aired = false;
  k.airPaid = false;
  k.corked = false;
  k.riding = false;
  k.rideTime = 0;
  k.waved = false;
  k.heeled = 0;
}

/** THE RIDER PUT BACK AT A GATE — everything riding on the combo goes with
 * him. Called from the reset path in `step.ts`, which returns before the
 * craft is stepped at all. */
export function resetTricks(state: GameState, events: GameEvent[]): void {
  bail(state, events);
}

/** THE BUZZER (`rules.limit`, `step.ts`): whatever the combo has in hand is
 * paid as the link window would have paid it. The run is over and the
 * rider is on the craft or he is not — a bail is a capsize or a dive and
 * both have already had their say by the time the clock reads zero — so a
 * flip landed on the last second is a flip he is paid for. Nothing to pay
 * is nothing done. */
export function closeCombo(state: GameState, events: GameEvent[]): void {
  if (state.tricks.base > 0) bank(state, events);
}

/** The wave under the hull, read once a step into one object the module
 * keeps: `stepTricks` runs for the player and for every rival in turn and
 * none of them holds the reading past its own step. */
const under: WaveUnder = { height: 0, share: 0 };

/** THE TOP OF A WAVE, HELD (rule 7). What counts as being on one is
 * `wave-ride.ts`'s and asked here; what it is WORTH is this module's. The
 * hold is one ride for as long as it lasts — the element is bought once and
 * the seconds tick throughout — and the ride ending is what arms the next
 * one, so a rider chains crests by coming off one and catching another. */
function stepWave(state: GameState, events: GameEvent[]): void {
  const k = state.tricks;
  const c = state.craft;
  // The free half of the question first: the sweep below is nine samples of
  // the sea and a rider who is not going anywhere cannot be riding one.
  const on =
    underWay(c) &&
    ridingCrest(c, waveUnder(state.sea, state.level, c.x, c.z, state.t, under), k.riding);
  if (!on) {
    k.riding = false;
    k.rideTime = 0;
    k.waved = false;
    return;
  }
  k.riding = true;
  k.rideTime += TUNING.dt;
  k.base += wavePointsPerSecond(k.rideTime) * TUNING.dt;
  // The ride holds the combo open the way a flight does; the window is what
  // the rider has after he comes off it.
  k.link = T.linkWindow;
  if (!k.waved && k.rideTime >= T.waveElement) {
    k.waved = true;
    // No base, for the air's reason: the seconds are already paid and are
    // not sold twice.
    win(state, events, "wave", 1, 0);
  }
}

/** THE HULL LAID OVER AND BROUGHT BACK (rule 8) — read off the roll angle
 * alone, because that is the whole trick: how the rider got it over there
 * is his business.
 *
 * What is carried is the PEAK of the heel rather than a latch, and it has
 * to be: a hull thrown onto its beam ends comes back THROUGH the laydown's
 * own band on its way up, and a latch armed in there would pay a capsize
 * saved as a trick turned. The peak is judged once, when the hull is level
 * again, and it has to fall inside the band at both ends. */
function stepLaydown(state: GameState, events: GameEvent[]): void {
  const k = state.tricks;
  const c = state.craft;
  if (!underWay(c)) {
    k.heeled = 0;
    return;
  }
  const heel = Math.abs(c.roll);
  if (heel > k.heeled) k.heeled = heel;
  if (heel > T.laydownLevel) return;
  const peak = k.heeled;
  k.heeled = 0;
  if (peak >= T.laydownAngle && peak <= T.laydownOver) {
    win(state, events, "laydown", 1, T.laydownPoints);
  }
}

/** One fixed step of the score, run after the craft has been stepped and
 * has left this step's `launch`, `land`, `dive` and `capsize` on the
 * events: the craft says what the hull did, and this decides what it was
 * worth. */
export function stepTricks(state: GameState, events: GameEvent[]): void {
  const k = state.tricks;
  const c = state.craft;
  const dt = TUNING.dt;

  // WHICH FLIGHT OF THE COMBO THIS IS, off the hull's own launch rather
  // than a state edge of this module's: a rider who takes a flip off one
  // wave and a roll off the next has not done what a rider who turns both
  // in one flight has, and the elements carry which it was so a readout can
  // name them apart (`TrickPart.flight`).
  for (let i = 0; i < events.length; i++) {
    if (events[i].kind === "launch") k.flight += 1;
  }

  // THE SUBMARINE (rule 5): a spell that ended under the rider, after long
  // enough to be one. Read off the craft's own `surface` rather than a
  // state edge of this module's, for the reason the flights are counted
  // off `launch` — and read BEFORE the water's branch below, which on this
  // same step sees a hull back on the water and lets the air's rung go:
  // the rung has to be sold while it is still in hand.
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "surface" && e.clean && e.underTime >= T.diveElement) {
      win(state, events, "submarine", 1, 0);
    }
  }

  if (c.airborne) {
    // HOW FAR THE HULL HAS GONE OVER, rad, on each of the two axes a rider
    // can turn it about — nose-up positive for the flip (−wx), right side
    // down positive for the roll (−wz). The BODY-FRAME rates are the two
    // axes whatever attitude the craft is in (the hull's own beam and its
    // own length), so summing them while aloft is the rotation itself
    // rather than a reading off the Euler angles, which wrap and which
    // would confuse one axis for the other. Both sum to about nothing in
    // chop, so a hull being thrown about cannot accumulate a trick.
    k.rotation -= c.wx * dt;
    k.roll -= c.wz * dt;
    while (Math.abs(k.rotation) >= (k.spins + 1) * TAU) {
      k.spins += 1;
      win(
        state,
        events,
        k.rotation > 0 ? "backflip" : "frontflip",
        k.spins,
        T.flipPoints * k.spins,
      );
    }
    while (Math.abs(k.roll) >= (k.rolls + 1) * TAU) {
      k.rolls += 1;
      win(state, events, "roll", k.rolls, T.rollPoints * k.rolls);
    }
    // BOTH AXES IN ONE FLIGHT (rule 6): the third thing the rider did by
    // doing the other two at once. Won as the second of them comes round —
    // whichever order they came in — and once per flight, so a combo that
    // corks two linked flights is paid for both. The revolutions themselves
    // have already been paid at their own index; what this adds is the
    // combination.
    if (!k.corked && k.spins > 0 && k.rolls > 0) {
      k.corked = true;
      win(state, events, "corkscrew", 1, T.corkscrewPoints);
    }
    // THE WATER IS BEHIND HIM, so anything it was holding is over: the
    // crest he left is not the crest he lands on, and a hull heeled over as
    // it launched must not be paid a laydown for landing level.
    k.riding = false;
    k.rideTime = 0;
    k.waved = false;
    k.heeled = 0;
    // THE AIR AS AN ELEMENT (rule 3) — in hand from here, and sold only by
    // the next trick to land. A flight is either long enough or it is not,
    // so this is set and never unset until the water takes it.
    if (c.airTime > T.airElement) k.aired = true;
    if (c.airTime > TUNING.flight.airCounts) {
      k.base += airPointsPerSecond(c.airTime) * dt;
      // The flight itself holds the combo open; the window is what the
      // rider has AFTER it. Reset here rather than on the `land` event so a
      // flight that ends against a rock still leaves a full window.
      k.link = T.linkWindow;
    }
  } else {
    k.rotation = 0;
    k.spins = 0;
    k.roll = 0;
    k.rolls = 0;
    k.corked = false;
    if (c.under) {
      // Nothing on the SURFACE is in progress down here: a hull under the
      // water is neither on a crest nor laying one over, and rule 5 is what
      // pays for where it is instead.
      k.riding = false;
      k.rideTime = 0;
      k.waved = false;
      k.heeled = 0;
      // UNDER THE WATER (rule 5): the same rate on the spell's own clock,
      // and the combo held open the way a flight holds it. `aired` is
      // kept — the air a rider dived out of is still his to sell. Nothing
      // ticks once the float-up has the hull: those seconds are the
      // water's, and the bail below has already had the combo.
      if (c.underTime > TUNING.submerged.counts && !c.floatUp) {
        k.base += airPointsPerSecond(c.underTime) * dt;
        k.link = T.linkWindow;
      }
    } else {
      // The air stays in hand for the half second it takes to know whether
      // the landing was a dive (`submerged.counts`): a hull goes in, is on
      // the water for a few steps, and only then is under, and a rung
      // cleared in between could never be sold through the water. Nothing
      // else can sell it in that half second — a revolution takes longer.
      if (c.landing > TUNING.submerged.counts) k.aired = false;
      stepWave(state, events);
      stepLaydown(state, events);
      if (k.base > 0) {
        k.link -= dt;
        if (k.link <= 0) bank(state, events);
      }
    }
  }

  // GOING OVER THE BARS. A capsize is the hull on its back; a float-up is
  // the water bringing up a hull the rider could not, which is the same
  // loss made under the surface. Both arrive inside the link window, which
  // is exactly the combo they should take with them. A `hit` is not one of
  // them: a hull glancing off a skerry is still under its rider, and the
  // run goes on. Nor is a `dive` — a bow buried on the landing is the
  // start of a spell the rider may yet ride out of, and the float-up says
  // when he did not.
  for (let i = 0; i < events.length; i++) {
    const kind = events[i].kind;
    if (kind === "capsize" || kind === "floatUp") {
      bail(state, events);
      return;
    }
  }
}
