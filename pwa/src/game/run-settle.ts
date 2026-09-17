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
import { bestFor, noteRecord, type RecordBook } from "./records.ts";
import { recordKeyFor } from "./new-game.ts";
import { campaignResultFor, resultFor, type HudResult } from "./run-news.ts";
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
  /** Whether the player's own hands were on the craft. The bot rides the sea
   * behind every card and crosses the line like anybody else; its finish is
   * not one anyone asked for, and is the one finish that says nothing at
   * all. */
  rides: () => boolean;
  /** The campaign level under the HUD, or null on every other run. */
  riding: () => CampaignLevel | null;
  progress: Box<CampaignProgress>;
  setProgress: (progress: CampaignProgress) => void;
  records: Box<RecordBook>;
  setRecords: (book: RecordBook) => void;
  setResult: (result: HudResult | null) => void;
  /** The tape, narrowed to the one thing a finish does to it. Structural
   * rather than `GhostRig` so this module does not reach the renderer
   * through `ghost-run.ts` for a type it uses one method of — which is what
   * keeps the whole of what a finish DOES readable by the root suite
   * (`tests/run_settle_test.ts`). */
  ghost: { seal: (value: number) => void };
};

/** THE FINISH, booked. `value` is the run's figure in the mode's own
 * currency — the finish's time, or the score the buzzer caught. */
export function createSettler(world: SettleWorld): (value: number) => void {
  return (value: number): void => {
    // The one finish nobody is owed anything for.
    if (!world.rides()) return;
    const s = world.settings();
    const state = world.current();
    // THE HONESTY TEST, and it governs THE BOOKS ALONE: a staged moment, or
    // a wind or a sea set by hand, is not a run on this shore, so nothing it
    // does is written down — no tape, no ladder, no row (`ghost-run.ts` and
    // `replay.ts` refuse the same three rows, for the same reason).
    //
    // THE PLATE IS NOT A BOOKING. It is the game saying what just happened,
    // and a rider who crossed the line is owed it whatever the developer
    // page happens to be holding — it simply claims nothing. Folding it into
    // the test above left the game SILENT at the end of every run for anyone
    // carrying one of these rows, in every mode, which is how a finished run
    // came to look like no finish at all.
    // Read off the developer's rows and not off whether `App.tsx` happens to
    // hold a staged scenario: a scene is set one way (`settings.dev.scene`,
    // which is what stages it), and `ghost-run.ts` and `replay.ts` already
    // ask exactly this question in exactly these words.
    const books = s.dev.scene === null && s.dev.wind === null && s.dev.hs === null;
    // THE TAPE FIRST, while the figure on file is still the one this run was
    // measured against: the rig keeps the run that BEAT it (`ghost-run.ts`),
    // and a book written before it would have moved the post.
    if (books) world.ghost.seal(value);
    // A CAMPAIGN RUN goes in the campaign's book and nowhere else: the field
    // is placed as it stands at the line (`fieldOrder`), the board keeps the
    // better afternoon, and the plate says what the finish did to the ladder.
    const pinned = world.riding();
    if (pinned) {
      const before = world.progress.current;
      const order = fieldOrder(state);
      const after = books
        ? recordRun(before, pinned, { value, craft: state.craft.spec.id, order })
        : before;
      if (books) {
        world.progress.current = after;
        world.setProgress(after);
      }
      // A ladder that did not move says so by being handed the same progress
      // twice; the RECORD is the one line it would still have claimed off a
      // rung nobody had ridden, so an unbooked run is told it took none.
      const plate = campaignResultFor(
        pinned,
        order.indexOf(null) + 1,
        order.length,
        value,
        before,
        after,
      );
      world.setResult(books ? plate : { ...plate, record: false });
      return;
    }
    // A FREE RIDE still gets its plate and never gets a row: its weather is
    // the rider's own, so there is nothing to have beaten (`keepsRecords`).
    const key = recordKeyFor(s, world.track);
    const book = world.records.current;
    const standing = bestFor(book, key);
    const noted = books
      ? noteRecord(book, key, { value, craft: state.craft.spec.id, at: Date.now() })
      : null;
    if (noted?.record) {
      world.records.current = noted.book;
      world.setRecords(noted.book);
    }
    world.setResult(resultFor(s, state, value, standing?.value ?? null, noted?.record ?? false));
  };
}
