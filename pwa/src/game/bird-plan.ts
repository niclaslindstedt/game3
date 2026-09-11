// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE EVERY BIRD IS — the roster in `bird-defs.ts` laid over the level,
// and where each bird of each flock is at a moment, as plain numbers.
// `birds.ts` turns what comes back into instance matrices; nothing here has
// heard of three.js, which is the DOM-free-payload split every card and
// every HUD readout in this app is built on and what lets
// `tests/birds_test.ts` hold the whole model.
//
// A FLOCK IS A ROUTINE, NOT A POSITION. What is planned is a HOME (a rock,
// a raft on the water, the crown of a pine, a few metres of shore), a LOOP
// in the air it flies when it flies, and a CYCLE — so many seconds of rest,
// so many of flight — with a phase of its own. Where any one bird is at
// time `t` is `birdPose`, a pure function of the flock and the clock in
// exactly the way the sea life's `faunaPose` is: give it the same arguments
// twice and it gives the same answer twice, so a seed flies the same birds
// on every ride and a replay puts every one of them back.
//
// THE MODEL, in four layers:
//
//   THE CYCLE. A flock rests at home for most of its cycle and flies for
//   `airShare` of it, scaled by how much DAY there is (`activityAt` — the
//   sun's elevation, so a run that rides into the night rides under birds
//   going to roost, and a dawn run under birds getting up). The flight is a
//   blend from the roost to the loop and back: a raised ramp at each end,
//   so a flock takes off toward its beat and comes back down onto its rock
//   rather than appearing on either.
//
//   THE LOOP. A flying flock walks a closed ellipse at its own airspeed —
//   one turn every `period` seconds — and every bird holds a station in the
//   flock's frame (`formationOffset`: a wheel, a trailing line or a vee)
//   with a slow WEAVE of its own on top, so a flock breathes rather than
//   holding a ruler. A soaring bird's circle breathes wider and tighter and
//   the bird rises and sinks through it, which is what a thermal is.
//
//   THE WINGS. A beat gate opens for a few strokes and shuts again by how
//   much of its flight a species spends gliding; between bursts the wings
//   sit in their dihedral and rock. Taking off is all beating; on a rock
//   the wings are FOLDED (`fold` → 1) and the hand lies along the flank —
//   except a cormorant's, which are held out to dry for part of every rest.
//   A tern plunges every `dive` seconds: the bird drops out of its loop to
//   the water with its wings closing at the bottom, and climbs out again.
//
//   THE FLUSH. The one thing here with memory, and it is the caller's: a
//   raft the craft runs at gets up off the water in a burst and circles
//   low until the craft has gone, then settles. `birds.ts` remembers when
//   each flock was last flushed and hands the moment in, and so does the
//   audio's `bird-bed.ts` for the whirr of it; both decide the moment with
//   `flushAt`, the rule stated once here, and the model is still pure in
//   its arguments.
//
// CROSSINGS are the other half — the skeins going over on passage. They
// belong to the SEASON rather than to a place: in spring they go north and
// in autumn south, on a compass anchored to the noon sun (`SOUTH`), high,
// in vees and lines; each is a straight track over a point on the course,
// backed a long way up its own bearing so it ARRIVES rather than appears,
// and every crossing is a pure function of its index, so the sky at any
// `t` is the same sky on every ride — including the crossings already in
// it on the first frame.
//
// The engine's sign conventions hold: heading 0 is +z and grows clockwise
// from above, pitch is NOSE-UP positive, roll right-side-down positive.

import {
  DECLINATION,
  SOUTH,
  TAU,
  createRng,
  cumulative,
  fieldGradient,
  fromEuler,
  hash2,
  pointAlong,
  sampleField,
  sunAt,
  sunHourAt,
  biomeOf,
  type Level,
  type Quat,
  type Rng,
  type Vec2,
} from "@engine";

import {
  BIRDS,
  birdById,
  type Band,
  type BirdId,
  type BirdSpec,
  type Formation,
  type Home,
} from "./bird-defs.ts";
import { NIGHT_BELOW } from "./daylight.ts";
import { FLORA } from "./flora-defs.ts";
import { planFlora } from "./flora-plan.ts";
import { FLORA_SCALE } from "./settings-video.ts";

/** The plan a level was dealt, kept against the level itself: the renderer
 * and the audio both ask, and laying one is forty milliseconds of hashing
 * the shore's cover for perches — once behind the loading card is a step;
 * twice, with the second on the first audible frame, is a hitch. */
const plans = new WeakMap<Level, BirdPlan>();

/** THE PLAN FOR A LEVEL, laid once: what `birds.ts` draws and what the
 * audio's `bird-bed.ts` cries from, so the ear and the eye agree by
 * construction. `planBirds` itself is the pure builder, for a lab or a
 * test that hands in perches of its own. */
export function birdPlanFor(level: Level): BirdPlan {
  let hit = plans.get(level);
  if (hit === undefined) {
    hit = planBirds(level);
    plans.set(level, hit);
  }
  return hit;
}

/** Where a flock lives: what it sits on and where, with `y` the height of
 * that surface over sea level — 0 for a raft, which rides the sea the
 * renderer samples under it. */
export type Roost = {
  readonly kind: Home;
  readonly x: number;
  readonly z: number;
  readonly y: number;
};

export type Flock = {
  readonly id: string;
  readonly species: BirdId;
  readonly count: number;
  readonly home: Roost;
  /** How far round the home the birds spread at rest, m. */
  readonly roost: number;
  /** The heading a resting bird faces — into the wind, as every bird on
   * every rock does. */
  readonly facing: number;
  /** The beat it flies: the loop's centre, its long semi-axis (m), how
   * squashed it is across that, the heading of the long axis, which way
   * round, how high over the water it holds, and the seconds to go once
   * round at the species' own airspeed. */
  readonly loop: {
    readonly x: number;
    readonly z: number;
    readonly radius: number;
    readonly ovality: number;
    readonly heading: number;
    readonly sense: 1 | -1;
    readonly altitude: number;
    readonly period: number;
  };
  /** One rest-and-flight cycle, s, the share of it flown at full day, and
   * where in the cycle the flock stands at t = 0, 0..1. */
  readonly cycle: number;
  readonly airShare: number;
  readonly phase: number;
  /** The seed every per-bird number is hashed off. */
  readonly scatter: number;
};

/** One skein going over: what, how many, in what shape, on what bearing,
 * how high and how fast; the point on the course it crosses over and the
 * second it started its run at that point. */
export type Crossing = {
  readonly index: number;
  readonly species: BirdId;
  readonly count: number;
  readonly shape: Formation;
  readonly bearing: number;
  readonly height: number;
  readonly speed: number;
  readonly x: number;
  readonly z: number;
  readonly at: number;
  readonly scatter: number;
};

export type BirdPlan = {
  readonly seed: number;
  readonly flocks: readonly Flock[];
  /** Seconds between one crossing and the next, or Infinity in a season
   * nothing crosses. */
  readonly interval: number;
  /** The birds crossing this season, each repeated by its share, so a
   * hashed pick off the list is a weighted one. */
  readonly crossers: readonly BirdId[];
  /** The racing line and its cumulative length, for a crossing to be
   * pitched over the point a rider will have reached. */
  readonly path: readonly Vec2[];
  readonly cum: Float64Array;
};

/** Where one bird is and how it is standing. Written into a caller's own
 * object: the renderer asks for a few hundred of these a frame. */
export type BirdPose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  roll: number;
  q: Quat;
  /** The shoulder's angle off level, rad, up positive — the beat, or the
   * dihedral a glide holds, or the drop of a folded wing. */
  flap: number;
  /** How folded the wing is, 0 open to 1 closed along the flank. */
  fold: number;
  /** 0 on its rock, 1 in the air, between the two on the way. */
  airborne: number;
};

export function freshBirdPose(): BirdPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    roll: 0,
    q: { x: 0, y: 0, z: 0, w: 1 },
    flap: 0,
    fold: 0,
    airborne: 0,
  };
}

/** The most birds one crossing can hold — the ceiling the instance buffers
 * are sized against. */
export const MOST_CROSSING_BIRDS = 15;

/** How far up its own bearing a crossing starts before the point it goes
 * over, m, and how far past it it is followed. The lead is the whole
 * trick: a skein put down where it is meant to be seen was already there;
 * one backed a kilometre up its track arrives — a smudge, a shape, birds,
 * gone. */
export const CROSSING_LEAD = 1200;
export const CROSSING_PAST = 900;

/** How often a crossing is pitched in a passage season, s. At a goose's
 * pace a crossing is two minutes in the sky, so two or three are up at
 * once through a spring run. */
const CROSSING_INTERVAL = 48;

/** How close to the COURSE a flock's home has to be, m, and how close its
 * LOOP's centre: a run is ridden along the racing line, and a raft of
 * eider three hundred metres up a back bay is a raft nobody meets. The
 * beat is held nearer than the roost, because the beat is where the
 * flock is in the air — a gull wheeling a hundred metres off the line is
 * a bird, and one three hundred metres off is grit. */
const NEAR_COURSE = 240;
const NEAR_LOOP = 150;
/** How fast a rider gets along the course, m/s, for the crossings to be
 * pitched over where the rider WILL be when they arrive — the one thing
 * about a skein that has to be designed rather than dealt, because a
 * skein that goes over the far end of a two-kilometre course is a skein
 * nobody saw. The bot's pace over a coast, near enough; a faster rider
 * meets them a little astern, a slower one a little ahead, and either is
 * still overhead. Past the finish the rider is at the finish. */
const RUN_PACE = 11;
/** …and how far along the course a crossing may stray from that point,
 * m, so they are not all dead overhead. */
const OVER_SPREAD = 260;
/** How far off the home a flock's loop is centred, m, and the water a raft
 * needs under it, m. */
const LOOP_OUT: Band = { min: 15, max: 70 };
const RAFT_DEPTH = 1.2;
const RAFT_OFFSHORE: Band = { min: 8, max: 110 };
/** How far out the shelter ring is thrown for a raft, m, and how much of
 * it a sea duck wants to be land: eider sit in the lee of something. */
const LEE_RING = 45;
const LEE_WANT = 0.15;
/** How tall a tree has to be for anything to perch on it, m, and how far
 * up it the perch is — a crown, not a tip. */
const PERCH_TREE = 9;
const PERCH_CROWN = 0.94;
/** How many attempts a flock gets at a home before the coast is judged to
 * have no place for it. */
const TRIES = 28;

/** How the flight blends off the roost and back on, s: the take-off and
 * the landing each take about this long, whatever the flight's length. */
const RAMP_SECONDS = 8;
/** How far the weave carries a bird off its station, in spans, and the
 * band of periods it runs at, s. */
const WEAVE = 0.35;
const WEAVE_PERIOD: Band = { min: 3, max: 7 };
/** How hard a bird banks into its loop, rad per (m/s)² of lateral
 * acceleration — an arcade dial: enough that a wheeling gull shows its
 * wing. */
const BANK = 0.05;
/** The most a bird pitches in level flight, rad; a plunging tern is
 * allowed to point down. */
const MAX_PITCH = 0.5;
const DIVE_PITCH = 1.3;
/** How high the SHOULDERS stand over what a resting bird sits on, in body
 * lengths: legs under a bird on a rock, a hull's worth of draft for one on
 * the water. */
const STAND_ROCK = 0.16;
const STAND_AFLOAT = 0.05;
/** How the wings sit on a bird at rest: dropped a little at the shoulder
 * with the hand along the flank. */
const REST_FLAP = -0.3;
/** How the wings sit on a cormorant drying them: held up and out. The
 * drying comes and goes on a slow cycle, s, for about half of it. */
const DRY_FLAP = 0.55;
const DRY_FOLD = 0.12;
const DRY_CYCLE = 44;
/** The wing angles a beat swings between, as shares of the stroke: deep on
 * the downstroke, shallow on the recovery. A symmetric beat is a metronome. */
const BEAT_DOWN = 1;
const BEAT_UP = 0.55;
/** How long a plunge takes from leaving the loop to being back in it, s,
 * and how high over the water the bottom of it is. */
const DIVE_SECONDS = 2.6;
const DIVE_BOTTOM = 0.4;
/** A flushed raft: how long it stays up, s, how high it circles, m, how
 * far out, and how close the craft has to come to put it up. */
export const FLUSH_SECONDS = 24;
const FLUSH_HEIGHT = 5;
const FLUSH_OUT = 16;
export const FLUSH_RADIUS = 30;
/** How far apart birds stand in a formation, in spans, across and along
 * the track. */
const SPACING = { across: 1.15, along: 1.5 };
/** …and a loose flock's spiral: how far out it steps per bird, how wide it
 * is stretched across the track, how far behind the leader the nearest of
 * the rest sits, and how much of the spiral's own turn is allowed to move
 * a bird fore and aft — less than the whole of it, so nobody is ever ahead
 * of the leader. */
const LOOSE = { step: 1.1, across: 1.7, lead: 0.7, stagger: 0.7 };
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** The step a heading is read over, s. */
const DT = 0.08;

/** The compass: the noon sun stands in the south, so this is north. */
const NORTH = SOUTH + Math.PI;

function inBand(rng: Rng, band: Band): number {
  return rng.range(band.min, band.max);
}

function smooth(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** How many flocks a stretch of coast carries: the whole part of the
 * expectation, plus the fraction as a chance of one more. */
function flockCount(rng: Rng, perKm: number, km: number): number {
  const expected = perKm * km;
  const whole = Math.floor(expected);
  return whole + (rng.chance(expected - whole) ? 1 : 0);
}

/** Ramanujan's ellipse perimeter, exact enough at these eccentricities. */
function perimeter(a: number, b: number): number {
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

/** What share of a ring stands out of the water — how much lee a piece of
 * sea has. */
function leeAt(level: Level, x: number, z: number): number {
  let land = 0;
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * TAU;
    if (sampleField(level.ground, x + Math.sin(a) * LEE_RING, z + Math.cos(a) * LEE_RING) > 0) {
      land++;
    }
  }
  return land / 6;
}

/** How far a plan point is from the racing line, m. Brute force over the
 * path: asked a few hundred times at load and never again. */
function pathDistance(path: readonly Vec2[], x: number, z: number): number {
  let best = Infinity;
  for (const p of path) {
    const d = (p.x - x) * (p.x - x) + (p.z - z) * (p.z - z);
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

/** Every station of every coastline, for a shore roost to be thrown from. */
function shorePoints(level: Level): readonly Vec2[] {
  const out: Vec2[] = [];
  for (const line of level.shore) for (const p of line) out.push(p);
  return out;
}

/**
 * THE TREES A BIRD CAN SIT IN: the crowns of the shore's tall trees, from
 * the cover as `flora-plan.ts` plants it at its SPARSEST — the plants every
 * DETAIL stop draws, so a perch is never the top of a tree the rider's
 * settings left out. Planted here rather than handed in from the renderer,
 * because a scenario and a test have to find the same eagle on the same
 * branch without a renderer in sight.
 */
export function treePerches(level: Level): Roost[] {
  const spots = planFlora(level, FLORA_SCALE.sparse);
  const perches: Roost[] = [];
  FLORA.forEach((spec, s) => {
    if (!["pine", "spruce", "birch", "aspen"].includes(spec.id)) return;
    for (const p of spots[s]) {
      if (p.h < PERCH_TREE) continue;
      perches.push({ kind: "tree", x: p.x, z: p.z, y: p.y + p.h * PERCH_CROWN });
    }
  });
  return perches;
}

/**
 * Lay every flock the season allows over the level, and decide what
 * crosses it. Deterministic in the level's seed on the renderer's own
 * generator (§25.2), so nothing here costs the run a draw.
 */
export function planBirds(level: Level, perches: readonly Roost[] = treePerches(level)): BirdPlan {
  const rng = createRng(level.seed ^ 0x6b1d);
  const km = level.course.length / 1000;
  const path = level.course.path;
  const shore = shorePoints(level);
  const rocks = level.solids.filter(
    (s) =>
      (s.kind === "skerry" || s.kind === "stack" || s.kind === "mark" || s.kind === "buoy") &&
      s.top > 0.3,
  );
  const b = level.bounds;
  const inside = (x: number, z: number, margin = 0): boolean =>
    x > b.minX + margin && x < b.maxX - margin && z > b.minZ + margin && z < b.maxZ - margin;
  const flocks: Flock[] = [];

  /** One try at a home for a flock of this species: where it sits, how
   * wide, and how many can (a buoy takes two gulls, not a colony). */
  const homeFor = (
    spec: BirdSpec,
    count: number,
  ): { home: Roost; roost: number; count: number } | null => {
    switch (spec.home) {
      case "water": {
        const x = rng.range(b.minX, b.maxX);
        const z = rng.range(b.minZ, b.maxZ);
        const off = sampleField(level.offshore, x, z);
        if (off < RAFT_OFFSHORE.min || off > RAFT_OFFSHORE.max) return null;
        if (-sampleField(level.ground, x, z) < RAFT_DEPTH) return null;
        if (leeAt(level, x, z) < LEE_WANT) return null;
        return { home: { kind: "water", x, z, y: 0 }, roost: spec.roost, count };
      }
      case "skerry": {
        if (rocks.length === 0) return null;
        const s = rng.pick(rocks);
        const buoy = s.kind === "buoy";
        return {
          home: { kind: "skerry", x: s.x, z: s.z, y: s.top },
          roost: buoy ? 0.3 : Math.min(spec.roost, s.r * 0.55),
          count: buoy ? Math.min(count, 2) : count,
        };
      }
      case "tree": {
        if (perches.length === 0) return null;
        return { home: rng.pick(perches), roost: spec.roost, count };
      }
      case "shore": {
        if (shore.length === 0) return null;
        const at = rng.pick(shore);
        // A few metres up from the water's edge, down the offshore
        // field's gradient — the first step that lands on dry ground.
        const g = fieldGradient(level.offshore, at.x, at.z);
        const n = Math.hypot(g.gx, g.gz);
        if (n < 1e-6) return null;
        for (let step = 1; step <= 4; step++) {
          const x = at.x - (g.gx / n) * step * 2.5;
          const z = at.z - (g.gz / n) * step * 2.5;
          const y = sampleField(level.ground, x, z);
          if (y > 0.15 && y < 3 && level.materialAt(x, z) !== "water") {
            return { home: { kind: "shore", x, z, y }, roost: spec.roost, count };
          }
        }
        return null;
      }
      default:
        return null;
    }
  };

  for (const spec of BIRDS) {
    if (spec.home === undefined || spec.perKm <= 0) continue;
    if (!spec.seasons.includes(level.season)) continue;
    const want = flockCount(rng, spec.perKm, km);
    for (let n = 0; n < want; n++) {
      for (let attempt = 0; attempt < TRIES; attempt++) {
        const size = rng.int(spec.flock.min, spec.flock.max);
        const found = homeFor(spec, size);
        if (!found) continue;
        const { home } = found;
        if (!inside(home.x, home.z)) continue;
        if (pathDistance(path, home.x, home.z) > NEAR_COURSE) continue;
        // The loop it flies, off to one side of the home and over the
        // water — a gull's beat is the shallows, not the wood — and kept
        // inside the level with its whole radius.
        const bearing = rng.range(0, TAU);
        const out = inBand(rng, LOOP_OUT);
        const cx = home.x + Math.sin(bearing) * out;
        const cz = home.z + Math.cos(bearing) * out;
        const radius = inBand(rng, spec.beat);
        if (!inside(cx, cz, radius)) continue;
        if (pathDistance(path, cx, cz) > NEAR_LOOP) continue;
        if (spec.home !== "tree" && sampleField(level.offshore, cx, cz) < 0) continue;
        const ovality = rng.range(0.45, 0.9);
        const heading = rng.range(0, TAU);
        const sense: 1 | -1 = rng.chance(0.5) ? 1 : -1;
        const altitude = inBand(rng, spec.altitude);
        flocks.push({
          id: `B${flocks.length + 1}`,
          species: spec.id,
          count: found.count,
          home,
          roost: found.roost,
          facing: level.wind.from,
          loop: {
            x: cx,
            z: cz,
            radius,
            ovality,
            heading,
            sense,
            altitude,
            period: perimeter(radius, radius * ovality) / spec.speed,
          },
          cycle: inBand(rng, spec.cycle),
          airShare: spec.airShare,
          phase: rng.next(),
          scatter: rng.int(1, 0x7fffffff),
        });
        break;
      }
    }
  }

  // What CROSSES this season, each bird repeated by its share.
  const crossers: BirdId[] = [];
  for (const spec of BIRDS) {
    if (!spec.passage || !spec.passes.includes(level.season)) continue;
    for (let i = 0; i < spec.passage.share; i++) crossers.push(spec.id);
  }
  return {
    seed: level.seed,
    flocks,
    interval: crossers.length > 0 ? CROSSING_INTERVAL : Infinity,
    crossers,
    path,
    cum: cumulative(path),
  };
}

/**
 * HOW MUCH OF THE DAY IS LEFT for a bird at time `t` on this level, 0..1:
 * nothing below civil twilight, everything with the sun a few degrees up,
 * smoothed between so a flock goes to roost over the dusk rather than at a
 * bell. Read off the same sun the sky is lit by.
 */
export function activityAt(level: Level, t: number): number {
  const sun = sunAt(sunHourAt(level, t), biomeOf(level.biome).latitude, DECLINATION[level.season]);
  const DAY = 4 * (Math.PI / 180);
  return smooth((sun.elevation - NIGHT_BELOW) / (DAY - NIGHT_BELOW));
}

/** A deterministic 0..1 from a flock's scatter, a bird's index and a
 * channel — the one source of every per-bird number here. */
function jitter(scatter: number, i: number, channel: number): number {
  return hash2(i, channel, scatter);
}

/**
 * WHERE ONE BIRD STANDS in the shape, in SPANS: `across` the track (+ is
 * the bird's own right) and `along` it (negative is behind the leader,
 * who is always bird 0 at the origin). A loose flock is laid on a
 * golden-angle spiral rather than a roll — the construction a sunflower's
 * seeds are on, and for the same reason: it never repeats and never puts
 * two birds in one place, which a hash of the index cannot promise.
 */
export function formationOffset(shape: Formation, i: number): { across: number; along: number } {
  if (i === 0) return { across: 0, along: 0 };
  if (shape === "vee") {
    const rank = Math.ceil(i / 2);
    const side = i % 2 === 1 ? 1 : -1;
    return { across: side * rank * SPACING.across, along: -rank * SPACING.along };
  }
  if (shape === "line") {
    return { across: i * SPACING.across, along: -i * SPACING.along };
  }
  const r = Math.sqrt(i) * LOOSE.step;
  const turn = i * GOLDEN_ANGLE;
  return {
    across: r * Math.cos(turn) * LOOSE.across,
    along: -(LOOSE.lead + r + r * Math.sin(turn) * LOOSE.stagger),
  };
}

/** The beat as an angle, from a phase in strokes: a deep downstroke and a
 * shallow recovery, scaled to the species' own stroke. */
function swingAt(strokes: number, stroke: number): number {
  const beat = Math.sin(strokes * TAU);
  return (beat > 0 ? beat * beat * BEAT_UP : -(beat * beat) * BEAT_DOWN) * stroke;
}

type At = { x: number; y: number; z: number };

/** Where on its loop a flock's leader is at `t`, and the tangent. */
function loopAt(flock: Flock, t: number, out: At): { fx: number; fz: number } {
  const loop = flock.loop;
  const a = flock.phase * TAU + loop.sense * TAU * (t / loop.period);
  const ch = Math.cos(loop.heading);
  const sh = Math.sin(loop.heading);
  const along = loop.radius * Math.cos(a);
  const across = loop.radius * loop.ovality * Math.sin(a);
  out.x = loop.x + along * sh + across * ch;
  out.z = loop.z + along * ch - across * sh;
  const dAlong = -loop.radius * Math.sin(a) * loop.sense;
  const dAcross = loop.radius * loop.ovality * Math.cos(a) * loop.sense;
  const vx = dAlong * sh + dAcross * ch;
  const vz = dAlong * ch - dAcross * sh;
  const n = Math.hypot(vx, vz) || 1;
  return { fx: vx / n, fz: vz / n };
}

/** How far through its flight a flock is at `t`: 0 at rest, 1 on its loop,
 * and the ramps between. `air` is the share of the cycle flown right now. */
function flightAt(flock: Flock, t: number, activity: number): number {
  const air = flock.airShare * activity;
  if (air <= 0) return 0;
  const p = t / flock.cycle + flock.phase;
  const u = (p - Math.floor(p)) / air;
  if (u >= 1) return 0;
  const ramp = Math.min(0.45, RAMP_SECONDS / (air * flock.cycle));
  return Math.min(smooth(u / ramp), smooth((1 - u) / ramp));
}

/** How far a flock put up `since` seconds ago is in its flush, 0..1: a
 * quick rise, a long settle, and nothing for a flock already flying its
 * loop (`w`). The one envelope every bird of the flock lifts on. */
function flushLift(since: number, w: number): number {
  if (!(since >= 0) || since >= FLUSH_SECONDS || w >= 1) return 0;
  const f = since / FLUSH_SECONDS;
  return Math.min(smooth(f / 0.12), smooth((1 - f) / 0.3)) * (1 - w);
}

/** Whether the craft can put a flock up at all. Only a flock on the WATER
 * or the SHORE gets up for a hull — a gull on a rock two metres over the
 * sea watches it go by. */
export function flushable(flock: Flock): boolean {
  return flock.home.kind === "water" || flock.home.kind === "shore";
}

/**
 * THE FLUSH RULE: when a flock last put up by the craft at `last` (or
 * -Infinity) is put up again, given where the craft is at `t`. Re-armed
 * only once the last flush is over, so a hull idling in the middle of a
 * raft does not hold the birds in the air forever. Returns `last` when
 * nothing happens, so a caller can tell a new flush by the change.
 *
 * Stated once, here, because two things keep this memory and neither can
 * afford to disagree: the renderer (`birds.ts`, which draws the raft going
 * up) and the audio (`audio/bird-bed.ts`, which plays the whirr of it).
 */
export function flushAt(flock: Flock, cx: number, cz: number, t: number, last: number): number {
  if (!flushable(flock)) return last;
  if (t - last <= FLUSH_SECONDS) return last;
  return Math.hypot(flock.home.x - cx, flock.home.z - cz) < FLUSH_RADIUS + flock.roost ? t : last;
}

/** How much of a flock is IN THE AIR at `t`, 0..1 — on its loop, or put
 * up — without posing a bird. What the audio asks, once a flock a frame,
 * to know whether a colony is a racket in the sky or a few grumbles on a
 * rock. */
export function flightShare(flock: Flock, t: number, activity = 1, flushedAt = -Infinity): number {
  const w = flightAt(flock, t, activity);
  return Math.max(w, flushLift(t - flushedAt, w));
}

/** Where bird `i` of `flock` is at `t`, position only. `waterY` is the sea
 * under a raft; `flushedAt` the moment the flock was last put up. */
function stationAt(
  spec: BirdSpec,
  flock: Flock,
  i: number,
  t: number,
  activity: number,
  waterY: number,
  flushedAt: number,
  out: At,
): { w: number; dive: number } {
  // ── At rest ───────────────────────────────────────────────────────────
  const ra = jitter(flock.scatter, i, 1) * TAU;
  const rr = Math.sqrt(jitter(flock.scatter, i, 2)) * flock.roost;
  const restX = flock.home.x + Math.sin(ra) * rr;
  const restZ = flock.home.z + Math.cos(ra) * rr;
  const afloat = flock.home.kind === "water";
  const restY =
    flock.home.y + (afloat ? waterY + spec.length * STAND_AFLOAT : spec.length * STAND_ROCK);

  // ── In the air ────────────────────────────────────────────────────────
  const w = flightAt(flock, t, activity);
  let x = restX;
  let y = restY;
  let z = restZ;
  let dive = 0;
  if (w > 0) {
    const { fx, fz } = loopAt(flock, t, out);
    const slot = formationOffset(spec.formation, i);
    // The weave: its own period per bird, so the flock breathes.
    const wp =
      WEAVE_PERIOD.min + jitter(flock.scatter, i, 3) * (WEAVE_PERIOD.max - WEAVE_PERIOD.min);
    const wPhase = jitter(flock.scatter, i, 4) * TAU;
    const weave = Math.sin((TAU * t) / wp + wPhase) * WEAVE;
    const across = (slot.across + weave) * spec.span;
    const along = slot.along * spec.span;
    // A soaring bird rides its thermal up and down; a beating flock holds
    // its height and every bird takes a little of its own.
    const lift = spec.glide > 0.5 ? Math.sin(t * 0.13 + wPhase) * 6 : 0;
    const own = (jitter(flock.scatter, i, 5) - 0.5) * 2 * spec.span * (i === 0 ? 0 : 1.5);
    const fly = {
      x: out.x + fx * along + fz * across,
      y: flock.loop.altitude + own + lift + Math.sin(((TAU * t) / wp) * 0.7 + wPhase) * 0.4,
      z: out.z + fz * along - fx * across,
    };
    // THE PLUNGE: on its own beat per bird, the tern drops out of its loop
    // to the water and climbs back into it, only when it is properly up.
    if (spec.dive > 0) {
      const c = t / spec.dive + jitter(flock.scatter, i, 6);
      const p = (c - Math.floor(c)) * spec.dive;
      if (p < DIVE_SECONDS) {
        const v = p / DIVE_SECONDS;
        const dip = Math.sin(v * Math.PI);
        dive = dip * dip * w;
        fly.y = fly.y + (DIVE_BOTTOM + waterY - fly.y) * dive;
      }
    }
    x = restX + (fly.x - restX) * w;
    y = restY + (fly.y - restY) * w;
    z = restZ + (fly.z - restZ) * w;
  }

  // ── Put up ────────────────────────────────────────────────────────────
  const since = t - flushedAt;
  const wf = flushLift(since, w);
  if (wf > 0) {
    const r = flock.roost + FLUSH_OUT + jitter(flock.scatter, i, 7) * 8;
    const a = ra + (flock.loop.sense * spec.speed * since) / r;
    const fx = flock.home.x + Math.sin(a) * r;
    const fz = flock.home.z + Math.cos(a) * r;
    const fy = restY + FLUSH_HEIGHT + jitter(flock.scatter, i, 8) * 3;
    x += (fx - x) * wf;
    y += (fy - y) * wf;
    z += (fz - z) * wf;
    out.x = x;
    out.y = y;
    out.z = z;
    return { w: Math.max(w, wf), dive };
  }
  out.x = x;
  out.y = y;
  out.z = z;
  return { w, dive };
}

const here: At = { x: 0, y: 0, z: 0 };
const next: At = { x: 0, y: 0, z: 0 };

/** Wings for a bird at rest: folded on the flank, or — a cormorant's, for
 * part of every rest — held out to dry. */
function restWings(
  spec: BirdSpec,
  scatter: number,
  i: number,
  t: number,
): { flap: number; fold: number } {
  if (!spec.dries) return { flap: REST_FLAP, fold: 1 };
  const c = t / DRY_CYCLE + jitter(scatter, i, 9);
  const p = c - Math.floor(c);
  const drying = Math.min(smooth(p / 0.08), smooth((0.55 - p) / 0.1));
  return {
    flap: REST_FLAP + (DRY_FLAP - REST_FLAP) * drying,
    fold: 1 + (DRY_FOLD - 1) * drying,
  };
}

/**
 * Where bird `i` of `flock` is at time `t`, written into `out`.
 *
 * `t` is the engine's own clock (`state.t`); `activity` is `activityAt` —
 * asked once a frame rather than per bird, because it is one sun for the
 * whole coast; `waterY` is the sea under a raft's home (ignored for any
 * other kind of home); `flushedAt` is when the flock was last put up, or
 * -Infinity.
 */
export function birdPose(
  flock: Flock,
  i: number,
  t: number,
  out: BirdPose,
  activity = 1,
  waterY = 0,
  flushedAt = -Infinity,
): BirdPose {
  const spec = birdById(flock.species);
  const { w, dive } = stationAt(spec, flock, i, t, activity, waterY, flushedAt, here);
  stationAt(spec, flock, i, t + DT, activity, waterY, flushedAt, next);
  out.x = here.x;
  out.y = here.y;
  out.z = here.z;

  // ── Which way, and how steep ──────────────────────────────────────────
  const dx = next.x - here.x;
  const dz = next.z - here.z;
  const dy = next.y - here.y;
  const run = Math.hypot(dx, dz);
  let heading: number;
  if (run > 0.01) heading = Math.atan2(dx, dz);
  else heading = flock.facing + (jitter(flock.scatter, i, 10) - 0.5) * 0.7;
  let pitch = run > 0.01 || Math.abs(dy) > 0.01 ? Math.atan2(dy, Math.max(run, 1e-6)) : 0;
  const ceiling = MAX_PITCH + (DIVE_PITCH - MAX_PITCH) * dive;
  if (pitch > ceiling) pitch = ceiling;
  else if (pitch < -ceiling) pitch = -ceiling;
  // Banked into the loop only once it is properly flying it.
  const meanR = flock.loop.radius * (0.5 + 0.5 * flock.loop.ovality);
  const roll =
    w >= 1 ? -flock.loop.sense * BANK * ((spec.speed * spec.speed) / Math.max(5, meanR)) : 0;

  // ── The wings ─────────────────────────────────────────────────────────
  const rest = restWings(spec, flock.scatter, i, t);
  const phase = jitter(flock.scatter, i, 11) * TAU;
  // A slow gate that is open for the flapping share of the flight and
  // shut for the gliding share, eased so a burst starts and ends soft; on
  // the way up it is always open.
  const gateThreshold = 1 - 2 * (1 - spec.glide);
  let gate =
    spec.glide <= 0 ? 1 : smooth((Math.sin(t * 0.45 + phase) - gateThreshold + 0.15) / 0.3);
  gate = Math.max(gate, 1 - w);
  const swing = swingAt(t * spec.beatHz + phase / TAU, spec.stroke);
  const rock = spec.glide > 0.5 ? Math.sin(t * 1.3 + phase * 1.7) * 0.06 : 0;
  const flyFlap = spec.dihedral + rock * (1 - gate) + swing * gate;
  // Folded at the bottom of a plunge, and closing toward it.
  const flyFold = smooth((dive - 0.55) / 0.35);
  const open = smooth(w * 3);
  out.flap = rest.flap + (flyFlap - rest.flap) * open;
  out.fold = rest.fold + (flyFold - rest.fold) * open;
  out.airborne = w;
  out.heading = heading;
  out.pitch = pitch;
  out.roll = roll;
  const q = fromEuler(heading, pitch, roll);
  out.q.x = q.x;
  out.q.y = q.y;
  out.q.z = q.z;
  out.q.w = q.w;
  return out;
}

/** How long the slowest crossing is in the sky, s — the window a search
 * for live ones has to look back over. */
function longestCrossing(plan: BirdPlan): number {
  let slowest = Infinity;
  for (const id of plan.crossers) slowest = Math.min(slowest, birdById(id).speed * 0.95);
  return (CROSSING_LEAD + CROSSING_PAST) / slowest;
}

/** The `k`-th crossing this level's season deals, or null in a season
 * nothing crosses. A pure function of the index: the crossings before
 * t = 0 are as real as the ones after it, which is what puts birds in the
 * sky on the first frame. */
export function crossingAt(plan: BirdPlan, k: number): Crossing | null {
  if (plan.crossers.length === 0 || !Number.isFinite(plan.interval)) return null;
  const r = (channel: number): number => hash2(k, channel, plan.seed);
  const species = plan.crossers[Math.floor(r(1) * plan.crossers.length)];
  const spec = birdById(species);
  const passage = spec.passage;
  if (!passage) return null;
  const shape = passage.shapes[Math.floor(r(2) * passage.shapes.length)];
  const count = passage.birds.min + Math.floor(r(3) * (passage.birds.max - passage.birds.min + 1));
  const speed = spec.speed * (0.95 + r(7) * 0.15);
  const at = k * plan.interval + r(8) * plan.interval * 0.8;
  // Over the point of the course a rider at run pace has reached by the
  // time this crossing gets there, give or take.
  const total = plan.cum[plan.cum.length - 1];
  const along = RUN_PACE * (at + CROSSING_LEAD / speed) + (r(4) - 0.5) * OVER_SPREAD;
  const over = pointAlong(plan.path, plan.cum, Math.min(total, Math.max(0, along)));
  return {
    index: k,
    species,
    count: Math.min(count, MOST_CROSSING_BIRDS),
    shape,
    // Whether they go north or south is the season's, read off the
    // compass in `crossingBearing`; the scatter round it is this one's.
    bearing: (r(5) - 0.5) * 0.5,
    height: passage.height.min + r(6) * (passage.height.max - passage.height.min),
    speed,
    x: over.x,
    z: over.z,
    at,
    scatter: Math.floor(r(9) * 0x7fffffff) + 1,
  };
}

/** The compass bearing a crossing flies, for the season: north in spring,
 * south in autumn, plus its own scatter. */
export function crossingBearing(level: Pick<Level, "season">, crossing: Crossing): number {
  return (level.season === "spring" ? NORTH : SOUTH) + crossing.bearing;
}

/** How long a crossing is in the sky, s. */
export function crossingSeconds(crossing: Crossing): number {
  return (CROSSING_LEAD + CROSSING_PAST) / crossing.speed;
}

/** Every crossing in the sky at `t`, to `visit`. */
export function forEachCrossing(plan: BirdPlan, t: number, visit: (c: Crossing) => void): void {
  if (!Number.isFinite(plan.interval) || plan.crossers.length === 0) return;
  const from = Math.floor((t - longestCrossing(plan)) / plan.interval) - 1;
  const to = Math.floor(t / plan.interval);
  for (let k = from; k <= to; k++) {
    const c = crossingAt(plan, k);
    if (!c) continue;
    const flown = t - c.at;
    if (flown >= 0 && flown <= crossingSeconds(c)) visit(c);
  }
}

/** Where bird `i` of a crossing is at `t`, written into `out`. Straight
 * and level on its bearing, in its shape, with the wingbeat running down
 * the line as a wave rather than striking together — the detail that
 * separates a skein from a row of decorations. */
export function crossingPose(
  level: Pick<Level, "season">,
  crossing: Crossing,
  i: number,
  t: number,
  out: BirdPose,
): BirdPose {
  const spec = birdById(crossing.species);
  const bearing = crossingBearing(level, crossing);
  const dirX = Math.sin(bearing);
  const dirZ = Math.cos(bearing);
  const rightX = Math.cos(bearing);
  const rightZ = -Math.sin(bearing);
  const flown = (t - crossing.at) * crossing.speed;
  const lx = crossing.x + dirX * (flown - CROSSING_LEAD);
  const lz = crossing.z + dirZ * (flown - CROSSING_LEAD);
  const slot = formationOffset(crossing.shape, i);
  const age = t - crossing.at;
  const phase = jitter(crossing.scatter, 0, 12) * TAU;
  // The waver: the shape breathes, and the phase runs down the line so
  // the far end of a long skein is doing something different from the
  // near end.
  const wave = age * 1.1 - i * 0.55 + phase;
  const across = (slot.across + Math.sin(wave * 0.7) * 0.22) * spec.span;
  const along = (slot.along + Math.cos(wave * 0.5) * 0.2) * spec.span;
  const lift = Math.sin(age * 0.16 + phase) * 6;
  out.x = lx + rightX * across + dirX * along;
  out.z = lz + rightZ * across + dirZ * along;
  out.y = crossing.height + lift + Math.sin(wave * 0.9) * 0.7;
  out.heading = bearing;
  out.pitch = 0;
  out.roll = 0;
  const strokes = age * spec.beatHz - i * 0.13 + phase / TAU;
  // A migrating bird beats nearly the whole way; its glide share is the
  // odd held stretch, gated like a resident's.
  const gate =
    spec.glide <= 0
      ? 1
      : smooth((Math.sin(age * 0.45 + phase) - (1 - 2 * (1 - spec.glide)) + 0.15) / 0.3);
  out.flap = spec.dihedral + swingAt(strokes, spec.stroke) * gate;
  out.fold = 0;
  out.airborne = 1;
  const q = fromEuler(bearing, 0, 0);
  out.q.x = q.x;
  out.q.y = q.y;
  out.q.z = q.z;
  out.q.w = q.w;
  return out;
}

/** How many resident birds a plan holds of a species — an instance budget. */
export function residentCount(plan: BirdPlan, id: BirdId): number {
  let n = 0;
  for (const f of plan.flocks) if (f.species === id) n += f.count;
  return n;
}

/** The most birds of a species that can be CROSSING at once: how many
 * crossings overlap, times the biggest. Zero for a bird that never does. */
export function crossingCapacity(plan: BirdPlan, id: BirdId): number {
  if (!plan.crossers.includes(id) || !Number.isFinite(plan.interval)) return 0;
  const overlap = Math.ceil(longestCrossing(plan) / plan.interval) + 2;
  return overlap * Math.min(MOST_CROSSING_BIRDS, birdById(id).passage?.birds.max ?? 0);
}
