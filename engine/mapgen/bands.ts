// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A BAND, and the two things anybody ever does with one: draw a value
// inside it, and ask whether a value that came out is in it.
//
// Stated here rather than in `rules.ts` because both chapters of the rule
// book (`rules.ts`, `rules-circuit.ts`) are written in bands and neither
// may import the other. `rules.ts` re-exports all three, so every caller
// still spells them the way it always has.

export type Band = { readonly min: number; readonly max: number };

/** Draw a uniform value inside a band from the seeded stream. */
export function inBand(rng: { range(min: number, max: number): number }, band: Band): number {
  return rng.range(band.min, band.max);
}

/** Is `value` inside a band, with `slack` of tolerance either side? */
export function withinBand(value: number, band: Band, slack = 0): boolean {
  return value >= band.min - slack && value <= band.max + slack;
}

/** R17 — how one kind of rock is placed, as a row of bands. A kind states
 * its size EITHER as a `top` against sea level (the kinds that stand in
 * the water) OR as a `height` above the ground it sits on (the kinds that
 * stand on the shore); everything that places or checks a rock branches on
 * which. `solidRule` in `rules.ts` is where a kind becomes one of these. */
export type SolidRule = {
  readonly perKm: number;
  readonly offshore: Band;
  readonly r: Band;
  readonly top?: Band;
  readonly height?: Band;
};
