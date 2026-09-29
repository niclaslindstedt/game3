// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED BIRDS the sky draws: every species of the roster
// (`bird-defs.ts`), MODELLED in Blender off its own row (`make blender
// KIND=bird`, `scripts/blender/bird.py`), committed as one glTF a species
// in `pwa/models/birds/` by `make models` and packed by every build —
// unless a build is switched back to the code-built birds
// (`VITE_MODEL_BIRDS=0`; `model-switch.ts`). A species whose file did not
// load is drawn by `bird-shapes.ts`, as every bird is under the switch.
//
// A MODEL CARRIES NO COLOUR: every face is a ROLE (its material's name —
// `bird-wing.ts`'s `BIRD_ROLES`) and every vertex a SHADE (R) and a WING
// FLAG (B: 1 on a wing vertex, the `aWing` the shader hinges on).
// `birdModel` dresses it here in the species' own style (`BIRD_STYLES`) and
// hands back the geometry `birds.ts` instances: the code's own frame
// (shoulders at the origin, bill +z, wings level along ±x) exactly, so the
// same vertex shader flaps and folds a model as it flaps the code's bird.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { BIRD_IDS, type BirdId } from "./bird-defs.ts";
import { BIRD_STYLES } from "./bird-shapes.ts";
import { roleColour } from "./bird-wing.ts";
import { modelSwitch } from "./model-switch.ts";
import { partsOf, type TreePart } from "./tree-models.ts";

/** The build's environment — Vite's in the app; none in the suite. */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Whether this build draws the modelled birds (ON unless turned off). */
export const BIRD_MODELS = modelSwitch(ENV.VITE_MODEL_BIRDS);

/** Every species' parts (the one mesh `bird`, a primitive a role). */
const loaded = new Map<string, TreePart[]>();
let loading: Promise<void> | null = null;

/** Fetch every species' model, once (`base` where the site's `models/`
 * is); resolves when all are in or given up on. */
export function loadBirdModels(base = String(ENV.BASE_URL ?? "/")): Promise<void> {
  if (loading) return loading;
  if (!BIRD_MODELS) return (loading = Promise.resolve());
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loading = Promise.all(
    BIRD_IDS.map((id) =>
      loader.loadAsync(`${base}models/birds/${id}.glb`).then(
        (g) => void loaded.set(id, partsOf(g, /^bird$/).get("bird") ?? []),
        () => undefined,
      ),
    ),
  ).then(() => undefined);
  return loading;
}

/** Hand a species' parsed parts in directly (the suite). */
export function setBirdModel(id: string, parts: TreePart[]): void {
  loaded.set(id, parts);
}

/** Whether a species is drawn off its model on this build. */
export function hasBirdModel(id: string): boolean {
  return BIRD_MODELS && (loaded.get(id)?.length ?? 0) > 0;
}

/**
 * ONE SPECIES' MODEL, dressed: vertex-coloured in its style's colours by
 * role, shaded by the builder's shade, carrying `aWing` — or null when the
 * species has no model loaded (the code's builder draws it).
 */
export function birdModel(id: BirdId): THREE.BufferGeometry | null {
  const parts = loaded.get(id);
  if (!parts || parts.length === 0) return null;
  const style = BIRD_STYLES[id];
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const wing: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  for (const part of parts) {
    const hex = roleColour(part.role, style);
    if (hex === null) continue;
    const first = pos.length / 3;
    const n = part.position.length / 3;
    for (let i = 0; i < n; i++) {
      pos.push(part.position[i * 3], part.position[i * 3 + 1], part.position[i * 3 + 2]);
      nrm.push(part.normal[i * 3], part.normal[i * 3 + 1], part.normal[i * 3 + 2]);
      c.setHex(hex).multiplyScalar(part.tone[i * 3]);
      col.push(c.r, c.g, c.b);
      wing.push(part.tone[i * 3 + 2] > 0.5 ? 1 : 0);
    }
    for (const k of part.index) idx.push(first + k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute("aWing", new THREE.Float32BufferAttribute(wing, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
