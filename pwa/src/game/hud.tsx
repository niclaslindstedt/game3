// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD: chunky arcade chrome over the canvas. Reads a low-rate snapshot
// (the app refreshes it ~12×/s — the canvas is the 60 fps surface, the HUD
// is not) and lays out everything drawn over the sea:
//
//   top left      the run clock and the gate count, with the WIND VANE
//                 under them — the vane is a fact about the water rather
//                 than a press, so it belongs beside the two readouts that
//                 say how the run is going, not on the row of buttons —
//                 and the SUN'S CLOCK under that: the hour the run has
//                 reached and the word for its light, because a run rides
//                 an hour a minute into whatever the season has
//   top right     the MINIMAP — the coast, the gates and the craft on it,
//                 and the press that holds the run and puts the pause card
//                 up — with the RESET and CAMERA presses hung under it, and
//                 the new-build mark over it on the days there is one
//   bottom left   the ALTITUDE TAPE, the rev bar and the speed — the
//                 corner's three instruments, the tape on top because a
//                 climb is a vertical reading and this is the only edge
//                 with the room for one
//   top centre    the AIR CLOCK, while the hull is off the water — the one
//                 number a rider is trying to make go up, so it sits where
//                 he is already looking to aim the landing — with the COMBO
//                 under it: what the flight and the flips over it are worth
//                 so far, and the multiplier they will be paid at
//   bottom right  the news column — a split, a missed gate, a dive
//
// …and under the minimap, when they have been asked for, the DIAGNOSTICS:
// the frame rate (OPTIONS ▸ FPS) and what the frame cost (the developer
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
import { hourLabel } from "./daylight.ts";
import { HudActions } from "./hud-actions.tsx";
import { AltitudeTape, RevBar } from "./hud-dial.tsx";
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

/** THE RESULT PLATE, over a finished run: the headline in the mode's own
 * currency (a place, a time, a score), a second line under it (the time
 * behind a place, the standing best behind a figure), and whether the run
 * is the best this shore has seen. Composed by the app, which is the one
 * thing that knows the record book (`records.ts`); the HUD draws it. */
export type HudResult = {
  headline: string;
  detail: string | null;
  record: boolean;
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
  away,
  result,
  fps,
  cost,
  onReset,
  onCamera,
  onPause,
}: {
  snap: HudSnapshot;
  flashes: HudFlash[];
  /** The run's result, once it has one — null while it is being ridden. */
  result: HudResult | null;
  /** Draw the thumb zones. */
  touch: boolean;
  input: InputManager;
  /** The TAB is away and the clock with it (§37.3) — not the pause card,
   * which is a surface of its own (`menu-pause.tsx`) and stands over all of
   * this. The two share a word and nothing else. */
  away: boolean;
  /** The smoothed frame rate, or null with OPTIONS ▸ FPS off. Not part of
   * the snapshot: it is a fact about the machine rather than about the run,
   * and `frame-rate.ts` is where it is worked out. */
  fps: number | null;
  /** What the last frame cost, or null with the developer page's FRAME COST
   * row off. */
  cost: FrameCost | null;
  onReset: () => void;
  /** Walk the camera ladder one rung — the C key's other door. */
  onCamera: () => void;
  /** Hold the run and put the pause card up. The MINIMAP is what presses
   * it — see minimap.tsx for why that is the button. */
  onPause: () => void;
}) {
  // THE NIGHT DRESSING's one number, 0..1, on the root as `--hud-dark` —
  // the same switch the craft's lamp is on (`snapshot.ts`, `lampsAt`).
  // Nothing in this file branches on it: every colour the dip moves is a
  // custom property declared once on `.hud` in styles.css, and this is the
  // dial all of them turn on.
  //
  // ...and THE COMBO'S LINE, composed once here rather than at the two
  // places below that want it: the element list is the engine's and the
  // words are the strings table's (§39.1, §39.2), and this is only where
  // the two are put together.
  const comboLine = STRINGS.comboLine(snap.comboParts);
  return (
    <div
      class="hud"
      data-air={snap.airborne ? "1" : undefined}
      data-finished={snap.finished ? "1" : undefined}
      style={{ "--hud-dark": String(snap.dark) }}
    >
      <div class="hud-top">
        <div class="hud-top-row">
          {/* THE CLOCK — up on a race, DOWN on a timed run, where what it
              reads is what is LEFT and the caption says so. The last ten
              seconds of a timed run are marked, because a rider mid-combo
              needs to know the buzzer is close without reading the figure. */}
          <div
            class={`hud-clock${snap.left !== null && snap.left < 10 && !snap.finished ? " hud-clock-low" : ""}`}
          >
            <span class="hud-clock-time">{formatTime(snap.left ?? snap.time)}</span>
            <span class="hud-chip-sub">
              {snap.left === null ? STRINGS.clockLabel : STRINGS.clockLeftLabel}
            </span>
          </div>
          {/* THE PLACE, in a race — the one number a racer reads more than
              the clock. Left out of a run alone, where 1 / 1 says nothing. */}
          {snap.riders > 1 ? (
            <div class="hud-chip hud-place" key={snap.place}>
              <span>{STRINGS.place(snap.place, snap.riders)}</span>
              <span class="hud-chip-sub">{STRINGS.placeLabel}</span>
            </div>
          ) : null}
          {/* R30 — the lap, on a circuit only. A coast sprint is one pass
              of one course and a chip reading "1 / 1" is a chip that says
              nothing. */}
          {snap.laps > 1 ? (
            <div class="hud-chip">
              <span>{STRINGS.laps(snap.lap, snap.laps)}</span>
              <span class="hud-chip-sub">{STRINGS.lapsLabel}</span>
            </div>
          ) : null}
          {/* ...and the gates, only where the run is counting them: a tricks
              run has no course to keep a count of. */}
          {snap.courseOn ? (
            <div class="hud-chip">
              <span>{STRINGS.gates(snap.passed, snap.gates)}</span>
              <span class="hud-chip-sub">{STRINGS.gatesLabel}</span>
            </div>
          ) : null}
        </div>
        {/* Under the clock rather than across the screen from it: the vane
            says where the sea is coming from, and it is read together with
            the time it is costing. */}
        <WindVane angle={snap.windAngle} ms={snap.windMs} />
        <div class="hud-chip hud-sun" title={STRINGS.sunClockLabel(snap.daylight)}>
          <span>{hourLabel(snap.hour)}</span>
          <span class="hud-chip-sub">{STRINGS.sunClockLabel(snap.daylight)}</span>
        </div>
        {/* THE SCORE, at the foot of the column the run's other facts live
            in. It is a TOTAL — banked, settled, nothing riding on it — and a
            total is read between moments, which is what this corner is for.
            The moment itself is the combo tile over the nose.

            It is keyed on the figure, so the chip is a new element every
            time a combo banks and the beat in styles.css plays again. That
            is the whole animation: the score does not tick up to its new
            value, it ARRIVES at it with a thump, the way a mechanical
            scoreboard does. */}
        {snap.tricksOn ? (
          <div class="hud-chip hud-score" key={snap.score}>
            <span>{STRINGS.score(snap.score)}</span>
            <span class="hud-chip-sub">{STRINGS.scoreLabel}</span>
          </div>
        ) : null}
      </div>

      <div class="hud-topright">
        <Minimap map={snap.minimap} onOpen={onPause} />
        {/* THE PRESSES, UNDER THE MAP. The map is the thing in this corner
            that is LOOKED at, so it takes the top of it, hard against the
            two edges of the screen; the buttons hang off its bottom, which
            is the nearer half of the cluster to the thumb that reaches for
            them and leaves the map's own square unbroken. */}
        <HudActions onReset={onReset} onCamera={onCamera} />
        {/* THE DIAGNOSTICS, at the foot of the cluster: the frame rate
            (OPTIONS ▸ FPS) and what the frame cost (the developer
            page's FRAME COST). They hang here rather than in the build corner
            because that corner is directly under the speed cluster, and a
            second line there lands across the speedo on a phone. This edge is
            the one with room — clear of both thumb zones, and nothing else
            wants it. */}
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
        {/* THE ALTITUDE TAPE, standing on top of the speed cluster. It is
            here rather than up among the run's facts because it is an
            INSTRUMENT rather than a readout — a thing with a moving part,
            read the way the rev bar beneath it is read, out of the corner
            of an eye already on that corner for the speed — and because a
            vertical reading wants vertical room, which this is the only
            edge of the screen with. The figure rides the marker, so how
            high and how high exactly are one glance. */}
        <div class="hud-alt">
          <AltitudeTape
            share={snap.altitudeShare}
            peak={snap.altitudePeakShare}
            reading={STRINGS.altitude(snap.altitude)}
          />
          <span class="hud-chip-sub">{STRINGS.altitudeLabel}</span>
        </div>
        <div class="hud-revs-row">
          <RevBar rpm={snap.rpm} idle={snap.idle} braking={snap.braking} />
          {/* The caption says what the bar is doing: RPM, or the one brake
              the craft has while its bucket is down — the keys have no lever
              to fill the way the touch overlay's does. */}
          <span class={`hud-chip-sub ${snap.braking ? "hud-brake" : ""}`}>
            {snap.astern ? STRINGS.reverse : snap.braking ? STRINGS.brake : STRINGS.revs}
          </span>
        </div>
        <div class="hud-cluster">
          <span class="hud-speed-num">{Math.round(snap.speedKmh)}</span>
          <span class="hud-speed-unit">{STRINGS.speedUnit}</span>
        </div>
      </div>

      {/* THE AIR CLOCK, top centre. It is the one readout on this screen a
          rider is trying to make GO UP, and it belongs where his eyes
          already are — on the horizon, over the nose, where he is aiming the
          landing — rather than down in the corner he only checks between
          gates. It appears out of nothing once the flight has lasted long
          enough to BE one (`snapshot.ts`, `flight.airCounts`) and is gone at
          the water, so the middle of the frame is empty whenever it is not a
          hull's whole job — and a head sea, which throws the hull clear a
          fifth of the steps, never flickers a clock over the horizon.

          It FADES in rather than arriving, and it GROWS with the flight:
          `--air-grow` is the snapshot's 0..1 from the line to a flight worth
          the whole size, and the styling turns it into the tile's scale. A
          readout that says how big the moment is by how big it is needs no
          second glance to be read at speed.

          A record STICKS — `airRecord` covers both the flight already past
          the run's best and the moment after the landing that took it — and
          the word goes beside the clock rather than under it, so the number
          never moves off the centreline to make room for news. */}
      {/* THE LIGHTS, dead centre and as big as the frame allows: the one
          moment the whole screen is about one number. Keyed on the count,
          so each light lands with its own beat; GO is the same element
          with the word in it, for the moment after. */}
      {(snap.countdown > 0 || snap.go) && (
        <div class="hud-center hud-lights">
          <span
            class={`hud-count${snap.go ? " hud-count-go" : ""}`}
            key={snap.go ? 0 : snap.countdown}
          >
            {snap.go ? STRINGS.go : STRINGS.count(snap.countdown)}
          </span>
        </div>
      )}

      {snap.tricksOn && (snap.airTime > 0 || snap.combo > 0) && (
        <div
          class={`hud-air ${snap.airRecord ? "hud-air-record" : ""}`}
          style={{ "--air-grow": String(snap.airGrow) }}
        >
          {snap.airTime > 0 && (
            <div class="hud-air-tile">
              <span class="hud-air-num">{STRINGS.air(snap.airTime)}</span>
              <span class="hud-chip-sub">{STRINGS.airLabel}</span>
              {/* UNDER the unit label, at the foot of the same column: the
                  clock keeps the centreline whether the word is there or
                  not, and the tile grows DOWNWARD to make room for it. */}
              {snap.airRecord && <span class="hud-air-best">{STRINGS.airRecordLabel}</span>}
            </div>
          )}
          {/* THE COMBO, under the clock and in the same column, because they
              are one reading of one moment: the seconds the hull has been up
              and what those seconds plus whatever it turned are worth. It
              OUTLIVES the clock by the length of the link window — the hull
              is back on the water and the combo is still riding on the rider
              staying on it — which is when this line stands alone at the
              centre and is the only thing left to read.

              The MULTIPLIER is keyed on its own value, so every rung won
              mounts a fresh element and the beat plays again. A rider who is
              looking at the water rather than at the number still catches
              the thump out of the corner of his eye, which is the whole job:
              he has to know the flip counted before he has to land it. */}
          {/* THE TRICK LINE, over the figure it is worth — the arcade
              skating game's own reading, and the half of it a rider is
              actually chasing. It names every element he has strung
              together, in the order he won them, and it is KEYED on the
              whole line: every element added mounts a fresh element and
              punches, so the line grows with a beat rather than silently
              gaining a word. It sits ABOVE the number because that is the
              order the eye takes them in — what he did, then what it was
              worth — and it survives the landing with the figure, which is
              when the receipt has to say what it is a receipt for. */}
          {snap.combo > 0 && comboLine !== "" && (
            <div class={`hud-trick hud-trick-${snap.comboPhase}`} key={comboLine}>
              {comboLine}
            </div>
          )}
          {snap.combo > 0 && (
            <div class={`hud-combo hud-combo-${snap.comboPhase}`}>
              <span class="hud-combo-num">{STRINGS.comboPoints(snap.combo)}</span>
              {snap.mult > 1 && (
                <span class="hud-combo-mult" key={snap.mult}>
                  {STRINGS.comboMult(snap.mult)}
                </span>
              )}
              <span class="hud-chip-sub hud-combo-label">
                {snap.comboPhase === "banked"
                  ? STRINGS.comboBanked
                  : snap.comboPhase === "bailed"
                    ? STRINGS.comboBailed
                    : STRINGS.comboLabel}
              </span>
            </div>
          )}
        </div>
      )}

      <div class="hud-right">
        <div class="hud-flashes">
          {flashes.map((f) => (
            <span key={f.id} class={`hud-flash hud-flash-${f.tone}`}>
              {f.text}
            </span>
          ))}
        </div>
        {/* Nothing on the days there is no new build, which is nearly all of
            them: it draws itself or it draws nothing. At the FOOT of this
            column, so it is the one thing pinned to the corner and the news
            stacks above it — a flash that arrives never moves a button a
            thumb is on its way to. */}
        <UpdateButton />
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

      {/* THE RESULT, once there is one: the run's figure in its own
          currency, where it stood, and whether the book has a new row. It
          shares the tab-away card's plate because it is the same kind of
          thing — the game stopping to say one line — and it stays until the
          rider rides again or leaves. */}
      {result && !away && (
        <div class="hud-center">
          <div class={`hud-card hud-result${result.record ? " hud-result-record" : ""}`}>
            <span class="hud-card-title">{result.headline}</span>
            {result.detail && <span class="hud-card-note">{result.detail}</span>}
            {result.record && <span class="hud-result-best">{STRINGS.resultNewBest}</span>}
            {!touch && <span class="hud-card-note hud-result-note">{STRINGS.resultNote}</span>}
          </div>
        </div>
      )}

      {away && (
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
