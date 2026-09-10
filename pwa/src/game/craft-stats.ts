// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CRAFT'S SPEC SHEET — what the craft card tells a rider about the hull
// they are about to take out.
//
// Every number here is DERIVED from the catalog (engine/game/defs/craft.ts)
// and the engine's own models rather than authored beside them, so a craft
// retuned in the catalog reads correctly on the card without anyone
// remembering a second table exists. Nothing is restated: the two figures
// are the catalog's own derived expectations (`topSpeed`, `accel0to50` —
// the pair `craft_test` holds the physics to), and the two bars the
// catalog cannot put a number on are computed out of `staticThrust`,
// `maxNozzle` and `inertia`, which is the same arithmetic the pump and the
// hull do at 120 Hz.
//
// FOUR AXES, AND NO MORE. The card's whole job is showing the CRAFT, and
// every axis past the four is a strip of the picture spent on a bar nobody
// finishes reading. What is left is what the roster actually asks a rider
// to choose between, and it is the four things the catalog's own blurbs
// say out loud: how quickly it gets going, how fast it ends up, how quickly
// it comes round, and how hard it is to unsettle.
//
// The bars are RELATIVE TO THE ROSTER, not absolute. Four craft within a
// quarter of each other on an axis scaled from zero are four identical full
// bars, which is a picture of nothing; what a rider wants off a sheet is
// which hull is the quickest and which will throw them. So the roster's own
// spread is the scale, and `BAR_FLOOR` keeps the worst craft's bar a bar
// rather than an empty slot.
//
// DOM-free: it is imported by `menu_system_test.ts`, and the root test
// project has no DOM lib in it.

import { CRAFT, inertia, maxNozzle, staticThrust, type CraftSpec } from "@engine";

/** How much of the bar the roster's WORST craft on an axis still fills. */
const BAR_FLOOR = 0.3;

/** The water the sheet is quoted on, kg/m³. Every bar here is a RATIO
 * across the roster and the density multiplies each craft's thrust alike,
 * so the value cannot move a bar — it is named rather than left out
 * because `staticThrust` is a force and asking for one without saying what
 * it is pushing against is how a number becomes folklore. The taiga's own
 * water is the only water this slice has (`biomeOf("taiga")`), quoted here
 * as the sheet's reference rather than read off a level: a craft is chosen
 * before a shore is built. */
const SHEET_DENSITY = 1005;

/** HOW QUICKLY IT COMES ROUND, rad/s² — the yaw the nozzle can wring out of
 * the hull with the engine at redline and the nozzle hard over.
 *
 * The jet leaves the transom at `maxNozzle` off the centreline, so the side
 * component is `T·sin θ` acting about half a hull-length behind the centre
 * of gravity, and what resists it is the craft's own yaw inertia. That is
 * the number the rider feels on the handlebars — not a turn RADIUS, which
 * is this divided into a speed and would bill the fastest hull as the
 * clumsiest for being fast. */
export function turnRate(spec: CraftSpec): number {
  const side = staticThrust(spec, SHEET_DENSITY) * Math.sin(maxNozzle(spec));
  return (side * (spec.length / 2)) / inertia(spec).y;
}

/** HOW HARD IT IS TO UNSETTLE — the hull's own beam and mass against the
 * rider standing over it, dimensionless.
 *
 * A wide, heavy hull rights itself; a rider sat high on a narrow one is a
 * mass with a long arm looking for a reason to use it. That ratio is the
 * whole difference between the touring hull nothing upsets and the stand-up
 * that will throw its rider, and it is read off the four numbers the
 * catalog already carries rather than a fifth invented for the card. */
export function steadiness(spec: CraftSpec): number {
  return (spec.mass * spec.beam) / (spec.riderMass * spec.riderHeight);
}

/** The four axes a craft is billed on, in the order they are drawn: what it
 * does down the water first, then what it does under a rider. */
const AXES: {
  key: string;
  label: string;
  of: (spec: CraftSpec) => number;
}[] = [
  // Quicker is better, so the bar reads the reciprocal of the time.
  { key: "accel", label: "ACCELERATION", of: (spec) => 1 / spec.accel0to50 },
  { key: "top", label: "TOP SPEED", of: (spec) => spec.topSpeed },
  { key: "turn", label: "TURNING", of: turnRate },
  { key: "steady", label: "STABILITY", of: steadiness },
];

export type CraftBar = {
  key: string;
  label: string;
  /** BAR_FLOOR..1 — where this craft sits between the roster's worst and
   * best on the axis. Never 0: an empty bar reads as a missing value. */
  value: number;
};

/** Where every axis of one craft sits against the rest of the roster. */
export function craftBars(spec: CraftSpec): CraftBar[] {
  return AXES.map((axis) => {
    const all = CRAFT.map(axis.of);
    const low = Math.min(...all);
    const high = Math.max(...all);
    // A roster with one craft, or an axis every craft shares, is a full bar
    // rather than a division by zero.
    const share = high > low ? (axis.of(spec) - low) / (high - low) : 1;
    return { key: axis.key, label: axis.label, value: BAR_FLOOR + (1 - BAR_FLOOR) * share };
  });
}

export type CraftFact = {
  key: string;
  label: string;
  /** The figure ITSELF, not a rendered string: the card counts to it when
   * the craft under it changes (`lib/count.ts`), and a counter cannot
   * interpolate "108 KM/H". */
  value: number;
  /** How many decimals it is read to. */
  places: number;
  /** What is written after it. */
  unit: string;
};

/** The hard numbers, as figures rather than bars: the two a rider reads off
 * a hull before they look at anything else.
 *
 * Both are the catalog's DERIVED EXPECTATIONS — the pair the physics is
 * held to on flat water — so the card and `craft_test` are quoting one
 * source, and a retune that made the sheet a lie fails a test rather than
 * shipping. Neither the mass nor the power is among them: both were trivia
 * a rider cannot act on, and a line spent answering a question nobody asked
 * is a line the craft does not get. */
export function craftFacts(spec: CraftSpec): CraftFact[] {
  return [
    { key: "top", label: "TOP SPEED", value: spec.topSpeed, places: 0, unit: "KM/H" },
    { key: "sprint", label: "0–50", value: spec.accel0to50, places: 1, unit: "S" },
  ];
}
