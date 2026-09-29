// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED TREES the shore draws: every tree-form row of the cover
// roster (`tree-variants.ts`'s `TREE_KINDS`) in six variants, MODELLED in
// Blender off the very rows the code's builder reads (`make blender
// KIND=tree`, `scripts/blender/tree.py`), committed as one glTF a kind in
// `pwa/models/trees/` by `make models` and packed by every build — unless a
// build is switched back to the code-built trees (`VITE_MODEL_TREES=0`;
// `model-switch.ts`). A kind whose file did not load is drawn by
// `flora-shapes.ts`, as every tree is under the switch.
//
// A MODEL CARRIES NO COLOUR: every face is a ROLE (its material's name) and
// every vertex a SHADE and a BLEND from the role's first colour to its
// second (`tree.py`'s header). `treeModel` dresses it here in its own row's
// colours (`flora-defs.ts` — the foliage lit and dark, the bark and its upper
// reach, a birch's marks), which are the code builder's colours too, and
// divides the reference height (`TREE_REFERENCE`) back out into the unit
// frame the code's builder draws in and the placer scales from — a metre
// tall, its foot on the ground.

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import type { Look } from "./flora-defs.ts";
import { modelSwitch } from "./model-switch.ts";
import { TREE_KINDS, TREE_REFERENCE, treeSpec } from "./tree-variants.ts";

/** The build's environment — Vite's in the app; none in the suite. */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Whether this build draws the modelled trees (ON unless turned off). */
export const TREE_MODELS = modelSwitch(ENV.VITE_MODEL_TREES);

/** What a face of a model is, by its material's name. */
export type TreeRole = "leaf" | "bark" | "twig" | "mark";

/** A role's two colours in a kind's own look: the first, and the one a
 * vertex's blend goes to. Pure, so the suite reads it. */
export function roleColours(role: string, look: Look): [THREE.Color, THREE.Color] | null {
  const c = (hex: number) => new THREE.Color(hex);
  switch (role) {
    case "leaf":
      return [c(look.leafLit), c(look.leafDark)];
    case "bark":
      return [c(look.stem), c(look.stemHigh ?? look.stem)];
    case "twig":
      return [c(look.stem), c(look.leafDark)];
    case "mark":
      return [c(look.stemMark ?? look.stem), c(look.stemMark ?? look.stem)];
    default:
      return null;
  }
}

/** One primitive of a variant's mesh, read out of its glTF into the
 * reference tree's metres (through its node, which carries the packed
 * file's quantization step). */
export type TreePart = {
  role: string;
  position: Float32Array;
  normal: Float32Array;
  tone: Float32Array;
  index: Uint32Array;
};

/** Every kind's variants, by mesh name (`v3`, `v3_far`). */
const loaded = new Map<string, Map<string, TreePart[]>>();
let loading: Promise<void> | null = null;

/** The parts of a loaded glTF scene, by variant mesh. */
export function partsOf(gltf: Pick<GLTF, "scene">): Map<string, TreePart[]> {
  const out = new Map<string, TreePart[]>();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!/^v\d+(_far)?$/.test(o.name)) return;
    const meshes: THREE.Mesh[] = [];
    if (o instanceof THREE.Mesh) meshes.push(o);
    else o.traverse((c) => c instanceof THREE.Mesh && meshes.push(c));
    const parts: TreePart[] = [];
    for (const m of meshes) {
      const g = m.geometry as THREE.BufferGeometry;
      const pos = g.getAttribute("position");
      const nrm = g.getAttribute("normal");
      const tone = g.getAttribute("color");
      if (!pos || !nrm || !tone || !g.index) continue;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      const n = pos.count;
      const position = new Float32Array(n * 3);
      const normal = new Float32Array(n * 3);
      const tones = new Float32Array(n * 3);
      const turn = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
      const v = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, i)
          .applyMatrix4(m.matrixWorld)
          .toArray(position, i * 3);
        v.fromBufferAttribute(nrm, i)
          .applyMatrix3(turn)
          .normalize()
          .toArray(normal, i * 3);
        tones[i * 3] = tone.getX(i);
        tones[i * 3 + 1] = tone.getY(i);
        tones[i * 3 + 2] = tone.getZ(i);
      }
      parts.push({
        role: mat.name,
        position,
        normal,
        tone: tones,
        index: Uint32Array.from(g.index.array),
      });
    }
    out.set(o.name, parts);
  });
  return out;
}

/** Fetch every kind's model, once (`base` where the site's `models/` is —
 * the build's base URL unless a lab page says otherwise); resolves when all
 * are in or given up on. */
export function loadTreeModels(base = String(ENV.BASE_URL ?? "/")): Promise<void> {
  if (loading) return loading;
  if (!TREE_MODELS) return (loading = Promise.resolve());
  // The committed models are meshopt-packed (`scripts/lib/glb-pack.mjs`).
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loading = Promise.all(
    TREE_KINDS.map((kind) =>
      loader.loadAsync(`${base}models/trees/${kind}.glb`).then(
        (g) => void loaded.set(kind, partsOf(g)),
        () => undefined,
      ),
    ),
  ).then(() => undefined);
  return loading;
}

/** Hand a kind's parsed model in directly (the flora lab, the suite). */
export function setTreeModel(kind: string, parts: Map<string, TreePart[]>): void {
  loaded.set(kind, parts);
}

/** Whether a kind is drawn off its model on this build. */
export function hasTreeModel(kind: string): boolean {
  return TREE_MODELS && (loaded.get(kind)?.size ?? 0) > 0;
}

/**
 * ONE VARIANT'S MODEL, dressed: in the unit frame, vertex-coloured in its
 * row's own colours as the kind shades it — or null when the kind has no
 * model loaded (the code's builder draws it). `far` is the variant's hand-
 * built sketch.
 */
export function treeModel(kind: string, index: number, far = false): THREE.BufferGeometry | null {
  const parts = loaded.get(kind)?.get(`v${index}${far ? "_far" : ""}`);
  if (!parts || parts.length === 0) return null;
  const look = treeSpec(kind).look;
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  for (const part of parts) {
    const colours = roleColours(part.role, look);
    if (!colours) continue;
    const first = pos.length / 3;
    const { position: at, normal: nr, tone } = part;
    const n = at.length / 3;
    for (let i = 0; i < n; i++) {
      // A uniform squeeze: the normals need no turn back.
      pos.push(
        at[i * 3] / TREE_REFERENCE,
        at[i * 3 + 1] / TREE_REFERENCE,
        at[i * 3 + 2] / TREE_REFERENCE,
      );
      nrm.push(nr[i * 3], nr[i * 3 + 1], nr[i * 3 + 2]);
      c.copy(colours[0])
        .lerp(colours[1], tone[i * 3 + 1])
        .multiplyScalar(tone[i * 3]);
      col.push(c.r, c.g, c.b);
    }
    for (const k of part.index) idx.push(first + k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** The one material every modelled tree shares: lit smooth through the
 * model's own volume normals, its faces culled from behind — a leaf the
 * builder made two-faced has a face each way. */
export function treeMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true });
}
