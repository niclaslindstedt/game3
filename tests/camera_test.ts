// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The camera rig as maths (pwa/src/game/camera.ts): the chase lens stands
// behind and above the craft, low enough for the Wave Race read, keeps its
// horizon level whatever the hull does, pulls back and widens with pace,
// looks through a turn, tracks a launch, and never goes under the sea. The
// nose rig sits on the craft. No three.js, no DOM: the rig is driven by a
// staged state and held to the framing rules.
import { describe, expect, it } from "vitest";

import { TUNING, createGame, placeRun, step, type GameState } from "@engine";

import {
  CAMERA_MODES,
  CHASE,
  MAX_VFOV,
  REF_ASPECT,
  createCameraRig,
  verticalFovFor,
  type CameraPose,
} from "../pwa/src/game/camera.ts";
import { syntheticLevel } from "./support/synthetic.ts";

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
): { pose: CameraPose; rig: ReturnType<typeof createCameraRig> } {
  const rig = createCameraRig();
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
      for (let i = 0; i < 2; i++) step(state, { steer: 0.6, throttle: 1, lean: 0, reset: false });
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

describe("the modes", () => {
  it("cycle through every mode and back", () => {
    const rig = createCameraRig();
    const seen = [rig.mode()];
    for (let i = 1; i < CAMERA_MODES.length; i++) seen.push(rig.cycle());
    expect(seen).toEqual([...CAMERA_MODES]);
    expect(rig.cycle()).toBe(CAMERA_MODES[0]);
  });

  it("restand the lens in one frame on a mode change", () => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0 });
    const { rig } = settle(state);
    rig.setMode("nose");
    rig.setMode("chase");
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
