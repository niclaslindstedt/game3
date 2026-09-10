// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The camera rigs as maths (pwa/src/game/camera.ts): the outside lenses
// stand behind and above the craft, low enough for the 90s-racer read, keep
// their horizon level whatever the hull does, pull back and widen with pace,
// look through a turn, swing to the outside of a carve, hang their rod along
// the flight path in the air, and never go under the sea. The nose rig sits
// on the craft, and the camera key FLIES between them rather than cutting.
// No three.js, no DOM: the rigs are driven by a staged state and held to the
// framing rules.
import { describe, expect, it } from "vitest";

import { TUNING, createGame, placeRun, step, type GameState } from "@engine";

import {
  CAMERA_MODES,
  MAX_VFOV,
  REF_ASPECT,
  createCameraRig,
  verticalFovFor,
  type CameraPose,
} from "../pwa/src/game/camera.ts";
import { CHASE_RIGS, type ChaseCamera } from "../pwa/src/game/camera-rigs.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** The reference rig every framing rule below is stated against. */
const CHASE = CHASE_RIGS.chase;
/** The ladder's outside rungs, nearest the craft first. */
const OUTSIDE: readonly ChaseCamera[] = ["close", "chase", "far", "heli"];

const LEVEL = syntheticLevel({ windSpeed: 0, noSolids: true });
const FLAT = (): number => 0;
const DT = 1 / 60;

function fresh(): GameState {
  return createGame({ seed: 3, craft: "skiff", level: LEVEL, quiet: true });
}

/** Run the rig for `frames` frames of a still state and hand back the pose. */
function settle(
  state: GameState,
  frames = 240,
  mode: "chase" | ChaseCamera = "chase",
): { pose: CameraPose; rig: ReturnType<typeof createCameraRig> } {
  const rig = createCameraRig(mode);
  let pose = rig.update(state, DT, FLAT);
  for (let i = 0; i < frames; i++) pose = rig.update(state, DT, FLAT);
  return { pose, rig };
}

/** Where the craft is in the lens's own frame: how far behind, how high. */
function relative(
  pose: CameraPose,
  state: GameState,
): { behind: number; above: number; aside: number } {
  const c = state.craft;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const dx = pose.x - c.x;
  const dz = pose.z - c.z;
  return {
    behind: -(dx * fx + dz * fz),
    above: pose.y - c.y,
    aside: dx * fz - dz * fx,
  };
}

describe("the chase rig", () => {
  it("stands behind and above a craft at rest, low, looking ahead of it", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0.7 });
    const { pose } = settle(state);
    const r = relative(pose, state);
    expect(r.behind).toBeCloseTo(CHASE.dist, 3);
    expect(r.above).toBeCloseTo(CHASE.height, 3);
    expect(Math.abs(r.aside)).toBeLessThan(1e-6);
    // Low: a jet ski's lens is under three metres over the water.
    expect(r.above).toBeLessThan(3);
    // The aim is ahead of the craft, at the water — the horizon rides high.
    const c = state.craft;
    const ahead = (pose.aimX - c.x) * Math.sin(c.heading) + (pose.aimZ - c.z) * Math.cos(c.heading);
    expect(ahead).toBeCloseTo(CHASE.aimAhead, 3);
    expect(pose.aimY - c.y).toBeCloseTo(CHASE.aimHeight, 3);
    expect(pose.roll).toBe(0);
  });

  it("pulls back and widens with pace", () => {
    const slow = fresh();
    placeRun(slow, { x: 100, z: 200, heading: 0 });
    const fast = fresh();
    placeRun(fast, { x: 100, z: 200, heading: 0, speed: 24 });
    const a = settle(slow).pose;
    const b = settle(fast).pose;
    expect(relative(b, fast).behind).toBeGreaterThan(relative(a, slow).behind + 1);
    expect(b.fov).toBeGreaterThan(a.fov + 10);
    expect(b.fov).toBeLessThanOrEqual(CHASE.fovMax);
  });

  it("keeps the horizon level whatever the hull is doing", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 1, speed: 10, height: 3, pitch: 0.5, roll: 0.6 });
    const { pose } = settle(state, 30);
    expect(pose.roll).toBe(0);
    // The lens is still stood on the heading, not on the rolled body.
    const r = relative(pose, state);
    expect(Math.abs(r.aside)).toBeLessThan(0.5);
  });

  it("eases the yaw rather than snapping it, and looks through the turn", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0, speed: 15 });
    const { rig } = settle(state);
    // The craft is turned in one step; the lens has not yet come round.
    placeRun(state, { x: 100, z: 200, heading: 0.8, speed: 15 });
    state.craft.wy = 0.6;
    const pose = rig.update(state, DT, FLAT);
    const r = relative(pose, state);
    expect(Math.abs(r.aside)).toBeGreaterThan(1);
    // ...and the aim has slid toward the inside of the turn (the craft's
    // right, which is where a positive body yaw rate is taking the nose).
    let settled = pose;
    for (let i = 0; i < 240; i++) settled = rig.update(state, DT, FLAT);
    const c = state.craft;
    const rightX = Math.cos(c.heading);
    const rightZ = -Math.sin(c.heading);
    const aside = (settled.aimX - c.x) * rightX + (settled.aimZ - c.z) * rightZ;
    expect(aside).toBeGreaterThan(0.5);
    expect(aside).toBeLessThanOrEqual(CHASE.lookThroughMax + 1e-6);
  });

  it("tracks a launch: the aim climbs with the craft in the air", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0, speed: 15 });
    const { rig } = settle(state);
    placeRun(state, { x: 100, z: 200, heading: 0, speed: 15, height: 4, vy: 3 });
    let pose = rig.update(state, DT, FLAT);
    for (let i = 0; i < 60; i++) pose = rig.update(state, DT, FLAT);
    expect(pose.aimY).toBeGreaterThan(CHASE.aimHeight + 1.5);
  });

  it("never goes under the sea", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0 });
    const rig = createCameraRig();
    // A swell four metres high under the lens.
    let pose = rig.update(state, DT, () => 4);
    for (let i = 0; i < 10; i++) pose = rig.update(state, DT, () => 4);
    expect(pose.y).toBeGreaterThanOrEqual(4 + CHASE.clearance - 1e-9);
  });

  it("smooths the chop out of its height", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0 });
    const { rig } = settle(state);
    // The craft hops half a metre; the lens does not, in one frame.
    state.craft.y += 0.5;
    const pose = rig.update(state, DT, FLAT);
    expect(pose.y - state.craft.y).toBeLessThan(CHASE.height - 0.3);
  });

  it("follows a ridden craft without ever losing it", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0, speed: 5 });
    const rig = createCameraRig();
    for (let f = 0; f < 240; f++) {
      for (let i = 0; i < 2; i++)
        step(state, { steer: 0.6, throttle: 1, reverse: 0, lean: 0, reset: false });
      const pose = rig.update(state, 2 * TUNING.dt, FLAT);
      const c = state.craft;
      const d = Math.hypot(pose.x - c.x, pose.y - c.y, pose.z - c.z);
      expect(d).toBeGreaterThan(2);
      expect(d).toBeLessThan(CHASE.dist + 30 * CHASE.distPerSpeed + CHASE.height + 6);
      expect(Number.isFinite(pose.fov)).toBe(true);
    }
  });
});

describe("the nose rig", () => {
  it("sits on the craft and carries only part of its roll", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0.3, speed: 10, height: 2, pitch: 0.2, roll: 0.4 });
    const rig = createCameraRig("nose");
    let pose = rig.update(state, DT, FLAT);
    for (let i = 0; i < 120; i++) pose = rig.update(state, DT, FLAT);
    const c = state.craft;
    expect(Math.hypot(pose.x - c.x, pose.y - c.y, pose.z - c.z)).toBeLessThan(1.2);
    expect(pose.roll).toBeGreaterThan(0);
    expect(pose.roll).toBeLessThan(c.roll);
  });
});

/** Throw a craft off the water at pace and ride it back down, reading the
 * lens every frame. The landing is the moment both rules below are about:
 * it is where the rod's whole reading goes to nothing in one step. */
function flyAndLand(): { lens: number[]; behind: number[]; landed: number } {
  const state = fresh();
  placeRun(state, { x: 100, z: 200, heading: 0, speed: 18 });
  const rig = createCameraRig("chase");
  for (let i = 0; i < 200; i++) rig.update(state, DT, FLAT);
  placeRun(state, { x: 100, z: 200, heading: 0, speed: 18, height: 7, vy: 9 });
  const lens: number[] = [];
  const behind: number[] = [];
  let landed = -1;
  for (let f = 0; f < 300; f++) {
    for (let i = 0; i < 2; i++)
      step(state, { steer: 0, throttle: 0.6, reverse: 0, lean: 0, reset: false });
    const pose = rig.update(state, 2 * TUNING.dt, FLAT);
    // The first frames are the placement itself, not a flight.
    if (f < 12) continue;
    lens.push(pose.y);
    behind.push(relative(pose, state).behind);
    if (landed < 0 && !state.craft.airborne) landed = lens.length - 1;
  }
  return { lens, behind, landed };
}

describe("the flight rod", () => {
  it("tips the boom onto the flight path without changing its length", () => {
    const level = fresh();
    placeRun(level, { x: 100, z: 200, heading: 0, speed: 15 });
    const climb = fresh();
    placeRun(climb, { x: 100, z: 200, heading: 0, speed: 15, height: 6, vy: 10 });
    expect(climb.craft.airborne).toBe(true);
    // One update on a fresh rig STANDS it, so both poses are exact rather
    // than part-way through an ease.
    const a = createCameraRig().update(level, DT, FLAT);
    const b = createCameraRig().update(climb, DT, FLAT);
    const ra = relative(a, level);
    const rb = relative(b, climb);
    // The rod is exactly as long as the rig's own row says it should be at
    // that pace — turning it is a rotation, and a rotation does not change a
    // length, so the hull is as big in the frame off a ramp as it was on the
    // water. (The two states are at different SPEEDS, since a climb counts
    // into `speed`, so the length is read off the row rather than off the
    // level pose.)
    const s = climb.craft.speed;
    const rod = Math.hypot(
      CHASE.dist + s * CHASE.distPerSpeed,
      CHASE.height + s * CHASE.heightPerSpeed,
    );
    expect(Math.hypot(rb.behind, rb.above)).toBeCloseTo(rod, 6);
    // ...and it has swung DOWN under a craft that is going up, so the shot
    // looks along the flight rather than down at the water it left.
    expect(ra.above).toBeGreaterThan(0);
    expect(rb.above).toBeLessThan(0);
  });

  it("comes back to the water without snapping the lens through the frame", () => {
    const { lens } = flyAndLand();
    // JOLT is the second difference of the lens's height: a pan of any speed
    // has almost none of it, and a shot that snaps is nothing else. An eased
    // rod stops dead the frame a probe touches water — the reading it was
    // holding goes to nothing at once — and that one frame measured metres.
    // A mass cannot be stopped, so the whole gesture is continuous.
    let jolt = 0;
    for (let i = 2; i < lens.length; i++)
      jolt = Math.max(jolt, Math.abs(lens[i] - 2 * lens[i - 1] + lens[i - 2]));
    expect(jolt).toBeLessThan(0.5);
  });

  it("bounces at the landing: the rod dips under its natural angle, then back", () => {
    const { behind, landed } = flyAndLand();
    // The rod winds on through the fall and cannot stop at the horizontal,
    // so it swings THROUGH it: for a moment the boom is angled as if the
    // craft were CLIMBING, which stands it further back and drops the lens.
    // The standoff it settles on is its own natural length at that pace.
    const settled = behind[behind.length - 1];
    // At the moment a probe touches water the rod is STILL WOUND OVER the
    // craft — it spent the fall angled to look down the drop, which stands
    // the lens short and high — because a mass cannot unwind in one frame.
    // An eased rod is already back at its natural length here, which is the
    // snap itself; this is the assertion that tells the two apart.
    expect(behind[landed]).toBeLessThan(settled - 0.5);
    // Then it swings THROUGH the horizontal rather than arriving at it: for
    // a moment the boom is angled as if the craft were climbing, which
    // stands it further back than its natural length and drops the lens
    // under its natural angle.
    const bounce = Math.max(...behind.slice(landed, landed + 60));
    expect(bounce).toBeGreaterThan(settled + 0.05);
    // ...and it is SUBTLE — a nod, never a lurch away from the craft.
    expect(bounce).toBeLessThan(settled + 0.6);
    // ...and it settles back rather than ringing on: the second swing is
    // well inside the first, and the rod is home before the next wave.
    const ring = Math.max(...behind.slice(landed + 60));
    expect(ring - settled).toBeLessThan((bounce - settled) * 0.5);
  });
});

describe("the ladder", () => {
  it("stands every outside rig further back and higher than the last", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0.7 });
    let behind = 0;
    let above = 0;
    for (const mode of OUTSIDE) {
      const { pose } = settle(state, 240, mode);
      const r = relative(pose, state);
      expect(r.above).toBeGreaterThan(above);
      expect(r.behind).toBeGreaterThan(behind);
      expect(Math.abs(r.aside)).toBeLessThan(1e-6);
      behind = r.behind;
      above = r.above;
    }
  });

  it("swings the flown rigs wide of a turn and holds the near ones steady", () => {
    const swingOf = (mode: ChaseCamera): number => {
      const state = fresh();
      placeRun(state, { x: 100, z: 200, heading: 0, speed: 15 });
      const { rig } = settle(state, 240, mode);
      state.craft.wy = 0.8;
      let pose = rig.update(state, DT, FLAT);
      for (let i = 0; i < 240; i++) pose = rig.update(state, DT, FLAT);
      // The lens's own offset across the craft's axis: positive is the
      // craft's right, and a nose swinging right throws the lens LEFT.
      return relative(pose, state).aside;
    };
    const near = swingOf("chase");
    const flown = swingOf("heli");
    expect(near).toBeLessThan(0);
    expect(flown).toBeLessThan(near - 1);
    expect(Math.abs(flown)).toBeLessThanOrEqual(CHASE_RIGS.heli.swingMax + 1e-6);
  });
});

describe("the modes", () => {
  it("cycle through every mode and back", () => {
    const rig = createCameraRig(CAMERA_MODES[0]);
    const seen = [rig.mode()];
    for (let i = 1; i < CAMERA_MODES.length; i++) seen.push(rig.cycle());
    expect(seen).toEqual([...CAMERA_MODES]);
    expect(rig.cycle()).toBe(CAMERA_MODES[0]);
  });

  it("FLY between rigs rather than cutting, and land exactly on the new one", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0 });
    const { pose, rig } = settle(state);
    const was = { x: pose.x, y: pose.y, z: pose.z };
    rig.setMode("heli");
    // The first frame of the move is still near where the lens was standing:
    // a step from behind the transom to sixteen metres back and nine up is a
    // MOVE, and a cut is the one edit that tells the rider nothing.
    const first = rig.update(state, DT, FLAT);
    expect(Math.hypot(first.x - was.x, first.y - was.y, first.z - was.z)).toBeLessThan(2);
    // ...and within the move's own beat it is standing on the new rig, with
    // nothing left to catch up.
    let flown = first;
    for (let i = 0; i < 60; i++) flown = rig.update(state, DT, FLAT);
    const r = relative(flown, state);
    expect(r.behind).toBeCloseTo(CHASE_RIGS.heli.dist, 3);
    expect(r.above).toBeCloseTo(CHASE_RIGS.heli.height, 3);
  });

  it("restand the lens in one frame, abandoning a hand-over in flight", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0 });
    const { rig } = settle(state);
    rig.setMode("nose");
    rig.update(state, DT, FLAT);
    rig.setMode("chase");
    // A teleport: there is no framing worth flying across one.
    rig.restand();
    placeRun(state, { x: 500, z: 900, heading: 2 });
    const pose = rig.update(state, DT, FLAT);
    expect(relative(pose, state).behind).toBeCloseTo(CHASE.dist, 3);
  });
});

describe("verticalFovFor", () => {
  it("leaves a landscape lens alone and widens a portrait one, capped", () => {
    expect(verticalFovFor(60, REF_ASPECT)).toBe(60);
    expect(verticalFovFor(60, 2.2)).toBe(60);
    const portrait = verticalFovFor(60, 390 / 844);
    expect(portrait).toBeGreaterThan(60);
    expect(portrait).toBeLessThanOrEqual(MAX_VFOV);
    expect(verticalFovFor(84, 0.3)).toBe(MAX_VFOV);
  });
});
