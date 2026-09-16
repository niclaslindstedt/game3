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
//
// A RUN WITH NO COURSE TO COUNT IS STILL RIDDEN ALONG THAT LINE. The tricks
// field (R35) is laid on the racing line itself, out and back, so the same
// stretch of the same path is the right thing to draw — what changes is that
// there are no checkpoints to hang the ends off. So the window is measured
// from the RIDER instead: their own stretch of the line, in the direction
// they are travelling, never ended by the momentary answer to "what is the
// rider aiming at". `guideWindow` says why that last part matters.

import {
  cumulative,
  distanceAlong,
  pointAlong,
  type CraftState,
  type GameState,
  type Level,
  type Vec2,
} from "@engine";

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

/** HOW MUCH WAY THE NOSE IS WORTH when the hull has none of its own, m/s —
 * see `wayAlong`. Two metres a second is a hull barely moving, so it decides
 * only where there is nothing else to read and can never outvote a rider
 * actually travelling. */
const NOSE_WAY = 2;

/** WHICH WAY ALONG THE LINE THE RIDER IS GOING: +1 up the path's own
 * direction, -1 back down it. A tricks field is laid OUT AND BACK along the
 * one racing line (R35), so half of every run is ridden against the path's
 * direction and the stretch worth drawing is the one in FRONT of the rider
 * either way.
 *
 * It is read off the hull's VELOCITY rather than off its heading, and that
 * is the whole of why a flip no longer turns the mark round: `c.heading` is
 * derived through `toEuler`, which folds the pitch back as the nose passes
 * vertical and swings the heading a clean 180° to compensate (`craft.ts`
 * says the same thing where the rider's own way is read), so a hull half way
 * round a backflip reads as one going the other way. Its velocity does not
 * care — a rider mid-flip is still travelling the way the lip sent them.
 *
 * The nose is worth `NOSE_WAY` of way on top, which is what decides a hull
 * sitting still: velocity alone at rest is the wave's orbit under the hull,
 * whose sign turns over with every crest, and a 300 m mark that changes ends
 * twice a second is worse than no mark at all. */
function wayAlong(path: GuidePath, here: number, craft: CraftState): 1 | -1 {
  const { heading } = pointAlong(path.points, path.cum, here);
  const tx = Math.sin(heading);
  const tz = Math.cos(heading);
  const nose = Math.sin(craft.heading) * tx + Math.cos(craft.heading) * tz;
  return craft.vx * tx + craft.vz * tz + NOSE_WAY * nose >= 0 ? 1 : -1;
}

/** Which stretch of the line to draw for this moment of this run. `aim` is
 * the engine's own `aimPoint` — the next checkpoint in a run that counts the
 * course, the next lip in one that does not — and is never asked for a second
 * way here.
 *
 * IT IS NOT WHAT ENDS THE LINE IN A TRICKS RUN, and that is the whole of what
 * was wrong with the mark there. `aimPoint` answers for one instant off the
 * hull's own HEADING, and in a run with no course to count it says "nothing"
 * routinely mid-ride: over the top of a flip, where `toEuler` swings the
 * heading 180° as the nose passes vertical and every lip on the shore reads
 * as being behind the rider; through the turn back onto the field; at either
 * end of it. A line that ends at the aim is a line that blinks out at exactly
 * those moments — which is to say, in the air, during the trick. So a run
 * with no course to count draws the rider's own stretch of the line instead,
 * and the aim only says whether there is anything left to point at at all. */
export function guideWindow(path: GuidePath, state: GameState, aim: Vec2 | null): GuideWindow {
  const counting = state.rules.course;
  // A course ridden out to its last checkpoint has nothing left to aim at,
  // and the line goes with the run. A run that never counted one is a
  // different thing entirely and is drawn below.
  if (counting && !aim) return { begin: 0, end: 0 };
  const next = state.progress.nextGate;
  // The checkpoint BEHIND the rider — the start line before the first one is
  // taken. It anchors the craft's own station too, so a lapped course reads
  // the leg being ridden rather than the same water one lap back.
  const from = counting && next > 0 ? path.gates[next - 1] : 0;
  const here = distanceAlong(path.points, path.cum, state.craft.x, state.craft.z, from);
  if (counting) {
    // A run that counts the course is drawn to the next mark AT LEAST, and
    // on past it down the line while the reach allows — which is what keeps
    // a whole leg in front of the rider as they cross a checkpoint instead
    // of handing them a stub.
    const end = Math.min(path.length, Math.max(path.gates[next], here + REACH));
    return { begin: Math.min(Math.max(from, here - BEHIND), end), end };
  }
  // A run with no course to count is the tricks field (R35), and R35 lays it
  // along this very line — so the line is still the right thing to draw and
  // what it has lost is only the two marks it used to hang its ends off. It
  // gets the rider's own stretch instead: `BEHIND` astern and `REACH` in
  // front of them, in the direction they are actually travelling.
  //
  // The lip is INSIDE that reach by construction and needs no special case:
  // the field's stride is the longest run-up the roster needs (213 m at the
  // class a tricks run is pinned to, `trickStride`) against a reach half as
  // long again, so the mark already runs to the next deck and past it. Where
  // the field skipped a station the line runs out to the reach and says a
  // direction, which is what the reach is for.
  const way = wayAlong(path, here, state.craft);
  const ahead = clampTo(here + way * REACH, path.length);
  const astern = clampTo(here - way * BEHIND, path.length);
  return { begin: Math.min(ahead, astern), end: Math.max(ahead, astern) };
}

/** A station held on the path, m. */
function clampTo(d: number, length: number): number {
  return Math.min(length, Math.max(0, d));
}
