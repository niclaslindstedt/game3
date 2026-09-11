// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARCADE ASSIST's numbers — the help the rider is given, and the only
// block of `TUNING` that is not a model of anything.
//
// It lives beside `tuning.ts` rather than inside it because that file had
// grown past the §20.5 cap, and this is the piece that comes out cleanly:
// every number in here is argued against a BENCH (the flight bench, the
// ramp bench) rather than against the world, and every one of them is a
// DIAL a difficulty setting is expected to move. `TUNING.assist` is still
// how the whole repo spells it — `tuning.ts` folds this in under that name
// — and `engine/game/assist.ts` is the code these numbers feed.

/** THE ARCADE ASSIST — the hand on the rider's shoulder (`assist.ts`).
 *
 * TWO HANDS, TWO DIALS, and they are separate because they answer two
 * different ways of losing a jump you had already earned: `air` is the
 * landing (`landingAssist`, `GameState.assist`) and `ramp` is the run
 * up the deck before it (`rampAssist`, `GameState.rampAssist`). A
 * difficulty setting is expected to move both, and to move them by
 * different amounts — the ramp's hand is the gentler of the two and
 * survives further up a difficulty ladder than the air's.
 *
 * This game is an ARCADE game before it is a simulation, and the
 * sensation it sells is the flight: the launch, the hang, the landing
 * taken cleanly and ridden away from. A hull thrown off a ramp by a
 * wave it met on the lip arrives at whatever attitude the physics gave
 * it, and an honest model puts it in on its side about two flights in
 * three — which is the sea winning an argument the rider never got to
 * have. So the last fraction of a second before the water is the
 * ARCADE's: the craft is turned toward the attitude it ought to land
 * at, and the rider keeps the ride.
 *
 * EACH IS A DIAL, NOT A RULE. Every `strength` below is the default a
 * run is dealt, a difficulty setting is expected to move it, and 0 is
 * the bare physics with nothing between the rider and the sea. Every
 * other number here is an arcade number argued against `make ride`,
 * the flight bench and the ramp bench, not a measurement of anything.
 *
 * AND NEITHER HAND FIRES ON A RIDE THAT WAS GOING TO BE FINE. Both are
 * built round a dead band — the attitude a flight is predicted to
 * arrive at, the part of a deck a hull is tracking straight up — and
 * inside it nothing is added at all. */
export const ASSIST = {
  /** THE AIR'S HAND (`landingAssist`, `GameState.assist`): the last
   * moment before the water, and the attitude the hull arrives in. */
  air: {
    /** How much of the assist a run is dealt by default, 0..1. A
     * difficulty setting overrides it per run; nothing else reads this
     * constant.
     *
     * Half, and deliberately the MIDDLE of its own range rather than
     * the top of it, because this number is about to become a
     * difficulty scale and a default with nowhere left to go is a
     * scale with one direction. Over the flight bench — 3360 staged
     * launches, four craft, the rider's hands still — bad landings run
     * 68.3% of flights at 0, 13.9% at 0.25, 7.7% here, 5.7% at 0.75
     * and 5.0% at 1. So the ladder a difficulty setting wants is
     * already measured, and what ships takes nine swims in ten out of
     * the game with room to move either way. */
    strength: 0.5,
    /** How long before the water the hand arrives, s. The whole hang
     * above this is the rider's alone: the assist owns only the
     * approach, which is what keeps a flight a decision rather than a
     * cutscene. */
    window: 0.75,
    /** How far off the landing attitude the hull may be predicted to
     * arrive and still be left alone, rad — read PER AXIS, and the two
     * are far apart because the hull is: it rides away from a landing
     * twenty degrees off in ROLL, and `flight.divePitch` says seven
     * degrees of nose-down is already a dive. One tolerance covering
     * both is either a hand that grabs at every honest bit of bank or
     * one that watches the bow go under. The torque grows from zero AT
     * the tolerance, so nothing steps as a flight crosses it. */
    pitchTolerance: 0.09,
    rollTolerance: 0.35,
    /** The attitude aimed for, rad nose-up. A touch of bow lift rather
     * than dead level, so that the BAND — this plus and minus
     * `pitchTolerance` — sits clear of the nose-down attitude a
     * landing is a dive at (`flight.divePitch`, −0.12): aimed at
     * level, the band would reach to within a couple of degrees of
     * one. Dead level is itself well inside it and is left alone,
     * which is what a rider who levels his own jumps should feel. */
    landPitch: 0.06,
    /** The righting stiffness, rad/s² per rad of error, and the rate
     * damping beside it, rad/s² per rad/s. ACCELERATIONS rather than
     * torques, because the roster's pitch inertia runs from 165 to 490
     * kg·m² and a hand quoted in N·m would catch the dart three times
     * as hard as the otter; `craft.ts` multiplies each axis by that
     * craft's own inertia, so one dial means one correction on every
     * hull.
     *
     * `right` is a spring of √120 ≈ 11 rad/s, which settles a
     * correction in about 0.15 s, and `damp` is near critical
     * (2√k ≈ 22) so the hull arrives settled rather than swinging
     * through. Both are scaled by how close the water is and by the
     * run's dial.
     *
     * SHORT AND FIRM RATHER THAN LONG AND SOFT, and that is a choice
     * about the game and not about the arithmetic: over the flight
     * bench a fifth of this stiffness reaching a second and a half out
     * saves the same landings, and it does it by owning most of the
     * hang. A hand that arrives late and decisively leaves the flight
     * a decision — the rider has the whole of it but the last
     * three-quarters of a second, and what he gets then reads as a
     * catch. */
    right: 120,
    damp: 22,
  },

  /** THE RAMP'S HAND (`rampAssist`, `GameState.rampAssist`): the run up
   * a deck four metres wide (R8's `ramp.width`), with a hull a metre and
   * a bit in the beam on it.
   *
   * A hull on a ramp has nothing in the water — no keel to bite, no
   * nozzle to steer with, and a wet deck under it (`contact.rampFriction`
   * = 0.08, which is most of a skid) — so the sideways way it climbed
   * aboard with is the sideways way it leaves with. Measured: a hull
   * that climbs on a metre off the centreline and six degrees off the
   * axis — a line a rider would call lined up — is over the flank two
   * metres before the lip, and the jump is lost to something he never
   * saw he had not done, which is the one failure in this game that
   * teaches nothing.
   *
   * IT MUST NOT READ AS A GUTTER. Nothing here aims the hull at the
   * centreline from the middle of the deck, and nothing here moves a
   * hull that is not already going somewhere: the help is a deck that
   * holds better than wet plastic and a bow that comes round to the
   * line, both fading out with the rider's own steering and with how
   * fast he is actually going up the ramp. A hand you can feel pulling
   * you to the middle of a ramp is a worse ramp than one you fall off. */
  ramp: {
    /** How much of the ramp's hand a run is dealt by default, 0..1.
     *
     * Higher than the air's, and the reason is what each one is doing:
     * the air's hand rotates a hull the rider can SEE it rotate, so it
     * is spent carefully, while this one only takes a slide out of a
     * half-second on a deck. Over the ramp bench — 800 staged approaches
     * across eight seeds and four craft, offset up to half the deck's
     * half-width and angled up to 7° off its axis, the rider's hands
     * still — jumps followed through off the lip run 78.8% at 0, 85.9%
     * at 0.25, 91.5% at 0.5, 92.0% here, 93.1% at 0.75 and 98.3% at 1.
     * Past the knee of that ladder and well short of its top, where the
     * hand is firm enough to hold a hull that climbed on properly
     * sideways — a save the rider has not earned. */
    strength: 0.6,
    /** How fast the deck takes the sideways slide out, 1/s — the keel
     * bite a hull on a ramp does not have. It is a DAMPER and only a
     * damper: a hull tracking straight up the deck has no across
     * velocity and so feels nothing at all, anywhere on it. 3 halves a
     * drift in about a quarter of a second, which is a third of the
     * time a hull spends on a deck. */
    grip: 3,
    /** The camber, m/s² at the very edge of the deck — the one term
     * that knows where the middle is, and the one kept smallest and
     * kept out of the middle. It is zero within `free` of the half-width
     * and grows from there to this figure at the edge, so a rider down
     * the centre can feel nothing because there is nothing to feel, and
     * a rider on his way off the side gets a nudge that reads as a deck
     * that is not flat. 2.5 m/s² is a shade under what the deck's own
     * rise is already pulling him back down it with (g·sin 17° = 2.9),
     * so the camber at its very strongest is of the same order as the
     * slope he is climbing — and a quarter of gravity. */
    centre: 2.5,
    free: 0.4,
    /** The ceiling over the two together, m/s². A hull that arrived
     * broadside off a wave is a hull the deck cannot save, and a hand
     * that tried would be a wall on the ramp's centreline. */
    most: 6,
    /** The bow brought round to the deck's axis: rad/s² per rad of
     * heading error, past a dead band of `aim` rad, with `damp` rad/s²
     * per rad/s on the yaw rate so it arrives settled rather than
     * weaving. The dead band is 3°, which is inside what a rider can
     * see he is off by at the hinge — above it he is steering, and his
     * steering retires this whole block in proportion anyway.
     *
     * ACCELERATIONS, for the reason the air's are: the roster's yaw
     * inertia is not one number, and `craft.ts` multiplies by each
     * craft's own. */
    align: 2.2,
    aim: 0.05,
    damp: 1.6,
    /** The pace the hand is fully in by, m/s along the deck — it fades
     * in from nothing at a standstill. This is what keeps it off a hull
     * parked on a ramp, one sliding back down, and one crossing the
     * deck broadside (whose way is across the ramp, not up it): all
     * three would be the gutter, and none of them is a jump being
     * followed through. */
    pace: 6,
  },

  /** THE LADDER a difficulty setting picks from: how hard the air's
   * hand catches, how late it arrives, and how much of the ramp's hand
   * goes with it — hardest first. Three dials rather than one because
   * they are three different things: `strength` scales the correction,
   * `window` decides how much of the flight is the rider's at all, and
   * `ramp` is the deck's own hand, which comes down a rung more slowly
   * than the air's because it is the less visible of the two. Over the
   * flight bench a soft hand reaching far out saves the same landings
   * as a firm one arriving late while owning most of the hang, so a
   * hard rung shortens the WINDOW, which hands the flight back, rather
   * than only softening the spring.
   *
   * What each rung leaves, measured — bad landings over the flight
   * bench (3360 staged launches), jumps followed through over the ramp
   * bench (800 staged approaches), both with the rider's hands still:
   * 68.3 % bad / 78.8 % through at `none`, 13.9 % / 85.9 % at `light`,
   * 7.7 % / 92.0 % at `half` and 5.0 % / 98.3 % at `full`. `half` is
   * what a run is dealt when nothing says (the two `strength` figures
   * above), and every rung is stated here rather than computed so the
   * ladder can be re-measured rung by rung. */
  band: [
    { id: "none", strength: 0, window: 0, ramp: 0 },
    { id: "light", strength: 0.25, window: 0.5, ramp: 0.25 },
    { id: "half", strength: 0.5, window: 0.75, ramp: 0.6 },
    { id: "full", strength: 1, window: 1.1, ramp: 1 },
  ],
} as const;
