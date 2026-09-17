// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FINISH PLATE — the card over a run that is over (`run-settle.ts` is
// what fills it in).
//
// A FINISHED RUN COASTS: `run.ts` hands the craft neutral from the line or
// the buzzer on, so the throttle, the bars and the reset all stop answering.
// That is the run being over rather than the game hanging — but a plate that
// only stated the figure left the rider holding a dead machine with nothing
// on screen saying what to do about it, which reads as a freeze and was
// reported as one. So it says what happened in a word and then offers the
// ways on as PRESSES: ride it again, watch it back where there is a
// recording, or leave for the front door.
//
// IT PRESSES THE GAME'S OWN BUTTONS AND ADDS NONE — all three are
// `run-surfaces.ts`'s, the same three the pause card presses, so they wear
// the pause card's words and RIDE AGAIN is the very line the B key lands on.
// That is the rule the desktop shell's menu bar is held to as well: a second
// way to reach a button, never a second button.
//
// ITS OWN LAYER, drawn by App.tsx outside the HUD's switch and gated here
// rather than there, so the one rule that decides whether it is up is written
// where the card is.

import type { RunSurfaces } from "./run-surfaces.ts";
import { STRINGS } from "./strings.ts";

/** THE RESULT, over a finished run: the headline in the mode's own currency
 * (a place, a time, a score), a second line under it (the time behind a
 * place, the standing best behind a figure), and whether the run is the best
 * this shore has seen. Composed by the app, which is the one thing that knows
 * the record book (`records.ts`); this file draws it. */
export type HudResult = {
  headline: string;
  detail: string | null;
  record: boolean;
};

export function ResultPlate({
  result,
  touch,
  replay,
  surfaces,
}: {
  /** The finish, or null while there is nothing to say — which is every
   * frame of a run being ridden, and every frame the plate is not the
   * player's to press: under the pause card, which offers the same three in
   * its own words, and with the tab away. */
  result: HudResult | null;
  /** Whether there is a thumb on the screen — the key note is for the other
   * kind of player, and the presses are for both. */
  touch: boolean;
  /** Whether the run left a recording to watch. A free ride and a staged
   * scene leave none, so the plate never offers a press that would do
   * nothing. */
  replay: boolean;
  surfaces: RunSurfaces;
}) {
  if (result === null) return null;
  return (
    <div class="hud hud-result-layer">
      <div class="hud-center">
        <div class={`hud-card hud-result${result.record ? " hud-result-record" : ""}`}>
          {/* WHAT HAPPENED, over what it was worth: the figure on its own is
              the line that read as nothing having happened at all. */}
          <span class="hud-card-note hud-result-label">{STRINGS.resultTitle}</span>
          <span class="hud-card-title">{result.headline}</span>
          {result.detail && <span class="hud-card-note">{result.detail}</span>}
          {result.record && <span class="hud-result-best">{STRINGS.resultNewBest}</span>}
          {/* THE WAYS ON. Riding again first — it is what a rider wants most
              of the time and the only one of the three with a key behind it —
              then the recording where there is one, then the door. */}
          <div class="hud-result-acts">
            <button
              type="button"
              class="hud-mini hud-result-act"
              onClick={() => surfaces.restart()}
            >
              {STRINGS.resultAgain}
            </button>
            {replay && (
              <button
                type="button"
                class="hud-mini hud-result-act"
                onClick={() => surfaces.watch()}
              >
                {STRINGS.pauseReplay}
              </button>
            )}
            <button type="button" class="hud-mini hud-result-act" onClick={() => surfaces.toMenu()}>
              {STRINGS.pauseMainMenu}
            </button>
          </div>
          {!touch && <span class="hud-card-note hud-result-note">{STRINGS.resultNote}</span>}
        </div>
      </div>
    </div>
  );
}
