// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE BENCHMARK RUNS — the plan, as data.
//
// Its own module because it is a TABLE and the thing that reads it is a
// render loop: `benchmark.ts` reaches for a canvas and a WebGL context, and
// this has to be readable without either — by the card that reports a run
// (`menu-bench.tsx`), by the app that stands the race up (`App.tsx`), and
// above all by the tests, which run on plain Node with no DOM in their type
// graph and which are where the choices below are actually held to
// something.
//
// Every field here is PINNED rather than read off the rider, and each one
// says why in its own comment. The one thing deliberately left alone is
// OPTIONS ▸ VIDEO: the whole use of the tool is running it twice with one
// row moved, so the rows have to be free — which in turn is what obliges the
// shore, the sky and the sea below to be a shore, a sky and a sea where every
// row can actually show.

import type { BiomeId, CraftId, GameMode, Season, Weather } from "@engine";

import type { CameraMode } from "./camera.ts";

/** WHAT THE BENCHMARK RUNS. Every one of these is pinned rather than read off
 * the rider's own settings: a measurement that moved with whichever craft
 * somebody last rode, or whichever coast they prefer, would be a number that
 * only compares to itself. */
export type BenchmarkPlan = {
  /** THE SHORE. The seed the game ships with (`DEFAULT_SEED`) — on every
   * install, in every doc, and the one every lab in the tree defaults to —
   * so a score off this build is a score off a shore anybody can stand on
   * and look at. */
  seed: number;
  /** THE COAST, and it is chosen rather than convenient: it has to be one
   * where every row of OPTIONS ▸ VIDEO can move the number, or the tool
   * cannot answer the question anybody runs it to ask.
   *
   * The two coasts are a wash on what they SUBMIT — metered headlessly at
   * 1280×720 with the whole field on the water, the same seed and the same
   * sky, the taiga draws 184 calls and 604 904 triangles against the
   * mangrove's 182 and 611 768, which is one percent and not a reason.
   *
   * The reason is the WATER. The see-through window reaches as far into the
   * sea as that coast's own `clarity` (`water-optics.ts`) and no further, and
   * the two coasts are 24 m and 9 m — the mangrove's clear turquoise against
   * the taiga's grey-green brackish. Everything drawn under the surface is
   * drawn inside that radius, so on the taiga the SEE-THROUGH row is nearly
   * a no-op and on the mangrove it is a real slice of the frame. A row the
   * benchmark cannot report on is a row the benchmark was built for. */
  biome: BiomeId;
  /** THE MODE, and it is the RACE for the reason the whole plan exists: this
   * is the heaviest thing the game does, by a distance, and the heaviness is
   * not the picture's. Twelve hulls on the water is twelve craft and twelve
   * riders drawn, and — the part no screenshot shows — TWELVE WHOLE RUNS
   * STEPPED at 120 Hz, each with its own hull in its own water, each ridden
   * by the bot deciding on every step (`rivals.ts`). Against the same shore
   * under the same sky, three runs of each (the counts came back identical
   * every time; the processor figure is the median of the three, and its
   * spread was about 4 ms):
   *
   *   time trial  138 calls   578 718 tris   25.3 ms of processor a frame
   *   race        182 calls   611 768 tris   39.1 ms
   *
   * Fourteen milliseconds a frame, half as much again, for a third more draw
   * calls — and only six percent more triangles, which is the whole point:
   * most of what the field costs is not drawn at all. A benchmark that rode
   * alone would be reporting the renderer and calling it the game. */
  mode: GameMode;
  /** The craft it is ridden on, and its class. STOCK (class 1), because a
   * class derives a different hull (`craftAtClass`) and two runs have to be
   * two runs about the same race. */
  craft: CraftId;
  speedClass: number;
  /** The view it is drawn from. The rungs cost different amounts — the bow
   * draws the rider's own hands and little sea, the helicopter draws a
   * kilometre of coast — so the benchmark states one instead of inheriting
   * one. CHASE is what a rider actually rides, which is what makes the score
   * a statement about playing the game rather than about a camera nobody
   * uses. */
  camera: CameraMode;
  /** THE HOUR THE RUN STARTS ON, and it is pinned rather than dealt for the
   * same reason the coast is: a row of OPTIONS ▸ VIDEO that cannot move the
   * number is a row the tool cannot report on, and at night three of the six
   * are among them. The sea life is only drawn inside the see-through
   * window and there is nothing to see into a dark sea; the cover and the
   * shore go into the haze; the sky's sheets are unlit. A night run is a
   * cheaper frame that exercises less, and it would make DETAIL and
   * SEE-THROUGH read as free.
   *
   * So it is pinned in full daylight, mid-morning, with the sun high enough
   * to light the water's window and low enough to lay a real glint across
   * the sea. ONE MINUTE OF RIDING IS ONE HOUR OF SUN (`clock.ts`), so this
   * is the start of a band and not a point: the warm-up and the measured
   * thirty seconds carry it to about half past ten, which is the whole of it
   * in broad day with nothing crossed under the stopwatch.
   *
   * WHAT THIS DELIBERATELY DOES NOT COVER is the night and the rain — the
   * lamps, the stars and the sheet in the air. Both of them take more out of
   * the frame than they put in (a dark shore, a fog at two fifths of its
   * reach), so a benchmark ridden under either would be a benchmark of less
   * game. They are a second plan's, on the day somebody wants one. */
  hour: number;
  /** THE SKY. HIGH CLOUD: the deepest sheet the dome carries with a view
   * still open under it — `SKY_LOOKS.high` keeps 84–94 % of the weather's
   * own fog reach where rain keeps 40–62 % and a squall 30–50 %.
   *
   * Both halves of that matter. The sheets are what makes the DETAIL row
   * worth reading, because the sky is the steepest per-pixel lever the game
   * has and it is paid TWICE — once on every pixel of sky and again on every
   * pixel of sea, which reflects the same sheets. The open view is what
   * makes DISTANCE worth reading: under a squall the fog has closed before
   * the shore does, and the row would report that drawing more coast costs
   * nothing because none of it was visible. */
  weather: Weather;
  /** …and the SEASON, which decides the sun's arc and so how high the light
   * above actually stands at that hour on this latitude (R13). Summer, so the
   * pinned mid-morning is the broad daylight it is meant to be on a warm
   * coast rather than a low winter sun the hour happens to name. */
  season: Season;
  /** THE GROUNDSWELL, m (R36) — the sea standing off the coast, which the
   * wind does not imply and cannot ask for.
   *
   * Pinned HIGH, and not for the water's sake: the surface costs the same to
   * sum whatever height it is dealt. It is pinned high for what it does to
   * the RIDE. A flat sea is a field driving in a line; four metres of swell
   * throws twelve hulls off twelve crests at twelve different moments, and
   * every one of those is spray in the air, foam sown into the water, a wake
   * broken and a landing stamped into the map the shader reads. That is the
   * frame at its most expensive, and it is the frame the game is actually
   * played in. */
  swell: number;
  /** Seconds of game each rendered frame advances. A sixtieth divides the
   * engine's step exactly (`TUNING.physicsHz` is 120), so a frame is a whole
   * number of steps with nothing left over — the race is the same race every
   * time it is run. */
  step: number;
  /** Frames MEASURED, after the warm-up. Thirty seconds of racing at the step
   * above: long enough to cover the grid, the run to the first gate and a
   * real stretch of coast, short enough that the machine being measured is
   * not tied up for a minute. */
  frames: number;
};

export const BENCHMARK: BenchmarkPlan = {
  seed: 38,
  biome: "mangrove",
  mode: "race",
  craft: "skiff",
  speedClass: 1,
  camera: "chase",
  hour: 10,
  weather: "high",
  season: "summer",
  swell: 4,
  step: 1 / 60,
  frames: 1800,
};

/** How long the measured stretch is, s — the plan's own arithmetic, so the
 * developer page's row and the card's billing never disagree about it. */
export function benchmarkSeconds(plan: BenchmarkPlan = BENCHMARK): number {
  return plan.frames * plan.step;
}
