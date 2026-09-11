// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCKS ON THE COAST — `level.solids`, the things the hull can hit,
// drawn as what they are: a boulder is a darker lump at the waterline, a
// reef a dark shape just under it that the water's own shallow tint gives
// away, and an ERRATIC one of the big angular blocks the ice left sitting
// on the shore itself (R17) — the biggest rock on the coast and the one the
// rider passes closest to.
//
// TWO WAYS OF DRAWING A ROCK, and which one a kind gets is decided by
// whether it STANDS OUT OF THE WATER:
//
//   SCULPTED, one mesh a kind. The sea stacks, the mark a course rounds
//   (R25) and the skerries are the coast's silhouette — the things a rider
//   reads the water by from a kilometre out — and there are a handful of
//   them a level. Each is carved for itself by `rock-shapes.ts` from its
//   own seed and merged into one geometry a kind, so no two are the same
//   shape and the whole lot is still one draw call. A shared geometry
//   cannot carry the one feature that says "this rock stands in the sea" —
//   the undercut at the waterline — because every rock's root is a
//   different share of its height.
//   INSTANCED, one shape a kind. The boulders, the reefs and the erratics
//   are small, numerous, and met at arm's length or not at all; one lump
//   spun about y and tinted per instance is the right answer and costs one
//   draw call for twenty of them.
//
// An erratic is the one kind placed against the GROUND rather than the sea:
// its `top` is a height above the water like every other solid's, but it
// stands on a beach that may be a metre up, so its foot is looked up in the
// level's own heightfield and the block drawn from there.

import * as THREE from "three";
import { TAU, hash2, sampleField, type Level, type Solid } from "@engine";

import { Builder } from "../lib/lowpoly.ts";
import { PALETTE } from "../identity.ts";
import { ROCK_FORMS, carveRock, rockFoot } from "./rock-shapes.ts";

const BOULDER = new THREE.Color(PALETTE.graniteDark);
/** A reef is a dark shape UNDER the water, and it has to stay a shape: the
 * tone here is the sea bed's own olive taken a step down rather than the
 * near-black it reads as on paper, because three converts a hex swatch to
 * linear and the darkest thing on the shore has nowhere left to fall. */
const REEF = new THREE.Color(0x475840);
/** The erratics: warmer than the slab they sit on, because they came from
 * somewhere else — which is the whole point of an erratic, and what makes
 * one read as an object on the shore rather than as part of it. */
const ERRATIC = new THREE.Color(0x9a8b78);

const m = new THREE.Matrix4();
const pos = new THREE.Vector3();
const quat = new THREE.Quaternion();
const lean = new THREE.Quaternion();
const axis = new THREE.Vector3();
const scale = new THREE.Vector3();
const color = new THREE.Color();

function instanced(
  geometry: THREE.BufferGeometry,
  solids: Solid[],
  place: (s: Solid) => void,
  tint: THREE.Color,
  seed: number,
  tilt = 0,
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshLambertMaterial({ flatShading: true }),
    Math.max(1, solids.length),
  );
  mesh.count = solids.length;
  solids.forEach((s, i) => {
    place(s);
    // EVERY DRAW OFF A ROCK'S PLACE GOES THROUGH `hash2`. The obvious
    // `(s.x * k) % n` is not a hash on this coast: JavaScript's remainder
    // keeps the sign of its dividend, so every solid west or south of the
    // origin gets the whole range NEGATED — a one-sided lean and a
    // one-sided darkening rather than a scatter either side of nothing.
    quat.setFromAxisAngle(pos.set(0, 1, 0), hash2(Math.round(s.x), Math.round(s.z), seed) * TAU);
    if (tilt > 0) {
      // A block dropped by ice does not sit level. The lean is small — one
      // leaning far reads as a rock that fell over — and deterministic in
      // the solid's own place, so a seed draws the same shore twice.
      lean.setFromAxisAngle(
        axis.set(Math.sin(s.x), 0, Math.cos(s.z)).normalize(),
        (hash2(Math.round(s.z), Math.round(s.x), seed) - 0.5) * 2 * tilt,
      );
      quat.multiply(lean);
    }
    m.compose(pos.set(s.x, pos.y, s.z), quat, scale);
    mesh.setMatrixAt(i, m);
    // A touch of variation in the grey so a field of them is not one rock
    // stamped over and over. Scaled rather than offset in lightness: an
    // offset is an absolute step, and a step that size takes the darkest
    // tone on the shore all the way to black.
    const v = (hash2(Math.round(s.x * 3), Math.round(s.z * 3), seed) - 0.5) * 0.22;
    mesh.setColorAt(i, color.copy(tint).multiplyScalar(1 + v));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

/** THE SCULPTED KINDS: every rock of one kind carved for itself into one
 * merged, flat-shaded, vertex-coloured mesh. The seed a rock's own wobble
 * is drawn from is its PLACE through `hash2` — the level seed alone would
 * give a coast one rock at six sizes again — so a seed builds the same
 * coast every time it is loaded and a rock keeps its shape across a
 * reload. */
function sculpted(level: Level, kind: keyof typeof ROCK_FORMS): THREE.Mesh | null {
  const solids = level.solids.filter((s) => s.kind === kind);
  if (solids.length === 0) return null;
  const b = new Builder();
  for (const s of solids) {
    carveRock(
      b,
      ROCK_FORMS[kind],
      s.x,
      s.z,
      s.r,
      s.top,
      rockFoot(sampleField(level.ground, s.x, s.z), s.r),
      // An INTEGER seed: `hash2` mixes its third argument as one, so a
      // fraction between 0 and 1 hands every rock on the coast the same
      // wobble and the whole point of carving them separately is lost.
      1 + Math.floor(hash2(Math.round(s.x), Math.round(s.z), level.seed) * 0x7ffffffe),
    );
  }
  return new THREE.Mesh(
    b.geometry(),
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
}

export function createRocks(level: Level): THREE.Group {
  const group = new THREE.Group();
  const by = (kind: Solid["kind"]) => level.solids.filter((s) => s.kind === kind);
  // The things that stand out of the water, each one its own rock.
  for (const kind of ["stack", "mark", "skerry"] as const) {
    const mesh = sculpted(level, kind);
    if (mesh) group.add(mesh);
  }
  // A boulder: a squashed low-poly sphere.
  const lump = new THREE.SphereGeometry(1, 6, 4);
  group.add(
    instanced(
      lump,
      by("boulder"),
      (s) => {
        pos.y = s.top - s.r * 0.55;
        scale.set(s.r, s.r * 0.8, s.r * 0.9);
      },
      BOULDER,
      level.seed,
    ),
  );
  // An erratic: an angular block, faceted rather than rounded, rooted in
  // the ground it was dropped on rather than hung off sea level.
  group.add(
    instanced(
      new THREE.IcosahedronGeometry(1, 0),
      by("erratic"),
      (s) => {
        // Buried a third of its radius, so it sits IN the beach rather than
        // balancing on it, and the ground never shows under its rim.
        const foot = sampleField(level.ground, s.x, s.z) - s.r * 0.35;
        const h = Math.max(0.4, s.top - foot);
        pos.y = foot + h / 2;
        scale.set(s.r, h / 2, s.r * 0.88);
      },
      ERRATIC,
      level.seed,
      0.22,
    ),
  );
  // A reef: flatter still, and under the surface.
  group.add(
    instanced(
      lump,
      by("reef"),
      (s) => {
        pos.y = s.top - s.r * 0.5;
        scale.set(s.r * 1.1, s.r * 0.55, s.r);
      },
      REEF,
      level.seed,
    ),
  );
  return group;
}
