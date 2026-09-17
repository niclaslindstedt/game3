// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SCORE — the block of `TUNING` that answers to `tricks.ts`: what the
// air, the ground a flight covered, the revolutions, the crest ride and the
// laydown are worth, and the combo they ride on. It lives beside
// `tuning.ts` the way the sea, the wash and the flight do — that file is at
// the §20.5 cap — and `tuning.ts` folds it in as `TUNING.tricks`, which is
// how the whole repo spells it; nothing reads this module directly.
//
// Every number in here is an ARCADE DIAL. None is measured against anything
// in the world, with one exception that says so where it stands
// (`lengthKnee`, the metres an ordinary ramp carries a rider, which is a
// measurement because it is what ties the two halves of a jump together).
// What the rest are chosen against is the LADDER they make between one
// flight and the next, and the doc comment below is that ladder.

/** THE SCORE (`tricks.ts`) — the arcade dials behind the other game on
 * the same water. Arcade numbers to a man: none of them is measured
 * against anything, and what they are chosen against is the LADDER they
 * make between one flight and the next. Read them together with the
 * runs they buy — every jump here quoted at the reference speed
 * `lengthKnee / airKnee`, where its seconds and its metres are worth the
 * same and its base is twice what the clock alone would pay —
 *
 *   a 1 s jump                        80 × 1  =      80
 *   a 2 s jump                       344 × 1  =     344
 *   a 2 s jump with a backflip       644 × 3  =   1 932
 *   a 2 s jump with a barrel roll    644 × 3  =   1 932
 *   a 2 s jump with both           1 244 × 5  =   6 220
 *   a 4 s double backflip          2 038 × 5  =  10 190
 *   a 4 s flip and a double roll   2 338 × 6  =  14 028
 *   20 s taken by the tornado      6 325 × 1  =   6 325
 *   3 s held on the top of a wave    220 × 2  =     440
 *   a laydown and a laydown          300 × 3  =     900
 *
 * — which is the shape the whole thing is for: a rider who goes for the
 * hard one off the same wave is paid several times over, the two axes are
 * worth the same so that CHAINING them beats repeating either, and the
 * sea's own biggest moment still stands with the tricks rather than over
 * them. Note what the jump with no trick in it is worth: 344, and not
 * twice that again — the air's own rung is only ever sold beside a trick,
 * so the multiplier keeps meaning "he turned something". Note too what
 * the TORNADO's twenty seconds are not worth: a hull taken up a column
 * goes UP rather than along, so almost none of that row is metres, and
 * the two halves telling that apart from a jump that went somewhere is
 * the whole reason there are two. The two moments that never leave the
 * water sit at the bottom of the ladder on purpose: they are what a
 * rider strings the flights TOGETHER with, and a crest hold worth as
 * much as a flip would be a rider who never jumps. */
export const TRICKS = {
  /** What a second of air is worth one `airKnee` into a flight, points/s.
   * The rate rises as `log2(1 + t/airKnee)` from there, so the purse over
   * a whole flight grows rather faster than the flight does
   * (`airPointsPerSecond`). */
  airRate: 100,
  /** The flight, s, the rate is quoted at — and the unit the curve above
   * it is drawn in. One second: the shortest jump a rider reads as a
   * jump rather than as a wave, which is where an ordinary ramp puts
   * him and where the ladder ought to start meaning something. */
  airKnee: 1,
  /** HOW FAR THE FLIGHT CARRIED HIM, m, the length curve is quoted at —
   * `airKnee`'s twin on the other axis of the same jump, and the ONE
   * number the whole by-the-metre half is drawn from
   * (`lengthPointsPerMetre` states the rate off it, so there is no
   * `lengthRate` to drift out of step with `airRate`).
   *
   * It is the metres an ordinary ramp carries a rider in the air's own
   * knee, which makes it a SPEED: 17.5 m in 1 s. Measured over the four
   * campaign tricks shores with the bot on all four hulls — 302 flights
   * that counted, 4 844 m over 278 s = 17.4 m/s, the four shores between
   * 16.4 and 18.0 and the roster between 15.1 (the dart) and 19.3 (the
   * marlin) — so one figure covers the coasts and the catalog alike.
   *
   * Tying the two curves at that speed is what makes them WEIGH the same:
   * a flight carrying the rider at exactly this speed is paid the same by
   * the metre as by the second, so an ordinary jump earns twice an
   * ordinary jump's air and a rider who carries speed off the lip is paid
   * for the half he used to get for nothing. Above it the length wins,
   * below it the air does — which is the whole reason for having two. */
  lengthKnee: 17.5,
  /** What the FIRST revolution of a flight adds to the combo's base,
   * points; the Nth adds N times it, alongside N steps of multiplier.
   * Three hundred is the purse of a 2.8-second flight's AIR (the curve
   * above integrated: 174 points for two seconds, 354 for three, 571 for
   * four), which is what a flip should be worth against the flight that
   * carried it: a good jump's worth on its own, and not so much more that
   * the air stops counting. Left where it is now the length is paid too,
   * so a revolution is a smaller share of a typical combo's base than it
   * was — 47 % of a 2 s flight with a flip in it rather than 63 %. That
   * is the trade the length was added to make: a flip taken off a jump
   * that went nowhere is worth exactly what it always was, and what has
   * changed is that the jump under it is worth having been a jump. */
  flipPoints: 300,
  /** ...and what a revolution about the hull's own LENGTH is worth — the
   * side spin (`TUNING.flight.whip`), on the same index-rising ladder.
   * The same figure as the flip's, because the two are the same
   * commitment asked of the same rider on two axes: the roll is the
   * easier one to START (the inertia is a quarter) and the harder one to
   * hold together, since the hull has to come back the right way up for
   * a landing the flip would have put it level for. Naming them equal is
   * also what makes the two worth CHAINING — a rider who could get more
   * by flipping twice would never roll. */
  rollPoints: 300,
  /** How long the rider has on the water, s, to start the next trick
   * before the combo closes and banks. A second: long enough to come off
   * one wave and up the next, short enough that a combo cannot be held
   * open by riding along. */
  linkWindow: 1,
  /** THE AIR ITSELF AS AN ELEMENT: how long a flight has to last, s, for
   * the air to count as one of the things the combo is MADE of and buy a
   * step of multiplier of its own. The same line the air starts being
   * PAID at (`flight.airCounts`), and stated here as well because they
   * are two different claims about the same half-second and only one of
   * them is the physics': that line is "this was a jump and not a wave",
   * this one is "a jump is worth naming".
   *
   * The step is only ever credited once a TRICK has landed beside it
   * (`tricks.ts`). That is the whole rule: a plain jump is a plain jump
   * and multiplies nothing, and the moment a rider turns something in it
   * the air he turned it in is worth a rung as well. */
  airElement: 0.5,
  /** ...AND THE WATER AS ONE: how long a spell under the surface has to
   * last, s, for surfacing from it under the rider to be the SUBMARINE
   * and buy a step of multiplier (`tricks.ts`, rule 5). A second rather
   * than the air's half: the seconds are paid from `submerged.counts`
   * like the air's are, but the element is credited on its own where
   * the air's is not, so the bar for NAMING it stands a little higher —
   * a bow that went under a wave and popped straight back out is a
   * wave, and a hull held under for a second was held there. */
  diveElement: 1,
  /** THE CORKSCREW — a flip and a side spin turned in the SAME flight,
   * credited as a third element beside the two revolutions themselves
   * (`tricks.ts`): this much base and one step of multiplier.
   *
   * The two axes are already paid apart, so what this prices is the
   * COMBINATION. A rider who takes his flip off one wave and his roll off
   * the next has done two tricks; a rider who takes them out of one wave
   * has done the thing neither of them is. A first revolution's own
   * figure, which puts a 2 s corked flight at about 5 400 against the
   * 3 100 the same two turns pay apart — and under the 7 300 of a 4 s
   * double backflip, which is the order the two belong in. */
  corkscrewPoints: 300,
  /** THE CREST RIDE — the hull held at the top of a wave and run ALONG
   * it, the one thing worth points that never leaves the water. Paid by
   * the second on the air's own curve off a lower rate
   * (`wavePointsPerSecond`), because riding a crest is a longer moment
   * than a flight and a quieter one: a 3 s hold is worth about 220 where
   * three seconds of air pays 350. */
  waveRate: 60,
  /** The hold, s, that rate is quoted at — the air's knee, for the air's
   * reason: it is the unit the curve above it is drawn in. */
  waveKnee: 1,
  /** THE SMALLEST WAVE WORTH RIDING, m crest to trough (`waveUnder`). A
   * metre: under it the hull is crossing chop rather than standing on
   * anything, and a rate that paid for chop would tick all the way
   * through a head sea. */
  waveHeight: 1,
  /** ...and HOW FAR UP IT the hull has to be — the share of the wave's
   * own height, 0 at the trough and 1 at the crest. Nine tenths is the
   * top of it and nothing else: a hull crossing a sea at random sits
   * there about a fifth of the time and cannot HOLD it, which is the
   * whole difference between being carried over a crest and riding one.
   *
   * Once it IS held the share may fall back to `waveHold` before the ride
   * is over. The band needs some depth in it or a hull hunting either
   * side of one line would win a fresh ride every other step. */
  waveCrest: 0.9,
  waveHold: 0.8,
  /** How long the crest has to be held, s, before it is an ELEMENT of the
   * combo and buys a step of multiplier. A second, measured from both
   * ends: what a rider who is NOT trying gets handed (the bot holds a
   * fifth of a second at a time and tops out near 1.1 s on a four-metre
   * sea), and what running along a crest on purpose buys (three to five
   * seconds). Earned by riding, and never by luck. */
  waveElement: 1,
  /** How many samples the wave under the hull is read with, across one
   * peak period (`waveUnder`). Nine: the crest-to-trough it returns is
   * within a couple of centimetres of what thirty-three give, and it is
   * asked once a step for every rider on the water. */
  waveSamples: 9,
  /** THE LAYDOWN — the hull laid over on its side and brought back up,
   * the one trick a rider can turn without leaving the water or finding a
   * wave to do it on. Worth less than a revolution because it is: the
   * hull never passes its own beam ends and the rider never leaves the
   * deck. */
  laydownPoints: 150,
  /** How far over, rad, the hull has to go for it to be one — and how
   * level it has to come back before it is finished. Forty-five degrees
   * is past anything a carve on flat water reaches (a hull at full lock
   * at 20 m/s settles around twenty-two), so it is a lean thrown against
   * a wave face or against the hull's own roll, and it stands close
   * enough to going over that the ones which do not come back are
   * capsizes. */
  laydownAngle: Math.PI / 4,
  laydownLevel: 0.26,
  /** ...and how far over is TOO far: past this the hull is on its beam
   * ends, and what comes back from there is a capsize saved rather than a
   * trick turned. */
  laydownOver: 1.4,
  /** HOW MUCH WAY A TRICK ON THE WATER NEEDS, m/s — the crest ride's and
   * the laydown's alike, stated once because it is one idea. A hull
   * bobbing in a swell sits at the top of one for a second and a half and
   * rolls forty-five degrees doing it; what separates riding from
   * floating is that the rider is going somewhere. Six metres a second is
   * a rider under way and nothing more than that. */
  riding: 6,
} as const;
