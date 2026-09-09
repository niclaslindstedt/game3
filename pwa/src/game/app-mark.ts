// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE APP MARK'S WAVE, as paths anything in the app can draw.
//
// The mark is a hull meeting a wave: a crest that rises from the left, tips
// over and curls, drawn as two parallel lines — the foam along the lip and
// the darker face under it — with a small hull held nose-up beside it. The
// hull belongs to the ICON and stays there; the WAVE is the part worth
// reusing, because a wave is a thing that BUILDS, and a crest filling itself
// from its tail to its curl is the app's own mark saying it is working.
//
// THE GEOMETRY IS STATED THREE TIMES and they must agree: here, as the two
// `d` strings; in `pwa/public/icons/icon.svg`, as the same two; and in
// `scripts/generate-icons.mjs`, as the arc centres and radii the raster icons
// are drawn from. None can import either of the others, so that is not a
// comment anybody has to remember — `tests/app_mark_test.ts` reads the SVG
// and holds these to it.
//
// The two arcs of each line are TANGENT at the lip — the curl's centre sits
// on the swell's radial through that point — so the pair runs continuously
// through the inflection instead of stepping, and a line at a radial offset
// from the spine is the same offset on both arcs.

/** The box the two lines actually ink, stroke and round caps included. NOT
 * the icon's own 512-square: the wave is drawn left of centre with the hull
 * filling the lower right, so a wave-only drawing framed on the square is a
 * small curl adrift in a lot of empty water. */
export const MARK_WAVE_VIEWBOX = "70 145 290 205";

/** The crest and the face, tail first: every path runs from the tail at the
 * left, up over the lip, into the curl. Filled in that direction the wave is
 * BUILDING; reversed, it is falling back. */
export const MARK_WAVE = [
  "M 86 330 A 170 170 0 0 1 341 182.78 A 70 70 0 0 1 341 304.02",
  "M 122 330 A 134 134 0 0 1 323 213.95 A 34 34 0 0 1 323 272.84",
] as const;

/** How wide a line is drawn in the icon's space. */
export const MARK_WIDTH = 26;
