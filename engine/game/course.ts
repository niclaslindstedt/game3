// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE — the gates in order, and what crossing one means. A WATER
// gate is a line between two buoys, crossed by a move through it in the
// facing direction; an AIR gate is a ring whose centre stands `y` metres
// up, passed by a move through its disc.
//
// A GATE IS REACHED BY GOING THROUGH IT AND BY NOTHING ELSE. Between the
// buoys, or inside the ring: a rider who goes by a gate on the wrong side
// of a buoy has not taken it, and the run does not move on for them. What
// keeps that from being a dead end is the LOOK-AHEAD — taking any of the
// next `course.lookAhead` gates counts, and charges every gate skipped on
// the way (`missedGate`, which then treats the skipped gate as reached, so
// nobody is sent back down the coast for it). So a rider who overshoots
// one buoy carries on and pays for it at the next, and a rider who
// overshoots the lot has to come back and thread one. The last gate is the
// finish, and it is crossed like any other: there is no wide crossing of a
// finish line.
//
// `reset` stands the craft a few metres behind the last gate it took (or
// the start), facing the next one, at rest — the way home from a rock.

import { angleDiff } from "../lib/math.ts";
import { fromEuler } from "../lib/quat.ts";
import type { Gate, Level } from "../mapgen/types.ts";
import { TRICK_RESET_BACK } from "./defs/modes.ts";
import { TUNING } from "./defs/tuning.ts";
import { restY } from "./hull.ts";
import type { GameEvent, GameState, Progress } from "./state.ts";
import { heightAt } from "./water.ts";

const K = TUNING.course;

export function freshProgress(level: Level): Progress {
  return {
    nextGate: 0,
    passed: [],
    missed: [],
    splits: level.course.gates.map(() => NaN),
    time: 0,
    penalty: 0,
    finished: false,
    lastGatePassedAt: 0,
    lastResetAt: 0,
    bestAir: 0,
    bestAirAt: 0,
    peakAltitude: 0,
  };
}

/** Whether a move from p0 to p1 crossed the gate's LINE at all, and how
 * far off centre it did — laterally for a water gate, and in the ring's
 * own plane for an air gate. `crossedGate` is this with the gate's width
 * applied; the raw answer is what says a rider went PAST a gate rather
 * than through it. */
export function crossedLine(
  gate: Gate,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): { lateral: number; vertical: number } | null {
  const fx = Math.sin(gate.heading);
  const fz = Math.cos(gate.heading);
  const rx = Math.cos(gate.heading);
  const rz = -Math.sin(gate.heading);
  const s0 = (x0 - gate.x) * fx + (z0 - gate.z) * fz;
  const s1 = (x1 - gate.x) * fx + (z1 - gate.z) * fz;
  if (!(s0 < 0 && s1 >= 0)) return null;
  const f = s0 / (s0 - s1);
  const cx = x0 + (x1 - x0) * f;
  const cy = y0 + (y1 - y0) * f;
  const cz = z0 + (z1 - z0) * f;
  const lateral = (cx - gate.x) * rx + (cz - gate.z) * rz;
  return gate.kind === "water" ? { lateral, vertical: cy } : { lateral, vertical: cy - gate.y };
}

/** How far off the gate's centre a crossing was, in the terms the gate is
 * judged by: across the line for a water gate, and out from the ring's own
 * centre for an air gate. */
function offCentre(gate: Gate, at: { lateral: number; vertical: number }): number {
  return gate.kind === "water" ? Math.abs(at.lateral) : Math.hypot(at.lateral, at.vertical);
}

/** Whether a move from p0 to p1 went THROUGH the gate. Returns the offset
 * from the gate's centre at the crossing, or null. */
export function crossedGate(
  gate: Gate,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): { lateral: number; vertical: number } | null {
  const at = crossedLine(gate, x0, y0, z0, x1, y1, z1);
  return at && offCentre(gate, at) <= gate.width / 2 ? at : null;
}

/** Charge a gate the rider went past. */
function miss(state: GameState, index: number, events: GameEvent[]): void {
  const p = state.progress;
  p.missed.push(index);
  p.penalty += K.missedPenalty;
  p.time += K.missedPenalty;
  events.push({ kind: "missedGate", t: state.t, gate: index, penalty: K.missedPenalty });
}

function take(state: GameState, index: number, height: number, events: GameEvent[]): void {
  const p = state.progress;
  const gate = state.level.course.gates[index];
  p.passed.push(index);
  p.splits[index] = p.time;
  p.lastGatePassedAt = p.time;
  if (gate.kind === "air") {
    events.push({ kind: "airGate", t: state.t, gate: index, split: p.time, height });
  } else {
    events.push({ kind: "gate", t: state.t, gate: index, split: p.time });
  }
}

/** Check the move the craft just made against the next gate (and the one
 * after it), and finish the run at the last gate. The clock is not advanced
 * here — `step.ts` runs it, because a run with no course to count
 * (`rules.course` off) still has a clock to run down. */
export function stepCourse(
  state: GameState,
  x0: number,
  y0: number,
  z0: number,
  events: GameEvent[],
): void {
  const p = state.progress;
  if (p.finished) return;
  const gates = state.level.course.gates;
  const c = state.craft;
  const n = p.nextGate;
  if (n >= gates.length) return;
  // The gate the run owes, and the few after it: the FIRST of them the move
  // actually went through is the one taken, and everything before it is
  // charged as skipped. Nothing about crossing a gate's LINE outside its
  // buoys counts — that is a rider who went past, and the gate stays theirs
  // until they thread it or thread a later one.
  const last = Math.min(gates.length - 1, n + K.lookAhead);
  for (let g = n; g <= last; g++) {
    if (!crossedGate(gates[g], x0, y0, z0, c.x, c.y, c.z)) continue;
    for (let skipped = n; skipped < g; skipped++) miss(state, skipped, events);
    take(state, g, c.y, events);
    p.nextGate = g + 1;
    break;
  }
  if (p.nextGate >= gates.length) {
    p.finished = true;
    state.phase = "finished";
    events.push({ kind: "finish", t: state.t, time: p.time, place: placeOf(state) });
  }
}

/** WHERE A RUN THAT HAS JUST FINISHED STANDS AGAINST THE FIELD: one more
 * than the rivals already home. 1 with nobody else on the water. A rival's
 * own run has no field of its own (`rivals.ts` gives it none), so a rival
 * finishing reads 1 here and the standings are the player's to work out
 * (`racePlace`). */
function placeOf(state: GameState): number {
  let ahead = 0;
  for (const r of state.rivals) if (r.run.progress.finished) ahead += 1;
  return ahead + 1;
}

/** Where a reset stands the craft: behind the last gate it is DONE with —
 * passed or paid for — or at the start, facing the next gate.
 *
 * "Done with" is `nextGate - 1` rather than the last gate in `passed`,
 * because a missed gate is charged and counted as reached without being
 * passed. Reading `passed` sends a rider who went by three gates in a row
 * back to the last one they actually threaded, which on a course with
 * corners can be half a kilometre astern — and then the idle timer resets
 * them there again before they can ride back, for ever. */
export function resetPose(state: GameState): {
  x: number;
  z: number;
  heading: number;
  gate: number;
} {
  const gates = state.level.course.gates;
  const p = state.progress;
  // A RUN WITH NO COURSE TO SEND HIM BACK ALONG (`rules.course` off): the
  // ramps are what he is out here for, so he is stood at the foot of the
  // nearest one's run-up, facing up it — the way home from a rock is the
  // way to the next jump. A shore with no ramp on it sends him to the
  // start.
  if (!state.rules.course) {
    const c = state.craft;
    let best: Gate | null = null;
    let bestD = Infinity;
    for (const g of gates) {
      if (!g.ramp) continue;
      const d = Math.hypot(g.ramp.x - c.x, g.ramp.z - c.z);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    if (best?.ramp) {
      const r = best.ramp;
      return {
        x: r.x - Math.sin(r.heading) * TRICK_RESET_BACK,
        z: r.z - Math.cos(r.heading) * TRICK_RESET_BACK,
        heading: r.heading,
        gate: -1,
      };
    }
    const s = state.level.start;
    return { x: s.x, z: s.z, heading: s.heading, gate: -1 };
  }
  const last = p.nextGate - 1;
  const next = gates[Math.min(p.nextGate, gates.length - 1)];
  if (last < 0) {
    const s = state.level.start;
    return { x: s.x, z: s.z, heading: s.heading, gate: -1 };
  }
  const gate = gates[last];
  const heading =
    p.nextGate < gates.length ? Math.atan2(next.x - gate.x, next.z - gate.z) : gate.heading;
  // Stand a little behind the line, along the gate's own facing, so the
  // line is crossed by a MOVE the next time and not by the reset itself.
  const x = gate.x - Math.sin(gate.heading) * K.resetBack;
  const z = gate.z - Math.cos(gate.heading) * K.resetBack;
  return { x, z, heading, gate: last };
}

/** Put the craft down at rest at a plan point and heading, afloat at its
 * rest draft on the surface there. */
export function standCraft(state: GameState, x: number, z: number, heading: number): void {
  const c = state.craft;
  const surface = heightAt(state.sea, state.level, x, z, state.t);
  c.x = x;
  c.z = z;
  c.y = surface + restY(c.spec, state.level.water.density);
  // Afloat at its rest draft, so the altimeter reads the WAVE it is sitting
  // on and nothing else. Written here for the same reason `speed` is: a
  // readout a placement leaves stale is one the first frame has to catch up.
  c.altitude = surface;
  c.vx = c.vy = c.vz = 0;
  c.q = fromEuler(heading, 0, 0);
  c.wx = c.wy = c.wz = 0;
  c.heading = heading;
  c.pitch = 0;
  c.roll = 0;
  c.rpm = c.spec.idleRpm;
  c.throttleEff = 0;
  c.nozzle = 0;
  c.riderAft = 0;
  c.riderRight = 0;
  c.crouch = 0;
  c.stand = 0;
  c.standHold = 0;
  c.airborne = false;
  c.airTime = 0;
  c.planing = 0;
  c.speed = 0;
  c.onRamp = false;
  c.onGround = false;
  c.launchVy = 0;
  // A craft stood here has hit nothing and landed nowhere: a contact's
  // cooldown carried over from where it was lifted from would read as a
  // hull still wedged, on a step that never runs the contact model.
  c.hitCooldown = 0;
  c.groundCooldown = 0;
  c.bumpCooldown = 0;
  c.dived = false;
  c.launchPending = false;
  c.landing = 1e6;
  c.capsizedFor = 0;
  c.righting = 0;
  // ...and nothing of either STROKE: a craft stood here has none half
  // earned on the bars, and neither a yank nor a throw still fading out
  // from under the rider (`strokes.ts`).
  c.pumpCrossed = false;
  c.yank = 0;
  c.pumped = 0;
  c.whipCrossed = false;
  c.whipSide = 0;
  c.whip = 0;
  c.whipped = 0;
  c.tricking = false;
}

/** `reset`: back to the last gate. Emits the event. */
export function resetCraft(state: GameState, events: GameEvent[]): void {
  const pose = resetPose(state);
  standCraft(state, pose.x, pose.z, pose.heading);
  state.progress.lastResetAt = state.progress.time;
  events.push({ kind: "reset", t: state.t, gate: pose.gate });
}

/** HOW FAR DOWN THE COURSE a run has got: the gates it has taken plus the
 * ones it was charged for skipping past, which are reached all the same. The
 * HUD's `n / N` counter and the minimap's gauge are the same reading in two
 * forms, and this is the one place the sum is written. */
export function gatesReached(progress: Progress): number {
  return progress.passed.length + progress.missed.length;
}

/** The heading from the craft to the next gate's centre, and how far off
 * the craft's own heading that is, for the HUD's arrow and the bot. */
export function bearingToNext(
  state: GameState,
): { bearing: number; error: number; distance: number } | null {
  const gates = state.level.course.gates;
  const n = state.progress.nextGate;
  if (n >= gates.length) return null;
  const g = gates[n];
  const c = state.craft;
  const bearing = Math.atan2(g.x - c.x, g.z - c.z);
  return {
    bearing,
    error: angleDiff(c.heading, bearing),
    distance: Math.hypot(g.x - c.x, g.z - c.z),
  };
}
