// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED CRAFTS AND RIDER the game draws: glTFs made in Blender off
// the game's own data (`make models`, committed in `pwa/models/` and held
// fresh against it by `tests/models_test.ts`) and packed by every build
// (`pwa/models-plugin.ts`) — unless a build is switched back to the
// code-built ones (`VITE_MODEL_CRAFTS=0`, `VITE_MODEL_RIDERS=0`;
// `model-switch.ts`). Nothing else changes: the code's craft and rider are
// still built, still posed, still the ones the lamps, the camera's deck,
// the sea's cut and every reader of a hull or a figure know; their drawn
// triangles are only COLLAPSED (an empty draw range), and the model —
// skinned on the rig `make blender` gave it — hangs beside them, posed off
// the same readings:
//
//   a craft   its rig (`craft-rig.ts`) posed off the engine's state — the
//             bars turned with the nozzle, the nozzle's steer and trim, the
//             reverse gate — dressed in the craft's style
//   a rider   his bones (`rider-rig.ts`) set to the very pose the code's
//             figure would be drawn in, his hands on the bars as they turn
//
// ONE DRAW EACH, ON THE ONE SURFACE. A model's parts come out of the glTF a
// primitive a material; they are merged here into one skinned mesh whose
// colour and finish (`FINISH`) ride its vertices, dressed by each
// material's NAME (`dressOf` — the builders name them for the style's and
// the kit's own fields), and drawn with the craft's own surface made smooth
// (`smoothOf`): the same sky in the gel coat, the same finishes, the same
// haze as the code's hull beside it.
//
// Loaded once, before the renderer's kit is handed out (`App.tsx`) and
// before the craft card's turntable builds (`craft-picker.tsx`), so every
// builder finds them waiting; a model that fails to load leaves that craft
// or the rider to the code, and where nothing loads at all — the labs and
// the suite, in Node — everything is the code's.

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CRAFT_IDS, type CraftId, type CraftSpec, type CraftState } from "@engine";

import { craftLines } from "./craft-body.ts";
import { barTurn, rigCraft, turnGrips, type CraftRig } from "./craft-rig.ts";
import { CRAFT_STYLES, type CraftStyle } from "./craft-styles.ts";
import { FINISH, smoothOf, type CraftSurface } from "./craft-surface.ts";
import { modelSwitch } from "./model-switch.ts";
import type { P, RiderPose } from "./rider-pose.ts";
import { rigRider, type RiderRig } from "./rider-rig.ts";

/** The build's environment — Vite's, where this runs in the app; none
 * where the suite reads the module (the root program knows no Vite). */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Which models this build draws (build-time switches, ON unless turned
 * off — `model-switch.ts`). */
export const MODELS = {
  crafts: modelSwitch(ENV.VITE_MODEL_CRAFTS),
  riders: modelSwitch(ENV.VITE_MODEL_RIDERS),
};

/** What a model's material is dressed as: the colour its vertices carry
 * and the finish (`FINISH`) the surface's highlight and mirror read. */
export type Dress = { colour: number; finish: number };

/** The kit a rider model is dressed in: `rider.ts`'s paint and finishes. */
export type RiderKit = { paint: Record<string, number>; finish: Record<string, number> };

/** What each of a craft's style fields is finished in — the code's own
 * choices (`craft-body.ts` sets the pen the same way). */
const CRAFT_FINISH: Record<Exclude<keyof CraftStyle, "shape">, number> = {
  hull: FINISH.gelcoat,
  topside: FINISH.gelcoat,
  rail: FINISH.rubber,
  deck: FINISH.paint,
  seat: FINISH.vinyl,
  seatTop: FINISH.vinyl,
  tray: FINISH.mat,
  bar: FINISH.chrome,
  grip: FINISH.rubber,
};

/** The instrument glass on the pod: a dark tint, as glossy as a visor. */
const GLASS = 0x2b3238;

/** WHAT A MATERIAL IS DRESSED AS, by the name `make blender` gave it — a
 * craft's style field (`hull`, `deck`, `seat` …), the two mouldings in the
 * rail's and the grip's colour (`trim`, `moulding`), the pod's `glass`, or
 * one of the kit's paints (`suit`, `vest`, `helmet` …). Null for a name
 * nobody dresses. Pure, so the suite reads it. */
export function dressOf(
  name: string,
  craft: CraftStyle | null,
  kit: RiderKit | null,
): Dress | null {
  if (craft) {
    if (Object.hasOwn(CRAFT_FINISH, name)) {
      const key = name as keyof typeof CRAFT_FINISH;
      return { colour: craft[key], finish: CRAFT_FINISH[key] };
    }
    if (name === "trim") return { colour: craft.rail, finish: FINISH.moulding };
    if (name === "moulding") return { colour: craft.grip, finish: FINISH.moulding };
    if (name === "glass") return { colour: GLASS, finish: FINISH.shell };
  }
  if (kit && Object.hasOwn(kit.paint, name)) {
    return { colour: kit.paint[name], finish: kit.finish[name] ?? FINISH.cloth };
  }
  return null;
}

const loaded: { crafts: Map<CraftId, GLTF>; rider: GLTF | null } = {
  crafts: new Map(),
  rider: null,
};
let loading: Promise<void> | null = null;

/** Fetch every model this build draws, once; resolves when all are in (or
 * given up on — a missing one leaves its craft to the code). */
export function loadModels(): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  const at = (file: string) => `${String(ENV.BASE_URL ?? "/")}models/${file}`;
  const jobs: Promise<unknown>[] = [];
  if (MODELS.crafts) {
    for (const id of CRAFT_IDS) {
      jobs.push(
        loader.loadAsync(at(`${id}.glb`)).then(
          (g) => loaded.crafts.set(id, g),
          () => undefined,
        ),
      );
    }
  }
  if (MODELS.riders) {
    jobs.push(
      loader.loadAsync(at("rider.glb")).then(
        (g) => (loaded.rider = g),
        () => undefined,
      ),
    );
  }
  loading = Promise.all(jobs).then(() => undefined);
  return loading;
}

/** MODELS HANDED IN rather than fetched — the craft lab's way in
 * (`make crafts ARGS=--asset=…`), which reads a glTF off the disk and
 * judges it through the very code the game draws it with. Replaces what
 * was adopted before it, so one sheet can set a lod1 after a lod0. */
export function adoptModels(models: { crafts?: Map<CraftId, GLTF>; rider?: GLTF | null }): void {
  loaded.crafts = models.crafts ?? new Map();
  loaded.rider = models.rider ?? null;
  loading = Promise.resolve();
  prepared.clear();
  columns.clear();
}

/** A model's scene with its primitives MERGED into one skinned mesh, every
 * vertex carrying its material's dress (`color`, `aShine`) — made once per
 * model and cloned for every craft that draws it. */
function prepare(gltf: GLTF, dress: (name: string) => Dress | null): THREE.Object3D {
  // A copy: the loaded scene is left as it came, to be prepared again.
  const scene = cloneSkinned(gltf.scene);
  const parts: THREE.SkinnedMesh[] = [];
  scene.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) parts.push(o as THREE.SkinnedMesh);
  });
  if (parts.length === 0) return scene;
  const c = new THREE.Color();
  const geometries = parts.map((m) => {
    const g = new THREE.BufferGeometry();
    for (const name of ["position", "normal", "skinIndex", "skinWeight"]) {
      g.setAttribute(name, m.geometry.getAttribute(name));
    }
    if (m.geometry.index) g.setIndex(m.geometry.index);
    const n = g.getAttribute("position").count;
    const mat = (
      Array.isArray(m.material) ? m.material[0] : m.material
    ) as THREE.MeshStandardMaterial;
    const d = dress(mat.name);
    if (d) c.setHex(d.colour);
    else c.copy(mat.color ?? c.setHex(0xff00ff));
    const colour = new Float32Array(n * 3);
    const shine = new Float32Array(n).fill(d?.finish ?? FINISH.cloth);
    for (let i = 0; i < n; i++) colour.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(colour, 3));
    g.setAttribute("aShine", new THREE.BufferAttribute(shine, 1));
    return g;
  });
  const merged = mergeGeometries(geometries);
  const first = parts[0];
  const one = new THREE.SkinnedMesh(merged, first.material);
  one.name = "model";
  one.position.copy(first.position);
  one.quaternion.copy(first.quaternion);
  one.scale.copy(first.scale);
  first.parent!.add(one);
  one.bind(first.skeleton, first.bindMatrix);
  for (const p of parts) p.parent!.remove(p);
  // Culled by its rest pose's bound, grown by as far as a pose may take it
  // (a hand turned with the bars, a rider in the water at the flank) — the
  // skinned bound is otherwise re-measured by nobody.
  scene.updateMatrixWorld(true);
  one.computeBoundingSphere();
  one.boundingSphere!.radius += POSE_REACH;
  return scene;
}

/** How far past its rest pose's bound a model may reach when posed, m. */
const POSE_REACH = 0.6;

const prepared = new Map<string, THREE.Object3D>();

/** A fresh copy of a prepared model — skeleton and all — drawn with the
 * smooth sibling of `surface`, held by a group standing in the body frame:
 * glTF's forward is −z and the model faces +y in Blender, so a half turn
 * about y sets it on the engine's axes exactly. */
function instance(
  key: string,
  gltf: GLTF,
  dress: (name: string) => Dress | null,
  surface: THREE.Material,
): { holder: THREE.Group; scene: THREE.Object3D } {
  let template = prepared.get(key);
  if (!template) {
    template = prepare(gltf, dress);
    prepared.set(key, template);
  }
  const scene = cloneSkinned(template);
  const material = smoothOf(surface as CraftSurface);
  scene.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    const m = o as THREE.Mesh;
    m.material = material;
    // Its geometry is the template's, shared by every copy: nothing
    // that tears a craft down may dispose it.
    m.userData.shared = true;
  });
  scene.rotation.y = Math.PI;
  const holder = new THREE.Group();
  holder.name = `model-${key}`;
  holder.add(scene);
  return { holder, scene };
}

/** A code-built mesh taken out of the draw — every reader of the mesh (its
 * bound, its place in the graph, its geometry) left as it was. Out of every
 * camera's layers, so no draw call is spent on it (an empty draw range alone
 * still issues one) while the model hung under it draws; the empty range is
 * what the craft lab reads it by. */
function collapse(mesh: THREE.Mesh): void {
  mesh.layers.disableAll();
  mesh.geometry.setDrawRange(0, 0);
}

type Hung = { rig: CraftRig; holder: THREE.Group };

/** THE MODEL OF A CRAFT, hung under the group `buildCraft` made for it, the
 * code's hull collapsed. Nothing when this build draws no model of it. */
export function hangCraft(group: THREE.Group, spec: CraftSpec, surface: THREE.Material): void {
  const gltf = MODELS.crafts ? loaded.crafts.get(spec.id) : undefined;
  const code = group.children[0] as THREE.Mesh | undefined;
  if (!gltf || !code) return;
  const style = CRAFT_STYLES[spec.id];
  const { holder, scene } = instance(spec.id, gltf, (n) => dressOf(n, style, null), surface);
  group.add(holder);
  collapse(code);
  group.userData.model = { rig: rigCraft(scene, gltf.animations), holder } satisfies Hung;
}

/** A copy of a craft's group — the code's hull shares its geometry, the
 * model is hung afresh (a skinned mesh copied by `clone` still drives the
 * pristine one's bones). */
export function cloneCraft(
  body: THREE.Group,
  spec: CraftSpec,
  surface: THREE.Material,
): THREE.Group {
  const hung = body.userData.model as Hung | undefined;
  if (!hung) return body.clone();
  const code = body.children[0].clone();
  const group = new THREE.Group();
  group.add(code);
  hangCraft(group, spec, surface);
  return group;
}

/** The craft's model posed off its state this frame: the bars with the
 * nozzle, the nozzle's steer and trim, the gate. */
export function poseCraft(group: THREE.Group, craft: CraftState): void {
  const hung = group.userData.model as Hung | undefined;
  hung?.rig.pose(craft, barTurn(craft));
}

const columns = new Map<CraftId, { base: P; top: P }>();

/** WHERE THE RIDER'S HANDS ARE when the bars turn: a pose with the grips
 * turned about the column as the modelled craft's bars are — the pose as it
 * stands on a craft drawn by the code, whose bars never turn. */
export function onTheBars(pose: RiderPose, craft: CraftState): RiderPose {
  if (!MODELS.crafts || !loaded.crafts.has(craft.spec.id)) return pose;
  const id = craft.spec.id;
  let col = columns.get(id);
  if (!col) {
    const f = craftLines(craft.spec, CRAFT_STYLES[id], 1).fittings.column;
    col = { base: f.a as P, top: f.b as P };
    columns.set(id, col);
  }
  return turnGrips(pose, col.base, col.top, barTurn(craft));
}

/** THE MODEL OF THE RIDER, hung under the code figure's mesh (which is
 * collapsed), or null when this build draws the code's. `pose` sets his
 * bones to the figure's pose. */
export function hangRider(
  mesh: THREE.Mesh,
  surface: THREE.Material,
  kit: RiderKit,
): { pose(p: RiderPose): void } | null {
  const gltf = MODELS.riders ? loaded.rider : null;
  if (!gltf) return null;
  const { holder } = instance("rider", gltf, (n) => dressOf(n, null, kit), surface);
  mesh.add(holder);
  collapse(mesh);
  const rig: RiderRig = rigRider(holder, gltf.animations);
  return { pose: (p) => rig.pose(p) };
}
