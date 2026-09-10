// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R25, R26 — HOW FAR THE LEVEL REACHES, out and in. The two places a level
// goes past the strip of coast the race is otherwise held to: the OCEAN LEG
// that leaves the band to round a mark, and the RIVER that carries the
// water on inland after the race has stopped.
//
// Both are checked the way everything here is checked — off what the level
// PUBLISHES, not off what the generator meant. The leg is not read from a
// route (there is no route on a `Level`): it is the stretch of the path
// that stands outside R1's band, found by walking the path and asking the
// offshore field. So a leg that came out inside the band is not a leg, and
// a course that wandered out of the band somewhere else is a second leg the
// R1 check is still free to fail — which is exactly the pair of faults
// R25 exists to tell apart.

import { sampleField } from "../lib/heightfield.ts";
import { cumulative, polylineDistance, walkPolyline } from "../mapgen/course.ts";
import { LEVEL_RULES as R, withinBand } from "../mapgen/rules.ts";
import type { Level, Vec2 } from "../mapgen/types.ts";
import { ANALYSIS as A } from "./budgets.ts";
import { bandText, fmt, type Report } from "./report.ts";

/** R25 — the stretch of path that stands outside R1's band: where it
 * starts and ends (m along the path), how far out its furthest point gets
 * and where that point is. The LONGEST such stretch, and how many there
 * are — anything but the longest is R1's business, not this rule's. */
export type OceanRun = {
  readonly from: number;
  readonly to: number;
  readonly apex: Vec2;
  readonly offshore: number;
  readonly count: number;
};

export function oceanRun(level: Level): OceanRun | null {
  const ceiling = R.course.offshore.max;
  let count = 0;
  let from = 0;
  let best: OceanRun | null = null;
  let apex: Vec2 = { x: 0, z: 0 };
  let furthest = 0;
  let inRun = false;
  const close = (to: number): void => {
    if (!inRun) return;
    inRun = false;
    const run: OceanRun = { from, to, apex, offshore: furthest, count: 0 };
    if (!best || run.to - run.from > best.to - best.from) best = run;
  };
  walkPolyline(level.course.path, A.stride, (x, z, d) => {
    const off = sampleField(level.offshore, x, z);
    if (off > ceiling) {
      if (!inRun) {
        inRun = true;
        count++;
        from = d;
        furthest = 0;
      }
      if (off > furthest) {
        furthest = off;
        apex = { x, z };
      }
    } else {
      close(d);
    }
    return true;
  });
  close(Infinity);
  return best === null ? null : { ...(best as OceanRun), count };
}

/**
 * R25 — THE OCEAN LEG, and the mark at the end of it.
 *
 * Three things make a leg a leg rather than a bulge: it goes far enough out
 * (`leg.offshore`), it does not take over the race (`leg.span`), and there
 * is a ROCK at the end of it that the line goes ROUND. The last is the one
 * worth measuring carefully — a path that runs out to a mark, turns beside
 * it and comes back is not a rounding, it is a dog-leg past a rock — so
 * what is measured is how far the path swings AROUND the mark: the angle
 * the line subtends at it, summed along the whole path.
 */
export function analyzeOceanLeg(level: Level, run: OceanRun | null, rep: Report): void {
  const marks = level.solids.filter((s) => s.kind === "mark");
  if (marks.length !== 1) {
    rep.fail("R25", "mark", `the level carries ${marks.length} marks (rule 1)`);
  }
  if (!run) {
    rep.fail("R25", "leg", `the course never leaves the coastal band`);
    return;
  }
  const span = run.to - run.from;
  if (!withinBand(span, R.leg.span)) {
    rep.fail(
      "R25",
      "span",
      `${fmt(span)} m of the path stands outside the band (rule ${bandText(R.leg.span)} m)`,
      { at: run.apex, value: span },
    );
  }
  if (!withinBand(run.offshore, R.leg.offshore)) {
    rep.fail(
      "R25",
      "offshore",
      `the ocean leg reaches ${fmt(run.offshore)} m out (band ${bandText(R.leg.offshore)} m)`,
      { at: run.apex, value: run.offshore },
    );
  }
  const mark = marks[0];
  if (!mark) return;
  const stand = polylineDistance(level.course.path, mark.x, mark.z);
  if (stand > R.leg.round.max + A.leg.stand) {
    rep.fail("R25", "stand", `the mark stands ${fmt(stand)} m off the path`, {
      at: mark,
      value: stand,
    });
  }
  // How far the path goes ROUND it: the angle from the mark to the line,
  // accumulated as the line moves. A rounding is half a turn of it.
  //
  // Over the LEG only. The rest of the course is a couple of hundred metres
  // of coast a long way off, and it subtends its own slow swing at the
  // mark — the wrong sign as often as the right one — which is a rounding
  // measured with the whole level's shape added to it as noise.
  let wrap = 0;
  let last: number | undefined;
  walkPolyline(level.course.path, A.stride, (x, z, d) => {
    if (d < run.from || d > run.to) return true;
    const angle = Math.atan2(x - mark.x, z - mark.z);
    if (last !== undefined) {
      let d = angle - last;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      wrap += d;
    }
    last = angle;
    return true;
  });
  if (Math.abs(wrap) < A.leg.wrap) {
    rep.fail(
      "R25",
      "round",
      `the path swings ${fmt((Math.abs(wrap) * 180) / Math.PI)}° round the mark (rule ${fmt(
        (A.leg.wrap * 180) / Math.PI,
      )}°)`,
      { at: mark, value: Math.abs(wrap) },
    );
  }
}

/**
 * R26 — THE RIVER, walked from its mouth to its head.
 *
 * What has to be true of it is what a rider finds riding up it: it IS
 * water the whole way (a reach the taper or an island cut in half is a
 * river with a hole in it), it gets somewhere — `river.inland` from the
 * mouth, which is the rule's whole point — it THINS as it goes, and it
 * ends in something nothing can ride past. The last is measured as the
 * water a hull needs (R5's own depth): the head is under it, so a rider
 * who keeps going grounds, and the level does not have to grow a fence.
 */
export function analyzeRiver(level: Level, rep: Report): void {
  const river = level.river;
  if (river.length < 2) {
    rep.fail("R26", "line", `the level carries no river`);
    return;
  }
  const mouth = river[0];
  const head = river[river.length - 1];
  const offshoreAt = (x: number, z: number): number => sampleField(level.offshore, x, z);
  const depthAt = (x: number, z: number): number => -sampleField(level.ground, x, z);
  const inland = Math.hypot(head.x - mouth.x, head.z - mouth.z);
  if (inland < R.river.inland.min - A.river.inland) {
    rep.fail(
      "R26",
      "inland",
      `the river reaches ${fmt(inland)} m from its mouth (rule ${R.river.inland.min} m)`,
      { at: head, value: inland },
    );
  }
  const cum = cumulative(river);
  const length = cum[cum.length - 1];
  let dry: Vec2 | undefined;
  let widest = 0;
  walkPolyline(river, A.river.walk, (x, z, d) => {
    const off = offshoreAt(x, z);
    // The mouth's own run is the race's water and is as wide as the
    // corridor there; past it the river is its own.
    if (d <= R.river.mouthRun) widest = Math.max(widest, off);
    if (off <= 0 && !dry) dry = { x, z };
    return true;
  });
  if (dry) {
    rep.fail("R26", "water", `the river runs out of water ${fmt(inland)} m up`, { at: dry });
  }
  const tip = offshoreAt(head.x, head.z);
  if (tip > R.river.head + A.river.head) {
    rep.fail("R26", "head", `the river's head is still ${fmt(tip)} m of water wide`, {
      at: head,
      value: tip,
    });
  }
  if (tip >= widest) {
    rep.fail(
      "R26",
      "taper",
      `the river does not thin: ${fmt(widest)} m at the mouth, ${fmt(tip)} m at the head`,
      {
        at: head,
        value: tip,
      },
    );
  }
  const shallow = depthAt(head.x, head.z);
  if (shallow >= R.course.minDepth) {
    rep.fail(
      "R26",
      "creek",
      `the river's head still carries ${fmt(shallow)} m of water (rule under ${R.course.minDepth} m)`,
      { at: head, value: shallow },
    );
  }
  const sinuosity = inland > 0 ? length / inland : 0;
  if (!withinBand(sinuosity, R.river.sinuosity)) {
    rep.fail(
      "R26",
      "sinuosity",
      `the river runs ${fmt(sinuosity)}× the country it crosses (band ${bandText(
        R.river.sinuosity,
      )})`,
      { at: head, value: sinuosity },
    );
  }
  const reach = polylineDistance(level.course.path, mouth.x, mouth.z);
  if (reach > A.river.mouth) {
    rep.fail("R26", "mouth", `the river's mouth stands ${fmt(reach)} m off the course`, {
      at: mouth,
      value: reach,
    });
  }
  if (!withinBand(length, R.river.length, A.river.inland)) {
    rep.fail(
      "R26",
      "length",
      `the river is ${fmt(length)} m of water (band ${bandText(R.river.length)} m)`,
      { value: length },
    );
  }
}
