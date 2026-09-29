// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT BLENDER IS HANDED: the game's own data for one modelled asset, as
// plain numbers a JSON file carries — read by `make blender`
// (`scripts/blender.mjs`, which writes it out for `scripts/blender/*.py`)
// and by the stamp every committed model is held to (`pwa/models-stamp.ts`),
// so a model is stale exactly when what it would be made from has moved.
// Stated here and nowhere else: nothing about a model's shape is typed
// into a builder.
//
//   a craft   the spec, its style, the lines `craft-body.ts` lofts it on
//             (every station's section, the saddle, every fitting, the
//             cockpit and the opening the sea is cut out of), where it
//             floats, and the travel the game turns its bars and its gate
//             through (`craft-rig.ts`)
//   the rider the kit's paint, his body, the pose he is bound in and every
//             bone's frame there (`rider-rig.ts`), the pieces the game
//             draws him of in it (`figureParts`), and every clip sampled
//             off the game's own `poseRider`
//   a tree    a KIND of tree (`tree-variants.ts`): its row of the roster's
//             look, the proportions the code's builder draws its form with
//             (`TREE_SHAPE`), its six variants with each one's silhouette
//             sampled off `crownAt`, and the height a model is made at —
//             and, for the stills alone, its colours in linear light
//             (`treeStillPaint`; the glTF carries none, the game dresses it)
//
// Renderer-side and three-free in what it returns; it reads the builders'
// own modules, which carry three.js for their geometry.

import * as THREE from "three";
import { CRAFT_IDS, biomeOf, craftById, restY, type CraftId } from "@engine";

import { cockpitOf, craftLines } from "./craft-body.ts";
import { BAR_TURN, BUCKET_SWING } from "./craft-rig.ts";
import { CRAFT_STYLES } from "./craft-styles.ts";
import { BODY, RIDER_SCALE, poseRider } from "./rider-pose.ts";
import { RIDING, riderBones, riderClips } from "./rider-rig.ts";
import { PAINT, RIDER_FINISH, figureParts } from "./rider.ts";
import {
  TREE_KINDS,
  TREE_REFERENCE,
  TREE_SHAPE,
  TREE_VARIANTS,
  crownAt,
  treeSpec,
} from "./tree-variants.ts";

/** Every craft that is modelled: the whole catalog. */
export const MODELLED_CRAFTS: readonly CraftId[] = CRAFT_IDS;

/** A craft, for `scripts/blender/craft.py`. */
export function craftModelData(id: CraftId) {
  const spec = craftById(id);
  const style = CRAFT_STYLES[id];
  return {
    spec: {
      id: spec.id,
      archetype: spec.archetype,
      length: spec.length,
      beam: spec.beam,
      height: spec.height,
      deadrise: spec.deadrise,
    },
    style,
    lines: craftLines(spec, style),
    rest: restY(spec, biomeOf("taiga").water.density),
    gear: { barTurn: BAR_TURN, bucketSwing: BUCKET_SWING },
  };
}

/** The rider, for `scripts/blender/rider.py`: one, in the kit every
 * craft's rider wears. */
export function riderModelData() {
  const cockpit = cockpitOf(craftById(RIDING.craft), CRAFT_STYLES[RIDING.craft]);
  const pose = poseRider(cockpit, RIDING.read);
  return {
    paint: PAINT,
    finish: RIDER_FINISH,
    scale: RIDER_SCALE,
    body: BODY,
    rest: { pose, bones: riderBones(pose), floor: Math.min(...pose.floors) },
    parts: figureParts(pose),
    clips: riderClips(cockpit).map((c) => ({
      name: c.name,
      seconds: c.seconds,
      frames: c.poses.map(riderBones),
    })),
  };
}

/** Every tree that is modelled: every tree-form row of the roster. */
export const MODELLED_TREES: readonly string[] = TREE_KINDS;

/** A kind of tree, for `scripts/blender/tree.py`: what it is SHAPED like —
 * no colour, which the stamp is taken over, so a retinted row moves no
 * model (the game dresses a model in the row's colours as it draws it). */
export function treeModelData(kind: string) {
  const spec = treeSpec(kind);
  const { form, spread, stems, bare, height } = spec.look;
  return {
    kind,
    name: spec.name,
    form,
    look: { spread, stems, bare, height, marks: spec.look.stemMark !== undefined },
    reference: TREE_REFERENCE,
    shape: TREE_SHAPE[form as keyof typeof TREE_SHAPE],
    variants: TREE_VARIANTS[kind].map((v) => ({
      ...v,
      profile: Array.from({ length: 41 }, (_, i) => crownAt(v, i / 40)),
    })),
  };
}

/** A kind's colours in linear light, for the Blender stills only — the
 * row's own (`flora-defs.ts`) through the same conversion the game's
 * colours go through. */
export function treeStillPaint(kind: string) {
  const look = treeSpec(kind).look;
  const rgb = (hex: number): number[] => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };
  return {
    stem: rgb(look.stem),
    stemHigh: rgb(look.stemHigh ?? look.stem),
    stemMark: rgb(look.stemMark ?? look.stem),
    leafLit: rgb(look.leafLit),
    leafDark: rgb(look.leafDark),
  };
}
