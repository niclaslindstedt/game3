// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE HELD RUN IS BILLED WITH on the pause card — the handful of figures
// worth reading back once the water has stopped moving.
//
// THE HUD IS STILL UP BEHIND THIS CARD (`shell.ts`'s `hudOver`), so the clock,
// the gate count and the place chip are already on screen. That is the whole
// design problem: a strip that simply repeated them, in their own order, is a
// second copy of the corner the player is looking past — and that is exactly
// what the first draft of this card photographed as.
//
// So only the two worth repeating are: WHAT THE RUN IS BEING RIDDEN FOR (a
// standing, a score) and THE CLOCK, because those are what a rider stopped to
// think about and a summary without them is not one. Behind those come the
// run's OWN STORY — the longest flight, the furthest jump, the highest the
// hull has been — which the HUD can only ever flash for a moment, because a
// rider at speed cannot read a number that is not happening now. The rest of
// the corner's readings fill whatever is left over.
//
// WHICH FIGURES, AND IN WHICH ORDER, IS THE MODE'S (`GameState.rules`, read
// off the snapshot as `courseOn` / `tricksOn`). A race is read place first and
// a tricks run is read score first, because that is the number each one is
// being ridden for; a figure the run is not playing for is not shown at all,
// the way the HUD leaves the chip out rather than printing a zero.
//
// FOUR AT MOST, one row across. The card has to stand inside a phone held
// sideways — 390 px of height for a head, four presses and this — so a fifth
// cell is not a tighter row, it is a card that scrolls.
//
// DOM-free: the decision is here and `menu-pause.tsx` only draws it, so
// `tests/menu_system_test.ts` holds every rule above without a browser. The
// WORDS are the strings table's (§39.1) — nothing here spells one.

import { STRINGS } from "./strings.ts";
import { ALT_PEAK_SHOWN, type HudSnapshot } from "./snapshot.ts";

/** One cell: the figure, the caption under it, and a key for the list. */
export type PauseStat = {
  key: string;
  value: string;
  label: string;
};

/** WHAT A BILL IS READ FROM — the fields of the HUD's own snapshot this
 * asks for, and no more. A whole `HudSnapshot` satisfies it, so `App.tsx`
 * hands one straight over; naming the fields is what lets a test state a run
 * in a dozen numbers rather than assembling a minimap to ask what the strip
 * says about a tricks run. */
export type PauseRun = Pick<
  HudSnapshot,
  | "place"
  | "riders"
  | "score"
  | "tricksOn"
  | "left"
  | "time"
  | "courseOn"
  | "passed"
  | "gates"
  | "lap"
  | "laps"
  | "bestAir"
  | "bestLength"
  | "peakAltitude"
>;

/** How many cells the row carries. See this module's header — it is a height
 * budget, not a taste. */
export const PAUSE_STATS = 4;

/** A candidate cell and whether the run has anything to say in it. `shown`
 * false drops it before the count is taken, so a run with no flight in it
 * yet is billed with four figures and not with three and a dash. */
type Candidate = PauseStat & { shown: boolean };

export function pauseStats(snap: PauseRun, max: number = PAUSE_STATS): PauseStat[] {
  const place: Candidate = {
    key: "place",
    value: STRINGS.place(snap.place, snap.riders),
    label: STRINGS.placeLabel,
    // 1 OF 1 is not a standing, which is the same reading the HUD's own
    // chip takes.
    shown: snap.riders > 1,
  };
  const score: Candidate = {
    key: "score",
    value: STRINGS.score(snap.score),
    label: STRINGS.scoreLabel,
    shown: snap.tricksOn,
  };
  // The clock counts DOWN on a timed run and the caption says so — one cell,
  // read the way the HUD's clock is read, because they are the same clock.
  const time: Candidate = {
    key: "time",
    value: STRINGS.resultTime(snap.left ?? snap.time),
    label: snap.left === null ? STRINGS.clockLabel : STRINGS.clockLeftLabel,
    shown: true,
  };
  const gates: Candidate = {
    key: "gates",
    value: STRINGS.gates(snap.passed, snap.gates),
    label: STRINGS.gatesLabel,
    shown: snap.courseOn,
  };
  const lap: Candidate = {
    key: "lap",
    value: STRINGS.laps(snap.lap, snap.laps),
    label: STRINGS.lapsLabel,
    shown: snap.laps > 1,
  };
  // THE THREE THE HUD CANNOT HOLD. Each is 0 until the run has done it, and
  // a zero here is a cell spent saying nothing — so each stands down until
  // there is a flight behind it.
  const air: Candidate = {
    key: "air",
    value: STRINGS.air(snap.bestAir),
    label: STRINGS.pauseBestAir,
    shown: snap.bestAir > 0,
  };
  const length: Candidate = {
    key: "length",
    value: STRINGS.length(snap.bestLength),
    label: STRINGS.pauseBestLength,
    shown: snap.bestLength > 0,
  };
  const height: Candidate = {
    key: "height",
    value: STRINGS.altitude(snap.peakAltitude),
    label: STRINGS.pauseBestHeight,
    // The altimeter's own floor, asked for rather than restated: a brisk sea
    // lifts a hull a metre and a half just by being a sea, and a cell
    // reporting the chop as the run's apex is a cell that is lying. The tape
    // carries its high-water tick on exactly this line, so the card and the
    // tape behind it can never disagree about whether the run has been up.
    shown: snap.peakAltitude >= ALT_PEAK_SHOWN,
  };
  // WHAT THE RUN IS BEING RIDDEN FOR, THEN THE CLOCK, THEN THE RUN'S OWN
  // RECORDS — and only then the rest of what the HUD is already showing.
  //
  // The order is the answer to the duplication this card cannot avoid. The
  // headline (a standing, a score) and the clock are worth repeating: they
  // are what a rider stopped to think ABOUT, and a summary without them is
  // not a summary. Everything after that is chosen the other way round —
  // the three records the corner behind this card has no standing readout
  // for come before the gate count and the lap, which it does. So the strip
  // is the HUD's own reading while the run has no story yet, and stops
  // being one the moment it has.
  const order = snap.courseOn
    ? [place, time, air, length, height, gates, lap, score]
    : [score, time, air, length, height, place];
  return order.filter((c) => c.shown).slice(0, Math.max(0, max));
}
