// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RECORD BOOK (`pwa/src/game/records.ts`): one row per shore per mode,
// beaten outright or not at all, and a stored blob trusted no further than
// a run could have written it.
import { describe, expect, it } from "vitest";

import {
  beats,
  bestFor,
  keepsRecords,
  mergeRecords,
  noteRecord,
  recordId,
  scoresHigher,
  type RecordBook,
  type RecordKey,
} from "../pwa/src/game/records.ts";

const SHORE: RecordKey = {
  mode: "timeTrial",
  biome: "taiga",
  seed: 38,
  track: "coast",
  speedClass: 1,
  minutes: 2,
};

describe("what names a row", () => {
  it("is the level and the mode: a different seed, coast, track, class or mode is another row", () => {
    const id = recordId(SHORE);
    expect(recordId({ ...SHORE, seed: 39 })).not.toBe(id);
    expect(recordId({ ...SHORE, biome: "mangrove" })).not.toBe(id);
    expect(recordId({ ...SHORE, track: "circuit" })).not.toBe(id);
    expect(recordId({ ...SHORE, speedClass: 1.25 })).not.toBe(id);
    expect(recordId({ ...SHORE, mode: "race" })).not.toBe(id);
    expect(recordId({ ...SHORE, mode: "tricks" })).not.toBe(id);
  });

  it("counts a tricks run's length, and nothing else counts it", () => {
    const tricks = { ...SHORE, mode: "tricks" as const };
    expect(recordId({ ...tricks, minutes: 4 })).not.toBe(recordId(tricks));
    expect(recordId({ ...SHORE, minutes: 4 })).toBe(recordId(SHORE));
  });
});

describe("what beats a row", () => {
  it("is a lower time, and a higher score", () => {
    expect(scoresHigher("tricks")).toBe(true);
    expect(scoresHigher("race")).toBe(false);
    const stood = { value: 100, craft: "skiff" as const, at: 0 };
    expect(beats("timeTrial", 99.99, stood)).toBe(true);
    expect(beats("timeTrial", 100.01, stood)).toBe(false);
    expect(beats("race", 90, stood)).toBe(true);
    expect(beats("tricks", 101, stood)).toBe(true);
    expect(beats("tricks", 99, stood)).toBe(false);
  });

  it("never a tie, and never a figure that is not one", () => {
    const stood = { value: 100, craft: "skiff" as const, at: 0 };
    expect(beats("timeTrial", 100, stood)).toBe(false);
    expect(beats("tricks", 100, stood)).toBe(false);
    for (const bad of [0, -5, NaN, Infinity]) {
      expect(beats("timeTrial", bad, null)).toBe(false);
      expect(beats("tricks", bad, null)).toBe(false);
    }
  });

  it("stands where there is none", () => {
    expect(beats("timeTrial", 500, null)).toBe(true);
    expect(beats("tricks", 1, null)).toBe(true);
  });

  it("is NOTHING on a free ride, whatever the figure", () => {
    // The mode that keeps no book (`keepsRecords`): its weather is the
    // rider's own — a wind, a quarter and a sea off its own faders — so two
    // runs down the same shore are not two runs down the same shore, and a
    // row set on a flat calm and beaten in a following gale would be a
    // stopwatch measuring the weather. Held at `beats` rather than only at
    // the caller, so a surface that forgets cannot write one.
    expect(keepsRecords("free")).toBe(false);
    for (const mode of ["race", "tricks", "timeTrial"] as const) {
      expect(keepsRecords(mode)).toBe(true);
    }
    expect(beats("free", 10, null)).toBe(false);
    expect(beats("free", 10, { value: 100, craft: "skiff", at: 0 })).toBe(false);
    const { book, record } = noteRecord(
      {},
      { ...SHORE, mode: "free" },
      {
        value: 42,
        craft: "skiff",
        at: 0,
      },
    );
    expect(record).toBe(false);
    expect(book).toEqual({});
  });
});

describe("the book", () => {
  it("takes a first run, a better one, and refuses a worse one — without writing the book it was handed", () => {
    const empty: RecordBook = {};
    const first = noteRecord(empty, SHORE, { value: 120, craft: "skiff", at: 1 });
    expect(first.record).toBe(true);
    expect(empty).toEqual({});
    expect(bestFor(first.book, SHORE)).toEqual({ value: 120, craft: "skiff", at: 1 });
    const worse = noteRecord(first.book, SHORE, { value: 130, craft: "dart", at: 2 });
    expect(worse.record).toBe(false);
    expect(worse.book).toBe(first.book);
    const better = noteRecord(first.book, SHORE, { value: 110, craft: "dart", at: 3 });
    expect(better.record).toBe(true);
    expect(bestFor(better.book, SHORE)?.craft).toBe("dart");
    expect(bestFor(first.book, SHORE)?.value).toBe(120);
  });

  it("keeps a tricks score and a time-trial time on the same shore apart", () => {
    const tricks = { ...SHORE, mode: "tricks" as const };
    let book: RecordBook = {};
    book = noteRecord(book, SHORE, { value: 90, craft: "skiff", at: 0 }).book;
    book = noteRecord(book, tricks, { value: 4200, craft: "otter", at: 0 }).book;
    expect(bestFor(book, SHORE)?.value).toBe(90);
    expect(bestFor(book, tricks)?.value).toBe(4200);
    expect(bestFor(book, { ...SHORE, mode: "race" })).toBeNull();
  });

  it("reads a stored blob one row at a time and drops what a run could not have set", () => {
    const book = mergeRecords({
      [recordId(SHORE)]: { value: 88.5, craft: "marlin", at: 5 },
      old: { value: 70, craft: "hovercraft", at: 1 },
      bad: { value: -1, craft: "skiff", at: 1 },
      nan: { value: "fast", craft: "skiff" },
      undated: { value: 12, craft: "dart" },
      junk: 7,
    });
    expect(Object.keys(book).sort()).toEqual([recordId(SHORE), "undated"].sort());
    expect(book.undated).toEqual({ value: 12, craft: "dart", at: 0 });
    expect(mergeRecords(null)).toEqual({});
    expect(mergeRecords("not a book")).toEqual({});
  });
});
