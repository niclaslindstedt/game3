// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BENCHMARK'S REPORT — a run written down, in text somebody can paste.
//
// The card shows a score and two lines, which is what a rider needs to know
// whether their machine is coping. This is the other audience: whoever is
// going to make the game faster, who needs to know WHAT THE FRAME WAS DOING
// rather than how fast it went. A number without its conditions cannot be
// acted on, and a number without a breakdown cannot be acted on WELL — "it
// is slow" and "it is submitting nine hundred draw calls, four hundred of
// them cover" are different bug reports.
//
// So the report carries three things, in the order somebody reads them:
//
//   THE CONDITIONS — the shore, the field, the buffer, and every row of
//   OPTIONS ▸ VIDEO. Without these two runs cannot be compared at all, and
//   the whole use of the tool is comparing two runs.
//
//   WHERE THE FRAME WENT — the frame cut into its phases and meaned over the
//   whole run. This is the part that names the bottleneck, and it covers the
//   WHOLE frame rather than the renderer's share of it: a race steps twelve
//   entire runs at 120 Hz behind every frame it draws, and a report that
//   billed only `render()` could show six milliseconds on a machine drawing
//   at fourteen and say nothing about the other eight.
//
//   THE RUN — every reading: how far in, the score so far, the rate of that
//   frame, and what that frame cost. This is where a thermal sag is told
//   from a scene that got heavier, because the draw calls are sitting in the
//   same table as the frame rate — and where THE WATER'S OWN CPU TIME is,
//   which is the one line in this game that a draw call cannot stand in for:
//   the near grid calls the engine's `surfaceAt` thousands of times a frame
//   and none of that is the GPU's.
//
//   THE SCENE — what was actually standing there on the last frame, by
//   subsystem, and what was in the WATER, which no walk of the scene can
//   see. This is the part that says where to look.
//
// WHY THE TWO SUMMARIES ARE COMPUTED DIFFERENTLY. A counter (a draw call, a
// triangle) is exact on the frame it was read, so the middle reading is the
// right summary of it. A TIME is not: browsers clamp `performance.now()` —
// a millisecond in Safari — so one frame's 0.3 ms pass reads as 0 or 1 and
// never as itself, and a median of readings taken that way is a median of
// noise. Every time in the report is therefore a RUN TOTAL divided by the
// frames in it, where the same rounding averages down to nothing.
//
// `FrameCost` IS STATED HERE rather than in `renderer.ts` for one reason:
// this module, the history and the sheet are DOM-free and the tests read
// them, and a type imported from the renderer would drag three.js into a
// suite that runs on plain Node. The renderer imports it from here and
// re-exports it, so there is still one name for one thing.

import type { PictureRow } from "./picture-rows.ts";
import { fpsOfIndex, type BenchSample } from "./benchmark-index.ts";

/** What one frame cost the RENDERER, read off its own counters. Every `Ms`
 * field is a slice of `frameMs` and they do not cover it: what is left over
 * is the scene being posed, culled and retoned, which the report names
 * `rest` rather than timing a sixth stopwatch for. */
export type FrameCost = {
  /** The water's CPU time, ms — the near grid displaced by the ENGINE's
   * `surfaceAt`, which is the one thing in the frame no graphics card makes
   * cheaper. Note what `surfaceAt` includes: the WASH, so a sea with twelve
   * trails on it is dearer here than the same grid on empty water. */
  waterMs: number;
  /** The reflection pass, ms — the shore submitted a second time from under
   * the surface. Zero on a frame the REFLECTIONS row's `every` skipped, so
   * this is the one phase whose mean over a run is not what any single
   * frame paid. */
  mirrorMs: number;
  /** The wake's raster, ms — the trail stamped into the map the water reads. */
  wakeMs: number;
  /** The picture and the grade, ms: `renderer.render` into the grade's
   * target and the screen-filling pass that grades it onto the canvas. This
   * is SUBMISSION and not drawing — the card is still working when it
   * returns, which is what `gpuMs` is for. */
  submitMs: number;
  /** The whole frame's processor time, ms, up to the moment the last draw
   * was submitted. The GPU's half runs on after that and is not in here —
   * `drain()` is what waits for it. */
  frameMs: number;
  /** Draw calls in the WHOLE frame: the picture, the mirror's pass and the
   * wake's raster. */
  calls: number;
  triangles: number;
  /** Compiled programs, and the geometries and textures resident. Not per
   * frame: what the shore is HOLDING, which is what a memory problem looks
   * like. */
  programs: number;
  geometries: number;
  textures: number;
};

/** WHAT THE LOOP AROUND THE RENDERER SPENT on the same frame — the half
 * `frameMs` cannot see, because it is timed from inside `render()`.
 *
 * It is a separate type from `FrameCost` because it has a separate AUTHOR:
 * the renderer writes the one and the benchmark's own pump writes the other
 * (`benchmark.ts`), and a single type would oblige each to return zeroes for
 * the other's fields. A reading carries both.
 *
 * THIS IS THE HALF THAT WAS MISSING. A race steps twelve whole runs at
 * 120 Hz behind every frame it draws, and none of that is a draw call: a
 * report that billed only the renderer could show a frame costing six
 * milliseconds on a machine drawing at fourteen and say nothing about the
 * other eight. */
export type FrameTiming = {
  /** The ENGINE's steps, ms — `step()` over the player and every rival,
   * `STEPS_PER_FRAME` of them, each with the bot deciding. Nothing here is
   * drawn and nothing here answers to OPTIONS ▸ VIDEO. */
  simMs: number;
  /** The renderer reading each step, ms — the wake, the spray and the foam
   * sampling the craft at the STEP's cadence rather than the frame's. */
  observeMs: number;
  /** The fence, ms: one pixel read back out of the drawing buffer, which
   * cannot be answered until every draw behind it has landed
   * (`renderer.drain`). It is the only look at the GPU a browser gives us —
   * WebGL's timer query is not exposed by every engine and is not exposed
   * by Safari at all — and it is an OVERSTATEMENT of what the game pays,
   * because a frame with no fence in it overlaps its card's work with the
   * next frame's processor time. Read it as a ceiling on the GPU and as the
   * benchmark's own instrument tax. */
  gpuMs: number;
  /** The frame end to end, ms, measured around all of the above. What it
   * carries that the parts do not is the browser's own: a collection, a
   * compositor, another page waking up.
   *
   * It is measured INSIDE the frame, so what it leaves out is the pump's own
   * hop between frames and the card being redrawn on a reading — both of
   * which the `fps` beside it in the table does include. The two columns
   * standing a little apart is the benchmark's own overhead, and it is the
   * one figure here that says how much. */
  wallMs: number;
};

/** One reading's whole account — what the renderer spent and what the loop
 * around it spent, which together are the frame. */
export type FramePhases = FrameCost & FrameTiming;

/** EVERY FRAME'S PHASES SUMMED OVER THE WHOLE RUN, in ms.
 *
 * It exists because `performance.now()` IS NOT PRECISE ENOUGH TO TIME ONE
 * FRAME'S PHASES. Browsers clamp it — a millisecond in Safari, and coarser
 * still without cross-origin isolation — so a pass that really costs 0.3 ms
 * is read as 0 or as 1 and never as itself, and a median of readings taken
 * that way is a median of noise. Summed over eighteen hundred frames the
 * rounding is the same size and the total is eighteen hundred times bigger,
 * so the MEAN comes back good to a few hundredths.
 *
 * So this is the honest breakdown and the per-reading table is the shape of
 * the run. Every field is a total: divide by `frames` for the mean. */
export type RunTotals = {
  /** Frames summed — every frame of the measured run, not just the ones a
   * reading was taken on. */
  frames: number;
  sim: number;
  observe: number;
  /** The renderer's whole `frameMs`, and the four slices of it below. */
  render: number;
  water: number;
  mirror: number;
  wake: number;
  submit: number;
  gpu: number;
  wall: number;
};

/** An empty account, for a run that has not drawn a frame yet and for a
 * stored record from a build that did not keep one. */
export function noTotals(): RunTotals {
  return {
    frames: 0,
    sim: 0,
    observe: 0,
    render: 0,
    water: 0,
    mirror: 0,
    wake: 0,
    submit: 0,
    gpu: 0,
    wall: 0,
  };
}

/** WHAT THE MACHINE IS, as much of it as a browser will say.
 *
 * A breakdown is read against the machine that produced it — eight
 * milliseconds of simulation means one thing on a phone and another on a
 * desktop — and the three things below are the ones that change how the rest
 * of the report is READ rather than merely describing the device.
 *
 * None of it is identifying: a core count, a clock's resolution and a driver
 * string the browser has already decided to publish. */
export type Machine = {
  /** Logical cores (`navigator.hardwareConcurrency`), or 0 where the browser
   * withholds it. It is here because it is the ceiling on every answer to
   * "can this be moved off the main thread". */
  cores: number;
  /** THE FINEST STEP `performance.now()` ACTUALLY RESOLVES on this device,
   * ms — measured rather than assumed, by spinning until the clock moves.
   * Every per-frame time in this report is quantised to it, so it is the
   * error bar on the whole per-reading table, and it is why `RunTotals`
   * exists. */
  clockMs: number;
  /** What the driver calls itself, or "" where the browser withholds it
   * (Safari masks this unless the page asks for the unmasked name, and may
   * mask it then). */
  gpu: string;
};

/** Nothing known about the machine — the shape a stored record from an
 * older build reads back as. */
export function noMachine(): Machine {
  return { cores: 0, clockMs: 0, gpu: "" };
}

/** One subsystem's share of the scene, as the renderer tallied it. */
export type SceneShare = {
  /** The named group it hangs under — `water`, `shore`, `flora`, `field`… */
  name: string;
  /** Objects that would be drawn: visible meshes, points and lines. */
  objects: number;
  triangles: number;
};

/** Everything the report needs that is not a reading. */
export type BenchmarkConditions = {
  /** The shore, as the card words it — the seed and the coast. */
  shore: string;
  /** Hulls on the water, the player's included. */
  craft: number;
  width: number;
  height: number;
  /** Device pixels per CSS pixel — the buffer above is the product of this
   * and the page's own size, so a buffer without it cannot be reproduced. */
  pixelRatio: number;
  /** The rows the run did NOT pin, which are the ones worth reporting. */
  picture: PictureRow[];
  /** The rows it DID pin, so a report from another build is comparable. */
  plan: { label: string; value: string }[];
};

/** A run, ready to paste. */
export type BenchmarkRun = {
  conditions: BenchmarkConditions;
  samples: readonly BenchSample[];
  costs: readonly FramePhases[];
  scene: readonly SceneShare[];
  /** Every frame's phases summed — the breakdown that can be trusted. */
  totals: RunTotals;
  /** What drew it. */
  machine: Machine;
  /** LIVE WASH SOURCES ON THE SEA on the last frame — every hull's trail
   * added up (`SeaState.washes`).
   *
   * It is in the report because it is the one number that explains a
   * simulation cost the scene table cannot: a wash source is read by every
   * probe of every hull at 120 Hz AND by every vertex of the water grid,
   * so the work it drives grows with the sources TIMES the readers, and a
   * field of twelve is both. Nothing else in a frame has that shape. */
  washSources: number;
  /** Seconds of game each frame advanced, for the fps conversion. */
  step: number;
  /** Frames the run is long, so a reading can say how far through it is. */
  frames: number;
};

/** Thousands separators, because a triangle count is read at a glance and
 * `1284933` is not. Shared with the score sheet (`benchmark-sheet.ts`), which
 * is the other thing a run gets pasted as: two of them in one comment have to
 * spell a triangle count the same way. */
export function big(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** The middle reading rather than the mean: one stalled frame — a chunk
 * built, a shader compiled, another program waking up — moves a mean of a
 * hundred readings and moves a median not at all, and what this line is for
 * is what the frame USUALLY costs. Exported because the score sheet's DRAWS
 * column is this same figure — a run's median frame — and two numbers under
 * one name have to be one number. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
}

/** A fixed-width column, so the table reads down as well as across when it
 * lands in a comment nobody has re-formatted. Shared with the score sheet for
 * the same reason `big` is. */
export function pad(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

/** Milliseconds to one decimal — a frame is a few of them and a tenth is the
 * finest difference worth reading off a median. */
function ms(value: number): string {
  return value.toFixed(1);
}

/** Milliseconds to two — the phase means off `RunTotals`, which are averaged
 * over the whole run and so carry a digit a single reading cannot. */
function fine(value: number): string {
  return value.toFixed(2);
}

/** One phase of the frame, as a line: the mean, its share of the frame, and
 * what the phase IS. The share is against the WALL rather than against the
 * lines above it, so the column adds to a hundred and a reader can see at a
 * glance which half of the frame to go and look at. */
function phase(name: string, total: number, totals: RunTotals, what: string): string {
  const mean = totals.frames > 0 ? total / totals.frames : 0;
  const share = totals.wall > 0 ? (total / totals.wall) * 100 : 0;
  // The NAME is left-aligned where every other column is right-aligned, so
  // that the four slices of `render` keep the indent that says they are its
  // slices rather than phases beside it. Right-aligning ate exactly that.
  return (
    `  ${name.padEnd(PHASE_NAME)} ${pad(fine(mean), 6)} ms ` +
    `${pad(`${Math.round(share)}%`, 4)}   ${what}`
  );
}

/** The width the phase names are laid out in — long enough for `unbilled`
 * indented, which is not, plus the two spaces a slice of `render` is set in
 * by. */
const PHASE_NAME = 10;

/** WHERE THE FRAME WENT — the block somebody optimising the game reads first.
 *
 * It is meaned over every frame of the run rather than medianed over the
 * readings, and `RunTotals` says why: a browser's clock cannot resolve one
 * frame's phases, and only the sum over the run averages that rounding away.
 *
 * The order is the order the frame happens in, and the four indented lines
 * are slices of `render` rather than phases beside it. `rest` is what is left
 * of `render` once the four are taken out — the scene posed, culled and
 * retoned — and `unbilled` is what is left of the WALL once every phase is:
 * the browser's own work, which nothing on this page can time directly but
 * which a frame pays all the same. */
function whereTheFrameWent(totals: RunTotals, step: number): string[] {
  if (totals.frames <= 0 || totals.wall <= 0) return [];
  const rest = Math.max(
    0,
    totals.render - totals.water - totals.mirror - totals.wake - totals.submit,
  );
  const unbilled = Math.max(
    0,
    totals.wall - totals.sim - totals.observe - totals.render - totals.gpu,
  );
  const mean = totals.wall / totals.frames;
  return [
    "",
    `WHERE THE FRAME WENT, MEANED OVER ${totals.frames} FRAMES`,
    phase("sim", totals.sim, totals, "the whole field stepped at 120 Hz — no draw calls in it"),
    phase("observe", totals.observe, totals, "the renderer reading each step"),
    phase("render", totals.render, totals, "the processor's half of the draw, split below"),
    phase("  water", totals.water, totals, "the grid displaced by the engine's surfaceAt"),
    phase("  mirror", totals.mirror, totals, "the reflection pass, on the frames it is due"),
    phase("  wake", totals.wake, totals, "the trail rasterised into the map the water reads"),
    phase("  submit", totals.submit, totals, "the picture into the grade's target, and the grade"),
    phase("  rest", rest, totals, "the scene posed, culled and retoned"),
    phase("gpu", totals.gpu, totals, "the fence — a ceiling on the card, and the instrument's tax"),
    phase("unbilled", unbilled, totals, "the browser's own: a collection, the compositor"),
    `  ${"─".repeat(PHASE_NAME + 10)}`,
    `  ${"wall".padEnd(PHASE_NAME)} ${pad(fine(mean), 6)} ms         ` +
      `the frame, end to end — ${Math.round(1000 / mean)} fps, ` +
      `index ${Math.round(step * 1000 * (100 / mean))}`,
  ];
}

export function benchmarkReport(run: BenchmarkRun): string {
  const { conditions: c, samples, costs, scene, totals, machine, step, frames } = run;
  const last = samples.length > 0 ? samples[samples.length - 1] : null;
  const index = last?.index ?? 0;
  const out: string[] = [];

  out.push(`BENCHMARK — ${c.shore} · ${c.craft} craft · ${c.width}×${c.height} @ ${c.pixelRatio}x`);
  out.push(
    `INDEX ${Math.round(index)} · ${Math.round(fpsOfIndex(index, step))} fps average · ` +
      `${samples.length} readings over ${frames} frames`,
  );
  // THE MACHINE, when the browser said anything about it. The clock's own
  // resolution is on this line rather than buried in the table because it is
  // the error bar on every per-frame figure below it: at a millisecond a
  // phase costing a third of one is never read as itself, which is the whole
  // reason the breakdown is meaned over the run.
  const bits = [
    machine.cores > 0 ? `${machine.cores} cores` : "",
    machine.clockMs > 0 ? `${fine(machine.clockMs)} ms clock` : "",
    machine.gpu,
  ].filter((bit) => bit !== "");
  if (bits.length > 0) out.push(`MACHINE ${bits.join(" · ")}`);
  out.push("");
  out.push(`VIDEO   ${c.picture.map((r) => `${r.label} ${r.value}`).join(" · ")}`);
  out.push(`PINNED  ${c.plan.map((r) => `${r.label} ${r.value}`).join(" · ")}`);

  out.push(...whereTheFrameWent(totals, step));

  if (costs.length > 0) {
    out.push("");
    // THE COUNTERS, medianed — and no TIMES here, because the block above
    // states every one of them better. A counter is exact on the frame it was
    // read, so a median of readings is the right summary of it; a time is
    // quantised by the clock, so its summary is the run's own total.
    out.push("PER FRAME, MEDIAN OVER THE RUN");
    out.push(`  draw calls   ${big(median(costs.map((f) => f.calls)))}`);
    out.push(`  triangles    ${big(median(costs.map((f) => f.triangles)))}`);
    const held = costs[costs.length - 1];
    out.push(`  programs     ${big(held.programs)}`);
    out.push(`  geometries   ${big(held.geometries)}`);
    out.push(`  textures     ${big(held.textures)}`);
  }

  if (scene.length > 0) {
    out.push("");
    out.push("WHAT WAS STANDING THERE, LAST FRAME");
    out.push(`  ${pad("objects", 9)} ${pad("triangles", 12)}  where`);
    for (const share of [...scene].sort((a, b) => b.triangles - a.triangles)) {
      out.push(`  ${pad(big(share.objects), 9)} ${pad(big(share.triangles), 12)}  ${share.name}`);
    }
  }

  // …AND WHAT WAS IN THE WATER, which the scene walk cannot see because none
  // of it is an object: the hulls are readers and the wash sources are what
  // they read. Two numbers whose PRODUCT is the shape of the simulation's
  // cost, which is why they are printed beside each other.
  if (run.washSources > 0) {
    out.push("");
    out.push("WHAT WAS IN THE WATER, LAST FRAME");
    out.push(`  ${pad(big(c.craft), 9)}  hulls, each reading every trail at 120 Hz`);
    out.push(`  ${pad(big(run.washSources), 9)}  wash sources, on ${c.craft} trails`);
  }

  out.push("");
  out.push("THE RUN, READING BY READING");
  out.push(
    `  ${pad("at", 5)} ${pad("frame", 6)} ${pad("index", 6)} ${pad("fps", 5)} ` +
      `${pad("draws", 7)} ${pad("triangles", 11)} ${pad("sim", 7)} ${pad("water", 7)} ` +
      `${pad("render", 7)} ${pad("gpu", 7)} ${pad("wall", 7)}`,
  );
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const cost = costs[i];
    const at = frames > 0 ? `${Math.round((s.frame / frames) * 100)}%` : "";
    out.push(
      `  ${pad(at, 5)} ${pad(String(s.frame), 6)} ${pad(String(Math.round(s.index)), 6)} ` +
        `${pad(String(Math.round(s.fps)), 5)} ` +
        `${pad(cost ? big(cost.calls) : "", 7)} ${pad(cost ? big(cost.triangles) : "", 11)} ` +
        `${pad(cost ? ms(cost.simMs) : "", 7)} ${pad(cost ? ms(cost.waterMs) : "", 7)} ` +
        `${pad(cost ? ms(cost.frameMs) : "", 7)} ${pad(cost ? ms(cost.gpuMs) : "", 7)} ` +
        `${pad(cost ? ms(cost.wallMs) : "", 7)}`,
    );
  }
  return out.join("\n");
}
