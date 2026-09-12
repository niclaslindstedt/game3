// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TORNADO past the far edge of the open ocean (`engine/game/tornado.ts`)
// — held from four sides: the zone is nowhere a run is ridden, the inflow
// blows home from every direction a rider can leave by, the column throws
// him and the throw is BOUNDED, and nothing about any of it breaks the
// determinism the rest of the engine is built on.
//
// The air-time bands the tuning claims are measured here rather than
// asserted from arithmetic: the column holds a hull as well as launching it,
// so how long a rider is up is a property of the whole step loop and not of
// `tornadoLift` alone.
import { describe, expect, it } from "vitest";

import {
  CRAFT,
  angleDiff,
  CLIMB,
  TORNADO_EDGE,
  TUNING,
  columnFade,
  createGame,
  createWind,
  standCraft,
  step,
  surfaceAt,
  tornadoAt,
  tornadoBand,
  tornadoBlow,
  tornadoColumn,
  tornadoEdge,
  tornadoInflow,
  tornadoLift,
  hoverSpeed,
  tornadoRamp,
  updraftFor,
  windAt,
  type Level,
} from "@engine";

import { levelFor, LEVEL_SEEDS } from "./support/levels.ts";
import { syntheticLevel } from "./support/synthetic.ts";

const T = TUNING.wind.tornado;
/** The synthetic level is built at the build's own class, so its edge, band
 * and blow are the build's — read them once rather than at every call. */
const PACE = TUNING.pump.speedClass;
const BAND = tornadoBand(PACE);
const BLOW = tornadoBlow(PACE);

/** Ride at full throttle for `seconds`, returning every flight the column
 * actually lofted: its air time, s, and its apex over THE WATER UNDER IT, m.
 * Over the water rather than over the datum because out here the sea itself
 * swings several metres and a height read off zero would be measuring the
 * wave the rider left as much as the throw. A flight whose apex stayed under
 * ten metres is a hull crossing a wave rather than a hull being thrown, and
 * counting those would measure the sea instead of the tornado. */
function throws(
  level: Level,
  craft: (typeof CRAFT)[number]["id"],
  x: number,
  z: number,
  seconds = 120,
): { air: number[]; apex: number[] } {
  const game = createGame({ seed: 5, level, craft });
  const c = game.craft;
  standCraft(game, x, z, 0);
  const air: number[] = [];
  const apex: number[] = [];
  let peak = 0;
  for (let i = 0; i < TUNING.physicsHz * seconds; i++) {
    step(game, { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false });
    if (c.airborne) {
      const water = surfaceAt(game.sea, level, c.x, c.z, game.t).height;
      peak = Math.max(peak, c.y - water);
    }
    for (const e of game.events) {
      if (e.kind !== "land") continue;
      if (peak > 10) {
        air.push(e.airTime);
        apex.push(peak);
      }
      peak = 0;
    }
    // Held in the zone so the column is measured rather than the inflow's
    // success at emptying it: a rider blown back inside gets one throw and
    // the sample would be four flights long.
    if (!c.airborne && tornadoAt(level.bounds, level.pace, c.x, c.z) < 0.99)
      standCraft(game, x, z, 0);
  }
  return { air, apex };
}

function quantile(xs: readonly number[], p: number): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0;
}

describe("where the tornado stands", () => {
  const level = syntheticLevel({ seaward: 600, depth: 60 });
  const b = level.bounds;

  it("is a minute of riding past the storm's own full reach", () => {
    // Derived off the roster's fastest craft and the storm's reach, never
    // authored: a speed class that moved the ocean would move this with it.
    expect(TORNADO_EDGE).toBeGreaterThan(TUNING.sea.open.reach);
    expect(TORNADO_EDGE - TUNING.sea.open.reach).toBeGreaterThan(T.grace * 20);
  });

  it("is nowhere inside the level, nor anywhere in the storm short of it", () => {
    expect(tornadoRamp(0, PACE)).toBe(0);
    expect(tornadoRamp(TUNING.sea.open.reach, PACE)).toBe(0);
    expect(tornadoRamp(TORNADO_EDGE, PACE)).toBe(0);
    expect(tornadoAt(b, PACE, 400, 300)).toBe(0);
    expect(tornadoAt(b, PACE, 400, b.maxZ + TUNING.sea.open.reach)).toBe(0);
  });

  it("comes up over its band and stops at full", () => {
    expect(tornadoRamp(TORNADO_EDGE + BAND * 0.5, PACE)).toBeCloseTo(0.5, 2);
    expect(tornadoRamp(TORNADO_EDGE + BAND, PACE)).toBe(1);
    expect(tornadoRamp(TORNADO_EDGE + BAND * 100, PACE)).toBe(1);
  });

  it("eases off its edge rather than stepping off it", () => {
    // The step across the edge is no bigger than the steps either side of
    // it — a rider crossing the line meets a freshening, not a pane of glass.
    const at = (d: number): number => tornadoRamp(TORNADO_EDGE + d, PACE);
    const edge = at(1) - at(0);
    const inside = at(BAND * 0.5 + 1) - at(BAND * 0.5);
    expect(edge).toBeLessThan(inside);
  });

  it("moves out with the SPEED CLASS the run is ridden at", () => {
    // R32 made the class a per-RUN option (`createGame({ speedClass })`), and
    // the edge and the blow are the two dials quoted against what the craft
    // can do — so both read `Level.pace` rather than the catalog. A rider on
    // a hull twice as quick would otherwise get half the grace and a wall he
    // rides straight out through.
    expect(tornadoEdge(2)).toBeGreaterThan(tornadoEdge(1));
    expect(tornadoEdge(2) - TUNING.sea.open.reach).toBeCloseTo(
      2 * (tornadoEdge(1) - TUNING.sea.open.reach),
      6,
    );
    expect(tornadoBlow(2)).toBeCloseTo(2 * tornadoBlow(1), 6);
    expect(tornadoBand(2)).toBeCloseTo(2 * tornadoBand(1), 6);
    // ...and a point inside a fast run's grace is one a slow run is already
    // in the tornado at.
    const out = tornadoEdge(1) + tornadoBand(1);
    expect(tornadoRamp(out, 1)).toBe(1);
    expect(tornadoRamp(out, 2)).toBe(0);
  });

  it("holds the THROW still with the sea instead, whatever the run's class", () => {
    // The other half of the same question, and the answer goes the other way:
    // `createSea` deals its storm against `STORM_CEILING` off the CATALOG, so
    // the sea past the rim is the same height at any per-run class. The climb
    // and the column are sized to that sea, so they hold still with it — a
    // throw that grew with the craft would be a throw over water that had not.
    expect(CLIMB).toBeGreaterThan(0);
    const level = syntheticLevel({ seaward: 600, depth: 60 });
    const far = TORNADO_EDGE + BAND * 2;
    const seaward = tornadoColumn(level, 400, level.bounds.maxZ + far);
    expect(seaward).toBeCloseTo(T.column.ocean * CLIMB, 6);
  });

  it("stands past EVERY rim, not only the seaward one", () => {
    const far = TORNADO_EDGE + BAND;
    expect(tornadoAt(b, PACE, 400, b.maxZ + far)).toBe(1);
    expect(tornadoAt(b, PACE, b.maxX + far, 200)).toBe(1);
    expect(tornadoAt(b, PACE, b.minX - far, 200)).toBe(1);
    expect(tornadoAt(b, PACE, 400, b.minZ - far)).toBe(1);
  });
});

describe("the inflow", () => {
  const level = syntheticLevel({ seaward: 600, depth: 60 });
  const b = level.bounds;
  const home = { x: level.start.x, z: level.start.z };
  const out = new Float64Array(2);

  it("is nothing at all where the tornado is not", () => {
    tornadoInflow(0, PACE, home, 5_000, 5_000, out);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
  });

  it("blows toward the start line from whichever way the rider left", () => {
    for (const at of [
      { x: 400, z: b.maxZ + TORNADO_EDGE + BAND * 2 },
      { x: b.maxX + TORNADO_EDGE + BAND * 2, z: 200 },
      { x: b.minX - TORNADO_EDGE - BAND * 2, z: 200 },
    ]) {
      tornadoInflow(1, PACE, home, at.x, at.z, out);
      // Its component along the way home is positive and carries most of
      // the wind: the swirl turns the inflow, it does not replace it.
      const dx = home.x - at.x;
      const dz = home.z - at.z;
      const len = Math.hypot(dx, dz);
      const along = (out[0] * dx + out[1] * dz) / len;
      expect(along).toBeGreaterThan(0);
      expect(along).toBeCloseTo(BLOW * Math.cos(T.swirl), 6);
      expect(Math.hypot(out[0], out[1])).toBeCloseTo(BLOW, 6);
    }
  });

  it("spirals in cyclonically rather than running straight at the start", () => {
    const at = { x: 400, z: b.maxZ + TORNADO_EDGE + BAND * 2 };
    tornadoInflow(1, PACE, home, at.x, at.z, out);
    // Headings grow clockwise from above here, so the cyclonic turn is the
    // negative one: the bearing of the inflow sits `swirl` anticlockwise of
    // the bearing home.
    const straight = Math.atan2(home.x - at.x, home.z - at.z);
    const blown = Math.atan2(out[0], out[1]);
    expect(angleDiff(straight, blown)).toBeCloseTo(-T.swirl, 6);
  });

  it("reaches the craft through the wind, on top of the level's own", () => {
    const wind = createWind(level);
    const inside = windAt(wind, 10, 400, 300);
    const far = windAt(wind, 10, 400, b.maxZ + TORNADO_EDGE + BAND * 2);
    expect(Math.hypot(inside.vx, inside.vz)).toBeLessThan(TUNING.sea.open.wind + 1);
    expect(Math.hypot(far.vx, far.vz)).toBeGreaterThan(BLOW * 0.8);
    // ...and it is blowing back toward the level, which the level's own
    // wind on this coast is not.
    expect(far.vz).toBeLessThan(-BLOW * 0.5);
  });
});

describe("the column", () => {
  const level = syntheticLevel({ seaward: 600, depth: 60 });
  const spec = CRAFT[0];

  it("is full at the water and gone at its top", () => {
    expect(columnFade(0, 20)).toBe(1);
    expect(columnFade(20, 20)).toBe(0);
    expect(columnFade(60, 20)).toBe(0);
    expect(columnFade(10, 20)).toBeGreaterThan(0);
    expect(columnFade(10, 20)).toBeLessThan(1);
  });

  it("stands taller over the open sea than over the shallows", () => {
    const b = level.bounds;
    const far = TORNADO_EDGE + BAND * 2;
    const seaward = tornadoColumn(level, 400, b.maxZ + far);
    const alongshore = tornadoColumn(level, b.maxX + far, 20);
    expect(seaward).toBeGreaterThan(alongshore);
    expect(seaward).toBeCloseTo(T.column.ocean * CLIMB, 6);
    expect(alongshore).toBeLessThanOrEqual(T.column.shore * CLIMB + 1);
  });

  it("lifts every craft in the roster, at any speed class", () => {
    // THE SILENT-FAILURE GUARD. The air speed at which a hull hovers is set
    // by its mass over its plan area and moves with NEITHER the speed class
    // nor the sea; the column's updraft is quoted as a CLIMB on top of that
    // for exactly this reason. Quoted outright it would be a number that, at
    // a low enough class, sits under the hover speed on the heaviest hull —
    // and a tornado that lifts nothing does not fail a test, it just stops
    // being there.
    for (const craft of CRAFT) {
      expect(hoverSpeed(craft)).toBeGreaterThan(0);
      expect(updraftFor(craft) - hoverSpeed(craft)).toBeCloseTo(CLIMB, 6);
      expect(updraftFor(craft)).toBeGreaterThan(hoverSpeed(craft));
    }
    // ...and the climb is the same on all four, which is what makes the
    // throw a property of the tornado rather than of the craft.
    const climbs = CRAFT.map((c) => updraftFor(c) - hoverSpeed(c));
    expect(Math.max(...climbs) - Math.min(...climbs)).toBeLessThan(1e-9);
  });

  it("lifts nothing where there is no tornado and nothing in the water", () => {
    expect(tornadoLift(spec, 0, 0, 20, 0, 1)).toBe(0);
    expect(tornadoLift(spec, 1, 0, 20, 0, 0)).toBe(0);
  });

  it("pushes a hull climbing faster than the air back down", () => {
    // The whole reason the throw is bounded rather than a rocket: the force
    // is signed on the RELATIVE speed, so past the column's own rise it
    // reverses.
    expect(tornadoLift(spec, 1, 0, 20, 0, 1)).toBeGreaterThan(0);
    expect(tornadoLift(spec, 1, 0, 20, updraftFor(spec) * 2, 1)).toBeLessThan(0);
    expect(tornadoLift(spec, 1, 0, 20, updraftFor(spec), 1)).toBeCloseTo(0, 6);
  });

  it("carries the weight of every craft in the roster near the water", () => {
    // If it did not, nothing would ever be thrown. The margin is what turns
    // into the climb.
    for (const craft of CRAFT) {
      const weight = (craft.mass + craft.riderMass) * TUNING.g;
      expect(tornadoLift(craft, 1, 0, T.column.ocean, 0, 1)).toBeGreaterThan(weight * 2);
    }
  });
});

describe("what the tornado does to a rider", () => {
  const level = syntheticLevel({ seaward: 600, depth: 60 });
  const b = level.bounds;
  const far = TORNADO_EDGE + BAND + 1_200;

  it("throws him twenty metres and more, off every craft in the roster", () => {
    for (const craft of CRAFT) {
      const { apex } = throws(level, craft.id, 400, b.maxZ + far);
      expect(apex.length).toBeGreaterThan(0);
      expect(Math.max(...apex)).toBeGreaterThan(20);
    }
  });

  it("throws him to a bounded height, and holds him up for seconds and not a minute", () => {
    // WHAT `TUNING.wind.tornado.column` IS SET BY, and the distinction the
    // column's own comment turns on: it is a HEIGHT, so the height is where
    // this is tight and the time is a consequence of it. Read at the
    // percentiles over the whole roster rather than at the extremes — a hull
    // in a storm under a tornado is a chaotic thing and its longest single
    // flight is not a design target.
    const ocean: number[] = [];
    const shore: number[] = [];
    const oceanApex: number[] = [];
    const shoreApex: number[] = [];
    for (const craft of CRAFT) {
      const out = throws(level, craft.id, 400, b.maxZ + far);
      const along = throws(level, craft.id, b.maxX + far, 60);
      ocean.push(...out.air);
      oceanApex.push(...out.apex);
      shore.push(...along.air);
      shoreApex.push(...along.apex);
    }
    expect(ocean.length).toBeGreaterThan(20);
    expect(shore.length).toBeGreaterThan(20);
    // THE HEIGHT IS THE BOUND, and it is the one that does not move when the
    // sea does: twenty-odd metres at the ninetieth percentile and thirty at
    // the worst, on both columns, whatever the storm under them is shaped
    // like. A hull that reached a hover in the column would show up HERE,
    // as an apex in the hundreds.
    for (const band of [oceanApex, shoreApex]) {
      expect(quantile(band, 0.5)).toBeGreaterThan(8);
      expect(quantile(band, 0.9)).toBeLessThan(30);
      expect(Math.max(...band)).toBeLessThan(45);
    }
    // ...and the TIME follows from it, loosely, because how long a throw
    // lasts is also how long the water under it takes to come back up. Over
    // a nine-second, hundred-and-thirty-metre storm swell that is most of a
    // wave period of grace, so the same apex is worth about twice the
    // hang it was worth over a sea carried by one breaking-steep component
    // (which the open band was until its energy was spread properly: rms
    // face 100 % → 33 %, median throw 5 s → 9 s, apex unmoved).
    for (const band of [ocean, shore]) {
      expect(quantile(band, 0.5)).toBeGreaterThan(3);
      expect(quantile(band, 0.5)).toBeLessThan(15);
      expect(quantile(band, 0.9)).toBeLessThan(25);
      expect(Math.max(...band)).toBeLessThan(45);
    }
    // THE TWO COLUMNS ARE NOT COMPARED FROM A RIDE. That the seaward one
    // stands taller is the whole point of there being two, and it is held
    // exactly — to six decimals, against the tuning — by the case above
    // that reads `tornadoColumn` directly. Asked of a ride instead it is a
    // 12 % difference read through a launch-and-land sampler with a fifth
    // of its own spread, and the sampler is not stable enough to answer:
    // `Math.pow`, `Math.exp` and `Math.sin` are not bit-identical across
    // V8 builds (the engine's determinism contract is that a run replays
    // on ONE machine, which `determinism_test` holds), and a hull in a
    // storm amplifies a last-bit difference into a different set of
    // landings. The ocean p90 is 18.8 s here and 18.7 s on CI; the shore's
    // is 15.6 s here and 19.9 s there, which is what failed.
  });

  it("carries him back toward the start rather than further out", () => {
    const game = createGame({ seed: 5, level, craft: "skiff" });
    standCraft(game, 400, b.maxZ + far, 0);
    const c = game.craft;
    const before = Math.hypot(c.x - level.start.x, c.z - level.start.z);
    // Held at full throttle STRAIGHT OUT TO SEA the whole time: the rider is
    // doing everything he can to get further away, and still ends up nearer.
    for (let i = 0; i < TUNING.physicsHz * 30; i++) {
      step(game, { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false });
    }
    const after = Math.hypot(c.x - level.start.x, c.z - level.start.z);
    expect(after).toBeLessThan(before - 200);
    expect(Number.isFinite(after)).toBe(true);
  });

  it("tells the run once a throw rather than once a step", () => {
    const game = createGame({ seed: 5, level, craft: "skiff" });
    standCraft(game, 400, b.maxZ + far, 0);
    let events = 0;
    let last = -Infinity;
    for (let i = 0; i < TUNING.physicsHz * 30; i++) {
      step(game, { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false });
      for (const e of game.events) {
        if (e.kind !== "tornado") continue;
        expect(e.wind).toBeGreaterThanOrEqual(BLOW * T.eventShare);
        expect(e.grip).toBeGreaterThan(0);
        expect(game.t - last).toBeGreaterThan(T.eventGap - TUNING.dt);
        last = game.t;
        events++;
      }
    }
    expect(events).toBeGreaterThan(0);
    expect(events).toBeLessThan(TUNING.physicsHz);
  });

  it("does not reset the run, end it, or reach back into the course", () => {
    const game = createGame({ seed: 5, level, craft: "skiff" });
    standCraft(game, 400, b.maxZ + far, 0);
    const gate = game.progress.nextGate;
    for (let i = 0; i < TUNING.physicsHz * 30; i++) {
      step(game, { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false });
      for (const e of game.events) expect(e.kind).not.toBe("reset");
    }
    expect(game.phase).toBe("running");
    expect(game.progress.nextGate).toBe(gate);
    expect(game.progress.finished).toBe(false);
  });
});

describe("the tornado and the rest of the engine", () => {
  it("stands outside every generated level, so no run ever meets it", () => {
    // A course that ran into the hazard would be a course the hazard broke.
    for (const seed of LEVEL_SEEDS) {
      const level = levelFor(seed);
      for (const gate of level.course.gates) {
        expect(tornadoAt(level.bounds, level.pace, gate.x, gate.z)).toBe(0);
      }
      expect(tornadoAt(level.bounds, level.pace, level.start.x, level.start.z)).toBe(0);
    }
  });

  it("replays identically, drawing no randomness of its own", () => {
    const level = syntheticLevel({ seaward: 600, depth: 60 });
    const far = TORNADO_EDGE + TUNING.wind.tornado.band + 1_200;
    const ride = (): number[] => {
      const game = createGame({ seed: 11, level, craft: "dart" });
      const c = game.craft;
      standCraft(game, 400, level.bounds.maxZ + far, 0);
      const path: number[] = [];
      for (let i = 0; i < TUNING.physicsHz * 15; i++) {
        step(game, { steer: 0.2, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false });
        if (i % 120 === 0) path.push(c.x, c.y, c.z, c.speed);
      }
      return path;
    };
    expect(ride()).toEqual(ride());
  });
});
