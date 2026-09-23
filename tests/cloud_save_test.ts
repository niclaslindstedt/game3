// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CLOUD SAVE's merge (`pwa/src/game/cloud-save.ts`): two devices that both
// rode while offline, reconciled without a judgement call.
//
// The rules under test are the ones the game already uses for a live run —
// best per course, furthest progress — so these cases are as much about the
// merge AGREEING with the game as about the merge working. A rule that drifts
// is a rule that quietly disagrees with the game about who is faster.
import { describe, expect, it } from "vitest";

import { applyCloudSave, mergeBoards, mergeBooks, parseSave } from "../pwa/src/game/cloud-save.ts";
import { recordId, type RecordBook } from "../pwa/src/game/records.ts";
import { EMPTY_PROGRESS, type CampaignProgress } from "../pwa/src/game/campaign.ts";

const raceId = recordId({
  mode: "race",
  biome: "mangrove",
  seed: 5,
  track: "coast",
  speedClass: 1,
  minutes: 0,
});
const tricksId = recordId({
  mode: "tricks",
  biome: "mangrove",
  seed: 34,
  track: "coast",
  speedClass: 1,
  minutes: 2,
});

const book = (rows: Record<string, number>): RecordBook =>
  Object.fromEntries(
    Object.entries(rows).map(([id, value]) => [id, { value, craft: "skiff", at: 1 }]),
  );

describe("best per course", () => {
  it("keeps the FASTER time when both devices rode the same race", () => {
    const merged = mergeBooks(book({ [raceId]: 92.5 }), book({ [raceId]: 88.1 }));
    expect(merged[raceId]?.value).toBe(88.1);
  });

  it("keeps the HIGHER score on a tricks run — the same row, the other way", () => {
    // The comparison comes from the game (`beats`), which reads the mode out
    // of the row's id. If this ever flips, a tricks best would be "improved"
    // downward by a worse afternoon.
    const merged = mergeBooks(book({ [tricksId]: 1200 }), book({ [tricksId]: 1850 }));
    expect(merged[tricksId]?.value).toBe(1850);
  });

  it("keeps a course only one device has ever ridden", () => {
    const merged = mergeBooks(book({ [raceId]: 92.5 }), book({ [tricksId]: 900 }));
    expect(Object.keys(merged).sort()).toEqual([raceId, tricksId].sort());
  });

  it("does not care which side is which, and does not drift on a second run", () => {
    const mine = book({ [raceId]: 92.5, [tricksId]: 1850 });
    const theirs = book({ [raceId]: 88.1, [tricksId]: 1200 });
    const once = mergeBooks(mine, theirs);
    expect(mergeBooks(theirs, mine)).toEqual(once);
    expect(mergeBooks(once, theirs)).toEqual(once);
  });
});

describe("furthest progress", () => {
  const board = (result: Partial<CampaignProgress["results"][string]>): CampaignProgress => ({
    results: { "mangrove-1": { place: 4, medal: null, ...result } },
    points: {},
  });

  it("keeps the better time, and the craft that set it, together", () => {
    const merged = mergeBoards(
      board({ best: 95, craft: "skiff", place: 3 }),
      board({ best: 90, craft: "marlin", place: 2 }),
    );
    expect(merged.results["mangrove-1"]).toMatchObject({ best: 90, craft: "marlin" });
  });

  it("keeps the HIGHER place even when the other device was slower", () => {
    // Placing is not the clock: a slower afternoon in a weaker field can still
    // be the better finish, and a board that forgot it would demote a player
    // for riding again.
    const merged = mergeBoards(
      board({ best: 90, craft: "skiff", place: 5 }),
      board({ best: 95, craft: "skiff", place: 2 }),
    );
    expect(merged.results["mangrove-1"]).toMatchObject({ best: 90, place: 2 });
  });

  it("keeps the better medal", () => {
    const merged = mergeBoards(
      board({ best: 95, craft: "skiff", medal: "bronze" }),
      board({ best: 99, craft: "skiff", medal: "gold" }),
    );
    expect(merged.results["mangrove-1"]?.medal).toBe("gold");
  });

  it("drops a level this ladder no longer has", () => {
    const merged = mergeBoards(EMPTY_PROGRESS, {
      results: { "a-shore-that-was-recut-9": { place: 1, medal: "gold" } },
      points: {},
    });
    expect(merged.results).toEqual({});
  });

  it("takes the field's points from whichever run placed the player higher", () => {
    // Points are one afternoon's whole field, so they move together — a
    // blended table is a table no afternoon produced.
    const mine: CampaignProgress = {
      results: {},
      points: { "mangrove-1": { you: 6, r1: 10 } },
    };
    const theirs: CampaignProgress = {
      results: {},
      points: { "mangrove-1": { you: 15, r1: 6 } },
    };
    expect(mergeBoards(mine, theirs).points["mangrove-1"]).toEqual({ you: 15, r1: 6 });
    expect(mergeBoards(theirs, mine).points["mangrove-1"]).toEqual({ you: 15, r1: 6 });
  });
});

describe("what comes off the wire", () => {
  it("reads nothing out of nothing rather than throwing", () => {
    expect(parseSave(null)).toBeNull();
    expect(parseSave("not json")).toBeNull();
  });

  it("puts a blob through the same validators local storage uses", () => {
    const save = parseSave(
      JSON.stringify({
        at: 5,
        records: { [raceId]: { value: -1, craft: "skiff", at: 1 } },
        campaign: { results: {}, points: {} },
      }),
    );
    // A negative time is not a row a run could have set, so it does not
    // become one by arriving from another device.
    expect(save?.records).toEqual({});
  });

  it("a device with no cloud save yet uploads its own", () => {
    const out = applyCloudSave(null);
    expect(out.v).toBe(1);
    expect(out.records).toBeDefined();
  });
});
