// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BENCHMARK — one shore, the whole field, and a stopwatch.
//
// WHAT IT MEASURES, AND WHY IT IS A TIME. A frame rate is a number about a
// moment: it moves with where the craft happens to be, with what the sea is
// doing under it, and with whatever the machine was busy with while the
// average was being taken. Two of them from two machines are not comparable
// unless both were reading the same frame, which they never are.
//
// So this measures a FIXED AMOUNT OF WORK and reports how long the machine
// took to do it. The race is scripted — every rider on the water is the bot,
// off the engine's own seeded RNG, so the same crest is taken at the same
// instant on every machine and in every session — and the run is exactly
// `frames` rendered frames long. What varies is the clock: a fast machine is
// through the same race in less of it, and two numbers are two numbers about
// the same thing.
//
// WHAT IS REPORTED is that time divided back into the race's own length — an
// INDEX where 100 is real time (`benchmark-index.ts`). Same measurement, read
// the way a score is read: higher is better, and one machine over another is
// how many times faster it is.
//
// THE SIMULATION IS NOT WHAT IS BEING TIMED. Every rendered frame advances
// the game by exactly `step` seconds regardless of how long it took to draw,
// so the race is identical whether the machine manages sixty frames a second
// or six hundred. That is what makes the workload fixed; it is also why the
// render loop must NOT wait for anything. There is no frame gate here and no
// `requestAnimationFrame`: frames are pumped through a MessageChannel, which
// is the one scheduler a browser will re-enter as fast as the work comes
// back, so the machine draws at whatever rate it can actually manage.
//
// THE FENCE. WebGL commands are posted to the GPU and return immediately, so
// a loop that only submits them measures how fast this machine can TALK to
// its graphics card. Every frame therefore ends by reading one pixel back out
// of the drawing buffer, which cannot be answered until the frame is actually
// drawn — the renderer's own `drain()`, which exists for the first-visit
// probe and is the same question asked here. It costs a round trip per frame,
// a constant, and the alternative is a benchmark that never waits for the GPU
// at all.
//
// HOW TO READ THE LINE, and the one thing that makes it readable: THE
// WORKLOAD IS FIXED ACROSS RUNS BUT NOT FLAT ACROSS ONE. The race starts with
// twelve hulls inside a hundred metres of each other and ends with the field
// strung out down the coast, so the frame gets steadily cheaper as the run
// goes on. That is not a fault in the measurement — every machine draws the
// same thinning race, so the SCORE compares exactly — but it is the whole of
// how the rate line has to be read:
//
//   * a rate that RISES through the run is a machine holding its pace on a
//     scene that is thinning: the expected shape, and a healthy one;
//   * a rate that is FLAT is a machine losing exactly as much as the race is
//     giving back;
//   * a rate that FALLS is a machine getting slower faster than the race is
//     getting cheaper — which on a phone is nearly always the thermal
//     governor, and is the one reading worth acting on.
//
// THE WARM-UP, AND WHERE IT IS PAID FOR. The first frames of any run are the
// expensive ones: shaders compile, geometry and textures go up to the card,
// and the first of each kind of effect allocates its pool. That is a real
// cost and it is not what this is measuring, and it is also a WAIT — so it is
// paid for BEHIND THE LOADING CARD, as the last step of the load that stands
// the race up (`warmBenchmark`, wired into the load in `App.tsx`). The three
// lights are counted out frame by frame under the game's own loader, which is
// what a loader is for: a wait with the mark being laid over it and a bar
// counting it out.
//
// So the card lifts on a race that is already at green, and every frame this
// module draws is a frame it is timing.

import { TUNING, botInput, step, type GameState } from "@engine";

import { BENCHMARK } from "./benchmark-plan.ts";
import { SAMPLE_EVERY, benchIndex, type BenchSample } from "./benchmark-index.ts";
import type { FrameCost, SceneShare } from "./benchmark-report.ts";
import type { GameRenderer } from "./renderer.ts";

/** Engine steps per rendered frame. Exact by construction (see
 * `BenchmarkPlan.step`), so no accumulator is carried between frames and
 * nothing drifts. */
const STEPS_PER_FRAME = Math.max(1, Math.round(BENCHMARK.step / TUNING.dt));

// How often the card is told where the run is, in frames, is `SAMPLE_EVERY` —
// the reading and the report are the same event, because the card IS the
// graph of the readings.
//
// THAT REDRAW IS INSIDE THE CLOCK. Nothing here waits for the card, but the
// page has one thread and a hundred and twenty renders of a small SVG land
// between the frames being timed. A quarter of a second of game per reading
// is what keeps that honest: the card costs a fraction of a millisecond
// against the frames it sits over, which is a constant tax well under what
// two runs of the same build differ by anyway. A graph redrawn every frame
// would be a benchmark measuring its own instrument.

/** Where the benchmark is, and what it has to say about itself. */
export type BenchmarkStatus = {
  /** `running` is the measured stretch — every frame of it, because the
   * warm-up happened behind the loading card (`warmBenchmark`); `done` is
   * the answer. */
  phase: "running" | "done";
  /** Measured frames drawn so far, of `BENCHMARK.frames`. */
  frames: number;
  /** Wall clock since the lights went out, s — what is measured. */
  seconds: number;
  /** …and the same thing as THE NUMBER: the run so far on the scale where
   * 100 is real time (`benchmark-index.ts`). */
  index: number;
  /** Every reading taken so far, oldest first — the graph on the card is
   * this list and nothing else. A snapshot: the run keeps its own. */
  samples: BenchSample[];
  /** What each of those frames cost the renderer, same order — the half of
   * the report somebody optimising the game reads (`benchmark-report.ts`). */
  costs: FrameCost[];
  /** What was standing in the scene on the LAST frame, by subsystem. Taken
   * once, at the end: it is a walk of the whole graph. */
  scene: SceneShare[];
  /** Hulls that were actually on the water, the player's included. */
  craft: number;
  /** The drawing buffer the frames were drawn into, device pixels. A time
   * means nothing without it. */
  width: number;
  height: number;
};

/** The race, and what draws it. The same three for the warm-up and for the
 * measured run, because they are the same race: the frames drawn under the
 * loading card have to be the frames that come after it, or the warm-up has
 * warmed something else. */
export type BenchmarkRace = {
  /** The player's own run — ridden by the bot here, like every rival beside
   * it. The FIELD is inside it (`GameState.rivals`), stepped by the engine's
   * own `step`, which is why nothing here has to know a rival exists. */
  state: GameState;
  renderer: GameRenderer;
};

export type BenchmarkOpts = BenchmarkRace & {
  onStatus: (status: BenchmarkStatus) => void;
};

/** ONE FRAME OF THE RACE, drawn and waited for. The warm-up and the measured
 * run share it because they have to: a warm-up that stepped the water any
 * differently would be warming a different frame from the one about to be
 * timed.
 *
 * `observe` after every STEP and `render` once a FRAME, which is the app's own
 * order (`App.tsx`): the wake, the spray and the foam read the craft at the
 * step's cadence and are drawn at the frame's, so a benchmark that observed
 * once a frame would be measuring a thinner trail than the game leaves. */
function benchFrame(state: GameState, renderer: GameRenderer): void {
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    step(state, botInput(state));
    renderer.observe(state);
  }
  // THE FRAME'S TIME IS THE PLAN'S AND NOT THE CLOCK'S. `render`'s `dt` is
  // what the camera eases on, and handing it the wall time would ease the
  // lens at the rate the machine happens to be drawing — a slow machine would
  // frame the race differently from a fast one, which is the workload moving
  // with the thing being measured.
  renderer.render(state, BENCHMARK.step);
  // THE FENCE: one pixel back out of the buffer, which cannot be answered
  // until every draw behind it has landed.
  renderer.drain();
}

/** THE LIGHTS, IN FRAMES — the whole of the warm-up, and what its bar on the
 * loading card is drawn against. Read off the run's own rules rather than
 * stated: a longer countdown is a longer warm-up, and neither this nor the
 * card should have to be told twice. */
function warmFrames(state: GameState): number {
  return Math.max(1, Math.round(state.rules.countdown / BENCHMARK.step));
}

/** The warm-up, cut into slices a loading card can be drawn between. */
export type BenchmarkWarmup = {
  /** Draw warm-up frames while `budget` allows, and say whether there are
   * more to draw — the shape a load step is asked in (`run-loader.ts`). */
  run: (budget: () => boolean) => boolean;
  /** How far through the lights it is, 0–1, for the card's bar. */
  progress: () => number;
};

/** WARM THE MACHINE UP ON THE RACE IT IS ABOUT TO BE TIMED ON, behind the
 * loading card. Every frame here is a frame the measurement will not have to
 * pay for: the shaders compile, the geometry and the textures go up to the
 * card, and each kind of effect allocates its pool.
 *
 * It draws the THREE LIGHTS and nothing more — the last frame is the one GO
 * lands on — so what comes back is a race standing at green with a warm
 * machine behind it, which is exactly what `runBenchmark` wants handed to it.
 *
 * THE FENCE IS THE POINT OF DOING IT FRAME BY FRAME. Without it these frames
 * would only be POSTED to the graphics card, and the work would land in the
 * measured run behind them; with it every one is waited for, so the load is as
 * long as the warm-up really is and the card is over all of it. */
export function warmBenchmark({ state, renderer }: BenchmarkRace): BenchmarkWarmup {
  const frames = warmFrames(state);
  let drawn = 0;
  return {
    progress: () => Math.min(1, drawn / frames),
    run: (budget) => {
      do {
        benchFrame(state, renderer);
        drawn += 1;
      } while (state.phase === "countdown" && budget());
      return state.phase === "countdown";
    },
  };
}

/** Drive the measured run. THE RACE IS ALREADY AT GREEN when this is called —
 * `warmBenchmark` counted the lights out behind the loading card — so the
 * clock starts on the first frame and there is no untimed stretch here at
 * all. Returns the way to stop it early: the pump outlives any one frame, so
 * somebody who walks away from it has to be able to take it off the
 * machine. */
export function runBenchmark({ state, renderer, onStatus }: BenchmarkOpts): () => void {
  const channel = new MessageChannel();
  let stopped = false;
  /** Frames drawn, all of them measured. */
  let frames = 0;
  /** When the first of them started, ms on the page's clock; 0 until it
   * has. */
  let green = 0;
  let elapsed = 0;
  /** When the LAST frame ended, ms on the same clock — so a reading can
   * report the frame it was taken on and not just the run behind it. It is
   * the frame's own duration and nothing averaged in, which is what the
   * card's second line is (`benchmark-index.ts`).
   *
   * The card's redraw does not land inside it. A reading is reported at the
   * END of the frame it was taken on, so the Preact render is paid by the
   * NEXT frame — never by a frame that is itself about to be a reading, since
   * the readings are a whole cadence apart. */
  let framed = 0;
  /** The score, read every `SAMPLE_EVERY` measured frames. */
  const samples: BenchSample[] = [];
  /** …and what the frame it was read on cost the renderer. */
  const costs: FrameCost[] = [];
  let scene: SceneShare[] = [];

  const report = (phase: BenchmarkStatus["phase"]): void => {
    // THE BUFFER IS ASKED FOR EVERY TIME rather than captured at the green: a
    // window resized mid-run is a run whose workload changed, and a card
    // still billing the old size would be quietly lying about the one
    // condition a score cannot be read without.
    const size = renderer.bufferSize();
    onStatus({
      phase,
      frames,
      seconds: elapsed / 1000,
      index: benchIndex(frames * BENCHMARK.step, elapsed / 1000),
      samples: samples.slice(),
      costs: costs.slice(),
      scene,
      // The field plus the rider the card is standing over.
      craft: state.rivals.length + 1,
      width: size.w,
      height: size.h,
    });
  };

  const tick = (): void => {
    if (stopped) return;
    // Read BEFORE the frame it starts, not after: the first frame is one of
    // the measured ones and its own cost belongs inside the clock.
    if (green === 0) {
      green = performance.now();
      framed = green;
    }
    benchFrame(state, renderer);
    const now = performance.now();
    frames += 1;
    elapsed = now - green;
    /** This frame alone, as a rate. */
    const fps = now > framed ? 1000 / (now - framed) : 0;
    framed = now;
    const finished = frames >= BENCHMARK.frames;
    // The last frame is a reading whatever it lands on, so the line's end IS
    // the answer on the card rather than a point short of it. It happens to
    // land on the cadence too — but a run length that stopped dividing by it
    // would otherwise draw a graph that never quite reaches its own score.
    if (finished || frames % SAMPLE_EVERY === 0) {
      samples.push({
        frame: frames,
        index: benchIndex(frames * BENCHMARK.step, elapsed / 1000),
        fps,
      });
      costs.push({ ...renderer.cost() });
    }
    if (finished) {
      stopped = true;
      // The graph is walked ONCE, here, on the last frame that was drawn, so
      // what it reports is the scene the run was actually measured against.
      scene = renderer.sceneTally();
      report("done");
      return;
    }
    if (frames % SAMPLE_EVERY === 0) report("running");
    channel.port2.postMessage(0);
  };

  channel.port1.onmessage = tick;
  // The card is alive from before the first frame, with an empty graph on it:
  // there is no score until there are readings, and a run that put nothing on
  // screen until the first one would open on a race with nothing over it.
  report("running");
  channel.port2.postMessage(0);
  return (): void => {
    stopped = true;
    channel.port1.onmessage = null;
  };
}
