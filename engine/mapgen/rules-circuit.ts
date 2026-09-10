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
//   R29 THE OCEAN CIRCUIT: OUT FROM THE SHORE AND BACK. A level may be
//       drawn as a CIRCUIT rather than as a stretch of coast, and then the
//       race is a CLOSED LAP that begins at the beach, tracks the shore for
//       a stretch, turns out into the open sea, rounds what is standing out
//       there and comes back in to cross the line it started on. There is
//       NO RIVER on one: neither R26 nor R27 applies. R1's coastal band
//       gives way to the lap's own two ends — its most inshore station
//       stands `circuit.inshore` off the water's edge, its most seaward one
//       `circuit.reach` out past it, and `circuit.ashore` of the lap's
//       length is ridden inside R1's own ceiling, which is what makes the
//       shore leg a leg rather than a place the line touches once. The
//       shape is polar: a mean radius bulged toward the sea by
//       `circuit.bulge`, stretched ALONG the coast by `circuit.stretch` so
//       the inshore run is flat, and warped by `circuit.harmonics`
//       harmonics of `circuit.swing` for character. It holds R23's own
//       turning radius, keeps `circuit.selfClear` between the stretches of
//       itself that stand `circuit.selfSpan` apart along it, and turns
//       `circuit.turn` radians in all going round once — a plain circle
//       turns 2π and nothing else, so only a loop with counter bends in it
//       turns further.
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
//   R31 EVERY LAP IS RIDDEN ROUND LIT BUOYS. `circuit.mark.count` of the
//       loop's own bends carry a BUOY at the centre of the turn — a moored
//       steel can (`solids.buoy`) riding the swell with a lantern in a cage
//       over it — and at least one of them stands out past
//       `circuit.mark.ocean` from the shore, so every lap includes a run
//       out into the open sea to round something and back. A bend earns one
//       by turning at least `circuit.mark.wrap` radians about the buoy with
//       the buoy standing `circuit.mark.stand` off the line: nearer than
//       the band's floor there is no room for R6's berth, and further out
//       than its ceiling the rider passes a buoy on the horizon rather than
//       rounding one. Two buoys may not stand within `circuit.mark.apart`
//       of each other along the lap, because one bend measured twice is one
//       buoy.
//       EVERY ONE OF THEM FLASHES, and no two of them alike. A buoy carries
//       a light CHARACTER the way a chart quotes one — `light.flashes` of
//       them in a group, one group every `light.period` seconds, each buoy
//       on its own phase — and `buoyLightAt` is that character as a pure
//       function of the level's clock, so the lamp is never stepped, never
//       stored and replays exactly. What the light is FOR is the dark: a
//       lap ridden at dusk, at dawn or under the moon is read off the
//       buoys, and a rounding mark nobody can see at night is a rounding
//       mark that is not there.

/** R29, R30, R31 — the ocean circuit's own numbers. Every one carries its
 * unit; `LEVEL_RULES.circuit` is this table, and nothing reads it by any
 * other name. */
export const CIRCUIT_RULES = {
  /** R29 — HOW CLOSE THE LAP COMES TO THE BEACH, m: the distance the sea's
   * edge is cut back from the loop's most INSHORE station, so it is a floor
   * the whole line holds. Inside R1's own coastal band, because the shore
   * leg IS a coastal race — close enough that the beach, the boulder fields
   * and the erratics are the near scenery, far enough off that a wave
   * shoaling on the shallows is not breaking on the line. */
  inshore: { min: 24, max: 70 },
  /** R29 — …and HOW FAR OUT the lap's furthest station gets, m from the
   * water's edge. DERIVED — the loop's own seaward extent plus `inshore` —
   * so this is the band that result has to land in, and a shape too round
   * or too squat to get out there is redrawn. The floor is past
   * `sea.reach`: twenty-five metres of water under the hull is where a
   * swell stands its full height, and a lap that never reaches it is a
   * coastal race with a bulge, which is what R25 already builds. */
  reach: { min: 220, max: 900 },
  /** R29 — how much of the lap TRACKS THE SHORE: the share of its length
   * ridden inside R1's own ceiling (100 m). A band because a lap is wrong
   * at both ends of it — under the floor the line touches the coast at a
   * point and the shore leg is a corner, over the ceiling the race is a
   * coastal sprint that happens to close on itself. */
  ashore: { min: 0.12, max: 0.55 },
  /** R29 — how far the loop is STRETCHED along the coast, as a ratio of its
   * along-shore extent to its seaward one. Over 1 always: a round lap meets
   * the shore at one point, and it is the stretch that turns that point
   * into a run. The ceiling is where the two ends become hairpins joined by
   * two straights rather than a track. */
  stretch: { min: 1.3, max: 1.7 },
  /** R29 — how far the mean radius bulges TOWARD THE SEA, as a share of
   * itself: a first harmonic phase-locked to the sea's own heading, which
   * is what makes the shape a teardrop rather than an oval. The inshore
   * side comes out flat — the shore leg — and the seaward side runs out
   * into a nose the line goes round and comes back from. Well under a half,
   * where a limaçon grows a dimple and the line crosses itself. */
  bulge: { min: 0.16, max: 0.34 },
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
  /** R30 — one lap, m. The floor is what R29's own shape costs: a lap has
   * to hold a shore leg, a run out, a rounding and a run back, and under
   * this the four of them are one continuous corner. The ceiling keeps
   * three laps inside `length`. */
  lap: { min: 900, max: 1500 },
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
  length: { min: 1900, max: 3500 },
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
    /** How far off the line the buoy stands, m — the radius of the bend it
     * is the centre of. Under the floor there is no room for the buoy and
     * R6's berth inside the turn; over the ceiling the bend is so open that
     * the buoy is furniture on the infield rather than a thing the line
     * goes round. The floor is well under R25's rock mark's, because a
     * moored can is two metres across where a sea stack is thirty. */
    stand: { min: 34, max: 130 },
    /** R31 — how far out at least one of them has to stand, m from the
     * water's edge. This is the rule that makes a lap an OUT-AND-BACK: the
     * shore leg is a warm-up, and what it is a warm-up for is the run out
     * to this buoy. Inside `reach`'s floor by a bend's own radius, because
     * the buoy sits at the CENTRE of the turn that rounds it and the line
     * goes round outside it. */
    ocean: 150,
    /** How far apart two marks stand along the lap, m. One bend read as two
     * is one mark, and a lap's gates are 80–150 m apart, so two marks
     * inside a gate's spacing of each other are one corner. */
    apart: 150,
    /** R31 — THE CHARACTER a buoy's lamp flashes: how many flashes stand in
     * a group and how often the group comes round, s. A chart quotes a light
     * as `Fl(3) 8s` and this is that: the count tells one buoy from the next
     * at a glance, and the period is what a rider counts to be sure. The
     * period's floor is over `flashes.max` flash slots long, so the longest
     * group still has real darkness after it — a lamp with no dark in it is
     * not a flashing light, it is a lit one. */
    light: { flashes: { min: 1, max: 4 }, period: { min: 4.5, max: 9 } },
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
  /** R31, R17 — THE ROUNDING BUOY as the rock table states a kind: placed
   * by the LINE rather than by density (`perKm` is zero, as the mark's is),
   * and this row is what the finished buoy is held to. Spliced into
   * `LEVEL_RULES.solids` so `solidRule` finds it beside the rest.
   *
   * A real offshore lateral or cardinal buoy is 2–3 m across the can and
   * carries its light 3–5 m over the water — big enough to be a solid a
   * hull must go round, small enough that finding it is what the light is
   * for. `top` is the height of the LANTERN above the sea, because a buoy
   * floats: it rides the surface wherever the surface is, and nothing about
   * it is measured from the bed it is moored to. */
  buoy: {
    perKm: 0,
    offshore: { min: 20, max: 1200 },
    r: { min: 1.1, max: 1.7 },
    top: { min: 3.2, max: 4.6 },
  },
  /** How many loops are drawn before the whole attempt is given up on. A
   * loop is a few thousand steps of arithmetic and everything downstream of
   * it is a build, so a shape whose bends are too tight for R23 — or which
   * earned no marks — is redrawn here rather than paid for with a
   * sub-seed. */
  tries: 40,
} as const;
