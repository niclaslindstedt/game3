// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A COAST IS GRADED — the cast over the WHOLE picture, per coast.
//
// Every other per-coast table in this app paints one thing: the water's
// tones (`water-optics.ts`), the shore's (`shore-paint.ts`), what the
// weathers and the seasons do to the air (`sky-looks.ts`). This one paints
// none of them and all of them: it is the grade laid over the finished
// frame, the way a television series is graded rather than lit — one pass at
// the end, on the picture as a whole, after every material in it has already
// been shaded by a sky that knows nothing about it.
//
// WHY A GRADE AND NOT MORE LAMPS. The two coasts are already different
// places — a cold brackish skerry coast against a clear turquoise one — and
// every one of those differences is authored where it physically belongs.
// What that does NOT buy is the thing an audience actually reads a place by,
// which is the colour of the AIR between them and it: the cold coast wants
// blue in its shadows and the colour drained out of its midtones, the warm
// one wants gold in its highlights and teal under them. Putting those in the
// lamps would mean tinting the sun, which moves; putting them in the water
// would mean a sea that disagrees with the sand beside it. A grade is one
// statement over the lot, and it cannot drift from itself.
//
// THE GRADE IS APPLIED IN LINEAR LIGHT (`grade-pass.ts` is the GLSL half),
// but the two dials that a colourist thinks of as straight lines — the
// CONTRAST and the LIFT — are applied in a PERCEPTUAL coordinate rather than
// on the light itself, because in linear light a straight contrast is not
// one: mid grey sits at 0.18, so a gain about it crushes everything under a
// quarter of the picture's range into the black and runs the sun's glint away
// past twice its own brightness. `sqrt` is the cheapest honest stand-in for
// the display curve (it is gamma 2 against sRGB's 2.2, which is close enough
// that the difference is not a colour anybody can name), and a gain about mid
// grey in THAT coordinate is the lift-and-gain a grading desk actually has.
//
// THE THREE COLOURS ARE NORMALISED BY THEIR OWN LUMINANCE, so a grade shifts
// the picture's BALANCE and never its exposure. That is what makes the table
// authorable: `#dbe7f2` says "cool and faintly blue", and how bright the hex
// happens to be says nothing at all. Without it, picking a believable cold
// cast means picking a hex that is also 20% darker than white, and the coast
// arrives dim rather than cold.
//
// Kept free of three.js, like `sky.ts` and `lib/colour.ts` and for the same
// layering reason: deciding what the picture is graded and drawing it are two
// jobs. `gradeTone` below IS the model — `tests/colour_grade_test.ts` holds
// the two looks to it, and `grade-pass.ts` restates the same five steps as
// GLSL. Change one, change both.

import type { BiomeId } from "@engine";

import { luminance, packLinear, unpackLinear } from "../lib/colour.ts";

/**
 * ONE COAST'S GRADE — seven dials, in the order they are applied.
 *
 * All three colours are sRGB hexes whose HUE and SATURATION are what is
 * being authored; their brightness is divided out (see the header), so a
 * neutral grey in any of them is "leave this alone" whatever grey it is.
 */
export type ColourGrade = {
  /** How hard the picture is, about mid grey, in the perceptual coordinate:
   * 1 is untouched, under 1 flatter, over 1 punchier. A flat picture is not
   * a mistake — an overcast northern coast IS low in contrast, and grading
   * it up is what makes a grey sea read as a black one. */
  readonly contrast: number;
  /** HOW FAR OFF THE FLOOR THE BLACKS SIT, 0..1 in the same coordinate — the
   * haze in the shadows. It is the single strongest signal that there is
   * cold air between the lens and the shore, and the one dial here that a
   * lamp cannot imitate: a light added to lift the shadows lights the thing
   * casting them too. Applied AFTER the contrast, which is the order a
   * grading desk has them in — lifted first, the contrast puts the blacks
   * straight back on the floor. */
  readonly lift: number;
  /** How much colour is left, 1 untouched. Toward 0 the frame goes to its
   * own luminance; past 1 it saturates. */
  readonly saturation: number;
  /** THE CAST OVER EVERYTHING — the filter on the lens. */
  readonly tint: string;
  /** WHAT THE DARKS AND THE LIGHTS ARE PULLED TOWARD, and how far, 0..1
   * each. Split-toning is what separates a grade from a filter: the same
   * frame can run cold in the shadows and warm in the highlights, which no
   * single cast can do and which is most of what a warm coast looks like —
   * gold on the sunlit water, teal in the troughs under it. The weight is
   * read off the pixel's own luminance in the perceptual coordinate, so the
   * split lands where the eye reads shadow and highlight rather than where
   * the light happens to halve. */
  readonly shade: string;
  readonly glow: string;
  readonly split: readonly [number, number];
};

/** Mid grey, LINEAR — 18% reflectance, the pivot a contrast turns about. */
const MID = 0.18;
/** …in the perceptual coordinate the contrast and the lift are applied in. */
const MID_P = Math.sqrt(MID);

/** Every coast's grade, keyed the way `BIOMES` is. A coast without a row is
 * a coast this game does not know the colour of. */
export const COLOUR_GRADES: Readonly<Partial<Record<BiomeId, ColourGrade>>> = {
  taiga: {
    // A COLD COAST, GRADED THE WAY A NORTHERN SERIES IS: flat, drained,
    // blue in the shadows, and the whole thing a couple of degrees cooler
    // than the light that made it. The picture is deliberately SOFTER than
    // the warm coast's — an overcast sea has no blacks in it, and the
    // temptation to put some back is what turns a grey morning into a
    // night. What reads as cold here is the lift and the drain, not the
    // hue: a blue cast on a punchy, saturated frame reads as a filter, and
    // on a flat drained one it reads as weather.
    contrast: 0.96,
    // THE DIAL THIS COAST WAS TUNED ON, and the one that goes wrong first.
    // Two per cent of the way to white in the darks is the cold damp air
    // standing in the shadows under the pines and in the troughs. Twice
    // that is a veil: on seed 38 at dusk, 0.045 lifted the darkest fifth of
    // the frame by 43% and the tree line stopped reading against the sky
    // at all — a fogged picture, not a cold one, and no number in the table
    // said so. Judged on the shot, never on the ramp.
    lift: 0.022,
    // Drained, not monochrome: the buoys' orange and the craft's own paint
    // are what the rider reads the course by, and they have to survive.
    saturation: 0.86,
    // Cool blue-white: about a tenth off the red, a tenth onto the blue.
    tint: "#dbe7f2",
    // Steel blue in the darks, and the darks are most of this coast —
    // the granite, the wood behind the beach, the deep water.
    shade: "#5b7f96",
    // …and a whisper of cold cyan in the lights. Barely anything on
    // purpose: the highlights here are an overcast sky, and a coast whose
    // whites go warm stops being this coast.
    glow: "#e8f2f4",
    split: [0.22, 0.1],
  },
  mangrove: {
    // A WARM COAST, GRADED THE WAY A HOT-LATITUDE SERIES IS: punchy,
    // saturated, gold in the sunlight, teal in everything the sun missed.
    // The split is the whole look — the two ends pulling opposite ways is
    // what makes a bright day read as HOT rather than merely lit, and it is
    // the one thing a single warm cast cannot do.
    contrast: 1.09,
    // Blacks on the floor. Clear salt air has nothing in it to lift them
    // with, and the clean black under a hull is what the gold on the water
    // is read against.
    lift: 0,
    // Up, not far: the water here is already turquoise and the sand is
    // already white, and a saturation that fights them puts a cartoon on
    // screen instead of a coast.
    saturation: 1.12,
    // ALMOST NOTHING — and that is the point. A warm CAST is the obvious
    // way to write "hot" and it is the wrong one here, because it warms the
    // shadows too and then cancels the teal that is doing the real work: at
    // a tenth onto the red the darks came back neutral grey and the look
    // collapsed into a filter. The warmth belongs in `glow`, where the sun
    // is; this is a whisper to keep the whites off ice.
    tint: "#fffaf2",
    // Deep teal under everything the sun did not reach — the shadow side of
    // a wave, the water under the mangrove roots, the inside of a barrel.
    shade: "#0a6b80",
    // …and hard amber on everything it did.
    glow: "#ffc978",
    // The strongest split of the two coasts, because it IS the look: the
    // ends pulling opposite ways is what makes a bright day read as hot
    // rather than merely lit, and no single cast can do it.
    split: [0.3, 0.24],
  },
  arctic: {
    // A POLAR COAST, GRADED THE WAY A FILM SHOT ON THE ICE IS: high-key,
    // nearly monochrome, the blacks lifted further than the taiga's and
    // the whole picture pulled toward a steel blue. What makes the arctic
    // read as the arctic is not blue — it is the ABSENCE of every other
    // colour, and the light coming from the whole white sky rather than
    // from the sun. The contrast is the flattest of the three: a white
    // wall over black water under a grey sky is a picture with no
    // midtones in it, and grading contrast INTO it makes a night of the
    // water.
    contrast: 0.94,
    // Lifted a touch past the taiga's: ice fog and snow-light in every
    // shadow. Not far — twice this is the veil the taiga's row warns of.
    lift: 0.03,
    // The most drained of the three. The buoys and the craft survive it;
    // nothing else on this coast had colour to lose.
    saturation: 0.78,
    // Steel-blue white over everything.
    tint: "#d8e4f2",
    // The blue of the ice at the waterline in the darks — the water, the
    // wall's foot, the underside of every floe.
    shade: "#4a6f92",
    // And the lights kept COLD: a cold cyan-white, because the highlights
    // here are snow and a snowfield that goes warm reads as sand.
    glow: "#e6f0f8",
    split: [0.26, 0.14],
  },
};

/** The row for a coast; throws for one nobody has graded, the way
 * `waterOpticsOf` throws for one nobody has drawn the water of. */
export function gradeOf(biome: BiomeId): ColourGrade {
  const row = COLOUR_GRADES[biome];
  if (!row) throw new Error(`no grade is written for the "${biome}" coast yet`);
  return row;
}

/**
 * A GRADE'S COLOUR, with its brightness divided out — the three linear
 * channels the shader multiplies by, written into a caller's array.
 *
 * A luminance of zero is the one case that cannot be normalised, and pure
 * black is a plausible thing to type into a table by accident; it is handed
 * back as white, which is the identity, so the worst a mistyped row can do
 * is nothing.
 */
export function gradeColour(hex: string, out: [number, number, number]): [number, number, number] {
  const packed = Number.parseInt(hex.replace("#", ""), 16);
  unpackLinear(packed, out);
  const l = luminance(packed);
  if (l <= 0) {
    out[0] = out[1] = out[2] = 1;
    return out;
  }
  out[0] /= l;
  out[1] /= l;
  out[2] /= l;
  return out;
}

/** Rec. 709 luminance of three LINEAR channels — the same weights
 * `lib/colour.ts` measures a hex's light with, and the same the shader uses. */
function lumaOf(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const TINT: [number, number, number] = [0, 0, 0];
const SHADE: [number, number, number] = [0, 0, 0];
const GLOW: [number, number, number] = [0, 0, 0];

/**
 * ONE PIXEL, GRADED — a packed sRGB colour in, a packed sRGB colour out.
 *
 * This is the model, and `grade-pass.ts`'s fragment shader is the same seven
 * lines in GLSL over three linear channels. A colour is authored and read as
 * a hex everywhere else in this app, so the model is written on hexes too
 * and does its own trip out to linear light and back — which is exactly the
 * trip the pass makes through an sRGB render target and the output's own
 * conversion.
 *
 * It is not on the frame's path: nothing in the running game calls it. It is
 * how a grade is ARGUED about — in a test that says the cold coast cools a
 * neutral grey and the warm one warms it, and in a sheet that prints a ramp
 * through both. Reasoning about the shader instead is how a cast that is
 * half a stop dark ships.
 */
export function gradeTone(grade: ColourGrade, hex: number): number {
  const c = unpackLinear(hex, [0, 0, 0]);
  gradeColour(grade.tint, TINT);
  gradeColour(grade.shade, SHADE);
  gradeColour(grade.glow, GLOW);

  // THE CONTRAST AND THE LIFT, in the perceptual coordinate (see header).
  // CLAMPED BEFORE IT COMES BACK: a contrast over 1 takes the coordinate
  // NEGATIVE for anything darker than mid grey by more than the gain, and
  // squaring a negative flips it — an unclamped black came back off the
  // floor at a twentieth of mid grey, which is the exact opposite of what
  // a contrast does and reads as a grey veil over the whole night.
  for (let i = 0; i < 3; i++) {
    const s = MID_P + (Math.sqrt(Math.max(c[i], 0)) - MID_P) * grade.contrast;
    const lifted = Math.max(s + grade.lift * (1 - s), 0);
    c[i] = lifted * lifted;
  }

  // THE SATURATION, about the pixel's own light. Clamped on the way out
  // because a saturation over 1 takes the weakest channel of an already
  // strong colour below zero — a turquoise sea has almost no red in it —
  // and a negative channel is not a colour for the split to weigh.
  const l = lumaOf(c[0], c[1], c[2]);
  for (let i = 0; i < 3; i++) c[i] = Math.max(l + (c[i] - l) * grade.saturation, 0);

  // THE CAST.
  for (let i = 0; i < 3; i++) c[i] *= TINT[i];

  // THE SPLIT — weighted by the graded pixel's own light in the same
  // perceptual coordinate the contrast used, so "shadow" and "highlight"
  // mean what the eye means by them.
  const w = Math.min(1, Math.max(0, Math.sqrt(Math.max(lumaOf(c[0], c[1], c[2]), 0))));
  const shade = grade.split[0] * (1 - w);
  const glow = grade.split[1] * w;
  for (let i = 0; i < 3; i++) {
    c[i] *= 1 - shade + shade * SHADE[i];
    c[i] *= 1 - glow + glow * GLOW[i];
  }

  return packLinear(c[0], c[1], c[2]);
}
