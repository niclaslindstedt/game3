// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The rider's pose (pwa/src/game/rider-pose.ts), held to the deck it is
// stood on: on every craft the hands are on the grips the builder drew,
// the feet on the footwell floor, the pelvis on the saddle (or over the
// tray, stood, on the stand-up), the head over the shoulders; the lean and
// the steer move the body the way the inputs mean; and the body on its
// springs compresses on a landing, rises in the air and comes back to
// rest. No three.js is exercised — the pose is arithmetic — and no DOM.
import { describe, expect, it } from "vitest";

import { CRAFT, TUNING, createGame, placeRun, step, type GameState } from "@engine";

import { CHASE_RIGS } from "../pwa/src/game/camera-rigs.ts";
import { cockpitOf, type Cockpit } from "../pwa/src/game/craft-body.ts";
import { CRAFT_STYLES } from "../pwa/src/game/craft-styles.ts";
import {
  BODY,
  DYNAMICS,
  REST_READ,
  STANCE,
  createRiderDynamics,
  length,
  poseRider,
  riderVisible,
  solveLimb,
  sub,
  type P,
  type RiderRead,
} from "../pwa/src/game/rider-pose.ts";
import { syntheticLevel, pinSpeedClass } from "./support/synthetic.ts";

// The rod, the springs and the righting are measured at the class they
// were written at (`pinSpeedClass`): their subject is not the roster's pace.
pinSpeedClass(1);

const LEVEL = syntheticLevel({ windSpeed: 0, noSolids: true, depth: 12 });

function cockpits(): [string, Cockpit][] {
  return CRAFT.map((spec) => [spec.id, cockpitOf(spec, CRAFT_STYLES[spec.id])]);
}

function read(over: Partial<RiderRead>): RiderRead {
  return { ...REST_READ, ...over };
}

describe("the pose on every craft", () => {
  for (const [id, cockpit] of cockpits()) {
    const rest = poseRider(cockpit, REST_READ);
    const spec = CRAFT.find((c) => c.id === id)!;

    it(`${id}: the hands are on the grips, the arms bent`, () => {
      const grips: P[] = [
        [-cockpit.grip.x, cockpit.grip.y, cockpit.grip.z],
        [cockpit.grip.x, cockpit.grip.y, cockpit.grip.z],
      ];
      for (let i = 0; i < 2; i++) {
        expect(length(sub(rest.hands[i], grips[i]))).toBeLessThan(1e-9);
        // The wrist is short of the grip by the fist, along the forearm.
        expect(length(sub(rest.hands[i], rest.wrists[i]))).toBeCloseTo(BODY.fist, 6);
        // The arm is the length the body says and the grip is within it —
        // straight at most, never short; on the shorter reaches, bent.
        expect(length(sub(rest.elbows[i], rest.shoulders[i]))).toBeCloseTo(BODY.upperArm, 6);
        const reach = length(sub(rest.hands[i], rest.shoulders[i]));
        expect(reach).toBeLessThanOrEqual(BODY.upperArm + BODY.forearm - 0.004);
        if (id === "skiff" || id === "dart")
          expect(reach).toBeLessThan(BODY.upperArm + BODY.forearm - 0.02);
      }
    });

    it(`${id}: the feet stand on the footwell floor, inside the wells`, () => {
      for (let i = 0; i < 2; i++) {
        const [x, y, z] = rest.ankles[i];
        expect(y).toBeCloseTo(cockpit.wells.floorAt(z) + BODY.sole, 6);
        expect(Math.abs(x)).toBeGreaterThan(cockpit.wells.inner);
        expect(Math.abs(x)).toBeLessThan(cockpit.wells.outer);
        expect(z).toBeGreaterThan(cockpit.wells.z0);
        expect(z).toBeLessThan(cockpit.wells.z1);
        expect(length(sub(rest.knees[i], rest.hips[i]))).toBeCloseTo(BODY.thigh, 6);
        expect(length(sub(rest.ankles[i], rest.knees[i]))).toBeCloseTo(BODY.shin, 6);
        // The knees are bent and up: higher than the ankles.
        expect(rest.knees[i][1]).toBeGreaterThan(rest.ankles[i][1] + 0.15);
      }
    });

    it(`${id}: the legs hang DOWN off the hips, knees ahead and below`, () => {
      // The posture the footwells' depth buys, and the one thing that
      // separates a rider from a man straddling a barrel: the wells are
      // sunk far enough below the saddle that the thighs slope DOWN to
      // the knees instead of out sideways with the knees up around the
      // bars. It is a rule about the deck as much as the pose, which is
      // why it is asserted on every craft the builder makes.
      for (let i = 0; i < 2; i++) {
        expect(rest.knees[i][1]).toBeLessThan(rest.hips[i][1]);
        expect(rest.knees[i][2]).toBeGreaterThan(rest.hips[i][2] + 0.15);
        // The boots are beside the saddle's base, not braced against the
        // outer wall: the thigh's splay off the centreline stays inside
        // what a man can sit at without doing the splits.
        const splay = Math.abs(rest.knees[i][0] - rest.hips[i][0]);
        const along = Math.hypot(
          rest.knees[i][1] - rest.hips[i][1],
          rest.knees[i][2] - rest.hips[i][2],
        );
        expect(Math.atan2(splay, along)).toBeLessThan(0.6);
      }
      if (!cockpit.standUp)
        expect(cockpit.seat.y - cockpit.wells.floorAt(cockpit.seat.z)).toBeGreaterThan(0.4);
    });

    it(`${id}: the pelvis is ${cockpit.standUp ? "stood over the tray" : "on the saddle"}`, () => {
      if (cockpit.standUp) {
        // Stood, at a real crouch: the hips are well up off the tray but
        // the legs are bent hard, which is how the machine is ridden.
        const floor = cockpit.wells.floorAt(rest.ankles[1][2]);
        const legs = BODY.thigh + BODY.shin;
        expect(rest.pelvis[1] - floor).toBeGreaterThan(legs * 0.55);
        expect(rest.pelvis[1] - floor).toBeLessThan(legs * 0.95);
      } else {
        expect(rest.pelvis[1]).toBeCloseTo(cockpit.seat.y + BODY.pelvis, 6);
        expect(rest.pelvis[2]).toBeGreaterThanOrEqual(cockpit.seat.z);
        expect(rest.pelvis[2]).toBeLessThanOrEqual(cockpit.seat.zMax);
      }
      expect(Math.abs(rest.pelvis[0])).toBeLessThan(1e-9);
    });

    it(`${id}: the torso leans forward to the bars and the head sits over the shoulders`, () => {
      // At idle a SEATED rider is nearly upright — a cruise, not a racing
      // crouch, which is what the throttle and the pace buy on top of it
      // — and a stand-up is ridden bent well over its pole.
      expect(rest.lean).toBeGreaterThan(cockpit.standUp ? 0.6 : 0.15);
      expect(rest.lean).toBeLessThan(cockpit.standUp ? STANCE.leanMax : 0.55);
      expect(rest.lean).toBeLessThanOrEqual(STANCE.leanMax);
      expect(rest.chest[1]).toBeGreaterThan(rest.pelvis[1] + 0.15);
      expect(rest.neck[1]).toBeGreaterThan(rest.chest[1]);
      // Inside the beam, and UNDER THE REFERENCE LENS: `chase` is the rung
      // the whole ladder's framing is derived from, and its eye rides
      // `height` over the craft. A rider whose crown reaches it has grown
      // past the envelope that framing was chosen for.
      //
      // It is a rail, not a proof of framing: every rung aims metres
      // AHEAD and above, so the horizon lands far up the frame and a crown
      // numerically over a tighter rung's `height` still blocks nothing.
      // Whether he occludes the water is settled by looking at the tight
      // rungs (`make screenshots SCENE=cruise ARGS="--camera close"`),
      // never by arithmetic here.
      const crown = rest.neck[1] + BODY.helmet * rest.headUp[1];
      expect(crown).toBeLessThan(CHASE_RIGS.chase.height - 0.1);
      expect(crown - spec.cog.y).toBeGreaterThan(0.7);
      for (const j of [...rest.shoulders, ...rest.elbows, ...rest.knees])
        expect(Math.abs(j[0])).toBeLessThan(spec.beam / 2 + 0.1);
    });
  }
});

describe("the inputs move the body", () => {
  const cockpit = cockpitOf(CRAFT[0], CRAFT_STYLES.skiff);
  const rest = poseRider(cockpit, REST_READ);

  it("leaning back slides the pelvis aft and sits the torso up; forward tucks it over the bars", () => {
    const back = poseRider(cockpit, read({ aft: TUNING.rider.leanReach }));
    const fwd = poseRider(cockpit, read({ aft: -TUNING.rider.leanReach }));
    expect(back.pelvis[2]).toBeLessThan(rest.pelvis[2] - 0.05);
    expect(fwd.pelvis[2]).toBeGreaterThan(rest.pelvis[2] + 0.05);
    // Leaning back moves the whole body aft — the chest with the pelvis —
    // with the arms straightening to keep the grips; the torso's angle
    // itself barely changes, which is what a real rider's does.
    expect(back.chest[2]).toBeLessThan(rest.chest[2] - 0.08);
    expect(back.lean).toBeLessThan(rest.lean + 0.15);
    expect(fwd.lean).toBeGreaterThan(rest.lean + 0.2);
    expect(fwd.chest[1]).toBeLessThan(rest.chest[1] - 0.05);
    // Leaning back is arms at full stretch, never hands off the grips.
    for (let i = 0; i < 2; i++) {
      expect(length(sub(back.hands[i], rest.hands[i]))).toBeLessThan(1e-9);
      expect(length(sub(back.hands[i], back.shoulders[i]))).toBeGreaterThan(
        length(sub(rest.hands[i], rest.shoulders[i])),
      );
    }
  });

  it("a turn hangs the body into it and turns the head through it", () => {
    const right = poseRider(cockpit, read({ right: TUNING.rider.leanIn }));
    expect(right.pelvis[0]).toBeGreaterThan(0.05);
    expect(right.chest[0]).toBeGreaterThan(right.pelvis[0] + 0.05);
    expect(right.headFwd[0]).toBeGreaterThan(0.2);
    const left = poseRider(cockpit, read({ right: -TUNING.rider.leanIn }));
    expect(left.chest[0]).toBeCloseTo(-right.chest[0], 6);
  });

  it("the throttle and pace tuck the rider down", () => {
    const flat = poseRider(cockpit, read({ throttle: 1, pace: 1 }));
    expect(flat.lean).toBeGreaterThan(rest.lean + 0.2);
    expect(flat.chest[1]).toBeLessThan(rest.chest[1]);
  });

  it("the tuck gets him right down behind the bars", () => {
    // The tuck has no HUD light: the figure IS the feedback that it is on,
    // so it has to read from the chase camera — chest lower than the
    // throttle and the pace alone put it, and further over the bars.
    const flat = poseRider(cockpit, read({ throttle: 1, pace: 1 }));
    const tucked = poseRider(cockpit, read({ throttle: 1, pace: 1, tuck: 1 }));
    expect(tucked.lean).toBeGreaterThan(flat.lean);
    expect(tucked.chest[1]).toBeLessThan(flat.chest[1]);
    // ...and the hands never leave the grips, tucked or not.
    expect(tucked.hands[0]).toEqual(flat.hands[0]);
    expect(tucked.hands[1]).toEqual(flat.hands[1]);
  });

  it("a compression folds the torso; an extension lifts the pelvis off the seat", () => {
    const hit = poseRider(cockpit, read({ crush: 0.1 }));
    const air = poseRider(cockpit, read({ crush: -0.08 }));
    expect(hit.lean).toBeGreaterThan(rest.lean + 0.1);
    expect(hit.pelvis[1]).toBeCloseTo(rest.pelvis[1], 6);
    expect(air.pelvis[1]).toBeCloseTo(rest.pelvis[1] + 0.08, 6);
  });
});

describe("two-bone IK", () => {
  it("keeps both lengths, bends toward the pole, and straightens on a target out of reach", () => {
    const a: P = [0, 0, 0];
    const { mid, end } = solveLimb(a, [0, 0, 0.5], 0.4, 0.4, [1, 0, 0]);
    expect(length(sub(mid, a))).toBeCloseTo(0.4, 9);
    expect(length(sub(end, mid))).toBeCloseTo(0.4, 9);
    expect(mid[0]).toBeGreaterThan(0.2);
    const far = solveLimb(a, [0, 0, 2], 0.4, 0.4, [1, 0, 0]);
    expect(length(sub(far.end, a))).toBeCloseTo(0.8, 2);
    expect(Math.abs(far.mid[0])).toBeLessThan(0.05);
  });
});

describe("the body on its springs", () => {
  function fresh(): GameState {
    return createGame({ seed: 5, craft: "skiff", level: LEVEL, quiet: true });
  }
  const INPUT = { steer: 0, throttle: 0.5, reverse: 0, lean: 0, crouch: 0, reset: false };

  it("rises off the seat in the air, compresses on the landing, and settles", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0, speed: 12, height: 2.5, vy: 0 });
    const dyn = createRiderDynamics();
    let maxRise = 0;
    let maxCrush = 0;
    let landedAt = -1;
    for (let i = 0; i < 4 * TUNING.physicsHz; i++) {
      step(state, INPUT);
      dyn.observe(state);
      const r = dyn.read(state);
      if (state.craft.airborne) maxRise = Math.min(maxRise, r.crush);
      if (landedAt < 0 && state.events.some((e) => e.kind === "land")) landedAt = i;
      if (landedAt >= 0 && i < landedAt + TUNING.physicsHz / 2)
        maxCrush = Math.max(maxCrush, r.crush);
    }
    expect(landedAt).toBeGreaterThan(0);
    expect(maxRise).toBeLessThan(-0.03);
    expect(maxCrush).toBeGreaterThan(0.03);
    expect(maxCrush).toBeLessThanOrEqual(DYNAMICS.crushMax);
    const settled = dyn.read(state);
    expect(Math.abs(settled.crush)).toBeLessThan(0.01);
    expect(Math.abs(settled.bob)).toBeLessThan(0.03);
  });

  it("swings the torso back when the pump opens", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0 });
    const dyn = createRiderDynamics();
    let minBob = 0;
    for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
      step(state, { steer: 0, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false });
      dyn.observe(state);
      minBob = Math.min(minBob, dyn.read(state).bob);
    }
    expect(minBob).toBeLessThan(-0.03);
  });

  it("reads the engine's rider, not the input", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0, speed: 10 });
    const dyn = createRiderDynamics();
    step(state, { steer: 1, throttle: 1, reverse: 0, lean: 1, crouch: 0, reset: false });
    dyn.observe(state);
    const r = dyn.read(state);
    expect(r.aft).toBe(state.craft.riderAft);
    expect(r.right).toBe(state.craft.riderRight);
    expect(r.throttle).toBe(state.craft.throttleEff);
    expect(r.pace).toBeGreaterThan(0);
    expect(r.pace).toBeLessThanOrEqual(1);
  });

  it("is off the craft while it is capsized or being righted", () => {
    const state = fresh();
    expect(riderVisible(state)).toBe(true);
    state.craft.righting = 0.2;
    expect(riderVisible(state)).toBe(false);
    state.craft.righting = 0;
    state.craft.capsizedFor = 0.5;
    expect(riderVisible(state)).toBe(false);
  });
});
