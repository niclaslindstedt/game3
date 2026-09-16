// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN — pinned shores, in order, ridden for points.
//
// Everything a generated level needs is a seed and the dials it is built
// at, so a campaign level is just those with a day and a name pinned to
// them (`campaign-levels.ts`): the same generator builds it, on the version
// it was curated under, and it comes out identical for every player.
//
// A CAMPAIGN IS A CHAMPIONSHIP, the sibling rally game's shape retyped for
// water. Every level is ridden against the same eleven rivals — on the
// water to make it feel lived on, never leaned on (`RunRules.contact` is
// off) — and pays the podium the way a kart game does: three for the win,
// two for second, one for third, nothing at all below it. The points are
// kept for the WHOLE field, because the thing that has to be true at the
// end of a shore is "you beat these eleven", and that is only a sentence
// if their points are on the board beside yours.
//
// The points are also THE LOCK, at both scales:
//
//   * A LEVEL opens once the one before it paid the player something —
//     a podium on a race, and on a tricks level a MEDAL (bronze, silver,
//     gold: a score to beat, the way a mountain game sets one), which is
//     what clears it. A tricks level still places the player against the
//     field by score and pays the table for it; the medal is the door.
//   * A SHORE opens once the one before it has been ridden all the way
//     through and the player is TOP of its table.
//
// Nothing here is ever spent: a level can be ridden again as often as the
// player likes, and the board keeps the better afternoon. That is the whole
// shape of the thing — see the shore, then go back for the wins it costs to
// leave it — and it is why a level already cleared is still worth riding.
//
// Two halves, the way `records.ts` is split: everything above the storage
// line is PURE — a level built, a run booked, a lock read — so
// `tests/campaign_test.ts` holds the policy without a browser, and the two
// functions under it are the skin over `localStorage`. A machine with no
// storage still keeps this session's board in memory.

import {
  RACE,
  createGame,
  generateLevel,
  type CraftId,
  type GameState,
  type Level,
  type RunConditions,
  isCraftId,
} from "@engine";

import {
  CAMPAIGN_LEVELS,
  MEDALS,
  SHORES,
  type CampaignLevel,
  type CampaignShore,
  type Medal,
} from "./campaign-levels.ts";

export { CAMPAIGN_LEVELS, MEDALS, SHORES } from "./campaign-levels.ts";
export type { CampaignLevel, CampaignMode, CampaignShore, Medal } from "./campaign-levels.ts";

/* ── THE LEVEL, BUILT ─────────────────────────────────────────────────── */

/** The shore a level belongs to. */
export function shoreOf(level: CampaignLevel): CampaignShore {
  return SHORES.find((s) => s.levels.includes(level)) ?? SHORES[0];
}

/** Where a level id sits, for the finish handler that has only the id. */
export function findLevel(
  id: string,
): { shore: CampaignShore; level: CampaignLevel; index: number } | null {
  for (const shore of SHORES) {
    const index = shore.levels.findIndex((l) => l.id === id);
    if (index >= 0) return { shore, level: shore.levels[index], index };
  }
  return null;
}

/** THE SHORE ITSELF, exactly as it was curated: the seed on its own
 * generator version, in its shore's coast, as a tricks field when the level
 * is one, under the swell it pins. Nothing about the day is in here — the
 * day is what the run is stood up in (`campaignGame`), and the same shore
 * under a different sky is the same shore. */
export function buildCampaignLevel(level: CampaignLevel): Level {
  return generateLevel(level.seed, {
    biome: shoreOf(level).id,
    track: level.track,
    tricks: level.mode === "tricks",
    swell: level.swell,
    version: level.version,
  });
}

/** THE DAY the level is ridden in, as the rating reads it. */
export function campaignConditions(level: CampaignLevel): RunConditions {
  return { hour: level.hour, season: level.season, weather: level.weather, wind: level.wind };
}

/** A RUN of the level, stood up for the player on `craft`: the pinned
 * shore under the pinned day, in the level's own mode, with the whole field
 * on the water and nobody able to lean on anybody. THROWS when the
 * generator refuses the seed, which a curated seed never does. */
export function campaignGame(level: CampaignLevel, craft: CraftId, built?: Level): GameState {
  return createGame({
    seed: level.seed,
    level: built ?? buildCampaignLevel(level),
    craft,
    mode: level.mode,
    limit: (level.minutes ?? 0) * 60,
    windSpeed: level.wind,
    hour: level.hour,
    season: level.season,
    weather: level.weather,
    // The field is there to be RACED AMONG, on every rung: a tricks run
    // has nobody on it by its own rules and gets the race's grid here, and
    // the hulls pass through each other, so a rider going for a flip is
    // never put in the water by somebody else's line.
    rules: { rivals: RACE.rivals, contact: false },
  });
}

/* ── THE POINTS ───────────────────────────────────────────────────────── */

/** The player's own id on a board; a rival's is `riderKey(rival.id)`. */
export const PLAYER_ID = "you";

/** A rider's key on the board from the engine's own reading of the field
 * (`fieldOrder`: a rival's slot id, `null` for the player). */
export function riderKey(id: number | null): string {
  return id === null ? PLAYER_ID : `r${id}`;
}

/** What a place is worth, best first. Off the end of it a level is worth
 * nothing at all: a table where everybody scores is a starting-money table,
 * and the fourth place has to STING. */
export const POINTS = [3, 2, 1] as const;

/** How many places the podium is — the length of the points table, because
 * they are the same statement: finish where nothing is paid and the level
 * is not cleared. */
export const PODIUM = POINTS.length;

export function pointsFor(place: number): number {
  return POINTS[place - 1] ?? 0;
}

/** WHICH MEDAL a tricks score earns, or none. A race level pays no medal. */
export function medalFor(level: CampaignLevel, score: number): Medal | null {
  if (!level.medals) return null;
  let won: Medal | null = null;
  for (const medal of MEDALS) if (score >= level.medals[medal]) won = medal;
  return won;
}

/** Points for one level, by rider id. */
export type LevelScores = Record<string, number>;

/** What the player got out of a level, best of every afternoon: the figure
 * in the level's own currency (seconds on a race, points on a tricks run),
 * the hull that set it, the best place against the field, and — on a
 * tricks level — the best medal. */
export type LevelResult = {
  best: number;
  craft: CraftId;
  place: number;
  medal: Medal | null;
};

export type CampaignProgress = {
  /** The player's best on each level ridden to the end, by level id. */
  results: Record<string, LevelResult>;
  /** What every level has paid the WHOLE FIELD, by level id — the board the
   * campaign is played on. A level never ridden is simply absent. */
  points: Record<string, LevelScores>;
};

export const EMPTY_PROGRESS: CampaignProgress = { results: {}, points: {} };

/** A finished run, as the app hands it in: the figure, the hull, and the
 * field in the order it stood at the end (`fieldOrder`). */
export type CampaignRun = {
  value: number;
  craft: CraftId;
  order: readonly (number | null)[];
};

/** Whether `value` beats `standing` in the level's currency: a lower time,
 * a higher score. */
export function betterThan(level: CampaignLevel, value: number, standing: number): boolean {
  return level.mode === "tricks" ? value > standing : value < standing;
}

/** THE RUN, BOOKED: the level's result and the field's points, keeping THE
 * BETTER AFTERNOON — the one that placed the player higher, and the whole
 * field's points from that same run with it. A worse run changes nothing
 * on the board (a lap ridden for fun must never cost a title), while the
 * best figure and the best medal improve on their own, whatever the field
 * did. Pure: returns the progress to render from. */
export function recordRun(
  progress: CampaignProgress,
  level: CampaignLevel,
  run: CampaignRun,
): CampaignProgress {
  const place = run.order.indexOf(null) + 1 || run.order.length + 1;
  const medal = level.mode === "tricks" ? medalFor(level, run.value) : null;
  const stood = progress.results[level.id];
  const result: LevelResult = {
    best: stood === undefined || betterThan(level, run.value, stood.best) ? run.value : stood.best,
    craft:
      stood === undefined || betterThan(level, run.value, stood.best) ? run.craft : stood.craft,
    place: stood === undefined ? place : Math.min(stood.place, place),
    medal: stood === undefined ? medal : bestMedal(stood.medal, medal),
  };
  const scored: LevelScores = {};
  run.order.forEach((id, i) => {
    scored[riderKey(id)] = pointsFor(i + 1);
  });
  const board = progress.points[level.id];
  const mine = scored[PLAYER_ID] ?? 0;
  const theirs = board?.[PLAYER_ID] ?? 0;
  const points =
    board === undefined || mine > theirs
      ? { ...progress.points, [level.id]: scored }
      : progress.points;
  return { results: { ...progress.results, [level.id]: result }, points };
}

function bestMedal(a: Medal | null, b: Medal | null): Medal | null {
  if (a === null) return b;
  if (b === null) return a;
  return MEDALS.indexOf(a) >= MEDALS.indexOf(b) ? a : b;
}

/* ── THE LOCKS ────────────────────────────────────────────────────────── */

/** CLEARED — the level paid the player something: a podium on a race, a
 * medal on a tricks level. */
export function levelCleared(progress: CampaignProgress, level: CampaignLevel): boolean {
  const result = progress.results[level.id];
  if (result === undefined) return false;
  return level.mode === "tricks" ? result.medal !== null : result.place <= PODIUM;
}

/** A level opens once the one before it on its shore has been cleared; the
 * first is always open — on a shore that is. */
export function levelUnlocked(
  shore: CampaignShore,
  index: number,
  progress: CampaignProgress,
): boolean {
  if (!shoreUnlocked(shore, progress)) return false;
  if (index <= 0) return true;
  return levelCleared(progress, shore.levels[index - 1]);
}

/** One rider's line of a shore's table. */
export type StandingsRow = {
  id: string;
  points: number;
  /** Level wins — the first tie-break, and the line a shore is remembered
   * by. */
  wins: number;
  /** 1 is the lead. */
  place: number;
  you: boolean;
};

/** THE TABLE — every rider entered on the shore, the player included, best
 * first. Ties go to level wins, then to the player: a shore that ends level
 * and hands the next one to the machine is a lock with no visible way in.
 * The rivals are the race's grid, by slot, so a rider who has never scored
 * still has a row. */
export function shoreStandings(shore: CampaignShore, progress: CampaignProgress): StandingsRow[] {
  const ids = [PLAYER_ID, ...Array.from({ length: RACE.rivals }, (_, i) => riderKey(i))];
  const rows = ids.map((id) => {
    let points = 0;
    let wins = 0;
    for (const level of shore.levels) {
      const got = progress.points[level.id]?.[id] ?? 0;
      points += got;
      if (got === POINTS[0]) wins += 1;
    }
    return { id, points, wins, you: id === PLAYER_ID };
  });
  rows.sort(
    (a, b) => b.points - a.points || b.wins - a.wins || (a.you ? -1 : 0) - (b.you ? -1 : 0),
  );
  return rows.map((row, index) => ({ ...row, place: index + 1 }));
}

/** The player's own line of the table. */
export function playerStanding(shore: CampaignShore, progress: CampaignProgress): StandingsRow {
  const table = shoreStandings(shore, progress);
  return table.find((row) => row.you) ?? table[table.length - 1];
}

/** How many of the shore's levels have been ridden to the end at all. */
export function levelsRidden(shore: CampaignShore, progress: CampaignProgress): number {
  return shore.levels.filter((level) => progress.results[level.id] !== undefined).length;
}

/** WON — every level ridden and the player top of the shore's table. Both
 * halves matter: a table nobody has scored on is one the player leads on
 * the tie-break, and an empty board must not open a shore. */
export function shoreWon(shore: CampaignShore, progress: CampaignProgress): boolean {
  return (
    levelsRidden(shore, progress) === shore.levels.length &&
    playerStanding(shore, progress).place === 1
  );
}

/** A shore opens once the one before it has been WON. The first is always
 * open. */
export function shoreUnlocked(shore: CampaignShore, progress: CampaignProgress): boolean {
  const index = SHORES.indexOf(shore);
  if (index <= 0) return true;
  return shoreWon(SHORES[index - 1], progress);
}

/** WHERE THE CAMPAIGN PICKS BACK UP on a shore. Forward first: the next
 * open level never ridden. Then back to the first open level not WON —
 * which is the whole shape of a points campaign. Null when every open
 * level is a win. */
export function continueAt(shore: CampaignShore, progress: CampaignProgress): CampaignLevel | null {
  const open = shore.levels.filter((_l, index) => levelUnlocked(shore, index, progress));
  return (
    open.find((level) => progress.results[level.id] === undefined) ??
    open.find((level) => (progress.points[level.id]?.[PLAYER_ID] ?? 0) < POINTS[0]) ??
    null
  );
}

/** Where the ladder goes after a level: the next rung, the next SHORE
 * behind the table it is locked to, or the end of the road. */
export type LadderStep =
  | { kind: "next"; level: CampaignLevel }
  | { kind: "locked"; shore: CampaignShore }
  | { kind: "end" };

export function ladderAfter(levelId: string, progress: CampaignProgress): LadderStep {
  const here = findLevel(levelId);
  if (!here) return { kind: "end" };
  const after = here.shore.levels[here.index + 1];
  if (after) {
    return levelUnlocked(here.shore, here.index + 1, progress)
      ? { kind: "next", level: after }
      : { kind: "locked", shore: here.shore };
  }
  const nextShore = SHORES[SHORES.indexOf(here.shore) + 1];
  if (!nextShore) return { kind: "end" };
  return shoreUnlocked(nextShore, progress)
    ? { kind: "next", level: nextShore.levels[0] }
    : { kind: "locked", shore: here.shore };
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

const PROGRESS_KEY = "sea-haven-campaign";

/** A stored blob turned into progress this build can stand on: every id
 * checked against the ladder, every figure checked for being a number, and
 * anything else dropped — a level that no longer exists takes its row with
 * it rather than leaving a ghost on the board. */
export function mergeProgress(parsed: unknown): CampaignProgress {
  const out: CampaignProgress = { results: {}, points: {} };
  if (typeof parsed !== "object" || parsed === null) return out;
  const known = new Set(CAMPAIGN_LEVELS.map((l) => l.id));
  const blob = parsed as { results?: unknown; points?: unknown };
  if (typeof blob.results === "object" && blob.results !== null) {
    for (const [id, row] of Object.entries(blob.results as Record<string, unknown>)) {
      if (!known.has(id) || typeof row !== "object" || row === null) continue;
      const r = row as Partial<LevelResult>;
      if (typeof r.best !== "number" || !Number.isFinite(r.best) || r.best < 0) continue;
      const craft = r.craft;
      if (typeof craft !== "string" || !isCraftId(craft)) continue;
      if (!Number.isInteger(r.place) || (r.place as number) < 1) continue;
      const medal = MEDALS.find((m) => m === r.medal) ?? null;
      out.results[id] = { best: r.best, craft, place: r.place as number, medal };
    }
  }
  if (typeof blob.points === "object" && blob.points !== null) {
    for (const [id, row] of Object.entries(blob.points as Record<string, unknown>)) {
      if (!known.has(id) || typeof row !== "object" || row === null) continue;
      const scores: LevelScores = {};
      for (const [rider, got] of Object.entries(row as Record<string, unknown>)) {
        if (typeof got === "number" && Number.isFinite(got)) scores[rider] = got;
      }
      out.points[id] = scores;
    }
  }
  return out;
}

export function loadProgress(): CampaignProgress {
  try {
    const stored = localStorage.getItem(PROGRESS_KEY);
    return stored ? mergeProgress(JSON.parse(stored)) : EMPTY_PROGRESS;
  } catch {
    return EMPTY_PROGRESS;
  }
}

export function saveProgress(progress: CampaignProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* storage unavailable — the board still holds for this session */
  }
}
