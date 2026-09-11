// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Global tuning — the numbers that shape the FEEL, shared by every craft
// (per-craft numbers live in craft.ts). Grouped by subject: the clock, the
// two fluids, the sea, the wind, the hull in the water, the planing
// surface, the pump, the flight, the contacts, the course. Every number
// carries its unit; every model it feeds names its source at the function
// that implements it. Tweak here, verify with `npm run sim` and the
// craft/flight/buoyancy tests; the render layer never reads these directly.
//
// Three blocks are stated NEXT DOOR and folded in below under the names
// the repo already spells them by: the arcade assist (`defs/assist.ts` →
// `TUNING.assist`), the only group in here that models nothing, and the
// sea and the wind (`defs/sea.ts` → `TUNING.sea`, `TUNING.wind`), which
// are one subject with one owner and one lab. Moving them is what keeps
// this file under the §20.5 cap.

import { ASSIST } from "./assist.ts";
import { SEA, WIND } from "./sea.ts";

/** The clock the whole engine runs on — see `TUNING.physicsHz`. Named out
 * here so the timestep can be derived from it rather than restated. */
const PHYSICS_HZ = 120;

export const TUNING = {
  /** HOW OFTEN THE WORLD IS SOLVED, steps a second. It stays at 120 for the
   * stiff contacts: a ramp and a grounding are penalty springs, and a
   * penalty spring stiff enough to hold three hundred kilos on a plank with
   * millimetres of sink has a natural frequency that 60 Hz cannot follow.
   * The bot decides on every step too: there is no decision hold. */
  physicsHz: PHYSICS_HZ,
  /** ...and the same number as the timestep every rate in here is spent in,
   * seconds. Derived, never authored. */
  dt: 1 / PHYSICS_HZ,

  /** Standard gravity, m/s². */
  g: 9.81,

  /** THE AIR the hull and the rider push through. */
  air: {
    /** Density at sea level, 15 °C, kg/m³ (ISA). */
    density: 1.225,
  },

  /** THE WATER, beyond what the level says about it (`WaterBody.density`). */
  water: {
    /** Kinematic viscosity, m²/s — fresh water at ~15 °C (ITTC 1.139e-6 at
     * 15 °C; the taiga's 8–18 °C brackish water sits within 15% of it, and
     * the friction line is logarithmic in it, so one value serves). */
    viscosity: 1.14e-6,
  },

  /** THE SEA — the wave field built from the wind (`water.ts`), and
   * THE WIND over it (`wind.ts`), both stated next door. */
  sea: SEA,
  wind: WIND,

  /** THE HULL IN THE WATER (`hull.ts`): buoyancy and the drags. */
  hull: {
    /** Stations along the hull the probes are laid at, as fractions of the
     * length from the transom (0) to the bow (1). Six, because the trim a
     * planing hull settles to is set by where the lift's resultant stands
     * against the centre of gravity, and with fewer the resultant can only
     * jump between stations. */
    stations: [0.06, 0.22, 0.4, 0.58, 0.76, 0.92],
    /** How much of the hull's volume each station owns, transom first —
     * a planing hull carries its volume aft. Normalised at build. */
    stationShare: [0.19, 0.2, 0.19, 0.17, 0.14, 0.11],
    /** ...and how much of the hull's LATERAL area each station carries —
     * aft-heavy, because the sponsons are at the stern and the bow is out
     * of the water at speed. The lateral centre lands a little behind the
     * centre of gravity, which is what makes a yawed hull straighten
     * (weathervane) rather than spin. */
    lateralStationShare: [0.35, 0.28, 0.17, 0.1, 0.06, 0.04],
    /** How far the keel has risen toward the bow at each station, as a
     * fraction of the hull depth: flat aft, then the bow's rise. */
    stationRise: [0, 0, 0, 0, 0.12, 0.42],
    /** How far in toward the keel each station's chines are drawn, as a
     * fraction of the half-beam: the bow's taper. */
    stationTaper: [1, 1, 1, 0.95, 0.75, 0.45],
    /** Of a station's share, how much sits on the keel probe against the
     * two chine probes. */
    keelShare: 0.4,
    /** Where the chine probes sit across the beam, as a fraction of the
     * half-beam. */
    chineOut: 0.8,
    /** The DECK probes: the sealed volume ABOVE the bottom the spec's
     * displacement describes, as a share of it — the seat and the deck —
     * so an inverted hull still floats (a PWC does not self-right from
     * all the way over; the rider flips it, which is what `capsize`
     * below stands in for). It never fills upright. */
    deckShare: 0.55,
    /** Past this immersion, as a fraction of the hull depth, a probe's
     * section counts as BURIED and drags as a bluff body (`diveCd`): a
     * hull on the plane runs shallower, one at rest sits just short of
     * it, and a bow driven in runs well past it. */
    diveDepth: 0.75,
    diveCd: 0.7,
    /** Vertical (heave) drag coefficient of the bottom as a flat plate
     * moving normal to itself (Hoerner 1965 ~1.17). */
    heaveCd: 1.15,
    /** Residuary (wave-making) drag coefficient on the submerged frontal
     * section in displacement mode, sized so the hump costs ~15% of the
     * weight at C_v ≈ 1 as Savitsky's hump data has it. */
    formCd: 0.14,
    /** ...and the same section's coefficient going ASTERN, where the hull
     * is not a hull at all but a flat transom pushed backwards through the
     * water: a bluff plate, Hoerner's ~1.1, near an order of magnitude
     * over the fine end's. It is why a watercraft backs up at walking pace
     * however hard the bucket pushes, and it is a MEASUREMENT of a shape
     * rather than a limiter on reverse. */
    asternCd: 1.1,
    /** Scale on the Newtonian pressure coefficient of the bow's rising
     * bottom (2·sin²σ); 1 is the theory. */
    bowCp: 1,
    /** How much higher a hull at speed rides than at rest, m — what
     * `placeRun` stands a moving craft at so it is not dropped into the
     * water at seventy an hour; the physics settles the rest. */
    planingRise: 0.3,
    /** How much of the deadrise angle the lateral flow on the V bottom
     * turns into vertical force at the outer chine — the panel geometry
     * says tan(deadrise), and 1 is that. */
    chineBank: 1,
    /** THE SPONSONS' BANK-IN, as a lever in units of the keel's own depth
     * below the centre of gravity (`cog.y`): the outside sponson planes on
     * the water it is being pushed across, and the lift it makes rolls the
     * hull INTO the turn in proportion to the sideways force. A PWC leans
     * in where a keel-level side force alone would lean it out (the force
     * acts below the centre of gravity), and the sponsons — plus the rider
     * hanging off (`rider.leanIn`) and the V bottom's own bank
     * (`chineBank`) — are what turn that round. At 1 the sponsons exactly
     * cancel the keel's lever and the lean-in is the rider's and the
     * chines'. */
    sponsonLever: 1.05,
    /** How far under the surface a probe's PATCH counts as fully wet, as a
     * fraction of the hull depth — the friction's measure, where the
     * volume fill is the buoyancy's. */
    patchWet: 0.3,
    /** The fastest the body may spin about any axis, rad/s, and the fastest
     * it may move, m/s — ceilings the integrator clamps to after every step.
     * Nothing in the game reaches either honestly (four turns a second, three
     * times the top speed); they are the wall between a contact that goes
     * wrong and a NaN. */
    maxSpin: 25,
    maxSpeed: 80,
    /** Rotational damping about each body axis, N·m·s (linear), on top of
     * what the probes' drag produces: the water's added-mass damping that
     * a dozen point drags under-count. Pitch, yaw, roll.
     *
     * YAW IS THE SMALLEST OF THE THREE, and the geometry is why: the water
     * a rotating hull has to shift is the area it sweeps normal to the
     * motion. Pitching and rolling sweep the BOTTOM — length × beam, a few
     * square metres; yawing sweeps only the hull's LATERAL profile, length
     * × immersion, which on the plane is a strip a couple of tenths of a
     * metre deep. That is roughly a fifth of the bottom's area on the same
     * lever, so yaw damping belongs well under pitch's, not over it. */
    rotDamp: { x: 300, y: 150, z: 400 },
    /** The share of the total slam that may decelerate the hull, g — the
     * von Kármán pressure on a whole bottom at once is a load the real hull
     * spreads over the pile-up and the flex of the rider's legs; the cap
     * keeps a flat landing a hard event rather than a wall. */
    slamCapG: 7,
    /** Slam pressure fraction: von Kármán's average is for a wedge landing
     * flat; a hull landing at speed meets the water progressively, and
     * this scales the whole force. Dimensionless. */
    slamShare: 0.35,
    /** How much lift a probe at the transom carries against one at the
     * bow, 0..1: the pressure on a planing bottom is a stagnation peak
     * forward tapering to nothing at the transom, and this is the taper's
     * floor (0 would be a clean Kutta transom; a little is kept because
     * the probes stand for whole stations). */
    liftAft: 0.15,
    /** THE CARVE: a banked V bottom is a rudder — the immersed outer chine
     * turns the hull toward the bank. Yaw moment per radian of bank past
     * the dead band per (m/s)² of speed through the water, N·m, read
     * through sin(2·bank) so it peaks at 45°. What lets a leaned hull turn
     * once the thrust, and so the nozzle's authority, has fallen away at
     * speed — and nothing at all inside `carveDead` rad of roll, where
     * both chines are dry: the couple of degrees a crosswind heels a hull
     * or chop rocks it are not a rudder.
     *
     * An ARCADE DIAL, and the one that decides how hard the game can be
     * turned: the nozzle's moment falls away with speed (thrust is
     * ρQ(V_j − V_in), and V_in is the hull's own pace), so past the hump it
     * is the immersed chine that turns a personal watercraft, not the
     * pump. Sized toward the band a ridden ski actually holds — about a g
     * in a committed carve — which puts the skiff near nine tenths of one,
     * a forty-metre circle and a seven-second 180 at speed, the roster
     * spread either side of it. The ceiling on going the rest of the way
     * is `sim/bot.ts`, not the water: past here the bot's steering loop
     * saturates and weaves rather than holding a line, and no pair of its
     * gains fixes that (see its lessons). Raise the two together. */
    carve: 16,
    carveDead: 0.09,
    /** How quickly `planing` (the state readout) follows the lift share,
     * per second. */
    planingFollow: 6,
  },

  /** THE PLANING SURFACE (Savitsky, `hydro.ts`). */
  planing: {
    /** Below this speed coefficient C_v = V/√(gB) the method is invalid and
     * the hull is in displacement mode; the lift fades in over the band to
     * `fadeHigh`. Savitsky's data starts at C_v ≈ 0.6. */
    fadeLow: 0.5,
    fadeHigh: 1.4,
    /** Trim angle band the formula is evaluated over, degrees. Savitsky's
     * data covers 2–15°; below the floor the lift is scaled linearly to
     * zero so a level hull still lifts a little. */
    trimMin: 1.5,
    trimMax: 14,
    /** Wetted length-to-beam ratio band λ. */
    lambdaMin: 0.4,
    lambdaMax: 4,
    /** The lift coefficient's ceiling — the formula runs away at high trim
     * and low speed, where the hull would in truth be porpoising. */
    clMax: 0.35,
    /** The lift's pressure centre sits `cpAft` of the wetted length ahead
     * of the transom when Savitsky's own formula would read past the hull. */
    cpAft: 0.33,
  },

  /** THE PUMP and the engine (`propulsion.ts`). */
  pump: {
    /** THE SPEED CLASS — the one knob that makes every craft on the roster
     * faster or slower TOGETHER, the way a kart game's engine classes do,
     * and the knob the open ocean's biggest wave is sized off (`ocean.ts`).
     *
     * It is quoted in what it BUYS: 1.4 means every hull runs 1.4× the
     * speed the catalog quotes it at. Underneath it is a taller impeller
     * and the engine to swing it — the pitch goes as `speedClass^(1 /
     * classGain)` and the engine's torque as the cube of that pitch,
     * because the pump's load torque goes as pitch³ at a given shaft speed
     * and an engine that did not grow with it would simply bog. MEASURED
     * top speed, km/h, flat out on the calm strip, at the pitch each class
     * asks for:
     *
     *   class    0.75    1.00    1.15    1.30    1.50    1.75    2.00
     *   skiff      58      95     115     134     157     190     195
     *   marlin     62     108     130     150     179     205     246
     *   otter      57      91     110     128     153     185     217
     *   dart       50      78      95     111     133     164     194
     *
     * At 1 every craft reproduces its catalog `topSpeed` exactly. Past 2 the
     * hull is unstable at the speeds it reaches and the top falls again, so
     * 0.75–2 is the usable ladder.
     *
     * IT SHIPS AT 1, AND THE REASON IS THE COURSES. A level's gates are
     * spaced in METRES (`mapgen/rules.ts` reads no speed at all), so a class
     * does not stretch the course it is ridden on — it only gives the rider
     * less time between gates. MEASURED at 1.5 over the sim's corpus: every
     * craft still finishes, but the missed-gate count goes from 5 to 32 on
     * the dart and 24 to 37 on the skiff, the dives roughly double, and the
     * PACE falls (the marlin's 39.6 km/h to 35.6) because a hull that
     * overshoots a gate has to come back for it. `tests/simulation_test.ts`
     * fails outright there. Raising this is therefore a two-part change: the
     * class, and a course whose spacing is a function of the same top speed
     * the ocean's ceiling already reads.
     *
     * Why here and not on a craft: what separates the four hulls is
     * `defs/craft.ts`'s business and must not move when a class does. This
     * scales all four at once and leaves every difference between them
     * where it was — the catalog's `topSpeed` stays the hull's own number,
     * at class 1, and `topSpeedOf` is the one place the class is applied. */
    speedClass: 1,
    /** ...and how much faster a taller impeller actually makes a hull: the
     * exponent in speed ∝ pitch^`classGain`. It is not 1, and the reason is
     * the hull rather than the pump — a planing hull lifts as it speeds up,
     * so its wetted area shrinks and its drag grows SLOWER than v², and a
     * pitch that doubles the jet buys more than double the speed.
     *
     * A MEASUREMENT, fitted over the table above: 1.2 holds every class from
     * 1.15 to 2 to within 2 %. It is here so the class can be quoted in what
     * a player would notice — "half as fast again" — rather than in impeller
     * pitch, which is the thing nobody outside this file thinks in. */
    classGain: 1.2,
    /** ...and HOW MUCH OF THAT SPEED THE CONTROLS ARE TOLD ABOUT. An
     * ARCADE DIAL, 0..1, because every steering term in the model is quoted
     * against the water in ABSOLUTE metres a second — the nozzle's side
     * force is a share of a thrust that grew with the class, the keel's bite
     * and the carve go as v², the plate in the air goes as v² — so a class
     * that scaled only the pump hands the rider a different craft rather
     * than a faster one: four times the yaw acceleration off the same flick
     * of the bars, and a hull that comes round HARDER per metre of track the
     * faster it goes.
     *
     * A CLASS IS A SPEED, NOT A HANDLING PACKAGE. The rule it is sized to is
     * that one craft's classes all manoeuvre the same — and that a faster
     * class never turns SHARPER than a slower one, because nothing that goes
     * faster turns tighter. Slightly wider is right and expected; sharper is
     * the twitch that spins a rider on a gate line. What separates the four
     * HULLS is untouched either way: this scales every craft's own numbers
     * by the same factor, so the roster keeps its spread.
     *
     * 0 leaves the physics alone; 1 takes the rider's deflection down as
     * fast as the speed goes up, which overshoots into a hull that goes soft
     * at the top of the band. THREE QUARTERS is where the turn per metre
     * goes flat-to-slightly-wider across the band on every hull the dial can
     * reach — `craftAtClass`, which applies it, carries the bench. The
     * factor is exactly 1 at class 1, so nothing the roster is tuned or
     * documented at moves because this exists. */
    classSteer: 0.75,
    /** Overall thrust efficiency against the ideal momentum-theory jet —
     * intake duct loss, nozzle loss, impeller slip. Marine waterjets run
     * 0.6–0.75 overall (Bulten 2006); the lower half because a PWC's short
     * flush intake is the poorer of them. Dimensionless. */
    thrustEfficiency: 0.66,
    /** Hydraulic efficiency of the pump, engine shaft → jet kinetic power.
     * Sets the shaft load the engine sees at a given rpm. */
    pumpEfficiency: 0.86,
    /** How much of the hull's forward speed arrives at the intake as inflow
     * velocity: the boundary layer under the hull slows it (wake fraction
     * ~0.1 for a flush intake). */
    inflowFactor: 0.9,
    /** Engine plus impeller shaft inertia, kg·m² — a small marine two- or
     * four-stroke with a light impeller. */
    inertia: 0.06,
    /** Throttle-to-torque lag time constant, s (throttle body, ECU, intake
     * fill). */
    throttleLag: 0.12,
    /** Engine friction torque at redline as a share of peak torque — the
     * over-run drag with the throttle shut. */
    friction: 0.12,
    /** How fast the nozzle swings, rad/s at full input (a cable and a
     * hand). */
    nozzleRate: 6,
    /** How fast the TRIM travels, in trim-ranges a second: a screw or a
     * small motor moving the whole nozzle housing, so about a second and a
     * half from one stop to the other rather than the steering's fifth of
     * one. Quoted as a rate against each craft's own range so a wide-range
     * system is not also a faster one. */
    trimRate: 1.4,
    /** How much of the reversed jet leaves DOWNWARD under the transom, as
     * a share of what the bucket turns. The gate is a clamshell: the flow
     * it catches goes forward and under rather than straight back up the
     * hull's own line, and the reaction squats the stern and puts the bow
     * down — which is why braking hard on a watercraft buries the nose.
     * An ARCADE DIAL sized for that read, not a measured deflection. */
    bucketDown: 0.55,
    /** THE GATE AS A PLATE IN THE WATER: its drag area (C_d·A) fully
     * deployed, in multiples of the nozzle's own area, on a craft whose
     * bucket takes the whole flow (`bucket.reverse` of 1) — `bucketDrag`
     * scales it by both. It is quoted against the nozzle so a bigger pump
     * carries a bigger gate without a second number per craft.
     *
     * WHY IT HAS TO EXIST. Jet thrust falls as the hull speeds up, so a
     * brake built only out of reversed thrust is weakest exactly where a
     * rider reaches for it: at the top of the range the gate was worth
     * about a twentieth of a g, and dropping it at ninety was something a
     * rider could not feel. A real gate is a bluff body hung in the stream
     * and it bites as v², which is what lets a modern electronic brake
     * roughly HALVE a stopping distance from fifty.
     *
     * MEASURED on the flat bench, full lock from a steady top speed, the
     * skiff: it is worth about a fifth of a g at ninety and nothing at the
     * walking pace reverse runs at. Sized so a braked stop lands at about
     * half the coasting distance — the figure quoted for a real electronic
     * brake — rather than to a deflection anyone has measured, so it is an
     * ARCADE DIAL with a real shape rather than a coefficient. */
    bucketDragArea: 1.1,
    /** How far the brake lever opens the throttle on its own, 0..1. The
     * bucket can only turn flow the pump is making, so pulling the lever
     * asks the engine for enough of it to stop with — which is exactly
     * what an electronic brake does and why a watercraft brakes with the
     * engine revving. */
    bucketThrottle: 0.65,
    /** Intake depth below the keel probe at the transom, m: the intake is
     * fed while the transom station is wet to this. */
    intakeDepth: 0.05,
    /** The pump's air load as a share of its water load, when the intake is
     * dry — the impeller spins in spray and the engine runs up to the
     * limiter. */
    airLoad: 0.08,
    /** Hull-keel yaw authority with the throttle closed, N·m per rad of
     * nozzle per (m/s)² — the sponsons and the hull's turned attitude turn
     * it a little without thrust, the way a real one barely answers. */
    keelYaw: 0.6,
    /** THE HIGH-SPEED STEER — how much more everything the nozzle is worth
     * (the jet's side thrust and `keelYaw` alike) buys at the craft's OWN
     * top speed, ramping in with the square of the speed so the bottom half
     * of the range barely moves.
     *
     * An ARCADE DIAL, and what asks for it is geometry rather than the
     * pump: a turn rate is the lateral acceleration over the speed, so the
     * same force on the same hull swings it half as fast at twice the
     * speed. An honest model therefore hands the rider a machine that stops
     * answering the bars exactly where a course needs it most — and the 90s
     * arcade generation this game is measured against did not.
     *
     * MEASURED on the flat strip, full lock held for 4 s from 0.95 of each
     * craft's top speed: degrees of heading turned, and the tightest radius
     * it comes round at, m — at 0 and at this value.
     *
     *   craft      deg →        radius →
     *   skiff    121   134      40.5  33.4
     *   marlin   112   120      40.8  38.7
     *   otter     91   104      54.6  46.9
     *   dart     145   161      26.0  23.0
     *
     * — about a tenth more turn for a tenth off the radius, nothing at all
     * below half speed, and SUB-LINEAR past here: another 0.1 on the dial is
     * worth about 2 % more turn, because at these speeds most of the yaw is
     * already the hull's own. What holds it where it is rather than higher is
     * `make sim` over eight seeds: at 0.35 every craft's pace rises and the
     * resets halve, and at 0.45 the bot starts grounding instead. */
    steerHighSpeed: 0.35,
  },

  /** THE RIDER as a point mass the inputs move (`craft.ts`). */
  rider: {
    /** How far the rider's mass moves aft at full lean back (and forward at
     * full lean forward), m — a rider sliding right back on the seat and
     * hanging off the bars. */
    leanReach: 0.55,
    /** How far the rider's mass moves into a turn at full steer, m, and
     * how much of the steer input becomes lean (a rider hangs off into a
     * hard turn, not into a twitch). */
    leanIn: 0.28,
    /** Rider mass shift lag, s: a body moves slower than a thumb. */
    leanLag: 0.18,
  },

  /** THE TUCK (`CraftInput.crouch`): the rider down behind the bars.
   * `dragCut` is the measurement; the rest is what it costs, and the costs
   * are not a tax but the same body — every one is a lever the rider works
   * with their own mass or reach, and a man folded down has less of both.
   * `docs/riding.md` carries where the 18 % comes from and what the bench
   * says it buys: about a km/h flat and calm, twice that into a blow,
   * because a watercraft is stopped by the WATER and not by the air. */
  tuck: {
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
  },

  /** FLIGHT (`flight.ts`): the air over the water. */
  flight: {
    /** The rider's pitch authority in the air, N·m at full lean — the HOLD,
     * sized for attitude: a lean held forward through a 0.7 s hang puts
     * the nose 20–30° down, not on the water's floor. */
    leanTorque: 450,
    /** THE PULL: the angular impulse, N·m·s, a lean held back through the
     * first `pullWindow` seconds off the lip is worth — the rider yanking
     * the bars up. Together with the hold it is what a backflip is made
     * of: with the lean held back, a 1.5 s hang completes one and not much
     * more (`flight_test`), and a lean let go inside the window is no pull
     * at all. Nose-up only: a rider stood on the hull has nothing to push
     * the nose down against. */
    pull: 620,
    pullWindow: 0.25,
    /** Where the windage stands: this high above the centre of gravity, m,
     * and this share of the length AFT of it — the rider's body, over
     * the water's lateral centre. */
    windageY: 0.3,
    windageZ: -0.12,
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
  },

  /** THE ARCADE ASSIST — the help the rider is given, stated in
   * `defs/assist.ts` beside this file rather than in it. Two hands on
   * two dials (`assist.ts`, `GameState.assist` / `.rampAssist`) and the
   * difficulty ladder over both; the split is the §20.5 cap, not a
   * second tuning file, and every reader still spells it
   * `TUNING.assist`. */
  assist: ASSIST,

  /** CONTACTS with what is not water (`collision.ts`). */
  contact: {
    /** Penalty spring stiffness and damping for a probe pressed into the
     * ground or a ramp, N/m and N·s/m per probe. Stiff enough that a hull
     * riding a ramp sinks millimetres, damped near critical. */
    stiffness: 90_000,
    damping: 3_200,
    /** Coulomb friction on ground (rock, sand — a keel dragging) and on a
     * ramp's wet deck. */
    groundFriction: 0.45,
    rampFriction: 0.08,
    /** A probe further under a ramp's deck than this, m (measured normal
     * to it), did not sink through the deck — it came in through one of
     * the wedge's walls, and is pushed back out through whichever wall is
     * the shallowest way out. Under it, the probe is riding the deck: it
     * is what lets a hull grazing the ramp near its hinge, where the deck
     * stands centimetres up, climb aboard instead of being deflected. */
    rampWallBelow: 0.3,
    /** ...and the most the DECK may then push back on one probe, N. A
     * wall's push is uncapped — it has to stop a hull — but a probe deep
     * in the MIDDLE of the deck is a hull slammed onto it, and this is
     * what holds that push to a landing rather than a launch. */
    rampDeckCap: 20_000,
    /** Restitution against a solid rock, and how much of the tangential
     * speed a glancing hit keeps. */
    restitution: 0.25,
    tangentKeep: 0.85,
    /** The hull's plan radius for solid contact, as a fraction of the
     * half-beam (the probes do the shaping; this is the round-off). */
    hullRadius: 0.9,
    /** The closing speed a `hit` is worth reporting from, m/s, and the
     * cooldown between reports, s. */
    hitSpeed: 1,
    hitCooldown: 0.35,
    /** How far past the bounds a craft may go before the push, m, and the
     * spring that returns it, m/s² per m. */
    boundsMargin: 5,
    boundsSpring: 4,
    /** ...and HOW DEEP the water at the rim has to be for the bound to let
     * a rider through instead, m. The basin cuts its open water off at a
     * straight line and pads every other side with land (R14, R15), so the
     * only water standing at the grid's rim is the sea's — and the sea has
     * no far side (`engine/game/ocean.ts`). Measured over the seed corpus
     * the wet rim cells of a level stand in 21 to 60 m of water, so fifteen
     * opens every one of them and still holds a rider in at the last
     * shallow metres of a river (R26) or a beach that happens to reach the
     * box's corner. */
    boundsOpenDepth: 15,
    /** Cooldown between `ground` events, s. */
    groundCooldown: 0.5,
  },

  /** CAPSIZE (`craft.ts`): a PWC does not self-right, the rider does. */
  capsize: {
    /** How long the hull may lie on its back, s, before the rider has
     * climbed back on and rights it. */
    after: 1.5,
    /** How long the righting takes, s, turning the hull back upright the
     * shortest way with the engine idling. */
    righting: 0.5,
    /** Time constant, s, the way is scrubbed off with meanwhile. */
    slow: 0.15,
  },

  /** THE COURSE (`course.ts`). */
  course: {
    /** Seconds added to the run for a gate passed over, so a missed gate
     * still counts as reached at a price. */
    missedPenalty: 5,
    /** Where a reset stands the craft: this far behind the gate it goes
     * back to, m, so the line is crossed by a MOVE. */
    resetBack: 6,
    /** How far off a gate's centre a crossing still counts as having gone
     * PAST that gate, m — five gate-widths.
     *
     * A gate's line is infinite, and a craft crossing it half a level away
     * has not passed the gate, it has passed somewhere else. Inside this,
     * a crossing outside the buoys is a rider who went by the gate on the
     * wrong side, and the run carries on with the miss charged; outside it
     * the crossing means nothing and the gate is still ahead. Without it a
     * course with corners in it (R22) can deadlock — a rider who misses
     * two gates in a row is never given a third. */
    missWide: 60,
  },
} as const;
