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
// scale. A light runabout that is quick off the line and skittish in chop;
// a heavy performance hull that is the fastest thing on the water and needs
// room to turn; a touring hull that is the heaviest and the softest over a
// wave and the slowest to come round; and a stand-up that is the lightest
// and the most agile and will throw its rider. None of them is real: the
// numbers sit inside the published range for personal watercraft (dry mass
// 150–420 kg, 60–230 kW, 70–110 km/h, deadrise 16–24°) without being any
// one manufacturer's row.
//
// `topSpeed` and `accel0to50` are DERIVED EXPECTATIONS, not inputs: the
// physics is what makes the craft go that fast, and `craft_test` holds the
// physics to reproducing each one within tolerance on flat water. Change
// a mass or a pump and the test says what the change did to the sheet.

export type CraftId = "skiff" | "marlin" | "otter" | "dart";

export type CraftSpec = {
  id: CraftId;
  name: string;
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
  /** Engine: rated power, kW, at `maxRpm`; idle and redline, rpm; the
   * torque curve as (rpm, N·m) points read linearly between them. */
  powerKw: number;
  maxRpm: number;
  idleRpm: number;
  torque: readonly (readonly [number, number])[];
  /** Pump: nozzle exit diameter, m; the steering nozzle's full deflection,
   * rad; the impeller's effective pitch, m of jet travel per revolution,
   * so the jet velocity is `impellerPitch × rpm / 60`. */
  nozzleDiameter: number;
  nozzleAngle: number;
  impellerPitch: number;
  /** Aerodynamic drag area of hull plus rider, m² (C_d × A). */
  cdA: number;
  /** Lateral drag coefficient of the underwater profile — the keel and the
   * sponsons; what makes the hull carve rather than skate. */
  lateralCd: number;
  /** The rider as a point mass, kg, this high above the centre of gravity,
   * m. Nothing draws the rider yet; the physics still carries them. */
  riderMass: number;
  riderHeight: number;
  /** Expected flat-water top speed, km/h, and 0–50 km/h time, s. */
  topSpeed: number;
  accel0to50: number;
};

/** A torque curve shaped like a small marine four-stroke: torque rises to
 * a plateau in the middle of the band and falls off toward the limiter,
 * with the rated power landing at `maxRpm`. Peak torque sits `peakRatio`
 * above the torque at rated power. */
function marineCurve(powerKw: number, maxRpm: number, peakRatio: number): [number, number][] {
  const ratedTorque = (powerKw * 1000 * 60) / (2 * Math.PI * maxRpm);
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
    blurb: "Light and quick. Jumps at the throttle, skips over chop.",
    mass: 245,
    length: 3.1,
    beam: 1.18,
    height: 0.62,
    deadrise: 18,
    displacement: 0.66,
    cog: { y: 0.42, z: -0.12 },
    powerKw: 96,
    maxRpm: 7600,
    idleRpm: 1500,
    torque: marineCurve(96, 7600, 1.12),
    nozzleDiameter: 0.07,
    nozzleAngle: 24 * DEG,
    impellerPitch: 0.29,
    cdA: 0.55,
    lateralCd: 1.25,
    riderMass: 80,
    riderHeight: 0.55,
    topSpeed: 88,
    accel0to50: 2.6,
  },
  {
    id: "marlin",
    name: "Marlin",
    blurb: "The fastest thing here. Needs room, and a rider who means it.",
    mass: 360,
    length: 3.45,
    beam: 1.26,
    height: 0.68,
    deadrise: 22,
    displacement: 0.92,
    cog: { y: 0.45, z: -0.15 },
    powerKw: 225,
    maxRpm: 8000,
    idleRpm: 1600,
    torque: marineCurve(225, 8000, 1.1),
    nozzleDiameter: 0.078,
    nozzleAngle: 22 * DEG,
    impellerPitch: 0.34,
    cdA: 0.62,
    lateralCd: 1.35,
    riderMass: 82,
    riderHeight: 0.58,
    topSpeed: 108,
    accel0to50: 2.1,
  },
  {
    id: "otter",
    name: "Otter",
    blurb: "Heavy and soft over a wave. Slow to come round, hard to unsettle.",
    mass: 420,
    length: 3.55,
    beam: 1.32,
    height: 0.72,
    deadrise: 20,
    displacement: 1.05,
    cog: { y: 0.46, z: -0.1 },
    powerKw: 130,
    maxRpm: 7300,
    idleRpm: 1500,
    torque: marineCurve(130, 7300, 1.15),
    nozzleDiameter: 0.086,
    nozzleAngle: 20 * DEG,
    impellerPitch: 0.285,
    cdA: 0.72,
    lateralCd: 1.15,
    riderMass: 85,
    riderHeight: 0.6,
    topSpeed: 85,
    accel0to50: 3.0,
  },
  {
    id: "dart",
    name: "Dart",
    blurb: "A stand-up. The lightest and the quickest to turn; it will throw you.",
    mass: 150,
    length: 2.7,
    beam: 0.76,
    height: 0.5,
    deadrise: 16,
    displacement: 0.34,
    cog: { y: 0.4, z: -0.2 },
    powerKw: 60,
    maxRpm: 7000,
    idleRpm: 1400,
    torque: marineCurve(60, 7000, 1.12),
    nozzleDiameter: 0.068,
    nozzleAngle: 26 * DEG,
    impellerPitch: 0.26,
    cdA: 0.62,
    lateralCd: 1.05,
    riderMass: 78,
    riderHeight: 0.95,
    topSpeed: 76,
    accel0to50: 2.7,
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
