// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE COURSE'S MARKS, AS DATA — every dimension the code draws a GATE MARK
// (`gates.ts`: the moulded navigation float a water gate's pair of buoys
// are) and a ROUNDING BUOY (`buoys.ts`: the moored steel can a circuit's
// lap is ridden round) with, lifted out of the two so the Blender builder
// (`scripts/blender/mark.py`, handed all of it as one JSON file by `make
// blender KIND=mark`) models to the same lines the code lathes, and so the
// two cannot disagree about how tall a lantern stands over the water.
// Three-free, so the suite, the driver and the stamp read every number.
//
// THE FRAME. Metres, about each mark's OWN WATERLINE: y = 0 is the sea, so
// the whole thing is lifted onto the wave under it every frame. A profile
// is `[radius, height]` pairs, foot first, which the code turns on a lathe.
// The rounding buoy is sized off the SOLID the generator placed
// (`R.solids.buoy`: its can's radius `r`, its lantern at `top`), so its
// numbers are shares of those where they are not absolute.

/** The two kinds modelled (`pwa/models/marks/<kind>.glb`). */
export const MARK_KINDS = ["gatemark", "buoy"] as const;
export type MarkKind = (typeof MARK_KINDS)[number];

/** The can radius and lantern height the buoy's model is built at, m —
 * the middle of `R.solids.buoy`'s bands; `buoys.ts` scales the can across
 * by the solid's own radius and stretches the tower to its own top. */
export const BUOY_REFERENCE = { r: 1.4, top: 3.9 } as const;

/** THE GATE MARK: a wide float collar riding the waterline (its widest
 * point AT the water, which is what says something is moored), a flat rim
 * in to the ribbed cone over it, the flange the lantern bolts to, and the
 * lantern — a frame with the lens sleeved over its post. */
export const MARK = {
  /** The float and the cone, lathed. */
  body: [
    [0.0, -0.62],
    [0.24, -0.6],
    [0.46, -0.5],
    [0.6, -0.34],
    [0.65, -0.16],
    [0.65, 0.3],
    [0.63, 0.38],
    [0.5, 0.4],
    [0.47, 0.46],
    [0.22, 1.3],
    [0.195, 1.38],
    [0.25, 1.4],
    [0.25, 1.46],
    [0.16, 1.48],
    [0.0, 1.48],
  ],
  bodySegments: 16,
  /** The moulded ribs up the cone, standing proud of the flank: how many,
   * the flank they run up (foot to head, radius and height), their section
   * (across, deep) and how far proud they stand. */
  ribs: { count: 3, r0: 0.47, y0: 0.46, r1: 0.22, y1: 1.3, across: 0.09, deep: 0.07, proud: 0.03 },
  /** The lantern's frame: the flange, the post, the cap — one casting. */
  frame: [
    [0.0, 1.48],
    [0.15, 1.49],
    [0.165, 1.55],
    [0.15, 1.59],
    [0.065, 1.61],
    [0.065, 1.82],
    [0.19, 1.87],
    [0.18, 1.94],
    [0.08, 1.98],
    [0.0, 1.99],
  ],
  frameSegments: 10,
  /** The lens: an open sleeve of ridged glass round the post. */
  lens: [
    [0.14, 1.6],
    [0.163, 1.635],
    [0.14, 1.67],
    [0.163, 1.705],
    [0.14, 1.74],
    [0.163, 1.775],
    [0.14, 1.81],
    [0.155, 1.845],
    [0.14, 1.87],
  ],
  lensSegments: 10,
  /** Where the lantern's light sits, m above the waterline. */
  lanternY: 1.735,
} as const;

/** THE ROUNDING BUOY, about a solid of radius `r` with its lantern at
 * `top`: the can (how far it stands out of the water and how far under),
 * the black band round its waist, the shoulder the tower stands on, the
 * lattice tower (how far in its four legs lean by the top, how thick they
 * are) and the lantern at the top of it. */
export const BUOY = {
  can: { over: 1.15, under: 0.95, taper: 0.94 },
  band: { height: 0.36, at: 0.34, proud: 1.03 },
  shoulder: { r: 0.6, height: 0.34 },
  cage: { waist: 0.42, leg: 0.11, foot: 0.55, standOff: 0.3, hoop: 0.05 },
  lamp: { radius: 0.26, height: 0.44, capOver: 1.25, capHeight: 0.3, capGap: 0.15, under: 0.12 },
} as const;
