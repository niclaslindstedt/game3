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
import {
  CHASE_RIGS,
  EYE_RIGS,
  isEyeCamera,
  type ChaseCamera,
} from "../pwa/src/game/camera-rigs.ts";
import { syntheticLevel, pinSpeedClass } from "./support/synthetic.ts";

const DEG = Math.PI / 180;

// The rod, the springs and the righting are measured at the class they
// were written at (`pinSpeedClass`): their subject is not the roster's pace.
pinSpeedClass(1);

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
        step(state, { steer: 0.6, throttle: 1, reverse: 0, lean: 0, crouch: 0, reset: false });
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
    rig.setFit({ deck: () => 0.5, gripZ: 0.5 });
    let pose = rig.update(state, DT, FLAT);
    for (let i = 0; i < 120; i++) pose = rig.update(state, DT, FLAT);
    const c = state.craft;
    expect(Math.hypot(pose.x - c.x, pose.y - c.y, pose.z - c.z)).toBeLessThan(1.2);
    expect(pose.roll).toBeGreaterThan(0);
    expect(pose.roll).toBeLessThan(c.roll);
  });

  // A ROLLED LENS TILTS THE HORIZON, which is the one line in the picture a
  // rider balances against, and a horizon that swings through a turn is what
  // reads as motion sickness rather than as a hull leaning. A hull held on
  // the pump carves at some 20° and peaks near 37° (`make ride
  // SCENARIO=carve`), so both bolted-on rigs are held to a few degrees at
  // the carve and under ten at the peak — a ceiling, not a tuning, because
  // the share is a number somebody will reach for again.
  it.each([
    ["bow", 0.25],
    ["nose", 0.16],
  ] as const)("keeps %s's lens near level through a carve", (name, share) => {
    const CARVE = 20 * DEG;
    const PEAK = 37 * DEG;
    expect(EYE_RIGS[name].rollShare).toBeCloseTo(share, 6);
    expect(EYE_RIGS[name].rollShare * CARVE).toBeLessThan(6 * DEG);
    expect(EYE_RIGS[name].rollShare * PEAK).toBeLessThan(10 * DEG);
    // …and still carries the lean: a lens pinned level is a hull that never
    // banked.
    expect(EYE_RIGS[name].rollShare * CARVE).toBeGreaterThan(2 * DEG);
  });

  // A LENS BOLTED TO THE CRAFT IS STOOD ON THE CRAFT, not at a fixed offset
  // from the cog. The roster's decks differ by a quarter of a metre at the
  // same station and its bars sit anywhere from z 0.27 to 0.74, so fixed
  // offsets put one hull's lens 0.1 m over its foredeck and another's INSIDE
  // it — and a lens inside a closed hull is not a framing error but a hole:
  // the near plane cuts the deck open and the mesh has no back faces to
  // close it again, so the rider sees the sea through his own machine.
  it.each([
    ["bow", 1.15, 0.32],
    ["nose", 0.25, 0.37],
  ] as const)("stands %s off the hull it is on, not off the cog", (name, forward, over) => {
    const state = fresh();
    placeRun(state, { x: 100, z: 200, heading: 0, speed: 0 });
    const c = state.craft;
    // A deck that rises steeply with z, so a lens placed off the cog rather
    // than off the deck lands under it and the difference is unmissable.
    const GRIP_Z = 0.7;
    const deck = (z: number): number => 0.4 + 0.5 * z;
    const rig = createCameraRig(name);
    rig.setFit({ deck, gripZ: GRIP_Z });
    const pose = rig.update(state, DT, FLAT);
    const z = (EYE_RIGS[name].anchor === "grip" ? GRIP_Z : 0) + forward;
    expect(EYE_RIGS[name].forward).toBeCloseTo(forward, 6);
    expect(EYE_RIGS[name].overDeck).toBeCloseTo(over, 6);
    // Heading 0 is +z, so the body frame is the world's and the lens's
    // height over the craft is its clearance over the deck at that point.
    expect(pose.z - c.z).toBeCloseTo(z, 3);
    expect(pose.y - c.y).toBeCloseTo(deck(z) + over, 3);
  });

  // The ladder's two bolted-on rungs are read off the table rather than off
  // a list spelled out a second time, which is what lets `renderer.ts` ask
  // the same question the camera does about whose lamps are in the frame.
  it("knows which rungs of the ladder are aboard the craft", () => {
    for (const mode of CAMERA_MODES) {
      expect(isEyeCamera(mode)).toBe(mode === "bow" || mode === "nose");
    }
  });
});

/** WHERE A POINT SITS IN THE FRAME, vertically: 0 the middle of the
 * picture, ±1 its top and bottom edges, past ±1 outside it altogether.
 *
 * Every outside rig keeps its horizon level (`roll` is 0), so the frame's up
 * is the world's up taken square to the view axis, and a place in the
 * picture is the angle off that axis over the half field. This is the one
 * reading that says whether the RIDER IS STILL ON SCREEN — the standoff and
 * the lens height cannot, because a lens can hold both and still be pointed
 * over his head. */
function framedY(pose: CameraPose, p: { x: number; y: number; z: number }): number {
  const ax = pose.aimX - pose.x;
  const ay = pose.aimY - pose.y;
  const az = pose.aimZ - pose.z;
  const al = Math.hypot(ax, ay, az);
  const f = { x: ax / al, y: ay / al, z: az / al };
  // right = worldUp × forward, and up = forward × right, which with a level
  // horizon comes out as the view axis tipped a quarter turn in its own
  // vertical plane.
  const rl = Math.hypot(f.z, f.x) || 1;
  const u = { x: (-f.x * f.y) / rl, y: rl, z: (-f.y * f.z) / rl };
  const d = { x: p.x - pose.x, y: p.y - pose.y, z: p.z - pose.z };
  const along = d.x * f.x + d.y * f.y + d.z * f.z;
  const up = d.x * u.x + d.y * u.y + d.z * u.z;
  return up / along / Math.tan((pose.fov * Math.PI) / 360);
}

/** How far the lens is tilted out of the horizontal, deg, down negative. */
function viewPitch(pose: CameraPose): number {
  const ax = pose.aimX - pose.x;
  const ay = pose.aimY - pose.y;
  const az = pose.aimZ - pose.z;
  return (Math.asin(ay / Math.hypot(ax, ay, az)) * 180) / Math.PI;
}

/** Throw a craft off the water at pace and ride it back down, reading the
 * lens every frame. The landing is the moment three of the rules below are
 * about: it is where the rod's whole reading goes to nothing in one step. */
function flyAndLand(mode: ChaseCamera = "chase"): {
  lens: number[];
  behind: number[];
  framed: number[];
  pitch: number[];
  fall: number[];
  landed: number;
} {
  const state = fresh();
  placeRun(state, { x: 100, z: 200, heading: 0, speed: 18 });
  const rig = createCameraRig(mode);
  for (let i = 0; i < 200; i++) rig.update(state, DT, FLAT);
  placeRun(state, { x: 100, z: 200, heading: 0, speed: 18, height: 7, vy: 9 });
  const lens: number[] = [];
  const behind: number[] = [];
  const framed: number[] = [];
  const pitch: number[] = [];
  const fall: number[] = [];
  let landed = -1;
  for (let f = 0; f < 300; f++) {
    for (let i = 0; i < 2; i++)
      step(state, { steer: 0, throttle: 0.6, reverse: 0, lean: 0, crouch: 0, reset: false });
    const pose = rig.update(state, 2 * TUNING.dt, FLAT);
    // The first frames are the placement itself, not a flight.
    if (f < 12) continue;
    const c = state.craft;
    lens.push(pose.y);
    behind.push(relative(pose, state).behind);
    framed.push(framedY(pose, c));
    pitch.push(viewPitch(pose));
    fall.push(c.vy);
    if (landed < 0 && !c.airborne) landed = lens.length - 1;
  }
  return { lens, behind, framed, pitch, fall, landed };
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

  it("tilts the whole shot with the boom, so the rider never falls out of the frame", () => {
    for (const mode of OUTSIDE) {
      const { framed, pitch, fall, landed } = flyAndLand(mode);
      const where = `the ${mode} rig`;
      // Where the rider sits in the picture once the lens is home again:
      // low in the frame, which is the 90s-racer read — the craft along the
      // bottom and the horizon riding high.
      const rest = framed[framed.length - 1];
      expect(rest, where).toBeLessThan(0);
      expect(rest, where).toBeGreaterThan(-0.6);
      // THE WHOLE FLIGHT IS FRAMED THE SAME WAY. The boom turning onto the
      // path is a rotation of the whole shot about the craft — lens AND aim
      // — so what a flight moves is where the HORIZON sits, never where the
      // rider sits. Turning only the lens, as this did before, walked him
      // down the picture as the drop steepened and off the bottom edge of
      // it at the landing.
      for (let i = 0; i < framed.length; i++) {
        expect(Math.abs(framed[i]), `${where} at ${i}`).toBeLessThan(0.9);
        expect(Math.abs(framed[i] - rest), `${where} at ${i}`).toBeLessThan(0.25);
      }
      // ...and the lens gets there by LOOKING DOWN at him rather than by
      // standing further off: at the bottom of the drop the shot is pitched
      // well under the horizontal, which is the picture of a fall.
      const deepest = fall.indexOf(Math.min(...fall.slice(0, landed)));
      expect(pitch[deepest], where).toBeLessThan(-20);
    }
  });

  it("bounces the horizon back at the landing, not just the boom", () => {
    const { pitch, landed } = flyAndLand();
    const settled = pitch[pitch.length - 1];
    // The rod spent the fall wound over the craft with the shot pitched
    // down the drop...
    expect(pitch[landed]).toBeLessThan(settled - 20);
    // ...and cannot stop at the horizontal, so it swings THROUGH the angle
    // it settles on: the lens comes up past its natural pitch, the horizon
    // drops back down the frame, and it settles. That nod is the landing's
    // punctuation, and it is now something the PICTURE does rather than
    // something only the boom does.
    const nod = Math.max(...pitch.slice(landed, landed + 90));
    expect(nod).toBeGreaterThan(settled + 1);
    // ...and it is a nod, never a lurch up into the sky.
    expect(nod).toBeLessThan(settled + 12);
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
