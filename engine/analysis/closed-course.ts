// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLOSED-COURSE SCORE: IJSBA's race format translated onto the level
// the game actually rides.
//
// IJSBA defines a closed-course event as multiple riders negotiating
// multiple laps of left- and/or right-hand turns, identifies the standing
// start, turn-marker colours and paired finish buoys, and permits obstacles
// such as ramps. It deliberately leaves a Race Director responsible for
// the dimensions of a safe course. The checks below therefore name which
// half they come from: `IJSBA` for the published event/marker semantics,
// `R*` for Sea Haven's measurable safety translation into metres and
// radians. A project score is not an IJSBA homologation.

import { angleDiff, TAU } from "../lib/math.ts";
import { GATE_CORNER, rulesAtPace } from "../mapgen/pace.ts";
import { LEVEL_RULES as BASE_RULES, withinBand } from "../mapgen/rules.ts";
import type { Gate, Level } from "../mapgen/types.ts";
import type { Finding } from "./report.ts";

/** The generator accepts only closed courses at or above this project
 * score. It is a quality floor, not a number prescribed by IJSBA. */
export const CLOSED_COURSE_FLOOR = 90;

export type CourseCheck = {
  id: string;
  label: string;
  /** 0..1. */
  score: number;
  weight: number;
  value?: number;
  target: string;
  source: string;
};

export type CourseMetric = {
  id: string;
  label: string;
  /** 0..1. */
  score: number;
  weight: number;
  checks: CourseCheck[];
};

export type ClosedCourseScore = {
  /** 0..100. */
  score: number;
  floor: number;
  metrics: CourseMetric[];
};

export type ClosedCourseFacts = {
  findings: readonly Finding[];
  minDepth: number;
  minClearance: number;
  radius: number;
  corner: number;
  turn: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const yes = (value: boolean): number => (value ? 1 : 0);

/** A floor with a linear approach from zero to the target. */
const atLeast = (value: number, target: number): number => clamp01(value / Math.max(1e-9, target));

function metric(id: string, label: string, weight: number, checks: CourseCheck[]): CourseMetric {
  let total = 0;
  let shares = 0;
  for (const check of checks) {
    total += check.score * check.weight;
    shares += check.weight;
  }
  return { id, label, weight, checks, score: shares > 0 ? total / shares : 1 };
}

const distance = (a: { x: number; z: number }, b: { x: number; z: number }): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

const heading = (a: { x: number; z: number }, b: { x: number; z: number }): number =>
  Math.atan2(b.x - a.x, b.z - a.z);

function lapGates(level: Level): readonly Gate[] {
  return level.course.gates.slice(0, level.course.lapGates);
}

/** Accumulated right and left turn in one lap, rad. IJSBA permits either;
 * rewarding both is the game's quality preference, not a sanction rule. */
function turnSides(gates: readonly Gate[]): { left: number; right: number } {
  let left = 0;
  let right = 0;
  for (let i = 0; i < gates.length; i++) {
    const before = gates[(i - 1 + gates.length) % gates.length];
    const here = gates[i];
    const after = gates[(i + 1) % gates.length];
    const turn = angleDiff(heading(here, after), heading(before, here));
    if (turn < 0) left -= turn;
    else right += turn;
  }
  return { left, right };
}

/** Metres from the start to the first gate-to-gate turn worth calling a
 * corner. The IJSBA start rules establish the line and first-turn order;
 * the 15-degree threshold is only how this schematic finds that turn. */
function firstTurnRun(level: Level, gates: readonly Gate[]): number {
  if (gates.length < 3) return 0;
  let run = distance(level.start, gates[0]);
  for (let i = 1; i < gates.length; i++) {
    run += distance(gates[i - 1], gates[i]);
    const after = gates[(i + 1) % gates.length];
    const turn = Math.abs(angleDiff(heading(gates[i], after), heading(gates[i - 1], gates[i])));
    if (turn >= Math.PI / 12) return run;
  }
  return run;
}

function worstRepeatedGate(level: Level): number {
  const { gates, lapGates, laps } = level.course;
  let worst = 0;
  for (let lap = 1; lap < laps; lap++) {
    for (let i = 0; i < lapGates; i++) {
      const repeated = gates[lap * lapGates + i];
      if (!repeated) return Infinity;
      worst = Math.max(worst, distance(gates[i], repeated));
    }
  }
  return worst;
}

function noErrors(findings: readonly Finding[], prefixes: readonly string[]): number {
  return yes(
    !findings.some(
      (finding) =>
        finding.severity === "error" && prefixes.some((prefix) => finding.code.startsWith(prefix)),
    ),
  );
}

/** Build the weighted score after the ordinary analyzer has measured the
 * level. All geometry is taken from the compiled `Level`; no search plan is
 * visible here. */
export function scoreClosedCourse(level: Level, facts: ClosedCourseFacts): ClosedCourseScore {
  const R = rulesAtPace(level.pace, level.rampWidth);
  const gates = lapGates(level);
  const all = level.course.gates;
  const first = all[0];
  const lapClose =
    first && all[level.course.lapGates] ? distance(first, all[level.course.lapGates]) : Infinity;
  const finish = all[all.length - 1];
  const finishClose = first && finish ? distance(first, finish) : Infinity;
  const repeats = worstRepeatedGate(level);
  const sides = turnSides(gates);
  const counterTurn = Math.min(sides.left, sides.right);
  const waterGates = gates.filter((gate) => gate.kind !== "air").length;
  const airGates = gates.filter((gate) => gate.kind === "air").length;
  const roundingBuoys = level.solids.filter((solid) => solid.kind === "buoy").length;
  const firstTurn = firstTurnRun(level, gates);
  const startClear = noErrors(facts.findings, ["R11."]);
  const finishClear = noErrors(facts.findings, ["R4.spacing", "R10.finish"]);

  const metrics = [
    metric("format", "Closed race", 20, [
      {
        id: "circuit",
        label: "the route is a closed course",
        score: yes(level.track === "circuit"),
        weight: 3,
        target: "circuit",
        source: "IJSBA closed-course definition",
      },
      {
        id: "laps",
        label: "the race runs multiple laps",
        score: atLeast(level.course.laps - 1, 1),
        weight: 3,
        value: level.course.laps,
        target: "at least 2 laps",
        source: "IJSBA closed-course definition",
      },
      {
        id: "closure",
        label: "one lap closes on its first checkpoint",
        score: clamp01(1 - lapClose / 10),
        weight: 2,
        value: lapClose,
        target: "0 m gap",
        source: "IJSBA closed-course definition / R30",
      },
      {
        id: "length",
        label: "the whole race fits the closed-course band",
        score: yes(withinBand(level.course.length, R.circuit.length)),
        weight: 2,
        value: level.course.length,
        target: `${R.circuit.length.min}–${R.circuit.length.max} m`,
        source: "R30",
      },
    ]),
    metric("turns", "Turns", 25, [
      {
        id: "present",
        label: "the lap consists of turns",
        score: atLeast(facts.turn, TAU),
        weight: 2,
        value: facts.turn,
        target: `at least ${TAU.toFixed(2)} rad`,
        source: "IJSBA closed-course definition / R29",
      },
      {
        id: "both-ways",
        label: "the lap rewards left- and right-hand riding",
        score: atLeast(counterTurn, 0.35),
        weight: 1,
        value: counterTurn,
        target: "0.35 rad each way",
        source: "Sea Haven quality preference; IJSBA permits either way",
      },
      {
        id: "radius",
        label: "sustained curves keep a rideable radius",
        score: atLeast(facts.radius, R.course.radius),
        weight: 2,
        value: facts.radius,
        target: `at least ${R.course.radius} m`,
        source: "R23",
      },
      {
        id: "corners",
        label: "no checkpoint asks for a kink",
        score: clamp01(1 - Math.max(0, facts.corner - GATE_CORNER) / (Math.PI - GATE_CORNER)),
        weight: 2,
        value: facts.corner,
        target: `at most ${GATE_CORNER.toFixed(2)} rad`,
        source: "R34",
      },
      {
        id: "shape",
        label: "the finished lap passes its circuit-shape checks",
        score: noErrors(facts.findings, ["R29.", "R34."]),
        weight: 2,
        target: "no shape findings",
        source: "R29, R34",
      },
    ]),
    metric("markers", "Course markers", 20, [
      {
        id: "checkpoints",
        label: "the lap is clearly divided into checkpoints",
        score: atLeast(gates.length, 8),
        weight: 2,
        value: gates.length,
        target: "at least 8 per lap",
        source: "IJSBA GEN.4.1 / Sea Haven R4",
      },
      {
        id: "water",
        label: "most checkpoints are buoy markers on the water",
        score: gates.length > 0 ? clamp01(waterGates / gates.length / 0.75) : 0,
        weight: 1,
        value: gates.length > 0 ? waterGates / gates.length : 0,
        target: "at least 75%",
        source: "IJSBA GEN.4.1, GEN.4.4 / R4",
      },
      {
        id: "roundings",
        label: "major turns carry rounding buoys",
        score:
          yes(withinBand(roundingBuoys, R.circuit.mark.count)) *
          noErrors(facts.findings, [
            "R31.stand",
            "R31.inside",
            "R31.ocean",
            "R31.checkpoint",
            "R31.checkpoints",
            "R31.standoff",
            "R31.detour",
            "R31.pass",
          ]),
        weight: 2,
        value: roundingBuoys,
        target: `${R.circuit.mark.count.min}–${R.circuit.mark.count.max}`,
        source: "IJSBA GEN.4.1, GEN.4.4 / R31",
      },
      {
        id: "paint",
        label: "colored rounding buoys are side-prescribed checkpoints",
        score: noErrors(facts.findings, ["R31.side"]),
        weight: 1,
        target: "every rounding buoy has a side",
        source: "IJSBA GEN.4.4 / R31",
      },
      {
        id: "repeat",
        label: "every lap repeats the same markers",
        score: clamp01(1 - repeats / 2),
        weight: 2,
        value: repeats,
        target: "0 m drift",
        source: "IJSBA closed-course definition / R30",
      },
      {
        id: "finish",
        label: "the finish is a paired water gate on the lap line",
        score: yes(finish?.kind === "water") * clamp01(1 - finishClose / 10),
        weight: 3,
        value: finishClose,
        target: "paired gate, 0 m from lap line",
        source: "IJSBA GEN.4.5 / R30",
      },
    ]),
    metric("start", "Start and finish", 15, [
      {
        id: "line",
        label: "the standing start faces the first checkpoint",
        score: startClear,
        weight: 3,
        target: "aligned, behind the line",
        source: "IJSBA GEN.2.1 / R11",
      },
      {
        id: "first-turn",
        label: "the field has water to sort out before turn one",
        score: atLeast(firstTurn, R.start.behind + R.gate.spacing.min),
        weight: 2,
        value: firstTurn,
        target: `at least ${R.start.behind + R.gate.spacing.min} m`,
        source: "IJSBA first-turn procedure / Sea Haven safety translation",
      },
      {
        id: "finish-approach",
        label: "the finish follows a legal checkpoint approach",
        score: finishClear,
        weight: 2,
        target: "legal spacing, no run past it",
        source: "IJSBA GEN.4.5 / R4, R10",
      },
    ]),
    metric("safety", "Water and obstacles", 20, [
      {
        id: "depth",
        label: "the racing line stays over navigable water",
        score: atLeast(facts.minDepth, R.course.minDepth),
        weight: 2,
        value: facts.minDepth,
        target: `at least ${R.course.minDepth} m`,
        source: "IJSBA safety responsibility / R5",
      },
      {
        id: "clearance",
        label: "fixed hazards stay clear of the racing line",
        score: atLeast(facts.minClearance, BASE_RULES.course.solidMargin),
        weight: 2,
        value: facts.minClearance,
        target: `at least ${BASE_RULES.course.solidMargin} m`,
        source: "IJSBA safety responsibility / R6",
      },
      {
        id: "open-water",
        label: "the circuit occupies its intended open-water band",
        score: noErrors(facts.findings, ["R29.offshore", "R29.ashore", "R29.water"]),
        weight: 1,
        target: "no reach findings",
        source: "R29",
      },
      {
        id: "ramps",
        label: "optional ramps have a clear approach and landing",
        score: noErrors(facts.findings, ["R7.", "R8.", "R9.", "R18."]),
        weight: 3,
        value: airGates,
        target: `${R.circuit.airPerLap} per lap, no ramp findings`,
        source: "IJSBA permits obstacles / R7–R9, R18",
      },
    ]),
  ];

  let total = 0;
  let weights = 0;
  for (const group of metrics) {
    total += group.score * group.weight;
    weights += group.weight;
  }
  return {
    score: weights > 0 ? Math.round((total / weights) * 1000) / 10 : 0,
    floor: CLOSED_COURSE_FLOOR,
    metrics,
  };
}
