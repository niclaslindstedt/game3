// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RENDERER FACADE: owns the THREE scene, builds the world once from a
// level, and draws one frame from the `GameState` the engine produced. The
// engine never imports THREE; this module never mutates the state — it
// reads the craft's position and quaternion, the progress, the clock, and
// hands the water mesh the sea to sample. The camera is maths in camera.ts
// and applied here in four lines; the sky and its lights are a stand-in
// until sky.ts is real (see its header).
//
// AXES: engine and three.js agree — x east, z north, y up, both
// right-handed — so the craft's quaternion goes straight onto the mesh and
// nothing here flips a sign. The one flip in the app is the screen↔engine
// steer in input-model.ts.

import * as THREE from "three";
import { heightAt, type CraftId, type GameState, type Level } from "@engine";

import { PALETTE } from "../identity.ts";
import { createCameraRig, verticalFovFor, type CameraMode, type CameraRig } from "./camera.ts";
import { buildCraft } from "./craft-body.ts";
import { CRAFT_STYLES } from "./craft-styles.ts";
import { createGates, type Gates } from "./gates.ts";
import { createPines } from "./pines.ts";
import { createRocks } from "./rocks.ts";
import { createWake } from "./spray.ts";
import { createTerrain, disposeTerrain } from "./terrain.ts";
import { createWaterMesh } from "./water-mesh.ts";

/** Near and far planes, m. The far is past the fog's end, so nothing pops;
 * the near is under the nose camera's own deck. */
const NEAR = 0.2;
const FAR = 2600;
/** Distance fog, m: where it starts and where it has taken everything.
 * Sized to the water grid — the far edge of the grid is well inside it. */
const FOG_NEAR = 140;
const FOG_FAR = 560;
/** The device pixel ratio ceiling: a 3× phone drawing nine pixels for
 * every one it can show is a phone at 20 fps. */
const MAX_DPR = 2;

/** What one frame cost, for the profile: the water's CPU time, the whole
 * frame's, and what the GPU was asked for. */
export type FrameCost = {
  waterMs: number;
  frameMs: number;
  calls: number;
  triangles: number;
};

export type GameRenderer = {
  /** Draw the state. `dt` is the frame's wall time, s, for the camera's
   * easing only. */
  render: (state: GameState, dt: number) => void;
  /** Rebuild the world for a new level or a new craft. */
  load: (state: GameState) => void;
  /** Let the trails see a state that is being stepped WITHOUT being drawn
   * — a scene pre-rolled for a screenshot — so the wake behind a craft
   * that has been under way for three seconds is three seconds long. */
  trail: (state: GameState) => void;
  camera: CameraRig;
  resize: () => void;
  cost: () => FrameCost;
  dispose: () => void;
};

/** Where the sun stands for an hour of the day, as a unit direction TOWARD
 * it in the engine's frame: up in the east at six, south at noon, down in
 * the west at eighteen, low in the north through the short night. A
 * stand-in for the sky system's own clock (sky.ts). */
function sunDirection(hour: number): THREE.Vector3 {
  const day = ((hour - 6) / 12) * Math.PI;
  const azimuth = Math.PI / 2 + day;
  // Never lower than a morning sun a few hours up: a grazing sun under
  // a stand-in sky with no sky light of its own leaves every near face
  // black.
  const elevation = Math.max(0.4, Math.sin(day) * 0.95);
  return new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ).normalize();
}

export function createRenderer(canvas: HTMLCanvasElement): GameRenderer {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.sky), FOG_NEAR, FOG_FAR);

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, NEAR, FAR);
  const rig = createCameraRig();

  // THE STAND-IN SKY (sky.ts): a hemisphere for the ambient — pale sky over
  // teal water — and one sun.
  // Generous ambient: with a sun this low, everything's near side is in
  // its own shadow, and a Lambert face lit by the hemisphere alone has to
  // still read — the buoys, the hull, the skerries all face the lens.
  const hemi = new THREE.HemisphereLight(
    new THREE.Color(PALETTE.sky),
    new THREE.Color(0x7f9aa3),
    2.3,
  );
  const sun = new THREE.DirectionalLight(0xfff2dc, 1.3);
  scene.add(hemi, sun);

  const water = createWaterMesh();
  scene.add(water.mesh, water.far);
  const wake = createWake();
  scene.add(wake.mesh);

  let world: THREE.Group | null = null;
  let terrain: THREE.Group | null = null;
  let gates: Gates | null = null;
  let craft: THREE.Group | null = null;
  let craftId: CraftId | null = null;
  let level: Level | null = null;

  const cost: FrameCost = { waterMs: 0, frameMs: 0, calls: 0, triangles: 0 };
  const aim = new THREE.Vector3();
  const upVec = new THREE.Vector3();
  const right = new THREE.Vector3();
  const forward = new THREE.Vector3();
  let fovWas = 0;

  const load = (state: GameState): void => {
    if (state.level !== level) {
      if (world) {
        scene.remove(world);
        if (terrain) disposeTerrain(terrain);
      }
      level = state.level;
      terrain = createTerrain(level);
      gates = createGates(level);
      world = new THREE.Group();
      world.add(terrain, createRocks(level), createPines(level), gates.group);
      scene.add(world);
      sun.position.copy(sunDirection(level.hour).multiplyScalar(400));
    }
    const id = state.craft.spec.id;
    if (id !== craftId) {
      if (craft) scene.remove(craft);
      craftId = id;
      craft = buildCraft(state.craft.spec, CRAFT_STYLES[id]);
      scene.add(craft);
    }
    wake.reset();
    rig.restand();
  };

  const resize = (): void => {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fovWas = 0;
  };

  const render = (state: GameState, dt: number): void => {
    const t0 = performance.now();
    if (state.level !== level || state.craft.spec.id !== craftId) load(state);
    const c = state.craft;
    if (craft) {
      craft.position.set(c.x, c.y, c.z);
      craft.quaternion.set(c.q.x, c.q.y, c.q.z, c.q.w);
    }
    // THE CAMERA, applied. The pose is the rig's; the lens is widened for a
    // narrow viewport so a phone held upright sees the same field across.
    const pose = rig.update(state, dt, (x, z) => heightAt(state.sea, state.level, x, z, state.t));
    cost.waterMs = water.update(state, c.x, c.z, pose.x, pose.y, pose.z);
    gates?.update(state);
    wake.update(state);

    camera.position.set(pose.x, pose.y, pose.z);
    aim.set(pose.aimX, pose.aimY, pose.aimZ);
    if (pose.roll !== 0) {
      // A rolled lens: the up vector banks about the line of sight, right
      // side down for a positive roll.
      forward.copy(aim).sub(camera.position).normalize();
      right.crossVectors(forward, upVec.set(0, 1, 0)).normalize();
      upVec.crossVectors(right, forward).normalize();
      camera.up
        .copy(upVec)
        .multiplyScalar(Math.cos(pose.roll))
        .addScaledVector(right, Math.sin(pose.roll));
    } else camera.up.set(0, 1, 0);
    camera.lookAt(aim);
    const fov = verticalFovFor(pose.fov, camera.aspect);
    if (Math.abs(fov - fovWas) > 0.05) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
      fovWas = fov;
    }

    renderer.render(scene, camera);
    cost.calls = renderer.info.render.calls;
    cost.triangles = renderer.info.render.triangles;
    cost.frameMs = performance.now() - t0;
  };

  resize();
  return {
    render,
    load,
    trail: (state) => wake.update(state),
    camera: rig,
    resize,
    cost: () => cost,
    dispose: () => {
      water.dispose();
      if (terrain) disposeTerrain(terrain);
      renderer.dispose();
    },
  };
}

export type { CameraMode };
