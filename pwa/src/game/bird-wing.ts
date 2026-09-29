// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIRD'S WING AND PAINT, AS DATA — the numbers `bird-shapes.ts` builds a
// wing with (where its vertex columns stand along the half-span, where the
// tip's dark begins, how thick the two faces stand apart, how far the arm
// and the hand fold), the plan of the wing off a row of the roster
// (`wingEdges`), and the ROLES a bird is painted in, lifted out of the
// three-bound builder so the Blender builder (`scripts/blender/bird.py`,
// handed all of it by `make blender KIND=bird`) models to the same wing
// and the game dresses a model's faces by the same names. Three-free, so
// the suite, the driver and the stamp read every number.
//
// THE FRAME is the code's: metres, the shoulders at the origin, the bill
// toward +z, the right wing along +x, both wings LEVEL — the shader flaps
// and folds them per instance off `aWing` (1 on a wing vertex) and the
// wrist at `wrist` of the half-span, so a model's wing must stand exactly
// where the code's does or it folds about the wrong line.

import type { BirdSpec } from "./bird-defs.ts";

/** How a species is PAINTED — every colour a bird has (`BIRD_STYLES` in
 * `bird-shapes.ts` is the table). */
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

/** THE WING. `stations`: where along the half-span the wing's vertex
 * columns stand, as shares (the wrist is added between them, so the fold
 * has a column to hinge on); `tipFrom`: where the wingtip's dark begins;
 * `skin`: how thick a wing is drawn, m, as the gap between its two faces;
 * `armFold` / `handFold`: how far back the ARM sweeps at the shoulder and
 * the HAND at the wrist when a wing is fully folded, rad. */
export const WING = {
  stations: [0.03, 0.3, 0.62, 0.84, 1],
  tipFrom: 0.78,
  skin: 0.006,
  armFold: 1.2,
  handFold: 0.95,
} as const;

/** The wing's plan: the leading and trailing edge z at a share `s` of the
 * half-span, off the row's chord, taper and sweep. The leading edge is
 * carried a little ahead of the shoulder and swept back toward the tip;
 * the chord tapers to the row's own tip. */
export function wingEdges(spec: BirdSpec, s: number): { lead: number; trail: number } {
  const half = spec.span / 2;
  const c0 = spec.span * spec.wing.chord;
  const chord = c0 * (1 - (1 - spec.wing.taper) * s);
  const lead = c0 * 0.45 - spec.wing.sweep * half * Math.pow(s, 1.5);
  return { lead, trail: lead - chord };
}

/** What a face of a bird is, by its material's name: the roles a model
 * carries and the game dresses (`bird-models.ts`). */
export const BIRD_ROLES = ["back", "belly", "tip", "head", "bill", "tail", "legs"] as const;
export type BirdRole = (typeof BIRD_ROLES)[number];

/** A role's colour in a species' style: the tail the mantle's where the
 * row names none, the legs nothing where the row has none. */
export function roleColour(role: string, style: BirdStyle): number | null {
  switch (role) {
    case "back":
      return style.back;
    case "belly":
      return style.belly;
    case "tip":
      return style.tip;
    case "head":
      return style.head;
    case "bill":
      return style.bill;
    case "tail":
      return style.tail ?? style.back;
    case "legs":
      return style.legs ?? null;
    default:
      return null;
  }
}
