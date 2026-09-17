// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY BAR — the one strip on screen while a recording is being watched
// (`replay.ts`).
//
// A REPLAY IS THE GAME'S OWN FRAMES: the same shore, the same hull, the same
// physics, ridden off the controls the run was ridden on. So there is nothing
// to add to the HUD — the clock, the dial, the gate count and the map all
// read the recording exactly as they read the run, because it IS the run —
// and the only two things a WATCHER has that a rider does not are the answers
// to "what am I looking at" and "how do I get out".
//
// TOP CENTRE, between the corners the HUD already claims — the clock and the
// shore distance on the left, the place and the gate count on the right — and
// the bar gives up its second line before it reaches either.
//
// AND THE ONE THING THE PICTURE CANNOT SAY FOR ITSELF: that it is running
// slow. Slow motion is a property of the shot rather than a setting
// (`replay-shots.ts`), so a rider who is not expecting it reads a third-speed
// backflip as a machine that has started dropping frames — which is the
// difference between a feature and a bug, and it is one word.

import type { ReplayBill } from "./replay.ts";
import { STRINGS } from "./strings.ts";

export type ReplayBarProps = {
  /** What the recording is, in facts (`replay.ts`) — this file words it. */
  bill: ReplayBill;
  /** How far through it is, 0..1. */
  through: number;
  /** Whether the picture is running slow right now. */
  slow: boolean;
  /** Leave the recording for the front door. */
  onLeave: () => void;
};

export function ReplayBar({ bill, through, slow, onLeave }: ReplayBarProps) {
  return (
    <div class="hud-replay">
      <div class="hud-replay-text">
        <div class="hud-replay-label">
          {STRINGS.replayLabel}
          {slow && <span class="hud-replay-slow">{STRINGS.replaySlow}</span>}
        </div>
        <div class="hud-replay-title">{STRINGS.replayTitle(bill)}</div>
        <div class="hud-replay-line">{STRINGS.replayLine(bill)}</div>
        {/* How far through, as a rule rather than a scrubber: there is
            nothing to drag to — the recording is the engine being stepped,
            and a seek would mean re-riding every step up to the mark. */}
        <div class="hud-replay-bar">
          <div class="hud-replay-fill" style={{ transform: `scaleX(${through})` }} />
        </div>
      </div>
      <div class="hud-replay-acts">
        {/* `data-nav-back` is what a controller's B button presses
            (`menu-nav.ts`) — the way out of a recording is the way out of any
            card. */}
        <button type="button" class="hud-mini hud-replay-exit" data-nav-back onClick={onLeave}>
          {STRINGS.replayExit}
        </button>
        <div class="hud-replay-note">{STRINGS.replayNote}</div>
      </div>
    </div>
  );
}
