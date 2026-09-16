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
import type { HudFlash, HudResult } from "./hud.tsx";
import { classFor } from "./new-game.ts";
import { keepsRecords, scoresHigher, type RecordKey } from "./records.ts";
import { DEFAULT_SEED, type Settings } from "./settings.ts";
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

/** What names this run's row in the record book: the level as the settings
 * and the URL stood it up (`records.ts` says what is deliberately left
 * out). */
export function recordKeyFor(s: Settings, track: RecordKey["track"] | undefined): RecordKey {
  return {
    mode: s.ride.mode,
    biome: s.ride.biome,
    seed: s.ride.seed ?? DEFAULT_SEED,
    track: track ?? "coast",
    speedClass: classFor(s),
    minutes: s.ride.tricksMinutes,
  };
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
