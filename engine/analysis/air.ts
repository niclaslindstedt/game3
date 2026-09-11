// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R7, R8, R9, R18 — THE AIR, re-checked. The third of `analyzeLevel`'s
// halves: everything the analysis asks about a ring, the ramp that throws a
// hull through it and the straight water in front of that ramp.
//
// Split from `index.ts` by subject, the way `coast.ts` is: these two read a
// gate, its ramp and the water under the corridor, and neither knows the
// shore exists. They take the same `Report` and are called in rule order
// from `analyzeLevel`, so the split is invisible in the findings.
//
// R18's arithmetic is not repeated here. `ringPlacement` is where a ring's
// place comes from and `launchSpeedFor` is the bot's own account of what it
// costs to get there; the checks ASK those two rather than keeping a second
// opinion, which is what makes a catalog change that puts a ring out of
// reach fail the generator instead of the player.

import { angleDiff } from "../lib/math.ts";
import { CRAFT } from "../game/defs/craft.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { topSpeedOf } from "../game/limits.ts";
import { launchSpeedFor } from "../sim/bot.ts";
import { airCorridor, distanceAlong, ringPlacement, segmentDistance } from "../mapgen/course.ts";
import { withinBand } from "../mapgen/rules.ts";
import { rulesAtPace } from "../mapgen/pace.ts";
import type { Gate, Level, Vec2 } from "../mapgen/types.ts";
import { ANALYSIS as A } from "./budgets.ts";
import { bandText, fmt, type Report } from "./report.ts";

export function analyzeAirGate(
  level: Level,
  gate: Gate,
  at: number,
  path: readonly Vec2[],
  cum: Float64Array,
  depthAt: (x: number, z: number) => number,
  rep: Report,
): void {
  // R32 — the rule book at the pace this level was drawn to, shadowing the
  // module's own: its ramp lead and run-up were stretched by the class.
  const R = rulesAtPace(level.pace);
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
  // R30 — the corridor's ends are searched for FORWARD of where the run-up
  // can possibly have begun. On a lapped course the same run-up is ridden
  // once a lap, and a search of the whole path finds the first lap's copy
  // of it for every one of them, which reads as a window that bends.
  const c = airCorridor(gate, level.pace);
  const earliest = Math.max(0, at - R.ramp.lead.max - R.ramp.runUp - A.distance);
  const from = distanceAlong(path, cum, c.x0, c.z0, earliest);
  const to = distanceAlong(path, cum, c.x1, c.z1, from);
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
  // R9 — and it crosses the sea rather than running along it: the waves
  // travel the way the wind blows to, and a ramp pointed within `ramp.beam`
  // of a right angle to that is one a hull can arrive at on the plane.
  const off = Math.abs(angleDiff(level.wind.from + Math.PI, ramp.heading));
  const fromBeam = Math.abs(off - Math.PI / 2);
  if (fromBeam > R.ramp.beam + A.heading) {
    rep.fail(
      "R9",
      "beam",
      `${gate.id}'s run-up lies ${fmt((fromBeam * 180) / Math.PI)}° off the beam (rule ${fmt((R.ramp.beam * 180) / Math.PI)}°)`,
      { at: ramp, value: fromBeam },
    );
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
export function analyzeRunUp(rep: Report, pace = 1): void {
  const R = rulesAtPace(pace);
  const v = R.air.lipSpeed.max;
  for (const spec of CRAFT) {
    // The catalog is quoted at class 1 and a class scales the thrust, not
    // the mass, so the time to a fixed speed falls as the square of it
    // (`craftAtClass`) — while the run-up above grew by the class itself.
    const t = (spec.accel0to50 / (pace * pace)) * (v / (50 / 3.6));
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
