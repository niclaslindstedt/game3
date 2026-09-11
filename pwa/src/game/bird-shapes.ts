// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIRDS, BUILT — one flat-shaded, vertex-coloured geometry a species
// out of the roster's own numbers (`bird-defs.ts`), and the material that
// flies it. The look is here: `BIRD_STYLES` is the paint, the way the
// fauna's `STYLES` and the craft's `craft-styles.ts` are, and the
// proportions come from the row so a swan is built long-necked because the
// catalog says it is.
//
// SEEN FROM BELOW is the design constraint. A chase camera on the water
// looks UP at a bird, so what reads is the UNDERSIDE — and every wing here
// is two surfaces, a mantle on top and a belly colour beneath, because a
// gull from the water is white with black tips and a gull painted grey on
// both faces is a crow. The silhouette is the other half: the neck out
// front (a swan's as long as its back, a gull's a third), the tail fan, a
// crane's legs trailing, and the WING — long and swept on a tern, short and
// broad on an eider, a square-tipped plank on the eagle — which is the one
// thing still legible when the bird is four pixels.
//
// THE WINGS MOVE IN THE VERTEX SHADER. A rigid bird is a paper dart and a
// group of meshes per bird is three draw calls a bird; so the wing carries
// its own hinges: every wing vertex knows it is a wing (`aWing`), and per
// instance the shader is told the FLAP (the shoulder's angle off level —
// the beat, or the dihedral a glide holds) and the FOLD (0 open, 1 closed:
// the arm sweeps back at the shoulder and the hand folds back at the wrist
// to lie along the flank, which is a bird on a rock). Both are read off
// `birdPose`; the graft goes in through `onBeforeCompile`, the same door
// `fauna.ts` uses for the tail beat. One draw call a species, whatever is
// in the air.

import * as THREE from "three";

import { Builder, type P } from "../lib/lowpoly.ts";
import type { BirdId, BirdSpec } from "./bird-defs.ts";

/** How a species is PAINTED — every colour a bird has. */
export type BirdStyle = {
  /** The mantle: the back and the top of the wing. */
  readonly back: number;
  /** The underside: the belly and the underwing. */
  readonly belly: number;
  /** The wingtip — the outer hand, both faces. */
  readonly tip: number;
  readonly head: number;
  readonly bill: number;
  /** The tail, when it is not the mantle's colour (an eagle's white). */
  readonly tail?: number;
  /** Legs trailing in flight, for the one bird whose legs are the
   * silhouette. */
  readonly legs?: number;
};

export const BIRD_STYLES: Readonly<Record<BirdId, BirdStyle>> = {
  // Grey mantle, white below, black wingtips, a yellow bill.
  gull: { back: 0x8a939b, belly: 0xf2f4f5, tip: 0x1b1e22, head: 0xf2f4f5, bill: 0xe0b23a },
  // Pale grey, white below, black cap, red bill.
  tern: { back: 0x9aa3ab, belly: 0xf4f6f7, tip: 0x2a2d31, head: 0x1c1f22, bill: 0xc9352a },
  // Black all over; the pale gape is the one thing that is not.
  cormorant: { back: 0x141618, belly: 0x1b1e21, tip: 0x101214, head: 0x141618, bill: 0xd9c46a },
  // The drake: white above, black below and behind — a raft of them is
  // black-and-white specks on the water, which is what a raft of eider is.
  eider: { back: 0xe9ebe8, belly: 0x141618, tip: 0x141618, head: 0xe9ebe8, bill: 0x9db08a },
  // Brown, with a pale head, dark fingers and THE WHITE TAIL — the field
  // mark, and the one thing on it that reads from the water.
  eagle: {
    back: 0x4a3b2c,
    belly: 0x5a4a38,
    tip: 0x2c2420,
    head: 0xa08c6a,
    bill: 0xd8b44a,
    tail: 0xe8e4da,
  },
  goose: { back: 0x6f6659, belly: 0xb9b3a4, tip: 0x3a3530, head: 0x6f6659, bill: 0xe08a4a },
  // The one bird lighter than the sky.
  swan: { back: 0xf1f3f2, belly: 0xf1f3f2, tip: 0xe4e7e6, head: 0xf1f3f2, bill: 0xe8c93a },
  // Grey, black primaries, a dark head, and the legs out behind.
  crane: {
    back: 0x8d9296,
    belly: 0xa9adb0,
    tip: 0x1f2226,
    head: 0x3a3d40,
    bill: 0x9c9a8a,
    legs: 0x2a2d30,
  },
};

/** How far back the ARM sweeps at the shoulder and the HAND at the wrist
 * when a wing is fully folded, rad. Together they lay the hand along the
 * flank pointing at the tail, which is what a folded wing is. */
const ARM_FOLD = 1.2;
const HAND_FOLD = 0.95;

/** How thick a wing is drawn, m, as the gap between its two faces — enough
 * that they never fight for the same pixels, and nothing a bird's size
 * would ever show. */
const WING_SKIN = 0.006;

/** Where along the half-span the wing's vertex columns stand, as shares;
 * the wrist is added between them, so the fold has a column to hinge on. */
const STATIONS = [0.03, 0.3, 0.62, 0.84, 1];

/** Where the wingtip's dark begins, as a share of the half-span. */
const TIP_FROM = 0.78;

/** The wing's plan: the leading and trailing edge z at a share `s` of the
 * half-span, off the row's chord, taper and sweep. The leading edge is
 * carried a little ahead of the shoulder and swept back toward the tip;
 * the chord tapers to the row's own tip. */
function wingEdges(spec: BirdSpec, s: number): { lead: number; trail: number } {
  const half = spec.span / 2;
  const c0 = spec.span * spec.wing.chord;
  const chord = c0 * (1 - (1 - spec.wing.taper) * s);
  const lead = c0 * 0.45 - spec.wing.sweep * half * Math.pow(s, 1.5);
  return { lead, trail: lead - chord };
}

/** One wing's two faces, right side (x > 0); the caller mirrors it. */
function wing(b: Builder, spec: BirdSpec, style: BirdStyle, wingOf: number[]): void {
  const half = spec.span / 2;
  const stations = [...STATIONS, spec.wing.wrist].sort((a, c) => a - c);
  const at = (s: number, y: number): [P, P] => {
    const e = wingEdges(spec, s);
    return [
      [s * half, y, e.lead],
      [s * half, y, e.trail],
    ];
  };
  const mark = (): void => {
    while (wingOf.length < b.vertexCount) wingOf.push(1);
  };
  for (let i = 0; i + 1 < stations.length; i++) {
    const s0 = stations[i];
    const s1 = stations[i + 1];
    const dark = s1 > TIP_FROM + 1e-6;
    const top = dark ? style.tip : style.back;
    const under = dark ? style.tip : style.belly;
    const [l0, t0] = at(s0, WING_SKIN / 2);
    const [l1, t1] = at(s1, WING_SKIN / 2);
    // The top face, seen from above.
    if (s1 >= 1) b.tri(l0, l1, t0, top);
    else b.quad(l0, l1, t1, t0, top);
    const [bl0, bt0] = at(s0, -WING_SKIN / 2);
    const [bl1, bt1] = at(s1, -WING_SKIN / 2);
    // The underside, wound the other way so it faces down.
    if (s1 >= 1) b.tri(bl0, bt0, bl1, under);
    else b.quad(bl0, bt0, bt1, bl1, under);
    mark();
  }
}

/** The body: a spindle about the shoulders, the neck and head out front,
 * the bill, the tail fan behind, and the legs where a row has them. */
function body(b: Builder, spec: BirdSpec, style: BirdStyle, wingOf: number[]): void {
  const L = spec.length;
  const neck = spec.neck * L;
  const back = (1 - spec.neck) * L;
  const r = L * 0.11;
  // The torso, widest at the shoulders, tapering to the tail root and
  // rounding off at the chest. Rings along z, six sides, back over belly.
  const zs = [-back * 0.62, -back * 0.3, 0.05 * L, 0.24 * L];
  const rs = [0.35, 0.85, 1, 0.72];
  const SIDES = 6;
  const rings: P[][] = zs.map((z, k) =>
    Array.from({ length: SIDES }, (_, s) => {
      const a = (s / SIDES) * Math.PI * 2;
      return [Math.cos(a) * r * rs[k], Math.sin(a) * r * rs[k] * 0.95, z] as P;
    }),
  );
  for (let k = 0; k + 1 < rings.length; k++) {
    for (let s = 0; s < SIDES; s++) {
      const s1 = (s + 1) % SIDES;
      // The top facets take the mantle, the bottom ones the belly.
      const up = Math.sin(((s + 0.5) / SIDES) * Math.PI * 2);
      b.quad(
        rings[k][s],
        rings[k][s1],
        rings[k + 1][s1],
        rings[k + 1][s],
        up > 0 ? style.back : style.belly,
      );
    }
  }
  b.cap(rings[0], style.tail ?? style.back, true);
  b.cap(rings[rings.length - 1], style.back, false);
  // The neck: a thinner tube from the chest to the head, and the head a
  // lump with the bill on it. Both carried on the shoulder line, a little
  // up, which is how a flying bird holds them.
  const headZ = neck - L * 0.07;
  const headR = r * 0.55;
  b.tube([0, r * 0.25, 0.2 * L], [0, r * 0.45, headZ - headR * 0.6], r * 0.4, style.back, 5);
  const head: P[][] = [];
  for (const [dz, rr] of [
    [-headR, 0.4],
    [-headR * 0.3, 1],
    [headR * 0.5, 0.8],
  ] as const) {
    head.push(
      Array.from({ length: 5 }, (_, s) => {
        const a = (s / 5) * Math.PI * 2;
        return [Math.cos(a) * headR * rr, r * 0.45 + Math.sin(a) * headR * rr, headZ + dz] as P;
      }),
    );
  }
  b.loft(head, Array<number>(5).fill(style.head), true);
  b.cap(head[head.length - 1], style.head, false);
  b.cap(head[0], style.head, true);
  b.tube([0, r * 0.4, headZ + headR * 0.4], [0, r * 0.3, neck], headR * 0.35, style.bill, 4);
  // The tail: a fan, flat, from the tail root back to the row's own tail
  // — narrow, because a wide one reads as a second pair of wings.
  const root = -back * 0.62;
  const tail = style.tail ?? style.back;
  const tw = spec.span * 0.06;
  b.quad(
    [-r * 0.3, 0.003, root],
    [r * 0.3, 0.003, root],
    [tw, 0.003, -back],
    [-tw, 0.003, -back],
    tail,
  );
  b.quad(
    [-r * 0.3, -0.003, root],
    [-tw, -0.003, -back],
    [tw, -0.003, -back],
    [r * 0.3, -0.003, root],
    style.tail ?? style.belly,
  );
  // Legs trailing behind, where the row's silhouette has them.
  if (style.legs) {
    for (const side of [-1, 1]) {
      b.tube(
        [side * r * 0.35, -r * 0.4, root],
        [side * r * 0.4, -r * 0.35, -back - L * 0.3],
        r * 0.1,
        style.legs,
        3,
      );
    }
  }
  while (wingOf.length < b.vertexCount) wingOf.push(0);
}

/**
 * One bird of a species, in metres, shoulders at the origin, bill toward
 * +z: the body, and both wings LEVEL — the shader flaps and folds them per
 * instance. Carries `aWing` (1 on a wing vertex) for the graft to read.
 */
export function buildBird(spec: BirdSpec, style: BirdStyle): THREE.BufferGeometry {
  const b = new Builder();
  const wingOf: number[] = [];
  body(b, spec, style, wingOf);
  // The right wing, then the same shapes mirrored for the left: every
  // vertex keeps its own side in the sign of x, which is what the shader
  // hinges on.
  const before = b.vertexCount;
  wing(b, spec, style, wingOf);
  const geometry = b.geometry();
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  const col = geometry.getAttribute("color") as THREE.BufferAttribute;
  const n = pos.count;
  const wingCount = n - before;
  const positions = new Float32Array((n + wingCount) * 3);
  const colours = new Float32Array((n + wingCount) * 3);
  const wingFlag = new Float32Array(n + wingCount);
  positions.set(pos.array as Float32Array);
  colours.set(col.array as Float32Array);
  wingFlag.set(wingOf);
  for (let i = 0; i < wingCount; i += 3) {
    // Mirrored in x, and rewound so the face still points the same way.
    for (let k = 0; k < 3; k++) {
      const from = before + i + (2 - k);
      const to = n + i + k;
      positions[to * 3] = -pos.getX(from);
      positions[to * 3 + 1] = pos.getY(from);
      positions[to * 3 + 2] = pos.getZ(from);
      colours[to * 3] = col.getX(from);
      colours[to * 3 + 1] = col.getY(from);
      colours[to * 3 + 2] = col.getZ(from);
      wingFlag[to] = 1;
    }
  }
  geometry.dispose();
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  out.setAttribute("aWing", new THREE.Float32BufferAttribute(wingFlag, 1));
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

/**
 * The species' material, with the wing hinges grafted into its vertex
 * shader. `wrist` is baked in as a literal: the material belongs to one
 * species and there is nothing for a uniform to vary over. Lit by the
 * scene's two lights and taking the fog like everything on the shore, so a
 * bird goes dark at night and pale into the haze on its own.
 */
export function birdMaterial(spec: BirdSpec): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    // The tail and the wings are sheets, and a folded wing turns its
    // faces every way; a face that is never culled is a face that is
    // never a hole.
    side: THREE.DoubleSide,
  });
  const num = (v: number): string => v.toFixed(4);
  const wrist = (spec.span / 2) * spec.wing.wrist;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = `attribute float aWing;
attribute float aFlap;
attribute float aFold;
${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
\tif (aWing > 0.5) {
\t\tfloat side = position.x < 0.0 ? -1.0 : 1.0;
\t\tfloat x = abs(position.x);
\t\tfloat y = position.y;
\t\tfloat z = position.z;
\t\tfloat hand = x - ${num(wrist)};
\t\tif (hand > 0.0) {
\t\t\tfloat a = aFold * ${num(HAND_FOLD)};
\t\t\tfloat c = cos(a);
\t\t\tfloat s = sin(a);
\t\t\tfloat hx = hand * c + z * s;
\t\t\tfloat hz = -hand * s + z * c;
\t\t\tx = ${num(wrist)} + hx;
\t\t\tz = hz;
\t\t}
\t\tfloat b = aFold * ${num(ARM_FOLD)};
\t\tfloat cb = cos(b);
\t\tfloat sb = sin(b);
\t\tfloat ax = x * cb + z * sb;
\t\tfloat az = -x * sb + z * cb;
\t\tfloat cf = cos(aFlap);
\t\tfloat sf = sin(aFlap);
\t\ttransformed = vec3(side * (ax * cf - y * sf), ax * sf + y * cf, az);
\t}`,
    );
  };
  // Three's default key is the graft's source text, which is the same for
  // every species; the key has to say whose wrist was baked in.
  material.customProgramCacheKey = () => `bird:${spec.id}`;
  return material;
}
