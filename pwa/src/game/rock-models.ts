// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED ROCKS the coast draws: the three kinds `rocks.ts` instances
// (`rock-variants.ts`'s `ROCK_KINDS` — the boulder, the erratic, the reef)
// in four variants each, MODELLED in Blender off the code's own proportions
// (`make blender KIND=rock`, `scripts/blender/rock.py`), committed as one
// glTF a kind in `pwa/models/rocks/` by `make models` and packed by every
// build — unless a build is switched back to the code's lumps
// (`VITE_MODEL_ROCKS=0`; `model-switch.ts`). A kind whose file did not load
// is drawn as the code's sphere or die, as every kind is under the switch.
//
// A MODEL CARRIES NO COLOUR: every vertex a SHADE (its colour attribute,
// grey), which three multiplies into the coast's stone tint the instance is
// painted with. The geometry comes back in the UNIT frame the builder
// stated it in (plan within ±1, foot at −1, crown at or under +1), which
// `rocks.ts` scales exactly as it scaled the code's lump.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { modelSwitch } from "./model-switch.ts";
import { ROCK_KINDS, ROCK_VARIANTS, type RockKind } from "./rock-variants.ts";
import { partsOf, type TreePart } from "./tree-models.ts";

/** The build's environment — Vite's in the app; none in the suite. */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Whether this build draws the modelled rocks (ON unless turned off). */
export const ROCK_MODELS = modelSwitch(ENV.VITE_MODEL_ROCKS);

/** Every kind's variants, by mesh name (`v2`), as the tree loader reads
 * them — the same file shape. */
const loaded = new Map<string, Map<string, TreePart[]>>();
let loading: Promise<void> | null = null;

/** Fetch every kind's model, once (`base` where the site's `models/` is);
 * resolves when all are in or given up on. */
export function loadRockModels(base = String(ENV.BASE_URL ?? "/")): Promise<void> {
  if (loading) return loading;
  if (!ROCK_MODELS) return (loading = Promise.resolve());
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loading = Promise.all(
    ROCK_KINDS.map((kind) =>
      loader.loadAsync(`${base}models/rocks/${kind}.glb`).then(
        (g) => void loaded.set(kind, partsOf(g)),
        () => undefined,
      ),
    ),
  ).then(() => undefined);
  return loading;
}

/** Hand a kind's parsed model in directly (the suite). */
export function setRockModel(kind: string, parts: Map<string, TreePart[]>): void {
  loaded.set(kind, parts);
}

/** Whether a kind is drawn off its model on this build: every one of its
 * variants is in, or none is. */
export function hasRockModel(kind: RockKind): boolean {
  if (!ROCK_MODELS) return false;
  const parts = loaded.get(kind);
  if (!parts) return false;
  for (let i = 0; i < ROCK_VARIANTS; i++) if (!parts.get(`v${i}`)?.length) return false;
  return true;
}

/** ONE VARIANT'S MODEL, in the unit frame, its vertices carrying their
 * shade as a grey — or null when the kind has no model loaded. */
export function rockModel(kind: RockKind, index: number): THREE.BufferGeometry | null {
  const parts = loaded.get(kind)?.get(`v${index}`);
  if (!parts || parts.length === 0) return null;
  const pos: number[] = [];
  const nrm: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (const part of parts) {
    const first = pos.length / 3;
    const n = part.position.length / 3;
    for (let i = 0; i < n; i++) {
      pos.push(part.position[i * 3], part.position[i * 3 + 1], part.position[i * 3 + 2]);
      nrm.push(part.normal[i * 3], part.normal[i * 3 + 1], part.normal[i * 3 + 2]);
      const shade = part.tone[i * 3];
      col.push(shade, shade, shade);
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
