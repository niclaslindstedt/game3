// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD: chunky arcade chrome over the canvas. Reads a low-rate snapshot
// (the app refreshes it ~12×/s — the canvas is the 60 fps surface, the HUD
// is not) and lays out everything drawn over the sea:
//
//   top left      the run clock, the gate count
//   top right     the wind vane, the RESET button and the new-build mark
//                 on the days there is one, and under them the MINIMAP —
//                 the coast, the gates and the craft on it
//   bottom left   the rev bar and the speed
//   bottom right  the air time while the hull is off the water, and the
//                 news column — a split, a missed gate, a dive
//
// …and under the minimap, when they have been asked for, the DIAGNOSTICS:
// the frame rate (OPTIONS ▸ SHOW FPS) and what the frame cost (the developer
// page's FRAME COST). Neither is a fact about the RUN, so neither joins the
// readouts that are — and the right edge under the map is the only stretch of
// this screen with room for a line that appears out of nowhere.
//
// The thumb zones it hangs under all that are next door in hud-touch.tsx:
// they are the one part of this screen that does NOT run off the snapshot
// (they write into the input manager at pointer rate), and that is a
// different job from drawing a readout. Every word here comes from
// strings.ts (§39.1).

import { REPO_URL } from "../identity.ts";
import { formatTime } from "../lib/util.ts";
import { RevBar } from "./hud-dial.tsx";
import { BarZone, LeverZone } from "./hud-touch.tsx";
import type { InputManager } from "./input.ts";
import { Minimap } from "./minimap.tsx";
import type { FrameCost } from "./renderer.ts";
import type { HudSnapshot } from "./snapshot.ts";
import { STRINGS } from "./strings.ts";
import { UpdateButton } from "./update-button.tsx";

/** A line in the news column: what it says, its colour, and an id the list
 * is keyed on so a line leaving does not restart the animation of the one
 * under it. */
export type HudFlash = {
  id: number;
  text: string;
  tone: "good" | "bad" | "info";
};

/** Whether the device has a touchscreen to put the thumb zones on. A
 * laptop with one reports it and gets them; a desktop does not. */
export function hasTouch(): boolean {
  return typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
}

function WindVane({ angle, ms }: { angle: number; ms: number }) {
  const deg = (angle * 180) / Math.PI;
  return (
    <div class="hud-chip hud-wind" title={STRINGS.windLabel}>
      <span class="hud-wind-row">
        <svg class="hud-vane" viewBox="0 0 24 24" aria-hidden="true">
          <g style={{ transform: `rotate(${deg.toFixed(1)}deg)` }}>
            <path d="M12 2 L17 12 L13 10.5 L13 22 L11 22 L11 10.5 L7 12 Z" fill="currentColor" />
          </g>
        </svg>
        <span>{STRINGS.wind(ms)}</span>
      </span>
      <span class="hud-chip-sub">{STRINGS.windLabel}</span>
    </div>
  );
}

export function Hud({
  snap,
  flashes,
  touch,
  input,
  paused,
  fps,
  cost,
  onReset,
}: {
  snap: HudSnapshot;
  flashes: HudFlash[];
  /** Draw the thumb zones. */
  touch: boolean;
  input: InputManager;
  paused: boolean;
  /** The smoothed frame rate, or null with OPTIONS ▸ FPS off. Not part of
   * the snapshot: it is a fact about the machine rather than about the run,
   * and `frame-rate.ts` is where it is worked out. */
  fps: number | null;
  /** What the last frame cost, or null with the developer page's FRAME COST
   * row off. */
  cost: FrameCost | null;
  onReset: () => void;
}) {
  return (
    <div
      class="hud"
      data-air={snap.airborne ? "1" : undefined}
      data-finished={snap.finished ? "1" : undefined}
    >
      <div class="hud-top">
        <div class="hud-clock">
          <span class="hud-clock-time">{formatTime(snap.time)}</span>
          <span class="hud-chip-sub">{STRINGS.clockLabel}</span>
        </div>
        <div class="hud-chip">
          <span>{STRINGS.gates(snap.passed, snap.gates)}</span>
          <span class="hud-chip-sub">{STRINGS.gatesLabel}</span>
        </div>
      </div>

      <div class="hud-topright">
        <div class="hud-topright-row">
          <WindVane angle={snap.windAngle} ms={snap.windMs} />
          <button
            type="button"
            class="hud-mini"
            title={STRINGS.resetTitle}
            onClick={onReset}
            // A button that keeps the focus keeps the next Enter, and the
            // next Enter is the restart.
            onMouseUp={(e) => (e.currentTarget as HTMLButtonElement).blur()}
          >
            {STRINGS.reset}
          </button>
          {/* Nothing on the days there is no new build, which is nearly all
              of them: it draws itself or it draws nothing. */}
          <UpdateButton />
        </div>
        {/* Under the readouts rather than beside them: the map is the one
            thing up here that is LOOKED at rather than read, and it wants a
            square of its own clear of the wind chip's baseline. */}
        <Minimap map={snap.minimap} />
        {/* THE DIAGNOSTICS, under the map: the frame rate (OPTIONS ▸ FPS)
            and what the frame cost (the developer page's FRAME COST). They
            hang here rather than in the build corner because that corner is
            directly under the speed cluster, and a second line there lands
            across the speedo on a phone. This edge is the one with room —
            clear of both thumb zones, and nothing under the map wants it. */}
        {(fps !== null || cost !== null) && (
          <div class="hud-meters">
            {fps !== null && <span class="hud-meter">{STRINGS.fps(fps)}</span>}
            {cost !== null && (
              <span class="hud-meter">
                {STRINGS.frameCost(cost.waterMs, cost.calls, cost.triangles)}
              </span>
            )}
          </div>
        )}
      </div>

      <div class="hud-speed">
        <div class="hud-revs-row">
          <RevBar rpm={snap.rpm} idle={snap.idle} />
          <span class="hud-chip-sub">{STRINGS.revs}</span>
        </div>
        <div class="hud-cluster">
          <span class="hud-speed-num">{Math.round(snap.speedKmh)}</span>
          <span class="hud-speed-unit">{STRINGS.speedUnit}</span>
        </div>
      </div>

      <div class="hud-right">
        {snap.airborne && (
          <div class="hud-chip hud-air">
            <span class="hud-air-num">{STRINGS.air(snap.airTime)}</span>
            <span class="hud-chip-sub">{STRINGS.airLabel}</span>
          </div>
        )}
        <div class="hud-flashes">
          {flashes.map((f) => (
            <span key={f.id} class={`hud-flash hud-flash-${f.tone}`}>
              {f.text}
            </span>
          ))}
        </div>
      </div>

      {/* §38.3: the build says what it is — version and commit, linked to
          the source — and beside it the two words that name this frame. */}
      <div class="hud-build">
        <span>
          {STRINGS.stage(snap.seed)} · {snap.craft.toUpperCase()}
        </span>
        <a href={`${REPO_URL}/commit/${__COMMIT_SHA__}`} target="_blank" rel="noreferrer">
          {__BUILD_LABEL__}
        </a>
      </div>

      {paused && (
        <div class="hud-center">
          <div class="hud-card">
            <span class="hud-card-title">{STRINGS.paused}</span>
            <span class="hud-card-note">{STRINGS.pausedNote}</span>
          </div>
        </div>
      )}

      {touch && (
        <div class="hud-touch">
          <BarZone touch={input.touch} />
          <LeverZone touch={input.touch} />
        </div>
      )}
    </div>
  );
}
