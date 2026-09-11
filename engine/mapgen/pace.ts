// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RULE BOOK'S THIRD CHAPTER: what every number in it becomes at a
// SPEED CLASS. `rules.ts` says what the rules are and `rules-circuit.ts`
// replaces half of them for a lap at sea; this one stretches whichever of
// the two a level was drawn to.
//
//   R32 A FASTER CLASS IS GIVEN MORE COURSE, NOT LESS TIME. Every number
//       in the rule book is metres and a level is laid in metres, so a
//       rider at 1.5x the pace on a stock course gets two thirds of the
//       TIME between one gate and the next — measured over four seeds and
//       the whole roster, the gates taken fell from 139 to 110 and the
//       gates MISSED rose from 101 to 130, because a hull that overshoots
//       a gate has to come back for it. So every rule number that is
//       really a TIME — how far the craft travels between one event and
//       the next: `gate.spacing`, `course.length` and `target`,
//       `route.length` and `reach`, `start.behind`, `leg.at` and `after`,
//       `ramp.runUp` and `lead`, `air.landing` — is stretched by the
//       class, and `course.radius` by the SQUARE of it, because the
//       tightest circle a line may turn at is v^2/a and the hull's grip
//       does not grow with the class. What is NOT stretched is the SHORE (`bounds`,
//       `course.offshore`, `route.corridor`, the land's reach: a coast is
//       a coast whatever is ridden along it) and the CRAFT (`gate.width`,
//       `air.width`, `ramp.length` and `width`, `course.solidMargin`:
//       they are sized off a hull the class does not resize). A level
//       carries the class it was drawn to as `Level.pace`, so the analyzer
//       scores it against the book it was actually built to, and the stock
//       class is the stock book by identity — no level anyone has ridden
//       re-rolls.
//
// Split out of `rules.ts` for the §20.5 cap, and along the seam that was
// already there: that file says what the rules ARE, this one says what
// they become at a pace.

import { LEVEL_RULES } from "./rules.ts";

/** The rule book with its literal types widened to plain numbers — what a
 * PACED table is, since every stretched entry is computed rather than
 * written. `LEVEL_RULES` itself is assignable to it, so a reader that takes
 * this reads either. */
type Widen<T> = T extends number
  ? number
  : T extends readonly (infer U)[]
    ? readonly Widen<U>[]
    : { readonly [K in keyof T]: Widen<T[K]> };
export type PacedRules = Widen<typeof LEVEL_RULES>;

/** THE RULE BOOK AT A SPEED CLASS — the file header says why.
 *
 * The numbers that are really a TIME — how far the craft travels between
 * one event and the next — are stretched by the class. What does NOT scale
 * is just as deliberate:
 *
 * - The SHORE's numbers (`bounds`, `course.offshore`, `route.corridor`,
 *   the land's reach, the surface bands): a coast is a coast whatever is
 *   ridden along it, and stretching them would make a fast class a
 *   different country rather than a faster race.
 * - The CRAFT's numbers (`gate.width`, `air.width`, `ramp.length` and
 *   `width`, `course.solidMargin`): they are sized off the hull, which the
 *   class does not resize.
 *
 * `course.radius` is the one number stretched by the SQUARE of the class
 * rather than by it: the tightest circle the LINE may turn at is v²/a at a
 * fixed lateral grip, and the hull's grip does not grow with the class.
 * Leaving it alone was measured and it is worse — a corner no hull at that
 * class can hold is a corner it scrubs the whole class back off for, and
 * then a faster class buys nothing but a longer straight between two
 * slow-downs. Over the same four seeds and roster at class 1.5: pacing the
 * course alone took the gates taken from 110 to 93, and squaring the radius
 * with it recovered them to 121.
 *
 * Memoised per class: the generator asks for it once a level, the analyzer
 * once a report, and the table is a dozen objects. */
const PACED = new Map<number, PacedRules>();

export function rulesAtPace(pace: number): PacedRules {
  const k = Math.max(0.1, pace);
  if (k === 1) return LEVEL_RULES;
  const held = PACED.get(k);
  if (held) return held;
  const band = (b: { min: number; max: number }) => ({ min: b.min * k, max: b.max * k });
  const R = LEVEL_RULES;
  const paced: PacedRules = {
    ...R,
    gate: { ...R.gate, spacing: band(R.gate.spacing) },
    // R11's setback is the straight water a rider has before gate 1, and
    // straight water is worth what it takes to cross — 40 m is a second at
    // stock and two thirds of one at OPEN.
    start: { ...R.start, behind: R.start.behind * k },
    course: {
      ...R.course,
      length: band(R.course.length),
      target: band(R.course.target),
      // v²/a at a fixed lateral grip — the one number that goes as the
      // SQUARE of the class. The header says what leaving it alone cost.
      radius: R.course.radius * k * k,
    },
    route: { ...R.route, length: band(R.route.length), reach: R.route.reach * k },
    // R25's leg is spliced into the line at a distance from the start, and
    // its own rule justifies that distance by R11's start straight, R4's
    // spacing and R10's shortest course — all three of which stretch here.
    // Left alone it is a window that stays put while the line it is spliced
    // into grows, and the walk is redrawn until the furthest station lands
    // in it: 79 rejections a level at class 1.5 against 2 at stock, which
    // is a generator that gives up on about one seed in thirty.
    leg: { ...R.leg, at: band(R.leg.at), after: R.leg.after * k },
    ramp: { ...R.ramp, runUp: R.ramp.runUp * k, lead: band(R.ramp.lead) },
    air: { ...R.air, landing: R.air.landing * k },
  };
  PACED.set(k, paced);
  return paced;
}
