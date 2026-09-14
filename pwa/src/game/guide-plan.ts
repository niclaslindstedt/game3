// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE GUIDE LINE RUNS — which stretch of the course's own line the
// dashes are laid along, as arithmetic over the level and the run. Three-free
// and DOM-free, so the tests read the rule rather than a picture of it;
// `guide-line.ts` is the half that turns it into plates in the water.
//
// THE LINE BELONGS TO THE COURSE, NOT TO THE CRAFT. It runs from the
// checkpoint behind the rider to the one ahead and on down the line, laid on
// stations of `Course.path` that do not move — so the dashes stand still in
// the world while the rider passes over them, the way a lane marking does.
// A line drawn from the HULL to the next mark is the other thing entirely:
// it shrinks to a stub as the rider closes on the mark and vanishes at the
// moment they most need to know which way the next leg bends.
//
// The path already carries every lap (R30 — a lapped course publishes the
// loop ridden `laps` times), so a station is monotonic over a whole run and
// gate `i` and gate `i + lapGates` sit a lap apart on it rather than on top
// of each other.

import { cumulative, distanceAlong, type GameState, type Level, type Vec2 } from "@engine";

/** How far ahead of the rider the line is drawn, m. A line to a mark a
 * kilometre away is a kilometre of dashes nobody can resolve, drawn every
 * frame; past this the rider is being told a direction, which the arrow and
 * the minimap already say better. It is a FLOOR rather than a ceiling on the
 * next checkpoint: the mark ahead is always joined to the one behind, however
 * long that leg is. */
export const REACH = 320;

/** How much line is kept BEHIND the rider, m. The leg they are on started at
 * the last checkpoint and a few boat lengths of it astern is what says so —
 * enough to read as a road being ridden along rather than a leash trailing
 * off the transom, and short enough that the dashes ahead own the budget. */
export const BEHIND = 24;

/** The level's line, measured once: the cumulative distance to each vertex of
 * `Course.path`, and the station of every gate on it. Rebuilt when the level
 * changes and never per frame — a course path is a few hundred points. */
export type GuidePath = {
  readonly points: readonly Vec2[];
  readonly cum: Float64Array;
  /** Station of each of `Course.gates`, m along the path, in gate order. */
  readonly gates: Float64Array;
  /** The whole path's length, m. */
  readonly length: number;
};

export function guidePath(level: Level): GuidePath {
  const points = level.course.path;
  const cum = cumulative(points);
  const gates = new Float64Array(level.course.gates.length);
  // Each gate is looked for AFTER the one before it, which is what keeps a
  // circuit's second lap on the second loop of the path instead of snapping
  // back onto the first, where the same water is passed again.
  let after = 0;
  for (let i = 0; i < gates.length; i++) {
    const g = level.course.gates[i];
    after = distanceAlong(points, cum, g.x, g.z, after);
    gates[i] = after;
  }
  return { points, cum, gates, length: cum.length > 0 ? cum[cum.length - 1] : 0 };
}

/** The stretch of the line the dashes are laid over, as stations along
 * `GuidePath`. Empty when there is nothing to draw (`begin >= end`). */
export type GuideWindow = { begin: number; end: number };

/** Which stretch of the line to draw for this moment of this run. `aim` is
 * the engine's own `aimPoint` — the next checkpoint in a run that counts the
 * course, the next lip in one that does not — and is never asked for a second
 * way here. */
export function guideWindow(path: GuidePath, state: GameState, aim: Vec2): GuideWindow {
  const gates = state.level.course.gates;
  const next = state.progress.nextGate;
  const counts = state.rules.course && next < gates.length;
  // The checkpoint BEHIND the rider — the start line before the first one is
  // taken. It anchors the craft's own station too, so a lapped course reads
  // the leg being ridden rather than the same water one lap back.
  const from = counts && next > 0 ? path.gates[next - 1] : 0;
  const here = distanceAlong(path.points, path.cum, state.craft.x, state.craft.z, from);
  // A run that counts the course is drawn to the next mark AT LEAST, and on
  // past it down the line while the reach allows — which is what keeps a
  // whole leg in front of the rider as they cross a checkpoint instead of
  // handing them a stub. A tricks run has no marks, so its line ends at the
  // lip it is pointing out.
  const target = counts
    ? path.gates[next]
    : distanceAlong(path.points, path.cum, aim.x, aim.z, here);
  const end = Math.min(path.length, counts ? Math.max(target, here + REACH) : target);
  const begin = Math.min(Math.max(from, here - BEHIND), end);
  return { begin, end };
}
