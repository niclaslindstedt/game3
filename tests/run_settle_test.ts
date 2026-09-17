// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A FINISH DOES (`pwa/src/game/run-settle.ts`), and above all what it
// does when the run is one the game will not vouch for.
//
// The regression this file exists for: the honesty test that keeps a
// doctored figure out of the books was written as a single early return, so
// it took the PLATE with it. Anybody carrying one of the developer's three
// override rows — a staged scene, a wind or a sea set by hand — finished
// every run to silence, in every mode, and a finished run with nothing on
// screen reads as a freeze. A booking and a plate are two different things:
// one is a claim about the shore, the other is the game saying what just
// happened.

import { describe, expect, it } from "vitest";

import { createGame, type GameState } from "@engine";
import { createSettler, type SettleWorld } from "../pwa/src/game/run-settle.ts";
import { DEFAULT_SETTINGS, type Settings } from "../pwa/src/game/settings.ts";
import type { HudResult } from "../pwa/src/game/run-news.ts";
import type { RecordBook } from "../pwa/src/game/records.ts";
import { EMPTY_PROGRESS, type CampaignProgress } from "../pwa/src/game/campaign.ts";
import { syntheticLevel } from "./support/synthetic.ts";

/** One flat shore, built once: a finish is the subject here, not the water. */
const LEVEL = syntheticLevel();

/** A settler over spies, with every row of the developer page at its
 * default. `dev` is laid over that. */
function stand(dev: Partial<Settings["dev"]> = {}, opts: { rides?: boolean } = {}) {
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    ride: { ...DEFAULT_SETTINGS.ride, mode: "free" },
    developer: true,
    dev: { ...DEFAULT_SETTINGS.dev, ...dev },
  };
  const state: GameState = createGame({ seed: 1, level: LEVEL, mode: "free", quiet: true });
  const seen = { plates: [] as (HudResult | null)[], sealed: [] as number[], books: 0, ladders: 0 };
  const world: SettleWorld = {
    current: () => state,
    settings: () => settings,
    track: undefined,
    rides: () => opts.rides ?? true,
    riding: () => null,
    progress: { current: EMPTY_PROGRESS as CampaignProgress },
    setProgress: () => {
      seen.ladders += 1;
    },
    records: { current: {} as RecordBook },
    setRecords: () => {
      seen.books += 1;
    },
    setResult: (r) => seen.plates.push(r),
    ghost: {
      seal: (v: number) => seen.sealed.push(v),
    },
  };
  return { settle: createSettler(world), seen, settings };
}

describe("what a finish does", () => {
  it("puts a plate up on an honest run, and books it", () => {
    const { settle, seen } = stand();
    settle(42);
    expect(seen.plates).toHaveLength(1);
    expect(seen.plates[0]).not.toBeNull();
    // A free ride keeps no record (`keepsRecords`), so the book is untouched
    // by design — but the TAPE is sealed, which is the booking half running.
    expect(seen.sealed).toEqual([42]);
  });

  it("still puts a plate up on a run it will not vouch for — one per override", () => {
    // THE REGRESSION. Each of these silently made the finish say nothing at
    // all; the plate is owed to whoever crossed the line whatever the
    // developer page is holding. `scene` is also the STAGED case — it is what
    // puts the craft down the shore in the first place (`placeRun`).
    for (const dev of [{ scene: "cruise" as const }, { wind: 14 }, { hs: 3 }]) {
      const { settle, seen } = stand(dev);
      settle(42);
      // `toHaveLength(1)` first and on purpose: a plate that was never set
      // at all reads as `undefined`, which slips past `not.toBeNull()`.
      expect(seen.plates).toHaveLength(1);
      expect(seen.plates[0]).not.toBeNull();
      // ...and it claims nothing: no tape, no ladder, no row.
      expect(seen.sealed).toEqual([]);
      expect(seen.books).toBe(0);
      expect(seen.ladders).toBe(0);
    }
  });

  it("never claims a RECORD off a run it did not book", () => {
    // The plate is allowed to be quiet; it is not allowed to lie.
    for (const dev of [{ scene: "cruise" as const }, { wind: 14 }, { hs: 3 }]) {
      const { settle, seen } = stand(dev);
      settle(42);
      expect(seen.plates).toHaveLength(1);
      expect(seen.plates[0]?.record).toBe(false);
    }
  });

  it("says nothing at all when the BOT is the one that finished", () => {
    // The sea behind every card is ridden by the bot and it crosses the line
    // like anybody else. That is the one finish nobody is owed a plate for,
    // and it stays a hard refusal.
    const { settle, seen } = stand({}, { rides: false });
    settle(42);
    expect(seen.plates).toHaveLength(0);
    expect(seen.sealed).toEqual([]);
  });
});
