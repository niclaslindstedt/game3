// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WASH (engine/game/wash.ts): the waves a hull leaves in the water are
// real water — read by the hull's probes through `surfaceAt`, laid by the
// ride and by nothing else, born outside the hull that made them, adding
// up to a V behind a moving hull and to rings round a heaving one, and
// gone again in seconds.
import { describe, expect, it } from "vitest";

import {
  clearWash,
  createGame,
  heightAt,
  NEUTRAL_INPUT,
  placeRun,
  step,
  stepWash,
  surfaceAt,
  TUNING,
  washAt,
  WASH_GROUP,
  WASH_REACH,
  WASH_WAVELENGTH,
  type CraftInput,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

const W = TUNING.wash;
const FLAT = syntheticLevel({ windSpeed: 0, noSolids: true });
const CHOP = syntheticLevel({ windSpeed: 8, noSolids: true });
const START = { x: 100, z: 200, heading: Math.PI / 2 };
const sample = { height: 0, sx: 0, sz: 0, vx: 0, vy: 0, vz: 0 };

function ride(state: GameState, seconds: number, input: Partial<CraftInput> = {}): GameState {
  const held = { ...NEUTRAL_INPUT, ...input };
  for (let i = 0; i < Math.round(seconds * TUNING.physicsHz); i++) step(state, held);
  return state;
}

/** The wash's height at a point of the run's sea, now. */
function washHeight(state: GameState, x: number, z: number): number {
  return washAt(state.sea.washes, x, z, state.t, 1, sample).height;
}

/** A point `astern` m behind the hull and `across` m to its right. */
function aft(state: GameState, astern: number, across: number): { x: number; z: number } {
  const c = state.craft;
  const ax = Math.sin(c.heading);
  const az = Math.cos(c.heading);
  return { x: c.x - ax * astern + across * az, z: c.z - az * astern - across * ax };
}

/** How far across the trail, `astern` m back, the wash still stands at a
 * quarter of its height there, m — the V's edge. */
function edgeAcross(state: GameState, astern: number): number {
  const heights: number[] = [];
  for (let s = 0; s <= 20; s += 0.1) {
    const p = aft(state, astern, s);
    heights.push(Math.abs(washHeight(state, p.x, p.z)));
  }
  const peak = Math.max(...heights);
  for (let i = heights.length - 1; i >= 0; i--) if (heights[i] > peak / 4) return i * 0.1;
  return 0;
}

describe("what lays it", () => {
  it("a hull lying on a flat calm lays nothing, and costs nothing", () => {
    const state = createGame({ seed: 1, level: FLAT, craft: "skiff", quiet: true });
    ride(state, 5);
    expect(state.wash.count).toBe(0);
    expect(state.sea.washes).toHaveLength(1);
    expect(state.sea.washes[0]).toBe(state.wash);
    expect(washHeight(state, state.craft.x + 5, state.craft.z)).toBe(0);
  });

  it("a hull at speed lays a source every spacing of travel, and a V stands behind it", () => {
    const state = createGame({ seed: 1, level: FLAT, craft: "skiff", quiet: true });
    ride(state, 8, { throttle: 1 });
    const c = state.craft;
    expect(c.speed).toBeGreaterThan(15);
    // Roughly one source a metre over the last `maxAge` seconds, plus the
    // bob's on its cadence.
    expect(state.wash.count).toBeGreaterThan((W.maxAge * c.speed) / W.spacing / 2);
    expect(state.wash.count).toBeLessThan(
      W.maxAge * (c.speed / W.spacing + TUNING.physicsHz / W.every) + 16,
    );
    // Beside the trail ten metres back the water is up by centimetres;
    // thirty metres off it is nothing.
    let beside = 0;
    for (let s = 1; s <= 12; s += 0.25) {
      const p = aft(state, 10, s);
      beside = Math.max(beside, Math.abs(washHeight(state, p.x, p.z)));
    }
    expect(beside).toBeGreaterThan(0.01);
    expect(beside).toBeLessThan(W.maxCrest);
    const off = aft(state, 10, 30);
    expect(Math.abs(washHeight(state, off.x, off.z))).toBeLessThan(0.001);
  });

  it("the V narrows as the hull outruns its own wave", () => {
    // Every ring goes out at one celerity; a hull past it leaves them
    // behind on a cone whose half-angle closes as the speed rises — which
    // is what a planing hull's wake does in the reference photographs.
    const cruise = ride(createGame({ seed: 1, level: FLAT, craft: "skiff", quiet: true }), 10, {
      throttle: 0.35,
    });
    const flat = ride(createGame({ seed: 1, level: FLAT, craft: "skiff", quiet: true }), 10, {
      throttle: 1,
    });
    expect(flat.craft.speed).toBeGreaterThan(cruise.craft.speed * 1.5);
    // Read thirty metres back, where the cone has opened past the width of
    // one packet: at cruise the V's edge stands ten metres off the track,
    // flat out six.
    expect(edgeAcross(cruise, 30)).toBeGreaterThan(edgeAcross(flat, 30) + 2);
  });

  it("a hull heaving in a chop radiates rings of centimetres, born on the cadence", () => {
    const state = createGame({ seed: 1, level: CHOP, windSpeed: 8, craft: "skiff", quiet: true });
    ride(state, 8);
    expect(state.craft.speed).toBeLessThan(1.5);
    expect(state.wash.count).toBeGreaterThan(5);
    let ring = 0;
    for (let d = 3; d <= 15; d += 0.25) {
      ring = Math.max(ring, Math.abs(washHeight(state, state.craft.x + d, state.craft.z)));
    }
    expect(ring).toBeGreaterThan(W.minCrest);
    expect(ring).toBeLessThan(0.05);
  });

  it("a landing is struck at once, and its ring stands up over the rise", () => {
    const state = createGame({ seed: 1, level: FLAT, craft: "skiff", quiet: true });
    placeRun(state, { ...START, speed: 0 });
    const c = state.craft;
    // Struck by hand, off the event the hull would have pushed.
    stepWash(state, [
      {
        kind: "land",
        t: state.t,
        vy: -5,
        airTime: 1,
        length: 0,
        pitch: 0,
        speed: 0,
        record: false,
        lengthRecord: false,
      },
    ]);
    expect(state.wash.count).toBe(1);
    expect(state.wash.a[0]).toBeCloseTo(W.splash * 5, 9);
    const at = (age: number, d: number) =>
      washAt(state.sea.washes, c.x + d, c.z, state.t + age, 1, sample).height;
    // Nothing inside the birth radius, ever: that water was the hull.
    expect(at(0.1, 0)).toBe(0);
    expect(at(1, 1)).toBe(0);
    // The packet at an age: its tallest crest, and where its energy stands
    // (the centroid of η² over the radius — crests run through the packet
    // at the phase speed, the packet itself goes out at the group speed).
    const crestAt = (age: number) => {
      let best = -1;
      let energy = 0;
      let moment = 0;
      for (let d = 0; d < 30; d += 0.05) {
        const h = at(age, d);
        if (h > best) best = h;
        energy += h * h;
        moment += h * h * d;
      }
      return { where: moment / energy, height: best };
    };
    // The ring rises over `rise`...
    const born = crestAt(0.05);
    const risen = crestAt(W.rise * 3);
    expect(born.height).toBeGreaterThan(0);
    expect(risen.height).toBeGreaterThan(born.height * 2);
    // ...and its packet goes out at the group speed, thinning as it goes.
    const early = crestAt(2);
    const late = crestAt(4);
    expect(late.where - early.where).toBeCloseTo(2 * WASH_GROUP, 0);
    expect(late.height).toBeLessThan(early.height);
    expect(late.height).toBeGreaterThan(0);
    // ...and it is gone by `maxAge`.
    expect(at(W.maxAge + 0.1, W.birth + WASH_GROUP * W.maxAge)).toBe(0);
  });
});

describe("what feels it", () => {
  it("is the sea's own surface: `surfaceAt` carries it and the hull is lifted by it", () => {
    const state = createGame({ seed: 1, level: FLAT, craft: "skiff", quiet: true });
    ride(state, 8, { throttle: 1 });
    // Where the V stands tallest across the trail, twelve metres back.
    let p = aft(state, 12, 0);
    let tallest = 0;
    for (let s = 0; s <= 12; s += 0.25) {
      const q = aft(state, 12, s);
      const h = Math.abs(washHeight(state, q.x, q.z));
      if (h > tallest) [tallest, p] = [h, q];
    }
    const withWash = heightAt(state.sea, FLAT, p.x, p.z, state.t);
    const ring = washHeight(state, p.x, p.z);
    expect(Math.abs(ring)).toBeGreaterThan(0.005);
    const kept = state.sea.washes.splice(0);
    const bare = heightAt(state.sea, FLAT, p.x, p.z, state.t);
    state.sea.washes.push(...kept);
    expect(bare).toBeCloseTo(0, 6);
    expect(withWash).toBeCloseTo(ring, 9);
    // The sample's slope and rate come with it.
    surfaceAt(state.sea, FLAT, p.x, p.z, state.t, undefined);
  });

  it("a hull does not ride up on its own fresh rings, and a rival on the same water does", () => {
    const state = createGame({ seed: 1, level: FLAT, craft: "skiff", quiet: true });
    ride(state, 8, { throttle: 1 });
    const c = state.craft;
    // Under the hull that laid them, nothing of the young sources stands.
    expect(washHeight(state, c.x, c.z)).toBe(0);
    expect(washHeight(state, c.x - 1, c.z)).toBe(0);
    // A hull length to the side there is a wave — a rival abreast would be
    // rocked by it — and the same water read by ANOTHER trail's owner is
    // the full wash.
    const beside = aft(state, 0, 4);
    const own = Math.abs(washHeight(state, beside.x, beside.z));
    expect(own).toBeGreaterThan(0);
    const w = state.wash;
    const [ox, oz] = [w.ownerX, w.ownerZ];
    w.ownerX = w.ownerZ = NaN;
    const unmasked = Math.abs(washHeight(state, c.x - 1, c.z));
    [w.ownerX, w.ownerZ] = [ox, oz];
    expect(unmasked).toBeGreaterThan(0);
  });

  it("the field lays its trails on the one sea, and the player's is the first", () => {
    const state = createGame({ seed: 7, craft: "skiff", mode: "race", quiet: true });
    expect(state.sea.washes).toHaveLength(state.rivals.length + 1);
    expect(state.sea.washes[0]).toBe(state.wash);
    for (const rival of state.rivals) {
      expect(rival.run.sea).toBe(state.sea);
      expect(state.sea.washes).toContain(rival.run.wash);
      expect(rival.run.wash).not.toBe(state.wash);
    }
    ride(state, state.rules.countdown + 6, { throttle: 1 });
    expect(state.rivals.some((r) => r.run.wash.count > 0)).toBe(true);
  });

  it("stays bounded at every throttle: a hull cannot heave itself into its own wave", () => {
    for (const throttle of [0, 0.1, 0.2, 0.35, 0.6, 1]) {
      const state = createGame({ seed: 1, level: FLAT, craft: "skiff", quiet: true });
      let worst = 0;
      let highest = 0;
      for (let i = 0; i < 20 * TUNING.physicsHz; i++) {
        step(state, { ...NEUTRAL_INPUT, throttle });
        const c = state.craft;
        if (i % 24 === 0) {
          for (let d = -10; d <= 10; d += 1) {
            worst = Math.max(worst, Math.abs(washHeight(state, c.x + d, c.z + 3)));
          }
        }
        highest = Math.max(highest, Math.abs(c.altitude));
      }
      expect(worst, `throttle ${throttle}`).toBeLessThan(W.maxCrest);
      expect(highest, `throttle ${throttle}`).toBeLessThan(1);
    }
  });

  it("the far water carries none of it: a sample of the longest components is the sea's own", () => {
    const state = createGame({ seed: 1, level: FLAT, craft: "skiff", quiet: true });
    ride(state, 8, { throttle: 1 });
    const p = aft(state, 12, 5);
    const long = surfaceAt(state.sea, FLAT, p.x, p.z, state.t, undefined, 2);
    expect(long.height).toBeCloseTo(0, 6);
  });

  it("fades out in the shallows", () => {
    const state = createGame({ seed: 1, level: FLAT, craft: "skiff", quiet: true });
    ride(state, 8, { throttle: 1 });
    const p = aft(state, 12, 5);
    const full = washAt(state.sea.washes, p.x, p.z, state.t, 1, sample).height;
    const half = washAt(state.sea.washes, p.x, p.z, state.t, 0.5, sample).height;
    expect(half).toBeCloseTo(full / 2, 9);
  });
});

describe("what holds it", () => {
  it("replays: the same ride lays the same trail, source for source", () => {
    const a = ride(createGame({ seed: 3, level: CHOP, windSpeed: 8, quiet: true }), 6, {
      throttle: 0.7,
      steer: 0.3,
    });
    const b = ride(createGame({ seed: 3, level: CHOP, windSpeed: 8, quiet: true }), 6, {
      throttle: 0.7,
      steer: 0.3,
    });
    expect(a.wash.count).toBeGreaterThan(0);
    expect(a.wash.count).toBe(b.wash.count);
    expect(Array.from(a.wash.x)).toEqual(Array.from(b.wash.x));
    expect(Array.from(a.wash.a)).toEqual(Array.from(b.wash.a));
    expect(Array.from(a.wash.t0)).toEqual(Array.from(b.wash.t0));
  });

  it("stands nowhere past its reach, and a moment stood forgets it", () => {
    const state = createGame({ seed: 1, level: FLAT, craft: "skiff", quiet: true });
    ride(state, 8, { throttle: 1 });
    const w = state.wash;
    expect(w.count).toBeGreaterThan(0);
    expect(WASH_REACH).toBeGreaterThan(WASH_WAVELENGTH * 3);
    const far = aft(state, 5, WASH_REACH + 1);
    expect(washHeight(state, far.x, far.z)).toBe(0);
    placeRun(state, { ...START, speed: 0 });
    expect(w.count).toBe(0);
    expect(washHeight(state, START.x + 5, START.z)).toBe(0);
    clearWash(w);
    expect(w.count).toBe(0);
  });
});
