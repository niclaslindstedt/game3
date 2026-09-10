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

import { generateLevel } from "@engine";

import { levelSchematic } from "./minimap-scene.ts";
import type { LevelSchematic } from "./minimap-scene.ts";

/** What the card asks for: one seed. */
export type PreviewRequest = { seed: number };

/** What comes back — the schematic, and the few figures worth printing
 * beside it. A seed the generator refuses is an answer too: the card says
 * so rather than sitting on a spinner forever. */
export type PreviewReply =
  | {
      seed: number;
      ok: true;
      schematic: LevelSchematic;
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
      gates: level.course.gates.length,
      length: level.course.length,
    });
  } catch (err) {
    reply({ seed, ok: false, error: err instanceof Error ? err.message : String(err) });
  }
};
