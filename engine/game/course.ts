// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE — the gates in order, and what crossing one means. A WATER
// gate is a line between two buoys, crossed by a move through it in the
// facing direction; a SLALOM gate is one coloured buoy crossed abeam on
// its prescribed side; an AIR gate is a ring whose centre stands `y`
// metres up, passed by a move through its disc.
//
// A GATE IS REACHED BY GOING THROUGH IT AND BY NOTHING ELSE, AND ONLY IN
// ITS TURN. Between the buoys, or inside the ring, and only while it is the
// gate the run OWES: a checkpoint threaded out of order counts for nothing,
// so a rider who has left one behind cannot pick the course back up at the
// next one. Crossing the owed gate's plane outside its opening misses it
// there and then, charges the clock, and moves the run on so the HUD can
// answer while the checkpoint is still beside the rider — that, and the
// reset, is the whole of the way back. The last gate is the finish and must
// still be crossed through its opening: there is no wide crossing of a
// finish line.
//
// `reset` stands the craft a few metres behind the last checkpoint it TOOK
// (or the start), facing the next one, at rest — the way home from a rock,
// and the way back from a miss: the run is rewound to that same checkpoint,
// so every gate charged since it is owed again and can be threaded this
// time round.

import { angleDiff } from "../lib/math.ts";
import { fromEuler } from "../lib/quat.ts";
import type { Gate, Level, Ramp } from "../mapgen/types.ts";
import { rampsOf } from "./collision.ts";
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
    activeMissedGate: null,
    splits: level.course.gates.map(() => NaN),
    time: 0,
    penalty: 0,
    finished: false,
    lastGatePassedAt: 0,
    lastResetAt: 0,
    bestAir: 0,
    bestAirAt: 0,
    bestLength: 0,
    bestLengthAt: 0,
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
  return gate.kind === "air" ? { lateral, vertical: cy - gate.y } : { lateral, vertical: cy };
}

/** How far off the gate's centre a crossing was, in the terms the gate is
 * judged by: across the line for a water gate, and out from the ring's own
 * centre for an air gate. */
function offCentre(gate: Gate, at: { lateral: number; vertical: number }): number {
  return gate.kind === "air" ? Math.hypot(at.lateral, at.vertical) : Math.abs(at.lateral);
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
  if (!at || offCentre(gate, at) > gate.width / 2) return null;
  if (gate.kind !== "slalom") return at;
  // Lateral is positive to rider-right. A buoy the rider KEEPS on the
  // left is therefore crossed to its right, and vice versa. Zero is the
  // can itself: neither side, and a collision in the contact model.
  if (!gate.rounding) return null;
  const correctSide = gate.rounding === "left" ? at.lateral > 0 : at.lateral < 0;
  return correctSide ? at : null;
}

/** The point a rider aims through. Paired and air gates use their centre;
 * a single-buoy checkpoint uses the ideal standoff on its legal side. */
export function gatePassPoint(gate: Gate): { x: number; z: number } {
  if (gate.kind !== "slalom") return { x: gate.x, z: gate.z };
  const side = gate.rounding === "left" ? 1 : -1;
  const standoff = gate.standoff ?? gate.width / 4;
  return {
    x: gate.x + Math.cos(gate.heading) * standoff * side,
    z: gate.z - Math.sin(gate.heading) * standoff * side,
  };
}

/** Charge a gate the rider went past. */
function miss(state: GameState, index: number, events: GameEvent[]): void {
  const p = state.progress;
  p.missed.push(index);
  p.activeMissedGate = index;
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

/** Check the move the craft just made against the gate the run owes, and
 * finish the run at the last gate. The clock is not advanced here —
 * `step.ts` runs it, because a run with no course to count (`rules.course`
 * off) still has a clock to run down. */
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
  // THE WAY BACK FROM A MISS. The miss has already advanced the run; this
  // target is guidance, not another checkpoint to take. It stays until the
  // hull comes within half the gate's width of its centre: the visible
  // opening's plan footprint for both a buoy pair and a ring.
  if (p.activeMissedGate !== null) {
    const missed = gates[p.activeMissedGate];
    const dx = missed.x - c.x;
    const dz = missed.z - c.z;
    const radius = missed.width / 2;
    if (dx * dx + dz * dz <= radius * radius) p.activeMissedGate = null;
  }
  const n = p.nextGate;
  if (n >= gates.length) return;
  // ONE GATE IS LIVE AT A TIME: the one the run owes. A move through any
  // other checkpoint is not a checkpoint reached — it is a rider riding
  // past furniture that is not theirs yet — so nothing is credited and the
  // run still owes the gate it owed. What DOES move the run on is the miss:
  // crossing the owed gate's plane outside its opening charges it there and
  // then and makes the next one live, which is how a rider who went wide
  // carries on down the course without having to turn back. The finish is
  // excluded from that: it is the one line the run cannot pay to ride
  // around. A rider who is somehow past the owed gate without ever crossing
  // its plane rides back to it, or takes the reset, which stands them
  // behind it facing the right way.
  if (crossedGate(gates[n], x0, y0, z0, c.x, c.y, c.z)) {
    take(state, n, c.y, events);
    p.nextGate = n + 1;
  } else if (n < gates.length - 1 && crossedLine(gates[n], x0, y0, z0, c.x, c.y, c.z)) {
    miss(state, n, events);
    p.nextGate = n + 1;
  }
  if (p.nextGate >= gates.length) {
    p.activeMissedGate = null;
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

/** Where a reset stands the craft: behind the last checkpoint it actually
 * TOOK — threaded, not paid for — or at the start, facing the one after it.
 *
 * The last gate PASSED rather than the last one reached, because the reset
 * is the way back from a MISS as much as from a rock: a rider who went by
 * a checkpoint gets to ride the stretch again and take it this time. That
 * only works because `resetCraft` rewinds the run to the same place, so the
 * gate he is stood facing is the gate the run owes. The two halves are one
 * decision and must not come apart — standing a rider behind a checkpoint
 * he never took while the run owes one half a kilometre on is a reset that
 * sends him backwards, and then the idle timer sends him there again. */
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
    let best: Ramp | null = null;
    let bestD = Infinity;
    // R35 — every deck on the level, the course's and the trick field's
    // alike (`rampsOf`): a tricks level's ramps are mostly the field's, and
    // a reset that only knew about the air gates' would send a rider the
    // length of the shore to a ring he is not riding for.
    for (const r of rampsOf(state.level)) {
      const d = Math.hypot(r.x - c.x, r.z - c.z);
      if (d < bestD) {
        bestD = d;
        best = r;
      }
    }
    if (best) {
      const r = best;
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
  const last = lastPassed(p);
  if (last < 0) {
    const s = state.level.start;
    return { x: s.x, z: s.z, heading: s.heading, gate: -1 };
  }
  const owed = last + 1;
  const gate = gates[last];
  const next = gates[Math.min(owed, gates.length - 1)];
  const gatePoint = gatePassPoint(gate);
  const nextPoint = gatePassPoint(next);
  const heading =
    owed < gates.length
      ? Math.atan2(nextPoint.x - gatePoint.x, nextPoint.z - gatePoint.z)
      : gate.heading;
  // Stand a little behind the line, along the gate's own facing, so the
  // line is crossed by a MOVE the next time and not by the reset itself.
  const x = gatePoint.x - Math.sin(gate.heading) * K.resetBack;
  const z = gatePoint.z - Math.cos(gate.heading) * K.resetBack;
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
  c.airLength = 0;
  // ...and nothing UNDER it either: a craft stood afloat is out of any
  // spell it was lifted out of, with no float-up owed on it.
  c.under = false;
  c.underTime = 0;
  c.gasOff = 0;
  c.floatUp = false;
  c.floatUpFor = 0;
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

/** The last checkpoint the run has APPROVED — threaded in its turn — or -1
 * on a run that has not taken one yet. Gates are only ever taken in order,
 * so it is the end of `passed`. */
function lastPassed(p: Progress): number {
  return p.passed.length > 0 ? p.passed[p.passed.length - 1] : -1;
}

/** REWIND THE COURSE TO THAT CHECKPOINT. A miss is still forward progress
 * the moment it happens — nothing sends the rider back — but the reset he
 * ASKS for gives the stretch back: every gate charged since the last one he
 * threaded is struck off `missed` and its penalty taken back off the clock,
 * and the run owes them again in order. That is what makes the reset an
 * answer to a miss rather than a second punishment for it: the cost of
 * taking it is the seconds spent riding the stretch a second time from a
 * standing start, which on any course worth riding is the dearer of the two.
 *
 * It reaches back to the last gate PASSED and no further. A miss the rider
 * rode on from and then took a later checkpoint after is settled: the run
 * was approved past it, and a reset does not undo an approval. */
function rewindToLastPassed(state: GameState): void {
  const p = state.progress;
  const last = lastPassed(p);
  let refunded = 0;
  // `missed` is filled in gate order, so the ones after the last approved
  // checkpoint are the tail of it.
  while (p.missed.length > 0 && p.missed[p.missed.length - 1] > last) {
    p.missed.pop();
    refunded += 1;
  }
  p.penalty -= refunded * K.missedPenalty;
  p.time -= refunded * K.missedPenalty;
  p.nextGate = last + 1;
  // Whatever the miss warning was pointing at, the rider has just been put
  // back down on the course: either that checkpoint is owed again — and an
  // owed gate is not a missed one — or he is now standing forward of it.
  p.activeMissedGate = null;
}

/** `reset`: back to the last checkpoint taken, with the course owing
 * everything since. Emits the event. */
export function resetCraft(state: GameState, events: GameEvent[]): void {
  const pose = resetPose(state);
  standCraft(state, pose.x, pose.z, pose.heading);
  // The rewind before the clock is read: `lastResetAt` is what the bot's
  // idle timer counts from, and it counts from the corrected time.
  if (state.rules.course) rewindToLastPassed(state);
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

export type ActiveMissedCheckpoint = {
  gate: Gate;
  /** Plan distance from the craft to the gate's centre, m. */
  distance: number;
};

/** The checkpoint whose miss warning is still active, and how far back it
 * is. Null once the rider has returned to its opening or the run has ended. */
export function activeMissedCheckpoint(state: GameState): ActiveMissedCheckpoint | null {
  const index = state.progress.activeMissedGate;
  if (index === null) return null;
  const gate = state.level.course.gates[index];
  if (!gate) return null;
  return {
    gate,
    distance: Math.hypot(gate.x - state.craft.x, gate.z - state.craft.z),
  };
}

/** WHAT THE RIDER IS AIMING AT — stated once, because three surfaces ask it
 * and none of them may answer it differently: the HUD's guide line, the
 * bearing below, and the minimap's marks.
 *
 * In a run that COUNTS THE COURSE it is the next gate, and null once the
 * finish is behind — a run with nothing left to ride for is aiming at
 * nothing. In a run that does not (R35's tricks run), it is the next LIP:
 * the nearest deck ahead of the hull, inside `AIM_CONE` of the way it is
 * pointed, since the field is laid out and back and a ramp behind the rider
 * or facing them is not one they are riding at. Null where there is nothing
 * ahead, which is a rider who has turned round and is about to find the
 * next one as they come about.
 */
export function aimPoint(state: GameState): { x: number; z: number } | null {
  const c = state.craft;
  if (state.rules.course) {
    const gates = state.level.course.gates;
    const n = state.progress.nextGate;
    return n >= gates.length ? null : gatePassPoint(gates[n]);
  }
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  let best: { x: number; z: number } | null = null;
  let bestD = Infinity;
  for (const r of rampsOf(state.level)) {
    const dx = r.x - c.x;
    const dz = r.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d <= 0 || d >= bestD) continue;
    if ((dx * fx + dz * fz) / d < Math.cos(AIM_CONE)) continue;
    // …and the deck has to be one this rider can CLIMB: a lip met from
    // behind is a wall, and the return pass's decks all face that way.
    if (Math.abs(angleDiff(c.heading, r.heading)) > Math.PI / 2) continue;
    bestD = d;
    best = { x: r.x, z: r.z };
  }
  return best;
}

/** How far off the hull's own heading the next LIP may lie and still be the
 * one the rider is riding at, rad. A right angle either way: wider and a
 * deck abeam becomes the target every time the line bends, narrower and the
 * mark drops out every time the rider trims. */
const AIM_CONE = Math.PI / 2;

/** The heading from the craft to the next gate's pass point, and how far off
 * the craft's own heading that is, for the HUD's arrow and the bot. */
export function bearingToNext(
  state: GameState,
): { bearing: number; error: number; distance: number } | null {
  const gates = state.level.course.gates;
  const n = state.progress.nextGate;
  if (n >= gates.length) return null;
  const g = gates[n];
  const target = gatePassPoint(g);
  const c = state.craft;
  const bearing = Math.atan2(target.x - c.x, target.z - c.z);
  return {
    bearing,
    error: angleDiff(c.heading, bearing),
    distance: Math.hypot(target.x - c.x, target.z - c.z),
  };
}
