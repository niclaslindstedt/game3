// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEA LIFE, DRAWN — what the rider sees through the water. The engine
// placed the pods (R20) and says where every animal is at the state's own
// clock (`faunaPose`); this module owns nothing but the LOOK: the shape of
// a body, the fins that name a species, the paint on it, and the tail that
// beats. The split is the craft's: `engine/game/defs/fauna.ts` carries the
// dimensions and `craft-styles.ts`'s opposite number is the table below.
//
// SEEN FROM ABOVE is the design constraint, because that is the only way
// this game ever sees them. A chase camera over open water looks down
// through the surface at a SILHOUETTE — so the three numbers that separate
// one animal from another here are the DORSAL, the PECTORALS and the TAIL
// SPAN, and the markings that survive are the ones that read on a back: an
// orca's white saddle, a minke's white flipper bands, a perch's bars. A
// body detail that only shows in profile is a body detail this game cannot
// draw, and none is drawn.
//
// ONE DRAW CALL A SPECIES. Every animal of a kind is an instance of one
// unit-length body — z from −0.5 at the tail to +0.5 at the nose, scaled by
// the catalog's length — and only the pods within the water's own SEE-THROUGH
// radius of the craft are written at all, because past that the far water is
// opaque and nothing under it can be seen. That radius is handed in per frame
// rather than looked up: it is the water mesh's (`WaterMesh.seeThrough`), it
// moves with the WATER row, and it is 0 when the rider has closed the window —
// which is how one number both places the animals and switches them off.
// Nothing is allocated per frame.
//
// THE TAIL BEATS IN THE VERTEX SHADER. A rigid fish is a wooden fish, and
// a per-animal skeleton is a per-animal draw call. So the body carries its
// own bend: a travelling wave whose amplitude grows as the square of the
// distance back from the nose, swung SIDEWAYS for a fish or a shark and UP
// AND DOWN for a cetacean, on a phase the engine hands over per animal
// (`FaunaPose.beat`). The graft goes in through `onBeforeCompile`, the same
// door `sky-depth.ts` uses.
//
// AND THE DEPTH HAZES IT, in the same graft. The water surface's own alpha
// cannot do this job: it is one number for a patch of sea and knows nothing
// about how far under it a thing is, so a whale at eight metres and a rock
// at twenty would come through it the same. What actually happens is that
// the column of water BETWEEN the animal and the eye scatters its own light
// back, so a body goes toward the water's colour with its depth — which is
// why a whale under ten metres of sea is a pale blue-grey ghost and the
// same whale rolling at the surface is nearly black. That is the whole
// depth cue, it is the thing that makes an animal visible over water too
// deep to see the bed of, and it costs one mix in the vertex shader.

import * as THREE from "three";
import {
  faunaById,
  faunaPose,
  freshPose,
  type FaunaId,
  type FaunaSpec,
  type GameState,
  type Level,
} from "@engine";

import { PALETTE } from "../identity.ts";
import { seaMirror, type Preset } from "./sky.ts";

/** How a species is PAINTED and PROPORTIONED — everything about an animal
 * that is a look rather than a fact. */
type FaunaStyle = {
  /** Countershading: every animal in the sea is dark above and pale below,
   * and from a chase camera the back is the whole of what shows. */
  readonly back: number;
  readonly belly: number;
  /** The fins, when they are not the back's own colour. */
  readonly fin?: number;
  /** Body HEIGHT as a share of the length. The catalog owns the width
   * (`beam`); this is the other axis, and the two together are most of what
   * a shape is: a perch is deeper than it is wide, a porpoise rounder than
   * it is deep. */
  readonly height: number;
  /** Dorsal fin height, pectoral fin length and tail span, in body lengths
   * — the three numbers a silhouette is read by. */
  readonly dorsal: number;
  readonly pectoral: number;
  readonly tail: number;
  /** A white saddle behind the dorsal (the orca's), and white bands across
   * the flippers (the minke's): the two markings that name an animal at a
   * glance from directly above. */
  readonly saddle?: boolean;
  readonly flipperBand?: boolean;
  /** Dark bars down the back, a perch's — how many. */
  readonly bars?: number;
  /** How far the tail swings, in body lengths, and how much travelling wave
   * the body carries at once, rad. A fish is nearly all tail; a whale
   * carries a long slow wave and hardly bends at the shoulder. */
  readonly bend: number;
  readonly waves: number;
};

const STYLES: Readonly<Record<FaunaId, FaunaStyle>> = {
  // The Baltic fish: silver, olive and green, all of them deeper than wide.
  herring: {
    back: 0x2f4a55,
    belly: 0xd9e0e4,
    height: 0.26,
    dorsal: 0.05,
    pectoral: 0.07,
    tail: 0.24,
    bend: 0.1,
    waves: 3.4,
  },
  roach: {
    back: 0x4a4634,
    belly: 0xcac3ad,
    fin: 0x9c4a3a,
    height: 0.32,
    dorsal: 0.07,
    pectoral: 0.08,
    tail: 0.26,
    bend: 0.09,
    waves: 3.2,
  },
  perch: {
    back: 0x36471f,
    belly: 0xc7b06a,
    fin: 0xa8492f,
    height: 0.36,
    dorsal: 0.11,
    pectoral: 0.09,
    tail: 0.24,
    bars: 6,
    bend: 0.08,
    waves: 3,
  },
  pike: {
    back: 0x3c4a2b,
    belly: 0xbcc0a2,
    height: 0.16,
    dorsal: 0.08,
    pectoral: 0.07,
    tail: 0.22,
    // An ambush fish holds still and moves in one flick: a long body that
    // barely waves at all until it does.
    bend: 0.05,
    waves: 2.2,
  },
  salmon: {
    back: 0x4a5560,
    belly: 0xd7d4cd,
    height: 0.21,
    dorsal: 0.06,
    pectoral: 0.09,
    tail: 0.22,
    bend: 0.09,
    waves: 3,
  },
  // The cetaceans: rounder than they are deep, and every one of them shows
  // its back rather than its flank.
  porpoise: {
    back: 0x2e3338,
    belly: 0xcdd1d4,
    height: 0.22,
    // The blunt little triangular fin is the whole of a porpoise sighting.
    dorsal: 0.09,
    pectoral: 0.1,
    tail: 0.24,
    bend: 0.07,
    waves: 2.4,
  },
  dolphin: {
    back: 0x2a3038,
    belly: 0xe7e9eb,
    height: 0.2,
    dorsal: 0.13,
    pectoral: 0.14,
    tail: 0.26,
    saddle: true,
    bend: 0.08,
    waves: 2.6,
  },
  shark: {
    back: 0x3b4652,
    belly: 0xe0e2e0,
    height: 0.22,
    dorsal: 0.15,
    pectoral: 0.19,
    // A shark's tail is the one in the catalog that is taller than the
    // animal is wide, and it is what makes the shape read as a shark.
    tail: 0.3,
    bend: 0.07,
    waves: 2.4,
  },
  orca: {
    back: 0x0f1319,
    belly: 0xf3f5f3,
    height: 0.24,
    // The fin is the sighting: a bull's stands nearly two metres.
    dorsal: 0.24,
    pectoral: 0.16,
    tail: 0.24,
    saddle: true,
    bend: 0.06,
    waves: 2,
  },
  minke: {
    back: 0x323840,
    belly: 0xb7bec3,
    height: 0.18,
    dorsal: 0.05,
    pectoral: 0.12,
    tail: 0.24,
    // The white band across the flipper — the field mark that tells a minke
    // from every other rorqual, and it is on the one surface a camera
    // overhead can see.
    flipperBand: true,
    bend: 0.05,
    waves: 1.8,
  },
};

/** The body's half-width at `s` along it (0 tail tip, 1 nose), as a share
 * of the widest. A fish and a whale are the same curve at different
 * proportions: thin at the tail, widest a third back from the nose, and
 * rounded off to a point at the snout. */
const GIRTH: readonly (readonly [number, number])[] = [
  [0, 0.06],
  [0.1, 0.13],
  [0.25, 0.34],
  [0.42, 0.66],
  [0.58, 0.9],
  [0.7, 1],
  [0.82, 0.92],
  [0.92, 0.66],
  [1, 0.08],
];

/** Stations along the body and facets round it. Eight and six: enough that
 * a metre of animal seen through two metres of water has a shape, and few
 * enough that a school of thirty is a rounding error in the frame. */
const STATIONS = 9;
const SIDES = 6;

/** How much of the pectoral's outer half a flipper band whitens. */
const BAND_FROM = 0.45;

/** How deep an animal has to be, m, before the water between it and the
 * eye has taken it entirely: below this it is a patch of sea. Deeper than
 * anything in the catalog holds at, so the deepest animals are ghosts
 * rather than gone. */
const HAZE_DEPTH = 16;
/** How far toward the water's colour the haze goes at that depth — well
 * short of the whole way, so even the deepest shape keeps its own tone and
 * an edge. The per-pixel water is brighter than a flat tint would be, and a
 * body hazed most of the way into it loses the paint that names it. */
const HAZE_MAX = 0.72;
/** The water's colour as an animal seen through it takes it: the SHALLOW
 * tone, not the deep one, lifted toward whatever the surface is reflecting
 * today. The shallow tone because the haze is light SCATTERED BACK out of
 * the column between the animal and the eye, which is bright — a body under
 * ten metres of sea is paler than the water around it, not darker, and
 * that contrast is the only reason it can be seen at all over water too
 * deep to have a bottom worth drawing. */
const HAZE_SKY = 0.35;

function table(knots: readonly (readonly [number, number])[], x: number): number {
  if (x <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    if (x <= knots[i][0]) {
      const [x0, y0] = knots[i - 1];
      const [x1, y1] = knots[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return knots[knots.length - 1][1];
}

type P = [number, number, number];

/** A pile of coloured triangles. Every vertex is its own, so the body
 * flat-shades into facets rather than a smooth blanket, and the colour can
 * change across a face where a marking's edge runs. */
class Body {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  private readonly c = new THREE.Color();

  tri(a: P, b: P, c: P, ca: number, cb = ca, cc = ca): void {
    const points = [a, b, c];
    const colours = [ca, cb, cc];
    for (let i = 0; i < 3; i++) {
      this.pos.push(points[i][0], points[i][1], points[i][2]);
      this.c.setHex(colours[i]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
  }

  quad(a: P, b: P, c: P, d: P, ca: number, cb = ca, cc = ca, cd = ca): void {
    this.tri(a, b, c, ca, cb, cc);
    this.tri(a, c, d, ca, cc, cd);
  }
}

/** The colour of the hide at a station and an angle round the body: the
 * back above, the belly below, and whatever marking the style puts on top
 * of that. `up` is +1 at the spine and −1 at the keel. */
function hide(style: FaunaStyle, s: number, up: number): number {
  const t = Math.max(0, Math.min(1, up * 0.5 + 0.5));
  // The line between back and belly sits HIGH on the body — the top
  // quarter is the dark, the flanks below it are pale. Higher than a
  // photograph of the animal would put it, and for the reason every
  // silhouette here is drawn the way it is: the water is dark, so a body
  // painted honestly dark down to the waterline is a body nobody can pick
  // out of it. The pale flank is what makes a school read as a school.
  const mix = t ** 2.4;
  const back = new THREE.Color(style.back);
  const belly = new THREE.Color(style.belly);
  const c = belly.clone().lerp(back, mix);
  if (style.bars && up > 0.1) {
    // A perch's bars: dark stripes down the flank, only where the light
    // side has not already taken over.
    const bar = 0.5 - 0.5 * Math.cos(s * style.bars * Math.PI * 2);
    c.multiplyScalar(1 - 0.35 * bar * mix);
  }
  if (style.saddle && up > 0.55 && s > 0.28 && s < 0.5) {
    // The pale saddle behind the dorsal — an orca's, a white-beaked
    // dolphin's, and the one marking that is unmistakable from overhead.
    c.lerp(new THREE.Color(style.belly), 0.85);
  }
  return c.getHex();
}

/** One unit-length body: the hull, the dorsal, two pectorals and the tail.
 * z runs −0.5 (tail) to +0.5 (nose); x is the animal's right, y up. */
function buildBody(spec: FaunaSpec, style: FaunaStyle): THREE.BufferGeometry {
  const body = new Body();
  const halfW = spec.beam / 2;
  const halfH = style.height / 2;
  const at = (s: number, k: number): P => {
    const a = (k / SIDES) * Math.PI * 2;
    const g = table(GIRTH, s);
    return [Math.cos(a) * halfW * g, Math.sin(a) * halfH * g, s - 0.5];
  };
  for (let i = 0; i + 1 < STATIONS; i++) {
    const s0 = i / (STATIONS - 1);
    const s1 = (i + 1) / (STATIONS - 1);
    for (let k = 0; k < SIDES; k++) {
      const a0 = Math.sin((k / SIDES) * Math.PI * 2);
      const a1 = Math.sin(((k + 1) / SIDES) * Math.PI * 2);
      body.quad(
        at(s0, k),
        at(s1, k),
        at(s1, k + 1),
        at(s0, k + 1),
        hide(style, s0, a0),
        hide(style, s1, a0),
        hide(style, s1, a1),
        hide(style, s0, a1),
      );
    }
  }
  const finColour = style.fin ?? style.back;
  // THE DORSAL, raked back off the shoulder.
  const dz = 0.02;
  const dTop = table(GIRTH, 0.52) * halfH;
  body.tri(
    [0, dTop, dz + 0.08],
    [0, dTop, dz - 0.08],
    [0, dTop + style.dorsal, dz - 0.06],
    finColour,
  );
  // THE PECTORALS, one each side: a broad root on the shoulder swept back
  // and slightly down to a blunt tip. Broad rather than needle-thin
  // because from overhead they are the pair of strokes that make a shape
  // read as an ANIMAL rather than as a floating log, and a spike reads as
  // neither. Split across the span so a flipper band has an edge to sit on.
  const pz = 0.2;
  const pw = table(GIRTH, 0.7) * halfW;
  const chord = 0.07;
  const band = style.flipperBand ? style.belly : finColour;
  for (const side of [1, -1]) {
    const span = (f: number, drop: number, sweep: number): P => [
      side * (pw + style.pectoral * f),
      -halfH * drop,
      pz + chord * (1 - f) - style.pectoral * sweep * f,
    ];
    const rootLead: P = [side * pw, -halfH * 0.2, pz + chord];
    const rootTrail: P = [side * pw, -halfH * 0.2, pz - chord];
    const midLead = span(BAND_FROM, 0.3, 0.35);
    const midTrail: P = [midLead[0], midLead[1], midLead[2] - chord * 1.3];
    const tipLead = span(1, 0.45, 0.55);
    const tipTrail: P = [tipLead[0], tipLead[1], tipLead[2] - chord * 0.7];
    body.quad(rootLead, rootTrail, midTrail, midLead, finColour);
    body.quad(midLead, midTrail, tipTrail, tipLead, band);
  }
  // THE TAIL: a fish and a shark carry it upright, a cetacean flat. Same
  // crescent either way, laid in the plane its owner beats in.
  const span = style.tail / 2;
  const flat = spec.kind === "cetacean";
  const fin = (u: number, v: number): P => (flat ? [u, 0, v] : [0, u, v]);
  body.tri(fin(0, -0.4), fin(span, -0.58), fin(0, -0.47), finColour);
  body.tri(fin(0, -0.4), fin(0, -0.47), fin(-span, -0.58), finColour);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(body.pos, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(body.col, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** The body's material, with the tail beat grafted into its vertex shader.
 * `bend` and `waves` are baked in as literals rather than passed as
 * uniforms: the material belongs to exactly one species, so there is
 * nothing for a uniform to vary over. */
function buildMaterial(
  spec: FaunaSpec,
  style: FaunaStyle,
  haze: { value: THREE.Color },
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    // The fins are single triangles and the animal is seen from any side.
    side: THREE.DoubleSide,
  });
  const axis = spec.kind === "cetacean" ? "y" : "x";
  const num = (v: number): string => v.toFixed(4);
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHaze = haze;
    shader.vertexShader = `attribute float aBeat;
uniform vec3 uHaze;
${shader.vertexShader}`
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
\tfloat sTail = clamp(0.5 - position.z, 0.0, 1.0);
\ttransformed.${axis} += sTail * sTail * ${num(style.bend)} * sin(aBeat + sTail * ${num(style.waves)});`,
      )
      // After `project_vertex`, because that is where the instance
      // transform has been applied; the world position is rebuilt rather
      // than read back out of `mvPosition`, which is already in view space.
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
\tvec4 hazeWorld = vec4(transformed, 1.0);
\t#ifdef USE_INSTANCING
\thazeWorld = instanceMatrix * hazeWorld;
\t#endif
\thazeWorld = modelMatrix * hazeWorld;
\tvColor = mix(vColor, uHaze, clamp(-hazeWorld.y / ${num(HAZE_DEPTH)}, 0.0, 1.0) * ${num(HAZE_MAX)});`,
      );
  };
  return material;
}

export type Fauna = {
  group: THREE.Group;
  /** The colour the water takes an animal toward with its depth. Handed the
   * same preset the water is, on a change of sky rather than per frame —
   * the sea life answers to the same sky as the sea. */
  retone: (preset: Preset) => void;
  /** Put every animal within `reach` metres of (`cx`, `cz`) where the engine
   * says it is at the state's clock. `reach` is how far the rider can see
   * INTO the water — `WaterMesh.seeThrough` — and a reach of 0 writes no
   * animals at all, which is what the DETAIL row's bottom stop and a closed
   * window both come out as. */
  update: (state: GameState, cx: number, cz: number, reach: number) => void;
  dispose: () => void;
};

type Shoal = {
  mesh: THREE.InstancedMesh;
  beats: THREE.InstancedBufferAttribute;
  spec: FaunaSpec;
};

export function createFauna(level: Level): Fauna {
  const group = new THREE.Group();
  const haze = { value: new THREE.Color(PALETTE.seaShallow) };
  const shoals = new Map<FaunaId, Shoal>();
  // One mesh per species the level actually placed, sized to hold every
  // animal of it at once — a level's whole roster is a few hundred bodies,
  // so the budget is the number of pods rather than a cap to tune.
  const capacity = new Map<FaunaId, number>();
  for (const pod of level.fauna) {
    capacity.set(pod.species, (capacity.get(pod.species) ?? 0) + pod.count);
  }
  for (const [id, cap] of capacity) {
    const spec = faunaById(id);
    const style = STYLES[id];
    const geometry = buildBody(spec, style);
    const beats = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1);
    beats.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aBeat", beats);
    const mesh = new THREE.InstancedMesh(geometry, buildMaterial(spec, style, haze), cap);
    mesh.count = 0;
    // The instances move every frame and the mesh has no fixed extent, so
    // there is nothing for three to cull it against; the range test below
    // is the cull.
    mesh.frustumCulled = false;
    group.add(mesh);
    shoals.set(id, { mesh, beats, spec });
  }

  const pose = freshPose();
  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const written = new Map<FaunaId, number>();
  const sky = new THREE.Color();

  const update = (state: GameState, cx: number, cz: number, reach: number): void => {
    for (const id of shoals.keys()) written.set(id, 0);
    for (const pod of level.fauna) {
      // The pod's whole loop, not its centre: a school circling just inside
      // the range must not pop in and out as it goes round.
      if (Math.hypot(pod.x - cx, pod.z - cz) - pod.radius > reach) continue;
      const shoal = shoals.get(pod.species);
      if (!shoal) continue;
      let n = written.get(pod.species) ?? 0;
      for (let i = 0; i < pod.count && n < shoal.mesh.instanceMatrix.count; i++) {
        faunaPose(pod, i, state.t, pose);
        if (Math.hypot(pose.x - cx, pose.z - cz) > reach) continue;
        pos.set(pose.x, pose.y, pose.z);
        quat.set(pose.q.x, pose.q.y, pose.q.z, pose.q.w);
        scale.setScalar(shoal.spec.length);
        m.compose(pos, quat, scale);
        shoal.mesh.setMatrixAt(n, m);
        shoal.beats.setX(n, pose.beat);
        n++;
      }
      written.set(pod.species, n);
    }
    for (const [id, shoal] of shoals) {
      shoal.mesh.count = written.get(id) ?? 0;
      shoal.mesh.instanceMatrix.needsUpdate = true;
      shoal.beats.needsUpdate = true;
    }
  };

  return {
    group,
    retone: (preset) => {
      haze.value.set(PALETTE.seaShallow).lerp(sky.set(seaMirror(preset)), HAZE_SKY);
    },
    update,
    dispose: () => {
      for (const shoal of shoals.values()) {
        shoal.mesh.geometry.dispose();
        (shoal.mesh.material as THREE.Material).dispose();
      }
    },
  };
}
