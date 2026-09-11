// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCKS, SCULPTED. One parametric low-poly builder behind every rock
// that STANDS OUT OF THE WATER — the sea stack, the mark a course rounds,
// the skerries offshore — emitting flat-shaded vertex-coloured triangles
// through the shared `lowpoly` Builder.
//
// WHY THIS EXISTS. A rock used to be a `CylinderGeometry` scaled to its
// solid's radius and height: one geometry for the whole kind, spun about y
// and tinted per instance. A tapered drum with a flat lid is a barrel, and
// six of them down a coast are the SAME barrel at six sizes — which is
// exactly what the eye reads. Rock does not read as rock because it is
// grey; it reads as rock because its silhouette is broken at every scale
// and no two of them are the same shape.
//
// So each rock is built ONCE, for itself, from its own seed:
//
//   THE PLAN IS NOT A CIRCLE. Every ring's vertices are cut back off its
//   own radius by their own hash, and every ring draws a different one, so
//   the silhouette is ragged going round AND going up — which is what puts
//   vertical relief on a face that has no texture to carry it.
//   THE AXIS WANDERS. Each ring's centre steps off the last one's, a
//   bounded random walk, so a column leans and kinks instead of standing
//   plumb. A plumb column with a flat top is the one shape in nature that
//   reads as BUILT.
//   THE PROPORTIONS DIFFER, not just the wobble. Each rock is dealt its own
//   taper and its ledges their own heights, so one is a blunt remnant and
//   the next a pinnacle rather than the same rock at two sizes.
//   THE WAVES CUT IT AT THE WATERLINE. The profile flares just under the
//   surface and pinches just above it. That undercut is the single most
//   legible thing about a rock standing in the sea, and it is why these are
//   built in WORLD space around their own waterline rather than in a unit
//   box: a shared geometry cannot carry a feature at sea level, because
//   every rock's root is a different share of its height.
//   THE CROWN IS BROKEN. The rim falls away from the apex by its own hash
//   per vertex, and the apex is off the axis. Never a lid.
//   THE STONE IS PATCHY. Every panel carries its own tone off its band's.
//   Nothing here is a texture — the game ships no image files — so the
//   paint is the only thing standing between a broken silhouette and a
//   piece of grey card cut to that silhouette.
//
// ONE MESH A KIND, and the transform is baked into the vertices — the rocks
// that stand out of the water are a handful a level (R17: 2.5 stacks and 5
// skerries a kilometre, one mark), so merging them costs a few hundred
// triangles and buys every one of them its own shape. The many small kinds
// that do NOT stand out of the water — boulders, reefs, erratics — stay
// instanced in `rocks.ts`, where one shape is the right answer.
//
// THE DRAWN ROCK STAYS INSIDE ITS COLLIDER. The engine knows a solid as a
// cylinder of radius `r` (`collision.ts`), so nothing ABOVE the waterline
// may be drawn wider than `r` — a hull that scrapes a face the physics has
// not reached is a rock the rider cannot trust. Three things hold that: the
// jag only ever cuts IN, the taper is applied to a ring's deficit rather
// than to its radius, and the profile reaches 1.0 at the waterline, which
// is where the contact actually happens. The one ring that passes it is the
// flare, half a metre under the water, where no hull reaches.

import { hash2 } from "@engine";

import { Builder, type P } from "../lib/lowpoly.ts";

/** WHAT A KIND OF ROCK IS SHAPED LIKE. The profile is stated as rings from
 * the waterline up, each a mean radius as a share of the solid's own `r`
 * against a height as a share of its `top` — so one spec carries a 7 m
 * skerry and a 30 m mark, and a rock retuned taller keeps its proportions. */
export type RockForm = {
  /** Facets round the rock. A big rock is seen from further off and from
   * more angles, so it earns more. */
  readonly sides: number;
  /** The face's rings, `[height share of top, radius share of r]`,
   * waterline first. The last is the crown's rim. The radius is the WIDEST
   * the ring gets, because the jag only ever cuts in (see `jag`). */
  readonly face: readonly (readonly [number, number])[];
  /** How far a vertex may be cut IN from its ring's radius, as a share of
   * it. This is the silhouette; everything else is the pose.
   *
   * Only ever inward, for two reasons. Erosion REMOVES rock, so a face
   * eaten back off a ring's line is what the sea actually leaves. And the
   * engine knows a solid as a cylinder of radius `r` (`collision.ts`), so a
   * vertex allowed outward would draw a face the hull stops short of — a
   * rock the rider cannot trust. Cutting in alone means the jag can be
   * turned up as far as it reads without ever thinning the rock away from
   * its own collider. */
  readonly jag: number;
  /** How far a ring's centre steps off the one below, as a share of `r`. */
  readonly kink: number;
  /** How far the crown's rim falls below the apex, as a share of `top`. */
  readonly crown: number;
  /** The three tones: the wet band at and under the water, the face above
   * it, and the dry crown. */
  readonly wet: number;
  readonly body: number;
  readonly lit: number;
};

/** HOW PATCHY THE STONE IS: how far one panel's tone may fall either side
 * of its band's, as a share. This is the whole of the rock's "texture" —
 * the game ships no image files, and a flat-shaded grey with one tone a
 * band reads as painted cardboard however broken its silhouette is.
 * Granite is not one colour: it is feldspar and mica and a century of
 * lichen, in patches the size of a face. The `lowpoly` Builder's own ±4% a
 * TRIANGLE sits underneath this and breaks each panel's two halves apart
 * again. */
const MOTTLE = 0.26;

/** How far under the waterline the flare stands — a share of `top`, but
 * never less than `FLARE_MIN` metres, because a skerry standing half a
 * metre out of the sea still gets undercut by a whole wave — and how much
 * wider than the waterline it is. Above the flare the waves have cut the
 * notch; below it the rock simply widens into its own foot. */
const FLARE_AT = -0.1;
const FLARE_MIN = 0.35;
const FLARE_OUT = 1.14;

/** HOW MUCH ONE ROCK DIFFERS FROM THE NEXT IN PROPORTION, either way. A
 * form's profile is one rock's shape, and a coast of rocks all cut to it —
 * however hard each is wobbled — is still a coast of one rock at six sizes,
 * which is the fault this whole module exists to fix. So each rock is dealt
 * its own TAPER, applied to how far each ring falls in from the waterline:
 * under 1 it is a blunt, blocky remnant, over 1 a pinnacle. Applied to the
 * deficit rather than the radius so the waterline, where the collider is,
 * does not move. */
const TAPER = 0.42;
/** …and how far a ring's height may be jogged off the profile's, as a share
 * of `top`, so the ledges do not all sit at the same level either. */
const JOG = 0.05;

/** THE SEA STACK (R17) and THE MARK (R25): a remnant, wide at the water
 * where the sea has not got at it and narrow at the top where it has, with
 * a ledge two thirds of the way up — a bedding plane the swell found — that
 * stops the taper reading as a cone. The mark is the same rock drawn to be
 * legible from a kilometre: more facets, a harder taper, a rougher crown. */
export const ROCK_FORMS: Record<"stack" | "mark" | "skerry", RockForm> = {
  stack: {
    sides: 13,
    face: [
      [0, 1],
      [0.14, 0.87],
      [0.31, 0.76],
      [0.5, 0.8],
      [0.67, 0.65],
      [0.85, 0.58],
      [1, 0.36],
    ],
    jag: 0.3,
    kink: 0.08,
    crown: 0.18,
    wet: 0x3f4641,
    body: 0x8d9298,
    lit: 0xb0aea1,
  },
  mark: {
    sides: 15,
    face: [
      [0, 1],
      [0.12, 0.88],
      [0.29, 0.74],
      [0.46, 0.79],
      [0.64, 0.62],
      [0.83, 0.52],
      [1, 0.29],
    ],
    jag: 0.28,
    kink: 0.065,
    crown: 0.15,
    wet: 0x474d47,
    body: 0x969a9a,
    lit: 0xc6c1b0,
  },
  // A SKERRY is a whaleback: the same slab the shore is made of, ground
  // flat by the ice and left with a metre or two of itself above the sea.
  // Broad, low, and rougher for its size than a stack — a small rock is
  // read from close up, where the facets have to do the work.
  skerry: {
    sides: 9,
    face: [
      [0, 1],
      [0.3, 0.92],
      [0.6, 0.78],
      [0.82, 0.66],
      [1, 0.4],
    ],
    jag: 0.34,
    kink: 0.11,
    crown: 0.36,
    wet: 0x3c4340,
    body: 0x7f868c,
    lit: 0x9a988c,
  },
};

/** Where a rock's own column stops, world y: the bed under it, dropped by
 * enough to stay buried where the bed slopes away under the rim. A rock
 * whose foot shows is a rock floating in the sea, and the water is clear
 * enough to see one (`water-optics.ts`). */
export function rockFoot(bed: number, r: number): number {
  return Math.min(bed, 0) - Math.max(2, r * 0.7);
}

/** Two packed hex colours mixed on the bytes — `flora-shapes.ts`'s `mix`,
 * for the same reason: a rock emits a few hundred of these while it builds
 * and the palette was picked under the gamma this ignores. */
function mix(a: number, b: number, t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  const chan = (shift: number): number =>
    Math.round(((a >> shift) & 255) + (((b >> shift) & 255) - ((a >> shift) & 255)) * k) & 255;
  return (chan(16) << 16) | (chan(8) << 8) | chan(0);
}

/** A packed hex scaled — the per-rock tone, so a field of them is not one
 * rock at six sizes. Multiplied rather than offset: an offset is an
 * absolute step in a space where the darkest tone has nowhere left to
 * fall. */
function shade(hex: number, k: number): number {
  const chan = (shift: number): number => Math.min(255, Math.round(((hex >> shift) & 255) * k));
  return (chan(16) << 16) | (chan(8) << 8) | chan(0);
}

/** One panel's own tone: its band's, shaded by `MOTTLE` either way off a
 * hash of which panel it is. */
function mottled(hex: number, panel: number, seed: number): number {
  return shade(hex, 1 + (hash2(panel, 43, seed) - 0.5) * MOTTLE);
}

/**
 * Carve one rock into `b`, in WORLD space: standing at (`x`, `z`), its top
 * at `top` above the still-water plane, its column running down to `foot`,
 * its plan radius `r`, and every wobble in it drawn from `seed` — so a level
 * builds the same coast every time it is loaded, and no two rocks on it are
 * the same rock.
 */
export function carveRock(
  b: Builder,
  form: RockForm,
  x: number,
  z: number,
  r: number,
  top: number,
  foot: number,
  seed: number,
): void {
  const { sides, jag, kink } = form;
  // The tone this one rock is cut in, ±11% of the form's own.
  const tone = 1 + (hash2(7, 3, seed) - 0.5) * 0.22;
  const wet = shade(form.wet, tone);
  const body = shade(form.body, tone);
  const lit = shade(form.lit, tone);
  // The plan is an irregular polygon, and the irregularity is per RING —
  // the same vertex is proud on one ring and cut back on the next, which is
  // what puts a vertical crease down a face that has no texture.
  const ring = (y: number, wide: number, level: number, cx: number, cz: number): P[] => {
    const out: P[] = [];
    for (let k = 0; k < sides; k++) {
      const t = (k / sides) * Math.PI * 2;
      const rad = r * wide * (1 - jag * hash2(level * 131 + 17, k, seed));
      out.push([cx + Math.sin(t) * rad, y, cz + Math.cos(t) * rad]);
    }
    return out;
  };

  // ── The rings, foot first ────────────────────────────────────────────
  // The axis wanders as it climbs: each ring steps off the last by up to
  // `kink` of the radius, a bounded walk, so the column leans and bends of
  // its own accord instead of being leant as a whole.
  const rings: P[][] = [];
  const paint: number[] = [];
  let cx = x;
  let cz = z;
  let level = 0;
  const push = (y: number, wide: number, tint: number): void => {
    rings.push(ring(y, wide, level, cx, cz));
    paint.push(tint);
    level++;
  };
  const step = (): void => {
    cx += (hash2(level * 71 + 5, 1, seed) - 0.5) * 2 * kink * r;
    cz += (hash2(level * 71 + 5, 2, seed) - 0.5) * 2 * kink * r;
  };

  // THIS rock's own proportions (see `TAPER`): how hard it draws in going
  // up, drawn once for the whole rock rather than per ring, because a
  // remnant is blunt or it is a pinnacle — it is not both up its own height.
  const taper = 1 + (hash2(13, 11, seed) - 0.5) * 2 * TAPER;

  // The foot, no wider than the waterline: the column under the water is a
  // column, and a ring splayed out down there draws a glass-sided box in
  // water the rider can see into (`water-mesh.ts`).
  push(foot, 1, wet);
  step();
  // The flare the waves undercut, just below the surface — the widest the
  // rock ever gets, and the one place it may pass the collider, because no
  // hull reaches under its own waterline.
  push(Math.max(foot + 0.4, Math.min(-FLARE_MIN, FLARE_AT * top)), FLARE_OUT, wet);
  step();
  // …and the face above it, the first ring of which IS the waterline: the
  // dark band at the water, the rock above it, the dry crown.
  for (let i = 0; i < form.face.length; i++) {
    const [h, wide] = form.face[i];
    const last = i + 1 === form.face.length;
    // The crown's own height is the solid's `top` and is never jogged; the
    // ledges between are.
    const y = last || i === 0 ? h : h + (hash2(i * 97 + 3, 6, seed) - 0.5) * 2 * JOG;
    const tint =
      h < 0.04 ? wet : h < 0.14 ? mix(wet, body, (h - 0.04) / 0.1) : mix(body, lit, h - 0.14);
    push(y * top, 1 - (1 - wide) * taper, tint);
    if (!last) step();
  }

  // ── The crown's rim, broken ──────────────────────────────────────────
  // Dropped BEFORE the faces are lofted, because the loft copies the points
  // it is handed: a rim cut after the fact leaves a ring of cracks between
  // the face and the crown. The apex sits off the axis and holds `top`
  // exactly, so the drawn rock and the solid the engine collides against
  // agree about how tall it is.
  const rim = rings[rings.length - 1];
  const drop = form.crown * top;
  for (let k = 0; k < sides; k++) rim[k][1] = top - drop * hash2(311, k, seed);
  const apex: P = [
    cx + (hash2(29, 1, seed) - 0.5) * r * 0.3,
    top,
    cz + (hash2(29, 2, seed) - 0.5) * r * 0.3,
  ];

  // ── The faces ────────────────────────────────────────────────────────
  // Lofted ring by ring rather than through `loft`, because each band wants
  // its own tone: a rock is dark at the water and pale at the crown, and
  // that gradient is the whole of the lighting a flat-shaded grey gets from
  // a sky it cannot see.
  for (let i = 0; i + 1 < rings.length; i++) {
    const lo = rings[i];
    const hi = rings[i + 1];
    const tint = mix(paint[i], paint[i + 1], 0.5);
    for (let k = 0; k < sides; k++) {
      const k1 = (k + 1) % sides;
      b.quad(lo[k], lo[k1], hi[k1], hi[k], mottled(tint, i * 53 + k, seed));
    }
  }

  // ── The crown ────────────────────────────────────────────────────────
  // NOT A LID: a fan from the broken rim up to the apex.
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    b.tri(rim[k], rim[k1], apex, mottled(lit, 907 + k, seed));
  }
}
