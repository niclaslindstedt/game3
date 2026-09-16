// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A LOAD IS ASKED TO STAND UP — and the one thing it stands up that is
// not a run.
//
// `run-loader.ts` is the SEQUENCING: it cuts a load into steps, spends a
// share of each frame on them and never learns what any of them does. This is
// the other half — what the steps ARE — and it lives beside `App.tsx` rather
// than inside it because there are two callers now and they are the same
// three steps:
//
//   A RUN builds the level the settings ask for and lifts onto the player's
//   hands (`new-game.ts`).
//   THE BENCHMARK builds a level nothing on any menu can ask for and lifts
//   onto a stopwatch (`benchmark.ts`).
//
// That they share the steps is the point rather than a saving: a benchmark
// whose shore was compiled by some other path, or whose scene was built by
// some other call, would be a benchmark of some other load. What separates
// them is a `LoadPlan` and nothing else.
//
// Both halves are FACTORIES over the app's own closures rather than modules
// that reach for them: the engine state a load adopts, the renderer it builds
// into and the surfaces it moves between are `App.tsx`'s, built once on mount
// and outliving every card.

import { createGame, error, type GameState } from "@engine";

import { BENCHMARK } from "./benchmark-plan.ts";
import { rememberBenchmark } from "./benchmark-history.ts";
import {
  runBenchmark,
  warmBenchmark,
  type BenchmarkStatus,
  type BenchmarkWarmup,
} from "./benchmark.ts";
import { benchmarkShore, plannedRows } from "./menu-bench.tsx";
import type { CameraMode } from "./camera.ts";
import type { MenuPage } from "./menu-main.tsx";
import { pictureRows } from "./picture-rows.ts";
import type { GameRenderer } from "./renderer.ts";
import {
  advanceLoad,
  createLoad,
  loadBudgetMs,
  loadPhase,
  loadTimes,
  type LoadJob,
  type LoadPhase,
  type LoadStep,
} from "./run-loader.ts";
import type { VideoSettings } from "./settings-video.ts";
import { STRINGS } from "./strings.ts";

/** One thing a load is asked to stand up. */
export type LoadPlan = {
  /** The run to stand up. THROWS on a seed the generator refuses, which is
   * what ends the load and puts the refusal on the card (`advanceLoad`) — a
   * run somebody asked for must never quietly fall back to another shore. */
  build: () => GameState;
  /** The rung the camera opens on. */
  camera: CameraMode;
  /** Anything that has to happen after the shaders are compiled and before
   * the card lifts — the benchmark's warm-up, and nothing else today. */
  after?: LoadStep[];
  /** Run on the frame the card lifts, in place of handing the water to the
   * player. */
  done: () => void;
};

export type LoadWorld = {
  renderer: GameRenderer;
  /** Take the run the first step built: it becomes the engine state the app
   * draws, and everything that belonged to the run before it — the news
   * column, the result plate, the beds, the motor — is cleared with it. */
  adopt: (state: GameState) => void;
  /** …and read it back, for the two steps that build the world off it. */
  current: () => GameState;
};

/** THE THREE STEPS EVERY LOAD IS MADE OF, plus whatever the plan adds after
 * them. Standing a shore up is the most expensive thing this game does and
 * almost none of it is the water — see `run-loader.ts` for why it is paid for
 * in slices at all. */
export function loadPlanSteps(world: LoadWorld, plan: LoadPlan): LoadStep[] {
  const { renderer } = world;
  let built: GameState | null = null;
  return [
    {
      id: "level",
      label: STRINGS.loadLevel,
      run: () => {
        built = plan.build();
        return false;
      },
    },
    {
      id: "scene",
      label: STRINGS.loadScene,
      run: () => {
        if (built) world.adopt(built);
        renderer.load(world.current());
        renderer.camera.setMode(plan.camera);
        renderer.camera.restand();
        return false;
      },
    },
    {
      id: "warm",
      label: STRINGS.loadWarm,
      // The first draw is where the driver compiles every shader in the
      // scene, and it is the one that would otherwise be paid for out of the
      // player's first second on the water.
      run: () => {
        renderer.render(world.current(), 0);
        return false;
      },
    },
    ...(plan.after ?? []),
  ];
}

/** A load in flight, and everything about one that is bookkeeping. `App.tsx`
 * keeps the frame loop and the surfaces; this keeps the job, what each step
 * cost last time, and what the card lifts onto. */
export type Loader = {
  /** Put a load up. Refused while one is already running — a second press on
   * RIDE must not throw away a shore that is half built. */
  begin: (plan: LoadPlan) => void;
  /** Spend this frame's slice of the load. `frameMs` is how long the frames
   * are actually coming, which is what the budget is a share of
   * (`loadBudgetMs`). */
  frame: (frameMs: number) => void;
  /** Take a load off that will not finish — the player pressing out of a
   * refused seed. */
  abandon: () => void;
  /** Whether a load is running. The first-visit probe asks, because its
   * frames must not be measured against a frame the generator is still
   * running underneath. */
  busy: () => boolean;
};

export function createLoader(
  world: LoadWorld,
  on: {
    /** Where the load has got to, every frame it is running. */
    phase: (phase: LoadPhase) => void;
    /** A load has just gone up. */
    start: () => void;
    /** …and one has just been ABANDONED: the generator refused the seed.
     * The card stays up and says so, and the engine state is untouched — the
     * sea the menu was over is still standing and still being ridden by the
     * bot, so there is a game to go back to. */
    failed: (why: string | null) => void;
  },
): Loader {
  let job: LoadJob | null = null;
  /** What each step cost last time on this machine, ms — the next card's
   * `expectedMs`. Kept in memory rather than stored: it is a fact about this
   * session's device under this session's load, and a figure carried over
   * from a visit when the tab was in the background would tell the card the
   * work takes half as long as it does. */
  let expected: Record<string, number> = {};
  /** What the load that is running now does when it finishes. Held here
   * rather than passed through `run-loader.ts`, which sequences steps and
   * deliberately never learns what any of them is for. */
  let loaded: () => void = () => {};

  return {
    begin: (plan) => {
      if (job) return;
      job = createLoad(loadPlanSteps(world, plan), expected);
      loaded = plan.done;
      on.failed(null);
      on.phase(loadPhase(job));
      on.start();
    },
    frame: (frameMs) => {
      if (!job) return;
      const until = performance.now() + loadBudgetMs(frameMs);
      const more = advanceLoad(
        job,
        () => performance.now() < until,
        () => performance.now(),
      );
      on.phase(loadPhase(job));
      if (job.failed !== null) {
        error(`the run could not be stood up: ${job.failed}`);
        on.failed(job.failed);
        job = null;
      } else if (!more) {
        expected = { ...expected, ...loadTimes(job) };
        job = null;
        // WHAT THE CARD LIFTS ONTO is the load's own business and not the
        // frame loop's: the player's hands for a run, a stopwatch for a
        // benchmark.
        loaded();
      }
    },
    abandon: () => {
      job = null;
      on.failed(null);
    },
    busy: () => job !== null,
  };
}

export type BenchmarkWorld = {
  renderer: GameRenderer;
  /** The engine state the load stood up — read after the card lifts, never
   * before: the benchmark's own race does not exist until the steps above
   * have made it. */
  current: () => GameState;
  /** Put a load up (`createLoader`). */
  begin: (plan: LoadPlan) => void;
  /** Lift the card onto a surface — the fade `App.tsx` owns. */
  lift: (shell: "run" | "bench") => void;
  /** Hush the beds. They are fed by frames the app's loop no longer draws
   * while a benchmark is up, and a bed that is merely not fed holds its last
   * note. */
  silence: () => void;
  /** Stand the RIDER's own run back up — what leaving a benchmark costs. */
  restand: () => void;
  /** The card is the status and the status is the card: non-null is the
   * `bench` surface being up (`shell.ts`). */
  setStatus: (status: BenchmarkStatus | null) => void;
  /** Where the front door opens once the canvas has been handed back. */
  toMenu: (page: MenuPage) => void;
  /** OPTIONS ▸ VIDEO as it stands — the one thing the benchmark does NOT
   * pin, read at the moment a run is written down. */
  video: () => VideoSettings;
};

/** THE BENCHMARK — the developer page's stopwatch (`benchmark.ts`).
 *
 * It is a RUN in every sense the engine and the renderer care about: the
 * pinned shore, the whole field, a bot at every set of bars including the
 * player's. What it is not is a run the APP is playing — nothing is recorded,
 * no HUD is drawn, no record is taken, and the frame loop hands the canvas
 * over for as long as it lasts, because the benchmark pumps its own frames as
 * fast as the machine will draw them and a frame drawn between two of those
 * is time the measurement is charged for and did not spend.
 *
 * Every dial is pinned in `benchmark-plan.ts` rather than read off the rider,
 * for the one reason the whole tool exists: two numbers have to be two
 * numbers about the same race. OPTIONS ▸ VIDEO is the deliberate exception —
 * finding out what a row costs is what running it twice is FOR — so the rows
 * are taken as they stand and written down beside the score.
 *
 * THE WARM-UP IS PART OF THE LOAD. The first frames of any run are the
 * expensive ones (shaders compiled, geometry uploaded, every effect's pool
 * allocated), and they are a WAIT like every other wait standing a run up
 * costs — so they go on the tail of the load, under the game's own card with
 * a bar counting them out. What the card lifts on is a race already at green,
 * and every frame the stopwatch then sees is a frame it is timing. */
export function createBenchmark(world: BenchmarkWorld): {
  start: () => void;
  leave: (page?: MenuPage) => void;
  /** Take the pump off the machine — called when the loop it was started
   * from is torn down. It outlives any one frame, and a channel nobody
   * stopped would keep drawing into a renderer that is about to go. */
  stop: () => void;
} {
  let stop: (() => void) | null = null;

  const start = (): void => {
    stop?.();
    stop = null;
    world.setStatus(null);
    let warm: BenchmarkWarmup | null = null;
    world.begin({
      build: () =>
        createGame({
          seed: BENCHMARK.seed,
          biome: BENCHMARK.biome,
          mode: BENCHMARK.mode,
          craft: BENCHMARK.craft,
          speedClass: BENCHMARK.speedClass,
          hour: BENCHMARK.hour,
          season: BENCHMARK.season,
          weather: BENCHMARK.weather,
          swell: BENCHMARK.swell,
        }),
      camera: BENCHMARK.camera,
      after: [
        {
          id: "grid",
          label: STRINGS.loadGrid,
          progress: () => warm?.progress() ?? 0,
          // Built on the first slice rather than with the step: the race it
          // warms is what the steps above have just made.
          run: (budget) => {
            warm ??= warmBenchmark({ state: world.current(), renderer: world.renderer });
            return warm.run(budget);
          },
        },
      ],
      done: () => {
        world.lift("bench");
        world.silence();
        stop = runBenchmark({
          state: world.current(),
          renderer: world.renderer,
          onStatus: (status) => {
            world.setStatus(status);
            // KEPT AT THE END, and here rather than on the card: a score is
            // only worth anything against a second one taken on the same
            // machine with a row of OPTIONS ▸ VIDEO moved, and by the time
            // that second run is set up the first card is gone. Writing it
            // down is an effect of the run finishing, which is a fact about
            // the app and not about the card that happens to draw it.
            if (status.phase !== "done") return;
            rememberBenchmark({
              at: Date.now(),
              index: status.index,
              shore: benchmarkShore(),
              craft: status.craft,
              width: status.width,
              height: status.height,
              pixelRatio: devicePixelRatio,
              picture: pictureRows(world.video()),
              plan: plannedRows(),
              frames: BENCHMARK.frames,
              step: BENCHMARK.step,
              samples: status.samples,
              costs: status.costs,
              scene: status.scene,
            });
          },
        });
      },
    });
  };

  /** Put the canvas back, and the rider's own shore with it. The benchmark's
   * race is pinned to a coast nothing on any menu asked for, so leaving it on
   * screen would put the front door over water the settings do not describe —
   * and the front door's whole promise is that the sea behind it is the sea
   * START rides. Standing the settings' own run back up costs a beat, with a
   * card already going up over it. */
  const leave = (page: MenuPage = { page: "developer" }): void => {
    stop?.();
    stop = null;
    world.setStatus(null);
    world.restand();
    world.toMenu(page);
  };

  return {
    start,
    leave,
    stop: () => {
      stop?.();
      stop = null;
    },
  };
}
