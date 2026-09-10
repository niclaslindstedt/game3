// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RULE BOOK'S SECOND CHAPTER: the OCEAN CIRCUIT. `rules.ts` states the
// rules for a race laid along a stretch of coast; these three state the
// rules for the other kind of level this generator builds — a closed lap
// out in open water, ridden round several times.
//
// It is a chapter rather than a section of the first one because a circuit
// answers to different numbers at nearly every point: R1's coastal band,
// R10's sprint, R25's one run out to sea and R26's river are all replaced
// here, and stating the replacements beside the things they replace would
// leave a reader unable to tell which set a given level was built to. The
// two files are read as ONE rule book all the same — `LEVEL_RULES.circuit`
// is this table, `docs/level-generator.md` mirrors this prose exactly as it
// mirrors the first chapter's, and `tests/docs_rules_test.ts` holds both.
//
//   R29 THE OCEAN CIRCUIT. A level may be drawn as a CIRCUIT rather than as
//       a stretch of coast, and then the race is ridden OUT AT SEA: the
//       racing line is a CLOSED LOOP standing wholly in open water, every
//       metre of it at least `circuit.offshore` from the nearest shore,
//       with the coast a long way off on one side and NO RIVER anywhere:
//       neither R26 nor R27 applies to a circuit, and R1's coastal band
//       gives way to that floor. The loop is a radial walk about a centre
//       — a mean radius warped by `circuit.harmonics` harmonics of it, each
//       swinging it by `circuit.swing` of that radius — so it comes out
//       somewhat circular and never a circle. It holds R23's own turning
//       radius, keeps `circuit.selfClear` between the stretches of itself
//       that stand `circuit.selfSpan` apart along it, and turns
//       `circuit.turn` radians in all going round once, which is what makes
//       a lap a lap with corners in it rather than a ring road: a plain
//       circle turns 2π and nothing else, and only a loop with counter
//       bends in it turns further.
//   R30 THE CIRCUIT IS LAPPED. A circuit is ridden `circuit.laps` times
//       round. The gates are measured out ONCE round the loop at a spacing
//       inside R4's band that divides the lap EXACTLY, so the last gate of
//       a lap leads back into the first; the course is that lap repeated,
//       with one more crossing of the line at the end of it, and so the
//       FINISH LINE IS THE START LINE. What a lapped course publishes is
//       the whole ride — every gate of every lap, in the order they are
//       taken — because that is what is ridden, and `Course.laps` and
//       `Course.lapGates` say how to read it back as laps. R10's sprint
//       band gives way to `circuit.length`, which is the whole ride; R7's
//       air gates are counted over that whole ride, so one ramp a lap is
//       the whole of a circuit's air.
//   R31 EVERY LAP GOES ROUND SOMETHING. `circuit.marks` of the loop's own
//       bends carry a MARK at the centre of the turn — the same sea stack
//       R25's ocean leg rounds (`solids.mark`), twenty metres of rock out
//       of open water — so a lap is ridden round rocks rather than round
//       empty sea. A bend earns one by turning at least `circuit.mark.wrap`
//       radians about the rock with the rock standing `circuit.mark.stand`
//       off the line: nearer than the band's floor there is no room for R6's
//       berth, and further out than its ceiling the rider rides past a rock
//       on the horizon rather than round one. Two marks may not stand
//       within `circuit.mark.apart` of each other along the lap, because
//       one bend measured twice is one mark.

/** R29, R30, R31 — the ocean circuit's own numbers. Every one carries its
 * unit; `LEVEL_RULES.circuit` is this table, and nothing reads it by any
 * other name. */
export const CIRCUIT_RULES = {
  /** R29 — how far off the nearest shore the loop stands, m: the distance
   * the sea's edge is cut back from the loop's most INSHORE station, so
   * this is the floor the whole line holds and the coast is further still
   * from the far side of the loop. Past `sea.reach`, which is what makes
   * the water a circuit is ridden on the open sea's own: twenty-five metres
   * under the hull and the whole fetch of the coast upwind of it. */
  offshore: { min: 230, max: 430 },
  /** R29 — the shape: how many harmonics warp the mean radius, and how far
   * each of them may swing it as a share of that radius. The harmonic
   * NUMBERS are drawn from `harmonic` — two lobes is a peanut and six is a
   * cog, and both ends of that are shapes a hull cannot hold — and the
   * swings are what decide whether the loop has counter bends in it at all:
   * a harmonic k at swing a turns the curve concave where a·k² passes 1, so
   * the band's ceiling on the fastest harmonic allowed is what R29's own
   * `turn` is actually asking for. */
  harmonics: { min: 2, max: 3 },
  harmonic: { min: 2, max: 5 },
  swing: { min: 0.05, max: 0.15 },
  /** R29 — how near the loop may come back to itself, m, and how far apart
   * along it two stations have to stand for their closeness to count.
   * R24's numbers, for R24's reason: two stretches of line a rider cannot
   * tell apart are two stretches whose gates cross each other. Measured
   * BOTH ways round, because a loop's two stations are `selfSpan` apart
   * along it only if they are that far apart the short way. */
  selfClear: 85,
  selfSpan: 200,
  /** R29 — how far the line turns in all going round once, rad. A plain
   * circle turns exactly 2π (6.28) and a loop that only bulges turns 2π as
   * well, because every metre of it curves the same way; anything past that
   * is line that turned BACK, which is the counter bend a corner is made
   * of. The ceiling refuses a shape that spends its length wriggling: past
   * about two and a half turns of accumulated steering the lobes are
   * shorter than the hull's own turning circle and the loop reads as a cog
   * rather than as a track. */
  turn: { min: 7.2, max: 16 },
  /** R30 — one lap, m. The floor is what R23's turning radius makes of a
   * closed loop: a circle of 55 m radius is 345 m round, and a lap with
   * corners in it needs half as much again before its bends stop being one
   * continuous corner. The ceiling keeps three laps inside `length`. */
  lap: { min: 640, max: 1150 },
  /** R30 — how many times round. Two is a race with one chance to learn the
   * corners; four laps of the shortest loop in the band is the same six
   * gates ridden two dozen times, which is where a circuit stops being a
   * race and starts being a drill. */
  laps: { min: 2, max: 3 },
  /** R30 — the whole ride, m: every lap of it, the way R10 measures a
   * sprint. Wider than R10's band at both ends, because a circuit is
   * measured in whole laps and a lap is a coarse unit — the band has to
   * hold `laps.min` of the shortest loop and `laps.max` of nearly the
   * longest. */
  length: { min: 1400, max: 2900 },
  /** R30 — how many air gates one LAP carries. Exactly one, so that every
   * lap has the jump in it and R7's count over the whole ride (2–3) comes
   * out of the lap count rather than being drawn against it. */
  airPerLap: 1,
  /** R31 — the marks the lap is ridden round. */
  mark: {
    /** How many of them, and how many a loop must earn before it is a loop
     * worth racing. */
    count: { min: 2, max: 4 },
    /** How far the line has to swing ABOUT the rock for the bend to be a
     * rounding, rad. Under R25's own (2.1) because a circuit's bends are
     * the lobes of a closed loop rather than a half circle drawn round a
     * mark on purpose: a quarter turn and a half is a corner a rider takes
     * with the rock on the inside of it the whole way. */
    wrap: 1.5,
    /** How far off the line the rock stands, m — the radius of the bend it
     * is the centre of. Under the floor there is no room for the rock and
     * R6's berth inside the turn; over the ceiling the bend is so open that
     * the rock is scenery on the infield rather than a thing the line goes
     * round. */
    stand: { min: 42, max: 125 },
    /** How far apart two marks stand along the lap, m. One bend read as two
     * is one mark, and a lap's gates are 80–150 m apart, so two marks
     * inside a gate's spacing of each other are one corner. */
    apart: 150,
    /** How much of the line counts as being AT the rock, as a multiple of
     * the rock's own distance from it. What `roundingAbout` accumulates its
     * sweep over, and the reason the measure is scale-free: a rock 45 m off
     * the line is judged by the seventy metres of line around it and one
     * 120 m off by two hundred, which is the same corner seen at two
     * sizes. */
    near: 1.6,
  },
  /** R29 — THE COAST, which on a circuit is scenery rather than the race's
   * near side. How far the level reaches ALONG the shore either side of the
   * loop, m — enough that the coastline the rider sees runs the width of
   * the view rather than ending in the haze either side of the loop — and
   * how far the sea's own edge wanders in and out of that line (amplitude
   * m, period m), because a straight coast at two hundred metres reads as a
   * wall. The amplitude is inside `offshore`'s floor by construction: the
   * edge is cut back by the whole of it before the loop's own clearance is
   * measured. */
  coast: { run: 360, wander: { amplitude: 45, scale: 280 } },
  /** R29, R17 — the band the rocks that stand in OPEN WATER (the stacks,
   * the skerries, the reefs and the marks) are placed and checked in on a
   * circuit, m from the shore. Their coastal bands top out at 220 m, which
   * is inshore of every metre of a circuit's line: kept, they would leave
   * the whole sea the race is ridden in bare. The kinds that belong ON the
   * shore — the boulders at the waterline and the erratics straddling it —
   * keep their own bands and stand on the far coast where they belong. */
  rocks: { offshore: { min: 60, max: 1200 } },
  /** R15 — the share of a circuit's own box that is water. High at both
   * ends against a coastal level's, because a circuit IS mostly open sea:
   * what the band still refuses is a level with no coast in it at all, and
   * one whose land has grown over the sea the race needs. */
  waterShare: { min: 0.5, max: 0.94 },
  /** How many loops are drawn before the whole attempt is given up on. A
   * loop is a few thousand steps of arithmetic and everything downstream of
   * it is a build, so a shape whose bends are too tight for R23 — or which
   * earned no marks — is redrawn here rather than paid for with a
   * sub-seed. */
  tries: 40,
} as const;
