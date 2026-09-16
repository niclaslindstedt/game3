// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RULE BOOK'S RIVER TABLE: R26's water and R27's current.
//
// Stated next door and folded back into `LEVEL_RULES` under its own names
// (`R.river`, `R.flow`), so nothing that reads a river number learns this
// file exists — the `defs/sea.ts` pattern, for the same reason: `rules.ts`
// is AT the §20.5 cap, and R26 is the rule with the most numbers under it.
//
// The PROSE stays in `rules.ts` with every other rule's. This is not a
// chapter of the rule book (those are `rules-circuit.ts` and `pace.ts`,
// which state rules of their own); it is one chapter's table, kept where
// there is room for it.

/** R26 — THE RIVER that runs on inland past the race. */
export const RIVER_RULES = {
  /** How far apart its samples stand, m — closer than the route's,
   * because a river bends tighter than a racing line. */
  step: 12,
  /** The tightest circle the meander turns at, m. Under R23's racing
   * floor on purpose: nothing races up here, and a watercourse that can
   * only bend as gently as a course line reads as a canal. */
  radius: 38,
  /** How hard it meanders, as a share of that circle, and over what
   * period of walking, m. MEASURED by the SINUOSITY that comes out —
   * how much longer the water is than the country it crosses. A natural
   * lowland river runs 1.3 to 2; at the first numbers tried here the
   * median was 1.07, which draws as a canal cut straight inland however
   * the noise wobbles it, and the reason was the inland pull rather
   * than the meander: a walk turned toward one heading every step
   * cannot bend far off it. */
  swing: { min: 0.7, max: 1.15 },
  swingScale: 210,
  /** How hard the walk is pulled toward the way inland lies, as a share
   * of a step's own turn. Weak enough that the meander owns the shape —
   * that is the whole tuning above — strong enough that a river never
   * turns back to the sea. */
  pull: 0.22,
  /** How much longer the water is than the country it crosses — its
   * SINUOSITY, the check the meander above was tuned against. A band
   * because a river is wrong at both ends of it: under the floor it is a
   * canal, and over the ceiling it is a walk that spent its length
   * meandering in one field instead of running out of the country. */
  sinuosity: { min: 1.12, max: 2.7 },
  /** The most it may walk, m, before the attempt is given up: a river
   * that has wandered this far without getting inland is meandering in
   * one place rather than running out of the country. */
  length: { min: 1000, max: 2600 },
  /** …and how far from the mouth its head has to STAND, m, in a straight
   * line — drawn per level. A kilometre of country at the floor: far
   * enough that riding up it is a journey out of the basin the race was
   * run in rather than a look round the next headland. */
  inland: { min: 1000, max: 1250 },
  /** Half-width at the head, m. Three metres of water is narrower than
   * the turning circle of anything in the catalog and, on R3's own bed
   * profile, under half a metre deep — so the creek stops the rider by
   * being a creek, which is the only kind of "no further" this game
   * has. */
  head: 3,
  /** The power the half-width tapers from the mouth's to the head's by.
   * Over 1, so most of the narrowing is in the first third of the run —
   * a river loses its tributaries going up, it does not close like a
   * wedge. */
  taper: 1.8,
  /** How far the walk keeps off the racing line, m, and how much of its
   * own start is exempt because it IS the race's water there. Two mouths
   * a rider cannot tell apart is one mouth too many. */
  clear: 100,
  mouthRun: 130,
  /** R26 — the tightest circle the water may turn at, as a multiple of
   * its own half-width; `radius` is the floor under it, which is what
   * the creek at the head turns at. Real meanders run a couple of
   * channel WIDTHS of curvature and up, and under about one the channel
   * runs into itself on the inside of the bend. */
  bendWidths: 2.6,
  /** …the NECK of land that has to stand between two reaches of the
   * river's own water, m, on top of the half-widths they each carry, and
   * how far apart ALONG the water they have to be for their closeness to
   * count — as a share of the hairpin a channel that wide could have
   * turned (π·its bend radius), so the same number reads on a creek and
   * on a mouth. Over 1, so a line is judged only once it is clear of its
   * own bend. */
  selfBank: 25,
  selfSpan: 1.25,
  /** How far inshore of the open sea's straight edge the mouth must
   * stand, m. Only enough to put it in the CORRIDOR'S water rather than
   * the sea's: inside the edge the water at the mouth is the route's own
   * and the land closes round it, which is what makes the thing a river
   * mouth instead of a stream drawn across a bay. */
  mouthInshore: 20,
  /** Walks drawn before the route is given up on. The walk is a couple
   * of hundred steps and everything downstream of the route it hangs off
   * is a build, so a meander that wandered back onto the racing line — or
   * spent its length turning without getting inland — is redrawn rather
   * than paid for with a whole attempt. MEASURED: at six tries one route
   * in seven was thrown away for want of a river, at sixteen it is one in
   * forty, and the walk is a tenth of a millisecond. */
  tries: 16,
  /** R27 — how much water comes out of the mouth, m³/s. A real taiga
   * coast's band: the rivers of a northern coast run from a hundred
   * and something (the Öre) to six hundred (the Ume) in mean annual
   * flow. A VOLUME and not a speed, which is the whole of R27. */
  discharge: { min: 120, max: 600 },
} as const;

/** R27 — the current down that river. */
export const FLOW_RULES = {
  /** How much of the mouth's discharge a section further up carries, as
   * a power of how much smaller its cross-section is. A pipe would want
   * 1; a river's catchment grows the whole way down, which is WHY it
   * widens, and rigid continuity would run the creek at the head at a
   * thousand times the mouth's speed. Under 1, so v = Q/A still
   * QUICKENS as A^(gather − 1) where the channel closes — about four
   * times the mouth's speed at the head of a typical draw. */
  gather: 0.8,
  /** The most the water may run, m/s, where the bed thins out past what
   * the law above was fitted over. The one arcade bound here. */
  max: 3.5,
  /** How far the plume carries out of the mouth into the basin, m, and
   * how much wider it has spread by the end of it. */
  plume: 90,
  spread: 0.6,
} as const;
