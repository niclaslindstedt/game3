// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BENCHMARK, DOM-FREE — everything about the developer page's stopwatch
// that is arithmetic rather than a frame.
//
// The measurement itself cannot be held here: it is a render loop with a
// WebGL fence in it (`pwa/src/game/benchmark.ts`), and what it reports is how
// long THIS machine took. What CAN be held is everything the number is read
// through, and every one of these has a silent failure behind it:
//
//   THE PLAN, because a benchmark whose conditions drifted is two numbers
//   about two different races, and nothing on screen would say so.
//   THE INDEX, because it is the one arithmetic claim the whole tool makes —
//   100 IS REAL TIME — and a score is only comparable while that holds.
//   THE PLOT, because a graph that clips its own peak hides the one reading
//   worth looking at, and a clipped line looks like a flat one.
//   THE STORE, because a stored run is a file anybody can edit and a build
//   from before a field existed, and a NaN out of it draws as a line that
//   vanishes.
//   THE GLYPH CODE, because a row added to `pictureRows` and not to
//   `PICTURE_LADDERS` still reports a value — and every stored run then
//   silently reads as "a stop this build does not have".
import { describe, expect, it } from "vitest";

import { MODE_RULES, TUNING, isBiomeId, isCraftId, isGameMode } from "@engine";

import { BENCHMARK, benchmarkSeconds } from "../pwa/src/game/benchmark-plan.ts";
import {
  INDEX_REAL,
  SAMPLE_EVERY,
  benchIndex,
  benchPlot,
  fpsOfIndex,
  indexOfFps,
  type BenchSample,
} from "../pwa/src/game/benchmark-index.ts";
import {
  GPU_NAME_CAP,
  benchmarkReport,
  big,
  median,
  noMachine,
  noTotals,
  type BenchmarkRun,
  type FramePhases,
  type Machine,
  type RunTotals,
} from "../pwa/src/game/benchmark-report.ts";
import {
  RUNS_KEPT,
  keptWith,
  mergeBenchmarks,
  type BenchmarkRecord,
} from "../pwa/src/game/benchmark-history.ts";
import {
  benchmarkSheet,
  pictureCode,
  pictureGlyph,
  pictureLegend,
  RUNGS,
} from "../pwa/src/game/benchmark-sheet.ts";
import { PICTURE_LADDERS, pictureRows, type PictureRow } from "../pwa/src/game/picture-rows.ts";
import {
  DEFAULT_VIDEO,
  DETAIL_LEVELS,
  DETAIL_PRESETS,
  DISTANCE_LEVELS,
  FRAME_RATE_LEVELS,
  RESOLUTION_LEVELS,
  WATER_LEVELS,
  WATER_PRESETS,
} from "../pwa/src/game/settings-video.ts";

/** A reading, for the plot and the store. */
function sample(frame: number, index: number, fps: number): BenchSample {
  return { frame, index, fps };
}

/** A reading's whole account — what the renderer spent AND what the loop
 * around it spent, which is what a reading carries. */
function cost(calls: number): FramePhases {
  return {
    waterMs: 2.5,
    mirrorMs: 1,
    wakeMs: 0.5,
    submitMs: 3,
    frameMs: 8,
    simMs: 6,
    observeMs: 0.5,
    gpuMs: 4,
    wallMs: 19,
    calls,
    triangles: calls * 3000,
    programs: 40,
    geometries: 120,
    textures: 30,
  };
}

/** …and a run's phases summed, in the proportions a race actually shows: the
 * simulation is the biggest single phase and the renderer's own half is
 * smaller than the frame. `render` is deliberately larger than its four
 * slices, because the report derives `rest` from the difference. */
function totals(frames = 30): RunTotals {
  return {
    frames,
    sim: 6 * frames,
    observe: 0.5 * frames,
    render: 8 * frames,
    water: 2.5 * frames,
    mirror: 1 * frames,
    wake: 0.5 * frames,
    submit: 3 * frames,
    gpu: 4 * frames,
    wall: 19 * frames,
  };
}

function machine(): Machine {
  return { cores: 8, clockMs: 1, gpu: "Test GPU" };
}

/** A whole run, ready to report on. Shared by every case below so that a
 * field added to `BenchmarkRun` is added in one place and every case then
 * asserts against the same numbers. */
function run(): BenchmarkRun {
  return {
    conditions: {
      shore: "SEED 38 · MANGROVE",
      craft: 12,
      width: 1280,
      height: 720,
      pixelRatio: 2,
      picture: pictureRows(DEFAULT_VIDEO),
      plan: [{ label: "seed", value: "38" }],
    },
    samples: [sample(15, 180, 110), sample(30, 175, 108)],
    costs: [cost(180), cost(200)],
    scene: [
      { name: "cover", objects: 13, triangles: 400000 },
      { name: "water", objects: 2, triangles: 200000 },
    ],
    totals: totals(),
    machine: machine(),
    washSources: 2963,
    step: BENCHMARK.step,
    frames: 30,
  };
}

/** A whole stored run, as the app writes one. */
function record(at: number, index: number, picture: PictureRow[]): BenchmarkRecord {
  return {
    at,
    index,
    shore: "SEED 38 · MANGROVE",
    craft: 12,
    width: 1280,
    height: 720,
    pixelRatio: 1,
    picture,
    plan: [{ label: "seed", value: "38" }],
    frames: BENCHMARK.frames,
    step: BENCHMARK.step,
    samples: [sample(BENCHMARK.frames, index, 60)],
    costs: [cost(180)],
    scene: [{ name: "water", objects: 2, triangles: 200000 }],
    totals: totals(BENCHMARK.frames),
    machine: machine(),
    washSources: 2963,
  };
}

describe("what the benchmark runs (benchmark-plan.ts)", () => {
  it("names a craft, a coast and a mode the engine actually has", () => {
    expect(isCraftId(BENCHMARK.craft)).toBe(true);
    expect(isBiomeId(BENCHMARK.biome)).toBe(true);
    expect(isGameMode(BENCHMARK.mode)).toBe(true);
  });

  it("PUTS THE WHOLE FIELD ON THE WATER — the heaviest thing the game does", () => {
    // Not a taste: twelve runs stepped at 120 Hz with the bot deciding on
    // every one of them is most of what the benchmark is measuring, and a
    // plan pinned to a mode that rides alone would be a benchmark of the
    // renderer with the game switched off.
    expect(MODE_RULES[BENCHMARK.mode].rivals).toBeGreaterThan(0);
  });

  it("advances the game by a WHOLE NUMBER of engine steps per frame", () => {
    // The race has to be the same race on every machine, and an accumulator
    // carried between frames is how it stops being one.
    const steps = BENCHMARK.step / TUNING.dt;
    expect(steps).toBe(Math.round(steps));
    expect(steps).toBeGreaterThanOrEqual(1);
  });

  it("takes a reading that lands on the run's last frame", () => {
    // The line's end IS the score on the card. A run length that stopped
    // dividing by the cadence would draw a graph that never quite reaches its
    // own number.
    expect(BENCHMARK.frames % SAMPLE_EVERY).toBe(0);
  });

  it("is long enough to be a race and short enough to sit through", () => {
    expect(benchmarkSeconds()).toBeGreaterThanOrEqual(20);
    expect(benchmarkSeconds()).toBeLessThanOrEqual(60);
  });

  it("rides in DAYLIGHT, which is where every picture row can be read", () => {
    // At night the sea life, the cover and the sky's sheets are all gone or
    // unlit, so DETAIL and SEE-THROUGH would report as free — see the hour's
    // own note in the plan.
    expect(BENCHMARK.hour).toBeGreaterThanOrEqual(8);
    expect(BENCHMARK.hour).toBeLessThanOrEqual(16);
  });
});

describe("the score (benchmark-index.ts)", () => {
  it("SCORES 100 FOR DRAWING THE RACE IN THE TIME IT TAKES TO RIDE", () => {
    // The one arithmetic claim the whole tool makes. Everything else on the
    // scale is relative to it, and two scores only divide into each other
    // while it holds.
    expect(benchIndex(30, 30)).toBe(INDEX_REAL);
    expect(benchIndex(30, 15)).toBe(2 * INDEX_REAL);
    expect(benchIndex(30, 60)).toBe(INDEX_REAL / 2);
  });

  it("has no score before it has drawn a frame", () => {
    expect(benchIndex(0, 0)).toBe(0);
    expect(benchIndex(10, 0)).toBe(0);
    expect(benchIndex(0, 10)).toBe(0);
  });

  it("is a frame rate in another hat, and converts back exactly", () => {
    // What lets both lines share one box and one ceiling: an index IS a rate.
    expect(indexOfFps(1 / BENCHMARK.step, BENCHMARK.step)).toBeCloseTo(INDEX_REAL, 10);
    expect(fpsOfIndex(INDEX_REAL, BENCHMARK.step)).toBeCloseTo(1 / BENCHMARK.step, 10);
    for (const fps of [7, 30, 60, 144, 480]) {
      expect(fpsOfIndex(indexOfFps(fps, BENCHMARK.step), BENCHMARK.step)).toBeCloseTo(fps, 10);
    }
  });

  it("is the same number whatever the run's length is changed to", () => {
    // A ratio and not a unit — which is what makes a score from a build with
    // a longer run still comparable with one from this build.
    expect(benchIndex(30, 12)).toBeCloseTo(benchIndex(60, 24), 10);
  });
});

describe("the run, drawn (benchmark-index.ts)", () => {
  const samples = [sample(15, 90, 55), sample(30, 140, 300), sample(45, 120, 70)];

  it("walks the x axis across THE RUN rather than across the readings", () => {
    // A line a third of the way across has to be a run a third of the way
    // through, or a run stopped early draws as a run that finished.
    const plot = benchPlot(samples, 90, BENCHMARK.step);
    expect(plot.points[0].x).toBeCloseTo(15 / 90, 10);
    expect(plot.points[2].x).toBeCloseTo(0.5, 10);
  });

  it("KEEPS AN EARLIER SPIKE UNDER THE CEILING", () => {
    // The first readings of a cold machine are its wildest, and a graph that
    // clipped them would hide the one thing worth looking at — it would draw
    // as a line lying flat along the top.
    const plot = benchPlot(samples, 90, BENCHMARK.step);
    const peak = indexOfFps(300, BENCHMARK.step);
    expect(plot.top).toBeGreaterThanOrEqual(peak);
    for (const p of [...plot.points, ...plot.rate]) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
  });

  it("floors both axes at zero, so two machines are drawn on one scale", () => {
    const plot = benchPlot([sample(15, 400, 240)], 15, BENCHMARK.step);
    expect(plot.topFps).toBeCloseTo(fpsOfIndex(plot.top, BENCHMARK.step), 10);
    expect(plot.index).toBe(400);
  });

  it("does not tell a machine slower than real time where 100 would have been", () => {
    const slow = benchPlot([sample(15, 8, 5)], 1800, BENCHMARK.step);
    expect(slow.real).toBeNull();
    const quick = benchPlot([sample(15, 260, 160)], 1800, BENCHMARK.step);
    expect(quick.real).not.toBeNull();
  });

  it("draws an empty graph rather than nothing before the first reading", () => {
    const empty = benchPlot([], BENCHMARK.frames, BENCHMARK.step);
    expect(empty.points).toEqual([]);
    expect(empty.index).toBe(0);
    expect(empty.top).toBeGreaterThan(0);
  });
});

describe("the picture, read back (picture-rows.ts, benchmark-sheet.ts)", () => {
  it("reports every row OPTIONS ▸ VIDEO offers", () => {
    const rows = pictureRows(DEFAULT_VIDEO);
    expect(rows).toHaveLength(PICTURE_LADDERS.length);
    expect(rows.map((r) => r.label)).toEqual(PICTURE_LADDERS.map((l) => l.label));
  });

  it("PUTS EVERY STOP OF EVERY ROW ON ITS OWN LADDER", () => {
    // The trap this whole test exists for: a row added to `pictureRows` and
    // not to `PICTURE_LADDERS` still reports a value, and every stored run
    // then draws it as a stop this build does not have — silently, on a page
    // whose entire job is comparing runs.
    const walk = [
      ...WATER_LEVELS.map((water) => ({ ...DEFAULT_VIDEO, water, ...WATER_PRESETS[water] })),
      ...RESOLUTION_LEVELS.map((resolution) => ({ ...DEFAULT_VIDEO, resolution })),
      ...DETAIL_LEVELS.map((detail) => ({ ...DEFAULT_VIDEO, ...DETAIL_PRESETS[detail] })),
      ...DISTANCE_LEVELS.map((distance) => ({ ...DEFAULT_VIDEO, distance })),
      { ...DEFAULT_VIDEO, seeThrough: true },
      { ...DEFAULT_VIDEO, seeThrough: false },
      ...FRAME_RATE_LEVELS.map((frameRate) => ({ ...DEFAULT_VIDEO, frameRate })),
    ];
    for (const video of walk) {
      for (const row of pictureRows(video)) {
        const read = pictureGlyph(row);
        expect(read.stops, `${row.label} ${row.value} is on no ladder`).not.toBeNull();
        expect(read.rung).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("puts the cheapest stop on the lowest bar and the dearest on the tallest", () => {
    // Nothing to memorise: the bar grows with what the row costs, and the
    // tint on screen says the same thing the glyph does.
    for (const ladder of PICTURE_LADDERS) {
      for (const stops of ladder.ladders) {
        const rungs = stops.map((value) => pictureGlyph({ label: ladder.label, value }).rung);
        for (let i = 1; i < rungs.length; i++) expect(rungs[i]).toBeGreaterThan(rungs[i - 1]);
        expect(rungs[rungs.length - 1]).toBe(RUNGS.length - 1);
      }
    }
  });

  it("names a value no ladder has rather than dropping the column", () => {
    const read = pictureGlyph({ label: "WATER", value: "GLORIOUS" });
    expect(read.stops).toBeNull();
    expect(read.rung).toBe(-1);
    // The column keeps its width, so the sheet still reads down.
    expect(read.glyph).toHaveLength(1);
  });

  it("codes a whole picture as one glyph a row, in the menu's own order", () => {
    const code = pictureCode(pictureRows(DEFAULT_VIDEO));
    expect(code).toHaveLength(PICTURE_LADDERS.length);
  });

  it("explains only the ladders a sheet actually used", () => {
    const runs = [record(2, 180, pictureRows(DEFAULT_VIDEO))];
    const legend = pictureLegend(runs);
    expect(legend.map((c) => c.label)).toEqual(PICTURE_LADDERS.map((l) => l.label));
    for (const column of legend) expect(column.unknown).toBe(false);
  });
});

describe("the score sheet and the report (benchmark-sheet.ts, benchmark-report.ts)", () => {
  it("carries the settings ON the line, which is the comparison", () => {
    const low = pictureRows({ ...DEFAULT_VIDEO, distance: "low" });
    const high = pictureRows({ ...DEFAULT_VIDEO, distance: "high" });
    const sheet = benchmarkSheet([record(2, 240, high), record(1, 160, low)]);
    expect(sheet).toContain(pictureCode(high));
    expect(sheet).toContain(pictureCode(low));
    // Two runs that moved one row are two lines with one glyph out of place.
    expect(pictureCode(high)).not.toBe(pictureCode(low));
    expect(sheet).toContain("240");
    expect(sheet).toContain("160");
    expect(sheet).toContain("LEGEND");
  });

  it("says so rather than printing an empty table", () => {
    expect(benchmarkSheet([])).toContain("no runs");
  });

  it("reports the CONDITIONS, the frame and where to look", () => {
    const text = benchmarkReport(run());
    expect(text).toContain("1280×720 @ 2x");
    expect(text).toContain("12 craft");
    // The water's CPU time is the one line a draw-call count cannot stand in
    // for: the near grid calls the engine's own `surfaceAt` thousands of
    // times a frame and none of that is the GPU's.
    expect(text).toContain("water");
    // The breakdown is sorted by what it costs, so the row to look at first
    // is the first row.
    const breakdown = text.slice(text.indexOf("WHAT WAS STANDING THERE"));
    expect(breakdown.indexOf("cover")).toBeLessThan(breakdown.indexOf("water"));
    // Every reading, with its draw calls in the same row as its frame rate —
    // which is how a thermal sag is told from a scene that got heavier.
    expect(text).toContain("THE RUN, READING BY READING");
    expect(text).toContain("50%");
  });

  it("BILLS THE WHOLE FRAME, not just the renderer's share of it", () => {
    // The frame the benchmark draws is a race STEPPED and then drawn, and
    // the stepping is the half `frameMs` cannot see: a report that billed
    // only the renderer could show eight milliseconds on a machine drawing
    // at nineteen and say nothing about the other eleven.
    const text = benchmarkReport(run());
    const block = text.slice(text.indexOf("WHERE THE FRAME WENT"));
    for (const phase of ["sim", "observe", "render", "gpu", "unbilled", "wall"])
      expect(block).toContain(phase);
    // Every phase is meaned over the frames summed, not over the readings —
    // 6 ms of simulation a frame, whatever the two readings happened to say.
    expect(block).toContain("6.00 ms");
    // …and the wall is the frame end to end, with the rate it works out at.
    expect(block).toContain("19.00 ms");
  });

  it("SHARES EVERY PHASE AGAINST THE WALL, so the column adds up", () => {
    const block = benchmarkReport(run()).slice(
      benchmarkReport(run()).indexOf("WHERE THE FRAME WENT"),
    );
    // 6 of 19 is 32%, 8 of 19 is 42%, 4 of 19 is 21% — against the frame
    // rather than against the line above, which is what lets a reader see
    // which HALF of the frame to go and look at.
    expect(block).toContain("32%");
    expect(block).toContain("42%");
    expect(block).toContain("21%");
  });

  it("derives `rest` and `unbilled` rather than timing a stopwatch for each", () => {
    // `render` is 8 ms with 2.5 + 1 + 0.5 + 3 = 7 ms of named slices, so the
    // scene being posed and culled is the 1 ms left over; the wall is 19 ms
    // with 6 + 0.5 + 8 + 4 = 18.5 accounted, so the browser's own is 0.5.
    const block = benchmarkReport(run()).slice(
      benchmarkReport(run()).indexOf("WHERE THE FRAME WENT"),
    );
    expect(block).toContain("rest");
    const rest = block.slice(block.indexOf("rest"));
    expect(rest.slice(0, 40)).toContain("1.00 ms");
    const unbilled = block.slice(block.indexOf("unbilled"));
    expect(unbilled.slice(0, 40)).toContain("0.50 ms");
  });

  it("NEVER PRINTS A NEGATIVE PHASE, whatever the clock did to the parts", () => {
    // A clamped clock rounds each phase independently, so the slices of
    // `render` can sum to more than `render` and the phases to more than the
    // wall. That is the instrument, not a fault — but a report with a
    // minus sign in it reads as a bug in the game.
    const skewed = totals();
    skewed.water = skewed.render * 2;
    skewed.sim = skewed.wall * 2;
    const text = benchmarkReport({ ...run(), totals: skewed });
    const block = text.slice(text.indexOf("WHERE THE FRAME WENT"), text.indexOf("PER FRAME"));
    // Every figure in the block, read back off the text rather than off the
    // arithmetic that produced it — the report is the thing somebody pastes.
    const figures = [...block.matchAll(/(-?\d+\.\d\d) ms/g)].map((m) => Number(m[1]));
    expect(figures.length).toBeGreaterThan(0);
    for (const figure of figures) expect(figure).toBeGreaterThanOrEqual(0);
    for (const share of [...block.matchAll(/(-?\d+)%/g)].map((m) => Number(m[1])))
      expect(share).toBeGreaterThanOrEqual(0);
  });

  it("leaves the breakdown out rather than printing a frame of zeroes", () => {
    // A record kept by a build from before the phases were timed has no
    // account at all. A block of zeroes would read as a machine that spent
    // no time doing anything, which is worse than no block.
    const text = benchmarkReport({ ...run(), totals: noTotals(), machine: noMachine() });
    expect(text).not.toContain("WHERE THE FRAME WENT");
    // …and with nothing known about the machine, no MACHINE line either.
    expect(text).not.toContain("MACHINE");
    // The rest of the report still stands.
    expect(text).toContain("THE RUN, READING BY READING");
  });

  it("puts the CLOCK'S OWN RESOLUTION on the machine line, as the error bar", () => {
    // Every per-frame figure in the table is quantised to it, so a reader
    // who does not know it cannot tell a phase that is cheap from a phase
    // the clock cannot see. It is the reason the breakdown is a run total.
    const text = benchmarkReport(run());
    expect(text).toContain("MACHINE");
    expect(text).toContain("8 cores");
    expect(text).toContain("1.00 ms clock");
    expect(text).toContain("Test GPU");
  });

  it("KEEPS A WHOLE DRIVER NAME — the part that identifies the hardware is at the END", () => {
    // Measured off a real context: a driver through ANGLE spells out the
    // backend, the device and its id, and runs to ninety-odd characters. A
    // cap that trims one throws away the only half worth reading.
    const real =
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)";
    expect(real.length).toBeLessThanOrEqual(GPU_NAME_CAP);
    const kept = mergeBenchmarks([
      { ...record(1, 100, []), machine: { cores: 4, clockMs: 0.1, gpu: real } },
    ]);
    expect(kept[0].machine.gpu).toBe(real);
    // …and a store somebody pasted a page of text into is still bounded, so
    // it cannot run through the middle of the report's table.
    const flood = mergeBenchmarks([
      { ...record(1, 100, []), machine: { cores: 4, clockMs: 1, gpu: "x".repeat(9000) } },
    ]);
    expect(flood[0].machine.gpu.length).toBe(GPU_NAME_CAP);
  });

  it("names the WASH SOURCES beside the hulls, which no scene walk can see", () => {
    // The product of the two is the shape of the simulation's cost: every
    // source is read by every hull's probes at 120 Hz and by every vertex
    // of the water grid, so twelve hulls is twelve readers AND twelve
    // trails. None of it is an object, so `sceneTally` reports none of it.
    const text = benchmarkReport(run());
    const water = text.slice(text.indexOf("WHAT WAS IN THE WATER"));
    expect(water).toContain("2 963");
    expect(water).toContain("hulls");
  });

  it("reads a frame's usual cost as the MIDDLE reading, not the mean", () => {
    // One stalled frame — a chunk built, a shader compiled — moves a mean of
    // a hundred readings and moves a median not at all.
    expect(median([1, 2, 3, 4, 1000])).toBe(3);
    expect(median([])).toBe(0);
    expect(big(1284933)).toBe("1 284 933");
  });
});

describe("every run this machine has scored (benchmark-history.ts)", () => {
  // The POLICY, which is what is worth holding: `benchmarkRuns` and
  // `rememberBenchmark` are three lines of `localStorage` over these two, and
  // this suite has no DOM to give them.
  it("keeps the newest runs, newest first, and drops the oldest", () => {
    const picture = pictureRows(DEFAULT_VIDEO);
    let runs: BenchmarkRecord[] = [];
    for (let i = 1; i <= RUNS_KEPT + 3; i++) runs = keptWith(runs, record(i, 100 + i, picture));
    expect(runs).toHaveLength(RUNS_KEPT);
    expect(runs[0].at).toBe(RUNS_KEPT + 3);
    for (let i = 1; i < runs.length; i++) expect(runs[i].at).toBeLessThan(runs[i - 1].at);
  });

  it("KEEPS THE WHOLE RUN, not the score", () => {
    // A score alone would make the list a scoreboard; what is wanted is the
    // run back — the graph redrawn, the sag found at the frame it happened
    // on, the report copied out weeks later.
    const [kept] = mergeBenchmarks([record(1, 180, pictureRows(DEFAULT_VIDEO))]);
    expect(kept.samples).toHaveLength(1);
    expect(kept.costs[0].calls).toBe(180);
    expect(kept.costs[0].waterMs).toBeCloseTo(2.5, 5);
    expect(kept.scene[0].name).toBe("water");
    // …and the scale it was measured on, so an old run is never redrawn on
    // today's step.
    expect(kept.step).toBe(BENCHMARK.step);
    expect(kept.frames).toBe(BENCHMARK.frames);
  });

  it("drops what is not a run rather than drawing a line that vanishes", () => {
    // A stored blob is a file anybody can edit and a build from before a
    // field existed. A NaN reaching the graph draws as nothing at all.
    const runs = mergeBenchmarks([
      null,
      { at: 0 },
      "nonsense",
      { at: 5, index: "fast", step: 0, samples: [{ frame: -2, index: null, fps: "x" }] },
    ]);
    expect(runs).toHaveLength(1);
    expect(runs[0].index).toBe(0);
    expect(runs[0].samples[0].frame).toBe(0);
    expect(Number.isFinite(runs[0].samples[0].index)).toBe(true);
    expect(Number.isFinite(runs[0].samples[0].fps)).toBe(true);
    // A run that cannot say what a frame advanced has no rate to report, and
    // says so as a step of zero rather than dividing the fps axis by nothing.
    expect(runs[0].step).toBe(0);
    expect(fpsOfIndex(runs[0].index, runs[0].step)).toBe(0);
  });

  it("reads a blob that is not even a list as no history", () => {
    expect(mergeBenchmarks(null)).toEqual([]);
    expect(mergeBenchmarks({ runs: [] })).toEqual([]);
    expect(mergeBenchmarks("{ not json")).toEqual([]);
  });
});
