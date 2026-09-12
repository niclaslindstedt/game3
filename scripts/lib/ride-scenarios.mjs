// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RIDE LAB'S SCENARIOS — a moment to stand the craft at (`placeRun`)
// and a scripted input to ride it with, each against a level the
// generator built from a seed. The lab steps the real engine from there;
// nothing here is physics, only where to start and what the thumb does.
//
// The browser has its own list (`pwa/src/game/scenarios.ts`, the PWA's
// staged moments for screenshots) written separately and against the
// same `RunMoment` shape. The two may drift, and for now that is
// accepted: this file is what `make ride` draws, that one is what
// `make screenshots` photographs, and a scenario that should be in both
// is added to both by hand.

import { TUNING, oceanOut, onRampDeck, sampleField, topSpeedOf } from "../../engine/index.ts";
// The hinge speed a ring asks for is the bot's arithmetic; not on the
// engine's public surface yet, so it is read from the module that owns it.
import { launchSpeedFor } from "../../engine/sim/bot.ts";

const NEUTRAL = { steer: 0, throttle: 0, reverse: 0, lean: 0, crouch: 0, reset: false };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** The first air gate of a level, with its ramp. */
function firstAirGate(level) {
  const gate = level.course.gates.find((g) => g.kind === "air" && g.ramp);
  if (!gate) throw new Error(`seed ${level.seed} has no air gate to stage a ramp on`);
  return gate;
}

/** The point of the course path furthest from the shore, and the path's
 * heading there — where the sea is biggest. */
function outerPoint(level) {
  const path = level.course.path;
  let best = -Infinity;
  let at = 0;
  for (let i = 0; i < path.length; i++) {
    const off = sampleField(level.offshore, path[i].x, path[i].z);
    if (off > best) {
      best = off;
      at = i;
    }
  }
  const a = path[Math.max(0, at - 1)];
  const b = path[Math.min(path.length - 1, at + 1)];
  return {
    x: path[at].x,
    z: path[at].z,
    heading: Math.atan2(b.x - a.x, b.z - a.z),
    offshore: best,
  };
}

/** Where a ramp run starts: `lead` metres before the hinge on its axis. */
function rampApproach(gate, lead) {
  const r = gate.ramp;
  return {
    x: r.x - Math.sin(r.heading) * lead,
    z: r.z - Math.cos(r.heading) * lead,
    heading: r.heading,
  };
}

/** The rider levelling the hull in the air for the landing — the input a
 * thumb gives, so a scenario's flight ends the way a ridden one does. */
function levelInAir(c, target = 0.08) {
  const pitchRate = -c.wx;
  return clamp((target - c.pitch) * 2.5 - pitchRate * 0.9, -1, 1);
}

/** A ramp run: flat out to the hinge, lean back on the deck, level in the
 * air (or hold the lean, for a flip), then ride on. */
function rampRun(gate, spec, { holdLean = false, lead = 45 }) {
  const speed = launchSpeedFor(gate, spec.cog.y, topSpeedOf(spec));
  return {
    moment: { ...rampApproach(gate, lead), speed, nextGate: gate.index },
    input: (t, state) => {
      const c = state.craft;
      if (c.airborne)
        return { ...NEUTRAL, throttle: 1, reverse: 0, lean: holdLean ? 1 : levelInAir(c) };
      if (c.onRamp || onRampDeck(gate.ramp, c.x, c.z))
        return { ...NEUTRAL, throttle: 1, reverse: 0, lean: 1 };
      return { ...NEUTRAL, throttle: 1 };
    },
  };
}

/** In the air over the ring: at its height, at the pace the ramp gives,
 * with the attitude the scenario asks for. */
function overRing(gate, spec, { pitch, vy, lean }) {
  const speed = launchSpeedFor(gate, spec.cog.y, topSpeedOf(spec)) * 0.9;
  return {
    moment: {
      x: gate.x,
      z: gate.z,
      heading: gate.heading,
      speed,
      height: gate.y,
      vy,
      pitch,
      nextGate: gate.index,
    },
    input: (t, state) => {
      const c = state.craft;
      if (c.airborne) return { ...NEUTRAL, throttle: 1, reverse: 0, lean: lean ?? levelInAir(c) };
      return { ...NEUTRAL, throttle: 1 };
    },
  };
}

/**
 * Each scenario: a blurb, how long to ride, whether the plan view is worth
 * drawing, and `stage(level, spec)` → `{ moment, input(t, state) }`.
 */
export const SCENARIOS = {
  rest: {
    blurb: "at the start, nothing touched: the hull settling at its draft",
    seconds: 6,
    stage: (level) => ({
      moment: { x: level.start.x, z: level.start.z, heading: level.start.heading },
      input: () => NEUTRAL,
    }),
  },
  jet: {
    blurb: "the throttle opened from a dead stop: the jet before the trail",
    seconds: 4,
    stage: (level) => ({
      moment: { x: level.start.x, z: level.start.z, heading: level.start.heading },
      input: () => ({ ...NEUTRAL, throttle: 1 }),
    }),
  },
  cruise: {
    blurb: "flat out down the straight from the start",
    seconds: 8,
    stage: (level) => ({
      moment: { x: level.start.x, z: level.start.z, heading: level.start.heading, speed: 12 },
      input: () => ({ ...NEUTRAL, throttle: 1 }),
    }),
  },
  tuck: {
    blurb: "flat out with the rider tucked down behind the bars",
    seconds: 8,
    stage: (level) => ({
      moment: { x: level.start.x, z: level.start.z, heading: level.start.heading, speed: 12 },
      input: () => ({ ...NEUTRAL, throttle: 1, crouch: 1 }),
    }),
  },
  stand: {
    blurb: "the lean held back on the throttle from rest: up on the tail, then over the back",
    seconds: 10,
    stage: (level) => ({
      moment: { x: level.start.x, z: level.start.z, heading: level.start.heading },
      // Everything held and nothing eased — the OVERDONE case, so the strip
      // shows both halves: the hull rearing onto its tail, and the rider
      // going over the back once the jet's couple outlasts his weight.
      input: () => ({ ...NEUTRAL, throttle: 1, lean: 1 }),
    }),
  },
  carve: {
    blurb: "full lock to the right at speed, after a second straight",
    seconds: 6,
    plan: true,
    stage: (level) => ({
      moment: { x: level.start.x, z: level.start.z, heading: level.start.heading, speed: 16 },
      input: (t) => ({ ...NEUTRAL, throttle: 1, steer: t < 1 ? 0 : 1 }),
    }),
  },
  brake: {
    blurb: "flat out, then the bucket: the only brake a watercraft has",
    seconds: 9,
    stage: (level, spec) => ({
      moment: {
        x: level.start.x,
        z: level.start.z,
        heading: level.start.heading,
        speed: topSpeedOf(spec) * 0.8,
      },
      // Throttle for the first stretch, then the brake lever held down to
      // the stop and past it, into reverse. A craft with no bucket fitted
      // simply coasts, which is the point of drawing all four.
      input: (t) =>
        t < 0.6 ? { ...NEUTRAL, throttle: 1 } : { ...NEUTRAL, throttle: 0, reverse: 1 },
    }),
  },
  chop: {
    blurb: "head-on into the wind's chop at the course's outermost point",
    seconds: 8,
    stage: (level) => {
      const p = outerPoint(level);
      return {
        moment: { x: p.x, z: p.z, heading: level.wind.from, speed: 20 },
        input: () => ({ ...NEUTRAL, throttle: 1 }),
      };
    },
  },
  swell: {
    blurb: "a following sea: running with the waves at half throttle",
    seconds: 10,
    stage: (level) => {
      // A following sea runs TOWARD the shore (the wind blows off the
      // sea, R12), so it starts a hundred metres further out than the
      // course goes and has the water to run in.
      const p = outerPoint(level);
      const out = 100;
      return {
        moment: {
          x: p.x + Math.sin(level.wind.from) * out,
          z: p.z + Math.cos(level.wind.from) * out,
          heading: level.wind.from + Math.PI,
          speed: 8,
        },
        input: () => ({ ...NEUTRAL, throttle: 0.5 }),
      };
    },
  },
  launch: {
    blurb: "the first ramp at the speed the ring asks for, levelled for the landing",
    seconds: 7,
    stage: (level, spec) => rampRun(firstAirGate(level), spec, {}),
  },
  apex: {
    blurb: "in the air over the first ring at its height, at the apex, level",
    seconds: 3,
    stage: (level, spec) => overRing(firstAirGate(level), spec, { pitch: 0.28, vy: 0 }),
  },
  landing: {
    blurb: "at the ring's height over the ring, a touch nose-up, coming down",
    seconds: 5,
    stage: (level, spec) => overRing(firstAirGate(level), spec, { pitch: 0.1, vy: 0 }),
  },
  dive: {
    blurb: "over the ring nose-down with the rider forward: the landing that buries the bow",
    seconds: 5,
    stage: (level, spec) => overRing(firstAirGate(level), spec, { pitch: -0.35, vy: -3, lean: -1 }),
  },
  capsize: {
    blurb: "past vertical and still rolling at a crawl: over, a wait on its back, and the righting",
    seconds: 4,
    stage: (level) => ({
      moment: {
        x: level.start.x,
        z: level.start.z,
        heading: level.start.heading,
        speed: 4,
        roll: 1.75,
        rollRate: 3,
      },
      input: () => NEUTRAL,
    }),
  },
  offshore: {
    blurb: "flat out back along the course from its outermost point, where the sea is biggest",
    seconds: 8,
    stage: (level) => {
      // Back the way the course came: the outermost point is usually near
      // the finish, and the level ends a hundred metres past it.
      const p = outerPoint(level);
      return {
        moment: { x: p.x, z: p.z, heading: p.heading + Math.PI, speed: 22 },
        input: () => ({ ...NEUTRAL, throttle: 1 }),
      };
    },
  },
  storm: {
    blurb: "beam-on to a monster swell in the open sea, half a kilometre out",
    seconds: 10,
    stage: (level) => {
      // Far enough out that R3's bed has fallen past forty metres: the
      // sea is clipped to `TUNING.sea.breakingHs`·d, so a twenty-metre
      // swell is only itself where the water is deep enough to hold it.
      // Pair with the lab's `--hs 20`.
      const p = outerPoint(level);
      const out = 500;
      return {
        moment: {
          x: p.x + Math.sin(level.wind.from) * -out,
          z: p.z + Math.cos(level.wind.from) * -out,
          heading: level.wind.from + Math.PI / 2,
          speed: 12,
        },
        input: () => ({ ...NEUTRAL, throttle: 0.5 }),
      };
    },
  },
  ocean: {
    blurb: "out past the edge of the level, in the storm the coast is hiding",
    seconds: 14,
    stage: (level) => {
      // Straight out along the wind's own line (R12 blows it off the sea)
      // from the course's outermost point, far enough that the rim is
      // astern and the storm stands in full (`engine/game/ocean.ts`). Beam
      // on and at a crawl: nobody races out here.
      const p = outerPoint(level);
      const dx = -Math.sin(level.wind.from);
      const dz = -Math.cos(level.wind.from);
      let d = 0;
      while (d < 20_000 && oceanOut(level.bounds, p.x + dx * d, p.z + dz * d) <= 0) d += 20;
      const out = d + TUNING.sea.open.reach;
      return {
        moment: {
          x: p.x + dx * out,
          z: p.z + dz * out,
          heading: level.wind.from + Math.PI / 2,
          speed: 8,
        },
        input: () => ({ ...NEUTRAL, throttle: 0.4 }),
      };
    },
  },
  backflip: {
    blurb: "the first ramp with the rider held back through the whole flight",
    seconds: 7,
    stage: (level, spec) => rampRun(firstAirGate(level), spec, { holdLean: true }),
  },
};

export const SCENARIO_IDS = Object.keys(SCENARIOS);
