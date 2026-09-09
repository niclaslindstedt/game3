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
import { CRAFT } from "../game/defs/craft.ts";
import { topSpeedOf } from "../game/limits.ts";
import { biomeOf } from "../mapgen/biomes.ts";
import {
  airCorridor,
  cumulative,
  gateBuoys,
  polylineDistance,
  ringPlacement,
  segmentDistance,
  walkPolyline,
} from "../mapgen/course.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { launchSpeedFor } from "../sim/bot.ts";
import { LEVEL_RULES as R, withinBand, type Band } from "../mapgen/rules.ts";
import type { Gate, Level, Solid } from "../mapgen/types.ts";
import { ANALYSIS as A } from "./budgets.ts";

export { ANALYSIS } from "./budgets.ts";

/** `error` is a defect — a rule broken, a level the generator must not
 * ship. `warn` is a smell worth reading. */
export type Severity = "error" | "warn";

export type Finding = {
  /** The rule it is about, `R1`…`R17`. */
  rule: string;
  /** `<rule>.<check>` — stable, so a fix can be pointed at one string. */
  code: string;
  severity: Severity;
  message: string;
  /** Where on the map it is, when it has a place. */
  at?: { x: number; z: number };
  /** How bad, in the check's own units. */
  value?: number;
};

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
    minClearance: number;
    maxLand: number;
    maxDepth: number;
    solids: number;
    windSpeed: number;
    hour: number;
  };
  /** Wall time, ms. */
  ms: number;
};

type Report = {
  findings: Finding[];
  fail(
    rule: string,
    check: string,
    message: string,
    extra?: { at?: { x: number; z: number }; value?: number },
  ): void;
  smell(
    rule: string,
    check: string,
    message: string,
    extra?: { at?: { x: number; z: number }; value?: number },
  ): void;
};

function createReport(): Report {
  const findings: Finding[] = [];
  const push =
    (severity: Severity) =>
    (rule: string, check: string, message: string, extra = {}) => {
      findings.push({ rule, code: `${rule}.${check}`, severity, message, ...extra });
    };
  return { findings, fail: push("error"), smell: push("warn") };
}

const fmt = (v: number): string => (Math.round(v * 100) / 100).toString();

function bandText(band: Band): string {
  return `${fmt(band.min)}–${fmt(band.max)}`;
}

/** Re-check a finished level against every rule in the rule book. */
export function analyzeLevel(level: Level): LevelAnalysis {
  const started = Date.now();
  const rep = createReport();
  const path = level.course.path;
  const gates = level.course.gates;
  const depthAt = (x: number, z: number): number => -sampleField(level.ground, x, z);
  const offshoreAt = (x: number, z: number): number => sampleField(level.offshore, x, z);

  // ── R1, R5 — the path's water ───────────────────────────────────────
  let minDepth = Infinity;
  let minOffshore = Infinity;
  let maxOffshore = -Infinity;
  let worstDepth: { x: number; z: number } | undefined;
  let worstOff: { x: number; z: number; off: number } | undefined;
  const bandMid = (R.course.offshore.min + R.course.offshore.max) / 2;
  walkPolyline(path, A.stride, (x, z) => {
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
      !withinBand(off, R.course.offshore) &&
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
  for (const g of gates) {
    const off = offshoreAt(g.x, g.z);
    if (!withinBand(off, R.course.offshore)) {
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
  let plateauRef: number | undefined;
  let plateauSpread = 0;
  let shallowFar = 0;
  let dryAtSea = 0;
  const g = level.ground;
  const o = level.offshore;
  for (let i = 0; i < g.data.length; i++) {
    const h = g.data[i];
    const off = o.data[i];
    if (h > maxLand) maxLand = h;
    if (-h > maxDepth) maxDepth = -h;
    if (off <= -(R.land.reach + A.land.margin)) {
      if (plateauRef === undefined) plateauRef = h;
      else plateauSpread = Math.max(plateauSpread, Math.abs(h - plateauRef));
    }
    if (off >= R.sea.reach + A.sea.margin && -h < R.sea.depth - A.sea.tolerance) shallowFar++;
    if (off >= A.sea.waterline && h >= 0) dryAtSea++;
  }
  if (maxLand > R.land.maxHeight + A.land.tolerance) {
    rep.fail("R2", "height", `land stands ${fmt(maxLand)} m high (rule ${R.land.maxHeight} m)`, {
      value: maxLand,
    });
  }
  if (plateauSpread > A.land.flatness) {
    rep.fail("R2", "plateau", `the plateau varies by ${fmt(plateauSpread)} m past the reach`, {
      value: plateauSpread,
    });
  }
  if (plateauRef !== undefined && !withinBand(plateauRef, R.land.plateau, A.land.tolerance)) {
    rep.smell(
      "R2",
      "plateau-height",
      `the plateau stands at ${fmt(plateauRef)} m (band ${bandText(R.land.plateau)} m)`,
      {
        value: plateauRef,
      },
    );
  }
  if (maxDepth > R.sea.depth + A.sea.tolerance) {
    rep.fail("R3", "depth", `the bed reaches ${fmt(maxDepth)} m (rule ${R.sea.depth} m)`, {
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
  const cum = cumulative(path);
  const total = cum[cum.length - 1];
  const gateD = gates.map((gate) => distanceAlong(path, cum, gate.x, gate.z));
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
  if (!withinBand(level.course.length, R.course.length)) {
    rep.fail(
      "R10",
      "length",
      `the course is ${fmt(level.course.length)} m long (band ${bandText(R.course.length)} m)`,
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
    if (clear < R.course.solidMargin) {
      rep.fail(
        "R6",
        "clear",
        `${s.id} (${s.kind}) is ${fmt(clear)} m from the line (rule ${R.course.solidMargin} m)`,
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
  for (const gate of air) analyzeAirGate(level, gate, path, cum, depthAt, rep);
  analyzeRunUp(rep);
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
  }
  if (!withinBand(level.hour, R.day.hour)) {
    rep.fail("R13", "hour", `hour ${fmt(level.hour)} (band ${bandText(R.day.hour)})`, {
      value: level.hour,
    });
  }
  const biome = biomeOf(level.biome);
  if (level.water.density !== biome.water.density) {
    rep.fail(
      "R13",
      "density",
      `water density ${level.water.density} (biome ${biome.water.density})`,
    );
  }
  if (!withinBand(level.water.temperature, biome.water.temperature)) {
    rep.fail(
      "R13",
      "temperature",
      `water ${fmt(level.water.temperature)} °C (band ${bandText(biome.water.temperature)})`,
    );
  }

  // ── R14 — the grid ──────────────────────────────────────────────────
  analyzeGrid(level, rep);

  // ── R15 — the shore ─────────────────────────────────────────────────
  analyzeShore(level, rep, offshoreAt);

  // ── R16 — the surface ───────────────────────────────────────────────
  analyzeSurface(level, rep);

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
      minClearance,
      maxLand,
      maxDepth,
      solids: level.solids.length,
      windSpeed: level.wind.speed,
      hour: level.hour,
    },
    ms: Date.now() - started,
  };
}

/** Distance along a polyline of the point nearest to (x, z), m. */
function distanceAlong(
  path: readonly { x: number; z: number }[],
  cum: Float64Array,
  x: number,
  z: number,
): number {
  let best = Infinity;
  let at = 0;
  for (let i = 0; i + 1 < path.length; i++) {
    const a = path[i];
    const b = path[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz;
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / len2)) : 0;
    const d = Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
    if (d < best) {
      best = d;
      at = cum[i] + Math.sqrt(len2) * t;
    }
  }
  return at;
}

function analyzeAirGate(
  level: Level,
  gate: Gate,
  path: readonly { x: number; z: number }[],
  cum: Float64Array,
  depthAt: (x: number, z: number) => number,
  rep: Report,
): void {
  if (!withinBand(gate.y, R.air.height)) {
    rep.fail(
      "R7",
      "height",
      `${gate.id}'s ring floats at ${fmt(gate.y)} m (band ${bandText(R.air.height)} m)`,
      { at: gate, value: gate.y },
    );
  }
  if (Math.abs(gate.width - R.air.width) > A.distance) {
    rep.fail(
      "R7",
      "width",
      `${gate.id}'s ring is ${fmt(gate.width)} m across (rule ${R.air.width} m)`,
      { at: gate },
    );
  }
  const ramp = gate.ramp;
  if (!ramp) {
    rep.fail("R8", "missing", `${gate.id} is in the air with no ramp before it`, { at: gate });
    return;
  }
  const fx = Math.sin(ramp.heading);
  const fz = Math.cos(ramp.heading);
  const px = gate.x - ramp.x;
  const pz = gate.z - ramp.z;
  const lead = px * fx + pz * fz;
  const across = px * fz - pz * fx;
  if (!withinBand(lead, R.ramp.lead, A.distance)) {
    rep.fail(
      "R8",
      "lead",
      `${ramp.id} is ${fmt(lead)} m before ${gate.id} (band ${bandText(R.ramp.lead)} m)`,
      { at: ramp, value: lead },
    );
  }
  if (Math.abs(across) > A.distance) {
    rep.fail("R8", "axis", `${gate.id}'s ring sits ${fmt(across)} m off ${ramp.id}'s axis`, {
      at: gate,
      value: across,
    });
  }
  if (Math.abs(angleDiff(ramp.heading, gate.heading)) > A.heading) {
    rep.fail("R8", "aligned", `${ramp.id} is not aligned with ${gate.id}`, { at: ramp });
  }
  if (!withinBand(ramp.length, R.ramp.length)) {
    rep.fail(
      "R8",
      "length",
      `${ramp.id} is ${fmt(ramp.length)} m long (band ${bandText(R.ramp.length)} m)`,
      { at: ramp },
    );
  }
  if (Math.abs(ramp.width - R.ramp.width) > A.distance) {
    rep.fail("R8", "width", `${ramp.id} is ${fmt(ramp.width)} m wide (rule ${R.ramp.width} m)`, {
      at: ramp,
    });
  }
  if (!withinBand(ramp.angle, R.ramp.angle)) {
    rep.fail(
      "R8",
      "angle",
      `${ramp.id} rises at ${fmt((ramp.angle * 180) / Math.PI)}° (band ${fmt((R.ramp.angle.min * 180) / Math.PI)}–${fmt((R.ramp.angle.max * 180) / Math.PI)}°)`,
      {
        at: ramp,
      },
    );
  }
  // R18 — the ring's place is the arc's, and every craft can bring the
  // speed it asks for.
  const ring = ringPlacement(ramp.length, ramp.angle);
  if (Math.abs(lead - ring.lead) > A.ring.place || Math.abs(gate.y - ring.y) > A.ring.place) {
    rep.fail(
      "R18",
      "arc",
      `${gate.id}'s ring is ${fmt(lead)} m out and ${fmt(gate.y)} m up; the design arc puts it ${fmt(ring.lead)} m out and ${fmt(ring.y)} m up`,
      { at: gate, value: Math.max(Math.abs(lead - ring.lead), Math.abs(gate.y - ring.y)) },
    );
  }
  let slowest = Infinity;
  for (const spec of CRAFT) slowest = Math.min(slowest, topSpeedOf(spec));
  const lip = ramp.length * Math.tan(ramp.angle);
  // The hinge speed the design band's ends imply, by the bot's own
  // account of the climb up the deck.
  const hingeOf = (v: number): number => Math.sqrt(v * v + 2 * TUNING.g * lip);
  const floor = hingeOf(R.air.lipSpeed.min) * (1 - A.ring.speed);
  const ceiling = hingeOf(R.air.lipSpeed.max) * (1 + A.ring.speed);
  for (const spec of CRAFT) {
    const need = launchSpeedFor(gate, spec.cog.y, topSpeedOf(spec));
    if (need > slowest * R.air.reach) {
      rep.fail(
        "R18",
        "reach",
        `${gate.id} asks the ${spec.id} for ${fmt(need * 3.6)} km/h at the hinge; the slowest craft tops out at ${fmt(slowest * 3.6)} km/h`,
        { at: gate, value: need },
      );
    } else if (need < floor || need > ceiling) {
      rep.fail(
        "R18",
        "design",
        `${gate.id} asks the ${spec.id} for ${fmt(need * 3.6)} km/h at the hinge (design ${fmt(floor * 3.6)}–${fmt(ceiling * 3.6)} km/h)`,
        { at: gate, value: need },
      );
    }
  }
  // R9 — the straight: every path vertex inside the corridor's window lies
  // on its chord, and the water under the run-up and the deck is deep.
  const c = airCorridor(gate);
  const from = distanceAlong(path, cum, c.x0, c.z0);
  const to = distanceAlong(path, cum, c.x1, c.z1);
  let bent = 0;
  for (let i = 0; i < path.length; i++) {
    if (cum[i] <= from + A.distance || cum[i] >= to - A.distance) continue;
    bent = Math.max(bent, segmentDistance(path[i].x, path[i].z, c.x0, c.z0, c.x1, c.z1));
  }
  if (bent > A.straight) {
    rep.fail("R9", "straight", `the path bends ${fmt(bent)} m inside ${gate.id}'s run-up`, {
      at: ramp,
      value: bent,
    });
  }
  const runUp = Math.hypot(ramp.x - c.x0, ramp.z - c.z0);
  const n = Math.ceil(runUp / A.stride);
  let shallow = Infinity;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    shallow = Math.min(shallow, depthAt(c.x0 + (ramp.x - c.x0) * t, c.z0 + (ramp.z - c.z0) * t));
  }
  if (shallow < R.ramp.runUpDepth) {
    rep.fail(
      "R9",
      "depth",
      `only ${fmt(shallow)} m of water on ${gate.id}'s run-up (rule ${R.ramp.runUpDepth} m)`,
      { at: ramp, value: shallow },
    );
  }
  for (const s of level.solids) {
    const clear = segmentDistance(s.x, s.z, c.x0, c.z0, c.x1, c.z1) - s.r - c.halfWidth;
    if (clear < 0) {
      rep.fail("R9", "clear", `${s.id} stands in ${gate.id}'s corridor by ${fmt(-clear)} m`, {
        at: s,
        value: clear,
      });
    }
  }
}

/** R9 — the run-up is long enough for the slowest craft to reach R18's
 * design speed from a standing start: the catalog's own 0–50 km/h
 * expectation, scaled to the band's ceiling, integrated as a straight
 * ramp of speed. Nothing about a level is in this; it holds the rule
 * book to the catalog, and it is here so that a catalog change that
 * makes a ring unreachable fails the generator rather than the player. */
function analyzeRunUp(rep: Report): void {
  const v = R.air.lipSpeed.max;
  for (const spec of CRAFT) {
    const t = spec.accel0to50 * (v / (50 / 3.6));
    const dist = 0.5 * v * t;
    if (dist > R.ramp.runUp) {
      rep.fail(
        "R9",
        "reach",
        `the ${spec.id} needs ${fmt(dist)} m to reach ${fmt(v * 3.6)} km/h; the run-up is ${R.ramp.runUp} m`,
        { value: dist },
      );
    }
  }
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

/** The compass heading the open sea lies in, from the published shore:
 * right of the line's overall direction. Undefined for a degenerate line. */
function shoreSeaward(level: Level): number | undefined {
  const pts = level.shore;
  if (pts.length < 2) return undefined;
  const a = pts[0];
  const b = pts[pts.length - 1];
  return Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2;
}

function analyzeShore(
  level: Level,
  rep: Report,
  offshoreAt: (x: number, z: number) => number,
): void {
  const pts = level.shore;
  if (pts.length < 3) {
    rep.fail("R15", "line", `the shore has ${pts.length} vertices`);
    return;
  }
  const base = Math.atan2(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].z - pts[0].z);
  if (!withinBand(base, R.shore.heading, A.shore.turn)) {
    rep.fail(
      "R15",
      "heading",
      `the shore runs at ${fmt((base * 180) / Math.PI)}° (band ${fmt((R.shore.heading.min * 180) / Math.PI)}–${fmt((R.shore.heading.max * 180) / Math.PI)}°)`,
      {
        value: base,
      },
    );
  }
  let worst = 0;
  for (let i = 1; i + 1 < pts.length; i++) {
    const h0 = Math.atan2(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    const h1 = Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    worst = Math.max(worst, Math.abs(angleDiff(h0, h1)));
  }
  if (worst > A.shore.turn) {
    rep.fail("R15", "smooth", `the shore turns ${fmt((worst * 180) / Math.PI)}° at a vertex`, {
      value: worst,
    });
  }
  // The sea is on the RIGHT: a point a little right of the line's middle
  // reads as offshore, a point left of it as land.
  const mid = pts[Math.floor(pts.length / 2)];
  const rx = Math.cos(base);
  const rz = -Math.sin(base);
  const probe = 3 * R.grid.cell;
  if (
    offshoreAt(mid.x + rx * probe, mid.z + rz * probe) <= 0 ||
    offshoreAt(mid.x - rx * probe, mid.z - rz * probe) >= 0
  ) {
    rep.fail("R15", "side", `the sea is not on the right of the shore`, { at: mid });
  }
}

function analyzeSurface(level: Level, rep: Report): void {
  const { bounds } = level;
  const n = A.surfaceSamples;
  let wrong = 0;
  let at: { x: number; z: number } | undefined;
  for (let i = 0; i <= n; i++) {
    for (let j = 0; j <= n; j++) {
      const x = bounds.minX + ((bounds.maxX - bounds.minX) * i) / n;
      const z = bounds.minZ + ((bounds.maxZ - bounds.minZ) * j) / n;
      const h = sampleField(level.ground, x, z);
      const kind = level.materialAt(x, z);
      if ((kind === "water") !== h < 0) {
        wrong++;
        at ??= { x, z };
      }
    }
  }
  if (wrong > 0)
    rep.fail("R16", "water", `${wrong} samples call the wrong side of the waterline water`, {
      at,
      value: wrong,
    });
}

function analyzeSolid(
  level: Level,
  s: Solid,
  offshoreAt: (x: number, z: number) => number,
  depthAt: (x: number, z: number) => number,
  rep: Report,
): void {
  const rule = R.solids[s.kind];
  const off = offshoreAt(s.x, s.z);
  if (!withinBand(off, rule.offshore, R.grid.cell)) {
    rep.fail(
      "R17",
      "offshore",
      `${s.id} (${s.kind}) stands ${fmt(off)} m from the shore (band ${bandText(rule.offshore)} m)`,
      { at: s, value: off },
    );
  }
  if (!withinBand(s.r, rule.r))
    rep.fail("R17", "radius", `${s.id} has radius ${fmt(s.r)} m (band ${bandText(rule.r)} m)`, {
      at: s,
    });
  if (!withinBand(s.top, rule.top))
    rep.fail("R17", "top", `${s.id}'s top is at ${fmt(s.top)} m (band ${bandText(rule.top)} m)`, {
      at: s,
    });
  const bed = -depthAt(s.x, s.z);
  if (s.top < bed + R.solids.proud - A.sea.tolerance) {
    rep.fail("R17", "proud", `${s.id}'s top is under the bed`, { at: s, value: s.top - bed });
  }
  for (const other of level.solids) {
    if (other.id <= s.id) continue;
    const gap = Math.hypot(other.x - s.x, other.z - s.z) - other.r - s.r;
    if (gap < R.solids.spacing - A.distance) {
      rep.fail(
        "R17",
        "spacing",
        `${s.id} and ${other.id} are ${fmt(gap)} m apart (rule ${R.solids.spacing} m)`,
        { at: s, value: gap },
      );
    }
  }
}
