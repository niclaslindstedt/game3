// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BENCHMARK'S SURFACES — the card that goes over the race while it is
// being timed, the graph full screen, and the list of every run this machine
// has kept.
//
// The card is not a menu page: it sits over the race it is measuring, because
// the thing being measured is on the canvas underneath it (`benchmark.ts`).
// The HISTORY page is a page like any other, reached from the card at the end
// of a run or from the developer page at any time.
//
// They are one file because they are one instrument. A score means nothing on
// its own — the whole method is run it, move a row of OPTIONS ▸ VIDEO, run it
// again, read the difference — so the card that shows a score and the list
// that shows what the last one was are two halves of a single answer, and the
// graph is drawn by the same component for a run finishing now as for one
// drawn out of storage months later.

import { useState } from "preact/hooks";

import { BENCHMARK } from "./benchmark-plan.ts";
import type { BenchmarkStatus } from "./benchmark.ts";
import { INDEX_REAL, benchPlot, fpsOfIndex, type BenchPlot } from "./benchmark-index.ts";
import { benchmarkReport, big } from "./benchmark-report.ts";
import { benchmarkRuns, clearBenchmarks, type BenchmarkRecord } from "./benchmark-history.ts";
import {
  benchmarkSheet,
  pictureGlyphs,
  pictureLegend,
  runDraws,
  runWhen,
} from "./benchmark-sheet.ts";
import { MenuHead } from "./menu.tsx";
import { pictureRows } from "./picture-rows.ts";
import type { VideoSettings } from "./settings-video.ts";
import { STRINGS } from "./strings.ts";

/** How long a copy button wears its receipt before going back to its label —
 * the developer page's own, because they are the same press on the same kind
 * of button and two timings would read as two behaviours. */
const SAID_MS = 2000;

/** WHAT THE BENCHMARK IS RIDDEN ON, as the pinned rows read — the half of a
 * report that is not OPTIONS ▸ VIDEO. Stated once here because the card, the
 * stored record and the pasted report all print it and a run whose plan is
 * worded three ways is a run that cannot be compared with itself. */
export function plannedRows(): { label: string; value: string }[] {
  return [
    { label: "seed", value: String(BENCHMARK.seed) },
    { label: "coast", value: BENCHMARK.biome },
    { label: "mode", value: BENCHMARK.mode },
    { label: "craft", value: BENCHMARK.craft },
    { label: "class", value: String(BENCHMARK.speedClass) },
    { label: "camera", value: BENCHMARK.camera },
    { label: "hour", value: String(BENCHMARK.hour) },
    { label: "sky", value: BENCHMARK.weather },
    { label: "season", value: BENCHMARK.season },
    { label: "swell", value: `${BENCHMARK.swell} m` },
  ];
}

/** The shore a run was ridden on, as one phrase — the card's billing and the
 * stored record's `shore` are the same words. */
export function benchmarkShore(): string {
  return STRINGS.benchShore(BENCHMARK.seed, BENCHMARK.biome);
}

/** A press that puts text on the clipboard and says so where its label was.
 * The developer page's REPRO LINK is the same bargain; this is the shape of
 * it that two surfaces here share. */
function CopyButton({
  label,
  hint,
  text,
  className,
}: {
  label: string;
  /** What it copies, where the label is too short to say — the card's press
   * is one word and a pointer resting on it wants the sentence. */
  hint?: string;
  text: () => string;
  className?: string;
}) {
  const [said, setSaid] = useState<string | null>(null);
  return (
    <button
      type="button"
      class={className ?? "opt-reset"}
      title={hint}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text())
          .then(() => setSaid(STRINGS.devReproCopied))
          .catch(() => setSaid(STRINGS.devReproFailed))
          .finally(() => setTimeout(() => setSaid(null), SAID_MS));
      }}
    >
      {said ?? label}
    </button>
  );
}

/** THE GRAPH'S BOX, in its own units — the SVG scales to whatever width the
 * card ends up, so these are proportions rather than pixels. `x0`..`x1` and
 * `y0`..`y1` are where the LINES may go; the panel behind them is the whole
 * box, so the leading dot at the end of a finished run sits inside its own
 * frame instead of half over the edge, and the gutters outside `x0` and `x1`
 * are the two axes — the same ceiling in index on the left and in frames a
 * second on the right.
 *
 * THE GUTTERS ARE SIZED BY THEIR WIDEST LABEL, not by what looks tidy in the
 * middle. They carry a number AND a unit caption under it, and `INDEX` — five
 * letters and four letter-spacings at 6.5px — is about 25 units wide. */
const PLOT = { w: 320, h: 150, x0: 42, x1: 278, y0: 16, y1: 130 };

/** How close two labels on the same axis may come before the one in the
 * middle is dropped rather than printed over its neighbour. */
const LABEL_GAP = 12;

/** THE RUN, DRAWN — twice, because one line cannot say both things.
 *
 * THE SCORE, in the buoy's orange: the index of the whole run so far, read
 * every fifteen frames and walked across the eighteen hundred the run is, so
 * how far along it is IS how far across the line has got, and the number at
 * its leading edge is the score as it currently stands. It settles as it
 * goes, which is the point of plotting a running answer: the first readings
 * scatter over the grid and the run to the first gate, and the line then
 * walks steadily onto the number the run ends on.
 *
 * THE RATE, in the shallows' blue: the frame at each of those same readings,
 * on its own, unsmoothed. It is the line that says WHEN — an average eighteen
 * hundred frames deep cannot, and a machine that spends the second half of
 * the race at half the frame rate shows up on the orange line only as a long
 * sag with no place in it.
 *
 * They share the box and the ceiling because they are one quantity in two
 * units (`benchmark-index.ts`), which is what makes the pair readable: a rate
 * ABOVE the score is a run still earning it, a rate below is a run paying it
 * back, and the two crossing is the moment the machine changed. The right
 * axis is that same ceiling in frames a second — the unit anybody actually
 * has a feel for. */
function BenchmarkPlot({
  plot,
  full,
}: {
  plot: BenchPlot;
  /** Drawn as the whole screen rather than as a panel on the card. Same
   * viewBox and therefore the same picture — only bigger, which is the whole
   * point: the readings are a hundred and twenty points wide and on a card
   * they land inside two millimetres of each other. */
  full?: boolean;
}) {
  const px = (x: number): number => PLOT.x0 + x * (PLOT.x1 - PLOT.x0);
  const py = (y: number): number => PLOT.y0 + y * (PLOT.y1 - PLOT.y0);
  const at = (p: { x: number; y: number }): string => `${px(p.x).toFixed(1)},${py(p.y).toFixed(1)}`;
  const line = plot.points.map(at).join(" ");
  const rate = plot.rate.map(at).join(" ");
  const last = plot.points.length > 0 ? plot.points[plot.points.length - 1] : null;
  // The same line dropped to the floor at both ends: under a fading wash it
  // reads as a quantity where a bare stroke reads as a squiggle. It falls at
  // the FIRST READING and not at the axis — there is no score before there is
  // one, and closing the shape further left only draws a ramp up out of the
  // corner that no measurement was ever taken along.
  const area =
    last === null ? "" : `${px(plot.points[0].x)},${PLOT.y1} ${line} ${px(last.x)},${PLOT.y1}`;
  // The score rides the leading edge, and the edge reaches the right-hand
  // side at the end of every run — so the label turns round to stay inside
  // the box, and drops under the point when the point is up against the
  // ceiling.
  const near = last !== null && last.x > 0.62;
  const under = last !== null && last.y < 0.18;
  const real = plot.real === null ? null : py(plot.real);
  // Real time on the right-hand axis is a whole number of frames a second by
  // construction (it is one over the step), and it is the one gradation worth
  // a third label — printed only where it has room between the two ends of
  // the axis it sits on.
  const realFps =
    real !== null && real - PLOT.y0 > LABEL_GAP && PLOT.y1 - real > LABEL_GAP ? real : null;
  return (
    <svg
      class={full ? "bench-plot bench-plot-full" : "bench-plot"}
      viewBox={`0 0 ${PLOT.w} ${PLOT.h}`}
      role="img"
    >
      {/* Its own ground. The card is see-through and what is behind it is a
          race at speed — a line drawn straight onto that is a line read
          against moving scenery. */}
      <defs>
        <linearGradient id="bench-plot-wash" x1="0" y1="0" x2="0" y2="1">
          <stop class="bench-plot-wash-top" offset="0" />
          <stop class="bench-plot-wash-foot" offset="1" />
        </linearGradient>
      </defs>
      <rect
        class="bench-plot-panel"
        x={0.5}
        y={0.5}
        width={PLOT.w - 1}
        height={PLOT.h - 1}
        rx={5}
      />
      {/* THE TWO AXES, and what their ends are worth. The floor is always
          zero on both — a graph with a cropped bottom would make every
          machine look like every other one — and the ceiling is whatever this
          run needed, said in index on the left and in frames a second on the
          right. Each is tinted like the line that is read against it, which
          is the whole legend the card needs. */}
      <line class="bench-plot-axis" x1={PLOT.x0} y1={PLOT.y1} x2={PLOT.x1} y2={PLOT.y1} />
      <line class="bench-plot-axis" x1={PLOT.x0} y1={PLOT.y0} x2={PLOT.x0} y2={PLOT.y1} />
      <line class="bench-plot-axis" x1={PLOT.x1} y1={PLOT.y0} x2={PLOT.x1} y2={PLOT.y1} />
      <line class="bench-plot-grid" x1={PLOT.x0} y1={PLOT.y0} x2={PLOT.x1} y2={PLOT.y0} />
      <text
        class="bench-plot-tick bench-plot-tick-index"
        x={PLOT.x0 - 5}
        y={PLOT.y0 + 3}
        text-anchor="end"
      >
        {plot.top}
      </text>
      <text
        class="bench-plot-unit bench-plot-tick-index"
        x={PLOT.x0 - 5}
        y={PLOT.y0 + 13}
        text-anchor="end"
      >
        {STRINGS.benchIndexUnit}
      </text>
      <text class="bench-plot-tick" x={PLOT.x0 - 5} y={PLOT.y1 + 3} text-anchor="end">
        0
      </text>
      <text class="bench-plot-tick bench-plot-tick-rate" x={PLOT.x1 + 5} y={PLOT.y0 + 3}>
        {Math.round(plot.topFps)}
      </text>
      <text class="bench-plot-unit bench-plot-tick-rate" x={PLOT.x1 + 5} y={PLOT.y0 + 13}>
        {STRINGS.optFps}
      </text>
      <text class="bench-plot-tick" x={PLOT.x1 + 5} y={PLOT.y1 + 3}>
        0
      </text>
      {/* Real time, where the axis reaches it: the one gradation on this
          scale that means something without a second machine to compare
          against — the race drawn as fast as it is ridden. It is a mark on
          BOTH scales, so it wears neither line's colour. It goes unnamed
          where the ceiling has come down onto it, rather than printing two
          labels over each other. */}
      {real !== null && (
        <>
          <line class="bench-plot-real" x1={PLOT.x0} y1={real} x2={PLOT.x1} y2={real} />
          {real - PLOT.y0 > LABEL_GAP && (
            <text class="bench-plot-tick bench-plot-tick-real" x={PLOT.x0 + 5} y={real - 5}>
              {STRINGS.benchRealTime}
            </text>
          )}
          {realFps !== null && (
            <text class="bench-plot-tick bench-plot-tick-rate" x={PLOT.x1 + 5} y={realFps + 3}>
              {Math.round((plot.topFps * INDEX_REAL) / plot.top)}
            </text>
          )}
        </>
      )}
      {last !== null && <polygon class="bench-plot-area" points={area} />}
      {/* The rate goes on before the score and stays a hairline: it is the
          busier line by far, and a run is read as a score with a rate around
          it rather than the other way round. */}
      {last !== null && <polyline class="bench-plot-rate" points={rate} />}
      {last !== null && <polyline class="bench-plot-line" points={line} />}
      {last !== null && <circle class="bench-plot-head" cx={px(last.x)} cy={py(last.y)} r={3.4} />}
      {last !== null && (
        <text
          class="bench-plot-score"
          x={near ? px(last.x) - 7 : px(last.x) + 7}
          y={under ? py(last.y) + 16 : py(last.y) - 9}
          text-anchor={near ? "end" : "start"}
        >
          {Math.round(plot.index)}
        </text>
      )}
    </svg>
  );
}

/** WHAT THE PICTURE WAS SET TO — the six rows OPTIONS ▸ VIDEO owns, on the
 * card once the run is over.
 *
 * They are the one thing the benchmark deliberately does NOT pin, which is
 * what makes the whole tool useful: run it, move a row, run it again, and the
 * difference is what that row costs on this machine. A score with the
 * settings printed under it is a screenshot that can be compared against
 * another screenshot months later; without them it is a number whose
 * conditions live in somebody's memory of what they pressed. */
function BenchmarkVideo({ video }: { video: VideoSettings }) {
  return (
    <div class="bench-video">
      {pictureRows(video).map((row) => (
        <div class="bench-video-cell" key={row.label}>
          <span class="bench-video-label">{row.label}</span>
          <span class="bench-video-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

/** THE GRAPH, GIVEN THE SCREEN. The card carries a score, the conditions and
 * six VIDEO rows as well, so the graph on it is a panel; this is the same
 * graph with nothing else on the page.
 *
 * It REPLACES the card rather than sitting over it: a graph that is the whole
 * point of the view has no business fighting for room with the card it came
 * from. */
export function BenchmarkFull({
  plot,
  step,
  sub,
  report,
  onClose,
}: {
  plot: BenchPlot;
  /** Seconds of game a frame advanced, for the fps under the index. Passed
   * rather than read off the plan: a run out of history was measured on the
   * build it was measured on, and drawing it on today's step would relabel
   * somebody else's measurement. */
  step: number;
  /** The conditions, already worded — the live card and a stored run word
   * them from different places and neither should have to know about the
   * other. */
  sub: string;
  /** This run as text, for the copy press in the head. Same control and same
   * corner as the card this view came from, because it is the same run: a
   * graph that made you close it to reach the report would be asking for the
   * one press nobody wants to make while looking at the thing. */
  report: () => string;
  onClose: () => void;
}) {
  return (
    <div class="bench-full">
      <MenuHead
        back={onClose}
        backLabel={STRINGS.benchClose}
        title={STRINGS.benchScoreLine(
          Math.round(plot.index),
          Math.round(fpsOfIndex(plot.index, step)),
        )}
        sub={sub}
        action={
          <CopyButton
            label={STRINGS.benchCopyReport}
            text={report}
            className="opt-reset bench-copy"
          />
        }
      />
      <BenchmarkPlot plot={plot} full />
    </div>
  );
}

/** THE BENCHMARK'S CARD — over the race while it is being measured, and the
 * answer once it is. What it says at every moment is one number: this
 * machine's INDEX, where 100 is the race drawn in the time it takes to ride
 * (`benchmark-index.ts`), with the same figure in frames a second under it
 * because that is the unit anybody has a feel for.
 *
 * It is a graph and not a counter because the number is only worth anything
 * once it has settled, and a figure ticking over says nothing about whether
 * it has. The lines show it converging — and show the machine's bad moments,
 * and WHERE in the race they were, which no figure at the end can.
 *
 * And under it, once there is an answer, THE CONDITIONS: the buffer the
 * frames were drawn into, the field that was on the water, and the six VIDEO
 * rows the run deliberately did not pin. */
export function BenchmarkCard({
  status,
  video,
  onAgain,
  onHistory,
  onLeave,
}: {
  status: BenchmarkStatus;
  /** What the picture was set to. Read at render rather than captured with
   * the run: there is no way to the options from under this card, so the
   * settings on screen are the settings the frames were drawn with. */
  video: VideoSettings;
  onAgain: () => void;
  /** Out to the list of every run this machine has kept — the comparison the
   * card itself cannot make, since it only ever holds one run. */
  onHistory: () => void;
  onLeave: () => void;
}) {
  const done = status.phase === "done";
  const plot = benchPlot(status.samples, BENCHMARK.frames, BENCHMARK.step);
  const conditions = STRINGS.benchConditions(
    benchmarkShore(),
    status.craft,
    status.width,
    status.height,
  );
  // Read at the end and not before: the run has been written down by the time
  // there is a score to show (`App.tsx`), and a card counting the history on
  // every reading would parse the whole store a hundred and twenty times
  // through the measurement it is sitting on.
  const kept = done ? benchmarkRuns().length : 0;
  const [full, setFull] = useState(false);
  /** THIS RUN AS TEXT. The card answers "is this machine coping"; this answers
   * "what was the frame doing", which is where somebody making the game
   * faster has to start — and a score pasted without its draw calls and its
   * conditions is a bug report nobody can act on.
   *
   * Built once for both heads: the card's and the full-screen graph's copy
   * presses are the same press on the same run. */
  const report = (): string =>
    benchmarkReport({
      conditions: {
        shore: benchmarkShore(),
        craft: status.craft,
        width: status.width,
        height: status.height,
        pixelRatio: devicePixelRatio,
        picture: pictureRows(video),
        plan: plannedRows(),
      },
      samples: status.samples,
      costs: status.costs,
      scene: status.scene,
      step: BENCHMARK.step,
      frames: BENCHMARK.frames,
    });
  if (done && full) {
    return (
      <div class="menu bench-layer">
        <BenchmarkFull
          plot={plot}
          step={BENCHMARK.step}
          sub={conditions}
          report={report}
          onClose={() => setFull(false)}
        />
      </div>
    );
  }
  return (
    <div class="menu bench-layer">
      <div class="menu-card bench">
        {/* THE HEAD: the way out on the left, where every other card in these
            menus keeps it, and the copy press on the right. Mid-run the way
            out still says STOP, because that is what it costs. */}
        <MenuHead
          back={onLeave}
          backLabel={done ? STRINGS.menuDeveloper : STRINGS.benchStop}
          title={STRINGS.benchTitle}
          sub={conditions}
          action={
            done ? (
              <CopyButton
                label={STRINGS.benchCopy}
                hint={STRINGS.benchCopyReport}
                text={report}
                className="opt-reset bench-copy"
              />
            ) : undefined
          }
        />
        {done && (
          <div class="bench-score">
            <span class="bench-score-label">{STRINGS.benchIndexUnit}</span>
            {Math.round(status.index)}
            <span class="bench-score-rate">
              {STRINGS.benchFpsAverage(Math.round(fpsOfIndex(status.index, BENCHMARK.step)))}
            </span>
          </div>
        )}
        {done ? (
          // A press rather than a picture, once there is something to look at:
          // a hundred and twenty readings on a card are two millimetres apart,
          // and the kink worth seeing is smaller than that.
          <button
            type="button"
            class="bench-plot-open"
            onClick={() => setFull(true)}
            title={STRINGS.benchEnlargeHint}
          >
            <BenchmarkPlot plot={plot} />
            <span class="bench-plot-more">{STRINGS.benchEnlarge}</span>
          </button>
        ) : (
          <BenchmarkPlot plot={plot} />
        )}
        {done && <BenchmarkVideo video={video} />}
        {/* A browser stops drawing a page nobody is looking at, and a clock
            that kept running through it would be timing the machine's
            screensaver. */}
        {!done && <div class="bench-note">{STRINGS.benchKeepInFront}</div>}
        {done && (
          <button type="button" class="menu-item menu-item-dev" onClick={onHistory}>
            {STRINGS.benchHistory}
            <span class="menu-item-sub">{STRINGS.benchHistorySub(kept)}</span>
          </button>
        )}
        {done && (
          // The cursor's landing, and the card's way ON. Without the mark
          // `landing()` takes the first control that is not the way back —
          // which on a finished card is HISTORY, so a controller would open
          // a list instead of offering the second run the whole tool is for.
          <button
            type="button"
            class="menu-item menu-item-start"
            data-nav-focus
            data-nav-next
            onClick={onAgain}
          >
            {STRINGS.benchAgain}
          </button>
        )}
      </div>
    </div>
  );
}

/** ONE RUN ON THE LIST — the score, what the picture was set to when it was
 * scored, and the median frame behind it.
 *
 * THE SETTINGS ARE ON THE ROW because that is the comparison: a list of
 * scores with the conditions somewhere else is a list nobody can read, and by
 * the third run the eye has stopped going to look them up. As glyphs they are
 * six characters (`benchmark-sheet.ts`), which is the only way they fit
 * beside a number on a phone — and the same six characters the copied sheet
 * carries, so the screen and the paste are one artefact.
 *
 * The colour is a second reading of the same thing and never a first: every
 * rung is already a different height, so the row survives a colour-blind
 * reader, a greyscale screenshot and the trip through a text field. */
function BenchmarkRow({ run, onOpen }: { run: BenchmarkRecord; onOpen: () => void }) {
  const reads = pictureGlyphs(run.picture);
  return (
    <button type="button" class="bench-run" onClick={onOpen} title={STRINGS.benchRunHint}>
      <span class="bench-run-score">
        <span class="bench-run-index">{Math.round(run.index)}</span>
        <span class="bench-run-fps">
          {Math.round(fpsOfIndex(run.index, run.step))} {STRINGS.optFps}
        </span>
      </span>
      <span class="bench-run-code">
        {reads.map((read, i) => (
          <span
            key={run.picture[i].label}
            class={read.rung < 0 ? "bench-rung bench-rung-x" : `bench-rung bench-rung-${read.rung}`}
            title={`${run.picture[i].label} ${run.picture[i].value}`}
          >
            {read.glyph}
          </span>
        ))}
      </span>
      <span class="bench-run-cost">{STRINGS.benchDraws(big(runDraws(run)))}</span>
      <span class="bench-run-when">
        {runWhen(run.at)}
        <span class="bench-run-buffer">
          {run.width}×{run.height}
        </span>
      </span>
    </button>
  );
}

/** WHAT THE GLYPHS MEAN, under the list — the same legend the copied sheet
 * prints at its bottom, off the same tables, tinted because a screen can
 * afford it. */
function BenchmarkLegend({ runs }: { runs: readonly BenchmarkRecord[] }) {
  const columns = pictureLegend(runs);
  if (columns.length === 0) return null;
  return (
    <div class="bench-legend">
      <div class="bench-legend-head">{STRINGS.benchLegendHead}</div>
      {columns.map((column, at) => (
        <div class="bench-legend-row" key={column.label}>
          <span class="bench-legend-label">
            {at + 1} {column.label}
          </span>
          <span class="bench-legend-stops">
            {column.ladders.flat().map((rung) => (
              <span class="bench-legend-stop" key={rung.label}>
                <span class={`bench-rung bench-rung-${rung.rung}`}>{rung.glyph}</span>
                {rung.label}
              </span>
            ))}
            {column.unknown && (
              <span class="bench-legend-stop">
                <span class="bench-rung bench-rung-x">?</span>
                {STRINGS.benchLegendUnknown}
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** THE HISTORY — every run this machine has scored, and the way back into any
 * one of them.
 *
 * The benchmark is a comparison instrument: its number means nothing except
 * against a second number taken on the same machine with one row of OPTIONS ▸
 * VIDEO moved. Without this page that second number had to be remembered,
 * written down or screenshotted between two runs — so the method the whole
 * tool was built for rested on somebody having planned for it. Here the runs
 * are simply kept (`benchmark-history.ts`), and the comparison is two lines
 * of a list.
 *
 * A row opens the run back up: the graph it drew, full screen, and its debug
 * report on the clipboard — the same report the card offered on the day, from
 * the readings that were stored rather than from anything recomputed. */
export function BenchmarkHistoryPage({ onBack }: { onBack: () => void }) {
  // Read once per render rather than subscribed: the store is written by the
  // end of a run, and nothing writes it while this page is up. `cleared` is
  // what makes the wipe show — there is no other reason for this page to
  // render again.
  const [cleared, setCleared] = useState(0);
  const runs = benchmarkRuns();
  const [open, setOpen] = useState<number | null>(null);
  const showing = runs.find((run) => run.at === open) ?? null;

  if (showing) {
    const plot = benchPlot(showing.samples, showing.frames, showing.step);
    return (
      <div class="menu-card menu-card-bench">
        <BenchmarkFull
          plot={plot}
          step={showing.step}
          sub={`${STRINGS.benchConditions(showing.shore, showing.craft, showing.width, showing.height)} · ${runWhen(showing.at)}`}
          report={() =>
            benchmarkReport({
              conditions: {
                shore: showing.shore,
                craft: showing.craft,
                width: showing.width,
                height: showing.height,
                pixelRatio: showing.pixelRatio,
                picture: showing.picture,
                plan: showing.plan,
              },
              samples: showing.samples,
              costs: showing.costs,
              scene: showing.scene,
              step: showing.step,
              frames: showing.frames,
            })
          }
          onClose={() => setOpen(null)}
        />
      </div>
    );
  }

  return (
    <div class="menu-card menu-card-bench" key={cleared}>
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuDeveloper}
        title={STRINGS.benchHistoryTitle}
        sub={STRINGS.benchHistoryBilling(runs.length)}
        action={
          runs.length > 0 ? (
            <CopyButton
              label={STRINGS.benchCopySheet}
              text={() => benchmarkSheet(runs)}
              className="opt-reset bench-copy"
            />
          ) : undefined
        }
      />
      {runs.length === 0 ? (
        <div class="bench-note">{STRINGS.benchHistoryEmpty}</div>
      ) : (
        <div class="bench-runs">
          {runs.map((run) => (
            <BenchmarkRow key={run.at} run={run} onOpen={() => setOpen(run.at)} />
          ))}
        </div>
      )}
      <BenchmarkLegend runs={runs} />
      {runs.length > 0 && (
        <button
          type="button"
          class="opt-reset opt-reset-quiet"
          onClick={() => {
            clearBenchmarks();
            setOpen(null);
            setCleared((n) => n + 1);
          }}
        >
          {STRINGS.benchClear}
        </button>
      )}
    </div>
  );
}
