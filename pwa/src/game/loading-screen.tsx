// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARD OVER A RUN BEING STOOD UP.
//
// What is behind it is `run-loader.ts`: the level searched and compiled, two
// heightfields baked, the terrain and the rocks and the gates built off them,
// the water mesh laid, and every shader in the scene compiled before the
// first frame the player is asked to ride. Seconds of work, and the
// alternative to a card over it is a frozen page and then a run that stutters
// while the rest arrives.
//
// The card is the app's own MARK — the crest, drawn over and over
// (`mark-wave.tsx`) — with the word under it, then the phase being paid for
// and where it sits in the count, then a bar for that phase alone.
//
// THE COUNT IS OF PHASES, NEVER OF SECONDS. A load's cost is dominated by
// building the shore, which finishes when it finishes, so one bar across the
// whole load would reach nine tenths and sit there. A bar PER PHASE only ever
// has to be right about the phase it is under, and `(2/3)` beside it is a
// fact about the plan rather than a promise about the clock.
//
// A bar is filled one of three ways, and which one is not a style choice — it
// is how much this phase can honestly say about itself:
//
//   measured  — the work counts itself (rocks stood up out of a field), so
//               the fill sits at exactly that.
//   estimated — nothing inside the phase can be counted, but the same phase
//               on this machine took a known time last time, so the fill runs
//               against that clock. It is held short of full until the phase
//               really ends, because an estimate that reached the end of the
//               bar and stopped would read as a hung game.
//   sweeping  — a machine that has never stood a run up has neither. A band
//               travels the bar and claims nothing at all.
//
// EVERY ONE OF THEM IS A TRANSFORM, and that is the whole reason the card
// works. The phases that need a bar most are single indivisible calls that
// hold the main thread for seconds at a stretch, and anything animated on
// that thread — a width, a stroke — freezes solid for exactly as long as the
// player most needs to see something moving. Browsers run transforms on the
// compositor, so these keep going through a block that stops everything else.

import { MarkWave } from "./mark-wave.tsx";
import type { LoadPhase } from "./run-loader.ts";
import { STRINGS } from "./strings.ts";

export function LoadingScreen({ leaving, phase }: { leaving: boolean; phase: LoadPhase | null }) {
  return (
    <div class={`loading${leaving ? " leaving" : ""}`} aria-live="polite" aria-busy={!leaving}>
      <div class="loading-card">
        <MarkWave lay="loop" className="loading-mark" title={STRINGS.loading} />
        <p class="loading-word">{STRINGS.loading}</p>
        {/* Both held open whether or not there is a phase to name: a line and
            a bar arriving on the second frame would shift the mark above
            them. */}
        <p class="loading-step">
          {phase ? STRINGS.loadStep(phase.label, phase.at, phase.of) : " "}
        </p>
        <LoadBar phase={phase} />
      </div>
    </div>
  );
}

/** How far into a phase's own bar the estimate is allowed to run. The last
 * tenth belongs to the phase actually ending: a bar that arrived at the far
 * end and sat there is the exact reading — "this is finished and nothing is
 * happening" — that a card exists to avoid giving. */
const ESTIMATE_FILL = 0.9;

function LoadBar({ phase }: { phase: LoadPhase | null }) {
  // Keyed on the phase so each one starts its own bar from nothing: without
  // it the estimate's animation would be inherited part-run by the phase
  // after it, and a measured fill would slide backwards from the last one's
  // full bar rather than growing from empty.
  const key = phase ? `${phase.at}/${phase.of}` : "none";
  const measured = phase?.done ?? null;
  const estimateMs = measured === null ? (phase?.expectedMs ?? null) : null;
  const mode = measured !== null ? "measured" : estimateMs !== null ? "estimated" : "sweeping";
  return (
    <div class={`loading-bar loading-bar-${mode}`} aria-hidden="true">
      <div
        key={key}
        class="loading-bar-fill"
        style={
          measured !== null
            ? { transform: `scaleX(${measured})` }
            : estimateMs !== null
              ? {
                  animationDuration: `${Math.max(1, estimateMs)}ms`,
                  // The estimate's own ceiling, read by the keyframes so the
                  // fraction lives here rather than twice over in the CSS.
                  "--load-fill": ESTIMATE_FILL,
                }
              : undefined
        }
      />
    </div>
  );
}
