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
// | `tourer`      | otter  | soft over a wave, unshakable| slow to plane, slow to turn|
// | `stand-up`    | dart   | pivots, flips, tightest line| slowest, will throw you    |
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
   * keel and `z` ahead of the hull's mid-length, m. */
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
    cog: { y: 0.42, z: -0.31 },
    powerKw: 96,
    maxRpm: 7600,
    idleRpm: 1500,
    torque: marineCurve(96, 7600, 1.12),
    boost: { peak: 0, onset: 0 },
    nozzleDiameter: 0.0675,
    nozzleAngle: 24 * DEG,
    impellerPitch: 0.283,
    // The reference craft: every dimensionless knob below is 1 here, and
    // the rest of the roster is quoted against it. A mid-range bucket and
    // a manual trim lever — what a rec-lite runabout actually carries.
    bucket: { reverse: 0.5, deploy: 0.45 },
    trimRange: 4 * DEG,
    sponsonBite: 1,
    ridePlate: 1,
    bowRise: 1,
    riderAuthority: 1,
    cdA: 0.75,
    lateralCd: 1.25,
    riderMass: 80,
    riderHeight: 0.55,
    topSpeed: 88,
    accel0to50: 2.7,
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
    cog: { y: 0.45, z: -0.35 },
    powerKw: 225,
    maxRpm: 8000,
    idleRpm: 1600,
    torque: marineCurve(225, 8000, 1.1, 0.45),
    // BLOWN, and the only one here that is: 225 kW at the limiter out of a
    // 155 kW engine, with none of it under 55% of the rev range. It is the
    // fastest craft on the water and the one that has to be kept singing.
    boost: { peak: 0.45, onset: 0.55 },
    nozzleDiameter: 0.0853,
    nozzleAngle: 22 * DEG,
    impellerPitch: 0.305,
    // A quick electronic bucket with a lot of mass behind it, a long ride
    // plate for 110 km/h, and sponsons set to run wide rather than hook.
    bucket: { reverse: 0.45, deploy: 0.35 },
    trimRange: 6 * DEG,
    sponsonBite: 0.9,
    ridePlate: 1.1,
    bowRise: 0.9,
    riderAuthority: 0.85,
    cdA: 0.85,
    lateralCd: 1.35,
    riderMass: 82,
    riderHeight: 0.58,
    topSpeed: 108,
    accel0to50: 1.8,
  },
  {
    id: "otter",
    name: "Otter",
    archetype: "tourer",
    blurb: "Heavy and soft over a wave. Slow to come round, hard to unsettle.",
    mass: 420,
    length: 3.55,
    beam: 1.32,
    height: 0.72,
    deadrise: 20,
    displacement: 1.05,
    cog: { y: 0.46, z: -0.36 },
    powerKw: 130,
    maxRpm: 7300,
    idleRpm: 1500,
    torque: marineCurve(130, 7300, 1.15),
    boost: { peak: 0, onset: 0 },
    nozzleDiameter: 0.0868,
    nozzleAngle: 20 * DEG,
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
    sponsonBite: 0.95,
    ridePlate: 1.08,
    bowRise: 0.8,
    riderAuthority: 0.9,
    cdA: 0.95,
    lateralCd: 1.15,
    riderMass: 85,
    riderHeight: 0.6,
    topSpeed: 85,
    accel0to50: 2.8,
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
    cog: { y: 0.3, z: -0.27 },
    powerKw: 60,
    maxRpm: 7000,
    idleRpm: 1400,
    torque: marineCurve(60, 7000, 1.12),
    boost: { peak: 0, onset: 0 },
    nozzleDiameter: 0.069,
    nozzleAngle: 26 * DEG,
    impellerPitch: 0.26,
    // NO BUCKET AND NO TRIM: a freestyle stand-up carries neither, and the
    // rider is both. Deep sponsons and barely any ride plate, so it hooks
    // and it pivots; and the most rocker here, so there is nothing forward
    // to stop it going straight under. In the
    // air the rider has half again the say anyone sat down has, which is
    // what makes it the only craft here that flips as a matter of course.
    bucket: { reverse: 0, deploy: 0 },
    trimRange: 0,
    sponsonBite: 1.1,
    ridePlate: 0.78,
    bowRise: 1.3,
    riderAuthority: 1.5,
    cdA: 0.8,
    lateralCd: 1.05,
    riderMass: 78,
    riderHeight: 0.95,
    topSpeed: 74,
    accel0to50: 2.9,
  },
];

export const CRAFT_IDS: readonly CraftId[] = CRAFT.map((c) => c.id);

export function craftById(id: string): CraftSpec {
  const spec = CRAFT.find((c) => c.id === id);
  if (!spec) throw new Error(`Unknown craft: ${id}`);
  return spec;
}

export function isCraftId(id: string): id is CraftId {
  return CRAFT.some((c) => c.id === id);
}
