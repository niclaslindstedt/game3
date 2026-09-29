// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED SEA LIFE the water draws: every species of the catalog
// (`engine/game/defs/fauna.ts`), MODELLED in Blender off its own row and
// its paint's proportions (`make blender KIND=fauna`,
// `scripts/blender/fauna.py`), committed as one glTF a species in
// `pwa/models/fauna/` by `make models` and packed by every build — unless
// a build is switched back to the code-built bodies (`VITE_MODEL_FAUNA=0`;
// `model-switch.ts`). A species whose file did not load is drawn by
// `fauna.ts`'s own builder, as every animal is under the switch.
//
// A MODEL CARRIES NO COLOUR: every face is a ROLE (`fauna-body.ts`'s
// `FAUNA_ROLES`: the hide, a fin, a flipper's banded half) and every hide
// vertex says WHERE ON THE BODY it is — its station along the body in R
// (0 tail, 1 nose) and how far up it in G (0 keel, 1 spine) — so
// `faunaModel` paints it here with the very `hide` the code paints its own
// body with, TWICE (as it is, and lifted for deep water: `aDeep`), and the
// same shader beats its tail and slides its paint. The geometry comes back
// in the code's own frame: one unit-length body, z −0.5 at the tail.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { FAUNA_IDS, type FaunaId } from "@engine";

import { BODY } from "./fauna-body.ts";
import type { FaunaStyle } from "./fauna-styles.ts";
import { modelSwitch } from "./model-switch.ts";
import { partsOf, type TreePart } from "./tree-models.ts";

/** The build's environment — Vite's in the app; none in the suite. */
const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Whether this build draws the modelled sea life (ON unless turned off). */
export const FAUNA_MODELS = modelSwitch(ENV.VITE_MODEL_FAUNA);

/** The colour of the hide at a station and an angle round the body, at a
 * shade — `fauna.ts`'s own `hide`, handed in so this module needs none. */
export type Hide = (style: FaunaStyle, s: number, up: number, shade: number) => number;

/** Every species' parts (the one mesh `body`, a primitive a role). */
const loaded = new Map<string, TreePart[]>();
let loading: Promise<void> | null = null;

/** Fetch every species' model, once (`base` where the site's `models/`
 * is); resolves when all are in or given up on. */
export function loadFaunaModels(base = String(ENV.BASE_URL ?? "/")): Promise<void> {
  if (loading) return loading;
  if (!FAUNA_MODELS) return (loading = Promise.resolve());
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loading = Promise.all(
    FAUNA_IDS.map((id) =>
      loader.loadAsync(`${base}models/fauna/${id}.glb`).then(
        (g) => void loaded.set(id, partsOf(g, /^body$/).get("body") ?? []),
        () => undefined,
      ),
    ),
  ).then(() => undefined);
  return loading;
}

/** Hand a species' parsed parts in directly (the suite). */
export function setFaunaModel(id: string, parts: TreePart[]): void {
  loaded.set(id, parts);
}

/** Whether a species is drawn off its model on this build. */
export function hasFaunaModel(id: string): boolean {
  return FAUNA_MODELS && (loaded.get(id)?.length ?? 0) > 0;
}

/**
 * ONE SPECIES' MODEL, dressed: its hide painted by `hide` at the wet shade
 * (`color`) and the deep one (`aDeep`), its fins in the style's fin colour,
 * a flipper's banded half whitened where the style says — or null when the
 * species has no model loaded (the code's builder draws it).
 */
export function faunaModel(
  id: FaunaId,
  style: FaunaStyle,
  hide: Hide,
): THREE.BufferGeometry | null {
  const parts = loaded.get(id);
  if (!parts || parts.length === 0) return null;
  const finColour = style.fin ?? style.back;
  const band = style.flipperBand ? style.belly : finColour;
  const pos: number[] = [];
  const nrm: number[] = [];
  const wet: number[] = [];
  const deep: number[] = [];
  const idx: number[] = [];
  const c = new THREE.Color();
  for (const part of parts) {
    const first = pos.length / 3;
    const n = part.position.length / 3;
    for (let i = 0; i < n; i++) {
      pos.push(part.position[i * 3], part.position[i * 3 + 1], part.position[i * 3 + 2]);
      nrm.push(part.normal[i * 3], part.normal[i * 3 + 1], part.normal[i * 3 + 2]);
      if (part.role === "hide") {
        const s = part.tone[i * 3];
        const up = part.tone[i * 3 + 1] * 2 - 1;
        c.setHex(hide(style, s, up, BODY.shadeWet));
        wet.push(c.r, c.g, c.b);
        c.setHex(hide(style, s, up, BODY.shadeDeep));
        deep.push(c.r, c.g, c.b);
      } else {
        c.setHex(part.role === "band" ? band : finColour);
        wet.push(c.r, c.g, c.b);
        deep.push(c.r, c.g, c.b);
      }
    }
    for (const k of part.index) idx.push(first + k);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(wet, 3));
  g.setAttribute("aDeep", new THREE.Float32BufferAttribute(deep, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
