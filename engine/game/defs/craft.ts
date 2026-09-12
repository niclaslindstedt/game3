// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The craft catalog. Content is authored as data so a new craft is a row
// here, not a physics edit: the hull, the pump and the flight read these
// numbers and nothing else differs between the four except them. SI units
// throughout, with the two the sources quote otherwise called out —
// deadrise in DEGREES because Savitsky's lift formula takes degrees, and
// the two expectations in km/h and seconds because that is how a spec sheet
// prints them.
//
// The roster is four ANSWERS to the same shore, not four points on one
// scale, and each answers to a real ARCHETYPE of personal watercraft. None
// of them is any one manufacturer's row: the numbers sit inside the
// published range for the class (dry mass 150–420 kg, 60–230 kW, 70–110
// km/h, deadrise 16–24°) and the archetype is what decides where in it.
//
// | Archetype     | Craft  | Owns                        | Pays                       |
// | ------------- | ------ | --------------------------- | -------------------------- |
// | `runabout`    | skiff  | quick off the line, nimble  | skittish in chop           |
// | `musclecraft` | marlin | the top speed, the long leg | needs revs, needs room     |
// | `tourer`      | otter  | soft over a wave, unshakable| slowest away, slow to turn |
// | `stand-up`    | dart   | pivots, flips, tightest line| the lowest top end, throws you |
//
// EACH OWNS EXACTLY ONE OF THE FOUR THINGS THE CARD BILLS THEM ON, and
// that is a constraint rather than an observation. The card's bars
// (`pwa/src/game/craft-stats.ts`) scale ACCELERATION, TOP SPEED, TURNING
// and STABILITY across the roster's own spread, so a craft that leads two
// of them reads as strictly better than the rest at a glance — which one
// of these once did, holding the best acceleration AND the best top speed
// AND second place in the other two. A roster is a choice or it is a
// ladder; keep every ceiling to one owner, and keep every craft's worst
// axis somewhere it can afford to be worst.
//
// WHAT A WATERCRAFT HAS THAT A CAR DOES NOT. A car's sheet is torque,
// gears, redline, top speed. A personal watercraft has NO GEARBOX and no
// clutch: the impeller is bolted to the crank, so `impellerPitch` IS the
// one fixed gear and the pump's own load is what the engine revs against.
// What it has instead — and what the archetypes differ on — is:
//
// - THE PUMP. `nozzleDiameter` (how fast the jet leaves) and
//   `impellerPitch` (how much of the crank's speed becomes jet speed)
//   between them set the whole thrust curve: thrust falls as the hull
//   speeds up, because thrust is the momentum the jet GAINS over the water
//   already going past the intake.
// - FORCED INDUCTION (`boost`). A musclecraft is supercharged off the
//   crank, so its boost climbs with the square of engine speed: nothing
//   below the onset, everything at the limiter. A blown craft of a given
//   rated power is SOFTER in the midrange than an unblown one of the same
//   rated power — that is the trade, and it is why `powerKw` alone never
//   said how a craft accelerates.
// - THE REVERSE BUCKET (`bucket`). A clamshell that drops over the nozzle
//   and turns the jet forward and down: the only brake a watercraft has,
//   and the only reverse. A tourer's is electronic and strong, a
//   musclecraft's is quick but has more mass to stop, a stand-up has NONE.
// - VARIABLE TRIM (`trimRange`). The nozzle pivots vertically, so the
//   thrust line can be aimed above or below the hull's own axis: trim up
//   lifts the bow for speed and for a launch, trim down buries it for a
//   hook-up in a turn. A stand-up has no trim at all — the rider IS the
//   trim.
// - THE SPONSONS (`sponsonBite`). The fins at the stern quarters, and the
//   single biggest handling adjustment on a real craft: bite deep and the
//   hull hooks and holds a turn, bite shallow and it slides wide.
// - THE RIDE PLATE (`ridePlate`). The flat plate under the transom behind
//   the pump. Long, and the hull tracks straight and lands flat; short, and
//   it pivots — which is exactly what a freestyle stand-up wants.
// - THE BOW'S ROCKER (`bowRise`). How far the keel sweeps up toward the
//   bow, and so how much of the forefoot is OUT of the water. A lot of
//   rocker is a hull that sits on its stern and has nothing forward to hold
//   the bow up when it does go in — it submarines, which is a freestyle
//   stand-up's whole trick vocabulary and its whole risk. A deep, straight
//   forefoot is a touring hull that refuses to bury. (MEASURED on a staged
//   nose-down landing, not assumed: more rocker is a deeper bow and a
//   nose-down pitch, because the buoyancy it takes out of the forefoot
//   outweighs the extra lift its steeper entry earns.)
// - THE RIDER (`riderAuthority`). Seated with a backrest, or standing on a
//   150 kg hull free to throw their whole mass about. In the air that
//   number is the difference between a boat and a freestyle machine.
//
// `topSpeed` and `accel0to50` are DERIVED EXPECTATIONS, not inputs: the
// physics is what makes the craft go that fast, and `craft_test` holds the
// physics to reproducing each one within tolerance on flat water. Change
// a mass or a pump and the test says what the change did to the sheet.

export type CraftId = "skiff" | "marlin" | "otter" | "dart";

/** The four kinds of personal watercraft the roster answers to. Naming the
 * class rather than describing it keeps the catalog's rows honest: a knob
 * that moves a craft off its archetype is a knob that needs an argument. */
export type CraftArchetype = "runabout" | "musclecraft" | "tourer" | "stand-up";

import { TUNING } from "./tuning.ts";

export type CraftSpec = {
  id: CraftId;
  name: string;
  /** Which kind of machine this is. Documentation with teeth: every knob
   * below is set to what the class implies, and `craft_test` holds the
   * roster to the shape the four archetypes make. */
  archetype: CraftArchetype;
  /** One line of billing for the menu that will ask the player to choose. */
  blurb: string;
  /** Dry mass, kg — hull, engine, fuel. The rider is added separately. */
  mass: number;
  /** Hull length, beam and depth (keel to deck), m. */
  length: number;
  beam: number;
  height: number;
  /** Deadrise angle of the V bottom, DEGREES. Savitsky's correction reads
   * it in degrees and the slamming pressure in radians; both convert at
   * the point of use. */
  deadrise: number;
  /** Total enclosed hull volume, m³ — what the hull would displace fully
   * submerged. With the mass it decides how the craft sits: a denser hull
   * floats lower. */
  displacement: number;
  /** Where the centre of gravity of hull-plus-rider sits: `y` above the
   * keel and `z` ahead of the hull's mid-length, m — so every row's `z` is
   * negative, the mass sitting AFT of mid the way an engine amidships and a
   * rider over the pump put it.
   *
   * Every craft carries it at 12% of its OWN length, because what the trim
   * answers to is the fraction rather than the metres: the same offset
   * would trim the 2.7 m stand-up and the 3.55 m tourer differently. Far
   * enough aft that the hull rests level to a degree bow-up and planes at
   * 2.1–2.7°, inside the band Savitsky's lift is fitted over. It is also
   * the bow's clearance in a FOLLOWING SEA, which is what set it: trimmed
   * any further forward the hull is swallowed by the wave it overtakes,
   * the flow angle over the bottom goes negative, the planing lift stops
   * firing altogether and the craft wallows at a third of its speed.
   * Further aft than this buys little more of that and starts costing the
   * reverse gate its lever — the nozzle is a fixed point at the transom,
   * so every millimetre the mass moves back is a millimetre off the arm
   * the bucket turns the hull on, and the marlin's braked corner is the
   * first thing to go. */
  cog: { y: number; z: number };
  /** Engine: rated power, kW, at `maxRpm` — the number a spec sheet
   * quotes, so BOOST INCLUDED where there is any; idle and redline, rpm;
   * the torque curve as (rpm, N·m) points read linearly between them,
   * which on a blown craft is the curve BEFORE the blower. */
  powerKw: number;
  maxRpm: number;
  idleRpm: number;
  torque: readonly (readonly [number, number])[];
  /** FORCED INDUCTION. `peak` is the share the blower adds to the engine's
   * torque at the limiter (0 on a naturally aspirated craft) and `onset`
   * the fraction of the rev range it starts pushing from. A centrifugal
   * blower is geared off the crank, so its pressure rise goes as the
   * square of shaft speed: nothing down low, everything at the top. */
  boost: { peak: number; onset: number };
  /** Pump: nozzle exit diameter, m; the steering nozzle's full deflection,
   * rad; the impeller's effective pitch, m of jet travel per revolution,
   * so the jet velocity is `impellerPitch × rpm / 60`. */
  nozzleDiameter: number;
  nozzleAngle: number;
  impellerPitch: number;
  /** THE REVERSE BUCKET — the clamshell that drops over the nozzle and
   * throws the jet forward and down. `reverse` is the share of the jet's
   * forward thrust that comes back the other way with the gate fully
   * down (a real bucket turns the flow through rather less than 180° and
   * spills some of it, so it is never 1), and `deploy` is how long the
   * gate takes to swing from stowed to down, s. `reverse: 0` is a craft
   * with no bucket fitted at all — a stand-up — which therefore has no
   * brake and no reverse. */
  bucket: { reverse: number; deploy: number };
  /** VARIABLE TRIM: how far the nozzle may be aimed above or below the
   * hull's own axis, rad. The rider's lean carries it (leaning back trims
   * up, which lifts the bow and is what the thrust line is for) — 0 is a
   * craft with no trim system, where the rider's weight is the only trim
   * there is. */
  trimRange: number;
  /** THE SPONSONS' BITE, dimensionless against the reference sponson (1):
   * how much of the water's sideways push on the hull the stern fins turn
   * into a bank INTO the turn and a yaw around it. Deep and the hull
   * hooks; shallow and it slides wide. */
  sponsonBite: number;
  /** THE RIDE PLATE, dimensionless against the reference plate (1): how
   * hard the flat plate under the transom resists the hull turning and
   * pitching about its own axes. Long tracks straight and lands flat;
   * short pivots. */
  ridePlate: number;
  /** HOW FAR THE KEEL SWEEPS UP FORWARD, as a multiple of the reference
   * rocker (1) — and so how much of the forefoot is lifted clear of the
   * water. MORE rocker is LESS bow to hold the nose up: it buries deeper
   * and pitches further down on a nose-down landing, which is what a
   * rockered stand-up does and a deep-forefoot tourer does not. */
  bowRise: number;
  /** WHAT THE RIDER CAN DO WITH THE CRAFT IN THE AIR, dimensionless
   * against a seated rider on a runabout (1): a rider standing on a light
   * hull with their whole mass free to move has far more of it than one
   * sat down behind a backrest. Scales every control the air gives them. */
  riderAuthority: number;
  /** Aerodynamic drag area of hull plus rider, m² (C_d × A). */
  cdA: number;
  /** Lateral drag coefficient of the underwater profile — the keel and the
   * sponsons; what makes the hull carve rather than skate. */
  lateralCd: number;
  /** The rider as a point mass, kg, this high above the centre of gravity,
   * m. The physics carries the point; the app draws a figure on the saddle
   * from its own anthropometrics (`pwa/src/game/rider-pose.ts`) and leans
   * it where this mass went. */
  riderMass: number;
  riderHeight: number;
  /** Expected flat-water top speed, km/h, and 0–50 km/h time, s. */
  topSpeed: number;
  accel0to50: number;
};

/** A torque curve shaped like a small marine four-stroke: torque rises to
 * a plateau in the middle of the band and falls off toward the limiter,
 * with the rated power landing at `maxRpm`. Peak torque sits `peakRatio`
 * above the torque at rated power.
 *
 * `boostPeak` is what the blower will add back at the limiter, so the
 * curve is built for the power the engine makes WITHOUT it and the rated
 * figure still lands at redline once boosted. That is the whole shape of a
 * supercharged craft: same headline power, a hole under the onset. */
function marineCurve(
  powerKw: number,
  maxRpm: number,
  peakRatio: number,
  boostPeak = 0,
): [number, number][] {
  const ratedTorque = (powerKw * 1000 * 60) / (2 * Math.PI * maxRpm * (1 + boostPeak));
  const peak = ratedTorque * peakRatio;
  return [
    [0, peak * 0.55],
    [maxRpm * 0.25, peak * 0.8],
    [maxRpm * 0.5, peak * 0.96],
    [maxRpm * 0.7, peak],
    [maxRpm * 0.88, peak * 0.97],
    [maxRpm, ratedTorque],
  ];
}

const DEG = Math.PI / 180;

export const CRAFT: readonly CraftSpec[] = [
  {
    id: "skiff",
    name: "Skiff",
    archetype: "runabout",
    blurb: "Light and quick. Jumps at the throttle, skips over chop.",
    mass: 245,
    length: 3.1,
    beam: 1.18,
    height: 0.62,
    deadrise: 18,
    displacement: 0.66,
    cog: { y: 0.42, z: -0.372 },
    powerKw: 125,
    maxRpm: 7600,
    idleRpm: 1500,
    torque: marineCurve(125, 7600, 1.12),
    boost: { peak: 0, onset: 0 },
    // A HOLE-SHOT PUMP — the exact mirror of the musclecraft's. Short
    // gearing through a wide nozzle moves a lot of water slowly: all the
    // thrust is at the bottom, where a hull is heaviest in its own bow
    // wave, and the ceiling it buys down the straight is modest. This
    // craft and the marlin carry almost the same power for their weight
    // and spend it at opposite ends of the rev range, which is what makes
    // one of them quick away from a buoy and the other quick between two.
    nozzleDiameter: 0.074,
    nozzleAngle: 24 * DEG,
    impellerPitch: 0.283,
    // The reference craft: every dimensionless knob below is 1 here, and
    // the rest of the roster is quoted against it. A mid-range bucket and
    // a manual trim lever — what a rec-lite runabout actually carries.
    bucket: { reverse: 0.5, deploy: 0.45 },
    trimRange: 4 * DEG,
    // THE ROSTER'S TURNING CIRCLES, and they sit close together on
    // purpose. Benched flat at half top speed under full lock, the four
    // used to span 18 m of radius to 80 m: the stand-up could thread any
    // buoy on the course and neither big hull could make one at all, so
    // gates — and therefore races — went to whoever turned hardest and
    // nothing else counted. They now span about two to one. The ORDER is
    // untouched, every craft keeping the circle its archetype implies;
    // only the gap between them is small enough that a rider can choose a
    // hull for something other than its steering.
    sponsonBite: 1.06,
    ridePlate: 1,
    bowRise: 1,
    riderAuthority: 1,
    cdA: 0.75,
    lateralCd: 1.25,
    riderMass: 80,
    riderHeight: 0.55,
    topSpeed: 95,
    accel0to50: 2.0,
  },
  {
    id: "marlin",
    name: "Marlin",
    archetype: "musclecraft",
    blurb: "The fastest thing here. Needs room, and a rider who means it.",
    mass: 360,
    length: 3.45,
    beam: 1.26,
    height: 0.68,
    deadrise: 22,
    displacement: 0.92,
    cog: { y: 0.45, z: -0.414 },
    powerKw: 175,
    maxRpm: 8000,
    idleRpm: 1600,
    torque: marineCurve(175, 8000, 1.1, 0.45),
    // BLOWN, and the only one here that is: 175 kW at the limiter out of a
    // 121 kW engine, with none of it under 55% of the rev range.
    boost: { peak: 0.45, onset: 0.55 },
    // THE SMALLEST NOZZLE HERE, on the tallest gearing — top-end pump
    // tuning, and the other half of why this craft still owns the end of
    // the straight on less power. A narrow nozzle passes less water, so
    // there is less thrust to break the hump with; what leaves still
    // leaves FAST, and the speed a hull can hold is set by how far the jet
    // outruns it. Thrust everywhere against thrust where it matters.
    nozzleDiameter: 0.072,
    // THE NARROWEST STEER HERE — the "needs room" in its own blurb, made a
    // number. A hull this long carrying this much way cannot be asked to
    // hook a tight buoy, and paying for the top speed in the corners is
    // what stops the fastest craft also being the one that takes the
    // shortest line.
    //
    // NARROWEST, NOT CRIPPLED, and the difference is measured: at 17° the
    // bot could not turn this hull away from the shore and put it aground
    // twenty-nine times over ten seeds against thirteen before. A craft
    // that cannot stay off the beach is not a craft that needs room, it is
    // one nobody can ride.
    nozzleAngle: 21 * DEG,
    impellerPitch: 0.305,
    // A quick electronic bucket with a lot of mass behind it, and a long
    // ride plate for the top speed. The sponsons still run wider than
    // anything else here — this is the hull that needs room — but they
    // bite enough to get it round a buoy, which at 0.9 they did not.
    bucket: { reverse: 0.45, deploy: 0.35 },
    trimRange: 6 * DEG,
    sponsonBite: 1.14,
    ridePlate: 1.1,
    bowRise: 0.9,
    riderAuthority: 0.85,
    // THE SLIPPERIEST HULL HERE, and the reason this craft still owns the
    // top speed on a good deal less power than it used to carry. Aero drag
    // is what caps a hull that is already planing, so a low, faired deck
    // buys the end of the straight without buying the launch with it —
    // where raw power bought BOTH, which is how one craft came to be best
    // at everything.
    cdA: 0.7,
    lateralCd: 1.35,
    riderMass: 82,
    riderHeight: 0.58,
    topSpeed: 108,
    accel0to50: 2.2,
  },
  {
    id: "otter",
    name: "Otter",
    archetype: "tourer",
    blurb: "Heavy and soft over a wave. Slow away, but it will run all day.",
    mass: 420,
    length: 3.55,
    beam: 1.32,
    height: 0.72,
    deadrise: 20,
    displacement: 1.05,
    cog: { y: 0.46, z: -0.426 },
    powerKw: 150,
    maxRpm: 7300,
    idleRpm: 1500,
    torque: marineCurve(150, 7300, 1.15),
    boost: { peak: 0, onset: 0 },
    // THE LONG LEGS THE CLASS IS SOLD ON. A touring hull is not a slow
    // hull — it is a big engine in a big boat, built to hold a cruise all
    // day — and the widest nozzle here passes the water to do it. What it
    // still cannot do is LEAVE: four hundred and twenty kilos in their own
    // bow wave is the slowest hump on the roster whatever the pump is
    // doing, which is the honest cost and the one this craft keeps.
    nozzleDiameter: 0.092,
    // A touring hull steers its nozzle FURTHER than a sportier one, because
    // it is the only authority it has: heavy, long-plated and soft-sponsoned,
    // it cannot bank a corner the way a runabout does, so the jet has to do
    // the work the hull will not. It is still the second-slowest here to
    // come round — the mass and the yaw inertia see to that — but it can
    // now make a buoy, which is the difference between a gentle craft and
    // an unusable one.
    nozzleAngle: 25 * DEG,
    impellerPitch: 0.275,
    // Everything a touring hull carries and a racer strips: the strongest
    // brake here, electric trim with the widest range, the longest ride
    // plate and the DEEPEST forefoot — the least rocker here, which is
    // what keeps its bow out of the water on a bad landing. The rider sits
    // behind a backrest, so they
    // have a little less say in the air than a runabout's — but only a
    // little, because that say is what LEVELS a hull for its landing, and
    // a tourer that could not level is a tourer that dives most, which is
    // the one thing this hull is not (`make sim`'s dive column, measured).
    bucket: { reverse: 0.6, deploy: 0.3 },
    trimRange: 7 * DEG,
    sponsonBite: 1.16,
    ridePlate: 1.08,
    bowRise: 0.8,
    riderAuthority: 0.9,
    cdA: 0.95,
    lateralCd: 1.15,
    riderMass: 85,
    riderHeight: 0.6,
    topSpeed: 91,
    accel0to50: 2.4,
  },
  {
    id: "dart",
    name: "Dart",
    archetype: "stand-up",
    blurb: "A stand-up. The lightest and the quickest to turn; it will throw you.",
    mass: 150,
    length: 2.7,
    beam: 0.9,
    height: 0.5,
    deadrise: 16,
    displacement: 0.34,
    cog: { y: 0.3, z: -0.324 },
    powerKw: 76,
    maxRpm: 7000,
    idleRpm: 1400,
    torque: marineCurve(76, 7000, 1.12),
    boost: { peak: 0, onset: 0 },
    // A wide nozzle on the shortest gearing here: everything this engine
    // makes goes into thrust at the bottom, because a 150 kg hull with a
    // ceiling this low has nothing to gain from top-end tuning. It leaves
    // a buoy with anybody.
    nozzleDiameter: 0.077,
    // Still the quickest thing here to come round — a third of the marlin's
    // yaw inertia sees to that without any help from the nozzle — so the
    // deflection is pulled back to where the roster's turn rates span
    // under two to one. At a wider setting this craft simply won the
    // course: gates are what a run is scored on, turning is what takes
    // them, and a hull that turns two and a half times better than the
    // field is not an archetype, it is the answer.
    nozzleAngle: 20 * DEG,
    impellerPitch: 0.26,
    // NO BUCKET AND NO TRIM: a freestyle stand-up carries neither, and the
    // rider is both. Deep sponsons and barely any ride plate, so it hooks
    // and it pivots; and the most rocker here, so there is nothing forward
    // to stop it going straight under. In the
    // air the rider has half again the say anyone sat down has, which is
    // what makes it the only craft here that flips as a matter of course.
    bucket: { reverse: 0, deploy: 0 },
    trimRange: 0,
    // Still the tightest circle on the roster by a clear margin — a third
    // of the marlin's yaw inertia is most of that, and it needs no help
    // from the fins to keep it.
    sponsonBite: 0.98,
    ridePlate: 0.78,
    bowRise: 1.3,
    riderAuthority: 1.5,
    cdA: 0.8,
    lateralCd: 1.05,
    riderMass: 78,
    riderHeight: 0.95,
    topSpeed: 78,
    accel0to50: 2.25,
  },
];

export const CRAFT_IDS: readonly CraftId[] = CRAFT.map((c) => c.id);

/** THE SPEED CLASS this spec is ridden at — the kart-game class, quoted in
 * what it BUYS: 2 means the hull runs twice the speed the catalog quotes it
 * at. `TUNING.pump.speedClass` is the default a run is dealt when nobody
 * picks one, and `CLASS_BAND` is what the picker offers.
 *
 * It is applied HERE, by deriving a spec, rather than read out of the
 * tuning by the physics — because it is a choice a rider makes per run, and
 * a global would make it a property of the build. Everything downstream
 * then reads one spec and needs to know nothing: `topSpeedOf` is the spec's
 * own number, `jetVelocity` the spec's own pitch, `curveTorque` the spec's
 * own curve.
 *
 * Underneath it is a taller impeller and the engine to swing it — the pitch
 * as `class^(1/classGain)` and the engine's torque as the CUBE of that
 * pitch, because the pump's load torque goes as pitch³ at a given shaft
 * speed and an engine that did not grow with it would simply bog (measured
 * without the cube, a class of 2 left the fastest craft SLOWER than class
 * 1). `classGain` is why the pitch is the smaller number: a planing hull
 * lifts as it speeds up, so its wetted area shrinks, its drag grows slower
 * than v², and a pitch that doubles the jet buys more than double the
 * speed. Promised against achieved is within 2–4 % over the whole band.
 *
 * The derived EXPECTATIONS move with it: `topSpeed` by the class itself and
 * `accel0to50` by the square of it (a class scales the thrust, not the
 * mass, so the time to a fixed speed falls as the square). What separates
 * the four hulls does not move at all — this scales all of them together.
 *
 * AND THE RIDER'S TWO DEFLECTIONS COME BACK DOWN — his nozzle's angle and
 * his authority in the air, both scaled by `class^-TUNING.pump.classSteer`.
 * Every steering term in the model is quoted against the water in ABSOLUTE
 * metres a second (the nozzle's side force is a share of a thrust that
 * grew, the keel's bite and the carve go as v², the plate in the air goes
 * as v²), so a class that scaled only the pump gives the rider a different
 * craft rather than a faster one.
 *
 * THE RULE IT IS SIZED TO: one craft's classes all manoeuvre the same, and
 * a faster class never comes round SHARPER per metre of track than a slower
 * one — nothing that goes faster turns tighter. MEASURED over 0.75 → 1.50,
 * holding full lock from 85 % of each class's own top speed and holding the
 * lean back off a 0.35 rad ramp, at the dial's 0 and at its shipped ¾:
 *
 *           turn °/10 m          peak yaw °/s      air pitch °/s
 *           0            ¾       0         ¾       0         ¾
 *   skiff   10.8→15.1  12.5→11.6   33→132   39→ 92   188→262   207→171
 *   marlin   7.3→10.7   8.4→ 8.2   36→123   42→116   139→152   151→139
 *   otter    8.9→10.9  10.4→ 8.6   27→ 93   33→ 61   123→136   136→123
 *
 * At 0 every hull turns sharper the faster it is ridden, which is the twitch
 * a rider reports as "the fast class is easier to crash". At ¾ the turn per
 * metre is flat to slightly wider, which is what a bigger, faster machine
 * should do. What the dial does NOT flatten is the total a jump rotates
 * through: a faster class leaves the lip harder and hangs half again as
 * long, and taking that back would be taking the jump itself back.
 *
 * THE DART IS NOT AMONG THEM, and the dial is not why: the stand-up's turn
 * per metre already FELL across the band before this existed (13.4 → 11.0 at
 * 0). Benched at class 1.50 it rolls to 25° under sustained full lock and
 * its wetted share collapses to 0.05 with the yaw rate going negative — the
 * hull is coming out of the water, not running out of nozzle. That is the
 * catalog's business (`craft-tuning`), and no deflection here can answer it.
 *
 * It is handed back HERE, as two spec numbers, so that every reader — the
 * pump, the flight, the ceilings the BOT plans against (`limits.ts`), the
 * craft card's TURNING bar — sees one spec and needs to know nothing. It
 * scales a DEFLECTION and never a force: the class keeps every bit of the
 * speed it promised, and at class 1 the factor is exactly 1. */
export function craftAtClass(spec: CraftSpec, speedClass: number): CraftSpec {
  const k = Math.max(0.1, speedClass);
  if (k === 1) return spec;
  const pitch = Math.pow(k, 1 / TUNING.pump.classGain);
  const torque = pitch ** 3;
  const authority = Math.pow(k, -TUNING.pump.classSteer);
  return {
    ...spec,
    impellerPitch: spec.impellerPitch * pitch,
    torque: spec.torque.map(([rpm, t]) => [rpm, t * torque]) as CraftSpec["torque"],
    powerKw: spec.powerKw * torque,
    nozzleAngle: spec.nozzleAngle * authority,
    riderAuthority: spec.riderAuthority * authority,
    topSpeed: spec.topSpeed * k,
    accel0to50: spec.accel0to50 / (k * k),
  };
}

/** The classes the game offers, slowest first — a kart game's engine
 * classes. 1 is the roster as the catalog tunes it and the one every
 * measurement in `docs/riding.md` is quoted at. */
export const CLASS_BAND: readonly number[] = [0.75, 1, 1.25, 1.5];

export function craftById(id: string): CraftSpec {
  const spec = CRAFT.find((c) => c.id === id);
  if (!spec) throw new Error(`Unknown craft: ${id}`);
  return spec;
}

export function isCraftId(id: string): id is CraftId {
  return CRAFT.some((c) => c.id === id);
}
