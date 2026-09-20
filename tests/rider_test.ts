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
  HAUL,
  POSE_RANGE,
  REST_READ,
  STANCE,
  createRiderDynamics,
  dot,
  length,
  poseRider,
  riderHaul,
  solveLimb,
  sub,
  worthPosing,
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

describe("the arms survive every lean the inputs can ask for", () => {
  // THE BUG THIS HOLDS SHUT. Leaning forward pitches the torso about the
  // pelvis AND slides the pelvis forward under it, so the two together
  // walk the shoulders down onto the bars; leaning into a turn rolls the
  // torso and slides it across, which walks the INSIDE shoulder down the
  // rest of the way. Unbounded, the inside shoulder ended up on its own
  // grip, the two-bone solve had nowhere to put the elbow but straight
  // back through the shoulder, and that arm vanished inside the vest —
  // which from the chase camera is a one-armed rider. So the reach is
  // bounded at BOTH ends, and the elbow wings out as the arm folds.
  const ARM = BODY.upperArm + BODY.forearm;
  const CLOSE = STANCE.reachMin * ARM;
  /** The whole space the engine can hand the pose, coarsely swept: both
   * lean axes at their `TUNING.rider` reaches, the tuck, the stand, and
   * the springs at their stops. */
  function* reads(): Generator<RiderRead> {
    for (let a = -1; a <= 1; a += 0.25)
      for (let r = -1; r <= 1; r += 0.25)
        for (const tuck of [0, 1])
          for (const stand of [0, 1])
            for (const sway of [-DYNAMICS.swayMax, 0, DYNAMICS.swayMax])
              for (const crush of [DYNAMICS.crushMin, 0, DYNAMICS.crushMax])
                yield read({
                  aft: a * TUNING.rider.leanReach,
                  right: r * TUNING.rider.leanIn,
                  throttle: 1,
                  pace: 1,
                  tuck,
                  stand,
                  sway,
                  crush,
                });
  }

  for (const [id, cockpit] of cockpits()) {
    it(`${id}: no lean folds an arm past the elbow, and both hands stay on the grips`, () => {
      const grips: P[] = [
        [-cockpit.grip.x, cockpit.grip.y, cockpit.grip.z],
        [cockpit.grip.x, cockpit.grip.y, cockpit.grip.z],
      ];
      for (const r of reads()) {
        const p = poseRider(cockpit, r);
        for (let i = 0; i < 2; i++) {
          expect(length(sub(p.hands[i], grips[i]))).toBeLessThan(1e-9);
          // The upper arm is always its own length off the shoulder — an
          // elbow solved to anything else is the degenerate fold.
          expect(length(sub(p.elbows[i], p.shoulders[i]))).toBeCloseTo(BODY.upperArm, 6);
          expect(length(sub(p.hands[i], p.shoulders[i]))).toBeGreaterThanOrEqual(CLOSE - 1e-6);
        }
      }
    });

    it(`${id}: a folded arm swings its elbow WIDE of the shoulder-to-grip line`, () => {
      // What makes a folded arm visible at all: the elbow standing off the
      // line from the shoulder to the grip. Collapsed onto that line the
      // upper arm and the forearm lie along each other inside the chest,
      // which is the arm disappearing; a right angle at the elbow already
      // stands it 0.25 m off, and it only goes wider as the fold deepens.
      // Measured off the line rather than in any axis, so a rider hung
      // right off one side is judged the same as one sat square.
      const square = Math.hypot(BODY.upperArm, BODY.forearm);
      for (const r of reads()) {
        const p = poseRider(cockpit, r);
        for (let i = 0; i < 2; i++) {
          const line = sub(p.hands[i], p.shoulders[i]);
          if (length(line) > square) continue;
          const arm = sub(p.elbows[i], p.shoulders[i]);
          const along = dot(arm, line) / Math.max(1e-9, length(line));
          expect(Math.sqrt(Math.max(0, dot(arm, arm) - along * along))).toBeGreaterThan(0.2);
        }
      }
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

  it("does not throw the torso the wrong way when the craft gathers way astern", () => {
    // THE SURGE IS SIGNED. Differenced off |v|, a craft gathering way
    // backwards reads as one accelerating — so the body was thrown BACK by
    // a jet pushing it at the bars, and the torso snapped through the
    // vertical at the instant the hull changed ends. That snap is most of
    // what reads as the rider lurching about while backing off a mark.
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0, speed: 16 });
    const dyn = createRiderDynamics();
    const cockpit = cockpits().find(([id]) => id === "skiff")![1];
    const lean = (): number => poseRider(cockpit, dyn.read(state)).lean;
    const BRAKE = { steer: 0, throttle: 0, reverse: 1, lean: 0, crouch: 0, reset: false };
    let was = lean();
    let worst = 0;
    let crossed = false;
    for (let i = 0; i < 12 * TUNING.physicsHz; i++) {
      step(state, BRAKE);
      dyn.observe(state);
      const c = state.craft;
      const way = c.vx * Math.sin(c.heading) + c.vz * Math.cos(c.heading);
      if (way < -1) crossed = true;
      const now = lean();
      worst = Math.max(worst, Math.abs(now - was));
      was = now;
    }
    expect(crossed).toBe(true);
    // Nothing the body does is a step: every motion is a spring or the
    // engine's own lag, so no single 120 Hz step may move the torso by a
    // degree. The flip through the stop was worth nine of them.
    expect(worst).toBeLessThan(1 * (Math.PI / 180));
    // ...and he ends the reverse SAT UP, at the posture a runabout is
    // cruised in, not folded over the bars in a racing crouch.
    expect(lean()).toBeLessThan(STANCE.seatedLean + 0.12);
  });

  it("buys no crouch with the throttle the brake lever opens for the bucket", () => {
    // The gate can only turn flow the pump is already making, so the brake
    // opens the throttle itself (`pump.bucketThrottle` = 0.65). Read raw,
    // that made a rider hard on the brake read as a rider hard on the gas —
    // sat in a racing tuck at walking pace with the gate down. What the gate
    // has turned around is not driving him into any wind.
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0, speed: 16 });
    const dyn = createRiderDynamics();
    for (let i = 0; i < 10 * TUNING.physicsHz; i++) {
      step(state, { steer: 0, throttle: 0, reverse: 1, lean: 0, crouch: 0, reset: false });
      dyn.observe(state);
    }
    const c = state.craft;
    expect(c.bucket).toBeGreaterThan(0.9);
    expect(c.throttleEff).toBeGreaterThan(0.5);
    expect(dyn.read(state).throttle).toBeLessThan(0.1);
    // ...and the pace buys none either: there is no wind on a man crawling
    // astern at walking pace.
    expect(dyn.read(state).pace).toBe(0);
  });

  describe("the torso tends toward the world's vertical", () => {
    /** The roll spring settled on a hull held at `roll`, rad: the torso's
     * own roll relative to the deck. Nothing is stepped, so the lag has
     * nothing to answer to and what comes back is the REST it holds. */
    function settle(roll: number, over: { airborne?: boolean; righting?: number } = {}): number {
      const state = fresh();
      const dyn = createRiderDynamics();
      for (let i = 0; i < 2 * TUNING.physicsHz; i++) {
        state.craft.roll = roll;
        state.craft.airborne = over.airborne ?? false;
        state.craft.righting = over.righting ?? 0;
        dyn.observe(state);
      }
      return dyn.read(state).sway;
    }

    it("takes back a share of the heel — not none of it, and not all of it", () => {
      // A torso that follows the deck one for one is a figure bolted to the
      // saddle; one pinned exactly vertical is a spike that never moves.
      // The rule is that it is neither, at every heel the ride is made of.
      const heel = 0.35;
      const sway = settle(heel);
      expect(sway).toBeLessThan(-0.25 * heel);
      expect(sway).toBeGreaterThan(-0.75 * heel);
      expect(settle(-heel)).toBeCloseTo(-sway, 6);
      expect(settle(0)).toBeCloseTo(0, 6);
      // ...and it saturates rather than growing for ever: a hull far enough
      // over is taking him with it whatever his back wants. Still going the
      // right way, never twice as far for twice the heel.
      const far = settle(2 * heel);
      expect(far).toBeLessThan(sway);
      expect(far).toBeGreaterThan(2 * sway);
      expect(Math.abs(far)).toBeLessThanOrEqual(DYNAMICS.uprightMax + 1e-9);
      // The spring's stop is clear of it, so a wave taken on a heel still
      // has somewhere to swing.
      expect(DYNAMICS.swayMax).toBeGreaterThan(DYNAMICS.uprightMax + 0.15);
    });

    it("holds no vertical in the air, nor under the haul", () => {
      // Gravity has the man and the machine equally, and a side spin turns
      // the hull's roll through a whole revolution a torso must not chase.
      expect(settle(0.35, { airborne: true })).toBeCloseTo(0, 6);
      // The haul is a far bigger lean the same way, aimed at getting the
      // hull back over rather than at sitting straight, and it owns the
      // body while the hull is down.
      expect(settle(HAUL.toRoll + 0.5)).toBeCloseTo(0, 6);
      expect(settle(0.35, { righting: TUNING.capsize.righting })).toBeCloseTo(0, 6);
    });

    it("is a tendency and not a correction: no step snaps the body across", () => {
      // The whole of it lives in the roll spring's REST, so the body arrives
      // at a new posture over the spring's own time rather than being put
      // there. A run through a real seaway is the test: nothing the torso
      // does may be a step.
      const state = fresh();
      placeRun(state, { x: 100, z: 200, heading: 0, speed: 14 });
      const dyn = createRiderDynamics();
      const CARVE = { steer: 1, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false };
      let was = dyn.read(state).sway;
      let worst = 0;
      let heeled = 0;
      for (let i = 0; i < 10 * TUNING.physicsHz; i++) {
        step(state, CARVE);
        dyn.observe(state);
        const now = dyn.read(state).sway;
        worst = Math.max(worst, Math.abs(now - was));
        heeled = Math.max(heeled, Math.abs(state.craft.roll));
        was = now;
      }
      expect(heeled).toBeGreaterThan(0.2);
      expect(worst).toBeLessThan(1 * (Math.PI / 180));
    });
  });

  it("comes off the machine as the hull goes over, and back on as it is righted", () => {
    const state = fresh();
    expect(riderHaul(state)).toBe(0);
    // A carve is not a capsize: the ramp starts well past any lean.
    state.craft.roll = HAUL.fromRoll - 0.2;
    expect(riderHaul(state)).toBe(0);
    state.craft.roll = HAUL.toRoll + 0.5;
    expect(riderHaul(state)).toBe(1);
    // ...but nothing takes him off the bars in the air: an inverted hull
    // mid-backflip still has its rider on it.
    state.craft.airborne = true;
    expect(riderHaul(state)).toBe(0);
    state.craft.airborne = false;
    // The righting hands him back, eased over its own countdown.
    state.craft.roll = 0;
    state.craft.righting = TUNING.capsize.righting;
    expect(riderHaul(state)).toBe(1);
    state.craft.righting = TUNING.capsize.righting / 2;
    expect(riderHaul(state)).toBeCloseTo(0.5, 6);
    state.craft.righting = 0;
    expect(riderHaul(state)).toBe(0);
  });

  it("latches the side he went over and holds it through the haul", () => {
    const state = fresh();
    const dyn = createRiderDynamics();
    state.craft.roll = -3;
    dyn.observe(state);
    expect(dyn.read(state).haulSide).toBe(-1);
    // The roll runs back up through zero as the hull is hauled over; the
    // side he is in the water on does not follow it across the hull.
    state.craft.roll = 0.4;
    state.craft.righting = TUNING.capsize.righting / 2;
    dyn.observe(state);
    expect(dyn.read(state).haulSide).toBe(-1);
    expect(dyn.read(state).haul).toBeCloseTo(0.5, 6);
  });
});

describe("the haul", () => {
  const [, cockpit] = cockpits()[1];
  const hauling = (over: Partial<RiderRead>): RiderRead =>
    read({ haul: 1, haulSide: 1, haulPull: 0, ...over });

  it("is the seated pose again the moment it is over", () => {
    expect(poseRider(cockpit, read({ haul: 0, haulSide: -1, haulPull: 1 }))).toEqual(
      poseRider(cockpit, REST_READ),
    );
  });

  it("throws his weight at the side the hull has to come back toward", () => {
    const rest = poseRider(cockpit, REST_READ);
    const over = poseRider(cockpit, hauling({ haulSide: 1 }));
    // The hull went over to its right, so the weight goes left: the head
    // and the pelvis both, and a long way — this is the whole read.
    expect(over.pelvis[0]).toBeLessThan(rest.pelvis[0] - 0.04);
    expect(over.neck[0]).toBeLessThan(rest.neck[0] - 0.2);
    // ...and the other way over, the other way.
    const other = poseRider(cockpit, hauling({ haulSide: -1 }));
    expect(other.pelvis[0]).toBeCloseTo(-over.pelvis[0], 6);
    expect(other.neck[0]).toBeCloseTo(-over.neck[0], 6);
  });

  it("rocks at it rather than holding one angle", () => {
    // He went over to his right, so the deeper into a heave he is, the
    // further left his weight is.
    const pulls = [-1, 0, 1].map((haulPull) => poseRider(cockpit, hauling({ haulPull })).neck[0]);
    expect(pulls[1]).toBeLessThan(pulls[0]);
    expect(pulls[2]).toBeLessThan(pulls[1]);
    expect(pulls[0] - pulls[2]).toBeGreaterThan(0.1);
  });

  it("keeps his hands on the grips and his boots in the wells all through it", () => {
    const rest = poseRider(cockpit, REST_READ);
    for (const haul of [0.25, 0.5, 1]) {
      const p = poseRider(cockpit, hauling({ haul }));
      for (const i of [0, 1]) {
        expect(length(sub(p.hands[i], rest.hands[i]))).toBeLessThan(1e-9);
        expect(length(sub(p.hands[i], p.shoulders[i]))).toBeLessThan(
          BODY.upperArm + BODY.forearm + 1e-6,
        );
        expect(p.floors[i]).toBe(rest.floors[i]);
      }
    }
  });

  it("comes back to the seated pose as the haul fades", () => {
    let last = 1e9;
    const rest = poseRider(cockpit, REST_READ);
    for (const haul of [1, 0.75, 0.5, 0.25, 0.05]) {
      const away = length(sub(poseRider(cockpit, hauling({ haul })).neck, rest.neck));
      expect(away).toBeLessThan(last);
      last = away;
    }
    expect(last).toBeLessThan(0.1);
  });
});

describe("which riders are worth rebuilding (worthPosing)", () => {
  // Posing a rider re-emits the whole figure into its buffers, and a race
  // does that for twelve men every frame. It was 20% of a measured frame,
  // and most of it was spent on men who were not on screen.

  it("does not rebuild a rider the lens cannot see, however close he is", () => {
    expect(worthPosing(0, false)).toBe(false);
    expect(worthPosing(5, false)).toBe(false);
    // …and the near ones it CAN see are the whole point of the rule.
    expect(worthPosing(0, true)).toBe(true);
    expect(worthPosing(5, true)).toBe(true);
  });

  it("stops at the range a pose stops being legible, not at the draw distance", () => {
    expect(worthPosing(POSE_RANGE - 1, true)).toBe(true);
    expect(worthPosing(POSE_RANGE, true)).toBe(true);
    expect(worthPosing(POSE_RANGE + 1, true)).toBe(false);
    // A craft is still DRAWN well past this: what stops is re-solving the
    // man on it, who is some twenty pixels tall out there.
    expect(POSE_RANGE).toBeGreaterThan(50);
    expect(POSE_RANGE).toBeLessThan(200);
  });

  it("is a question about this frame alone, with nothing remembered", () => {
    // A rider who comes back into the lens is posed on the first frame he is
    // in it — his springs never stopped (`observe`), so what he is posed
    // from is a body that went on answering the hull while he was away.
    // Nothing here may depend on what was asked last frame.
    for (const metres of [0, 10, POSE_RANGE, POSE_RANGE * 2]) {
      expect(worthPosing(metres, true)).toBe(worthPosing(metres, true));
      expect(worthPosing(metres, false)).toBe(false);
    }
  });
});
