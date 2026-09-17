// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Contact with what is not water: a skerry pushes the hull out and reports
// a hit, a beach grounds it and reports it, a ramp carries it up its deck,
// a reef the keel clears is no contact at all, and the edge of the level is
// a slope back in rather than a wall.
import { describe, expect, it } from "vitest";

import {
  TUNING,
  boundsPush,
  createGame,
  onRampDeck,
  placeRun,
  rampDeckY,
  solidRadiusAt,
  solidSurfaceAt,
  step,
  type CraftInput,
  type GameEvent,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const LEVEL = syntheticLevel({ windSpeed: 0 });
const FULL: CraftInput = { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false };
const COAST: CraftInput = { steer: 0, throttle: 0, reverse: 0, lean: 0, crouch: 0, reset: false };

function ride(state: GameState, seconds: number, input: CraftInput): GameEvent[] {
  const events: GameEvent[] = [];
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, input);
    events.push(...state.events);
  }
  return events;
}

describe("solids", () => {
  it("a skerry hit at speed pushes the hull out and reports it", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    // S1 stands at (250, 75), r = 4; run straight at it from the west.
    placeRun(state, { x: 220, z: 75, heading: Math.PI / 2, speed: 12 });
    const events = ride(state, 3, COAST);
    const hit = events.find((e) => e.kind === "hit");
    expect(hit).toBeDefined();
    if (hit?.kind === "hit") {
      expect(hit.solid).toBe("S1");
      expect(hit.speed).toBeGreaterThan(5);
    }
    const c = state.craft;
    expect(Math.hypot(c.x - 250, c.z - 75)).toBeGreaterThan(4);
    expect(c.speed).toBeLessThan(6);
    for (const v of [c.x, c.y, c.z, c.vx, c.vy, c.vz]) expect(Number.isFinite(v)).toBe(true);
  });

  it("a glancing hit keeps most of the way on and yaws the hull", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    placeRun(state, { x: 236, z: 72, heading: Math.PI / 2, speed: 12 });
    const h0 = state.craft.heading;
    const events = ride(state, 2, COAST);
    expect(events.some((e) => e.kind === "hit")).toBe(true);
    expect(state.craft.speed).toBeGreaterThan(3);
    expect(Math.abs(state.craft.heading - h0)).toBeGreaterThan(0.05);
  });

  it("a hit reports once, not every step of the contact", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    placeRun(state, { x: 240, z: 75, heading: Math.PI / 2, speed: 4 });
    const events = ride(state, 2, FULL);
    const hits = events.filter((e) => e.kind === "hit");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.length).toBeLessThan(6);
  });

  it("clipping a rounding buoy costs speed", () => {
    const level = {
      ...LEVEL,
      solids: [
        {
          id: "B1",
          kind: "buoy" as const,
          x: 250,
          z: 75,
          r: 1.5,
          top: 4,
          rounding: "left" as const,
          light: { flashes: 1, period: 5, phase: 0 },
        },
      ],
    };
    const state = createGame({ seed: 1, craft: "skiff", level, quiet: true });
    placeRun(state, { x: 230, z: 75, heading: Math.PI / 2, speed: 12 });
    const events = ride(state, 2, COAST);
    expect(events.some((event) => event.kind === "hit" && event.solid === "B1")).toBe(true);
    expect(state.craft.speed).toBeLessThan(6);
  });

  it("shapes a rock like a rock: sheer at the water, drawn in at the crown", () => {
    const rock = { id: "R", kind: "skerry" as const, x: 0, z: 0, r: 6, top: 3 };
    // The radius and the surface are the same shape read two ways.
    expect(solidRadiusAt(rock, -1)).toBe(6);
    expect(solidRadiusAt(rock, 0)).toBe(6);
    expect(solidRadiusAt(rock, 3)).toBeCloseTo(6 * TUNING.contact.solidCrown, 6);
    expect(solidSurfaceAt(rock, 6.01, 0)).toBe(-Infinity);
    expect(solidSurfaceAt(rock, 0, 0)).toBe(3);
    for (const y of [0.3, 1, 2, 2.9]) {
      expect(solidSurfaceAt(rock, solidRadiusAt(rock, y), 0)).toBeCloseTo(y, 5);
    }
    // ...and it stands nearly sheer at the rim: a tenth of the radius in
    // buys more than a third of the height.
    expect(solidSurfaceAt(rock, 5.4, 0)).toBeGreaterThan(1);
    // A reef, whose crown never reaches the air, is the flat ledge it is.
    const reef = { id: "F", kind: "reef" as const, x: 0, z: 0, r: 5, top: -1 };
    expect(solidSurfaceAt(reef, 0, 0)).toBe(-1);
    expect(solidSurfaceAt(reef, 4.9, 0)).toBe(-1);
  });

  it("rides over a rock awash instead of stopping dead on it", () => {
    const level = {
      ...LEVEL,
      solids: [{ id: "awash", kind: "boulder" as const, x: 250, z: 200, r: 3, top: 0 }],
    };
    const state = createGame({ seed: 1, craft: "skiff", level, quiet: true });
    placeRun(state, { x: 205, z: 200, heading: Math.PI / 2, speed: 22 });
    const events = ride(state, 4, FULL);
    // Past it, with its way on: the crown shoved the bottom up and let go.
    expect(state.craft.x).toBeGreaterThan(280);
    expect(state.craft.speed).toBeGreaterThan(15);
    expect(events.some((e) => e.kind === "hit")).toBe(false);
  });

  it("a rock that breaks the surface at all is a wall, not a ramp", () => {
    // THE LINE IS THE WATERLINE. A stone standing a hand's breadth proud is
    // already deeper into the hull than the hull draws, so there is nothing
    // for a planing bow to mount: it is met at the flank like any other
    // rock. Below this the crown carried it — and carrying a hull over a
    // step that deep threw it metres into the air and onto its back.
    for (const top of [0.1, 0.2, 0.35]) {
      const level = {
        ...LEVEL,
        solids: [{ id: "proud", kind: "boulder" as const, x: 250, z: 200, r: 3, top }],
      };
      const state = createGame({ seed: 1, craft: "skiff", level, quiet: true });
      placeRun(state, { x: 210, z: 200, heading: Math.PI / 2, speed: 22 });
      const events = ride(state, 4, FULL);
      expect(events.some((e) => e.kind === "hit")).toBe(true);
      // Stopped at its near edge rather than carried over the top of it:
      // with the crown's band spent here instead, the hull cleared the
      // rock without a `hit` at all and was still making way 50 m past it.
      expect(state.craft.x).toBeLessThan(250);
    }
  });

  it("a hull that lands on a skerry stays up on it", () => {
    const level = {
      ...LEVEL,
      solids: [{ id: "perch", kind: "skerry" as const, x: 250, z: 200, r: 9, top: 2.5 }],
    };
    const state = createGame({ seed: 1, craft: "skiff", level, quiet: true });
    placeRun(state, { x: 246, z: 200, heading: Math.PI / 2, speed: 6 });
    state.craft.y = 6;
    state.craft.vy = 0;
    const events = ride(state, 6, COAST);
    const c = state.craft;
    // Sitting on the crown rather than spat back into the sea beside it.
    expect(Math.hypot(c.x - 250, c.z - 200)).toBeLessThan(9);
    expect(c.y).toBeGreaterThan(2.5);
    expect(c.onGround).toBe(true);
    expect(c.airborne).toBe(false);
    // ...and the rock it came down on is ground under the hull, not a hit.
    expect(events.some((e) => e.kind === "ground")).toBe(true);
  });

  it("a rock standing well out of the water is still a wall", () => {
    const level = {
      ...LEVEL,
      solids: [{ id: "wall", kind: "skerry" as const, x: 250, z: 200, r: 6, top: 2.2 }],
    };
    const state = createGame({ seed: 1, craft: "skiff", level, quiet: true });
    placeRun(state, { x: 210, z: 200, heading: Math.PI / 2, speed: 22 });
    const events = ride(state, 4, FULL);
    expect(events.some((e) => e.kind === "hit")).toBe(true);
    // Stopped short of it and never up on top.
    expect(state.craft.x).toBeLessThan(250);
    expect(state.craft.y).toBeLessThan(2.2);
  });

  it("a reef the keel clears is passed over", () => {
    const reef = syntheticLevel({ windSpeed: 0 });
    const level = {
      ...reef,
      solids: [{ id: "reef", kind: "reef" as const, x: 150, z: 200, r: 5, top: -1.5 }],
    };
    const state = createGame({ seed: 1, craft: "skiff", level, quiet: true });
    placeRun(state, { x: 120, z: 200, heading: Math.PI / 2, speed: 15 });
    const events = ride(state, 3, FULL);
    expect(events.some((e) => e.kind === "hit")).toBe(false);
    expect(state.craft.x).toBeGreaterThan(160);
  });
});

describe("the ground", () => {
  it("running at the beach grounds the hull and stops it", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    // Heading 0 is +z; the shore is at z = 0, so ride south (π) into it.
    placeRun(state, { x: 100, z: 30, heading: Math.PI, speed: 8 });
    const events = ride(state, 6, COAST);
    expect(events.some((e) => e.kind === "ground")).toBe(true);
    const c = state.craft;
    expect(c.z).toBeLessThan(6);
    expect(c.z).toBeGreaterThan(-60);
    expect(c.speed).toBeLessThan(1);
    expect(c.onGround).toBe(true);
    // Stood on the sand, not under it.
    expect(c.y).toBeGreaterThan(-0.5);
  });

  it("a hull cannot be driven through the land", () => {
    const state = createGame({ seed: 1, craft: "marlin", level: LEVEL, quiet: true });
    placeRun(state, { x: 100, z: 20, heading: Math.PI, speed: 25 });
    ride(state, 8, FULL);
    const c = state.craft;
    expect(c.z).toBeGreaterThan(-100);
    expect(Number.isFinite(c.y)).toBe(true);
    expect(c.y).toBeGreaterThan(-1);
  });
});

describe("the ramp", () => {
  it("reads its deck", () => {
    const ramp = LEVEL.course.gates.find((g) => g.kind === "air")!.ramp!;
    const on = onRampDeck(ramp, ramp.x + 4, ramp.z)!;
    expect(on.along).toBeCloseTo(4, 9);
    expect(on.across).toBeCloseTo(0, 9);
    expect(onRampDeck(ramp, ramp.x + 4, ramp.z + 10)).toBeNull();
    expect(onRampDeck(ramp, ramp.x + ramp.length + 1, ramp.z)).toBeNull();
    // The approach lip behind the hinge is on the deck, under water.
    expect(onRampDeck(ramp, ramp.x - 2, ramp.z)).not.toBeNull();
    expect(rampDeckY(ramp, 0)).toBe(0);
    expect(rampDeckY(ramp, ramp.length)).toBeCloseTo(ramp.length * Math.tan(ramp.angle), 9);
    expect(rampDeckY(ramp, -2)).toBeLessThan(0);
  });

  it("carries the hull up its deck", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    const ramp = LEVEL.course.gates.find((g) => g.kind === "air")!.ramp!;
    placeRun(state, { x: ramp.x - 20, z: ramp.z, heading: Math.PI / 2, speed: 7 });
    let onRamp = false;
    let highest = -1;
    let pitchOnRamp = 0;
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
      step(state, FULL);
      const c = state.craft;
      if (c.onRamp) {
        onRamp = true;
        pitchOnRamp = Math.max(pitchOnRamp, c.pitch);
        highest = Math.max(highest, c.y);
      }
    }
    expect(onRamp).toBe(true);
    // Up the deck: the hull rose well above its rest height and pitched
    // toward the ramp's angle.
    expect(highest).toBeGreaterThan(1);
    expect(pitchOnRamp).toBeGreaterThan(0.15);
  });

  // The wedge's walls. Ridden at from anywhere but the hinge, a ramp is a
  // wall — the deck's normal points UP, so a hull that met the deck two
  // metres over its head through the lip's end face would be thrown the
  // height of the lip's penetration rather than stopped by it.
  it("is a wall from the wrong side, not a launch pad", () => {
    const ramp = LEVEL.course.gates.find((g) => g.kind === "air")!.ramp!;
    const lip = ramp.length * Math.tan(ramp.angle);
    const sh = Math.sin(ramp.heading);
    const ch = Math.cos(ramp.heading);
    for (const speed of [10, 20, 30]) {
      // Head-on at the raised end, riding back down the ramp's axis...
      const head = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
      placeRun(head, {
        x: ramp.x + sh * (ramp.length + 25),
        z: ramp.z + ch * (ramp.length + 25),
        heading: ramp.heading + Math.PI,
        speed,
      });
      // ...and square into a flank.
      const flank = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
      placeRun(flank, {
        x: ramp.x + sh * ramp.length * 0.5 + ch * 25,
        z: ramp.z + ch * ramp.length * 0.5 - sh * 25,
        heading: ramp.heading - Math.PI / 2,
        speed,
      });
      for (const state of [head, flank]) {
        let highest = -Infinity;
        for (let i = 0; i < 6 * TUNING.physicsHz; i++) {
          step(state, COAST);
          highest = Math.max(highest, state.craft.y);
          expect(state.craft.onRamp).toBe(false);
        }
        // Stopped at the wall: never so much as the lip's own height up,
        // let alone the tens of metres the deck's normal would give.
        expect(highest).toBeLessThan(lip);
        expect(state.craft.speed).toBeLessThan(speed);
      }
    }
  });
});

describe("the bounds", () => {
  // The default synthetic coast has eight metres of water at its seaward
  // rim — a shelf, not the open sea — so every rim of it holds.
  it("push back inside, harder the further out", () => {
    const inside = boundsPush(LEVEL, 300, 200);
    expect(inside).toEqual({ ax: 0, az: 0 });
    const east = boundsPush(LEVEL, LEVEL.bounds.maxX + 2, 200);
    expect(east.ax).toBeLessThan(0);
    const further = boundsPush(LEVEL, LEVEL.bounds.maxX + 6, 200);
    expect(further.ax).toBeLessThan(east.ax);
    const south = boundsPush(LEVEL, 300, LEVEL.bounds.minZ - 5);
    expect(south.az).toBeGreaterThan(0);
  });

  it("a hull driven at a rim that is not the open sea is turned back", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: LEVEL, quiet: true });
    placeRun(state, { x: 300, z: LEVEL.bounds.maxZ - 30, heading: 0, speed: 20 });
    ride(state, 8, FULL);
    expect(state.craft.z).toBeLessThan(LEVEL.bounds.maxZ + 30);
    expect(Number.isFinite(state.craft.z)).toBe(true);
  });

  // ...and where the rim stands in the OPEN SEA it lets him out
  // (`engine/game/ocean.ts`). The basin pads every side but the sea's with
  // land (R14, R15), so a rim this deep is the ocean and the ocean has no
  // far side.
  describe("where the rim stands in open water", () => {
    const DEEP = syntheticLevel({ windSpeed: 0, depth: 40 });

    it("let a rider straight out, and still hold him in at the land", () => {
      expect(boundsPush(DEEP, 300, DEEP.bounds.maxZ + 4).az).toBe(0);
      expect(boundsPush(DEEP, 300, DEEP.bounds.maxZ + 900).az).toBe(0);
      // The landward rim of the same level is the country behind the beach.
      expect(boundsPush(DEEP, 300, DEEP.bounds.minZ - 4).az).toBeGreaterThan(0);
    });

    it("stop reeling him in once he is out there, whatever rim he is abeam of", () => {
      // A rider a kilometre out at sea is past the box on one axis, so the
      // land rims he is now abeam of have nothing to say to him.
      const far = boundsPush(DEEP, DEEP.bounds.maxX + 1000, DEEP.bounds.maxZ + 1000);
      expect(far).toEqual({ ax: 0, az: 0 });
    });

    it("a hull driven at it rides out of the level and keeps going", () => {
      const state = createGame({ seed: 1, craft: "marlin", level: DEEP, quiet: true });
      placeRun(state, { x: 300, z: DEEP.bounds.maxZ - 60, heading: 0, speed: 20 });
      ride(state, 20, FULL);
      expect(state.craft.z).toBeGreaterThan(DEEP.bounds.maxZ + 100);
      expect(Number.isFinite(state.craft.z)).toBe(true);
      expect(state.craft.y).toBeGreaterThan(-5);
    });
  });
});
