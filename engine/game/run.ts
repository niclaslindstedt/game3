// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE RIDER'S STEP — the craft, the air record, the score, the clock and
// the course, in that order, for ONE run: the player's, or one of the
// rivals' (`rivals.ts`), which is a run of its own over the same sea. It is
// the whole of what `step.ts` used to do after the wind, lifted out so the
// field can be stepped by the same function the player is — a rival that
// rode a different step would be a rival on a different game.
//
// The RULES (`GameState.rules`) are read here and nowhere above: whether
// the course counts, whether the score is kept, and whether a buzzer ends
// the run. The phase gates everything else — nothing is steered and the
// clock does not run under the lights (`countdown`), and a finished run
// coasts.

import { TUNING } from "./defs/tuning.ts";
import { stepCraft } from "./craft.ts";
import { resetCraft, stepCourse } from "./course.ts";
import { NEUTRAL_INPUT, type CraftInput, type GameEvent, type GameState } from "./state.ts";
import { closeCombo, resetTricks, stepTricks } from "./tricks.ts";

/** THE RUN'S AIR RECORD, read off the flight the craft has just reported.
 * The craft knows how long it was up; only the run knows whether anything
 * has been up longer, so the comparison is here and the landing that won it
 * is marked as it goes past — one event, one flash, and `progress.bestAir`
 * and `bestAirAt` left holding the number and the moment it was set, so a
 * readout can hold it on screen without a clock of its own. A flight under
 * `flight.airCounts` is not air time at all and cannot take it. */
function noteAirRecord(state: GameState, events: GameEvent[]): void {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind !== "land") continue;
    if (e.airTime <= TUNING.flight.airCounts || e.airTime <= state.progress.bestAir) continue;
    state.progress.bestAir = e.airTime;
    state.progress.bestAirAt = state.t;
    e.record = true;
  }
}

/** Advance one rider's run by the step the world has just taken. `events`
 * is the run's own list, already cleared for this step. */
export function stepRun(run: GameState, input: CraftInput, events: GameEvent[]): void {
  const live = run.phase === "running";
  if (input.reset && live) {
    resetCraft(run, events);
    // Being put back at a gate is the rider stepping off: whatever the
    // combo had riding on it goes with him (`tricks.ts`).
    resetTricks(run, events);
    return;
  }

  const c = run.craft;
  const x0 = c.x;
  const y0 = c.y;
  const z0 = c.z;
  stepCraft(run, live ? input : NEUTRAL_INPUT, events);
  // UNDER THE LIGHTS THE FIELD HOLDS STATION. A jet idles forward at about
  // a metre a second and a swell carries a hull sideways, so a grid left
  // to the physics for three seconds has drifted apart before GO; the hull
  // still heaves and pitches on the water, it just makes no way.
  if (run.phase === "countdown") {
    c.vx = 0;
    c.vz = 0;
  }
  noteAirRecord(run, events);
  // THE RUN'S HIGH-WATER MARK, taken at the physics rate rather than off a
  // landing: the apex of a flight is an instant with no event at it, and a
  // presentation sampling the altimeter a dozen times a second would read
  // the top of a jump only by luck.
  if (c.altitude > run.progress.peakAltitude) run.progress.peakAltitude = c.altitude;
  // After the craft and before the course: the score reads what the hull
  // just did (it is airborne or it is not, and this step's `land`, `dive`
  // and `capsize` are already on the list), and the course has no opinion
  // about it either way. Not under the lights, and not on a run that is
  // not playing for it.
  if (live && run.rules.tricks) stepTricks(run, events);
  if (!live) return;

  const p = run.progress;
  if (!p.finished) {
    // THE CLOCK, run here rather than by the course so a run with no course
    // to count still has one to run down.
    p.time += TUNING.dt;
    if (run.rules.course) stepCourse(run, x0, y0, z0, events);
    // THE BUZZER. The combo in hand is paid first (`closeCombo`), so a flip
    // landed on the last second counts; then the run is over the way a
    // finish ends it, and the craft coasts.
    if (run.rules.limit > 0 && !p.finished && p.time >= run.rules.limit) {
      p.time = run.rules.limit;
      closeCombo(run, events);
      p.finished = true;
      run.phase = "finished";
      events.push({ kind: "timeUp", t: run.t, score: run.tricks.score });
    }
  }
}
