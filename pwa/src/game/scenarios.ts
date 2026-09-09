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
  faunaById,
  faunaPose,
  fieldGradient,
  freshPose,
  launchSpeedFor,
  placeRun,
  topSpeedOf,
  type CraftInput,
  type Gate,
  type GameState,
  type Level,
  type Pod,
  type RunMoment,
} from "@engine";

export type ScenarioName =
  | "rest"
  | "cruise"
  | "carve"
  | "chop"
  | "swell"
  | "launch"
  | "apex"
  | "landing"
  | "dive"
  | "offshore"
  | "storm"
  | "backflip"
  | "wildlife";

export const SCENARIO_NAMES: readonly ScenarioName[] = [
  "rest",
  "cruise",
  "carve",
  "chop",
  "swell",
  "launch",
  "apex",
  "landing",
  "dive",
  "offshore",
  "storm",
  "backflip",
  "wildlife",
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
  return { steer, throttle, lean, reset: false };
}

/** The unit vector pointing out to sea at a plan point — up the `offshore`
 * distance field. */
export function seawardAt(level: Level, x: number, z: number): { x: number; z: number } {
  const { gx, gz } = fieldGradient(level.offshore, x, z);
  const n = Math.hypot(gx, gz);
  if (n < 1e-6) return { x: 0, z: 1 };
  return { x: gx / n, z: gz / n };
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
    case "chop": {
      // Flat out INTO the wind, off the course: the chop meets the bow
      // head on and the hull skips over it.
      const sea = seawardAt(level, mid.x, mid.z);
      return {
        moment: {
          x: mid.x + sea.x * 40,
          z: mid.z + sea.z * 40,
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
      const sea = seawardAt(level, mid.x, mid.z);
      return {
        moment: {
          x: mid.x + sea.x * 140,
          z: mid.z + sea.z * 140,
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
        // Flat out up the run-up, a lean back as the deck is met so the
        // nose comes up off the lip, level in the air.
        script: (t) => input(0, 1, t > 1.6 && t < 2.8 ? 0.5 : 0),
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
    case "offshore": {
      const sea = seawardAt(level, mid.x, mid.z);
      return {
        moment: {
          x: mid.x + sea.x * 200,
          z: mid.z + sea.z * 200,
          heading: Math.atan2(sea.x, sea.z) + Math.PI / 2,
          speed: top * 0.6,
          nextGate: mid.index,
        },
        script: () => input(0, 0.8, 0),
        seconds: 5,
      };
    }
    case "storm": {
      // THE OPEN SEA, half a kilometre out, beam-on to a monster swell.
      // A wave only stands its full height in water it cannot feel the
      // bottom of — the field is clipped to `breakingHs`·d — so a sea
      // quoted at twenty metres is a nine-metre one over the course's
      // twenty-five and its whole self out here, where R3's bed has
      // fallen past forty. Ride it with `?hs=20`.
      const sea = seawardAt(level, mid.x, mid.z);
      const b = level.bounds;
      // As far out as the level HAS, up to half a kilometre: the seaward
      // walk is clamped inside the bounds with a margin, so a level whose
      // open water runs out sooner stages in the deepest it owns.
      const margin = 30;
      let out = 0;
      for (let d = 20; d <= 500; d += 20) {
        const px = mid.x + sea.x * d;
        const pz = mid.z + sea.z * d;
        if (px < b.minX + margin || px > b.maxX - margin) break;
        if (pz < b.minZ + margin || pz > b.maxZ - margin) break;
        out = d;
      }
      return {
        moment: {
          x: mid.x + sea.x * out,
          z: mid.z + sea.z * out,
          heading: Math.atan2(sea.x, sea.z) + Math.PI / 2,
          speed: top * 0.35,
          nextGate: mid.index,
        },
        script: () => input(0, 0.5, 0),
        seconds: 8,
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
      const lead = faunaPose(pod, 0, 0, freshPose());
      return {
        moment: {
          x: lead.x + Math.sin(lead.heading) * WILDLIFE_STANDOFF,
          z: lead.z + Math.cos(lead.heading) * WILDLIFE_STANDOFF,
          heading: lead.heading + Math.PI,
          nextGate: mid.index,
        },
        // Stopped, and held there: a pod swims a curve and the craft can
        // only go straight, so any pace at all is a pace that loses it.
        script: () => NEUTRAL,
        seconds: 2,
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
