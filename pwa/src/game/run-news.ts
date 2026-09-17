// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A RUN SAYS ABOUT ITSELF, in words: the line an engine event earns in
// the news column, the caption a picture carries, and — once the run is
// over — the row it would take in the record book and the plate the HUD
// draws over it. Every one of them is a pure function of the state, the
// settings and the strings table, lifted out of `App.tsx` so the app stays
// the ORCHESTRATION (which surface is up, who rides, when a run is stood)
// and none of it is a sentence.

import { TUNING, craftById, type GameEvent, type GameState } from "@engine";

import { formatTime } from "../lib/util.ts";
import type { HudFlash } from "./hud.tsx";
import type { HudResult } from "./hud-result.tsx";
import {
  PODIUM,
  findLevel,
  ladderAfter,
  medalFor,
  shoreWon,
  type CampaignLevel,
  type CampaignProgress,
} from "./campaign.ts";
import { keepsRecords, scoresHigher } from "./records.ts";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** The line an event earns in the news column, or null for the ones the
 * picture already says everything about. The state is read for what the
 * run is PLAYING FOR: a race's finish is a place, and a run with the tricks
 * off has no air to report. */
export function flashFor(
  e: GameEvent,
  state: GameState,
): { text: string; tone: HudFlash["tone"] } | null {
  switch (e.kind) {
    case "gate":
      return { text: STRINGS.split(e.gate + 1, e.split), tone: "good" };
    case "airGate":
      return { text: STRINGS.airGate(e.gate + 1, e.split), tone: "good" };
    case "missedGate":
      // The HUD's standing missed-checkpoint guide owns this event. A second
      // copy in the news column would fade while the actual warning stayed.
      return null;
    case "finish":
      return state.rivals.length > 0
        ? { text: STRINGS.finishPlace(e.place, state.rivals.length + 1, e.time), tone: "good" }
        : { text: STRINGS.finish(e.time), tone: "good" };
    // THE LIGHTS are the centre's, not the column's; GO gets a line as well
    // because the column is what a rider reads BACK.
    case "go":
      return { text: STRINGS.go, tone: "good" };
    case "bump":
      return { text: STRINGS.bump, tone: "info" };
    case "timeUp":
      return { text: STRINGS.timeUp, tone: "good" };
    case "dive":
      return { text: STRINGS.dive, tone: "bad" };
    // THE SPELL UNDER THE WATER, read back the way a flight is: the clean
    // surfacing gets the plain reading with its seconds, the float-up gets
    // the bad news, and going under gets nothing — the tile over the nose
    // is already counting it, and a dirty surfacing is the float-up's line.
    case "surface":
      return e.clean ? { text: STRINGS.surfaced(e.underTime), tone: "info" } : null;
    case "floatUp":
      return { text: STRINGS.floatUp, tone: "bad" };
    case "hit":
      return { text: STRINGS.hit, tone: "bad" };
    case "ground":
      return { text: STRINGS.grounded, tone: "bad" };
    // AN ELEMENT, named as it completes. The tile over the nose is already
    // building the whole combo's line; this is the column's own record of
    // each one as it landed, which is what a rider reads BACK after a run
    // rather than during it. The air's own rung is not one of them: it buys
    // no points and it is already the first word on the tile, and a news
    // line saying AIR under every flip would push the flips off the column.
    case "trick":
      return e.trick === "air"
        ? null
        : { text: STRINGS.trick(e.trick, e.spins, e.mult), tone: "good" };
    // ...and the combo thrown away. The BANKED half gets no line: the tile
    // holds the figure for a moment and the score chip takes it. A bail is
    // the one end the rider misses, because by then he is upside down.
    case "bail":
      return { text: STRINGS.bailed(e.lost), tone: "bad" };
    case "land":
      // THE RECORD IS THE BETTER NEWS. A landing that took the run's
      // longest flight is called out as one; every other flight that
      // counted gets the plain reading, and a hop that was not air time at
      // all (`flight.airCounts`) is a wave, not a jump, and gets no line.
      // None of it on a run with the tricks off: the air is not what that
      // run is about, and the column is for what is.
      if (!state.rules.tricks) return null;
      if (e.record) return { text: STRINGS.airRecord(e.airTime), tone: "good" };
      return e.airTime > TUNING.flight.airCounts
        ? { text: STRINGS.landed(e.airTime), tone: "info" }
        : null;
    default:
      return null;
  }
}

/** The one line of context a picture carries: which shore it was taken on
 * and which hull was under the rider. It is the gallery's caption and half
 * of the file's name (`game/screenshots.ts`). */
export function shotLabel(state: GameState): string {
  return STRINGS.shotLabel(state.seed, craftById(state.craft.spec.id).name);
}

/** THE RESULT, composed: the run's figure in the mode's own currency, and
 * the standing best it was measured against. `best` is the row BEFORE this
 * run — the one it beat, or did not. */
export function resultFor(
  s: Settings,
  state: GameState,
  value: number,
  best: number | null,
  record: boolean,
): HudResult {
  const mode = s.ride.mode;
  // WHAT THIS RUN WAS MEASURED AGAINST — the row it beat or did not, or, on
  // a mode that keeps no book, the line saying there was never one to beat.
  // "FIRST TIME ON THIS SHORE" on a free ride would be a claim about a
  // record book that will never hold the run (`records.ts`).
  const standing = !keepsRecords(mode)
    ? STRINGS.resultFree
    : best === null
      ? STRINGS.resultFirst
      : STRINGS.resultBest(scoresHigher(mode) ? STRINGS.resultScore(best) : formatTime(best));
  if (state.rivals.length > 0) {
    const place = state.events.find((e) => e.kind === "finish");
    return {
      headline: STRINGS.resultRace(
        place?.kind === "finish" ? place.place : 1,
        state.rivals.length + 1,
      ),
      detail: `${STRINGS.resultTime(value)} · ${standing}`,
      record,
    };
  }
  return {
    headline: scoresHigher(mode) ? STRINGS.resultScore(value) : STRINGS.resultTime(value),
    detail: standing,
    record,
  };
}

/** THE CAMPAIGN'S RESULT, composed: where the run placed in the field and
 * its figure, then what that did to the ladder — the medal it earned or
 * did not, the level it opened, the shore it won, or the table still to be
 * topped. `place` is the finishing order's, `before` and `after` the board
 * either side of the run being booked, so the second line reports what
 * CHANGED rather than what stands. */
export function campaignResultFor(
  level: CampaignLevel,
  place: number,
  field: number,
  value: number,
  before: CampaignProgress,
  after: CampaignProgress,
): HudResult {
  const figure = level.mode === "tricks" ? STRINGS.resultScore(value) : STRINGS.resultTime(value);
  const stood = before.results[level.id];
  // A level standing on a developer's unlock has a place and no figure, so
  // the first run down it is a record by definition — which is exactly what
  // it is, because nobody had ridden it.
  const best = stood?.best;
  const record = best === undefined || (level.mode === "tricks" ? value > best : value < best);
  const lines: string[] = [];
  const medal = medalFor(level, value);
  if (level.mode === "tricks")
    lines.push(medal ? STRINGS.resultMedal(medal) : STRINGS.resultNoMedal);
  else if (place > PODIUM) lines.push(STRINGS.resultNotCleared);
  const here = findLevel(level.id);
  const step = ladderAfter(level.id, after);
  if (here && shoreWon(here.shore, after) && !shoreWon(here.shore, before)) {
    lines.push(STRINGS.resultShoreWon(here.shore.name));
  }
  if (step.kind === "next") {
    if (ladderAfter(level.id, before).kind !== "next") {
      lines.push(STRINGS.resultNextOpen(step.level.name));
    }
  } else if (step.kind === "locked" && lines.length === 0) {
    lines.push(STRINGS.resultShoreLocked);
  } else if (step.kind === "end" && here && shoreWon(here.shore, after)) {
    lines.push(STRINGS.resultCampaignEnd);
  }
  return {
    headline: `${STRINGS.resultRace(place, field)} · ${figure}`,
    detail: lines.length > 0 ? lines.join(" · ") : null,
    record,
  };
}
