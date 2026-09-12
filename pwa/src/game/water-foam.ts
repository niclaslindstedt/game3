// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FOAM AS READ — how a vertex's foam SHARE and the wake map's own become
// white on the water, and the one place the foam tile's world footprint is
// stated. The tile itself is drawn in `fx-textures.ts`; this is the GLSL that
// reads it, injected into the water's fragment shader (`water-shader.ts`) so
// the sea's lace and the road's are the same few lines rather than two.
//
// LACE, NOT PAINT. The share says how much of a face has gone over, the tile
// says WHERE on it: a light share reaches only the tile's brightest lines and
// shows them half see-through, which is aerated water before it is white; a
// full share is white with the tile's darkest holes still open on the water
// under it. A sheet with no holes is a snowfield.
//
// AND THE TILE MUST NOT BE VISIBLE AS A TILE. Three things are stacked
// against that, because any one of them alone still reads as a pattern:
//
//   THE SEAM     the tile is drawn on a torus (`tiledValueNoise`), so it
//                meets itself at its own edges. A field merely sampled over
//                a whole number of periods butts against an unrelated one at
//                every join, and a hard line every few metres of sea is the
//                loudest half of what the eye picks up as a repeat.
//   THE GRAIN    the tile carries four octaves and a wander across the wind
//                (`fx-textures.ts`), so no two of its own streaks are the
//                same shape.
//   THE PATCH    the tile is read a SECOND time, much coarser and turned a
//                little off the wind, and that reading modulates how much of
//                the vertex's share this piece of water gets. The two scales
//                are deliberately incommensurate — 4.7, not 4 — so the
//                composite has no period a rider can ride the length of: the
//                grain still repeats every few metres, but where the foam is
//                DENSE repeats on a scale that never lines up with it.
//
// The patch modulates the THRESHOLD rather than the pattern, which is the
// difference between foam that comes and goes across a sea and foam that has
// been blurred: mixing two readings of a tile halves its variance and hands
// back a uniform grey lace, where sliding the window over the sharp one
// keeps every streak as crisp as it was drawn.

/** The foam tile's edge ACROSS the wind, m, and how many times longer it is
 * read DOWNWIND. The streak number is the tile's own pixel aspect
 * (`FOAM_ALONG` / `FOAM_ACROSS`), so a texel is square on the water and the
 * elongation the eye reads is the one baked into the noise rather than a
 * smear on top of it. */
const FOAM_METRES = 3.5;
const FOAM_STREAK = 4;

/** THE PATCH LAYER: how many times bigger the second reading is, how far it
 * is turned off the wind, rad, and where its origin sits, m. The scale is
 * not a whole number on purpose — at 4 the two readings would share a period
 * and the pair would repeat as hard as one. The turn is small: spume lies
 * downwind, and a second layer crossing it at a noticeable angle reads as
 * hatching rather than as patchy sea. */
const PATCH_SCALE = 4.7;
const PATCH_TURN = 0.21;
const PATCH_OFFSET = 37.3;

/** What the patch layer is worth: the share a vertex keeps where the patch
 * is emptiest and where it is fullest. Centred near 1, so the sea's overall
 * whiteness stays the wave model's business and this only decides WHERE it
 * lands — and wide, because a crest that goes over along its whole length at
 * one density is the comb this exists to break. At the low end a stretch of
 * crest keeps only a couple of streaks, which is a wave that has not gone
 * over there yet rather than a hole punched in one. */
const PATCH_LOW = 0.4;
const PATCH_HIGH = 1.55;

/** How wide the window is that the share slides over the tile. The tile's
 * alpha runs 0.18..1, so a window of a third of that range is what makes a
 * mid share a scatter of lines rather than a step from nothing to white. */
const WINDOW = 0.35;

/** THE WAKE'S OWN FOAM, as read: the tile's edge, m, for the road's mottling
 * — finer than the sea's and read SQUARE in world space, because a road is
 * the pump's boil and not the wind's streaks, and because the water leaves
 * it standing where it was laid. Two octaves at an incommensurate ratio,
 * mixed: the road is the nearest foam in the frame and at one octave a fresh
 * road is a flat white blanket rather than broken water. `WAKE_FOAM_GAIN` is
 * what a full share of the map's foam is worth to the lace — set so a fresh
 * road is white with the tile's darkest holes still cut into it (past 1.35
 * the lace saturates into a blanket, and under about 0.7 the road is a chain
 * of speckles), breaking into patches as it fades. */
const WAKE_FOAM_METRES = 1.6;
export const WAKE_FOAM_GAIN = 1.0;
const WAKE_OCTAVE = 2.7;
const WAKE_MIX = 0.35;

const f = (n: number): string => n.toFixed(4);

/**
 * The foam's GLSL, for the water's fragment shader.
 *
 * `windSpace` is the world plan point turned into the wind's frame — x
 * across the wind, y downwind — which is what the sea's streaks are laid
 * against; the wake's lace is read in the WORLD frame instead, so the road
 * does not swing round when the wind does.
 */
export function foamGlsl(): string {
  const along = FOAM_METRES * FOAM_STREAK;
  const cs = Math.cos(PATCH_TURN);
  const sn = Math.sin(PATCH_TURN);
  return `
  /** The tile's uv for a point in wind space: downwind along U, across it
   * along V, at the tile's own world footprint. */
  vec2 foamUv(vec2 windSpace) {
    return vec2(windSpace.y / ${f(along)}, windSpace.x / ${f(FOAM_METRES)});
  }

  /** The sea's lace: the tile read sharp for the grain, and read again
   * coarse and turned for WHERE the foam is at all. */
  float seaLace(sampler2D tile, vec2 windSpace, float share) {
    float grain = texture2D(tile, foamUv(windSpace)).a;
    mat2 turn = mat2(${f(cs)}, ${f(sn)}, ${f(-sn)}, ${f(cs)});
    vec2 wide = (turn * windSpace) / ${f(PATCH_SCALE)} + ${f(PATCH_OFFSET)};
    // Not \`patch\`: that is a reserved word in GLSL ES, and a shader that
    // will not compile takes the whole SEA out of the frame rather than
    // taking the foam out of it.
    float mask = texture2D(tile, foamUv(wide)).a;
    float local = clamp(share * mix(${f(PATCH_LOW)}, ${f(PATCH_HIGH)}, mask), 0.0, 1.0);
    return smoothstep(1.0 - local, ${f(WINDOW)} + 1.0 - local, grain);
  }

  /** The road's: the same tile square in the world, at two scales whose
   * ratio is not a whole number, so the boil has no grid in it either. */
  float wakeLace(sampler2D tile, vec2 world, float share) {
    float pattern = mix(
      texture2D(tile, world / ${f(WAKE_FOAM_METRES)}).a,
      texture2D(tile, world / ${f(WAKE_FOAM_METRES / WAKE_OCTAVE)}).a,
      ${f(WAKE_MIX)});
    return smoothstep(1.0 - share, ${f(WINDOW)} + 1.0 - share, pattern);
  }
`;
}
