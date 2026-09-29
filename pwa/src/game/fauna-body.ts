// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEA LIFE'S BODY, AS DATA — the numbers `fauna.ts` builds an animal's
// body with (the girth along it, the stations and facets round it, where
// the fins sit, the two shades the hide is painted at and the depth the
// paint slides between them over), lifted out of the three-bound builder
// so the Blender builder (`scripts/blender/fauna.py`, handed all of it by
// `make blender KIND=fauna`) models to the same body, and the roles a
// model's faces are dressed by. Three-free, so the suite, the driver and
// the stamp read every number.
//
// THE FRAME is the code's: one UNIT-LENGTH body, z from −0.5 at the tail
// to +0.5 at the nose, x the animal's right, y up, scaled by the catalog's
// length per instance — and the shader bends it off z alone, so a model
// stated anywhere else beats its tail about the wrong point.

/** The body's half-width at `s` along it (0 tail tip, 1 nose), as a share
 * of the widest. A fish and a whale are the same curve at different
 * proportions: thin at the tail, widest a third back from the nose, and
 * rounded off to a point at the snout. */
export const GIRTH: readonly (readonly [number, number])[] = [
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

/** The body's half-width at `s` off `GIRTH`, interpolated. */
export function girthAt(s: number): number {
  const knots = GIRTH;
  if (s <= knots[0][0]) return knots[0][1];
  for (let i = 1; i < knots.length; i++) {
    if (s <= knots[i][0]) {
      const [x0, y0] = knots[i - 1];
      const [x1, y1] = knots[i];
      return y0 + ((y1 - y0) * (s - x0)) / (x1 - x0);
    }
  }
  return knots[knots.length - 1][1];
}

/** THE BODY THE CODE BUILDS: stations along it and facets round it (eight
 * and six: enough that a metre of animal seen through two metres of water
 * has a shape, and few enough that a school of thirty is a rounding error
 * in the frame); where the DORSAL stands and how it is raked, where the
 * PECTORALS root and how far along them a flipper band whitens, the TAIL's
 * root and reach; and the two SHADES the hide is painted at — `wet`, the
 * animal as it really is, and `deep`, the pale flank lifted most of the way
 * up for water too deep to have a bottom — with `liftDepth` the water it
 * takes to go from one to the other. */
export const BODY = {
  stations: 9,
  sides: 6,
  dorsal: { at: 0.02, chord: 0.08, rake: 0.06, station: 0.52 },
  pectoral: { at: 0.2, chord: 0.07, station: 0.7, bandFrom: 0.45 },
  tail: { root: -0.4, notch: -0.47, tip: -0.58 },
  shadeWet: 0.7,
  shadeDeep: 2.4,
  liftDepth: 1.2,
} as const;

/** What a face of a model is, by its material's name: the hide (dressed
 * per vertex off where on the body it is), a fin, and the outer half of a
 * flipper that a band whitens. */
export const FAUNA_ROLES = ["hide", "fin", "band"] as const;
export type FaunaRole = (typeof FAUNA_ROLES)[number];
