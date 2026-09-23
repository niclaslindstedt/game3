// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// CLOUD SAVE — the player's BOOK and their CAMPAIGN BOARD, carried between
// their own devices by the platform's cloud (iCloud key-value storage on iOS;
// the seam is written so a second platform is a new native provider and no
// change here).
//
// NATIVE APP ONLY. A browser has no platform cloud to talk to, so the shell
// bridge reports unavailable and every entry point below is a no-op — the
// website keeps writing localStorage exactly as it did.
//
// WHAT TRAVELS, AND WHAT DOES NOT:
//
//   records     YES. A best time is the thing a player would be sorriest to
//               lose with a phone, and it is small.
//   campaign    YES. Same reason, plus a board half-ridden on one device and
//               half on another is the case this whole file exists for.
//   ghosts      NO. A ghost is a control tape per run, and iCloud's key-value
//               store gives the whole app 1 MB. A dozen tapes would spend it
//               and start failing writes for the rows that matter.
//   benchmarks  NO. They measure THIS DEVICE's frame times. Carrying a
//               phone's numbers onto an iPad would make the graph a lie.
//   settings    NO. Graphics quality and controls are a fact about the
//               machine in your hands, and the privacy page says settings
//               stay on the device — so they do.
//
// THE MERGE IS MECHANICAL, NEVER A JUDGEMENT CALL. Two devices that both rode
// while offline must both keep their work, and re-running the merge must
// change nothing the second time:
//
//   records   BEST PER COURSE. Each row is keyed by the course's identity and
//             kept by `beats()` — the same comparison a fresh run goes
//             through, so a tricks score improves upward and a time improves
//             downward without this file knowing which is which.
//   campaign  FURTHEST PROGRESS. Per level: the better figure by that level's
//             own rule (`betterThan`), the HIGHER place, the better medal
//             (`bestMedal`), and the field's points from whichever run
//             actually placed the player higher — which is exactly what
//             `recordRun` does for a local run.
//
// Both rules are the game's own, imported rather than restated. A merge rule
// that drifts from the rule a live run uses is a rule that quietly disagrees
// with the game about who is faster.

import {
  EMPTY_PROGRESS,
  PLAYER_ID,
  betterThan,
  findLevel,
  loadProgress,
  mergeProgress,
  saveProgress,
  type CampaignProgress,
  type LevelResult,
  type Medal,
} from "./campaign.ts";
import {
  beats,
  loadRecords,
  mergeRecords,
  saveRecords,
  type RecordBook,
  type RunRecord,
} from "./records.ts";
import { MEDALS } from "./campaign-levels.ts";

/** The blob's shape, versioned so a later build can read an earlier one. */
export type CloudSave = {
  v: 1;
  /** Unix ms of the write. Informational — the merge never breaks a tie with
   * it, because two clocks on two devices are not one clock. */
  at: number;
  records: RecordBook;
  campaign: CampaignProgress;
};

export const CLOUD_SAVE_VERSION = 1;

/** The mode a record row was set in — the first segment of its id, which
 * `recordId` builds. Records carry their mode in the key rather than in the
 * row, so this is how a row is compared without re-deriving the course. */
function modeOf(id: string): string {
  return id.split("/")[0] ?? "";
}

/** BEST PER COURSE. Every row from both books, each kept by the comparison a
 * live run goes through. Order does not matter and running it twice changes
 * nothing. */
export function mergeBooks(mine: RecordBook, theirs: RecordBook): RecordBook {
  const out: Record<string, RunRecord> = { ...mine };
  for (const [id, row] of Object.entries(theirs)) {
    const standing = out[id] ?? null;
    // `beats` takes the mode so a tricks score can improve upward; the mode
    // lives in the id, and a row whose mode this build no longer knows is
    // kept only when nothing stands against it.
    const mode = modeOf(id) as Parameters<typeof beats>[0];
    if (standing === null || beats(mode, row.value, standing)) out[id] = row;
  }
  return out;
}

/** The better of two medals, by the catalog's own order. */
function betterMedal(a: Medal | null, b: Medal | null): Medal | null {
  if (a === null) return b;
  if (b === null) return a;
  return MEDALS.indexOf(a) >= MEDALS.indexOf(b) ? a : b;
}

/** FURTHEST PROGRESS. Per level, the better of the two rows by that level's
 * own rules, and the board from whichever run placed the player higher. */
export function mergeBoards(mine: CampaignProgress, theirs: CampaignProgress): CampaignProgress {
  const results: Record<string, LevelResult> = { ...mine.results };
  for (const [id, row] of Object.entries(theirs.results)) {
    const found = findLevel(id);
    // A level this build does not have is dropped rather than carried: the
    // ladder moved under it, and `mergeProgress` would drop it on the next
    // read anyway.
    if (!found) continue;
    const standing = results[id];
    if (standing === undefined) {
      results[id] = row;
      continue;
    }
    const figure =
      standing.best === undefined ||
      (row.best !== undefined && betterThan(found.level, row.best, standing.best))
        ? { best: row.best, craft: row.craft }
        : { best: standing.best, craft: standing.craft };
    results[id] = {
      ...figure,
      place: Math.min(standing.place, row.place),
      medal: betterMedal(standing.medal, row.medal),
    };
  }

  // THE BOARD FOLLOWS THE BETTER AFTERNOON, exactly as `recordRun` keeps it
  // for a local run: a level's points are the whole field's from one run, so
  // they are taken or left together rather than blended into a table no
  // afternoon produced.
  const points = { ...mine.points };
  for (const [id, board] of Object.entries(theirs.points)) {
    if (!findLevel(id)) continue;
    const standing = points[id];
    if (standing === undefined || (board[PLAYER_ID] ?? 0) > (standing[PLAYER_ID] ?? 0)) {
      points[id] = board;
    }
  }
  return { results, points };
}

/** This device's save, as it would go up. */
export function localSave(): CloudSave {
  return {
    v: CLOUD_SAVE_VERSION,
    at: Date.now(),
    records: loadRecords(),
    campaign: loadProgress(),
  };
}

/** A blob off the cloud, checked the way a stored blob is — every row through
 * the same validators local storage goes through, so a save written by a
 * build that knew more courses than this one cannot put a row on a board this
 * ladder does not have. */
export function parseSave(text: string | null): CloudSave | null {
  if (!text) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const blob = parsed as { at?: unknown; records?: unknown; campaign?: unknown };
  return {
    v: CLOUD_SAVE_VERSION,
    at: typeof blob.at === "number" && Number.isFinite(blob.at) ? blob.at : 0,
    records: mergeRecords(blob.records),
    campaign: blob.campaign === undefined ? EMPTY_PROGRESS : mergeProgress(blob.campaign),
  };
}

/** MERGE A CLOUD SAVE INTO THIS DEVICE and hand back what should go up.
 *
 * Both halves happen or neither does, and the result is written to local
 * storage before it is returned: a device that merged and then failed to
 * upload has still KEPT the other device's work, which is the half that
 * cannot be recovered by trying again. */
export function applyCloudSave(remote: CloudSave | null): CloudSave {
  const mine = localSave();
  if (remote === null) return mine;
  const records = mergeBooks(mine.records, remote.records);
  const campaign = mergeBoards(mine.campaign, remote.campaign);
  saveRecords(records);
  saveProgress(campaign);
  return { v: CLOUD_SAVE_VERSION, at: Date.now(), records, campaign };
}
