// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RULE BOOK'S THIRD CHAPTER: what every number in it becomes at a
// SPEED CLASS, and the DIALS a run may be dealt on top of it. `rules.ts`
// says what the rules are and `rules-circuit.ts` replaces half of them for
// a lap at sea; this one stretches whichever of the two a level was drawn
// to, and carries the three numbers a run sets for itself — the class, the
// deck's width and the sea standing off the coast.
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
//   R33 THE DECK IS A DIAL. R8's ramp is `ramp.width` metres across at the
//       stock setting, and a run may be dealt a `rampWidth` MULTIPLE of it
//       inside `RAMP_DIAL` — the one number a difficulty ladder moves
//       in the LEVEL rather than in the run, `TUNING.assist`'s two hands
//       being the rider's. A wider deck is an easier jump for the reason
//       the assist exists: a hull on a ramp has nothing in the water, so
//       the sideways way it climbed aboard is the sideways way it leaves,
//       and the only cure the geometry has is flank to spare. Nothing but
//       the deck moves with it — the ring stays `air.width` across, the
//       arc R18 derives is the same arc, and the run-up stays as long —
//       so the dial changes how much of a lip a rider may miss by and
//       nothing about what the jump is. What DOES follow is the keep-out:
//       R6's margin is measured from the deck's edge and R9's run-up is
//       clear across the deck's width, so a wider ramp asks the search for
//       a wider corridor of open water, and the stock dial is the stock
//       book by identity — no level anyone has ridden re-rolls.
//   R34 NO GATE IS A KINK. R23's other half, and the one a rider actually
//       meets: no gate asks for more than `GATE_CORNER` radians between
//       the leg in to it and the leg out of it. R23 bounds the RADIUS of
//       the line, but a rider steers gate to gate rather than along a
//       polyline, so a bend well inside that radius still rides as a wall
//       when the whole of it falls between one gate and the next — at R4's
//       widest spacing, 150 m of line. It was the commonest way a
//       generated course came out unrideable: over eighty levels the worst
//       gate asked for 87° on the median seed and 112° on the worst, where
//       the fastest craft in the catalog needs 68 m of ground down its
//       entry heading to come round 90° at all. R25's rounding is EXEMPT
//       and held to R23's radius alone — a half circle drawn round a mark
//       is a corner on purpose — and the exemption is derived out of the
//       finished level (`analysis/reach.ts`'s `oceanRun`) rather than
//       taken on trust, because a `Level` carries no route to read it off.
//       The angle does not move with the speed class: a class stretches
//       R4's spacing by k and R23's radius by k², so the turn a gate asks
//       for comes out GENTLER at a faster pace without anything scaling it.
//
//   R35 A TRICKS RUN IS A LINE OF RAMPS, AND NO RINGS. A level built for a
//       tricks run carries a TRICK FIELD as well as its course: ramps laid
//       down the racing line every `trickStride` metres, each one a deck of
//       the vocabulary R8 draws and NONE of them a gate. No ring stands
//       over a trick ramp — a ring is a checkpoint, and a run with no
//       course to count has nothing to check — so what the rider meets is
//       the lip and the air off it, and the whole of what the ramp is for
//       is the score. The stride is the ONE number the field has and it is
//       measured rather than chosen: the distance the catalog's most
//       road-hungry hull needs to reach `TRICK_SHARE` of its own top speed
//       from a standing start (`runUpTo`), plus the deck it climbs and the
//       clear water R7 gives it to come down in. Every lip is therefore
//       ridden at a pace worth leaving the water at — the failure the rule
//       exists to prevent is a shore of ramps a rider dribbles over — and
//       it is calibrated on the WORST craft rather than per craft so that
//       one seed is one field: a tricks score is compared across the roster
//       (which is why `classFor` pins the run to stock too), and a field
//       that grew with the hull would make the hull the score.
//
//   R36 THE SEA IS A DIAL, AND IT IS NOT THE WIND'S. A level is dealt a
//       GROUNDSWELL as well as a wind: the sea that came in off the open
//       ocean, grown by weather a thousand kilometres away and standing off
//       this coast whatever the wind on the coast is doing. Its significant
//       height OUT THERE is a number in `SWELL_DIAL` — one metre to twenty —
//       and a run may be dealt any of it, which makes it the third thing a
//       difficulty ladder may move in the LEVEL beside R32's class and R33's
//       deck. Left to the seed it is DRAWN, log-uniformly over the band and
//       squared toward its floor so that the ordinary day is ordinary: two
//       metres off the median shore, more than ten off about one shore in
//       eight, and the top of the band about one in fifty. How much of it
//       ARRIVES is the coast's own share of the ocean (`Biome.sea.swell`) —
//       a skerry coast has the islands between it and the weather, so it
//       rides less of the same sea than a low open one — and then how much
//       of the open sea the point itself can see STRAIGHT OUT
//       (`seaExposure`): the same fan the wind sea's fetch is measured over,
//       aimed dead onshore rather than up the wind, because a sea grown a
//       thousand kilometres away is cut by the land in front of it and by
//       nothing today's wind is doing. Turn the wind off the coast and the
//       sea the wind grew goes flat; this one stands where it stood. The
//       draw is the LAST thing the seeded stream does, so a shore dealt a
//       big sea is the same shore it would have been under a small one — the
//       swell changes the water over a level, never the level under it, and
//       nothing the search judged can move for it. A height ASKED for rather
//       than dealt is the run's own statement and is carried as one
//       (`Level.swellAsked`), because one thing turns on the difference: a
//       wind of zero is how this engine spells a FLAT CALM — the water every
//       physics test stands its hull still on — and it takes the swell the
//       COAST was dealt away with it. The swell a RIDER asked for is the
//       whole of what the dial is for, so it stands in that calm: a glassy
//       morning with twenty metres rolling under it is a level asked for
//       twenty metres, not a wind doing something it cannot. And it is a
//       BASELINE rather than a ceiling: the open ocean past the rim still
//       builds on it, adding its own storm in energy the way two seas
//       standing in the same water do, so riding out grows the sea whatever
//       the coast was dealt.
//   R37 THE SEA FREEZES, AND AN ICEBREAKER OPENS THE COURSE. A coast that
//       freezes (`Biome.freezes`) carries an ICE FIELD as well as its
//       ground — metres inside the sheet at every cell, negative in open
//       water (`Level.ice`) — and in the coast's WINTER the sea under that
//       field is a sheet of ice: level ice `ICE.thickness` thick, standing
//       `ICE.freeboard` over the water, from the shore out past the rim of
//       the level to the horizon. The one open water on it is the CHANNEL
//       an icebreaker has cut down the racing line: `ICE.channel` either
//       side of the course's own path, a turning basin `ICE.basin` across
//       at the start and the finish, and `ICE.brash` of broken rubble
//       sloping down from the sheet's edge into it. The field is laid off
//       the FINISHED course — after the search has accepted the level and
//       from nothing the seeded stream draws — so a coast that freezes is
//       the same shore in every season and no seed re-rolls for the sheet
//       existing; and it is read at RUN time against the season the run is
//       ridden in, which is what lets a run ask for the winter on a shore
//       dealt the summer (`createGame`'s `season`) and get the ice with it.
//       The sheet is GROUND to the hull (`bedAt`): a rider who leaves the
//       channel rides up the brash onto it and grounds, which is the whole
//       of what keeps a winter run in the channel. The sea inside a lead
//       fifty metres wide is chop and nothing more, and no groundswell
//       survives a few kilometres of pack: `createSea` lays the wind bands
//       at `TUNING.sea.ice.wind` of their height and the swell at
//       `TUNING.sea.ice.swell` of its, so the water in the channel lies
//       under the sheet's freeboard and the ice never has a wave through
//       it. Nothing else about the level moves: the gates, the rocks and
//       the bed are the summer's, and the analysis scores the shore the
//       ice lies on rather than the ice.
//
// Split out of `rules.ts` for the §20.5 cap, and along the seam that was
// already there: that file says what the rules ARE, this one says what
// they become at a pace and under a run's own dials.

import { CRAFT, craftAtClass } from "../game/defs/craft.ts";
import { runUpTo } from "../game/limits.ts";
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
 * `rampWidth` is R33's dial and the one number here that is NOT about the
 * class: the deck's width, times whatever a difficulty setting dealt this
 * run. It rides in this function because it is the same kind of thing — a
 * per-run transform of the one rule book, applied once so that the two
 * course layers, R6's keep-out, R9's run-up corridor and the analysis all
 * read a single number instead of four agreeing about it.
 *
 * Memoised per class and dial: the generator asks for it once a level, the
 * analyzer once a report, and the table is a dozen objects. */
const PACED = new Map<string, PacedRules>();

export function rulesAtPace(pace: number, rampWidth = 1): PacedRules {
  const k = Math.max(0.1, pace);
  const w = clampDial(rampWidth);
  if (k === 1 && w === 1) return LEVEL_RULES;
  const key = `${k}|${w}`;
  const held = PACED.get(key);
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
    // R33's dial is applied to the WIDTH alone; everything else in this
    // group is R32's business.
    ramp: { ...R.ramp, runUp: R.ramp.runUp * k, lead: band(R.ramp.lead), width: R.ramp.width * w },
    air: { ...R.air, landing: R.air.landing * k },
  };
  PACED.set(key, paced);
  return paced;
}

/** R34 — the most a GATE may ask of the rider, rad between the leg in to
 * it and the leg out of it. Seventy degrees, which is what the line
 * actually delivers once `route.swing` keeps it off R23's limit — 47° on
 * the median level and 68° on the worst of eighty — so the rule refuses
 * the tail rather than the population, and a tuning pass that puts the
 * kinks back has to argue with a failing check rather than with nobody.
 *
 * Stated here rather than in `rules.ts` for R33's reason: that file is at
 * the §20.5 cap, and a rule whose prose cannot live beside its number is
 * worse off split across two files than moved whole into one. */
export const GATE_CORNER = 1.22;

/** R33 — THE RAMP DIAL'S BAND: the multiples of `ramp.width` a run may be
 * dealt. Stated here rather than in `rules.ts` because R33 is stated here
 * and because that file is at the §20.5 cap. The floor is the four-metre
 * deck R8 drew until the width was doubled, and the ceiling is twice the
 * one it draws now; past either end the ramp stops being the thing the
 * assist, the bot and the analysis were argued against. */
export const RAMP_DIAL = { min: 0.5, max: 2 } as const;

/** R33 — a dealt `rampWidth` held inside that band. Exported because the
 * generator clamps the option before it puts the result on the `Level`,
 * and a level carrying a dial this function would have narrowed is a level
 * the analyzer scores against a book nothing built it to. */
export function clampDial(rampWidth: number): number {
  return Math.min(Math.max(rampWidth, RAMP_DIAL.min), RAMP_DIAL.max);
}

/** R36 — THE SEA'S OWN BAND: the significant heights, m, a level's
 * groundswell may be dealt or asked for. The floor is a metre, which is the
 * smallest sea that still reads as a swell from a chase camera rather than
 * as flat water; the ceiling is twenty, which is the WMO's phenomenal sea
 * and about as much as a hull this size can be ridden over at all. Stated
 * here rather than in `rules.ts` for R33's and R34's reason: that file is
 * at the §20.5 cap.
 *
 * Its SHAPE — how steep the swell is quoted at, how narrow a band it is
 * laid over, how far off the wind it comes in — is `TUNING.sea.swell`,
 * where every other number about a swell is. This is the one thing about it
 * a LEVEL carries, because it is the one thing that is the coast's rather
 * than the model's. */
export const SWELL_DIAL = { min: 1, max: 20 } as const;

/** R36 — a swell height held inside that band. Exported for `clampDial`'s
 * reason: the generator clamps what it was asked for before it puts the
 * result on the `Level`, so the height the level carries is the height its
 * sea was actually built at. */
export function clampSwell(hs: number): number {
  return Math.min(Math.max(hs, SWELL_DIAL.min), SWELL_DIAL.max);
}

/** R36 — THE SWELL A SEED IS DEALT, m, off one uniform draw `u` in 0..1.
 *
 * LOG-UNIFORM over the band, because the band spans a factor of twenty and
 * a straight draw over it would make the median day a ten-metre sea — the
 * question "how big is it out there today" is answered in doublings, not in
 * metres. SQUARED toward the floor on top of that, because even a
 * log-uniform draw puts the median at four and a half metres, which is a
 * heavy sea every other ride. What comes out is the ordinary day being
 * ordinary: a two-metre swell off the median shore, a sea over ten metres
 * off about one shore in eight, and the top of the band about one in fifty
 * — and how much of any of it ARRIVES is then the coast's own
 * (`Biome.sea.swell`, applied by `createSea` where every other thing a
 * coast does to its water is). */
export function dealSwell(u: number): number {
  const shape = Math.min(Math.max(u, 0), 1) ** 2;
  return clampSwell(SWELL_DIAL.min * (SWELL_DIAL.max / SWELL_DIAL.min) ** shape);
}

/** R37 — THE ICE: what a frozen coast's sheet is, and the channel cut
 * through it. Stated here rather than in `rules.ts` for R33's and R34's
 * reason: that file is at the §20.5 cap.
 *
 * `thickness` is level first-year ice at the end of a polar winter — two
 * metres — and `freeboard` is what stands over the water: a tenth of the
 * thickness by the density of ice against sea water, plus the snow on it.
 * `channel` is the HALF-width of the water an icebreaker leaves: a big
 * icebreaker is twenty-five metres in the beam and the brash channel behind
 * it is about twice that, which is also wide enough that R8's decks and the
 * slalom marks at their standoff stand in open water. `basin` is the round
 * pool cut at either end of the line, where the ship turned; `brash` is the
 * band of broken ice at the sheet's edge, sloping down into the channel,
 * and it is what a hull that leaves the channel rides up. `season` is the
 * one the sheet stands in — the coast's own winter (`Biome.declination`
 * dates it to the weeks the sun is back over the ice). */
export const ICE = {
  season: "winter",
  thickness: 2,
  freeboard: 0.35,
  channel: 26,
  basin: 80,
  brash: 6,
  /** How far past the channel's edge the field still measures, m; every
   * cell further under the sheet than this reads exactly this. */
  measured: 60,
} as const;

/** R35 — the share of its own top speed a rider is to arrive at every lip
 * at: the PRACTICAL top speed, as opposed to the asymptote the catalog
 * documents. Ninety-five per cent, because the last few are a hull sitting
 * on its own drag — a runabout spends as long going from 95 to 99 as it
 * spent reaching 95 — and a field spaced for the asymptote is a field of
 * long empty straights with a ramp at the end of each.
 *
 * Stated here rather than in `rules.ts` for R33's and R34's reason: that
 * file is at the §20.5 cap. */
export const TRICK_SHARE = 0.95;

/** R35 — HOW FAR APART A TRICKS RUN'S RAMPS STAND, m from one hinge to the
 * next, at the speed class `pace`.
 *
 * The whole of the rule: the longest run-up any hull in the catalog needs
 * to reach {@link TRICK_SHARE} of its top speed from rest, plus the deck it
 * then climbs and R7's landing past the lip. Taken over the roster rather
 * than off one craft — the field is the level's, not the rider's — and the
 * catalog's answer is not the one intuition gives: the DART is the slowest
 * craft and needs the least road (75 m), because a low top speed is reached
 * sooner; the MARLIN is the fastest and needs the most (153 m), so it is
 * the marlin the shore is laid out for.
 *
 * Memoised per class for `rulesAtPace`'s reason — the generator asks once a
 * level and the analyzer once a report, and the answer is a loop over four
 * hulls. */
const STRIDE = new Map<number, number>();

export function trickStride(pace = 1): number {
  const k = Math.max(0.1, pace);
  const held = STRIDE.get(k);
  if (held !== undefined) return held;
  const R = rulesAtPace(k);
  let run = 0;
  for (const spec of CRAFT) run = Math.max(run, runUpTo(craftAtClass(spec, k), TRICK_SHARE));
  // The deck and the landing are the metres the rider is NOT accelerating
  // over, so they are added rather than counted against the run-up: the
  // stride is hinge to hinge and the run-up is the water before a hinge.
  const stride = run + R.ramp.length.max + R.air.landing;
  STRIDE.set(k, stride);
  return stride;
}
