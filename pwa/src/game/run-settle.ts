// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RUN IS OVER — what a finish DOES, in one place.
//
// The line or the buzzer hands over one figure, in the mode's own currency
// (seconds down a course, points off a tricks field), and three things
// answer to it: the book it is written into, the tape the run leaves behind
// (`ghost-run.ts`) and the plate that goes up over the water. Which book
// depends on what was being ridden — the CAMPAIGN's board on a pinned rung
// (`campaign.ts`), the record book on everything else (`records.ts`), and
// nothing at all on a free ride, whose weather is the rider's own so there
// was never anything to have beaten.
//
// NOT EVERY FINISH IS A RUN ON THIS SHORE. A staged scene is not ridden from
// the line, a developer's wind or sea is water the generator would never
// have dealt, and the bot carrying a run on under the front door is nobody's
// afternoon. The one honesty test lives here, above all three, so a rule
// that keeps a figure out of the record book keeps it off the ghost tape
// too — which used to be two lists that could quietly come apart.
//
// A FACTORY over the app's own closures rather than a module that reaches
// for them: the engine state, the two books and the surfaces they are drawn
// on are `App.tsx`'s, built once on mount and outliving every card. The same
// shape `app-load.ts` is built in, and for the same reason.

import { fieldOrder, type GameState, type TrackKind } from "@engine";

import { recordRun, type CampaignLevel, type CampaignProgress } from "./campaign.ts";
import type { GhostRig } from "./ghost-run.ts";
import type { HudResult } from "./hud.tsx";
import { bestFor, noteRecord, type RecordBook } from "./records.ts";
import { recordKeyFor } from "./new-game.ts";
import { campaignResultFor, resultFor } from "./run-news.ts";
import type { Settings } from "./settings.ts";

/** A box the app writes through as well as into — a React ref. Written
 * through so a second finish inside one render reads the row this one just
 * set, which a state update would not have delivered yet. */
type Box<T> = { current: T };

export type SettleWorld = {
  /** The run the figure came off. */
  current: () => GameState;
  settings: () => Settings;
  /** The kind of track the URL asked for, for the record book's key. */
  track: TrackKind | undefined;
  /** Whether the player's own hands were on the craft, and the run was not a
   * staged moment. The rest of the honesty test — the developer's rows — is
   * read off the settings here. */
  rides: () => boolean;
  /** The campaign level under the HUD, or null on every other run. */
  riding: () => CampaignLevel | null;
  progress: Box<CampaignProgress>;
  setProgress: (progress: CampaignProgress) => void;
  records: Box<RecordBook>;
  setRecords: (book: RecordBook) => void;
  setResult: (result: HudResult | null) => void;
  ghost: GhostRig;
};

/** THE FINISH, booked. `value` is the run's figure in the mode's own
 * currency — the finish's time, or the score the buzzer caught. */
export function createSettler(world: SettleWorld): (value: number) => void {
  return (value: number): void => {
    const s = world.settings();
    if (!world.rides() || s.dev.scene !== null || s.dev.wind !== null || s.dev.hs !== null) return;
    const state = world.current();
    // THE TAPE FIRST, while the figure on file is still the one this run was
    // measured against: the rig keeps the run that BEAT it (`ghost-run.ts`),
    // and a book written before it would have moved the post.
    world.ghost.seal(value);
    // A CAMPAIGN RUN goes in the campaign's book and nowhere else: the field
    // is placed as it stands at the line (`fieldOrder`), the board keeps the
    // better afternoon, and the plate says what the finish did to the ladder.
    const pinned = world.riding();
    if (pinned) {
      const before = world.progress.current;
      const order = fieldOrder(state);
      const after = recordRun(before, pinned, { value, craft: state.craft.spec.id, order });
      world.progress.current = after;
      world.setProgress(after);
      world.setResult(
        campaignResultFor(pinned, order.indexOf(null) + 1, order.length, value, before, after),
      );
      return;
    }
    // A FREE RIDE still gets its plate and never gets a row: its weather is
    // the rider's own, so there is nothing to have beaten (`keepsRecords`).
    const key = recordKeyFor(s, world.track);
    const book = world.records.current;
    const standing = bestFor(book, key);
    const noted = noteRecord(book, key, { value, craft: state.craft.spec.id, at: Date.now() });
    if (noted.record) {
      world.records.current = noted.book;
      world.setRecords(noted.book);
    }
    world.setResult(resultFor(s, state, value, standing?.value ?? null, noted.record));
  };
}
