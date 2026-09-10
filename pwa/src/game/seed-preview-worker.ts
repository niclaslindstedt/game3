// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEED PREVIEW'S WORKER — a whole level generated, and cut into a
// schematic, off the thread the sea is drawn on.
//
// IT IS A WORKER FOR ONE REASON AND IT IS THE CARD'S ONLY REAL CONSTRAINT.
// Generating a level is the most expensive thing this engine does — 75 to
// 480 ms on a development machine, and every rejected sub-seed is another
// coast built and thrown away — and the front door's whole design is that
// THE SEA NEVER STOPS behind a card. A seed stepped on the main thread
// would freeze the water for a third of a second per press, which is the
// one thing the menu system is arranged to prevent. Here the water does not
// miss a frame and the picture simply arrives when it arrives.
//
// The engine is framework-free and imports nothing but itself, so it runs
// here unchanged; `minimap-scene.ts` is DOM-free for the same reason the
// payload modules are, and cuts the schematic without a document.

import { dealtTimeOfDay, generateLevel, type Season, type TimeOfDay, type Weather } from "@engine";

import { levelSchematic } from "./minimap-scene.ts";
import type { LevelSchematic } from "./minimap-scene.ts";

/** What the card asks for: one seed. */
export type PreviewRequest = { seed: number };

/** THE DAY THIS SEED DEALS — the three answers the start card's own rows
 * would otherwise have to offer a fourth chip for.
 *
 * Every row on that card defaults to the level as it was generated, and the
 * only honest way to SAY so on a row of named answers is to mark the answer
 * the seed already gives. That answer is a fact about the generated level,
 * which is why it comes back with the chart rather than being guessed at
 * from the number. */
export type SeedDeal = {
  /** The named hour the level's own hour (R13) stands nearest to, in the
   * season it was dealt. */
  time: TimeOfDay;
  season: Season;
  /** The mean wind at 10 m the level was generated with, m/s (R12) — a
   * figure, which `conditionsFor` turns into one of the card's three rungs. */
  wind: number;
  /** The sky R19 dealt over it. */
  weather: Weather;
};

/** What comes back — the schematic, the day the seed deals, and the few
 * figures worth printing beside the picture. A seed the generator refuses is
 * an answer too: the card says so rather than sitting on a spinner forever. */
export type PreviewReply =
  | {
      seed: number;
      ok: true;
      schematic: LevelSchematic;
      deal: SeedDeal;
      gates: number;
      /** The course, m. */
      length: number;
    }
  | { seed: number; ok: false; error: string };

self.onmessage = (e: MessageEvent<PreviewRequest>) => {
  const { seed } = e.data;
  const reply = (r: PreviewReply): void => {
    (self as unknown as Worker).postMessage(r);
  };
  try {
    const level = generateLevel(seed);
    reply({
      seed,
      ok: true,
      schematic: levelSchematic(level),
      deal: {
        time: dealtTimeOfDay(level),
        season: level.season,
        wind: level.wind.speed,
        weather: level.weather,
      },
      gates: level.course.gates.length,
      length: level.course.length,
    });
  } catch (err) {
    reply({ seed, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
