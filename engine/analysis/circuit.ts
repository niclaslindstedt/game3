// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R29, R30, R31 — THE OCEAN CIRCUIT, re-checked on the finished level.
//
// The fourth of `analyzeLevel`'s parts, and the one that only runs on a
// level built to the rule book's second chapter. Everything in here is read
// off what the level PUBLISHES — the path, the gates, the offshore field,
// the marks — and never off the loop the generator drew, because a `Level`
// carries no loop and the whole point of the scoreboard is that it cannot
// see the plan.
//
// The three rules split cleanly:
//
//   R29  the line is out at sea. One floor, held every metre of the way,
//        and the level's own shape asked for it: a circuit that came out
//        with a shore inside the band is a circuit whose basin was cut in
//        the wrong place, and the rider meets it as a beach on the exit of
//        a corner.
//   R30  the ride is whole laps of one lap. The gates repeat, the spacing
//        is even round the seam as well as inside a lap, and the finish
//        stands on the start line.
//   R31  the lap goes round rocks. `roundingAbout` is the measure, and it
//        is the SEARCH's measure — the drawer accepted each mark by asking
//        this same function, so a rounding the generator built and one the
//        scoreboard reads are the same thing by construction.

import { sampleField } from "../lib/heightfield.ts";
import { lapTurn, roundingAbout } from "../mapgen/circuit.ts";
import { cumulative, distanceAlong, walkPolyline } from "../mapgen/course.ts";
import { LEVEL_RULES as R, withinBand } from "../mapgen/rules.ts";
import type { Level } from "../mapgen/types.ts";
import { ANALYSIS as A } from "./budgets.ts";
import { bandText, fmt, type Report } from "./report.ts";

/** R29, R30, R31 — every check a circuit owes, and nothing a coast level
 * would recognise. Returns the least offshore distance anywhere on the
 * line, which is a circuit's headline number the way the ocean leg's reach
 * is a coast level's. */
export function analyzeCircuit(level: Level, rep: Report): number {
  const C = R.circuit;
  const path = level.course.path;
  const course = level.course;

  // ── R29 — every metre of it is out at sea ───────────────────────────
  let least = Infinity;
  let at: { x: number; z: number } | undefined;
  walkPolyline(path, A.stride, (x, z) => {
    const off = sampleField(level.offshore, x, z);
    if (off < least) {
      least = off;
      at = { x, z };
    }
    return true;
  });
  if (least < C.offshore.min - A.circuit.offshore) {
    rep.fail(
      "R29",
      "offshore",
      `the line comes ${fmt(least)} m off the shore (rule ${C.offshore.min} m)`,
      { at, value: least },
    );
  }
  // …and it is a LOOP: what the rider rides ends where a lap began.
  const seam = Math.hypot(path[path.length - 1].x - path[0].x, path[path.length - 1].z - path[0].z);
  if (Math.abs(seam - R.start.behind) > A.distance) {
    rep.fail(
      "R29",
      "closed",
      `the line finishes ${fmt(seam)} m from where it started (rule ${R.start.behind} m, the start's own setback)`,
      { value: seam },
    );
  }

  // ── R30 — the ride is whole laps of one lap ─────────────────────────
  const laps = course.laps;
  const lapGates = course.lapGates;
  if (!withinBand(laps, C.laps)) {
    rep.fail("R30", "laps", `${laps} laps (band ${bandText(C.laps)})`, { value: laps });
  }
  if (course.gates.length !== laps * lapGates + 1) {
    rep.fail(
      "R30",
      "gates",
      `${course.gates.length} gates for ${laps} laps of ${lapGates} (rule ${laps * lapGates + 1})`,
      { value: course.gates.length },
    );
  } else {
    // Gate `i` and gate `i + lapGates` are the SAME water. A course whose
    // laps drift apart is a course somebody laid twice rather than one lap
    // ridden twice, and every lap after the first would be a different
    // race.
    for (let i = 0; i + lapGates < course.gates.length; i++) {
      const a = course.gates[i];
      const b = course.gates[i + lapGates];
      const off = Math.hypot(a.x - b.x, a.z - b.z);
      if (off > A.distance || a.kind !== b.kind) {
        rep.fail("R30", "lap", `${b.id} is ${fmt(off)} m from ${a.id}, a lap earlier`, {
          at: b,
          value: off,
        });
        break;
      }
    }
  }
  if (!withinBand(course.length, C.length)) {
    rep.fail(
      "R30",
      "length",
      `the ride is ${fmt(course.length)} m over ${laps} laps (band ${bandText(C.length)} m)`,
      { value: course.length },
    );
  }
  // The lap itself, measured off the path rather than divided out of it:
  // the path is the start's stub and then the loop, `laps` times.
  const lap = (course.length - R.start.behind) / laps;
  if (!withinBand(lap, C.lap)) {
    rep.fail("R30", "lap", `a lap is ${fmt(lap)} m (band ${bandText(C.lap)} m)`, { value: lap });
  }
  const finish = course.gates[course.gates.length - 1];
  const first = course.gates[0];
  if (finish && first && Math.hypot(finish.x - first.x, finish.z - first.z) > A.distance) {
    rep.fail("R30", "finish", `the finish is not on the start line`, { at: finish });
  }

  // ── R31 — the lap goes round rocks ──────────────────────────────────
  const marks = level.solids.filter((s) => s.kind === "mark");
  if (!withinBand(marks.length, C.mark.count)) {
    rep.fail("R31", "count", `${marks.length} marks (band ${bandText(C.mark.count)})`, {
      value: marks.length,
    });
  }
  // Measured over ONE lap of the path. A mark inside the loop is wound a
  // full turn every lap, so reading the whole ride would only ever say
  // "three laps' worth" and the rule is about a lap.
  const cum = cumulative(path);
  const lapEnd = distanceAlong(path, cum, first.x, first.z, R.start.behind + lap - A.distance);
  const oneLap: { x: number; z: number }[] = [];
  walkPolyline(path, A.stride, (x, z, d) => {
    if (d < R.start.behind) return true;
    if (d > lapEnd) return false;
    oneLap.push({ x, z });
    return true;
  });
  for (const mark of marks) {
    const round = roundingAbout(oneLap, mark, C.mark.near);
    if (!withinBand(round.stand, C.mark.stand, A.circuit.stand)) {
      rep.fail(
        "R31",
        "stand",
        `${mark.id} stands ${fmt(round.stand)} m off the line (band ${bandText(C.mark.stand)} m)`,
        { at: mark, value: round.stand },
      );
    }
    // A closed lap winds a full turn about everything INSIDE it and nothing
    // about anything outside, so this is where a mark parked on the wrong
    // side of the line is caught.
    if (Math.abs(round.winding) < Math.PI * 2 - A.circuit.winding) {
      rep.fail(
        "R31",
        "outside",
        `the lap does not enclose ${mark.id} (it winds ${fmt((Math.abs(round.winding) * 180) / Math.PI)}° about it)`,
        { at: mark, value: Math.abs(round.winding) },
      );
    }
    if (round.sweep < C.mark.wrap - A.circuit.wrap) {
      rep.fail(
        "R31",
        "round",
        `the line swings ${fmt((round.sweep * 180) / Math.PI)}° about ${mark.id} at its own range (rule ${fmt((C.mark.wrap * 180) / Math.PI)}°)`,
        { at: mark, value: round.sweep },
      );
    }
  }
  return least;
}

/** R29 — how far the line turns going round ONE lap, rad, and the check
 * that it is a lap with corners in it. R22's "longer than its own chord"
 * says nothing about a closed line — a loop's chord is the start's own
 * setback, so every circuit is forty times it — and this is what replaces
 * it: a plain circle turns 2π and nothing more, so anything past that is
 * line that turned back on itself. */
export function analyzeCircuitTurn(level: Level, rep: Report): number {
  // Over the whole ride and divided by the laps: the seam is inside the walk
  // that way, so a kink where one lap joins the next is turning this counts
  // rather than turning it steps over.
  const perLap = lapTurn(level.course.path) / level.course.laps;
  if (!withinBand(perLap, R.circuit.turn, A.circuit.turn)) {
    rep.fail(
      "R29",
      "turn",
      `a lap turns ${fmt(perLap)} rad in all (band ${bandText(R.circuit.turn)})`,
      { value: perLap },
    );
  }
  return perLap;
}
