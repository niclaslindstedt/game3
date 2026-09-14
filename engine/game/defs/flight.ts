// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR OVER THE WATER, and what the rider does up there — `TUNING.tuck`
// and `TUNING.flight`, stated here and folded into the one tuning object
// next door under exactly those names. It lives beside `tuning.ts` rather
// than inside it for the same reason the assist and the sea do: that file
// has the §20.5 cap over it, and this is one subject with one owner
// (`craft-physics`), one lab (`make ride`) and one page of benches
// (`docs/riding.md`).
//
// Two blocks because they are two things, and they are together because
// neither reads without the other: the tuck is the rider FOLDED DOWN, and
// most of what it costs him is the authority the flight block hands him.
//
// THE TWO STROKES are flight numbers (`pump*`, `whip*`) because neither is
// ever spent anywhere else — a stroke earned on the water is a stroke
// thrown away. `game/strokes.ts` owns the mechanism they share.

/** THE TUCK (`CraftInput.crouch`): the rider down behind the bars.
 * `dragCut` is the measurement; the rest is what it costs, and the costs
 * are not a tax but the same body — every one is a lever the rider works
 * with their own mass or reach, and a man folded down has less of both.
 * `docs/riding.md` carries where the 18 % comes from and what the bench
 * says it buys: about a km/h flat and calm, twice that into a blow,
 * because a watercraft is stopped by the WATER and not by the air. */
export const TUCK = {
  /** How long the rider takes to get down and back up, s — a body, not a
   * switch, so a tuck snatched into a buoy is still being paid off at
   * the apex. */
  lag: 0.22,
  /** Share of `spec.cdA` a full tuck takes off, 0..1. */
  dragCut: 0.18,
  /** ...and how much of `flight.windageY` is left with the shoulders
   * down, 0..1: what is still up there is mostly hull, so the push acts
   * lower and rolls the craft less in a crosswind. */
  windageLeft: 0.6,
  /** Share of the rider's weight shift lost at a full tuck, 0..1 —
   * `rider.leanReach` and `rider.leanIn` both. Most of the cost, because
   * hanging off IS the turn on a watercraft, and why the stand-up pays
   * most. */
  leanCut: 0.42,
  /** Share of the steering lock a tucked rider can still ask for, 0..1:
   * elbows in and chin on the bars has no full sweep of the bars in it.
   * The nozzle's maximum (`limits.ts`) does not move; the reach does. */
  lockLeft: 0.82,
  /** Share of the rider's authority IN THE AIR that survives, 0..1
   * (`spec.riderAuthority`, and so the hold, the roll and the yaw in
   * `flight.ts`): folded up there is much less of the rider to throw the
   * craft about with, so landing a jump tucked is a bad idea on purpose. */
  airLeft: 0.45,
} as const;

/** FLIGHT (`flight.ts`): the air over the water. */
export const FLIGHT = {
  /** The rider's pitch authority in the air, N·m at full lean — the HOLD,
   * sized for attitude: a lean held forward through a 0.7 s hang puts
   * the nose 20–30° down, not on the water's floor. */
  leanTorque: 450,
  /** THE PUMP: the angular impulse, N·m·s, one YANK on the bars is
   * worth. Nose-up only — a rider stood on the hull has nothing to push
   * the nose down against — and together with the hold it is what a
   * backflip is made of.
   *
   * A yank is EARNED every time the lean-back input is carried across
   * `pumpGate`, and SPENT the moment the hull is light enough to be thrown
   * with the lean still back. So one input does both jobs a rider does with
   * it: hold it back up a RAMP'S DECK and the hull takes one yank at the
   * lip, TAP it — again and again through a hang — and it takes one a tap,
   * which is how a flip comes round off a ramp no craft could carry one off
   * in a single pull.
   *
   * A DECK, and not a crest: what a flight starts its mark from is what
   * was under the hull last (`strokes.ts`). The lean a rider trims a head
   * sea with is not a haul waiting to be spent on the next wave he leaves.
   *
   * What a yank is worth is the craft's own and nothing here: `pump ·
   * riderAuthority / I_x` spans 1.1 rad/s on the tourer to 5.7 on the
   * stand-up, so how many taps a flip costs IS the archetype, and no
   * craft carries a knob of its own for it. */
  pump: 620,
  /** THE GATE ON THE LEAN AXIS: how far back the input must be to be a
   * HAUL at all, 0..1. Below it the lean is trim and buys nothing but the
   * hold's own torque; at or above it, every fresh crossing is one whole
   * yank (`strokes.ts` — the stroke is all-or-nothing, and this is the
   * line it is all on one side of).
   *
   * UP AT THE TOP OF THE AXIS, and that is the whole point of it. A rider
   * crossing a real sea trims constantly — a touch back over a crest, a
   * touch forward down its face — and a threshold set where a trim lives
   * cannot tell the two apart: it read a rider holding his nose up through
   * a head sea as a rider asking for a backflip. So the trick is put where
   * nothing but a trick goes: the bars all the way back. Leaning a tad
   * corrects the attitude, and only MAXING it turns the hull.
   *
   * MEASURED against the ramp the app's keyboard puts on that axis
   * (`KEY_LEAN_ATTACK` / `KEY_LEAN_RELEASE` in `input-model.ts`, which
   * were quickened to this gate rather than the other way round): a press
   * of 0.1 s clears it and a flick of 0.05 s reaches 0.6 and does not, so
   * a hand can still tap out a flip and a hand can still trim. A player
   * HOLDING the key gets exactly one yank off a deck — one crossing is one
   * stroke however long it is held — and none at all off a crest, where
   * the crossing was already made on the water (`strokes.ts`).
   *
   * The bot reads this and caps its nose-up levelling lean AT it, which is
   * the whole of what keeps a levelling loop from flipping the hull: the
   * crossing is strictly above the gate, so a cap on the gate never
   * strokes. */
  pumpGate: 0.8,
  /** ...and the nose-up rate, rad/s, ALL the strokes of one spell may add
   * up to, times the craft's own `riderAuthority`. This is the bound on
   * the whole mechanism, and the reason there is no count of taps: it is
   * what one rider has to give one flight, and the tenth tap draws on
   * what the first nine left.
   *
   * It bounds THE PUMP'S OWN CONTRIBUTION (`CraftState.pumped`) and not
   * the hull's rate, which is the only version of it that works: a steep
   * ramp hands the hull 3 rad/s of nose-up at the hinge before the rider
   * has done anything, and a ceiling read off the total would answer a
   * pull off a good lip by cancelling most of it. Read this way the FIRST
   * haul of a spell is always the whole of `pump` — a lean held back off
   * a lip earns exactly what it has always earned — and the taps after it
   * divide what is left.
   *
   * How many taps that takes is the craft's, and it is the clearest thing
   * the archetypes do in the air: the stand-up is most of the way there on
   * its first yank, the tourer taps five or six times to get to the same
   * place, and a rider who stops tapping stops turning faster.
   *
   * 2π inside the 1.4–1.9 s of air a ramp the generator actually builds
   * (R8: 15–22°) gives is 3.3–4.5 rad/s, so this is the number that
   * decides whether a regular ramp flips at all — and scaling it by the
   * rider makes the ladder the roster's rather than the ramp's. */
  pumpCeiling: 8,
  /** How far a spent yank throws the rider back, m on top of
   * `rider.leanReach`, and how long it lasts, s. This is what the player
   * SEES when the taps land (`CraftState.yank` → `riderAft` → the pose),
   * and while it lasts it is a real nose-up couple off the rider's own
   * weight rather than a flourish. */
  yankReach: 0.3,
  yankFade: 0.45,
  /** ...and how far the last one must have FADED before the next haul
   * counts, 0..1 of it — the rider's weight has to come back before he can
   * throw it again. Against `yankFade` this is a floor of about an eighth
   * of a second between hauls, so a hand working the key at up to eight a
   * second loses nothing, and nothing FASTER than a hand can count.
   *
   * It is here because a controller is not a hand: the bot's levelling
   * loop hands the engine a raw PD output that oscillates at tens of hertz,
   * and every upswing of it read as a fresh haul. */
  pumpReady: 0.75,
  /** THE WHIP — the bars thrown OVER, and the pump's twin on the other
   * axis (`strokes.ts` owns both). What it buys is rotation about the
   * hull's own length: the SIDE SPIN, which is the one trick a rider can
   * ask for with the hand he is already steering with.
   *
   * THE SAME NUMBER AS THE PUMP, which looks like laziness and is a
   * measurement. Two effects of the axis very nearly cancel: a hull's roll
   * inertia is about a QUARTER of its pitch inertia (a box is easier to
   * turn about its length than about its beam — `hull.ts`'s `inertia`), so
   * the same N·m·s thrown sideways starts four times the rate; but the air
   * damps all three axes off one coefficient (`rotDamp`), and over a
   * quarter of the inertia that coefficient bleeds a roll away about four
   * times as fast — 0.53/s against pitch's 0.14/s on the skiff at 18 m/s.
   * What is easy to START here is hard to KEEP, and only the first of the
   * two is a knob.
   *
   * So it is set by the LADDER it produces rather than by the ratio, and
   * measured where the trick is actually turned: `make ride
   * SCENARIO=sidespin`, which rides the first ramp of seed 38 — the real
   * article, 15–22° and 1.4–1.7 s of air (R8) — rather than off a launch
   * invented to be generous. Revolutions turned, bars HELD over against
   * WORKED at four a second on the app's own steer ramp:
   *
   *            held   worked      the FLIP on a held lean, for scale
   *   skiff    1.76    1.77                0.89
   *   marlin   1.04    1.71                0.43
   *   otter    0.91    1.79                0.40
   *   dart     1.61    1.66                1.78
   *
   * Which is the ladder this trick wants: hold the bars over and it comes
   * round on three of the four, work them and it comes round on all four,
   * and the tourer is the one that has to be worked. Set at half this it
   * came round on NOBODY held — harder than the flip off the same ramp,
   * which is the wrong way round for the trick a rider is asked to find
   * first. */
  whip: 620,
  /** THE GATE ON THE STEER AXIS — `pumpGate` on the other one, and HIGHER
   * than it, for a reason the pitch axis does not have: the bars are in
   * the rider's hands the whole way down every straight and through every
   * gate, so a sideways throw has to be unmistakably a throw and not the
   * lock he was already carrying. Full lock is a corner; a hair past full
   * lock is a side spin.
   *
   * Below it the steer is steering and nothing else. At or above it, every
   * fresh crossing is one whole throw, which is the same rule read twice:
   * the gate keeps the lock out of the trick WITHIN a flight, and the
   * arming keeps it out across the launch (`strokes.ts`).
   *
   * The bot reads this and caps its air steer AT it, exactly as it caps
   * its nose-up lean at `pumpGate`: a levelling loop that whipped would
   * be a bot rolling itself over by accident. */
  whipGate: 0.85,
  /** ...and the budget one rider has to give one flight, rad/s of roll
   * times his own `riderAuthority` (`CraftState.whipped`) — the pump's
   * `pumpCeiling` on the other axis, and HALF AGAIN as much, for the
   * reason stated above: the same rad/s buys much less rotation on an axis
   * the air bleeds four times as fast. At the pump's own 8 the bars WORKED
   * were worth almost nothing over the bars held on the two heavy hulls —
   * tap, and nothing happens — which is the one thing this control must
   * not do. Zeroed the moment the water or a deck has the craft again.
   *
   * `pumpReady` is shared as the floor between throws, for the same
   * reason it is a floor between hauls: it is how long a hand takes to
   * come back, and a hand has only one speed. */
  whipCeiling: 12,
  /** How far a spent throw hangs the rider out to that side, m on top of
   * `rider.leanIn` — `yankReach` on the lateral axis and a shade over half
   * of it, because hanging off is a smaller move than sliding back up the
   * seat. It fades over `yankFade` with the throw itself, which is what
   * the player SEES when the taps land (`CraftState.whip` → `riderRight`
   * → the pose). */
  whipReach: 0.16,
  /** Where the windage stands: this high above the centre of gravity, m,
   * and this share of the length AFT of it — the rider's body, over
   * the water's lateral centre. */
  windageY: 0.3,
  windageZ: -0.12,
  /** ...and where the SIDEWAYS one stands, which is not the same place:
   * this share of the length FORWARD of the centre of gravity, at the
   * centroid of the ABOVE-WATER side profile.
   *
   * Take the profile as a trapezoid: a watercraft floats with a quarter
   * of a metre of freeboard at the transom and two thirds of one at the
   * stem, and the centroid of a trapezoid of heights h₁ and h₂ sits
   * (h₁ + 2·h₂) / 3·(h₁ + h₂) along it from the short end — 0.58 of the
   * length from the transom, an unremarkable 8 % of it forward of
   * amidships. The rider is a second sail a little AFT of that, which
   * pulls the pair of them back to about 6 %; the centre of gravity sits
   * aft of amidships again, which puts it back where it started.
   *
   * The sign is the whole point, and it is the one thing here that is not
   * a guess. The WET hull's lateral centre is right aft —
   * `hull.lateralStationShare` puts a third of the sideways push on the
   * transom station alone, because that is where the pump tunnel, the ride
   * plate and the sponsons are — and the air's stands forward of it. Wind
   * pressure ahead of water resistance is a body that will NOT nose up into
   * the wind the way a moored boat on a chain does: it lies across it and
   * blows away, which is what everyone who has watched a machine get away
   * from them has seen. What it settles at is a balance rather than a
   * heading — broadside in a light air, squaring away as it freshens — and
   * the search-and-rescue leeway experiments call that angle the
   * DIVERGENCE and measure it out to forty-odd degrees for small craft.
   * The model lies 37° off downwind at 6 m/s and 4° at 16; nothing here
   * aims at those, they are what the two centres and the wet hull produce. */
  windageSideZ: 0.08,
  /** The rider's roll authority in the air, N·m at full steer, and the
   * yaw the same input buys. */
  steerRoll: 140,
  steerYaw: 60,
  /** Aerodynamic pitch-moment reference: the hull as a flat plate of
   * area `length × beam × plateShare` with its centre of pressure
   * `cpLead` of the length ahead of the centre of gravity. Nose-up in a
   * headwind lifts the nose further (the plate is statically unstable). */
  plateShare: 0.55,
  cpLead: 0.08,
  /** Rotational aero damping, N·m·s per (m/s)... quoted as N·m·s at the
   * reference speed of 20 m/s; scales with airspeed. Keeps a flight
   * that nobody is steering from tumbling. */
  rotDamp: 35,
  rotDampSpeed: 20,
  /** Vertical speed the hull has to LEAVE the water with for it to count
   * as a launch, m/s — a chop hop is not a jump — and how long it has to
   * stay clear, s, before a launch or a landing is reported at all. */
  launchVy: 1.2,
  minAir: 0.2,
  /** ...and how long it has to stay clear for the flight to be AIR TIME,
   * s. A different question from `minAir`, which is the line a flight is
   * read to have HAPPENED at: a hull skipping off a crest for a third of
   * a second still lands, still slams, still throws a sheet, and all of
   * that is reported. It just did not go anywhere, and in a head sea it
   * does it a fifth of the steps — so a clock that started for those
   * would flicker over the horizon all run. Nothing under this counts:
   * the air clock does not start, no line is printed, and no record can
   * fall on it. Half a second is about the shortest flight a rider reads
   * as one. */
  airCounts: 0.5,
  /** A landing whose bow buries deeper than this, m, with the nose this
   * far down, rad, is a DIVE. */
  diveDepth: 0.55,
  divePitch: -0.12,
} as const;
