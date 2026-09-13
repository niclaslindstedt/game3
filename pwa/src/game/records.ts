// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RECORD BOOK — the best this machine has seen on each shore, in each
// mode: a time for a race or a time trial, a score for a tricks run.
//
// ONE ROW PER SHORE PER MODE, and a shore is what the LEVEL is: the coast,
// the seed, the kind of track and the class the course was paced for (R32
// makes the same seed at two classes two different courses), plus how long
// a tricks run was given. Not the craft, not the hour, not the wind: those
// are the rider's choices on the same water, and a book partitioned by
// everything that changes a time would hold one run per row — a stopwatch,
// not a record. The sibling rally game keeps its best per stage on the same
// reasoning, and this is its shape with a seed where it has a level id. The
// hull that set the row is written on it, because what beat you is half of
// the news.
//
// Two halves, the way `settings.ts` is split: everything above the storage
// line is PURE — a key, a comparison, a book laid over a book — so
// `tests/records_test.ts` holds the policy without a browser, and the two
// functions under it are the skin over `localStorage`. A machine with no
// storage still keeps this session's book in memory; a row is never
// load-bearing.
//
// A TIE IS NOT A RECORD. The row stands until it is beaten outright, so a
// rider who matches it to the hundredth is told they matched it.

import { type BiomeId, type CraftId, type GameMode, type TrackKind, isCraftId } from "@engine";

/** What names a row: the level, the mode, and a tricks run's length. */
export type RecordKey = {
  mode: GameMode;
  biome: BiomeId;
  seed: number;
  track: TrackKind;
  speedClass: number;
  /** The tricks run's length, minutes; ignored by every other mode. */
  minutes: number;
};

/** One row: the figure — seconds for a race or a time trial, points for a
 * tricks run — the hull that set it, and when, as a unix ms stamp. */
export type RunRecord = {
  value: number;
  craft: CraftId;
  at: number;
};

export type RecordBook = Readonly<Record<string, RunRecord>>;

/** The row's id, which is the level's identity and the mode's. */
export function recordId(key: RecordKey): string {
  const level = `${key.biome}/${key.seed}/${key.track}/${key.speedClass}`;
  return key.mode === "tricks" ? `tricks/${level}/${key.minutes}` : `${key.mode}/${level}`;
}

/** Whether a mode's figure is better HIGHER: points are, seconds are not. */
export function scoresHigher(mode: GameMode): boolean {
  return mode === "tricks";
}

/** Whether `value` beats the row standing — outright, never on a tie — or
 * stands where there is none. A figure that is not a figure beats nothing. */
export function beats(mode: GameMode, value: number, standing: RunRecord | null): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  if (standing === null) return true;
  return scoresHigher(mode) ? value > standing.value : value < standing.value;
}

export function bestFor(book: RecordBook, key: RecordKey): RunRecord | null {
  return book[recordId(key)] ?? null;
}

/** The book with this run in it, if it earned a row — and whether it did.
 * Pure: the book handed in is never written. */
export function noteRecord(
  book: RecordBook,
  key: RecordKey,
  run: RunRecord,
): { book: RecordBook; record: boolean } {
  const standing = bestFor(book, key);
  if (!beats(key.mode, run.value, standing)) return { book, record: false };
  return { book: { ...book, [recordId(key)]: { ...run } }, record: true };
}

/** A stored blob as a book, one row at a time — every row checked, and any
 * that is not a row a run could have set dropped: a figure that is not
 * positive and finite, a hull the catalog no longer has, an id that is not a
 * string. The same rule `mergeSettings` applies, for the same reason. */
export function mergeRecords(parsed: unknown): RecordBook {
  const book: Record<string, RunRecord> = {};
  if (!parsed || typeof parsed !== "object") return book;
  for (const [id, row] of Object.entries(parsed as Record<string, unknown>)) {
    if (!row || typeof row !== "object") continue;
    const r = row as Partial<Record<keyof RunRecord, unknown>>;
    if (typeof r.value !== "number" || !Number.isFinite(r.value) || r.value <= 0) continue;
    if (typeof r.craft !== "string" || !isCraftId(r.craft)) continue;
    const at = typeof r.at === "number" && Number.isFinite(r.at) ? r.at : 0;
    book[id] = { value: r.value, craft: r.craft, at };
  }
  return book;
}

const RECORDS_KEY = "sea-haven-records";

export function loadRecords(): RecordBook {
  try {
    const stored = localStorage.getItem(RECORDS_KEY);
    return mergeRecords(stored === null ? null : JSON.parse(stored));
  } catch {
    /* storage unavailable, or not JSON — an empty book is a good book */
    return {};
  }
}

export function saveRecords(book: RecordBook): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(book));
  } catch {
    /* storage unavailable — the row still stands for this session */
  }
}
