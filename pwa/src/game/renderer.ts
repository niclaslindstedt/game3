// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RENDERER FACADE: owns the THREE scene, builds the world once from a
// level, and draws one frame from the `GameState` the engine produced. The
// engine never imports THREE; this module never mutates the state — it
// reads the craft's position and quaternion, the progress, the clock, and
// hands the water mesh the sea to sample. The camera is maths in camera.ts
// and applied here in four lines; the sky, the fog and both lights belong
// to environment.ts, which owns everything in the scene that is air.
//
// AXES: engine and three.js agree — x east, z north, y up, both
// right-handed — so the craft's quaternion goes straight onto the mesh and
// nothing here flips a sign. The one flip in the app is the screen↔engine
// steer in input-model.ts.

import * as THREE from "three";
import { heightAt, type CraftId, type GameState, type Level } from "@engine";

import { sameViewport, viewportOf, type Viewport } from "../lib/viewport.ts";
import { createCameraRig, verticalFovFor, type CameraMode, type CameraRig } from "./camera.ts";
import { buildCraft, cockpitOf } from "./craft-body.ts";
import { CRAFT_STYLES } from "./craft-styles.ts";
import { createEnvironment, type Environment } from "./environment.ts";
import { createFauna, type Fauna } from "./fauna.ts";
import { setTextureAnisotropy } from "./fx-textures.ts";
import { createGates, type Gates } from "./gates.ts";
import { createFlora, type Flora } from "./flora.ts";
import { createFootprints } from "./footprints.ts";
import { createRider, type Rider } from "./rider.ts";
import { createRocks } from "./rocks.ts";
import {
  DEFAULT_VIDEO,
  FLORA_SCALE,
  RAIN_RING_REACH,
  RESOLUTION_SCALE,
  SPRAY_SCALE,
  WATER_LOOK,
  type VideoSettings,
} from "./settings-video.ts";
import { createSpray } from "./spray.ts";
import { createWake } from "./wake.ts";
import { createTerrain, disposeTerrain } from "./terrain.ts";
import { createWaterMesh, type WaterMesh } from "./water-mesh.ts";

/** Near and far planes, m. The far is past the sky's outermost shell — the
 * weather's ceiling at 2400 m — so nothing in the sky is ever clipped; the
 * near is under the nose camera's own deck. The fog's own range belongs to
 * the sky (`Preset.fogNear` / `fogFar`), because how far a rider can see is
 * a fact about the weather. */
const NEAR = 0.2;
const FAR = 4200;

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
  /** Re-measure the canvas and match the drawing buffer to it. Called for
   * you whenever the browser resizes the canvas; exposed for a host that
   * changes the box without the layout noticing. */
  resize: () => void;
  /** Take the rider's picture settings. Every row applies from the next
   * frame; the WATER row rebuilds the two water grids on its way, which is a
   * few milliseconds and always happens with a card up. Called with the whole
   * blob rather than a diff — this is the one place that knows which rows are
   * cheap to move and which are not. */
  setVideo: (video: VideoSettings) => void;
  /** Let the water effects see EVERY engine step — the wake, the spray
   * and the foam read the craft at the step's cadence and are drawn at
   * the frame's — including the steps of a scene pre-rolled for a
   * screenshot, so the wake behind a craft that has been under way for
   * three seconds is three seconds long and its last landing's splash is
   * still in the air. */
  observe: (state: GameState) => void;
  camera: CameraRig;
  cost: () => FrameCost;
  dispose: () => void;
};

export function createRenderer(
  canvas: HTMLCanvasElement,
  initialVideo: VideoSettings = DEFAULT_VIDEO,
): GameRenderer {
  let video = initialVideo;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, NEAR, FAR);
  const rig = createCameraRig();

  // THE SKY, and with it the fog and both lights (environment.ts).
  const sky: Environment = createEnvironment(scene);

  let water: WaterMesh = createWaterMesh(sky.uniforms, WATER_LOOK[video.water]);
  scene.add(water.mesh, water.far);
  const wake = createWake();
  const spray = createSpray();
  scene.add(wake.mesh, spray.group);

  let world: THREE.Group | null = null;
  let terrain: THREE.Group | null = null;
  let fauna: Fauna | null = null;
  let flora: Flora | null = null;
  let gates: Gates | null = null;
  let craft: THREE.Group | null = null;
  let rider: Rider | null = null;
  let craftId: CraftId | null = null;
  let level: Level | null = null;

  const cost: FrameCost = { waterMs: 0, frameMs: 0, calls: 0, triangles: 0 };
  const eye = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const upVec = new THREE.Vector3();
  const right = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const bufferSize = new THREE.Vector2();
  let fovWas = 0;
  let viewport: Viewport | null = null;

  const load = (state: GameState): void => {
    if (state.level !== level) {
      if (world) {
        scene.remove(world);
        if (terrain) disposeTerrain(terrain);
        fauna?.dispose();
        flora?.dispose();
      }
      level = state.level;
      terrain = createTerrain(level);
      gates = createGates(level);
      // The sea life is under the water rather than in it: an opaque thing
      // at a place, drawn before the transparent surface blends over it,
      // which is what makes a school look like it is being seen THROUGH
      // the water instead of painted on it.
      fauna = createFauna(level);
      // THE SHORE'S COVER (flora.ts): the trees, the scrub, the grass, the
      // reed in the river's margins and the loose stone at the waterline.
      flora = createFlora(level);
      flora.setDensity(FLORA_SCALE[video.flora]);
      world = new THREE.Group();
      world.add(
        terrain,
        createRocks(level),
        flora.group,
        createFootprints(level),
        gates.group,
        fauna.group,
      );
      scene.add(world);
      // The sky is the level's: its hour, its coast's latitude and the
      // weather it was generated under. The water answers to the same sky,
      // which is what keeps a sunset from floating over a teal sea.
      sky.load(level);
      // …and so is the WATER ITSELF: the coast's tones, its ramp, its window
      // and how far the rider sees into it (`water-optics.ts`). Set before
      // the horizon is painted out of it.
      water.setCoast(level.biome);
      water.retone(sky.preset(), sky.hemi, sky.key, sky.cloudLayers());
      fauna.retone(sky.preset());
    }
    const id = state.craft.spec.id;
    if (id !== craftId) {
      if (craft) scene.remove(craft);
      craftId = id;
      craft = buildCraft(state.craft.spec, CRAFT_STYLES[id]);
      // The rider is a child of the craft: the hull's pose is his.
      rider?.dispose();
      rider = createRider(cockpitOf(state.craft.spec, CRAFT_STYLES[id]));
      craft.add(rider.mesh);
      scene.add(craft);
    }
    wake.reset();
    spray.reset();
    rider?.reset();
    rig.restand();
  };

  // THE PICTURE'S SHAPE. The canvas's own CSS box is the truth about how
  // big the frame must be — the window's inner size is the fallback for the
  // one call made before the element has been laid out at all. The pixel
  // ratio is re-read every time with it, because a ratio can change under a
  // box that has not (a browser zoom, a window dragged to another display),
  // and a stale ratio is the same stretch as a stale box.
  const resize = (): void => {
    const next = viewportOf(
      canvas.clientWidth || window.innerWidth,
      canvas.clientHeight || window.innerHeight,
      window.devicePixelRatio,
      RESOLUTION_SCALE[video.resolution],
    );
    if (sameViewport(viewport, next)) return;
    viewport = next;
    renderer.setPixelRatio(next.dpr);
    renderer.setSize(next.w, next.h, false);
    camera.aspect = next.w / next.h;
    // The aspect is applied HERE and not left to the frame: the lens the
    // frame picks is a vertical fov derived from this aspect (hor+), so the
    // projection has to already know the new shape. `fovWas` is cleared so
    // that lens is recomputed rather than held from the old shape.
    camera.updateProjectionMatrix();
    fovWas = 0;
    renderer.getDrawingBufferSize(bufferSize);
  };

  /** Stand the two water grids up for the WATER row as it stands. The sky the
   * old ones were lit for is re-applied on the way out, so a rebuild mid-run
   * never flashes a noon sea under a squall. */
  const buildWater = (): void => {
    scene.remove(water.mesh, water.far);
    water.dispose();
    water = createWaterMesh(sky.uniforms, WATER_LOOK[video.water]);
    scene.add(water.mesh, water.far);
    if (level) water.setCoast(level.biome);
    water.retone(sky.preset(), sky.hemi, sky.key, sky.cloudLayers());
  };

  const setVideo = (next: VideoSettings): void => {
    const was = video;
    video = next;
    // The grids are geometry and the only row that has to rebuild anything.
    if (next.water !== was.water) buildWater();
    setTextureAnisotropy(WATER_LOOK[next.water].anisotropy);
    water.setWindow(next.seeThrough);
    // `viewport` is cleared rather than compared: `resize` short-circuits on a
    // box it has already measured, and the box has NOT changed — only what it
    // is worth in device pixels has.
    if (next.resolution !== was.resolution) {
      viewport = null;
      resize();
    }
    spray.setBudget(SPRAY_SCALE[next.spray]);
    flora?.setDensity(FLORA_SCALE[next.flora]);
    // The SKY stop recompiles the dome and, through the shared uniforms, the
    // water's mirror with it — which is why the water is re-toned after it
    // rather than left to the next level.
    sky.setLook(next.sky);
    water.retone(sky.preset(), sky.hemi, sky.key, sky.cloudLayers());
  };

  const render = (state: GameState, dt: number): void => {
    const t0 = performance.now();
    if (state.level !== level || state.craft.spec.id !== craftId) load(state);
    const c = state.craft;
    if (craft) {
      craft.position.set(c.x, c.y, c.z);
      craft.quaternion.set(c.q.x, c.q.y, c.q.z, c.q.w);
    }
    rider?.update(state);
    // THE CAMERA, applied. The pose is the rig's; the lens is widened for a
    // narrow viewport so a phone held upright sees the same field across.
    const pose = rig.update(state, dt, (x, z) => heightAt(state.sea, state.level, x, z, state.t));
    cost.waterMs = water.update(state, c.x, c.z);
    gates?.update(state);
    // How far the rider can see into the water is the water mesh's answer, and
    // it is 0 with the window closed — so a closed window is also an empty sea
    // bed rather than a second rule about what to draw down there.
    const reach = video.fauna ? water.seeThrough() : 0;
    fauna?.update(state, c.x, c.z, reach);
    wake.update(state);
    spray.update(state);

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
      spray.setLens(bufferSize.y, fov);
    }
    // The sky follows the lens LAST, because it reads where the lens ended
    // up: the dome rides it, the rain's box wraps around it, and the cloud
    // over the sun is read at the craft.
    sky.update(state, eye.set(pose.x, pose.y, pose.z), dt);
    // …and the water answers to the light the sky just set. Per frame rather
    // than per level, because within a run the light MOVES: a sheet drifting
    // over the sun dims the key, and the sea's glint has to go with it or
    // the water keeps a sparkle the sky no longer has.
    water.retone(sky.preset(), sky.hemi, sky.key, sky.cloudLayers());
    water.setRain(sky.rainfall(), RAIN_RING_REACH[video.rainRings]);

    renderer.render(scene, camera);
    cost.calls = renderer.info.render.calls;
    cost.triangles = renderer.info.render.triangles;
    cost.frameMs = performance.now() - t0;
  };

  resize();
  setVideo(video);
  // A phone turned on its side fires the window's `resize` BEFORE the page
  // has been laid out again, so a listener there measures the box the canvas
  // had in the OLD orientation and the buffer keeps the old shape — a
  // picture stretched or cramped until the app is restarted. A
  // ResizeObserver is told about the box after layout instead, which is the
  // only moment the number is right. Nothing here changes the canvas's CSS
  // box (`setSize` is called with `updateStyle` false), so the observer
  // cannot feed itself.
  const boxes = new ResizeObserver(resize);
  boxes.observe(canvas);
  // The window is still watched for the ratio-only change the observer never
  // sees: the box stays the same size in CSS px and every one of them is
  // suddenly worth more device pixels.
  window.addEventListener("resize", resize);

  return {
    render,
    load,
    resize,
    setVideo,
    observe: (state) => {
      wake.observe(state);
      spray.observe(state);
      rider?.observe(state);
    },
    camera: rig,
    cost: () => cost,
    dispose: () => {
      boxes.disconnect();
      window.removeEventListener("resize", resize);
      sky.dispose();
      water.dispose();
      fauna?.dispose();
      wake.dispose();
      spray.dispose();
      rider?.dispose();
      if (terrain) disposeTerrain(terrain);
      renderer.dispose();
    },
  };
}

export type { CameraMode };
