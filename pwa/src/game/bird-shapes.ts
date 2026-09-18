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
  // ── The open sea ──────────────────────────────────────────────────────
  // White with BLACK OUTER HANDS and a buff head: at range a gannet is a
  // white cross with the tips dipped in ink, and nothing else is.
  gannet: { back: 0xf4f5f2, belly: 0xf6f7f5, tip: 0x17191c, head: 0xe3d5a8, bill: 0x9aa4a8 },
  // Grey above, white below, and a plain dark eye-patch — the plainest
  // bird in either roster, which is what a fulmar is.
  fulmar: { back: 0x9aa1a6, belly: 0xf0f2f2, tip: 0x8a9196, head: 0xeceeee, bill: 0xb0a88c },
  // A cleaner, softer gull: grey mantle, white below, and wingtips dipped
  // black with no white in them at all.
  kittiwake: { back: 0x9ca7ae, belly: 0xf5f6f7, tip: 0x1d2024, head: 0xf5f6f7, bill: 0xd8c24a },
  // ── The mangrove coast ────────────────────────────────────────────────
  // Grey-brown all over and dark beneath, with the pale head and the long
  // horn-coloured bill: the one big bird here that is not white.
  pelican: { back: 0x6a6259, belly: 0x58514a, tip: 0x2a2723, head: 0xe8e0c8, bill: 0x8a7a5a },
  // Dark above and WHITE below, which from the water is the whole bird —
  // a white M with dark wrists.
  osprey: { back: 0x4a3f36, belly: 0xf0f0ea, tip: 0x2a2420, head: 0xf0f0ea, bill: 0x2a2420 },
  // White to the tips, a yellow bill, black legs trailing.
  egret: {
    back: 0xf6f6f2,
    belly: 0xf6f6f2,
    tip: 0xefefe8,
    head: 0xf6f6f2,
    bill: 0xe0b23a,
    legs: 0x1f1f1f,
  },
  // White with BLACK WINGTIPS — the one mark that tells an ibis from an
  // egret at range — and the red curved bill and legs.
  ibis: {
    back: 0xf4f4f0,
    belly: 0xf4f4f0,
    tip: 0x1a1a1a,
    head: 0xf4f4f0,
    bill: 0xe07a5a,
    legs: 0xe07a5a,
  },
  // PINK. The only bird in the game that is, carmine at the shoulder and
  // paler beneath, with the bare greenish head and the grey spoon.
  spoonbill: {
    back: 0xf2a0b0,
    belly: 0xf6c0c8,
    tip: 0xc84f66,
    head: 0xd8d0b8,
    bill: 0x8a8878,
    legs: 0xc85a6a,
  },
  // Black, with the white breast the females and the young carry — which
  // is what shows from below, and what keeps it from being a silhouette
  // with nothing to read.
  frigatebird: { back: 0x141416, belly: 0xe0e0dc, tip: 0x101012, head: 0x141416, bill: 0x8a8a84 },
  // Chocolate above and sharply WHITE below, cut off at the chest: the
  // cleanest two-tone in the game, and it is the underside that shows.
  booby: { back: 0x5a4a3c, belly: 0xf2f2ec, tip: 0x3a3028, head: 0x5a4a3c, bill: 0xd8c88a },
  // Sooty brown with a pale cap — dark against the sea and dark against
  // the sky, which is why a raft of them reads as a shadow on the water.
  noddy: { back: 0x40382f, belly: 0x4a423a, tip: 0x2a241e, head: 0xd6d2c4, bill: 0x1f1c18 },
  // BLACK ABOVE, WHITE BELOW, and the water only ever sees the white: a
  // flock of them overhead is a field of white crosses.
  sootytern: { back: 0x1b1d20, belly: 0xf4f5f4, tip: 0x141618, head: 0x1b1d20, bill: 0x141618 },
  // ── The arctic coast ──────────────────────────────────────────────────
  // A pale grey mantle and NO black in the tips: the wingtips are the
  // mantle's own pale grey, which is what tells a glaucous gull from every
  // other big gull at any range.
  glaucous: { back: 0xb4bcc2, belly: 0xf6f7f8, tip: 0xc8ced2, head: 0xf6f7f8, bill: 0xe0b23a },
  // White all over, tips included — the whitest thing in the roster — with
  // a dark eye, a grey-yellow bill and black legs.
  ivorygull: { back: 0xf8f9fa, belly: 0xfafbfc, tip: 0xf0f2f4, head: 0xf8f9fa, bill: 0xb8b090 },
  // The auks: black above, white below, and the water sees the white.
  littleauk: { back: 0x1a1c1e, belly: 0xf2f3f2, tip: 0x141618, head: 0x1a1c1e, bill: 0x1a1c1e },
  guillemot: { back: 0x1c1e22, belly: 0xf4f5f4, tip: 0x141618, head: 0x1c1e22, bill: 0x1a1a1a },
  // …and the puffin with its striped bill, orange from the water.
  puffin: { back: 0x1c1e22, belly: 0xf4f5f4, tip: 0x141618, head: 0x2a2c30, bill: 0xe07a3a },
  // Black, with the white patch on the wing — the one white on it — and
  // red feet nobody sees from the water.
  blackguillemot: {
    back: 0x1a1a1c,
    belly: 0x2a2a2c,
    tip: 0xe8e8e8,
    head: 0x1a1a1c,
    bill: 0x1a1a1a,
  },
  // The drake: white and black like the common eider, with the orange
  // shield over the bill that names it.
  kingeider: { back: 0xe6e8e4, belly: 0x141618, tip: 0x141618, head: 0xb8c8d4, bill: 0xe08a3a },
  // The drake in summer: dark brown above, white below and on the flank,
  // a white face patch.
  longtail: { back: 0x4a3e34, belly: 0xf0f0ea, tip: 0x2a241e, head: 0x4a3e34, bill: 0x2a2a2a },
  // A small dark goose: black head and neck, dark grey-brown mantle, the
  // white under the tail the one bright thing on it.
  brent: { back: 0x4a4a46, belly: 0x8a8a84, tip: 0x2a2a28, head: 0x1c1c1c, bill: 0x1c1c1c },
  // WHITE WITH BLACK WINGTIPS, the pink bill: from below a snow goose in a
  // vee is a white cross with inked tips, the gannet's mark on a goose.
  snowgoose: { back: 0xf4f5f4, belly: 0xf6f7f6, tip: 0x1a1c1e, head: 0xf4f5f4, bill: 0xe89a8a },
  // Dark brown all over, with the pale flash at the base of the primaries
  // that shows on the underwing.
  skua: { back: 0x3e3630, belly: 0x5a5048, tip: 0x2a241e, head: 0x3e3630, bill: 0x1f1c18 },
  // Grey above, pale and barred below, with the dark moustache; the pale
  // form of the polar falcon, so it reads against the wall.
  gyrfalcon: { back: 0x8a9298, belly: 0xe8eaea, tip: 0x5a6268, head: 0xb8bec2, bill: 0x6a6a5a },
  // Black to the tips, with the glossed mantle a shade lighter than the
  // wing.
  raven: { back: 0x1e2022, belly: 0x141618, tip: 0x0e1012, head: 0x1a1c1e, bill: 0x141618 },
  // ── The karst coast ───────────────────────────────────────────────────
  // The herring gull a shade darker on the mantle, white below, black
  // tips, and the yellow bill and legs that name it.
  yellowlegged: { back: 0x7e878f, belly: 0xf2f4f5, tip: 0x1b1e22, head: 0xf2f4f5, bill: 0xe0b23a },
  // A pale, clean grey mantle, black tips, and the dark RED bill — which
  // is the one thing that tells it from every other gull here.
  audouin: { back: 0xaab2b8, belly: 0xf6f7f8, tip: 0x1d2024, head: 0xf6f7f8, bill: 0x9a2e2a },
  // Black with a green gloss, the pale gape, and a yellow gape patch.
  shag: { back: 0x14201c, belly: 0x1a2622, tip: 0x0e1614, head: 0x14201c, bill: 0xd8c46a },
  // Grey-brown above, WHITE below to the wingtips — from the water a big
  // pale cross shearing past — with the yellow bill out front.
  shearwater: { back: 0x7a7066, belly: 0xf4f5f2, tip: 0x5a5048, head: 0x9a9088, bill: 0xd8c880 },
  // Dark brown above and white below, the tips dark: a small pale cross
  // in a fast line, and a dark one when it banks.
  yelkouan: { back: 0x3a3630, belly: 0xf0f0ec, tip: 0x2a2620, head: 0x3a3630, bill: 0x2a2a2a },
  // The arctic tern's paint, a shade greyer, with the black-tipped red
  // bill.
  commontern: { back: 0x9aa3ab, belly: 0xf4f6f7, tip: 0x2a2d31, head: 0x1c1f22, bill: 0xc9352a },
  // Pale sooty brown all over with a white throat: a dark scythe against
  // the sky, and against the cliff.
  swift: { back: 0x5a524a, belly: 0x6a625a, tip: 0x3e3830, head: 0x5a524a, bill: 0x1a1a1a },
  // A slim dark falcon: slate above, the underwing dark, the chest a
  // rusty buff, the dark moustache on a pale cheek.
  eleonora: { back: 0x3e4048, belly: 0x8a6a58, tip: 0x2a2c32, head: 0x3e4048, bill: 0x6a6a5a },
  // Pale sandy brown on the body and the forewing, the flight feathers
  // dark: from below a griffon is a pale plank edged in black, with the
  // bare pale head out front.
  griffon: { back: 0x9a8a6e, belly: 0xb8a888, tip: 0x2e2a26, head: 0xd8d0c0, bill: 0x8a8070 },
  // Grey body, black head, wings and tail: a crow in a grey waistcoat.
  hoodedcrow: { back: 0x1e2022, belly: 0x9a9c9a, tip: 0x0e1012, head: 0x1a1c1e, bill: 0x1a1c1e },
  // White with BLACK flight feathers, the red bill and the red legs
  // trailing: from below a stork in a vee is a white cross with black
  // hands, and it is the one white bird here with legs.
  stork: {
    back: 0xf4f4f0,
    belly: 0xf6f6f2,
    tip: 0x1a1a1c,
    head: 0xf4f4f0,
    bill: 0xd0402a,
    legs: 0xd0402a,
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
