// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE GUIDE LINE RUNS — which stretch of the course's own line the
// dashes are laid along, as arithmetic over the level and the run. Three-free
// and DOM-free, so the tests read the rule rather than a picture of it;
// `guide-line.ts` is the half that turns it into plates in the water.
//
// THE LINE BELONGS TO THE COURSE, NOT TO THE CRAFT. It runs from astern of
// the rider to the checkpoint ahead and on down the line, laid on stations of
// `Course.path` that do not move — so the dashes stand still in the world
// while the rider passes over them, the way a lane marking does.
// A line drawn from the HULL to the next mark is the other thing entirely:
// it shrinks to a stub as the rider closes on the mark and vanishes at the
// moment they most need to know which way the next leg bends.
//
// The path already carries every lap (R30 — a lapped course publishes the
// loop ridden `laps` times), so a station is monotonic over a whole run and
// gate `i` and gate `i + lapGates` sit a lap apart on it rather than on top
// of each other.
//
// THE COURSE'S OWN LINE IS NOT THE RIDDEN ONE AT A ROUNDING BUOY, and that
// is the one place the two come apart. A circuit's marks stand forty-odd
// metres OFF the loop they are drawn around (R31), and the checkpoint there
// is taken by riding out to the can and crossing its abeam line on the
// colour's prescribed side — so the loop runs straight past the very mark
// the rider has to go round. `bendsOf` leads the line out through that
// crossing point and back again, anchored at the checkpoints either side so
// every other mark is still threaded exactly.
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
  gatePassPoint,
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
 * off the transom, and short enough that the dashes ahead own the budget.
 *
 * IT IS KEPT WHOLE ACROSS A CHECKPOINT, which is what the tail's anchor in
 * `guideWindow` is for: a rider who has just crossed a mark stands ON the
 * station it sits at, so a tail cut off at the mark just taken is no tail at
 * all for the next few boat lengths. */
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
  const line = level.course.path;
  const lineCum = cumulative(line);
  const length = lineCum.length > 0 ? lineCum[lineCum.length - 1] : 0;
  const gates = level.course.gates;
  // Every gate's station on the course's OWN line, each looked for AFTER the
  // one before it — which is what keeps a circuit's second lap on the second
  // loop of the path instead of snapping back onto the first, where the same
  // water is passed again.
  const marks = new Float64Array(gates.length);
  let after = 0;
  for (let i = 0; i < gates.length; i++) {
    after = distanceAlong(line, lineCum, gates[i].x, gates[i].z, after);
    marks[i] = after;
  }
  const bends = bendsOf(gates, marks, line, lineCum);
  if (bends.length === 0) return { points: line, cum: lineCum, gates: marks, length };
  return bentPath(line, lineCum, bends, marks);
}

/* ── THE ROUNDING ─────────────────────────────────────────────────────── */

/** The angle the guide leaves the course's own line at to go out round a
 * can, rad. The bend's LENGTH follows from this rather than being a number of
 * its own: a cosine shoulder `span` metres long carrying an offset of `off`
 * is at its steepest half way along, at `π · off / (2 · span)`, so holding
 * the angle fixed is `span = off · π / (2 · tan LEAD)`. That is what keeps a
 * mark lying fifty metres off the line and one lying forty reading as the
 * same manoeuvre instead of the wide one reading as a swerve.
 *
 * Thirty degrees: a break off the line big enough to say "the mark is out
 * there" at the range the dashes are read at, shallow enough that the line
 * never doubles back across itself down the frame. */
const LEAD = Math.PI / 6;

/** How much line a rounding's shoulder gets per metre of offset — `LEAD`
 * says why. It is a CEILING: a shoulder is cut short by the checkpoint
 * standing nearer than that on either side. */
const SHOULDER = Math.PI / (2 * Math.tan(LEAD));

/** How finely a bend is resampled, m. The course's own line carries a vertex
 * about every ten metres, which is a straight past a can rather than an arc
 * round one — and where the checkpoint before a mark stands close the whole
 * shoulder is three of those vertices, so an apex laid only on them can miss
 * the crossing point altogether. Four metres is inside the dash stride, so
 * the bend reads as a curve rather than as three long facets. */
const BEND_STEP = 4;

/** How near two samples have to stand to be the same one, m. A zero length
 * segment is one the dash walk and `pointAlong` both divide by, and a
 * millimetre is far under anything the line says. */
const SAME = 1e-3;

/** A rounding as the line is bent for it: the station of the can's own abeam
 * plane on the course's line, the offset from there out to the point the
 * rider crosses it at, and how much line the shoulder gets either side before
 * the checkpoints there anchor it back onto the line. */
type Bend = {
  readonly at: number;
  readonly dx: number;
  readonly dz: number;
  readonly back: number;
  readonly ahead: number;
};

/** How much of a bend's offset stands at station `d`: all of it at the apex,
 * none of it at the checkpoint either side, and a raised cosine between. The
 * cosine is flat at BOTH ends of its half cycle, so the line leaves the
 * course's own, tops out at the can and rejoins without a corner anywhere in
 * it — which a triangular blend would have three of. */
function bendShare(bend: Bend, d: number): number {
  if (d === bend.at) return 1;
  const span = d < bend.at ? bend.back : bend.ahead;
  if (span <= 0) return 0;
  const t = Math.abs(d - bend.at) / span;
  return t >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * t));
}

/** Every rounding buoy on the course, as a bend of the line. Empty on a coast
 * course, which has no marks to round — and that is what lets `guidePath`
 * hand the course's own line straight back for one. */
function bendsOf(
  gates: Level["course"]["gates"],
  marks: Float64Array,
  points: readonly Vec2[],
  cum: Float64Array,
): Bend[] {
  const length = cum.length > 0 ? cum[cum.length - 1] : 0;
  const bends: Bend[] = [];
  for (let i = 0; i < gates.length; i++) {
    if (gates[i].kind !== "slalom") continue;
    const at = marks[i];
    const on = pointAlong(points, cum, at);
    const pass = gatePassPoint(gates[i]);
    const dx = pass.x - on.x;
    const dz = pass.z - on.z;
    const shoulder = Math.hypot(dx, dz) * SHOULDER;
    // ANCHORED ON THE CHECKPOINTS EITHER SIDE. A shoulder run past one would
    // pull the line off the mark standing there — off an air gate's ring, and
    // off the ramp leading to it — so the bend is the rounding's alone and
    // every other checkpoint is still threaded through its own centre. Where
    // the leg is shorter than the shoulder wants, the course is asking for a
    // harder break than `LEAD` and the line says so.
    bends.push({
      at,
      dx,
      dz,
      back: Math.min(shoulder, at - (i > 0 ? marks[i - 1] : 0)),
      ahead: Math.min(shoulder, (i + 1 < gates.length ? marks[i + 1] : length) - at),
    });
  }
  return bends;
}

/** The course's line with every rounding bent into it, built once per level:
 * the line's own vertices, every gate's station and a fine sample through
 * each shoulder, each one carried out by whatever share of the bends reach
 * it.
 *
 * THE GATES' STATIONS ARE CARRIED THROUGH rather than looked for again. A
 * lapped course passes the same water two or three times, and on the course's
 * own line the laps are identical to the last bit — so `distanceAlong` breaks
 * the tie on the earliest, which is the lap being asked for. A bend is
 * resampled per lap and the copies differ by a float's last bits, which is
 * enough for that tie to fall the other way and put a gate a whole lap
 * downstream. So each gate keeps the station it was measured at on the line,
 * and what is read here is where the sample laid at it ended up. */
function bentPath(
  points: readonly Vec2[],
  cum: Float64Array,
  bends: readonly Bend[],
  marks: Float64Array,
): GuidePath {
  const stations: number[] = [];
  for (let i = 0; i < cum.length; i++) stations.push(cum[i]);
  for (let i = 0; i < marks.length; i++) stations.push(marks[i]);
  for (const bend of bends) {
    for (let d = bend.at - bend.back; d < bend.at + bend.ahead; d += BEND_STEP) stations.push(d);
  }
  stations.sort((a, b) => a - b);
  const kept: number[] = [];
  const out: Vec2[] = [];
  for (const d of stations) {
    if (kept.length > 0 && d - kept[kept.length - 1] < SAME) continue;
    const on = pointAlong(points, cum, d);
    let x = on.x;
    let z = on.z;
    for (const bend of bends) {
      const share = bendShare(bend, d);
      x += bend.dx * share;
      z += bend.dz * share;
    }
    kept.push(d);
    out.push({ x, z });
  }
  const bentCum = cumulative(out);
  const gates = new Float64Array(marks.length);
  // A merge walk: both lists are in order, so the sample standing at a gate's
  // station is never behind the one found for the gate before it.
  let j = 0;
  for (let i = 0; i < marks.length; i++) {
    while (
      j + 1 < kept.length &&
      Math.abs(kept[j + 1] - marks[i]) <= Math.abs(kept[j] - marks[i])
    ) {
      j++;
    }
    gates[i] = bentCum[j];
  }
  return {
    points: out,
    cum: bentCum,
    gates,
    length: bentCum.length > 0 ? bentCum[bentCum.length - 1] : 0,
  };
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
  // taken. It anchors the craft's own station, so a lapped course reads the
  // leg being ridden rather than the same water one lap back.
  const from = counting && next > 0 ? path.gates[next - 1] : 0;
  // THE SEARCH IS HELD TO THE LEG BEING RIDDEN. R30's lapped course passes
  // the same water two and three times, and the copies differ by a float's
  // last bits, so a search left to run on past the checkpoint ahead answers
  // with whichever lap's copy happens to come out nearest — and a mark drawn
  // a lap downstream is no mark at all. The rider is between the checkpoint
  // behind them and the one ahead by construction: a plane crossed outside
  // the opening charges the gate on the same step, so `nextGate` is never
  // behind the hull. A run with no course to count rides a coast (R35),
  // which passes nothing twice and needs no ceiling.
  const to = counting ? path.gates[next] : Infinity;
  const here = distanceAlong(path.points, path.cum, state.craft.x, state.craft.z, from, to);
  if (counting) {
    // A run that counts the course is drawn to the next mark AT LEAST, and
    // on past it down the line while the reach allows — which is what keeps
    // a whole leg in front of the rider as they cross a checkpoint instead
    // of handing them a stub.
    const end = Math.min(path.length, Math.max(path.gates[next], here + REACH));
    // THE TAIL HANGS OFF THE CHECKPOINT BEFORE LAST, not off the one just
    // taken. Held at the last one, the tail is cut exactly where the rider
    // is standing at the instant they cross it — so the dashes astern blink
    // out under the hull and grow back over the next `BEHIND` metres, which
    // reads as the mark faltering at the one moment the rider is looking at
    // it hardest. One checkpoint further back and the tail simply runs
    // through the crossing; it costs nothing drawn, because `here - BEHIND`
    // is what decides the tail everywhere else along the leg and the window
    // is no longer for it.
    const tail = next > 1 ? path.gates[next - 2] : 0;
    return { begin: Math.min(Math.max(tail, here - BEHIND), end), end };
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
