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
import { createCraftLamps, type CraftLamps } from "./craft-lamps.ts";
import { CRAFT_STYLES } from "./craft-styles.ts";
import { applyCraftSky, craftSurface } from "./craft-surface.ts";
import { cullByDistance } from "./draw-distance.ts";
import { createEnvironment, type Environment } from "./environment.ts";
import { createFauna, type Fauna } from "./fauna.ts";
import { setTextureAnisotropy } from "./fx-textures.ts";
import { createBuoys, type Buoys } from "./buoys.ts";
import { createGates, type Gates } from "./gates.ts";
import { createFlora, type Flora } from "./flora.ts";
import { createFootprints } from "./footprints.ts";
import { createReflection } from "./reflection.ts";
import { createRider, type Rider } from "./rider.ts";
import { createRocks } from "./rocks.ts";
import {
  DEFAULT_VIDEO,
  DISTANCE_LOOK,
  FLORA_SCALE,
  RAIN_LOOK,
  REFLECTION_SCALE,
  RESOLUTION_SCALE,
  SPRAY_SCALE,
  WAKE_LOOK,
  WATER_LOOK,
  type VideoSettings,
} from "./settings-video.ts";
import { dayLight } from "./sky.ts";
import { createSpray } from "./spray.ts";
import { createWake } from "./wake.ts";
import { createTerrain, disposeTerrain } from "./terrain.ts";
import { createWaterMesh, type WaterMesh } from "./water-mesh.ts";

/** Near and far planes, m. The far is past the sky's outermost shell — the
 * weather's ceiling at 2400 m — so nothing in the sky is ever clipped; the
 * near is under the nose camera's own deck. The fog's own range belongs to
 * the sky (`Preset.fogNear` / `fogFar`), because how far a rider can see is
 * a fact about the weather — and the DISTANCE row scales that range rather
 * than this plane, because the horizon disc stands out to 4 km and a far
 * plane inside it would cut the sea off from the sky. */
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
  // THE CRAFT'S SURFACE (craft-surface.ts): one material for the hull and
  // the rider, on the sky's own uniforms, so what the gel coat reflects is
  // the sky the water beside it reflects.
  const surface = craftSurface(sky.uniforms);

  // THE MIRROR (reflection.ts): the shore and the craft drawn from under
  // the water into a texture the sea reads. Made before the water, which
  // holds its picture and its matrix for the life of the material.
  const mirror = createReflection();
  // THE WAKE (wake.ts): what the craft did to the water, as a map the water
  // shader reads — nothing of it is in the scene. The spray stamps a
  // landing's foam into the same map.
  const wake = createWake();
  const spray = createSpray(wake.stamp);
  let water: WaterMesh = createWaterMesh(sky.uniforms, WATER_LOOK[video.water], mirror);
  water.setWake(wake.map);
  scene.add(water.mesh, water.far, spray.group);

  let world: THREE.Group | null = null;
  let terrain: THREE.Group | null = null;
  let fauna: Fauna | null = null;
  let flora: Flora | null = null;
  let gates: Gates | null = null;
  let buoys: Buoys | null = null;
  let craft: THREE.Group | null = null;
  let rider: Rider | null = null;
  let lamps: CraftLamps | null = null;
  let craftId: CraftId | null = null;
  let level: Level | null = null;

  const cost: FrameCost = { waterMs: 0, frameMs: 0, calls: 0, triangles: 0 };
  const eye = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const upVec = new THREE.Vector3();
  const right = new THREE.Vector3();
  const forward = new THREE.Vector3();
  const bufferSize = new THREE.Vector2();
  /** The lens's frustum this frame, for the water grid and the cover to
   * submit only what it can see. */
  const frustum = new THREE.Frustum();
  const viewProjection = new THREE.Matrix4();
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
      buoys = createBuoys(level);
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
        buoys.group,
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
      craft = buildCraft(state.craft.spec, CRAFT_STYLES[id], surface);
      // The rider is a child of the craft: the hull's pose is his.
      rider?.dispose();
      rider = createRider(cockpitOf(state.craft.spec, CRAFT_STYLES[id]), surface);
      craft.add(rider.mesh);
      // …and so are the lamps: the hull's pose aims the beam.
      lamps?.dispose();
      lamps = createCraftLamps(state.craft.spec, CRAFT_STYLES[id]);
      craft.add(lamps.group);
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
    water = createWaterMesh(sky.uniforms, WATER_LOOK[video.water], mirror);
    water.setWake(wake.map);
    water.setWakeLook(WAKE_LOOK[video.wake]);
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
    // THE WAKE is two halves that have to agree: the pass that draws the map
    // and the shader that reads it. Off is both off; the map is cleared once
    // on the way out so a stale road is never read back by a later press.
    wake.setDrawn(WAKE_LOOK[next.wake].map);
    water.setWakeLook(WAKE_LOOK[next.wake]);
    sky.setRainSheet(RAIN_LOOK[next.rain].sheet);
    flora?.setDensity(FLORA_SCALE[next.flora]);
    mirror.setScale(REFLECTION_SCALE[next.reflections]);
    // THE DISTANCE ROW pulls the fog in (or lets it out) to meet the radii the
    // frame will draw to; the radii themselves are applied per frame, because
    // they are measured from wherever the lens ends up.
    sky.setHaze(DISTANCE_LOOK[next.distance].haze);
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
    // THE CAMERA, applied — before the water and the cover, because both
    // submit only what the lens can see and have to be told where it stands.
    // The pose is the rig's; the lens is widened for a narrow viewport so a
    // phone held upright sees the same field across.
    const pose = rig.update(state, dt, (x, z) => heightAt(state.sea, state.level, x, z, state.t));
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
    camera.updateMatrixWorld();
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProjection);
    // The mirrored lens is posed with the real one, so the cover can cull
    // against both before either draws.
    mirror.aim(camera);

    cost.waterMs = water.update(state, c.x, c.z, frustum);
    gates?.update(state);
    buoys?.update(state, camera);
    if (buoys) water?.setBuoyLamps(buoys.lamps);
    // How far the rider can see into the water is the water mesh's answer, and
    // it is 0 with the window closed — so a closed window is also an empty sea
    // bed rather than a second rule about what to draw down there.
    const reach = video.fauna ? water.seeThrough() : 0;
    fauna?.update(state, c.x, c.z, reach);
    spray.update();

    // HOW MUCH WORLD IS SUBMITTED — from the LENS rather than from the craft,
    // because the helicopter seat can stand a long way off it and the rider is
    // looking through the camera either way. Everything dropped here is already
    // inside the fog the same row thickened (`draw-distance.ts`); the cover is
    // cut to the frustum as well, which the fog never does.
    const drawn = DISTANCE_LOOK[video.distance];
    if (terrain) cullByDistance(terrain, pose.x, pose.z, drawn.shore);
    flora?.update(frustum, pose.x, pose.z, drawn.cover, mirror.live() ? mirror.frustum : undefined);

    // The sky follows the lens, because it reads where the lens ended up:
    // the dome rides it, the rain's box wraps around it, and the cloud over
    // the sun is read at the craft.
    sky.update(state, eye.set(pose.x, pose.y, pose.z), dt);
    // …and the water answers to the light the sky just set. Per frame rather
    // than per level, because within a run the light MOVES: the sun goes
    // down, a sheet drifting over the sun dims the key, and the sea's glint
    // has to go with it or the water keeps a sparkle the sky no longer has.
    // The craft's mirror is compiled for the same sheet count the water's is.
    const p = sky.preset();
    water.retone(p, sky.hemi, sky.key, sky.cloudLayers());
    applyCraftSky(surface, sky.cloudLayers());
    water.setRain(sky.rainfall(), RAIN_LOOK[video.rain].rings);
    spray.light(sky.hemi, sky.key);
    fauna?.retone(p);
    // THE DARK: the craft's lamps come on with the sky's switch and are
    // worth what the dark makes them worth; the buoys light their own caps;
    // and the water reads the headlamp off the very spotlight the hull is
    // lit by.
    if (lamps) {
      lamps.setLit(p.lamps, 1 - dayLight(p));
      water.setLamp(lamps.light);
    }
    gates?.setNight(p.lamps);
    buoys?.setNight(p.lamps);

    // THE WAKE'S PASS: the trail rasterised into the map the water reads,
    // before anything reads it.
    const marks = wake.render(renderer, state);
    // THE MIRROR'S PASS, before the picture: everything that stands over the
    // water, without the water itself, the spray over it, the rain in the
    // air over it or the dome — the sea reflects the sky as a function
    // (sky-glsl.ts), and a dome drawn sharp into the mirror would put its
    // cloud edges back on the crests.
    const pass = mirror.render(renderer, scene, [
      water.mesh,
      water.far,
      spray.group,
      ...sky.unmirrored,
    ]);
    water.setMirror(mirror.live());

    renderer.render(scene, camera);
    cost.calls = renderer.info.render.calls + pass.calls + marks.calls;
    cost.triangles = renderer.info.render.triangles + pass.triangles + marks.triangles;
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
      mirror.dispose();
      fauna?.dispose();
      wake.dispose();
      spray.dispose();
      rider?.dispose();
      surface.dispose();
      lamps?.dispose();
      if (terrain) disposeTerrain(terrain);
      renderer.dispose();
    },
  };
}

export type { CameraMode };
