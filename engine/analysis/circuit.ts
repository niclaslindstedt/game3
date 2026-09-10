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
//   R29  the lap runs from the shore out to sea and back. Three readings
//        of one walk — how near the beach it comes, how far out it gets,
//        how much of it tracks the coast — because a lap that is not an
//        out-and-back passes any one of them on its own.
//   R30  the ride is whole laps of one lap. The gates repeat, the spacing
//        is even round the seam as well as inside a lap, and the finish
//        stands on the start line.
//   R31  the lap is ridden round lit buoys, one of them out in the open
//        sea. `roundingAbout` is the measure of a rounding, and it is the
//        SEARCH's measure — the drawer accepted each buoy by asking this
//        same function, so a rounding the generator built and one the
//        scoreboard reads are the same thing by construction. The lights
//        are checked too: an unlit rounding buoy is a mark nobody can find
//        at night, which is most of what a buoy is for.

import { sampleField } from "../lib/heightfield.ts";
import { buoyLightName } from "../game/buoy.ts";
import { lapTurn, roundingAbout } from "../mapgen/circuit.ts";
import { cumulative, distanceAlong, walkPolyline } from "../mapgen/course.ts";
import { LEVEL_RULES as R, withinBand } from "../mapgen/rules.ts";
import type { Level } from "../mapgen/types.ts";
import { ANALYSIS as A } from "./budgets.ts";
import { bandText, fmt, type Report } from "./report.ts";

/** R29, R30, R31 — every check a circuit owes, and nothing a coast level
 * would recognise. Returns how far out the lap's furthest station stands,
 * which is a circuit's headline number the way the ocean leg's reach is a
 * coast level's. */
export function analyzeCircuit(level: Level, rep: Report): number {
  const C = R.circuit;
  const path = level.course.path;
  const course = level.course;

  // ── R29 — the lap runs from the shore out to sea and back ───────────
  // THREE readings of one walk, because the rule has three halves and any
  // one of them alone is passed by a lap that is not an out-and-back: how
  // close it comes to the beach, how far out it gets, and how much of it
  // is ridden along the coast in between. A ring out at sea passes the
  // second; a coastal loop passes the first and third.
  let least = Infinity;
  let furthest = 0;
  let ashore = 0;
  let walked = 0;
  let last = 0;
  let at: { x: number; z: number } | undefined;
  let apex: { x: number; z: number } | undefined;
  walkPolyline(path, A.stride, (x, z, d) => {
    const off = sampleField(level.offshore, x, z);
    const span = d - last;
    last = d;
    walked += span;
    if (off <= R.course.offshore.max) ashore += span;
    if (off < least) {
      least = off;
      at = { x, z };
    }
    if (off > furthest) {
      furthest = off;
      apex = { x, z };
    }
    return true;
  });
  if (!withinBand(least, C.inshore, A.circuit.offshore)) {
    rep.fail(
      "R29",
      "inshore",
      `the lap's nearest approach to the shore is ${fmt(least)} m (band ${bandText(C.inshore)} m)`,
      { at, value: least },
    );
  }
  if (!withinBand(furthest, C.reach, A.circuit.offshore)) {
    rep.fail(
      "R29",
      "reach",
      `the lap gets ${fmt(furthest)} m out to sea (band ${bandText(C.reach)} m)`,
      { at: apex, value: furthest },
    );
  }
  const share = walked > 0 ? ashore / walked : 0;
  if (!withinBand(share, C.ashore, A.circuit.ashore)) {
    rep.fail(
      "R29",
      "ashore",
      `${fmt(share * 100)}% of the lap tracks the shore (band ${fmt(C.ashore.min * 100)}–${fmt(C.ashore.max * 100)}%)`,
      { value: share },
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

  // ── R31 — the lap is ridden round lit buoys ─────────────────────────
  const marks = level.solids.filter((s) => s.kind === "buoy");
  if (!withinBand(marks.length, C.mark.count)) {
    rep.fail("R31", "count", `${marks.length} buoys (band ${bandText(C.mark.count)})`, {
      value: marks.length,
    });
  }
  // …and one of them is OUT THERE. This is the half of R31 that makes the
  // lap an out-and-back: a lap whose every buoy stands in the shallows is a
  // coastal loop, whatever its furthest station reached.
  const offshoreOf = (s: { x: number; z: number }): number => sampleField(level.offshore, s.x, s.z);
  if (marks.length > 0 && !marks.some((m) => offshoreOf(m) >= C.mark.ocean - A.circuit.offshore)) {
    rep.fail(
      "R31",
      "ocean",
      `no buoy stands out past ${C.mark.ocean} m (the furthest is ${fmt(
        Math.max(...marks.map(offshoreOf)),
      )} m out)`,
      { at: marks[0] },
    );
  }
  // Every one of them FLASHES, and no two alike on a lap: a rider picks the
  // corner ahead out of a black sea by counting the flashes, so two buoys
  // with one character are two marks nobody can tell apart.
  const characters = new Set<string>();
  for (const mark of marks) {
    if (!mark.light) {
      rep.fail("R31", "unlit", `${mark.id} is a rounding buoy with no light`, { at: mark });
      continue;
    }
    if (!withinBand(mark.light.flashes, C.mark.light.flashes)) {
      rep.fail(
        "R31",
        "flashes",
        `${mark.id} flashes ${mark.light.flashes} in a group (band ${bandText(C.mark.light.flashes)})`,
        { at: mark, value: mark.light.flashes },
      );
    }
    if (!withinBand(mark.light.period, C.mark.light.period)) {
      rep.fail(
        "R31",
        "period",
        `${mark.id} flashes every ${fmt(mark.light.period)} s (band ${bandText(C.mark.light.period)} s)`,
        { at: mark, value: mark.light.period },
      );
    }
    characters.add(buoyLightName(mark.light));
  }
  if (marks.length > 1 && characters.size < Math.min(marks.length, C.mark.light.flashes.max)) {
    rep.smell("R31", "alike", `${marks.length} buoys carry ${characters.size} characters`, {
      value: characters.size,
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
  return furthest;
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
