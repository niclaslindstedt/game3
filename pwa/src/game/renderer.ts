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
import { heightAt, surfaceAt, type CraftId, type GameState, type Level } from "@engine";

import { sameViewport, viewportOf, type Viewport } from "../lib/viewport.ts";
import type { FrameCost, SceneShare } from "./benchmark-report.ts";
import { createCameraRig, verticalFovFor, type CameraMode, type CameraRig } from "./camera.ts";
import { isEyeCamera } from "./camera-rigs.ts";
import { createCheckpointArrow } from "./checkpoint-arrow.ts";
import { gradeOf } from "./colour-grade.ts";
import { buildCraft, cockpitOf, deckOf, wellCutOf, type WellCut } from "./craft-body.ts";
import { createCraftLamps, type CraftLamps } from "./craft-lamps.ts";
import { CRAFT_STYLES } from "./craft-styles.ts";
import { applyCraftSky, craftSurface } from "./craft-surface.ts";
import { cullByDistance } from "./draw-distance.ts";
import { createEdgeNet, type EdgeNet } from "./edge-net.ts";
import { createBirds, type Birds } from "./birds.ts";
import { createEnvironment, type Environment } from "./environment.ts";
import { createFauna, type Fauna } from "./fauna.ts";
import { setTextureAnisotropy } from "./fx-textures.ts";
import { createBuoys, nearestLamps, type Buoys, type BuoyLamp } from "./buoys.ts";
import { createGates, type Gates } from "./gates.ts";
import { createGradePass, type GradePass } from "./grade-pass.ts";
import { createGuideLine, type GuideLine } from "./guide-line.ts";
import { createFlora, type CoverMirror, type Flora } from "./flora.ts";
import { createFootprints } from "./footprints.ts";
import { createReflection } from "./reflection.ts";
import { createRider, type Rider } from "./rider.ts";
import { createRocks } from "./rocks.ts";
import {
  DEFAULT_VIDEO,
  DISTANCE_LOOK,
  FLORA_SCALE,
  RAIN_LOOK,
  REFLECTION_LOOK,
  RESOLUTION_SCALE,
  SPLASH_LOOK,
  SPRAY_SCALE,
  WAKE_LOOK,
  WATER_LOOK,
  type VideoSettings,
} from "./settings-video.ts";
import { dayLight } from "./sky.ts";
import { createSpray } from "./spray.ts";
import { createWake } from "./wake.ts";
import { createSeaIce, disposeSeaIce } from "./sea-ice.ts";
import { createTerrain, disposeTerrain } from "./terrain.ts";
import { waterRings } from "./water-grid.ts";
import { createWaterMesh, type WaterMesh } from "./water-mesh.ts";

/** Nothing lit, for a level with no marks of one kind on it — a coast
 * sprint has no rounding buoys at all. Stated once so the pick is handed a
 * list rather than a null and allocates nothing to say "none". */
const NO_LAMPS: readonly BuoyLamp[] = [];

/** HOW SEE-THROUGH A GHOST IS (`ghost-run.ts`). Enough of the hull is left
 * to read its shape, its colour and which way the rider is leaning, and
 * enough of the water shows through it that nobody mistakes it for a craft
 * that could be leaned on. It writes no depth either, so the sea and the
 * spray behind it are never punched out by a hull that is not really there. */
const GHOST_ALPHA = 0.42;

/** Near and far planes, m. The far is past the sky's outermost shell — the
 * weather's ceiling at 2400 m — so nothing in the sky is ever clipped; the
 * near is under the nose camera's own deck. The fog's own range belongs to
 * the sky (`Preset.fogNear` / `fogFar`), because how far a rider can see is
 * a fact about the weather — and the DISTANCE row scales that range rather
 * than this plane, because the horizon disc stands out to 4 km and a far
 * plane inside it would cut the sea off from the sky. */
const NEAR = 0.2;
const FAR = 4200;

/** THE SEA, NAMED for the benchmark's scene breakdown — the near grid and the
 * far one under one heading, because a report saying the water is half the
 * frame's triangles is the useful reading and "near grid" against "far grid"
 * is a detail that belongs in `water-grid.ts`. Called wherever a mesh is
 * built, which is twice: once here and again whenever WATER or DISTANCE moves
 * and the grids are laid afresh. */
function nameWater(mesh: WaterMesh): void {
  mesh.mesh.name = "water";
  mesh.far.name = "water";
}

/** What one frame cost, for the HUD's FRAME COST row and for the benchmark's
 * report — the water's CPU time, the whole frame's, and what the GPU was
 * asked for. STATED IN `benchmark-report.ts`, because the report, the history
 * and the score sheet are DOM-free and read by the root suite, and a type
 * imported from here would drag three.js into a suite that runs on plain
 * Node. Re-exported so nothing outside has to know that. */
export type { FrameCost, SceneShare };

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
  /** Whether the GUIDE LINE is drawn (`guide-line.ts`) — the dashed mark on
   * the water running from the checkpoint behind the rider to the one ahead. It rides
   * with the HUD's own switch rather than with a row of its own: it is a
   * readout that happens to be drawn in the water, and a rider who turned
   * the HUD off turned off being told where to go. */
  setGuide: (on: boolean) => void;
  /** Whether the camera-space guide back to a missed checkpoint is drawn.
   * The app gates it with the HUD and the run/pause surfaces. */
  setMissedGuide: (on: boolean) => void;
  /** THE GHOST, on the water beside the rider (`ghost-run.ts`): its own run
   * over the same shore, posed off its own state every frame and drawn
   * see-through so nothing about it can be mistaken for a rival. Null takes
   * it off. A ghost is NOT torn down by `load`: the app owns its lifetime
   * and arms or clears one on every run it stands up, which is what lets it
   * be armed before the world under it is built. */
  setGhost: (state: GameState | null) => void;
  /** Let the water effects see EVERY engine step — the wake, the spray
   * and the foam read the craft at the step's cadence and are drawn at
   * the frame's — including the steps of a scene pre-rolled for a
   * screenshot, so the wake behind a craft that has been under way for
   * three seconds is three seconds long and its last landing's splash is
   * still in the air. */
  observe: (state: GameState) => void;
  camera: CameraRig;
  cost: () => FrameCost;
  /** What was standing in the scene, by subsystem — the benchmark's report
   * asks once, on the last frame of a run. A walk of the whole graph, so
   * nothing calls it from a frame it cares about the length of. */
  sceneTally: () => SceneShare[];
  /** The drawing buffer the last frame was drawn into, DEVICE pixels — the
   * canvas's CSS box times the ratio times the RESOLUTION row's share. The
   * benchmark's card reports it beside the score, because a time without the
   * pixels it was spent on is not a measurement. */
  bufferSize: () => { w: number; h: number };
  /** WAIT FOR THE GPU to finish the frame just submitted, and say how long
   * that took, ms. `cost.frameMs` is the processor's half of a frame; the
   * GPU's runs on after `render` returns and nothing on the page can time it
   * — except by asking for a pixel back, which cannot be answered until
   * every draw before it has landed. That is what the first-visit probe
   * (`video-probe.ts`) needs and nothing else does: it stalls the pipeline
   * the frame would otherwise overlap with the next, so it is called for a
   * couple of seconds under a card and never during a run. */
  drain: () => number;
  dispose: () => void;
};

export function createRenderer(
  canvas: HTMLCanvasElement,
  initialVideo: VideoSettings = DEFAULT_VIDEO,
  /** WHAT OF THE RUN REACHES THE FRAME. `player` is his hull and the rider
   * on it, the lamps it carries and the pool they throw, the trail it lays
   * in the map, the spray it throws, and both guides drawn for him.
   * `course` is the gate marks, the rings, the ramps under them, the
   * rounding buoys and the lamps any of those throw on the water. With both
   * false the frame is the COAST and nothing that was put on it.
   *
   * It draws less; it does not SIMULATE less. The run is stood up, stepped
   * and ridden exactly as it would be — the camera is still the chase rig on
   * his hull, so the frame is still the water a rider would be looking at —
   * and the sea still carries the wash he is laying in it, because that is
   * the engine's water and not a mark on a map.
   *
   * TAKEN AT THE BUILD AND NEVER AFTERWARDS, because the `?player=0` and
   * `?course=0` behind them are read once off the URL (`url-params.ts`) and
   * no surface can move either. A setter would have to answer what becomes
   * of the trail already in the map and the spray already in the air
   * halfway through a run; an argument cannot be asked the question. The
   * SHAPE is declared here rather than imported from `url-params.ts`, which
   * is deliberately three-free and read by the suite: what the renderer
   * needs is two booleans, and saying so keeps the arrow pointing one way.
   *
   * Both belong to the coast banners (`make coasts`), where the subject is
   * the shore itself — a craft in the middle of the frame is the wrong thing
   * to be looking at, and a line of buoys down it is one RIDE over a coast
   * where the row is offering the coast. */
  drawn: { player: boolean; course: boolean } = { player: true, course: true },
): GameRenderer {
  const { player: playerShown, course: courseShown } = drawn;
  let video = initialVideo;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    // NO SAMPLES ON THE CANVAS: every edge in the picture is drawn into the
    // grade's own multisampled target (`grade-pass.ts`), and what reaches
    // this framebuffer is one screen-filling triangle pair that has none. A
    // multisampled default framebuffer here would be a second full-screen
    // allocation and a second resolve, both spent on nothing.
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(60, 16 / 9, NEAR, FAR);
  const rig = createCameraRig();
  const missedGuide = createCheckpointArrow(canvas);
  // Camera-space geometry is still part of the scene graph: a camera only
  // draws its children when the camera itself is in that graph.
  scene.add(camera);
  camera.add(missedGuide.group);

  // THE SKY, and with it the fog and both lights (environment.ts).
  const sky: Environment = createEnvironment(scene);
  // THE GRADE (grade-pass.ts): the cast this coast's picture is finished
  // with. Nothing else in the renderer knows it exists — the frame is drawn
  // into its target instead of onto the canvas, and it writes the canvas.
  const grade: GradePass = createGradePass();
  // THE CRAFT'S SURFACE (craft-surface.ts): one material for the hull and
  // the rider, on the sky's own uniforms, so what the gel coat reflects is
  // the sky the water beside it reflects.
  const surface = craftSurface(sky.uniforms);

  // THE MIRROR (reflection.ts): the shore and the craft drawn from under
  // the water into a texture the sea reads. Made before the water, which
  // holds its picture and its matrix for the life of the material.
  const mirror = createReflection();
  // The mirror as the cover's cull sees it, written each frame rather than
  // built: the reflection is asked about on every frame there is one.
  const inWater: CoverMirror = { frustum: mirror.frustum, share: 0 };
  // THE WAKE (wake.ts): what the craft did to the water, as a map the water
  // shader reads — nothing of it is in the scene. The spray stamps a
  // landing's foam into the same map.
  const wake = createWake();
  const spray = createSpray(wake.stamp);
  /** The rings the two rows have agreed on — the WATER row's shape plus what
   * the DISTANCE row buys (`waterRings`), which is where the drawn sea ends. */
  const gridRings = (): number =>
    waterRings(WATER_LOOK[video.water], DISTANCE_LOOK[video.distance]);
  let water: WaterMesh = createWaterMesh(
    sky.uniforms,
    WATER_LOOK[video.water],
    gridRings(),
    mirror,
  );
  water.setWake(wake.map);
  nameWater(water);
  spray.group.name = "spray";
  scene.add(water.mesh, water.far, spray.group);

  let world: THREE.Group | null = null;
  let terrain: THREE.Group | null = null;
  let seaIce: THREE.Group | null = null;
  let fauna: Fauna | null = null;
  let birds: Birds | null = null;
  let flora: Flora | null = null;
  let gates: Gates | null = null;
  let buoys: Buoys | null = null;
  /** The guide line under the surface (`guide-line.ts`). It carries no level
   * geometry of its own — it is rebuilt from the run every frame — so it is
   * built ONCE here and re-added to each world rather than torn down with
   * the shore. */
  const guide: GuideLine = createGuideLine();
  /** What the HUD's own switch last asked of the two guides. Both are
   * readouts drawn for a rider who is IN the picture, so each answers to the
   * AND of that switch and `playerShown` — remembered here rather than read
   * back off the guides, because the HUD's switch moves at any time and must
   * not forget what the other half said.
   *
   * EACH STARTS AT ITS OWN GUIDE'S DEFAULT — the line shown, the missed
   * arrow not — so the apply below writes back exactly what the pair already
   * held and the only thing it can change is the player's own gate. Starting
   * both at false instead would take the line off for the frames between the
   * renderer being built and the app's first `setGuide`, which is a window
   * nobody asked to close. */
  let guideAsked = true;
  let missedAsked = false;
  const applyGuides = (): void => {
    guide.setShown(guideAsked && playerShown);
    missedGuide.setShown(missedAsked && playerShown);
  };
  applyGuides();
  let craft: THREE.Group | null = null;
  let rider: Rider | null = null;
  /** THE FIELD, drawn: one hull and one rider per rival, posed off the
   * rival's own run each frame. The bodies are built once per craft KIND
   * and cloned — eleven hulls share four geometries — and the riders are
   * each their own, because a rider is a mesh rewritten every frame. Keyed
   * on the state's own `rivals` list, so a new run stands a new field. */
  let field: { run: GameState; group: THREE.Group; rider: Rider }[] = [];
  let fieldFor: GameState["rivals"] | null = null;
  let lamps: CraftLamps | null = null;
  /** THE GHOST'S HULL AND RIDER, and the see-through finish they are drawn
   * in — built the first time a run has a ghost on it, so a game that never
   * keeps one never pays for the material. */
  let ghost: { state: GameState; group: THREE.Group; rider: Rider } | null = null;
  let ghostSurface: THREE.MeshPhongMaterial | null = null;
  let craftId: CraftId | null = null;
  /** The cockpit the SEA is cut out of, measured off the hull that was just
   * built (`wellCutOf`) — the water is a grid that knows nothing floats on
   * it, and this is the one thing it is told. */
  let wellCut: WellCut | null = null;
  let level: Level | null = null;
  /** THE EDGE OF THE WORLD, drawn (`edge-net.ts`): the lattice standing where
   * the tornado starts, lit where the hull is in it. */
  let edgeNet: EdgeNet | null = null;

  const cost: FrameCost = {
    waterMs: 0,
    frameMs: 0,
    calls: 0,
    triangles: 0,
    programs: 0,
    geometries: 0,
    textures: 0,
  };
  /** The one pixel `drain` reads back, allocated once. */
  const drained = new Uint8Array(4);
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
        if (seaIce) disposeSeaIce(seaIce);
        fauna?.dispose();
        birds?.dispose();
        flora?.dispose();
        edgeNet?.dispose();
      }
      level = state.level;
      terrain = createTerrain(level);
      // R37 — the winter's sheet, on a freezing coast in its winter and on
      // no other run: drawn where the engine grounds the hull on it.
      seaIce = createSeaIce(level);
      gates = createGates(level);
      gates.setLens(bufferSize.y);
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
      // THE BIRDS (birds.ts): the flocks on the rocks, the rafts on the
      // water, the eagle in the pine, and whatever is crossing this season.
      birds = createBirds(level);
      birds.group.visible = video.fauna;
      // THE EDGE OF THE WORLD: the net standing where this level's tornado
      // starts. Its shape is the engine's (`tornadoNetPlan`), so what a rider
      // can see is what takes him.
      edgeNet = createEdgeNet(level);
      world = new THREE.Group();
      // NAMED, and not for debugging: the benchmark's report buckets the scene
      // by the nearest named ancestor (`sceneTally`), so a group without a
      // name is a subsystem that reports as "everything else". A name added
      // here is a row in that breakdown; a group added without one is a row
      // silently folded into its parent's.
      terrain.name = "shore";
      if (seaIce) seaIce.name = "ice";
      flora.group.name = "cover";
      gates.group.name = "gates";
      buoys.group.name = "buoys";
      // THE COURSE, OFF AT THE GROUP rather than through `setCourse`: that
      // one puts the rings and the cans away and deliberately LEAVES THE
      // RAMPS, because a tricks run is a line of decks with no ring over any
      // of them (R35). A banner wants the deck gone too — a plank floating
      // on an empty sea is stranger than the course it belonged to.
      gates.group.visible = courseShown;
      buoys.group.visible = courseShown;
      guide.group.name = "guide";
      fauna.group.name = "fauna";
      birds.group.name = "birds";
      const rocks = createRocks(level);
      rocks.name = "rocks";
      const prints = createFootprints(level);
      prints.name = "footprints";
      world.add(
        terrain,
        rocks,
        ...(seaIce ? [seaIce] : []),
        flora.group,
        prints,
        gates.group,
        buoys.group,
        edgeNet.group,
        guide.group,
        fauna.group,
        birds.group,
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
      // …and the coast's GRADE (`colour-grade.ts`) — the cold coast cool,
      // flat and blue in its shadows, the warm one punchy and gold in its
      // highlights. Seven dials on one material, so a new coast costs no
      // recompile and the first frame of it is already graded.
      grade.setGrade(gradeOf(level.biome));
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
      // …and the camera is told the shape of THIS hull, so the two rigs that
      // stand on it clear its deck and its bar rather than sitting inside
      // them.
      const spec = state.craft.spec;
      const style = CRAFT_STYLES[id];
      rig.setFit({ deck: (z) => deckOf(spec, style, z), gripZ: cockpitOf(spec, style).grip.z });
      wellCut = wellCutOf(spec, style);
      craft.name = "craft";
      scene.add(craft);
    }
    if (state.rivals !== fieldFor) {
      for (const f of field) {
        scene.remove(f.group);
        f.rider.dispose();
      }
      fieldFor = state.rivals;
      // The pristine bodies never enter the scene: every rival is a CLONE
      // of its kind's, so no clone carries another rival's rider with it.
      const bodies = new Map<CraftId, THREE.Group>();
      field = state.rivals.map((r) => {
        const spec = r.run.craft.spec;
        let body = bodies.get(spec.id);
        if (!body) {
          body = buildCraft(spec, CRAFT_STYLES[spec.id], surface);
          bodies.set(spec.id, body);
        }
        const group = body.clone();
        const own = createRider(cockpitOf(spec, CRAFT_STYLES[spec.id]), surface);
        group.add(own.mesh);
        // Every rival under one name: the report wants what THE FIELD costs,
        // not eleven rows a hull each.
        group.name = "field";
        scene.add(group);
        return { run: r.run, group, rider: own };
      });
    }
    gates?.setCourse(state.rules.course);
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
    // The grade reads the picture back at exactly the size it was drawn, so
    // its target is sized in DEVICE pixels off the drawing buffer rather
    // than off the CSS box the two are derived from.
    grade.setSize(bufferSize.x, bufferSize.y);
  };

  /** Stand the two water grids up for the WATER and DISTANCE rows as they
   * stand — the first says how fine the sea is, the second how far out it is
   * drawn. The sky the old ones were lit for is re-applied on the way out, so
   * a rebuild mid-run never flashes a noon sea under a squall. */
  const buildWater = (): void => {
    scene.remove(water.mesh, water.far);
    water.dispose();
    water = createWaterMesh(sky.uniforms, WATER_LOOK[video.water], gridRings(), mirror);
    nameWater(water);
    water.setWake(wake.map);
    water.setWakeLook(WAKE_LOOK[video.wake]);
    water.setMirrorLook(REFLECTION_LOOK[video.reflections]);
    scene.add(water.mesh, water.far);
    if (level) water.setCoast(level.biome);
    water.retone(sky.preset(), sky.hemi, sky.key, sky.cloudLayers());
  };

  const setVideo = (next: VideoSettings): void => {
    const was = video;
    video = next;
    // The grids are geometry, and the two rows that shape them are the only
    // ones that have to rebuild anything: WATER lays the cells, DISTANCE says
    // how many rings of them stand round the rider.
    if (next.water !== was.water || next.distance !== was.distance) buildWater();
    setTextureAnisotropy(WATER_LOOK[next.water].anisotropy);
    water.setWindow(next.seeThrough);
    // …and the guide line is told the same thing: with the window closed the
    // sea is opaque, so the mark moves from under the surface to just proud
    // of it rather than disappearing under water nobody can see into.
    guide.setWindow(next.seeThrough);
    // `viewport` is cleared rather than compared: `resize` short-circuits on a
    // box it has already measured, and the box has NOT changed — only what it
    // is worth in device pixels has.
    if (next.resolution !== was.resolution) {
      viewport = null;
      resize();
    }
    spray.setBudget(SPRAY_SCALE[next.spray]);
    // The wildlife switch is one switch: the sea life under the hull and
    // the birds over it go together.
    if (birds) birds.group.visible = next.fauna;
    // THE WAKE is two halves that have to agree: the pass that draws the map
    // and the shader that reads it. Off is both off; the map is cleared once
    // on the way out so a stale road is never read back by a later press.
    wake.setDrawn(WAKE_LOOK[next.wake].map);
    water.setWakeLook(WAKE_LOOK[next.wake]);
    // THE SPLASH is the same two halves again: what the map stamps and what
    // the spray throws.
    wake.setSplashLook(SPLASH_LOOK[next.splash]);
    spray.setSplashThrow(SPLASH_LOOK[next.splash].throw);
    sky.setRainSheet(RAIN_LOOK[next.rain].sheet);
    flora?.setDensity(FLORA_SCALE[next.flora]);
    mirror.setScale(REFLECTION_LOOK[next.reflections].scale);
    water.setMirrorLook(REFLECTION_LOOK[next.reflections]);
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

  const dropGhost = (): void => {
    if (!ghost) return;
    scene.remove(ghost.group);
    ghost.rider.dispose();
    ghost = null;
  };

  const setGhost = (next: GameState | null): void => {
    dropGhost();
    if (!next) return;
    if (!ghostSurface) {
      ghostSurface = craftSurface(sky.uniforms);
      ghostSurface.transparent = true;
      ghostSurface.opacity = GHOST_ALPHA;
      ghostSurface.depthWrite = false;
    }
    const spec = next.craft.spec;
    const style = CRAFT_STYLES[spec.id];
    const group = buildCraft(spec, style, ghostSurface);
    const own = createRider(cockpitOf(spec, style), ghostSurface);
    group.add(own.mesh);
    // One name for the pair: the benchmark's breakdown wants what the ghost
    // costs, not a hull and a figure on two rows.
    group.name = "ghost";
    scene.add(group);
    ghost = { state: next, group, rider: own };
  };

  const render = (state: GameState, dt: number): void => {
    const t0 = performance.now();
    if (state.level !== level || state.craft.spec.id !== craftId || state.rivals !== fieldFor)
      load(state);
    const c = state.craft;
    if (craft) {
      craft.position.set(c.x, c.y, c.z);
      craft.quaternion.set(c.q.x, c.q.y, c.q.z, c.q.w);
      // The rider and the lamps are children of the hull, so one flag takes
      // the whole machine out of the frame.
      craft.visible = playerShown;
    }
    if (playerShown) rider?.update(state);
    for (const f of field) {
      const rc = f.run.craft;
      f.group.position.set(rc.x, rc.y, rc.z);
      f.group.quaternion.set(rc.q.x, rc.q.y, rc.q.z, rc.q.w);
      f.rider.update(f.run);
    }
    if (ghost) {
      const gc = ghost.state.craft;
      ghost.group.position.set(gc.x, gc.y, gc.z);
      ghost.group.quaternion.set(gc.q.x, gc.q.y, gc.q.z, gc.q.w);
      ghost.rider.update(ghost.state);
    }
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
      gates?.setLens(bufferSize.y);
    }
    camera.updateMatrixWorld();
    missedGuide.update(state, camera, dt);
    viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProjection);
    // The mirrored lens is posed with the real one, so the cover can cull
    // against both before either draws.
    mirror.aim(camera);

    // …and where the hull's cockpit stands this frame, so the sea is not
    // drawn inside it. Before the water's own update, like everything else
    // it has to be told before it draws.
    water.setWell(craft && playerShown ? wellCut : null, c);
    cost.waterMs = water.update(state, c.x, c.z, frustum);
    if (courseShown) gates?.update(state, camera);
    edgeNet?.update(state, dt);
    // THE GUIDE LINE, along the course's own line from the checkpoint behind
    // the rider to the one ahead. It reads the ENGINE's own water (`surfaceAt`
    // through the run's sea and clock) rather than the mesh's vertices, so a
    // dash two hundred metres out lies on the wave that is actually there and
    // not on the nearest ring of a grid that has thinned by then.
    guide.update(state, (x, z, out) => surfaceAt(state.sea, state.level, x, z, state.t, out));
    if (courseShown) buoys?.update(state, camera);
    // R31 — THE LAMPS ON THE SEA. The gate marks and the rounding buoys
    // both throw a pool, the water can carry four of them, and which four
    // is decided by range from the craft rather than by which list they
    // came out of: a gate mark five metres away lights more water than a
    // rounding buoy across the bay. A course that is not drawn throws none:
    // the pools are on the WATER rather than in the course's own group, so
    // hiding the buoys alone would leave four lamps burning on an empty sea.
    if (gates || buoys)
      water?.setBuoyLamps(
        courseShown
          ? nearestLamps(gates?.lamps ?? NO_LAMPS, buoys?.lamps ?? NO_LAMPS, c.x, c.z)
          : NO_LAMPS,
      );
    // How far the rider can see into the water is the water mesh's answer, and
    // it is 0 with the window closed — so a closed window is also an empty sea
    // bed rather than a second rule about what to draw down there.
    const reach = video.fauna ? water.seeThrough() : 0;
    fauna?.update(state, c.x, c.z, reach);
    // The birds are culled from the LENS, like the cover: a flock is a
    // thing in the picture, not a thing under the hull.
    if (video.fauna) birds?.update(state, pose.x, pose.z);
    spray.update();

    // HOW MUCH WORLD IS SUBMITTED — from the LENS rather than from the craft,
    // because the helicopter seat can stand a long way off it and the rider is
    // looking through the camera either way. Everything dropped here is already
    // inside the fog the same row thickened (`draw-distance.ts`); the cover is
    // cut to the frustum as well, which the fog never does.
    const drawn = DISTANCE_LOOK[video.distance];
    if (terrain) cullByDistance(terrain, pose.x, pose.z, drawn.shore);
    if (seaIce) cullByDistance(seaIce, pose.x, pose.z, drawn.shore);
    if (mirror.live()) {
      inWater.frustum = mirror.frustum;
      inWater.share = mirror.scale();
    }
    flora?.update(frustum, pose.x, pose.z, drawn.cover, mirror.live() ? inWater : undefined);

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
    if (ghostSurface) applyCraftSky(ghostSurface, sky.cloudLayers());
    water.setRain(sky.rainfall(), RAIN_LOOK[video.rain].rings);
    spray.light(sky.hemi, sky.key);
    fauna?.retone(p);
    // THE DARK: the craft's lamps come on with the sky's switch and are
    // worth what the dark makes them worth; the buoys light their own caps;
    // and the water reads the headlamp off the very spotlight the hull is
    // lit by.
    if (lamps) {
      // A hull nobody can see throws no beam: the pool on the water is the
      // one piece of the lamps that is not a child of the hull, so a night
      // coast would otherwise be lit by a craft that is not in the picture.
      lamps.setLit(playerShown ? p.lamps : 0, 1 - dayLight(p));
      // …and their own hardware is put away when the frame is drawn from a
      // lens bolted to the craft, because every piece of it is in front of
      // that lens rather than in front of the viewer. The beam is not: the
      // pool on the water is the same from every seat.
      lamps.setAboard(isEyeCamera(rig.mode()));
      water.setLamp(lamps.light);
    }
    if (courseShown) {
      gates?.setNight(p.lamps);
      buoys?.setNight(p.lamps);
    }

    // THE WAKE'S PASS: the trail rasterised into the map the water reads,
    // before anything reads it.
    const marks = wake.render(renderer, state);
    // THE MIRROR'S PASS, before the picture: everything that stands over the
    // water, without the water itself, the spray over it, the rain in the
    // air over it or the dome — the sea reflects the sky as a function
    // (sky-glsl.ts), and a dome drawn sharp into the mirror would put its
    // cloud edges back on the crests. The cover is the one thing in the scene
    // with two answers: it draws its near share into the water and the whole
    // of itself into the picture.
    flora?.drawFor("mirror");
    const pass = mirror.render(renderer, scene, [
      water.mesh,
      water.far,
      spray.group,
      missedGuide.group,
      ...sky.unmirrored,
    ]);
    water.setMirror(mirror.live());
    flora?.drawFor("frame");

    // THE PICTURE, into the grade's target rather than onto the canvas…
    const onto = renderer.getRenderTarget();
    renderer.setRenderTarget(grade.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(onto);
    // …read HERE, because `render` resets the counters at the top of every
    // call and the grade's own pass is a second one (the mirror's and the
    // wake's are captured the same way, for the same reason).
    const picture = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
    // …and THE GRADE onto the canvas.
    const graded = grade.render(renderer);
    cost.calls = picture.calls + graded.calls + pass.calls + marks.calls;
    cost.triangles = picture.triangles + graded.triangles + pass.triangles + marks.triangles;
    // WHAT THE SHORE IS HOLDING rather than what this frame drew: the driver's
    // compiled programs and the buffers and textures still resident. Read here
    // with the rest so a reading is one frame's whole account, and flat to ask
    // — three keeps all three as counters.
    cost.programs = renderer.info.programs?.length ?? 0;
    cost.geometries = renderer.info.memory.geometries;
    cost.textures = renderer.info.memory.textures;
    cost.frameMs = performance.now() - t0;
  };

  /** THE SCENE, WALKED, and bucketed by what it belongs to — the benchmark's
   * report asks for it once, on the last frame of a run
   * (`benchmark-report.ts`). It is the half of that report that says WHERE to
   * look: a frame's draw calls say a machine is struggling, and this says the
   * cover is four fifths of its triangles.
   *
   * The bucket is the nearest NAMED ancestor, which is why the groups this
   * module adds to the scene carry names: without one an object would be
   * reported against the scene itself and the breakdown would be a single row
   * saying "all of it".
   *
   * Only what would actually be DRAWN: an invisible object, and everything
   * under it, is skipped exactly as three's own traversal skips it — a
   * breakdown that counted the sea life with SEE-THROUGH off would send
   * somebody optimising a thing that was never submitted.
   *
   * A WALK OF THE WHOLE GRAPH, so it is never called from a frame that is
   * being timed for anything but this. */
  const sceneTally = (): SceneShare[] => {
    const buckets = new Map<string, SceneShare>();
    const walk = (object: THREE.Object3D, under: string): void => {
      if (!object.visible) return;
      const name = object.name !== "" ? object.name : under;
      const geometry = (object as Partial<THREE.Mesh>).geometry;
      if (geometry !== undefined) {
        const share = buckets.get(name) ?? { name, objects: 0, triangles: 0 };
        share.objects += 1;
        const index = geometry.getIndex();
        const position = geometry.getAttribute("position");
        const verts = index ? index.count : (position?.count ?? 0);
        const instances = (object as Partial<THREE.InstancedMesh>).count ?? 1;
        share.triangles += (verts / 3) * instances;
        buckets.set(name, share);
      }
      for (const child of object.children) walk(child, name);
    };
    walk(scene, "scene");
    return [...buckets.values()];
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
    setGuide: (on) => {
      guideAsked = on;
      applyGuides();
    },
    setMissedGuide: (on) => {
      missedAsked = on;
      applyGuides();
    },
    setGhost,
    observe: (state) => {
      // Nothing is laid for a player who is not in the picture — the trail
      // and the spray are his, and a wake behind nobody is worse than no
      // wake. The field and the ghost are unaffected: this is the PLAYER's.
      if (playerShown) {
        wake.observe(state);
        spray.observe(state);
        rider?.observe(state);
      }
      for (const f of field) f.rider.observe(f.run);
      // The ghost's body is on springs like everybody else's; its hull is
      // not given the wake or the spray, because a trail cut by a craft
      // that is not on the water is a trail the rider would try to read.
      if (ghost) ghost.rider.observe(ghost.state);
      birds?.observe(state);
    },
    camera: rig,
    cost: () => cost,
    sceneTally,
    bufferSize: () => ({ w: bufferSize.x, h: bufferSize.y }),
    drain: () => {
      const t0 = performance.now();
      const gl = renderer.getContext();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, drained);
      return performance.now() - t0;
    },
    dispose: () => {
      boxes.disconnect();
      window.removeEventListener("resize", resize);
      sky.dispose();
      grade.dispose();
      water.dispose();
      mirror.dispose();
      fauna?.dispose();
      birds?.dispose();
      wake.dispose();
      spray.dispose();
      rider?.dispose();
      for (const f of field) f.rider.dispose();
      dropGhost();
      ghostSurface?.dispose();
      surface.dispose();
      lamps?.dispose();
      missedGuide.dispose();
      if (terrain) disposeTerrain(terrain);
      if (seaIce) disposeSeaIce(seaIce);
      renderer.dispose();
    },
  };
}

export type { CameraMode };
