// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED MARKS the course draws: the GATE MARK (`gates.ts`) and the
// ROUNDING BUOY (`buoys.ts`), MODELLED in Blender off the very numbers the
// code lathes them from (`mark-shapes.ts`; `make blender KIND=mark`,
// `scripts/blender/mark.py`), committed in `pwa/models/marks/` by `make
// models` and packed by every build — unless a build is switched back to
// the code's lathes (`VITE_MODEL_MARKS=0`; `model-switch.ts`). A kind whose
// file did not load is drawn as the code draws it.
//
// A MODEL CARRIES NO COLOUR: its primitives are named for what the game
// dresses them as (`hull`, `band`, `fitting`, `tower`, `lens`) and its
// vertices carry a SHADE alone. `markParts` hands each mesh's primitives
// back by material name as geometries in the code's own frame (metres about
// the waterline, y up), so `gates.ts` instances each one exactly as it
// instances its own lathes and `buoys.ts` hangs them on a buoy's group.

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { MARK_KINDS, type MarkKind } from "./mark-shapes.ts";
import { modelSwitch } from "./model-switch.ts";

/** The build's environment — Vite's in the app; none in the suite. */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Whether this build draws the modelled marks (ON unless turned off). */
export const MARK_MODELS = modelSwitch(ENV.VITE_MODEL_MARKS);

/** A mesh's primitives by material name — each a geometry in the mark's
 * frame, its vertex colour the builder's shade. */
export type MarkMesh = Map<string, THREE.BufferGeometry>;

/** Every kind's meshes by node name (`mark`; `can` and `tower`). */
const loaded = new Map<string, Map<string, MarkMesh>>();
let loading: Promise<void> | null = null;

/** A mesh's geometry in world space as floats. The packed file's positions
 * are 16-bit steps with the step on the node's scale, so a geometry cloned
 * and transformed in place would write the metres back into the integer
 * array and truncate them to nothing: every attribute is read out through
 * a vector into a float array instead. */
function unpacked(o: THREE.Mesh): THREE.BufferGeometry {
  const src = o.geometry as THREE.BufferGeometry;
  const pos = src.getAttribute("position");
  const nrm = src.getAttribute("normal");
  const col = src.getAttribute("color");
  const n = pos.count;
  const position = new Float32Array(n * 3);
  const normal = new Float32Array(n * 3);
  const colour = new Float32Array(n * 3);
  const turn = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i)
      .applyMatrix4(o.matrixWorld)
      .toArray(position, i * 3);
    if (nrm)
      v.fromBufferAttribute(nrm, i)
        .applyMatrix3(turn)
        .normalize()
        .toArray(normal, i * 3);
    else v.set(0, 1, 0).toArray(normal, i * 3);
    if (col) {
      // The builder's shade alone, as a grey the material's colour multiplies.
      const shade = col.getX(i);
      colour[i * 3] = shade;
      colour[i * 3 + 1] = shade;
      colour[i * 3 + 2] = shade;
    } else colour.fill(1, i * 3, i * 3 + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colour, 3));
  if (src.index) g.setIndex(Array.from(src.index.array));
  g.computeBoundingSphere();
  return g;
}

/** The meshes of a loaded glTF scene, by node, by material name. */
export function meshesOf(gltf: Pick<GLTF, "scene">): Map<string, MarkMesh> {
  const out = new Map<string, MarkMesh>();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    // The packer hangs each mesh under a node carrying its quantization
    // step; the NAMED node is the one above it, or the mesh itself.
    let node: THREE.Object3D = o;
    while (node.parent && !/^(mark|can|tower)$/.test(node.name)) node = node.parent;
    const name = node.name;
    if (!/^(mark|can|tower)$/.test(name)) return;
    let parts = out.get(name);
    if (!parts) {
      parts = new Map();
      out.set(name, parts);
    }
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    parts.set(mat.name, unpacked(o));
  });
  return out;
}

/** Fetch every kind's model, once (`base` where the site's `models/` is);
 * resolves when all are in or given up on. */
export function loadMarkModels(base = String(ENV.BASE_URL ?? "/")): Promise<void> {
  if (loading) return loading;
  if (!MARK_MODELS) return (loading = Promise.resolve());
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loading = Promise.all(
    MARK_KINDS.map((kind) =>
      loader.loadAsync(`${base}models/marks/${kind}.glb`).then(
        (g) => void loaded.set(kind, meshesOf(g)),
        () => undefined,
      ),
    ),
  ).then(() => undefined);
  return loading;
}

/** Hand a kind's parsed model in directly (the suite). */
export function setMarkModel(kind: string, meshes: Map<string, MarkMesh>): void {
  loaded.set(kind, meshes);
}

/** A kind's meshes, by node name — or null when the kind has no model
 * loaded (the code's lathes draw it). */
export function markMeshes(kind: MarkKind): Map<string, MarkMesh> | null {
  if (!MARK_MODELS) return null;
  const meshes = loaded.get(kind);
  return meshes && meshes.size > 0 ? meshes : null;
}
