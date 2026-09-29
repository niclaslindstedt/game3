// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE INSTANCED ROCKS, AS DATA — the three kinds of solid `rocks.ts` draws
// as ONE shape spun and tinted per instance (a boulder at the waterline, a
// reef under it, an erratic on the beach), the proportions the code draws
// each with, and FOUR VARIANTS of every kind, which is what the Blender
// builder models (`scripts/blender/rock.py`, handed all of it as one JSON
// file by `make blender KIND=rock`) and what `rocks.ts` stands a coast's
// rocks out of when the models are drawn (`rock-models.ts`). Three-free, so
// the suite, the driver and the stamp read every row.
//
// WHY THESE THREE AND NOT THE OTHER THREE. The sea stacks, the skerries and
// the mark a course rounds are CARVED for themselves in world space
// (`rock-shapes.ts`): each one's undercut is at ITS OWN waterline, which is
// a different share of its height for every rock, and that undercut is the
// one thing that says a rock stands in the sea — a shared model cannot
// carry it. The boulders, reefs and erratics are small, numerous and met at
// arm's length, hung off their crown with no waterline feature, so a shape
// a variant is the right answer for them, exactly as it was for the code's
// one lump — a lump that was a six-by-four sphere and a twelve-faced die,
// which is what the models are here to improve on.
//
// THE FRAME. A UNIT LUMP: plan within ±1 across (x, z), its foot at y = −1
// and its crown at or under y = +1. `rocks.ts` scales it exactly as it
// scaled the code's sphere — by the solid's radius across, its half-height
// up, a share deep — and hangs it off the model's own apex (`apexOf`), so a
// rock stands as tall as the engine says whatever the modelling did to its
// top. A model carries no colour: its vertices carry a SHADE alone (grey,
// lit top to dark foot, mottled a face at a time), which multiplies the
// coast's stone tint the instance is painted with.

/** The kinds `rocks.ts` instances, and so the kinds that are modelled. */
export const ROCK_KINDS = ["boulder", "erratic", "reef"] as const;
export type RockKind = (typeof ROCK_KINDS)[number];

export function isRockKind(kind: string): kind is RockKind {
  return (ROCK_KINDS as readonly string[]).includes(kind);
}

/** How many variants every kind has, all of them drawn. */
export const ROCK_VARIANTS = 4;

/**
 * EVERY PROPORTION THE CODE DRAWS AN INSTANCED ROCK WITH — `rocks.ts` reads
 * these, and the Blender builder models to the same shape.
 *
 *   half   the lump's half-height as a share of the solid's radius (the
 *          erratic's is its own: foot to `top`)
 *   wide   its plan across the wind, and `deep` along it, as shares of the
 *          radius
 *   bury   an erratic's foot, this share of its radius below the beach
 *   least  the least an erratic stands, m, whatever the beach under it
 *   tilt   how far an erratic may lean off level, rad, either way
 */
export const ROCK_LUMP = {
  boulder: { half: 0.8, wide: 1, deep: 0.9 },
  erratic: { wide: 1, deep: 0.88, bury: 0.35, least: 0.4, tilt: 0.22 },
  reef: { half: 0.55, wide: 1.1, deep: 1 },
} as const;

export type RockShape = {
  /** Facets round and up the lump. A big rock earns more. */
  readonly sides: number;
  readonly stacks: number;
  /** How far a vertex may be cut in off its ring, as a share of it. */
  readonly jag: number;
  /** 0 rounded (a whaleback the ice ground smooth) … 1 an angular block. */
  readonly angular: number;
  /** 0 the code's lump … 1 a flat slab. */
  readonly flat: number;
  /** A ridge along the crown, as a share of the height, 0 none. */
  readonly ridge: number;
  /** Two lumps out of one foot. */
  readonly split: boolean;
  /** A joint across the lump: a crack the ice opened, 0 none … 1 a cleft. */
  readonly cleft: number;
};

export type RockVariant = {
  readonly kind: RockKind;
  readonly index: number;
  readonly name: string;
  readonly shape: RockShape;
};

const rk = (o: Partial<RockShape> = {}): RockShape => ({
  sides: 9,
  stacks: 5,
  jag: 0.2,
  angular: 0,
  flat: 0,
  ridge: 0,
  split: false,
  cleft: 0,
  ...o,
});

/** Each kind's four: the shape the code's lump stood for first, then what
 * a coast actually strews. */
const ROWS: Readonly<Record<RockKind, readonly [string, RockShape][]>> = {
  // A boulder at the waterline: ice-rounded granite, smooth and lumpy.
  boulder: [
    ["whaleback", rk({ sides: 10, stacks: 5, jag: 0.16 })],
    ["cracked", rk({ sides: 9, stacks: 5, jag: 0.2, cleft: 0.8 })],
    ["ridged", rk({ sides: 9, stacks: 4, jag: 0.22, ridge: 0.25 })],
    ["twin", rk({ sides: 7, stacks: 4, jag: 0.2, split: true })],
  ],
  // An erratic on the beach: the block the ice dropped, angular and big.
  erratic: [
    ["block", rk({ sides: 6, stacks: 3, jag: 0.12, angular: 0.9 })],
    ["tilted slab", rk({ sides: 6, stacks: 3, jag: 0.15, angular: 0.8, flat: 0.5 })],
    ["split block", rk({ sides: 6, stacks: 3, jag: 0.14, angular: 0.85, cleft: 1 })],
    ["rounded block", rk({ sides: 8, stacks: 4, jag: 0.18, angular: 0.45 })],
  ],
  // A reef under the surface: a flat, broken platform.
  reef: [
    ["platform", rk({ sides: 10, stacks: 4, jag: 0.25, flat: 0.5 })],
    ["knobbed", rk({ sides: 9, stacks: 4, jag: 0.3, split: true, flat: 0.3 })],
    ["ledge", rk({ sides: 10, stacks: 4, jag: 0.22, flat: 0.6, ridge: 0.3 })],
    ["broken", rk({ sides: 8, stacks: 4, jag: 0.35, angular: 0.4, cleft: 0.7 })],
  ],
};

/** Every kind's four. */
export const ROCK_ROWS: Readonly<Record<RockKind, readonly RockVariant[]>> = {
  boulder: ROWS.boulder.map(([name, shape], index) => ({ kind: "boulder", index, name, shape })),
  erratic: ROWS.erratic.map(([name, shape], index) => ({ kind: "erratic", index, name, shape })),
  reef: ROWS.reef.map(([name, shape], index) => ({ kind: "reef", index, name, shape })),
};
