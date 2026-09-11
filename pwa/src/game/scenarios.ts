// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STAGED MOMENTS — the named situations a screenshot, a lab or a test
// stands the craft in instead of riding to them. Each is a `RunMoment`
// built against the level (the first ramp, the first ring, two hundred
// metres out) and a SCRIPT: the input the craft is given for the seconds
// that follow, as a function of the seconds since it was stood there. The
// app reads `?scene=` off the URL and `stageScenario` does the rest; the
// ride lab and the screenshot tool use the same names, so a picture and a
// strip of numbers are of the same moment.
//
// DOM-free: nothing here draws. A scenario is a description, and the
// engine's `placeRun` is what stands the craft in it; the moment itself —
// the landing, the dive, the flip — is still the engine's to emit on the
// steps that follow.

import {
  NEUTRAL_INPUT,
  cumulative,
  faunaById,
  faunaPose,
  fieldGradient,
  freshPose,
  isMale,
  launchSpeedFor,
  oceanOut,
  placeRun,
  pointAlong,
  topSpeedOf,
  type CraftInput,
  type FaunaId,
  type Gate,
  type GameState,
  type Level,
  type Pod,
  type RunMoment,
  sampleField,
  TUNING,
} from "@engine";

import { FLUSH_SECONDS, birdPose, freshBirdPose, planBirds, type Flock } from "./bird-plan.ts";
import { clamp } from "../lib/util.ts";

export type ScenarioName =
  | "rest"
  | "cruise"
  | "carve"
  | "brake"
  | "chop"
  | "swell"
  | "launch"
  | "apex"
  | "landing"
  | "dive"
  | "capsize"
  | "offshore"
  | "storm"
  | "ocean"
  | "backflip"
  | "wildlife"
  | "breach"
  | "birds"
  | "mark"
  | "gate"
  | "river";

export const SCENARIO_NAMES: readonly ScenarioName[] = [
  "rest",
  "cruise",
  "carve",
  "brake",
  "chop",
  "swell",
  "launch",
  "apex",
  "landing",
  "dive",
  "capsize",
  "offshore",
  "storm",
  "ocean",
  "backflip",
  "wildlife",
  "breach",
  "birds",
  "mark",
  "gate",
  "river",
];

export function isScenarioName(name: string): name is ScenarioName {
  return (SCENARIO_NAMES as readonly string[]).includes(name);
}

export type Scenario = {
  moment: RunMoment;
  /** The input `t` seconds after the craft was stood there. */
  script: (t: number) => CraftInput;
  /** How long the script is worth watching, s — the lab's strip length and
   * the app's hand-over to the player. */
  seconds: number;
};

const NEUTRAL = NEUTRAL_INPUT;

function input(steer: number, throttle: number, lean: number): CraftInput {
  return { steer, throttle, reverse: 0, lean, reset: false };
}

/** ...and the same with the BRAKE LEVER pulled instead of the throttle:
 * the bucket dropping over the jet. The throttle is shut, because the
 * bucket asks the engine for the flow it needs on its own. */
function braking(steer: number, reverse: number): CraftInput {
  return { steer, throttle: 0, reverse, lean: 0, reset: false };
}

/** THE CAPSIZE: how far over the hull is stood, rad, and how fast it is
 * still going, rad/s — past a right angle and rolling, so the first steps
 * put it on its back and the engine's rule (`TUNING.capsize`) takes over
 * from there: the sheet off the side it comes down on, the boil round a
 * hull on its back, and the rider righting it a second and a half later.
 * The speed is a crawl's: a hull goes over in a turn it has already
 * scrubbed off, not on the plane. */
const CAPSIZE_ROLL = 1.75;
const CAPSIZE_ROLL_RATE = 3;
const CAPSIZE_SPEED = 4;

/** The unit vector pointing out to sea at a plan point — up the `offshore`
 * distance field. */
export function seawardAt(level: Level, x: number, z: number): { x: number; z: number } {
  const { gx, gz } = fieldGradient(level.offshore, x, z);
  const n = Math.hypot(gx, gz);
  if (n < 1e-6) return { x: 0, z: 1 };
  return { x: gx / n, z: gz / n };
}

/**
 * A point `metres` out to sea of (x, z) — or as far out as the water goes,
 * whichever comes first.
 *
 * A level is a BASIN now (R15): a channel has a far bank, and forty metres
 * seaward of a gate in one is dry land. Every staged moment that wanted
 * "further out" wants the water further out, so the walk follows the
 * offshore gradient step by step and stops where the water stops getting
 * deeper — which on the open coast is the full distance and in a channel is
 * the middle of it.
 */
/** Straight on along `sea` from (x, z) until the level's rim is astern and
 * the storm stands in full — `TUNING.sea.open.reach` metres of open ocean
 * past the last cell of the grid (`engine/game/ocean.ts`). Nothing is
 * sampled on the way: past the rim there is no field left to read, which is
 * the whole point of the place. */
function outPastTheRim(
  level: Level,
  x: number,
  z: number,
  sea: { x: number; z: number },
): { x: number; z: number } {
  const STEP = 20;
  let at = { x, z };
  for (let d = 0; d < 20_000; d += STEP) {
    if (oceanOut(level.bounds, at.x, at.z) > 0) break;
    at = { x: at.x + sea.x * STEP, z: at.z + sea.z * STEP };
  }
  const past = TUNING.sea.open.reach;
  return { x: at.x + sea.x * past, z: at.z + sea.z * past };
}

function outToSea(level: Level, x: number, z: number, metres: number): { x: number; z: number } {
  const STEP = 4;
  let at = { x, z };
  let best = sampleField(level.offshore, x, z);
  for (let d = STEP; d <= metres; d += STEP) {
    const sea = seawardAt(level, at.x, at.z);
    const next = { x: at.x + sea.x * STEP, z: at.z + sea.z * STEP };
    const off = sampleField(level.offshore, next.x, next.z);
    if (off < best) break;
    best = off;
    at = next;
  }
  return at;
}

/** The first air gate, or null for a course without one. */
export function firstAirGate(level: Level): Gate | null {
  return level.course.gates.find((g) => g.kind === "air" && g.ramp) ?? null;
}

/** A moment at a gate's centre, on its heading. */
function atGate(gate: Gate, extra: Partial<RunMoment> = {}): RunMoment {
  return { x: gate.x, z: gate.z, heading: gate.heading, nextGate: gate.index, ...extra };
}

/** The moment at a point `metres` before a ramp's hinge along its axis. */
function beforeRamp(gate: Gate, metres: number, extra: Partial<RunMoment> = {}): RunMoment {
  const r = gate.ramp;
  if (!r) return atGate(gate, extra);
  return {
    x: r.x - Math.sin(r.heading) * metres,
    z: r.z - Math.cos(r.heading) * metres,
    heading: r.heading,
    nextGate: gate.index,
    ...extra,
  };
}

/** A moment `metres` past a ring along its axis, at a height. */
function pastGate(gate: Gate, metres: number, extra: Partial<RunMoment> = {}): RunMoment {
  return {
    x: gate.x + Math.sin(gate.heading) * metres,
    z: gate.z + Math.cos(gate.heading) * metres,
    heading: gate.heading,
    nextGate: gate.index + 1,
    ...extra,
  };
}

/** The mid-course gate — the one furthest into the level, where the shore
 * has settled into its character. */
function midGate(level: Level): Gate {
  const gates = level.course.gates;
  return gates[Math.floor(gates.length / 2)];
}

/** The RAREST pod on a level — the one the `wildlife` scenario is about.
 * Rarity is the catalog's `perKm` and nothing else, so the shot is of
 * whatever that seed was lucky enough to carry: a minke if it has one, a
 * school of herring if that is all there is. */
export function rarestPod(level: Level): Pod | null {
  let best: Pod | null = null;
  let rarest = Infinity;
  for (const pod of level.fauna) {
    const perKm = faunaById(pod.species).perKm;
    if (perKm < rarest) {
      rarest = perKm;
      best = pod;
    }
  }
  return best;
}

/** How far ahead of the pod's leader the wildlife shot stands, m. Close,
 * and for a reason a wider shot hides: the chase camera looks along the
 * water rather than down at it, so an animal at eight metres of depth
 * leaves the bottom of the frame by about twenty metres out. What can be
 * seen under the surface is what is nearly under the hull. */
const WILDLIFE_STANDOFF = 12;

/** And how far off its track, m. The chase camera puts the rider's back in
 * the middle of the picture, so an animal dead ahead surfaces behind his
 * shoulders; a few metres to one side is the difference between a shot of
 * a whale and a shot of a man. */
const WILDLIFE_SIDE = 5;

/** Where the BREACH shot stands relative to the leaping animal, m —
 * ABEAM of its track and a little behind it, not on the track looking
 * back down it. A breach is an ARC, and an arc seen end-on is a dot: a
 * dolphin flying straight at the camera shows its cross-section and
 * nothing else, which is a shot of a grey blob two metres over the water.
 * Further out than the wildlife shot, too, because a breaching bull is
 * ABOVE the water rather than under it — seeing into the sea does not
 * limit the range, the frame does, and an animal clearing two metres of
 * air needs room over its head. */
const BREACH_ABEAM = 14;
const BREACH_BEHIND = 4;
/** And how far the aim is swung off the animal, rad. The chase camera
 * puts the rider's back in the middle of the picture, so anything the
 * craft is pointed straight at leaps behind his shoulders. */
const BREACH_AIM = 0.2;

/** How long the breach is worth watching once it has been stood at its
 * apex, s — the fall, the splash, and the water closing over it. */
const BREACH_WATCH = 2.5;

/** How often an animal's own cycle repeats, s — the window a shot of it at
 * its highest has to search, and 0 for one that never comes up. */
function surfaceCycle(id: FaunaId): number {
  const spec = faunaById(id);
  return spec.breach > 0 ? spec.breach : spec.breath > 0 ? spec.breath : spec.bask;
}

/** When animal `i` of `pod` is at its highest in the `span` seconds after
 * `from`. Found by SEARCHING `faunaPose` rather than by re-deriving the
 * arc: the swim model owns when an animal is where, and a second copy of
 * its timing here is a copy that would go quietly wrong the day the rise
 * or the leap is retuned. The step is fine enough to land inside the
 * second or so an animal spends at the top of either. */
function highest(pod: Pod, i: number, from: number, span: number): number {
  let best = -Infinity;
  let at = from;
  const pose = freshPose();
  for (let t = from; t < from + span; t += 0.05) {
    const y = faunaPose(pod, i, t, pose).y;
    if (y > best) {
      best = y;
      at = t;
    }
  }
  return at;
}

/** How far up its own leap a breach is photographed, as a share of the
 * apex. NOT the apex itself: at the top of a ballistic arc the vertical
 * speed is zero, so the animal is level, and a level dolphin two metres
 * over a flat sea reads as one HOVERING. Half way up it is still climbing
 * at half its launch speed, which the pose turns into fifty-odd degrees of
 * nose — the attitude that says leap. */
const BREACH_UP = 0.5;

/** Walking back from an apex the search found: the moment on the way UP at
 * which the animal was `share` of the way to it. */
function climbing(pod: Pod, i: number, apexAt: number, apexY: number, share: number): number {
  const pose = freshPose();
  const want = apexY * share;
  let t = apexAt;
  while (t > apexAt - 4 && faunaPose(pod, i, t, pose).y > want) t -= 0.02;
  return t;
}

/** The soonest breach after `from` on this level, and the moment part way
 * up it that a still of it wants. */
function nextBreach(level: Level, from: number): { pod: Pod; index: number; at: number } | null {
  let best: { pod: Pod; index: number; at: number } | null = null;
  const pose = freshPose();
  for (const pod of level.fauna) {
    const spec = faunaById(pod.species);
    if (spec.breach <= 0) continue;
    for (let i = 0; i < pod.count; i++) {
      if (!isMale(pod, i)) continue;
      const apexAt = highest(pod, i, from, spec.breach);
      if (best && apexAt >= best.at) continue;
      const apexY = faunaPose(pod, i, apexAt, pose).y;
      best = { pod, index: i, at: climbing(pod, i, apexAt, apexY, BREACH_UP) };
    }
  }
  return best;
}

/** How far off a RAFT the birds shot is stood, m, and how fast it rides at
 * it: close enough that the seconds that follow carry the hull into the
 * raft's flush radius and put the birds up, which is the one moment they
 * answer to the craft. A rock's flock does not flush, so a shot of one
 * stands nearer and still, at a moment the flock is wheeling over it. */
const BIRDS_RUN_IN = 48;
const BIRDS_STANDOFF = 28;

/** The flock the birds shot is about: a raft on the water if the coast has
 * one, since a raft is the thing that gets up for a hull; otherwise the
 * first flock there is. */
export function shotFlock(level: Level): Flock | null {
  const plan = planBirds(level);
  return plan.flocks.find((f) => f.home.kind === "water") ?? plan.flocks[0] ?? null;
}

/** The soonest moment after `from` the flock's leader is where the shot
 * wants it — sitting, for a raft about to be put up; flying, for a flock
 * on a rock — found by searching the model rather than restating its
 * cycle. */
function flockMoment(flock: Flock, from: number, sitting: boolean): number {
  const pose = freshBirdPose();
  for (let t = from; t < from + flock.cycle * 1.5; t += 0.25) {
    const air = birdPose(flock, 0, t, pose).airborne;
    if (
      sitting ? air === 0 && birdPose(flock, 0, t + FLUSH_SECONDS, pose).airborne === 0 : air === 1
    ) {
      return t;
    }
  }
  return from;
}

/** How far back down the racing line the MARK shot stands from the
 * rounding, m. Far enough that the rock is a thing on the water ahead
 * rather than a wall filling the frame, and near enough that a rider would
 * already be lining the turn up. */
const MARK_STANDOFF = 150;
/** R31 — and how far back a BUOY is judged from, m. A sea stack is thirty
 * metres of rock and reads as a landmark from a hundred and fifty; a
 * rounding buoy is two metres across and the question about it is what a
 * rider sees on the approach to the corner, which is a few boat lengths
 * out. */
const BUOY_STANDOFF = 42;

/** How far back from a water gate's line the approach shot is stood, m —
 * far enough that both marks of the pair and the water between them are in
 * one frame, close enough that a mark is a thing with a lantern on it
 * rather than a dot. */
const GATE_STANDOFF = 26;

/** How far up the RIVER its shot stands, as a share of the water's own
 * length. A third of the way: past the mouth, where the channel has closed
 * to something narrower than the race was ridden in, and still wide enough
 * to be riding on. */
const RIVER_UP = 0.34;

/** How far before the ramp the launch stands: the run-up the rules
 * guarantee straight and clear (R9), so the craft is at speed and settled
 * when it meets the hinge. */
export const LAUNCH_RUN_UP = 60;

/** Build a scenario against a state's level and craft. */
export function scenarioFor(state: GameState, name: ScenarioName): Scenario {
  const level = state.level;
  const spec = state.craft.spec;
  const top = topSpeedOf(spec);
  const start = level.start;
  const air = firstAirGate(level);
  const mid = midGate(level);
  switch (name) {
    case "rest":
      return {
        moment: { x: start.x, z: start.z, heading: start.heading },
        script: () => NEUTRAL,
        seconds: 2,
      };
    case "cruise":
      return {
        moment: { x: start.x, z: start.z, heading: start.heading, speed: top * 0.45 },
        script: () => input(0, 0.6, 0),
        seconds: 5,
      };
    case "carve": {
      // Wound on hard on the pump: the hull banks in and the stern comes
      // round, which is the shot — and the whole reason there is a game.
      return {
        moment: { x: start.x, z: start.z, heading: start.heading, speed: top * 0.7 },
        script: (t) => input(t < 0.4 ? t / 0.4 : 1, 1, 0),
        seconds: 4,
      };
    }
    case "brake": {
      // Flat out, then the BRAKE LEVER: the bucket swings down over the
      // jet, the bow goes under and the craft stops — or, on the stand-up,
      // it does not, because a stand-up carries no bucket at all. Held on
      // past the stop, so the last seconds are the craft backing up.
      return {
        moment: { x: start.x, z: start.z, heading: start.heading, speed: top * 0.8 },
        script: (t) => (t < 0.6 ? input(0, 1, 0) : braking(0, 1)),
        seconds: 9,
      };
    }
    case "chop": {
      // Flat out INTO the wind, off the course: the chop meets the bow
      // head on and the hull skips over it.
      const at = outToSea(level, mid.x, mid.z, 40);
      return {
        moment: {
          x: at.x,
          z: at.z,
          heading: level.wind.from,
          speed: top * 0.8,
          nextGate: mid.index,
        },
        script: () => input(0, 1, 0.1),
        seconds: 4,
      };
    }
    case "swell": {
      // Well out, idling across the swell: the water is the subject.
      const at = outToSea(level, mid.x, mid.z, 140);
      return {
        moment: {
          x: at.x,
          z: at.z,
          heading: level.wind.from + Math.PI / 2,
          speed: 5,
          nextGate: mid.index,
        },
        script: () => input(0, 0.3, 0),
        seconds: 6,
      };
    }
    case "launch": {
      if (!air) return scenarioFor(state, "cruise");
      const speed = launchSpeedFor(air, spec.cog.y, top);
      return {
        moment: beforeRamp(air, LAUNCH_RUN_UP, { speed }),
        // HOLDING the speed the ring asks for up the run-up, a lean back as
        // the deck is met so the nose comes up off the lip, level in the
        // air. The throttle is that speed as a share of what this craft
        // could do — flat out when the ring wants everything the hull has,
        // which is what it wanted before there was a SPEED CLASS, and less
        // once the class has made the hull faster than the ramp needs.
        // Riding this one flat out at a high class simply sails the ring.
        script: (t) => input(0, clamp(speed / top, 0.2, 1), t > 1.6 && t < 2.8 ? 0.5 : 0),
        seconds: 5,
      };
    }
    case "apex": {
      if (!air) return scenarioFor(state, "cruise");
      return {
        moment: atGate(air, {
          speed: launchSpeedFor(air, spec.cog.y, top) * 0.9,
          height: air.y,
          vy: 0,
          pitch: 0.28,
        }),
        script: () => input(0, 1, 0),
        seconds: 3,
      };
    }
    case "landing": {
      if (!air) return scenarioFor(state, "cruise");
      return {
        moment: pastGate(air, 6, { speed: top * 0.6, height: 1.6, vy: -4, pitch: 0.1 }),
        script: () => input(0, 1, 0.2),
        seconds: 3,
      };
    }
    case "dive": {
      // Nose down into the water past the ring, fast and from a height,
      // the rider still forward: the bow buries and the hull stops — the
      // landing every rider learns to avoid.
      if (!air) return scenarioFor(state, "cruise");
      return {
        moment: pastGate(air, 4, { speed: top * 0.9, height: 3, pitch: -0.45 }),
        script: () => input(0, 0, -1),
        seconds: 3,
      };
    }
    case "capsize": {
      // Going over, at the start, with nothing on the throttle: the hull is
      // past vertical and still rolling, and everything after — the side
      // coming down, the wait on its back, the righting — is the engine's.
      return {
        moment: {
          x: start.x,
          z: start.z,
          heading: start.heading,
          speed: CAPSIZE_SPEED,
          roll: CAPSIZE_ROLL,
          rollRate: CAPSIZE_ROLL_RATE,
        },
        script: () => NEUTRAL,
        seconds: 4,
      };
    }
    case "offshore": {
      const at = outToSea(level, mid.x, mid.z, 200);
      const sea = seawardAt(level, at.x, at.z);
      return {
        moment: {
          x: at.x,
          z: at.z,
          heading: Math.atan2(sea.x, sea.z) + Math.PI / 2,
          speed: top * 0.6,
          nextGate: mid.index,
        },
        script: () => input(0, 0.8, 0),
        seconds: 5,
      };
    }
    case "storm": {
      // THE OPEN SEA, as far out as the basin has, beam-on to a monster swell.
      // A wave only stands its full height in water it cannot feel the
      // bottom of — the field is clipped to `breakingHs`·d — so a sea
      // quoted at twenty metres is a nine-metre one over the course's
      // twenty-five and its whole self out here, where R3's bed has
      // fallen past forty. Ride it with `?hs=20`.
      // As far out as the level HAS, up to half a kilometre: the walk
      // follows the water and stops where it stops deepening, so a basin
      // whose open sea runs out sooner stages in the deepest it owns.
      const at = outToSea(level, mid.x, mid.z, 360);
      const sea = seawardAt(level, at.x, at.z);
      return {
        moment: {
          x: at.x,
          z: at.z,
          heading: Math.atan2(sea.x, sea.z) + Math.PI / 2,
          speed: top * 0.35,
          nextGate: mid.index,
        },
        script: () => input(0, 0.5, 0),
        seconds: 8,
      };
    }
    case "ocean": {
      // PAST THE EDGE OF THE LEVEL, in the full storm — the one staged
      // moment that stands OUTSIDE the bounds on purpose
      // (`engine/game/ocean.ts`). Everything out here is analytic: there is
      // no grid left to follow, so the walk holds the seaward heading it
      // left the coast on and carries straight on until the storm stands in
      // full. Beam-on, at a crawl, because a rider who
      // gets out here is not racing any more — he is being carried up one
      // face and dropped down the next.
      const at = outToSea(level, mid.x, mid.z, 600);
      const sea = seawardAt(level, at.x, at.z);
      const out = outPastTheRim(level, at.x, at.z, sea);
      return {
        moment: {
          x: out.x,
          z: out.z,
          heading: Math.atan2(sea.x, sea.z) + Math.PI / 2,
          speed: top * 0.3,
          nextGate: mid.index,
        },
        script: () => input(0, 0.4, 0),
        seconds: 10,
      };
    }
    case "wildlife": {
      // Stopped in the water AHEAD of the rarest thing on the coast and
      // turned to face it, so the pod comes on toward the bow. Ahead
      // rather than behind because a pod trails: the rest of a formation
      // lies back of its leader, and standing behind the leader is
      // standing on top of the second animal.
      const pod = rarestPod(level);
      if (!pod) return scenarioFor(state, "swell");
      // At the top of the leader's own rise, when the species has one: a
      // sighting is a back and a fin through the water, and a shot taken
      // at whatever second the clock happened to be at photographs an
      // animal holding at depth most of the time.
      const cycle = surfaceCycle(pod.species);
      const at = cycle > 0 ? highest(pod, 0, state.t, cycle) : state.t;
      const lead = faunaPose(pod, 0, at, freshPose());
      return {
        moment: {
          x:
            lead.x +
            Math.sin(lead.heading) * WILDLIFE_STANDOFF +
            Math.cos(lead.heading) * WILDLIFE_SIDE,
          z:
            lead.z +
            Math.cos(lead.heading) * WILDLIFE_STANDOFF -
            Math.sin(lead.heading) * WILDLIFE_SIDE,
          heading: lead.heading + Math.PI,
          nextGate: mid.index,
          clock: at,
        },
        // Stopped, and held there: a pod swims a curve and the craft can
        // only go straight, so any pace at all is a pace that loses it.
        script: () => NEUTRAL,
        seconds: 2,
      };
    }
    case "breach": {
      // THE SIGHTING: a bull dolphin clear of the water, which is the one
      // moment this game shows an animal against the sky. The scene is
      // staged in TIME as much as in space — the shot is the apex of a leap
      // that happens once a minute per bull, so the scenario stands the
      // craft where the animal will be when it gets there and hands back
      // the wait as the script's length.
      const leap = nextBreach(level, state.t);
      if (!leap) return scenarioFor(state, "wildlife");
      const bull = faunaPose(leap.pod, leap.index, leap.at, freshPose());
      const ahead = Math.sin(bull.heading);
      const acrossZ = Math.cos(bull.heading);
      const bx = bull.x + acrossZ * BREACH_ABEAM - ahead * BREACH_BEHIND;
      const bz = bull.z - ahead * BREACH_ABEAM - acrossZ * BREACH_BEHIND;
      return {
        moment: {
          x: bx,
          z: bz,
          heading: Math.atan2(bull.x - bx, bull.z - bz) + BREACH_AIM,
          nextGate: mid.index,
          // The world's clock is wound to the leap rather than the craft
          // being left to wait for it: a hull holding station for half a
          // minute of sea is a hull the wind has carried out of its own
          // shot, and a still is taken where the run is STOOD, not where
          // its script ends.
          clock: leap.at,
        },
        // Held still: the animal is the thing moving, and a craft under way
        // would have left the frame before the leap.
        script: () => NEUTRAL,
        seconds: BREACH_WATCH,
      };
    }
    case "birds": {
      // THE FLUSH: a raft of birds on the water ahead, and the craft run
      // at it so the seconds that follow put the whole raft up off the sea
      // in front of the bow. Stood on the course's side of the raft,
      // pointed at it, at the moment the birds are sitting; a coast with no
      // raft stands off its first flock's rock while the flock is wheeling.
      const flock = shotFlock(level);
      if (!flock) return scenarioFor(state, "swell");
      const raft = flock.home.kind === "water";
      const home = flock.home;
      let nearest = level.course.path[0];
      let best = Infinity;
      for (const p of level.course.path) {
        const d = Math.hypot(p.x - home.x, p.z - home.z);
        if (d < best) {
          best = d;
          nearest = p;
        }
      }
      const toPath = Math.atan2(nearest.x - home.x, nearest.z - home.z);
      const off = raft ? BIRDS_RUN_IN : BIRDS_STANDOFF;
      // Stood off the flock on OPEN WATER with a clear run in: a raft sits
      // in the lee of a rock, so a point a boat length up the beach from
      // it is a craft stood on the shore, and a line drawn straight at it
      // from the racing line is a craft that hits the skerry on the way.
      // The line's side is tried first, then the raft's open side (away
      // from the nearest rock), then bearings either way; the standoff is
      // walked out until the water is deep and the whole run in is clear
      // of every solid. The line's own nearest point is the fallback.
      let rock: { x: number; z: number } | null = null;
      let rockD = Infinity;
      for (const s of level.solids) {
        const d = Math.hypot(s.x - home.x, s.z - home.z);
        if (d < rockD) {
          rockD = d;
          rock = s;
        }
      }
      const open = rock ? Math.atan2(home.x - rock.x, home.z - rock.z) : toPath;
      const clear = (x: number, z: number): boolean =>
        sampleField(level.offshore, x, z) > 6 && sampleField(level.ground, x, z) < -1.5;
      const runIn = (x: number, z: number): boolean => {
        const d = Math.hypot(home.x - x, home.z - z);
        for (let k = 0; k <= d; k += 3) {
          const px = x + ((home.x - x) * k) / d;
          const pz = z + ((home.z - z) * k) / d;
          if (!clear(px, pz)) return false;
          for (const s of level.solids) {
            if (Math.hypot(s.x - px, s.z - pz) < s.r + 4) return false;
          }
        }
        return true;
      };
      let at = { x: nearest.x, z: nearest.z };
      search: for (const bearing of [
        toPath,
        open,
        toPath + 0.7,
        toPath - 0.7,
        toPath + 1.4,
        toPath - 1.4,
      ]) {
        for (let d = off; d < off + 40; d += 4) {
          const x = home.x + Math.sin(bearing) * d;
          const z = home.z + Math.cos(bearing) * d;
          if (runIn(x, z)) {
            at = { x, z };
            break search;
          }
        }
      }
      return {
        moment: {
          x: at.x,
          z: at.z,
          heading: Math.atan2(home.x - at.x, home.z - at.z),
          speed: raft ? top * 0.45 : 0,
          nextGate: mid.index,
          clock: flockMoment(flock, state.t, raft),
        },
        script: () => (raft ? input(0, 0.7, 0) : NEUTRAL),
        seconds: raft ? 4 : 2,
      };
    }
    case "mark": {
      // R25, R31 — the approach to THE THING THE LINE GOES ROUND: standing
      // on the racing line where the run out to the rounding begins,
      // pointed at it. On a coast level that is the sea stack at the end of
      // the ocean leg, the one thing in a level taller than the land behind
      // it; on a circuit it is the lit BUOY furthest out to sea, which is
      // the far end of the run out and back. The question the shot asks is
      // the same either way — does the mark read from the water as
      // something to steer at — and on a circuit it is also the only way to
      // see whether a lantern reads at range, which is what a night run is
      // ridden by.
      const rock =
        level.solids.find((s) => s.kind === "mark") ??
        level.solids
          .filter((s) => s.kind === "buoy")
          .sort(
            (a, b) => sampleField(level.offshore, b.x, b.z) - sampleField(level.offshore, a.x, a.z),
          )[0];
      if (!rock) return scenarioFor(state, "offshore");
      const path = level.course.path;
      const cum = cumulative(path);
      let at = 0;
      let nearest = Infinity;
      for (let i = 0; i < path.length; i++) {
        const d = Math.hypot(path[i].x - rock.x, path[i].z - rock.z);
        if (d < nearest) {
          nearest = d;
          at = cum[i];
        }
      }
      // Backed off along the line until the MARK ITSELF is a standoff away,
      // rather than until the line has run that far: a buoy stands at the
      // centre of the bend it is rounded at, so a station measured along the
      // path can be a hundred metres from the thing the shot is of.
      const standoff = rock.kind === "buoy" ? BUOY_STANDOFF : MARK_STANDOFF;
      let back = at;
      for (let step = 0; step < 60; step++) {
        const p = pointAlong(path, cum, Math.max(0, back));
        if (Math.hypot(p.x - rock.x, p.z - rock.z) >= standoff) break;
        back -= 5;
        if (back <= 0) break;
      }
      const from = pointAlong(path, cum, Math.max(0, back));
      return {
        moment: {
          x: from.x,
          z: from.z,
          heading: Math.atan2(rock.x - from.x, rock.z - from.z),
          speed: top * 0.55,
          nextGate: mid.index,
        },
        script: () => input(0, 0.7, 0),
        seconds: 4,
      };
    }
    case "gate": {
      // THE CHECKPOINT ITSELF: stood on the approach to a water gate, a
      // standoff back and pointed straight between its two marks, with a
      // pair already crossed astern. The questions are whether a mark
      // reads from the saddle as something MOORED and lit — its shape
      // against the water at gate range — and, after dark, whether the
      // lantern and the pool it throws say which gates are still owed.
      const water = level.course.gates.filter((g) => g.kind === "water");
      const gate = water[Math.min(1, water.length - 1)];
      if (!gate) return scenarioFor(state, "cruise");
      return {
        moment: {
          x: gate.x - Math.sin(gate.heading) * GATE_STANDOFF,
          z: gate.z - Math.cos(gate.heading) * GATE_STANDOFF,
          heading: gate.heading,
          speed: top * 0.45,
          nextGate: gate.index,
        },
        script: () => input(0, 0.6, 0),
        seconds: 4,
      };
    }
    case "river": {
      // R26 — a way up the RIVER, looking further up it: the water
      // narrowing between its banks, with the country closing in. What
      // the shot is for is whether the level still looks like a place
      // this far from the race.
      const river = level.river;
      if (river.length < 4) return scenarioFor(state, "cruise");
      const cum = cumulative(river);
      const up = pointAlong(river, cum, cum[cum.length - 1] * RIVER_UP);
      const ahead = pointAlong(river, cum, cum[cum.length - 1] * RIVER_UP + 40);
      return {
        moment: {
          x: up.x,
          z: up.z,
          heading: Math.atan2(ahead.x - up.x, ahead.z - up.z),
          speed: top * 0.25,
        },
        script: () => input(0, 0.4, 0),
        seconds: 4,
      };
    }
    case "backflip": {
      // Off the lip already rotating, the rider hauled back: a full
      // rotation is reachable from the biggest ramp with the lean held.
      if (!air) return scenarioFor(state, "cruise");
      const lip = air.ramp ? air.ramp.length * Math.tan(air.ramp.angle) : 2;
      return {
        moment: beforeRamp(air, -(air.ramp?.length ?? 8), {
          speed: launchSpeedFor(air, spec.cog.y, top),
          height: lip + spec.cog.y + 0.5,
          vy: 5.5,
          pitch: 0.6,
          pitchRate: 3,
        }),
        script: () => input(0, 1, 1),
        seconds: 3,
      };
    }
  }
}

/** Stand a run in a scenario and hand back the script to ride it with. */
export function stageScenario(state: GameState, name: ScenarioName): Scenario {
  const scenario = scenarioFor(state, name);
  placeRun(state, scenario.moment);
  return scenario;
}
