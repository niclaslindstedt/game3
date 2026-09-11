// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LEVEL ANALYSIS — the generator's scoreboard, and its gate.
//
// The search builds to the rule book; this re-checks the FINISHED level
// against the same rule book, rule by rule, reading only what the level
// publishes — the baked grids, the gates, the solids, the path. It is
// what `generateLevel` asks before it accepts an attempt, what
// `scripts/analyze-level.mjs` prints, and what the tests hold a
// hand-broken level to. It knows nothing the search knew: not the shore's
// frame, not the geology's plateau, not which stations were pushed. That
// is the point — a check that could read the plan would be checking the
// plan, and the plan is not what the rider rides.
//
// The loop this closes:
//
//   1. change the generator
//   2. generate a level from a fixed seed
//   3. run this, read the findings
//   4. fix what it found
//   5. ask whether the ANALYZER was measuring the right thing — a finding
//      that is not a defect is a budget that needs moving, and a defect
//      nobody flagged is a check that needs writing
//   6. repeat on that seed until it is clean, then take another seed
//
// A finding names its rule, so the fix is pointed at one paragraph of
// `rules.ts`. `ok` is "no errors": a warn is a smell the loop reads and
// nobody has to fix.

import { sampleField } from "../lib/heightfield.ts";
import { angleDiff } from "../lib/math.ts";
import { DECLINATION, daylightWindow } from "../lib/solar.ts";
import { faunaById } from "../game/defs/fauna.ts";
import { createShelter } from "../game/fetch.ts";
import { biomeOf } from "../mapgen/biomes.ts";
import { podClearance, walkPod } from "../mapgen/fauna.ts";
import {
  cumulative,
  distanceAlong,
  gateBuoys,
  polylineDistance,
  walkPolyline,
} from "../mapgen/course.ts";
import { LEVEL_RULES as R, solidBerth, withinBand } from "../mapgen/rules.ts";
import { rulesAtPace } from "../mapgen/pace.ts";
import { insideBounds } from "../mapgen/compile.ts";
import type { Level, Pod, Vec2, Weather } from "../mapgen/types.ts";
import { analyzeAirGate, analyzeRunUp } from "./air.ts";
import { analyzeCircuit, analyzeCircuitTurn } from "./circuit.ts";
import { ANALYSIS as A } from "./budgets.ts";
import {
  analyzeCharacter,
  analyzeShore,
  analyzeSolid,
  analyzeSurface,
  shoreSeaward,
} from "./coast.ts";
import { analyzeOceanLeg, analyzeRiver, oceanRun } from "./reach.ts";
import { createReport, bandText, fmt, type Finding, type Report } from "./report.ts";

export { ANALYSIS } from "./budgets.ts";
export { oceanRun, type OceanRun } from "./reach.ts";
export type { Finding, Severity } from "./report.ts";

export type LevelAnalysis = {
  seed: number;
  ok: boolean;
  findings: Finding[];
  /** Numbers worth reading even when nothing is wrong. */
  stats: {
    gates: number;
    airGates: number;
    length: number;
    minDepth: number;
    minOffshore: number;
    maxOffshore: number;
    /** R25 — how far out the ocean leg's furthest point stands, m, and how
     * high the mark it rounds is. */
    legOffshore: number;
    /** R29 — how far out a circuit's lap gets, m, and 0 on a coast level,
     * where R25's own leg is the reading that answers the same question. */
    leastOffshore: number;
    /** R30 — how many times round; 1 on a coast level. */
    laps: number;
    /** R25, R31 — how many marks the line goes round. */
    marks: number;
    markTop: number;
    /** R26 — how far the river reaches inland from its mouth, m. */
    riverInland: number;
    minClearance: number;
    maxLand: number;
    maxDepth: number;
    solids: number;
    /** Pods placed, and the animals in them (R20). */
    pods: number;
    animals: number;
    /** R21 — the share of the waterline that is sand, 0..1. */
    sandShare: number;
    /** R22 — the path's length as a multiple of the straight line from the
     * start to the finish, and the total heading change along it, rad —
     * and R23's tightest corner on it, m of radius. */
    wind: number;
    turn: number;
    radius: number;
    windSpeed: number;
    hour: number;
    weather: Weather;
  };
  /** Wall time, ms. */
  ms: number;
};

/** Re-check a finished level against every rule in the rule book. */
export function analyzeLevel(level: Level): LevelAnalysis {
  const started = Date.now();
  // R32 — score it against the rule book AT THE PACE IT WAS BUILT TO, not
  // the catalog's own. A level drawn for a faster class has its gates
  // further apart on purpose, and an analyzer reading the unpaced table
  // would call every one of them a fault — and the generator REJECTS on
  // this verdict, so it would simply never terminate. R33's dial travels
  // with it for the same reason: the decks were built to the width this
  // level was dealt.
  const R = rulesAtPace(level.pace, level.rampWidth);
  const rep = createReport();
  const path = level.course.path;
  const gates = level.course.gates;
  const depthAt = (x: number, z: number): number => -sampleField(level.ground, x, z);
  const offshoreAt = (x: number, z: number): number => sampleField(level.offshore, x, z);

  // ── R25 — where the path leaves the coast, before R1 reads it ───────
  // R1's ceiling and R25 are the same measurement read two ways: how far
  // out the line stands. The ocean leg is where the answer is allowed to
  // be a big number, so it is found FIRST and R1 skips it — and only the
  // longest such stretch, so a course that also wandered out of the band
  // somewhere else still fails R1 for it.
  // R29 — a circuit never leaves a coast because it was never on one, and
  // its whole line stands past R1's ceiling by construction. Reading an
  // ocean run off it would find the entire path and call it a leg.
  const circuit = level.track === "circuit";
  const leg = circuit ? null : oceanRun(level);
  const cum = cumulative(path);

  // ── R1, R5 — the path's water ───────────────────────────────────────
  let minDepth = Infinity;
  let minOffshore = Infinity;
  let maxOffshore = -Infinity;
  let worstDepth: { x: number; z: number } | undefined;
  let worstOff: { x: number; z: number; off: number } | undefined;
  const bandMid = (R.course.offshore.min + R.course.offshore.max) / 2;
  const inLeg = (d: number): boolean => leg !== null && d >= leg.from && d <= leg.to;
  walkPolyline(path, A.stride, (x, z, at) => {
    const d = depthAt(x, z);
    const off = offshoreAt(x, z);
    if (d < minDepth) {
      minDepth = d;
      worstDepth = { x, z };
    }
    if (off < minOffshore) minOffshore = off;
    if (off > maxOffshore) maxOffshore = off;
    // The worst offender is the one furthest from the band's middle.
    if (
      !circuit &&
      !withinBand(off, R.course.offshore) &&
      !(inLeg(at) && off > R.course.offshore.max) &&
      (!worstOff || Math.abs(off - bandMid) > Math.abs(worstOff.off - bandMid))
    ) {
      worstOff = { x, z, off };
    }
  });
  if (minDepth < R.course.minDepth) {
    rep.fail(
      "R5",
      "path",
      `only ${fmt(minDepth)} m of water under the path (rule ${R.course.minDepth} m)`,
      {
        at: worstDepth,
        value: minDepth,
      },
    );
  }
  if (worstOff) {
    rep.fail(
      "R1",
      "path",
      `the path runs ${fmt(worstOff.off)} m from the shore (band ${bandText(R.course.offshore)} m)`,
      {
        at: worstOff,
        value: worstOff.off,
      },
    );
  }
  for (const g of circuit ? [] : gates) {
    const off = offshoreAt(g.x, g.z);
    if (
      !withinBand(off, R.course.offshore) &&
      !(inLeg(distanceAlong(path, cum, g.x, g.z)) && off > R.course.offshore.max)
    ) {
      rep.fail(
        "R1",
        "gate",
        `${g.id} stands ${fmt(off)} m from the shore (band ${bandText(R.course.offshore)} m)`,
        {
          at: g,
          value: off,
        },
      );
    }
  }

  // ── R2, R3 — the ground ─────────────────────────────────────────────
  let maxLand = -Infinity;
  let maxDepth = -Infinity;
  // R2's profile, binned by metres inland: its mean height against how far
  // from the water's edge it stands.
  const PROFILE_BINS = Math.ceil((R.land.reach + A.land.margin * 3) / A.land.bin);
  const profileSum = new Float64Array(PROFILE_BINS);
  const profileCount = new Int32Array(PROFILE_BINS);
  let shallowFar = 0;
  let dryAtSea = 0;
  const g = level.ground;
  const o = level.offshore;
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      const i = r * g.cols + c;
      const h = g.data[i];
      const off = o.data[i];
      if (h > maxLand) maxLand = h;
      if (-h > maxDepth) maxDepth = -h;
      // R2 — the land's PROFILE. Read as an AVERAGE against how far inland
      // a cell is, rather than cell by cell: the hills vary from place to
      // place now (R21 is a field over the plan, not a function of a base
      // line), so one cell inland of a taller stretch is climbing without
      // the profile climbing at all. What R2 claims is about the profile —
      // the ground rises from the waterline to the hill this stretch of
      // coast carries inside the reach, and past it holds.
      // …but not the cells the field stopped measuring at (R2's
      // `land.measured`). They carry no inland distance — only "further in
      // than this level cares" — and binning them puts the whole country
      // in whichever bin that floor lands in, where they read as the
      // profile still climbing.
      if (off < 0 && off > -R.land.measured + A.land.tolerance) {
        const bin = Math.min(PROFILE_BINS - 1, Math.floor(-off / A.land.bin));
        profileSum[bin] += h;
        profileCount[bin]++;
      }
      if (off >= R.sea.reach + A.sea.margin && -h < R.sea.depth - A.sea.tolerance) shallowFar++;
      if (off >= A.sea.waterline && h >= 0) dryAtSea++;
    }
  }
  if (maxLand > R.land.maxHeight + A.land.tolerance) {
    rep.fail("R2", "height", `land stands ${fmt(maxLand)} m high (rule ${R.land.maxHeight} m)`, {
      value: maxLand,
    });
  }
  // Past the reach (plus the grid's own blur) the profile has stopped
  // climbing: no bin out there stands higher than the one before it, to
  // within the tolerance.
  const settled = Math.floor((R.land.reach + A.land.margin) / A.land.bin);
  let climb = 0;
  for (let b = settled; b + 1 < PROFILE_BINS; b++) {
    if (profileCount[b] === 0 || profileCount[b + 1] === 0) continue;
    const rise = profileSum[b + 1] / profileCount[b + 1] - profileSum[b] / profileCount[b];
    climb = Math.max(climb, rise / A.land.bin);
  }
  if (climb > A.land.rise) {
    rep.fail("R2", "climb", `the land is still climbing ${fmt(climb)} m/m past the reach`, {
      value: climb,
    });
  }
  if (maxDepth > R.sea.openDepth + A.sea.tolerance) {
    rep.fail("R3", "depth", `the bed reaches ${fmt(maxDepth)} m (rule ${R.sea.openDepth} m)`, {
      value: maxDepth,
    });
  }
  if (shallowFar > 0) {
    rep.fail(
      "R3",
      "reach",
      `${shallowFar} cells past the reach are shallower than ${R.sea.depth - A.sea.tolerance} m`,
      {
        value: shallowFar,
      },
    );
  }
  if (dryAtSea > 0) {
    rep.fail("R3", "dry", `${dryAtSea} sea cells stand above the surface`, { value: dryAtSea });
  }

  // ── R4, R10, R11 — the gates by distance ────────────────────────────
  const total = cum[cum.length - 1];
  // R30 — walked in course ORDER, each search starting where the last one
  // ended: on a lapped course the same buoys are crossed once a lap, and a
  // search of the whole path would give every copy of a gate the first
  // lap's distance.
  const gateD: number[] = [];
  for (const gate of gates) {
    gateD.push(distanceAlong(path, cum, gate.x, gate.z, gateD[gateD.length - 1] ?? 0));
  }
  for (let i = 1; i < gates.length; i++) {
    const spacing = gateD[i] - gateD[i - 1];
    if (!withinBand(spacing, R.gate.spacing, A.distance)) {
      rep.fail(
        "R4",
        "spacing",
        `${gates[i - 1].id}→${gates[i].id} are ${fmt(spacing)} m apart (band ${bandText(R.gate.spacing)} m)`,
        {
          at: gates[i],
          value: spacing,
        },
      );
    }
  }
  for (const gate of gates) {
    if (gate.kind === "water" && Math.abs(gate.width - R.gate.width) > A.distance) {
      rep.fail("R4", "width", `${gate.id} is ${fmt(gate.width)} m wide (rule ${R.gate.width} m)`, {
        at: gate,
      });
    }
  }
  // R10, R30 — a sprint's band, or a circuit's whole ride.
  const lengthBand = circuit ? R.circuit.length : R.course.length;
  if (!withinBand(level.course.length, lengthBand)) {
    rep.fail(
      circuit ? "R30" : "R10",
      "length",
      `the course is ${fmt(level.course.length)} m long (band ${bandText(lengthBand)} m)`,
      {
        value: level.course.length,
      },
    );
  }
  if (Math.abs(level.course.length - total) > A.distance) {
    rep.fail(
      "R10",
      "path",
      `the course says ${fmt(level.course.length)} m but its path measures ${fmt(total)} m`,
    );
  }
  if (gates.length > 0 && Math.abs(total - gateD[gates.length - 1]) > A.distance) {
    rep.fail(
      "R10",
      "finish",
      `the path runs ${fmt(total - gateD[gates.length - 1])} m past the finish gate`,
    );
  }
  if (gates.length > 0) {
    const first = gates[0];
    const setback = Math.hypot(first.x - level.start.x, first.z - level.start.z);
    if (Math.abs(setback - R.start.behind) > A.distance) {
      rep.fail(
        "R11",
        "behind",
        `the start is ${fmt(setback)} m from ${first.id} (rule ${R.start.behind} m)`,
        { value: setback },
      );
    }
    const facing = Math.atan2(first.x - level.start.x, first.z - level.start.z);
    if (Math.abs(angleDiff(facing, level.start.heading)) > A.heading) {
      rep.fail("R11", "facing", `the start does not face ${first.id}`);
    }
    if (Math.abs(angleDiff(first.heading, level.start.heading)) > A.heading) {
      rep.fail("R11", "heading", `the start's heading is not ${first.id}'s`);
    }
    if (Math.hypot(path[0].x - level.start.x, path[0].z - level.start.z) > A.distance) {
      rep.fail("R11", "path", `the path does not begin at the start`);
    }
  }

  // ── R6 — the rocks against the line ─────────────────────────────────
  const buoys = gates.flatMap(gateBuoys);
  let minClearance = Infinity;
  for (const s of level.solids) {
    let clear = polylineDistance(path, s.x, s.z) - s.r;
    for (const b of buoys) clear = Math.min(clear, Math.hypot(b.x - s.x, b.z - s.z) - s.r);
    if (clear < minClearance) minClearance = clear;
    const berth = solidBerth(s.r);
    if (clear < berth) {
      rep.fail(
        "R6",
        "clear",
        `${s.id} (${s.kind}) is ${fmt(clear)} m from the line (rule ${fmt(berth)} m)`,
        {
          at: s,
          value: clear,
        },
      );
    }
  }

  // ── R7, R8, R9 — the air ────────────────────────────────────────────
  const air = gates.filter((gate) => gate.kind === "air");
  if (!withinBand(air.length, R.air.count)) {
    rep.fail("R7", "count", `${air.length} air gates (band ${bandText(R.air.count)})`, {
      value: air.length,
    });
  }
  if (gates.length > 0 && gates[0].kind === "air")
    rep.fail("R7", "first", `${gates[0].id} is the first gate and in the air`);
  if (gates.length > 0 && gates[gates.length - 1].kind === "air") {
    rep.fail("R7", "finish", `${gates[gates.length - 1].id} is the finish and in the air`);
  }
  for (let i = 0; i < gates.length; i++) {
    if (gates[i].kind === "air") analyzeAirGate(level, gates[i], gateD[i], path, cum, depthAt, rep);
  }
  analyzeRunUp(rep, level.pace);
  for (const gate of gates) {
    if (gate.kind === "water" && gate.ramp)
      rep.fail("R8", "stray", `${gate.id} is a water gate with a ramp`);
    if (gate.kind === "water" && gate.y !== 0)
      rep.fail("R4", "afloat", `${gate.id} is a water gate at ${fmt(gate.y)} m`);
  }

  // ── R12, R13 — the conditions ───────────────────────────────────────
  if (!withinBand(level.wind.speed, R.wind.speed)) {
    rep.fail("R12", "speed", `wind ${fmt(level.wind.speed)} m/s (band ${bandText(R.wind.speed)})`, {
      value: level.wind.speed,
    });
  }
  const seaward = shoreSeaward(level);
  if (seaward !== undefined) {
    const swing = Math.abs(angleDiff(seaward, level.wind.from));
    if (swing > R.wind.seaward + A.wind.direction) {
      rep.fail(
        "R12",
        "direction",
        `the wind blows ${fmt((swing * 180) / Math.PI)}° off the sea (rule ${fmt((R.wind.seaward * 180) / Math.PI)}°)`,
        {
          value: swing,
        },
      );
    }
    // ...and the half of R12 the band is CHOSEN to give: a quarter turn or
    // more off the sea is a wind with no push toward the land in it at
    // all, and a coast with no waves against it. Held separately from the
    // band above so that a widened band can never quietly take it away.
    if (swing >= Math.PI / 2) {
      rep.fail("R12", "onshore", `the wind has no push toward the shore in it`, { value: swing });
    }
  }
  // ── R28 — the race meets the sea ────────────────────────────────────
  // Every level holds sheltered water, and it should: a start up a channel
  // and a finish behind a headland are what make riding out into the open
  // worth doing. What a level may NOT be is a race entirely in the lee —
  // the ocean's own sea has to reach some of the course, or the seed is a
  // millpond with buoys on it.
  {
    const shelter = createShelter(level);
    let best = 0;
    let open = 0;
    for (const g of gates) {
      const e = sampleField(shelter.exposure, g.x, g.z);
      if (e > best) best = e;
      if (e >= A.exposure.open) open += 1;
    }
    if (best < A.exposure.reach) {
      rep.fail(
        "R28",
        "lee",
        `the ocean's sea reaches no gate (the most exposed stands at ${fmt(best)})`,
        { value: best },
      );
    } else if (open < A.exposure.gates) {
      rep.smell(
        "R28",
        "sheltered",
        `only ${open} of ${gates.length} gates stand in the ocean's own sea`,
        { value: open },
      );
    }
  }
  const biome = biomeOf(level.biome);
  // R13 — the hour is one of this coast's DAYLIGHT hours in the level's
  // own season. Re-derived from the latitude rather than compared against
  // a band somebody wrote down: the rule is about where the sun stands,
  // and the window is what that works out to on this coast in this season.
  const daylight = daylightWindow(biome.latitude, R.day.minSun, DECLINATION[level.season]);
  if (!daylight) {
    rep.fail("R13", "sun", `the sun never rises on the ${biome.name} in ${level.season}`);
  } else if (!withinBand(level.hour, daylight, A.day.hour)) {
    rep.fail(
      "R13",
      "hour",
      `hour ${fmt(level.hour)} is not daylight here (${bandText(daylight)})`,
      { value: level.hour },
    );
  }
  // R19 — the sky is one the coast offers. A level under a sky the biome
  // has no row for is a level nothing can draw, so it is an error rather
  // than a note.
  if (!biome.weathers.includes(level.weather)) {
    rep.fail(
      "R19",
      "weather",
      `sky "${level.weather}" (${biome.name} offers ${biome.weathers.join(", ")})`,
    );
  }
  if (level.water.density !== biome.water.density) {
    rep.fail(
      "R13",
      "density",
      `water density ${level.water.density} (biome ${biome.water.density})`,
    );
  }
  const waterBand = biome.water.temperature[level.season];
  if (!withinBand(level.water.temperature, waterBand)) {
    rep.fail(
      "R13",
      "temperature",
      `water ${fmt(level.water.temperature)} °C (${level.season} band ${bandText(waterBand)})`,
    );
  }

  // ── R14 — the grid ──────────────────────────────────────────────────
  analyzeGrid(level, rep);

  // ── R15 — the shore ─────────────────────────────────────────────────
  analyzeShore(level, rep);

  // ── R16 — the surface ───────────────────────────────────────────────
  analyzeSurface(level, rep);

  // ── R20 — the sea life ──────────────────────────────────────────────
  let animals = 0;
  for (const pod of level.fauna) {
    animals += pod.count;
    analyzePod(level, pod, offshoreAt, depthAt, rep);
  }

  // ── R21 — the coast's character, along the waterline ────────────────
  const sandShare = analyzeCharacter(level, rep);

  // ── R22 — the course winds ──────────────────────────────────────────
  const winding = analyzeWinding(level, circuit, rep);

  // ── R25, R26 / R29, R30, R31 — how far the level reaches ────────────
  // The two chapters' own rules, and a level answers to one set or the
  // other: a coast goes out to a mark and carries a river on inland, a
  // circuit is a lap out at sea with neither.
  let leastOffshore = 0;
  if (circuit) {
    leastOffshore = analyzeCircuit(level, rep);
  } else {
    analyzeOceanLeg(level, leg, rep);
    analyzeRiver(level, rep);
  }

  // ── R17 — the rocks themselves ──────────────────────────────────────
  for (const s of level.solids) analyzeSolid(level, s, offshoreAt, depthAt, rep);

  const findings = [...rep.findings].sort((a, b) =>
    a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1,
  );
  return {
    seed: level.seed,
    ok: !findings.some((f) => f.severity === "error"),
    findings,
    stats: {
      gates: gates.length,
      airGates: air.length,
      length: level.course.length,
      minDepth,
      minOffshore,
      maxOffshore,
      legOffshore: leg?.offshore ?? 0,
      leastOffshore,
      laps: level.course.laps,
      marks: level.solids.filter((s) => s.kind === "mark").length,
      markTop: level.solids.find((s) => s.kind === "mark")?.top ?? 0,
      riverInland:
        level.river.length > 1
          ? Math.hypot(
              level.river[level.river.length - 1].x - level.river[0].x,
              level.river[level.river.length - 1].z - level.river[0].z,
            )
          : 0,
      minClearance,
      maxLand,
      maxDepth,
      solids: level.solids.length,
      pods: level.fauna.length,
      animals,
      sandShare,
      wind: winding.wind,
      turn: winding.turn,
      radius: winding.radius,
      windSpeed: level.wind.speed,
      hour: level.hour,
      weather: level.weather,
    },
    ms: Date.now() - started,
  };
}

function analyzeGrid(level: Level, rep: Report): void {
  const { ground, offshore, bounds } = level;
  if (ground.cell !== R.grid.cell || offshore.cell !== R.grid.cell) {
    rep.fail("R14", "cell", `grid cell ${ground.cell}/${offshore.cell} m (rule ${R.grid.cell} m)`);
  }
  const edgeX = ground.originX + (ground.cols - 1) * ground.cell;
  const edgeZ = ground.originZ + (ground.rows - 1) * ground.cell;
  if (
    ground.originX !== bounds.minX ||
    ground.originZ !== bounds.minZ ||
    Math.abs(edgeX - bounds.maxX) > 1e-6 ||
    Math.abs(edgeZ - bounds.maxZ) > 1e-6
  ) {
    rep.fail("R14", "bounds", `the bounds are not the grid's edges`);
  }
  if (ground.cols !== offshore.cols || ground.rows !== offshore.rows) {
    rep.fail("R14", "shape", `the two grids differ in shape`);
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of level.course.path) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const cell = R.grid.cell;
  if (
    bounds.maxX < maxX + R.bounds.sea - cell ||
    bounds.minZ > minZ - R.bounds.sea + cell ||
    bounds.minX > minX - R.bounds.land + cell ||
    bounds.maxZ < maxZ + R.bounds.land - cell
  ) {
    rep.fail(
      "R14",
      "padding",
      `the bounds do not pad the course by ${R.bounds.sea} m seaward and ${R.bounds.land} m inland`,
    );
  }
  for (const s of level.solids) {
    if (s.x < bounds.minX || s.x > bounds.maxX || s.z < bounds.minZ || s.z > bounds.maxZ) {
      rep.fail("R14", "solid", `${s.id} stands outside the level`, { at: s });
    }
  }
}

/**
 * R22 — THE COURSE WINDS: how far the path is from the straight line
 * somebody could hold the throttle open down.
 *
 * Two numbers because either alone is cheatable by a course nobody would
 * call interesting. A path can be half as long again as its chord by
 * bowing gently out to sea and never asking for a single steering input;
 * it can swing its heading through ten radians in a series of wiggles that
 * add up to a straight line. A course that is both longer than its chord
 * AND turns is a course with corners in it.
 *
 * Read off the PATH the generator laid rather than off the shore, because
 * the path is what the rider follows — a coast full of inlets the line
 * runs straight past is exactly the fault this is here to catch.
 */
function circumradius(a: Vec2, b: Vec2, c: Vec2): number {
  const ab = Math.hypot(b.x - a.x, b.z - a.z);
  const bc = Math.hypot(c.x - b.x, c.z - b.z);
  const ca = Math.hypot(a.x - c.x, a.z - c.z);
  // Twice the triangle's area, by the cross product of two of its sides.
  const area2 = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
}

function analyzeWinding(
  level: Level,
  circuit: boolean,
  rep: Report,
): { wind: number; turn: number; radius: number } {
  const p = level.course.path;
  if (p.length < 3) return { wind: 1, turn: 0, radius: Infinity };
  let length = 0;
  for (let i = 0; i + 1 < p.length; i++) {
    length += Math.hypot(p[i + 1].x - p[i].x, p[i + 1].z - p[i].z);
  }
  let turn = 0;
  for (let i = 1; i + 1 < p.length; i++) {
    const h0 = Math.atan2(p[i].x - p[i - 1].x, p[i].z - p[i - 1].z);
    const h1 = Math.atan2(p[i + 1].x - p[i].x, p[i + 1].z - p[i].z);
    turn += Math.abs(angleDiff(h0, h1));
  }
  const chord = Math.hypot(p[p.length - 1].x - p[0].x, p[p.length - 1].z - p[0].z);
  const wind = chord > 0 ? length / chord : 1;
  // R22 says nothing about a CLOSED line: a lap's chord is the start's own
  // setback, so every circuit is forty times it and both halves of the rule
  // pass on a line that is a perfect circle. R29's own `turn` is what
  // replaces it — a lap has to turn further than a circle does, which only
  // a lap with counter bends in it can.
  if (circuit) {
    analyzeCircuitTurn(level, rep);
  } else {
    if (wind < R.course.wind) {
      rep.fail(
        "R22",
        "straight",
        `the path is ${fmt(wind)}× its own chord (rule ${R.course.wind}×)`,
        { value: wind },
      );
    }
    if (turn < R.course.sweep) {
      rep.fail("R22", "turn", `the path turns ${fmt(turn)} rad in all (rule ${R.course.sweep})`, {
        value: turn,
      });
    }
  }
  // R23 — and no one corner of it is tighter than a hull can hold. Read
  // over a stencil a few stations wide rather than vertex to vertex: the
  // line is a polyline of 10 m stations and the circle through three
  // neighbouring ones answers to their own rounding as much as to the
  // corner they are on.
  let tightest = Infinity;
  let at: { x: number; z: number } | undefined;
  const step = Math.max(1, Math.round(A.course.stencil / A.stride));
  for (let i = step; i + step < p.length; i += 1) {
    const r = circumradius(p[i - step], p[i], p[i + step]);
    if (r < tightest) {
      tightest = r;
      at = p[i];
    }
  }
  if (tightest < R.course.radius) {
    rep.fail(
      "R23",
      "radius",
      `the line turns at ${fmt(tightest)} m of radius (rule ${R.course.radius} m)`,
      { at, value: tightest },
    );
  }
  return { wind, turn, radius: tightest };
}

/** R20 — one pod, re-checked on the finished level: the animal is one the
 * coast offers and the water is warm enough for it, its centre is inside
 * its offshore band, and the whole loop it swims is inside the level, over
 * water deep enough for it, and clear of the rocks. The clearance is
 * `podClearance`'s, not a second opinion about it. */
function analyzePod(
  level: Level,
  pod: Pod,
  offshoreAt: (x: number, z: number) => number,
  depthAt: (x: number, z: number) => number,
  rep: Report,
): void {
  const biome = biomeOf(level.biome);
  const spec = faunaById(pod.species);
  const at = { x: pod.x, z: pod.z };
  if (!biome.fauna.includes(pod.species)) {
    rep.fail("R20", "species", `${pod.id} is a ${spec.name}, which ${biome.name} has no row for`, {
      at,
    });
    return;
  }
  if (!withinBand(level.water.temperature, spec.temperature)) {
    rep.fail(
      "R20",
      "temperature",
      `${pod.id} (${spec.name}) is in ${fmt(level.water.temperature)} °C water (band ${bandText(spec.temperature)} °C)`,
      { at, value: level.water.temperature },
    );
  }
  if (!withinBand(pod.count, spec.school)) {
    rep.fail(
      "R20",
      "school",
      `${pod.id} holds ${pod.count} ${spec.name} (band ${bandText(spec.school)})`,
      { at, value: pod.count },
    );
  }
  if (!withinBand(pod.depth, spec.depth)) {
    rep.fail(
      "R20",
      "depth",
      `${pod.id} holds at ${fmt(pod.depth)} m (band ${bandText(spec.depth)} m)`,
      { at, value: pod.depth },
    );
  }
  const off = offshoreAt(pod.x, pod.z);
  if (!withinBand(off, spec.offshore, R.grid.cell)) {
    rep.fail(
      "R20",
      "offshore",
      `${pod.id} (${spec.name}) swims ${fmt(off)} m from the shore (band ${bandText(spec.offshore)} m)`,
      { at, value: off },
    );
  }
  const need = podClearance(spec, pod.depth);
  walkPod(pod, (x, z) => {
    if (!insideBounds(level.bounds, x, z)) {
      rep.fail("R20", "bounds", `${pod.id}'s loop leaves the level`, { at: { x, z } });
      return;
    }
    const water = depthAt(x, z);
    if (water < need - A.sea.tolerance) {
      rep.fail(
        "R20",
        "water",
        `${pod.id} (${spec.name}) swims over ${fmt(water)} m of water and needs ${fmt(need)} m`,
        { at: { x, z }, value: water },
      );
    }
    for (const s of level.solids) {
      const gap = Math.hypot(s.x - x, s.z - z) - s.r;
      if (gap < R.fauna.clear - A.distance) {
        rep.fail(
          "R20",
          "clear",
          `${pod.id}'s loop passes ${fmt(gap)} m from ${s.id} (rule ${R.fauna.clear} m)`,
          { at: { x, z }, value: gap },
        );
      }
    }
  });
}
