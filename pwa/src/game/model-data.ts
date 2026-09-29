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
//             (`plantStillPaint`; the glTF carries none, the game dresses it)
//   a rock    a KIND of instanced rock (`rock-variants.ts`): the code's
//             proportions and its four variants — no colour, the coast's
//   a mark    the gate mark or the rounding buoy (`mark-shapes.ts`): the
//             profiles and dimensions the code lathes, the buoy's reference
//   a bird    a SPECIES (`bird-defs.ts`): its span, length, neck and wing,
//             the wing's numbers (`bird-wing.ts`), whether it trails legs
//   an animal a SPECIES of sea life (`defs/fauna.ts`, `fauna-styles.ts`):
//             its kind, length and beam, its style's proportions and
//             markings, and the body the code lofts (`fauna-body.ts`)
//   the undergrowth  a KIND of bush, tuft, reed or stone
//             (`undergrowth-variants.ts`): its row's look, the proportions
//             the code draws its form with (`UNDER_SHAPE`), its four
//             variants, the same reference height — and its colours for
//             the stills, the same way
//
// Renderer-side and three-free in what it returns; it reads the builders'
// own modules, which carry three.js for their geometry.

import * as THREE from "three";
import {
  CRAFT_IDS,
  FAUNA_IDS,
  biomeOf,
  craftById,
  faunaById,
  restY,
  type CraftId,
  type FaunaId,
} from "@engine";

import { cockpitOf, craftLines } from "./craft-body.ts";
import { BAR_TURN, BUCKET_SWING } from "./craft-rig.ts";
import { CRAFT_STYLES } from "./craft-styles.ts";
import { BODY, RIDER_SCALE, poseRider } from "./rider-pose.ts";
import { RIDING, riderBones, riderClips } from "./rider-rig.ts";
import { PAINT, RIDER_FINISH, figureParts } from "./rider.ts";
import { FLORA } from "./flora-defs.ts";
import {
  TREE_KINDS,
  TREE_REFERENCE,
  TREE_SHAPE,
  TREE_VARIANTS,
  crownAt,
  treeSpec,
} from "./tree-variants.ts";
import { BIRDS, BIRD_IDS, type BirdId } from "./bird-defs.ts";
import { BIRD_STYLES } from "./bird-shapes.ts";
import { BIRD_ROLES, WING, roleColour } from "./bird-wing.ts";
import { BODY as FAUNA_BODY, GIRTH } from "./fauna-body.ts";
import { STYLES as FAUNA_STYLES } from "./fauna-styles.ts";
import { BUOY, BUOY_REFERENCE, MARK, MARK_KINDS, type MarkKind } from "./mark-shapes.ts";
import { ROCK_KINDS, ROCK_LUMP, ROCK_ROWS, type RockKind } from "./rock-variants.ts";
import { UNDER_KINDS, UNDER_ROWS, UNDER_SHAPE, underSpec } from "./undergrowth-variants.ts";

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

/** Every kind of undergrowth that is modelled: every bush, tuft, reed and
 * stone row of the roster. */
export const MODELLED_UNDERGROWTH: readonly string[] = UNDER_KINDS;

/** A kind of undergrowth, for `scripts/blender/undergrowth.py`: what it is
 * SHAPED like, and no colour, as a tree's. */
export function undergrowthModelData(kind: string) {
  const spec = underSpec(kind);
  const { form, spread, stems, bare, height } = spec.look;
  return {
    kind,
    name: spec.name,
    form,
    look: { spread, stems, bare, height, marks: spec.look.stemMark !== undefined },
    reference: TREE_REFERENCE,
    small: UNDER_SHAPE.bush.small,
    shape: UNDER_SHAPE[form as keyof typeof UNDER_SHAPE],
    variants: UNDER_ROWS[kind],
  };
}

/** Every kind of rock that is modelled: the three `rocks.ts` instances. */
export const MODELLED_ROCKS: readonly RockKind[] = ROCK_KINDS;

/** A kind of rock, for `scripts/blender/rock.py`: the code's proportions
 * and its four variants. No colour — the coast tints each instance. */
export function rockModelData(kind: RockKind) {
  return { kind, lump: ROCK_LUMP[kind], variants: ROCK_ROWS[kind] };
}

/** The two marks that are modelled: the gate mark and the rounding buoy. */
export const MODELLED_MARKS: readonly MarkKind[] = MARK_KINDS;

/** A mark, for `scripts/blender/mark.py`: the code's own profiles and
 * dimensions, and the buoy's reference size. */
export function markModelData(kind: MarkKind) {
  return { kind, mark: MARK, buoy: BUOY, reference: BUOY_REFERENCE };
}

/** Every bird that is modelled: the whole roster. */
export const MODELLED_BIRDS: readonly BirdId[] = BIRD_IDS;

/** A species, for `scripts/blender/bird.py`: what it is SHAPED like — its
 * row's proportions, the wing's numbers, whether it trails legs — and no
 * colour, which the game dresses it in. */
export function birdModelData(id: BirdId) {
  const spec = BIRDS.find((b) => b.id === id);
  if (!spec) throw new Error(`no bird "${id}"`);
  const { span, length, neck, wing } = spec;
  return {
    id,
    name: spec.name,
    spec: { span, length, neck, wing },
    wing: WING,
    legs: BIRD_STYLES[id].legs !== undefined,
  };
}

/** A species' colours in linear light, by role, for the Blender stills only. */
export function birdStillPaint(id: BirdId) {
  const style = BIRD_STYLES[id];
  const out: Record<string, number[]> = {};
  for (const role of BIRD_ROLES) {
    const hex = roleColour(role, style);
    if (hex === null) continue;
    const c = new THREE.Color(hex);
    out[role] = [c.r, c.g, c.b];
  }
  return out;
}

/** Every animal that is modelled: the whole catalog. */
export const MODELLED_FAUNA: readonly FaunaId[] = FAUNA_IDS;

/** A species of sea life, for `scripts/blender/fauna.py`: what it is
 * SHAPED like — its kind, its length and beam, its style's proportions and
 * markings, the body the code lofts — and no colour, which the game
 * paints per vertex. */
export function faunaModelData(id: FaunaId) {
  const spec = faunaById(id);
  const style = FAUNA_STYLES[id];
  return {
    id,
    name: spec.name,
    kind: spec.kind,
    length: spec.length,
    beam: spec.beam,
    style: {
      height: style.height,
      dorsal: style.dorsal,
      pectoral: style.pectoral,
      tail: style.tail,
      saddle: style.saddle ?? false,
      flipperBand: style.flipperBand ?? false,
      bars: style.bars ?? 0,
    },
    body: FAUNA_BODY,
    girth: GIRTH,
  };
}

/** A species' colours in linear light, by role, for the Blender stills only. */
export function faunaStillPaint(id: FaunaId) {
  const style = FAUNA_STYLES[id];
  const rgb = (hex: number): number[] => {
    const c = new THREE.Color(hex);
    return [c.r, c.g, c.b];
  };
  const fin = style.fin ?? style.back;
  return { hide: rgb(style.back), fin: rgb(fin), band: rgb(style.flipperBand ? style.belly : fin) };
}

/** A plant kind's colours in linear light, for the Blender stills only —
 * the row's own (`flora-defs.ts`) through the same conversion the game's
 * colours go through. A tree's or the undergrowth's alike. */
export function plantStillPaint(kind: string) {
  const spec = FLORA.find((s) => s.id === kind);
  if (!spec) throw new Error(`no plant kind "${kind}"`);
  const look = spec.look;
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
