// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The catalog held to its own sheet: every craft reaches its documented top
// speed and 0–50 time on flat water within tolerance, turns at a radius of
// tens of metres under power and barely at all with the throttle shut, and
// the pump and the engine agree with each other. Change a row and this
// says what the change did.
import { describe, expect, it } from "vitest";

import {
  CRAFT,
  TUNING,
  boostFactor,
  craftById,
  angleDiff,
  createGame,
  curveTorque,
  jetCeiling,
  placeRun,
  pumpTorque,
  ratedTorque,
  staticThrust,
  step,
  accel0to50Of,
  classTorque,
  topSpeedOf,
  totalMass,
  type CraftInput,
  type GameState,
} from "@engine";

import { syntheticLevel } from "./support/synthetic.ts";

// A long flat sea with nothing on it: the drag strip.
const STRIP = syntheticLevel({ windSpeed: 0, noSolids: true, seaward: 1200, plan: 4000 });
const FULL: CraftInput = { steer: 0, throttle: 1, reverse: 0, lean: 0, reset: false };

function flatOut(id: string, seconds: number): { top: number; t50: number; state: GameState } {
  const state = createGame({ seed: 1, craft: id as "skiff", level: STRIP, quiet: true });
  placeRun(state, { x: -50, z: 400, heading: Math.PI / 2 });
  for (let i = 0; i < 3 * TUNING.physicsHz; i++) step(state, { ...FULL, throttle: 0 });
  let top = 0;
  let t50 = -1;
  let t = 0;
  for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
    step(state, FULL);
    t += TUNING.dt;
    const kmh = state.craft.speed * 3.6;
    if (t50 < 0 && kmh >= 50) t50 = t;
    if (kmh > top) top = kmh;
  }
  return { top, t50, state };
}

describe("the sheet", () => {
  for (const spec of CRAFT) {
    it(`${spec.id} reaches its top speed within 10% and 0–50 within 20%`, () => {
      const { top, t50, state } = flatOut(spec.id, 24);
      // Against `topSpeedOf`, not the raw catalog number: the SPEED CLASS
      // (`pump.speedClass`) scales what the physics delivers and that is
      // the one place it is applied, so this holds the two together at
      // whatever class is set.
      const want = topSpeedOf(spec) * 3.6;
      expect(top, "top speed km/h").toBeGreaterThan(want * 0.9);
      expect(top, "top speed km/h").toBeLessThan(want * 1.1);
      const want50 = accel0to50Of(spec);
      expect(t50, "0–50 s").toBeGreaterThan(want50 * 0.8);
      expect(t50, "0–50 s").toBeLessThan(want50 * 1.2);
      // ...on the plane, level, and still in the water.
      const c = state.craft;
      expect(c.planing).toBeGreaterThan(0.3);
      expect(c.airborne).toBe(false);
      expect(Math.abs(c.pitch)).toBeLessThan(0.15);
      expect(Math.abs(c.roll)).toBeLessThan(0.05);
      // The engine is near the limiter with the pump matched to it.
      expect(c.rpm).toBeGreaterThan(spec.maxRpm * 0.88);
    });
  }

  it("the sheet sits inside the real range of personal watercraft", () => {
    for (const spec of CRAFT) {
      expect(spec.mass).toBeGreaterThanOrEqual(150);
      expect(spec.mass).toBeLessThanOrEqual(420);
      expect(spec.powerKw).toBeGreaterThanOrEqual(60);
      expect(spec.powerKw).toBeLessThanOrEqual(230);
      expect(spec.topSpeed).toBeGreaterThanOrEqual(70);
      expect(spec.topSpeed).toBeLessThanOrEqual(110);
      expect(spec.deadrise).toBeGreaterThanOrEqual(16);
      expect(spec.deadrise).toBeLessThanOrEqual(24);
      expect(spec.riderMass).toBeGreaterThanOrEqual(75);
      expect(spec.riderMass).toBeLessThanOrEqual(85);
      expect(spec.maxRpm).toBeGreaterThanOrEqual(7000);
      expect(spec.maxRpm).toBeLessThanOrEqual(8000);
      // The hull is denser than the water would like: it floats, part in.
      const density = totalMass(spec) / spec.displacement;
      expect(density).toBeGreaterThan(300);
      expect(density).toBeLessThan(900);
    }
  });

  it("the four are actually different", () => {
    const tops = CRAFT.map((c) => c.topSpeed);
    expect(new Set(tops).size).toBe(4);
    const masses = CRAFT.map((c) => c.mass);
    expect(Math.max(...masses) / Math.min(...masses)).toBeGreaterThan(2);
    const marlin = CRAFT.find((c) => c.id === "marlin")!;
    const dart = CRAFT.find((c) => c.id === "dart")!;
    expect(marlin.topSpeed).toBe(Math.max(...tops));
    expect(dart.mass).toBe(Math.min(...masses));
  });
});

describe("the pump", () => {
  for (const spec of CRAFT) {
    it(`${spec.id}'s pump is matched to its engine at the limiter`, () => {
      const density = 1005;
      const pump = pumpTorque(spec, density, spec.maxRpm, true);
      // The BLOWER is in at the limiter, so this is the torque the pump
      // has to absorb — on the naturally aspirated craft it is the curve's
      // own last point, and on the blown one it is that times 1 + peak.
      const engine = ratedTorque(spec);
      expect(engine / curveTorque(spec, spec.maxRpm)).toBeCloseTo(1 + spec.boost.peak, 6);
      expect(pump / engine).toBeGreaterThan(0.85);
      expect(pump / engine).toBeLessThan(1.05);
      // The rated power lands on the curve at redline.
      const power = (engine * spec.maxRpm * 2 * Math.PI) / 60;
      // `powerKw` is the hull's own number AT CLASS 1; the class is a
      // bigger engine, so it scales with it (`classTorque`).
      expect(power / 1000).toBeCloseTo(spec.powerKw * classTorque(), 0);
      // Static pull is of the order of the weight — a jet ski, not a tug.
      // Under the class, which scales the thrust by the square of the pitch
      // it asks for while the hull weighs what it always did.
      const pull = staticThrust(spec, density);
      const weight = totalMass(spec) * TUNING.g;
      const byClass = classTorque() ** (2 / 3);
      expect(pull / weight).toBeGreaterThan(0.6 * byClass);
      expect(pull / weight).toBeLessThan(1.6 * byClass);
      // The jet leaves faster than the hull can ever go.
      expect(jetCeiling(spec)).toBeGreaterThan(topSpeedOf(spec) * 1.15);
    });
  }

  it("the engine revs free to the limiter with the intake out of the water", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: STRIP, quiet: true });
    placeRun(state, { x: 100, z: 400, heading: Math.PI / 2, speed: 15, height: 6, vy: 8 });
    for (let i = 0; i < 60; i++) step(state, FULL);
    expect(state.craft.airborne).toBe(true);
    expect(state.craft.rpm).toBeGreaterThan(state.craft.spec.maxRpm * 0.98);
  });
});

describe("steering", () => {
  function turned(
    id: string,
    throttle: number,
    speed = 20,
  ): { heading: number; radius: number; roll: number } {
    const state = createGame({ seed: 1, craft: id as "skiff", level: STRIP, quiet: true });
    placeRun(state, { x: 100, z: 700, heading: Math.PI / 2, speed });
    let last = state.craft.heading;
    // ACCUMULATED, step by step, not the endpoint difference: the tightest
    // hull here comes round further than half a circle inside the window,
    // and a shortest-way angle between two headings cannot say so — it
    // reads a 190° turn as −170°. Summing the step's own change unwraps it.
    let heading = 0;
    let radius = Infinity;
    let maxRoll = 0;
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
      step(state, { steer: 1, throttle, reverse: 0, lean: 0, reset: false });
      const c = state.craft;
      heading += angleDiff(last, c.heading);
      last = c.heading;
      if (i > 2 * TUNING.physicsHz && Math.abs(c.wy) > 0.05) {
        radius = Math.min(radius, c.speed / Math.abs(c.wy));
      }
      maxRoll = Math.max(maxRoll, c.roll);
    }
    return { heading, radius, roll: maxRoll };
  }

  for (const spec of CRAFT) {
    it(`${spec.id} turns at tens of metres under power and barely without`, () => {
      const on = turned(spec.id, 1);
      const off = turned(spec.id, 0);
      // Clockwise, as positive steer says.
      expect(on.heading).toBeGreaterThan(0.6);
      expect(on.radius).toBeGreaterThan(4);
      // The touring hull is the slowest to come round by design.
      expect(on.radius).toBeLessThan(spec.id === "otter" ? 120 : 80);
      // The throttle IS the steering: shut, the hull runs on. The stand-up
      // is the exception by design — its rider steers it by leaning, and
      // a leaned V bottom carves whether the pump is pushing or not.
      const ratio = spec.id === "dart" ? 1.2 : 1.8;
      expect(on.heading / Math.max(off.heading, 1e-3)).toBeGreaterThan(ratio);
      expect(off.heading).toBeLessThan(1.2);
      // ...and it banks INTO the turn, never out of it. The stand-up lays
      // over the way its riders do.
      expect(on.roll).toBeGreaterThan(0.05);
      expect(on.roll).toBeLessThan(spec.id === "dart" ? 1.6 : 0.9);
    });
  }

  for (const spec of CRAFT) {
    it(`${spec.id} still comes round at the top of its range`, () => {
      // THE HIGH-SPEED STEER (`pump.steerHighSpeed`). A turn rate is the
      // lateral acceleration over the speed, so an honest hull answers the
      // bars worst exactly where a course needs it most. These are the radii
      // the dial buys at 0.95 of each craft's top speed, with a quarter of
      // slack over the measured numbers in its comment — a floor under the
      // feel, not a restatement of the tuning.
      const top = topSpeedOf(spec);
      const fast = turned(spec.id, 1, top * 0.95);
      expect(fast.heading, `${spec.id} comes round`).toBeGreaterThan(1.2);
      const ceiling = spec.id === "otter" ? 54 : 48;
      expect(fast.radius, `${spec.id} radius at the top`).toBeLessThan(ceiling);
    });
  }

  it("the nozzle follows the hand, at the cable's rate", () => {
    const state = createGame({ seed: 1, craft: "skiff", level: STRIP, quiet: true });
    placeRun(state, { x: 100, z: 400, heading: 0, speed: 10 });
    step(state, { steer: 1, throttle: 1, reverse: 0, lean: 0, reset: false });
    const first = state.craft.nozzle;
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(state.craft.spec.nozzleAngle);
    for (let i = 0; i < 60; i++)
      step(state, { steer: 1, throttle: 1, reverse: 0, lean: 0, reset: false });
    expect(state.craft.nozzle).toBeCloseTo(state.craft.spec.nozzleAngle, 6);
    for (let i = 0; i < 60; i++)
      step(state, { steer: -1, throttle: 1, reverse: 0, lean: 0, reset: false });
    expect(state.craft.nozzle).toBeCloseTo(-state.craft.spec.nozzleAngle, 6);
  });

  it("leaning back at speed lifts the nose", () => {
    const run = (lean: number): number => {
      const state = createGame({ seed: 1, craft: "otter", level: STRIP, quiet: true });
      placeRun(state, { x: 100, z: 400, heading: Math.PI / 2, speed: 12 });
      let sum = 0;
      for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
        step(state, { steer: 0, throttle: 1, reverse: 0, lean, reset: false });
        if (i > 2 * TUNING.physicsHz) sum += state.craft.pitch;
      }
      return sum / TUNING.physicsHz;
    };
    expect(run(1)).toBeGreaterThan(run(0) + 0.006);
    expect(run(-1)).toBeLessThan(run(0) - 0.006);
  });
});

describe("the blower", () => {
  it("adds nothing below the onset and its full share at the limiter", () => {
    for (const spec of CRAFT) {
      const { peak, onset } = spec.boost;
      expect(boostFactor(spec, spec.idleRpm)).toBe(1);
      expect(boostFactor(spec, spec.maxRpm * onset)).toBeCloseTo(1, 6);
      expect(boostFactor(spec, spec.maxRpm)).toBeCloseTo(1 + peak, 6);
      // Monotone, and a SQUARE law rather than a straight one: at half way
      // up the boosted band a centrifugal blower has a quarter of its rise.
      const half = spec.maxRpm * (onset + (1 - onset) / 2);
      expect(boostFactor(spec, half)).toBeCloseTo(1 + peak * 0.25, 6);
    }
  });

  it("costs the blown craft its midrange, at the same rated power", () => {
    const marlin = craftById("marlin");
    expect(marlin.boost.peak).toBeGreaterThan(0);
    // The one blown craft on the roster: its rated power still lands at the
    // limiter, so what the blower bought at the top it gave up in the
    // middle — the trade the archetype exists for.
    // `powerKw` is the hull's own number AT CLASS 1 (`classTorque`).
    const ratedPower = (ratedTorque(marlin) * marlin.maxRpm * 2 * Math.PI) / 60 / 1000;
    expect(ratedPower).toBeCloseTo(marlin.powerKw * classTorque(), 0);
    const mid = marlin.maxRpm * 0.4;
    const blown = curveTorque(marlin, mid) * boostFactor(marlin, mid);
    const unblown = (marlin.powerKw * classTorque() * 1000 * 60) / (2 * Math.PI * marlin.maxRpm);
    expect(blown).toBeLessThan(unblown);
    for (const spec of CRAFT) {
      if (spec.id !== "marlin") expect(spec.boost.peak).toBe(0);
    }
  });
});

describe("the reverse bucket", () => {
  /** Flat out, then the brake lever hard down and held. */
  function onTheBrake(id: string, seconds: number) {
    const spec = craftById(id);
    const state = createGame({ seed: 1, craft: id as "skiff", level: STRIP, quiet: true });
    placeRun(state, { x: 100, z: 200, heading: Math.PI / 2, speed: (spec.topSpeed / 3.6) * 0.7 });
    const v0 = state.craft.speed;
    const BRAKE: CraftInput = { steer: 0, throttle: 0, reverse: 1, lean: 0, reset: false };
    let stopped = -1;
    let lowestPitch = 0;
    for (let i = 0; i < seconds * TUNING.physicsHz; i++) {
      step(state, BRAKE);
      const c = state.craft;
      const along = c.vx * Math.sin(c.heading) + c.vz * Math.cos(c.heading);
      if (stopped < 0 && along <= 0) stopped = i / TUNING.physicsHz;
      if (stopped > 0) lowestPitch = Math.min(lowestPitch, c.pitch);
    }
    const c = state.craft;
    return {
      stopped,
      lowestPitch,
      along: c.vx * Math.sin(c.heading) + c.vz * Math.cos(c.heading),
      v0,
      bucket: c.bucket,
    };
  }

  /** Degrees of heading turned, full right lock held for three seconds from
   * `speed`, with whatever else the thumb is doing. */
  function withLock(id: string, speed: number, given: Partial<CraftInput>): number {
    const state = createGame({ seed: 1, craft: id as "skiff", level: STRIP, quiet: true });
    placeRun(state, { x: 100, z: 700, heading: Math.PI / 2, speed });
    const input: CraftInput = {
      steer: 1,
      throttle: 0,
      reverse: 0,
      lean: 0,
      reset: false,
      ...given,
    };
    let last = state.craft.heading;
    let heading = 0;
    for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
      step(state, input);
      heading += angleDiff(last, state.craft.heading);
      last = state.craft.heading;
    }
    return (heading * 180) / Math.PI;
  }

  it("stops a craft that has one, and backs it up at walking pace", () => {
    for (const spec of CRAFT) {
      const r = onTheBrake(spec.id, 14);
      if (spec.bucket.reverse <= 0) continue;
      expect(r.bucket, `${spec.id} gate down`).toBeCloseTo(1, 3);
      // It stops, inside the window and not instantly.
      expect(r.stopped, `${spec.id} stops`).toBeGreaterThan(1);
      expect(r.stopped, `${spec.id} stops`).toBeLessThan(10);
      // ...and then goes ASTERN, at a pace a transom pushed backwards
      // through the water can manage and no more.
      expect(r.along, `${spec.id} astern m/s`).toBeLessThan(-0.5);
      // Walking pace AT CLASS 1 — the bucket catches a jet the class has
      // made faster, so what it can push astern grows with it too.
      expect(r.along * -3.6, `${spec.id} astern km/h`).toBeLessThan(20 * TUNING.pump.speedClass);
      // Braking puts the BOW DOWN: the gate's spill lifts the stern and the
      // reverse thrust acts below the centre of gravity, and both agree.
      expect(r.lowestPitch, `${spec.id} bow down`).toBeLessThan(-0.02);
    }
  });

  it("brakes INTO the turn the bars are pointing, and harder than a coast", () => {
    // The gate is downstream of the nozzle and its side walls send what it
    // catches forward on the side the nozzle threw it, so the steering
    // reaction keeps one sign however far down the gate is. A brake pulled
    // with way still on therefore turns the way the bars point — and turns
    // BETTER than a coast, because the gate is holding the throttle open
    // (`pump.bucketThrottle`) and burying the bow into its own sponsons.
    for (const spec of CRAFT) {
      const speed = topSpeedOf(spec) * 0.7;
      const brake = withLock(spec.id, speed, { reverse: 1 });
      const coast = withLock(spec.id, speed, {});
      if (spec.bucket.reverse <= 0) {
        // Nothing fitted, nothing to tell apart: the stand-up coasts.
        expect(brake, `${spec.id} has no gate`).toBeCloseTo(coast, 6);
        continue;
      }
      // Clockwise, as positive steer says — the bug this holds shut turned
      // the skiff 20° the OTHER way over the same three seconds.
      expect(brake, `${spec.id} brakes into the turn`).toBeGreaterThan(0);
      expect(brake / coast, `${spec.id} brake over coast`).toBeGreaterThan(1.8);
    }
  });

  it("backs the craft the other way round, travelling stern-first", () => {
    // ...and THAT is the inversion a rider feels in reverse: not a flipped
    // moment, a hull going backwards. Full right lock from rest swings the
    // bow right and walks the craft astern to the LEFT.
    const state = createGame({ seed: 1, craft: "skiff", level: STRIP, quiet: true });
    placeRun(state, { x: 100, z: 700, heading: Math.PI / 2, speed: 0 });
    const x0 = state.craft.x;
    const z0 = state.craft.z;
    let bow = 0;
    let last = state.craft.heading;
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      step(state, { steer: 1, throttle: 0, reverse: 1, lean: 0, reset: false });
      bow += angleDiff(last, state.craft.heading);
      last = state.craft.heading;
    }
    // Heading east: +z is to the left of the hull, +x is ahead of it.
    const along = state.craft.x - x0;
    const across = state.craft.z - z0;
    expect(bow, "the bow swings right").toBeGreaterThan(0.1);
    expect(along, "it goes astern").toBeLessThan(-0.5);
    expect(across, "and walks to the left").toBeGreaterThan(0.2);
  });

  it("does nothing at all on a craft with no bucket fitted", () => {
    const dart = craftById("dart");
    expect(dart.bucket.reverse).toBe(0);
    const r = onTheBrake("dart", 14);
    expect(r.bucket).toBe(0);
    // Never stops, never reverses: it coasts, and keeps going the way it
    // was pointed. That is the stand-up's whole bargain.
    expect(r.stopped).toBe(-1);
    expect(r.along).toBeGreaterThan(0);
    expect(r.along).toBeLessThan(r.v0);
  });

  it("swings at the gate's own rate, and stows again when let go", () => {
    const state = createGame({ seed: 1, craft: "otter", level: STRIP, quiet: true });
    const deploy = state.craft.spec.bucket.deploy;
    placeRun(state, { x: 100, z: 400, heading: Math.PI / 2, speed: 15 });
    const BRAKE: CraftInput = { steer: 0, throttle: 0, reverse: 1, lean: 0, reset: false };
    step(state, BRAKE);
    // Not there on the first step — a gate that snapped down would be a
    // brake with no travel in it.
    expect(state.craft.bucket).toBeGreaterThan(0);
    expect(state.craft.bucket).toBeLessThan(0.2);
    for (let i = 0; i < deploy * TUNING.physicsHz + 2; i++) step(state, BRAKE);
    expect(state.craft.bucket).toBeCloseTo(1, 3);
    for (let i = 0; i < deploy * TUNING.physicsHz + 2; i++) {
      step(state, { steer: 0, throttle: 0, reverse: 0, lean: 0, reset: false });
    }
    expect(state.craft.bucket).toBe(0);
  });
});

describe("the trim", () => {
  it("follows the lean on a craft that has it, and never moves on one that has not", () => {
    for (const id of ["otter", "dart"] as const) {
      const state = createGame({ seed: 1, craft: id, level: STRIP, quiet: true });
      const range = state.craft.spec.trimRange;
      placeRun(state, { x: 100, z: 400, heading: Math.PI / 2, speed: 15 });
      for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
        step(state, { steer: 0, throttle: 1, reverse: 0, lean: 1, reset: false });
      }
      // Leaning back trims UP, to the craft's own stop — and the stand-up
      // has no trim system at all, so it stays at nothing.
      expect(state.craft.trim, `${id} trimmed`).toBeCloseTo(range, 3);
      for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
        step(state, { steer: 0, throttle: 1, reverse: 0, lean: -1, reset: false });
      }
      expect(state.craft.trim, `${id} trimmed down`).toBeCloseTo(-range, 3);
    }
    expect(craftById("dart").trimRange).toBe(0);
  });
});
