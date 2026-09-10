// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R24 — THE ROUTE: the racing line, drawn BEFORE there is any land.
//
// This is the inversion the whole generator turns on. A shore-first
// generator draws a coast and then looks for a line along it, and what it
// can find is always a line ALONG it: the course is as straight as the
// coast is, and no amount of wandering in the coast makes a corner the
// rider has to steer round rather than lean through. The 90s jetski racers
// went the other way about — a basin with a route through it, the land put
// where the route is not — and so does this.
//
// So the route is a free walk in the plane. It starts at the origin on a
// drawn heading and steps `route.step` metres at a time, turning by a rate
// read off a smooth noise and clamped to the tightest circle a hull can
// hold (R23). The noise has real amplitude: over a few hundred metres the
// heading can swing right round, which is what puts hairpins and dog-legs
// in a course rather than the long shallow bends a coastline gives.
//
// Three things keep the walk honest. It is pulled back toward the middle
// when it strays past `route.reach`, so a level stays a compact place
// rather than a line receding into the distance. It STEERS AWAY from the
// legs it has already ridden, because a course packed into a basin will
// otherwise fold onto itself — and two legs of a course that nearly touch
// are two legs a rider cannot tell apart, with a gate on one crossed while
// riding the other. And when the avoidance loses anyway it is REJECTED, so
// the rule is a rule rather than a preference.
//
// Every point carries the half-width of water it is owed (`widths`). That
// number is what R1 and R5 become: a corridor 2·`course.offshore.min` wide
// at its narrowest has water inside R1's band by construction, and the bed
// profile under it is deep enough for R5 without a search. The old
// station-push loop existed only to find that by trial; here it is drawn.
//
// R25 — AND ONCE IT LEAVES THE COAST. A race that never gets out of the
// coastal band is a race down a corridor: the shore is always the same
// distance away on one side, and the water never opens. So one stretch of
// the line — drawn, not hoped for — turns off the coast, runs out into
// open water, ROUNDS A MARK and comes back to carry on where it left off.
//
// The leg is spliced into the free walk at its most seaward station inside
// `leg.at`, which is where a line already wants to go out. Its shape is
// five arcs and straights with a single radius (`leg.round`, never under
// R23's own): out to the sea's heading, a run of `leg.out`, a half circle
// round the mark, the same run back, and the turn that puts the line back
// on the heading it left on. The half circle IS the rounding — the mark
// stands at its centre — and the whole leg is 2π·round + 2·out metres of
// line whatever heading it left the coast on, which is what lets the
// course know before it is laid how much of itself the leg will take.

import { angleDiff, clamp, TAU } from "../lib/math.ts";
import { valueNoise } from "../lib/noise.ts";
import type { Rng } from "../lib/prng.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import type { Vec2 } from "./types.ts";

/** R25 — THE MARK: the rock the ocean leg is drawn round, standing in open
 * water where nothing else in the vocabulary stands. It is a `Solid` by the
 * time the level is compiled; this is what the route decided about it. */
export type Mark = {
  /** The centre of the rounding — where the rock stands. */
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly top: number;
  /** How far the leg reaches from it, m: inside this the line is out at
   * sea on purpose, and R1's ceiling is R25's business instead. */
  readonly zone: number;
};

/** R25 — the ocean leg: which stretch of the line it is (m along the
 * route), the point of it furthest out, and the mark it goes round. */
export type OceanLeg = {
  readonly from: number;
  readonly to: number;
  readonly apex: Vec2;
  readonly mark: Mark;
};

export type Route = {
  /** The racing line, `route.step` metres apart. */
  readonly points: readonly Vec2[];
  /** Cumulative distance to each point, m. */
  readonly along: Float64Array;
  /** Half-width of water owed at each point, m. */
  readonly widths: Float64Array;
  /** The whole line's length, m. */
  readonly length: number;
  /** R15 — the compass heading the OPEN SEA lies in. Read off the free
   * walk's own overall run, a quarter turn to one side, and drawn here
   * rather than in the basin because the ocean leg has to know which way
   * out is before the water exists. */
  readonly seaHeading: number;
  readonly leg: OceanLeg;
};

export function drawRoute(rng: Rng): Route | null {
  for (let attempt = 0; attempt < R.route.tries; attempt++) {
    const route = drawOnce(rng);
    if (route) return route;
  }
  return null;
}

function drawOnce(rng: Rng): Route | null {
  const step = R.route.step;
  // The leg's own numbers first: its length is 2π·round + 2·out whatever
  // heading it leaves on, so the free walk can be drawn shorter by exactly
  // as much as the leg will add and the route come out inside its band.
  const round = inBand(rng, R.leg.round);
  const out = inBand(rng, R.leg.out);
  const legLength = TAU * round + 2 * out;
  const mark = { r: inBand(rng, R.solids.mark.r), top: inBand(rng, R.solids.mark.top) };
  const count = Math.ceil((inBand(rng, R.route.length) - legLength) / step) + 1;
  const heading0 = rng.range(0, TAU);
  const turnSeed = rng.int(1, 0x7fffffff);
  const widthSeed = rng.int(1, 0x7fffffff);
  const turnAmp = inBand(rng, R.route.swing);
  // R15 — which way the open sea lies: a quarter turn off the heading the
  // walk sets out on, to the drawn side. Decided BEFORE the walk, because
  // the walk has to know where the sea is: it may leave the coast once
  // (R25) and not twice, and "twice" is a fact about this heading.
  const seaHeading = heading0 + ((rng.chance(0.5) ? 1 : -1) * Math.PI) / 2;
  const sx = Math.sin(seaHeading);
  const sz = Math.cos(seaHeading);
  const inland = seaHeading + Math.PI;
  // The tightest circle R23 allows, as a heading change per step.
  const maxTurn = step / R.course.radius;

  const points: Vec2[] = [{ x: 0, z: 0 }];
  const headings: number[] = [heading0];
  let x = 0;
  let z = 0;
  let heading = heading0;
  let s = 0;
  const advance = (turn: number): void => {
    heading += clamp(turn, -maxTurn, maxTurn);
    x += Math.sin(heading) * step;
    z += Math.cos(heading) * step;
    s += step;
    points.push({ x, z });
    headings.push(heading);
  };
  // How far back along the line a point has to be before the walk treats it
  // as a different leg, and how far out it starts pushing away from one.
  const skip = Math.ceil(R.route.selfSpan / step);
  const guard = R.route.selfClear * R.route.avoidReach;
  // R25 — THE SEA WALL. Past the ocean leg the line is held inshore of the
  // station the leg left from, because that station is where the open
  // sea's own edge gets cut (R15) and a walk that wanders further out than
  // it puts the rest of the race outside R1's band — or, cut at the walk's
  // new maximum instead, leaves the leg's rounding sitting inside the band
  // it was drawn to leave. A level goes out to the ocean ONCE.
  let wall = Infinity;
  const freeTurn = (): number => {
    // The turn rate: a smooth noise, so the line curves rather than
    // corners, times the amplitude this route was drawn with.
    let turn = (valueNoise(s, 0, R.route.swingScale, turnSeed) - 0.5) * 2 * turnAmp * maxTurn;
    // …and a pull back toward the middle once the walk strays, so the level
    // is a place rather than a departure. The pull is a turn, not a jump:
    // it bends the line home over a few hundred metres.
    const away = Math.hypot(x, z);
    if (away > R.route.reach) {
      const home = Math.atan2(-x, -z);
      const off = angleDiff(heading, home);
      const pull = clamp((away - R.route.reach) / R.route.reach, 0, 1);
      turn += clamp(off, -maxTurn, maxTurn) * pull;
    }
    // …and away from anything it has already ridden past. The push is the
    // sum of the directions the old legs lie in, which is what lets the
    // line thread a gap between two of them rather than being shoved into
    // one by the other.
    let px = 0;
    let pz = 0;
    const now = points.length - 1;
    for (let j = 0; j + skip < now; j++) {
      const ax = x - points[j].x;
      const az = z - points[j].z;
      const d = Math.hypot(ax, az);
      if (d > guard || d < 1e-6) continue;
      const w = (guard - d) / guard;
      px += (ax / d) * w;
      pz += (az / d) * w;
    }
    if (px !== 0 || pz !== 0) {
      turn += clamp(angleDiff(heading, Math.atan2(px, pz)), -maxTurn, maxTurn) * R.route.avoid;
    }
    const out = x * sx + z * sz - wall;
    if (out > 0) {
      turn += clamp(angleDiff(heading, inland), -maxTurn, maxTurn) * clamp(out / R.leg.wall, 0, 1);
    }
    return turn;
  };
  for (let i = 1; i < count; i++) advance(freeTurn());

  // ── R25 — the ocean leg, spliced in where the line is already out ─────
  // At the walk's OWN most seaward station: the line's heading there is
  // across the sea's direction (its seaward reach is at a maximum, so it is
  // turning neither out nor in), which is exactly the pose a leg wants to
  // leave the coast from — and nothing else on the walk stands further
  // out, which is what lets the leg's reach be the arithmetic of its own
  // radius rather than a race against the rest of the line.
  //
  // It has to fall inside `leg.at`, because the course is measured out in
  // metres from the start and a leg the finish cannot reach is a leg
  // nobody rides. Where the walk's furthest point is somewhere else, the
  // walk is redrawn rather than the leg moved to a station that is not the
  // furthest one.
  let entry = 0;
  let highest = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const u = points[i].x * sx + points[i].z * sz;
    if (u > highest) {
      highest = u;
      entry = i;
    }
  }
  const at = entry * step;
  // …and early enough that the course can still reach the far side of it:
  // the finish is measured out along the line and has to fall a gate's
  // spacing past the leg with the route's own tail still under it.
  const latest = Math.min(R.leg.at.max, (count - 1) * step - R.leg.after);
  if (at < R.leg.at.min || at > latest) return null;

  const from = entry * step;
  const tail = count - 1 - entry;
  x = points[entry].x;
  z = points[entry].z;
  heading = headings[entry];
  s = from;
  points.length = entry + 1;
  headings.length = entry + 1;
  // Which way the line turns to get out to sea: the short way. Everything
  // else in the leg follows from it — the rounding turns the OTHER way, so
  // the line comes back on the far side of it and the leg leaves the walk
  // further along the coast rather than back where it entered.
  const turnOut = angleDiff(heading, seaHeading);
  const sign = turnOut >= 0 ? 1 : -1;
  const arc = (turn: number): void => {
    const steps = Math.max(1, Math.round((round * Math.abs(turn)) / step));
    for (let i = 0; i < steps; i++) advance(turn / steps);
  };
  const run = (): void => {
    const steps = Math.max(1, Math.round(out / step));
    for (let i = 0; i < steps; i++) advance(0);
  };
  arc(turnOut);
  run();
  // The mark stands at the centre of the half circle — on the side the
  // rounding turns toward, one radius off the line.
  const markHeading = heading - (sign * Math.PI) / 2;
  const markX = x + Math.sin(markHeading) * round;
  const markZ = z + Math.cos(markHeading) * round;
  arc(-sign * Math.PI);
  run();
  arc(sign * (Math.PI - Math.abs(turnOut)));
  const to = s;
  let zone = 0;
  for (let i = entry; i < points.length; i++) {
    zone = Math.max(zone, Math.hypot(points[i].x - markX, points[i].z - markZ));
  }
  // The wall stands a fade INSIDE the entry's own reach, so a tail running
  // seaward is already turning by the time it gets there rather than
  // overshooting the line by its own turning circle.
  wall = highest - R.leg.wall;
  for (let i = 0; i < tail; i++) advance(freeTurn());

  // R24 — and where the avoidance lost, the route is refused rather than
  // shipped. Compared only between points far enough apart ALONG the line
  // for the closeness to mean anything: consecutive points are a step apart
  // by construction.
  for (let i = 0; i < points.length; i++) {
    for (let j = i + skip; j < points.length; j++) {
      const dx = points[j].x - points[i].x;
      const dz = points[j].z - points[i].z;
      if (dx * dx + dz * dz < R.route.selfClear * R.route.selfClear) return null;
    }
  }

  const along = new Float64Array(points.length);
  for (let i = 1; i < points.length; i++) {
    along[i] =
      along[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
  }
  // The corridor: a slow swell between the band's ends, so the water opens
  // out into a bay in places and closes to a channel in others, and the
  // rider reads the difference as a place changing rather than as a
  // constant-width canal.
  const widths = new Float64Array(points.length);
  for (let i = 0; i < points.length; i++) {
    const t = valueNoise(along[i], 0, R.route.corridorScale, widthSeed);
    widths[i] = R.route.corridor.min + (R.route.corridor.max - R.route.corridor.min) * t;
  }

  return {
    points,
    along,
    widths,
    length: along[along.length - 1],
    seaHeading,
    leg: {
      from,
      to,
      apex: { x: markX + sx * round, z: markZ + sz * round },
      mark: { x: markX, z: markZ, r: mark.r, top: mark.top, zone: zone + R.leg.zoneSlack },
    },
  };
}
